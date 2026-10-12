-- Explicit, versioned customer document acceptance. This records consent to a
-- document; it does not assert identity verification or a qualified signature.
-- Document rows are seeded by scripts/migrate-client-agreements.mjs, which
-- verifies the archived PDF bytes against app/lib/agreement-manifest.json.
create table if not exists public.client_agreement_versions (
  version text not null check (char_length(version) between 1 and 100),
  locale text not null check (locale in ('de', 'en', 'fr', 'es', 'it')),
  document_path text not null check (document_path ~ '^/documents/agreements/[a-zA-Z0-9-]+/(de|en|fr|es|it)\.pdf$'),
  document_sha256 text not null check (document_sha256 ~ '^[a-f0-9]{64}$'),
  consent_text text not null check (char_length(consent_text) between 10 and 2000),
  is_draft boolean not null,
  active boolean not null default true,
  primary key (version, locale)
);

create table if not exists public.client_agreement_acceptances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  signer_name text not null check (char_length(btrim(signer_name)) between 2 and 120),
  email text not null,
  version text not null,
  locale text not null,
  document_path text not null,
  document_sha256 text not null check (document_sha256 ~ '^[a-f0-9]{64}$'),
  consent_text text not null,
  is_draft boolean not null,
  accepted_at timestamptz not null default clock_timestamp(),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid references auth.users(id) on delete restrict,
  reviewed_at timestamptz,
  review_note text check (char_length(regexp_replace(review_note, '^[[:space:]]+|[[:space:]]+$', '', 'g')) between 3 and 1000),
  unique (user_id, version),
  foreign key (version, locale) references public.client_agreement_versions(version, locale) on delete restrict,
  check (
    (status = 'pending' and reviewed_by is null and reviewed_at is null and review_note is null)
    or (status in ('approved', 'rejected') and reviewed_by is not null and reviewed_at is not null and review_note is not null)
  )
);

create index if not exists client_agreement_acceptances_review_idx
  on public.client_agreement_acceptances(status, accepted_at desc);

-- Read the authoritative account, rather than trusting editable user metadata
-- or a stale/forged role claim supplied in a request.
create or replace function public.is_client_agreement_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from auth.users
    where id = (select auth.uid()) and raw_app_meta_data ->> 'role' = 'admin'
  );
$$;

alter table public.client_agreement_versions enable row level security;
alter table public.client_agreement_acceptances enable row level security;
drop policy if exists "Authenticated read agreement versions" on public.client_agreement_versions;
create policy "Authenticated read agreement versions"
  on public.client_agreement_versions for select to authenticated using (true);
drop policy if exists "Customers read own agreement acceptance" on public.client_agreement_acceptances;
create policy "Customers read own agreement acceptance"
  on public.client_agreement_acceptances for select to authenticated
  using (user_id = (select auth.uid()));
drop policy if exists "Trusted admins read agreement acceptances" on public.client_agreement_acceptances;
create policy "Trusted admins read agreement acceptances"
  on public.client_agreement_acceptances for select to authenticated
  using ((select public.is_client_agreement_admin()));

-- Even privileged maintenance must introduce a new version if PDF or consent
-- changes. An existing version can only be activated/deactivated.
create or replace function public.protect_client_agreement_version()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'AGREEMENT_VERSION_IMMUTABLE';
  end if;
  if (to_jsonb(new) - 'active') is distinct from (to_jsonb(old) - 'active') then
    raise exception 'AGREEMENT_VERSION_IMMUTABLE';
  end if;
  return new;
end;
$$;
drop trigger if exists protect_client_agreement_version on public.client_agreement_versions;
create trigger protect_client_agreement_version
  before update or delete on public.client_agreement_versions
  for each row execute function public.protect_client_agreement_version();

-- The original signer, account, document snapshot and acceptance time never
-- change. No client/service role has direct write privileges; review is an RPC.
create or replace function public.protect_client_agreement_acceptance()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'AGREEMENT_ACCEPTANCE_IMMUTABLE';
  end if;
  if (to_jsonb(new) - array['status', 'reviewed_by', 'reviewed_at', 'review_note'])
     is distinct from (to_jsonb(old) - array['status', 'reviewed_by', 'reviewed_at', 'review_note']) then
    raise exception 'AGREEMENT_ACCEPTANCE_IMMUTABLE';
  end if;
  if old.status <> 'pending' then
    raise exception 'AGREEMENT_ALREADY_REVIEWED';
  end if;
  if new.status not in ('approved', 'rejected') or new.reviewed_at is null
     or new.reviewed_by is distinct from auth.uid()
     or not public.is_client_agreement_admin() then
    raise exception 'AGREEMENT_ADMIN_REQUIRED';
  end if;
  return new;
end;
$$;
drop trigger if exists protect_client_agreement_acceptance on public.client_agreement_acceptances;
create trigger protect_client_agreement_acceptance
  before update or delete on public.client_agreement_acceptances
  for each row execute function public.protect_client_agreement_acceptance();

create or replace function public.accept_client_agreement(
  p_version text, p_locale text, p_signer_name text, p_consent boolean
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  account_id uuid := auth.uid();
  account_email text;
  confirmed_at timestamptz;
  document public.client_agreement_versions%rowtype;
  acceptance_id uuid;
  normalized_name text := regexp_replace(p_signer_name, '^[[:space:]]+|[[:space:]]+$', '', 'g');
begin
  if account_id is null then
    raise exception 'AGREEMENT_AUTH_REQUIRED';
  end if;
  select email, email_confirmed_at into account_email, confirmed_at
    from auth.users where id = account_id;
  if not found or confirmed_at is null or nullif(btrim(account_email), '') is null then
    raise exception 'AGREEMENT_CONFIRMED_EMAIL_REQUIRED';
  end if;
  if p_consent is distinct from true then
    raise exception 'AGREEMENT_EXPLICIT_CONSENT_REQUIRED';
  end if;
  if normalized_name is null or char_length(normalized_name) not between 2 and 120
     or normalized_name ~ '[[:cntrl:]]' then
    raise exception 'AGREEMENT_SIGNER_NAME_INVALID';
  end if;
  select * into document from public.client_agreement_versions
    where version = p_version and locale = p_locale and active
    for share;
  if not found then
    raise exception 'AGREEMENT_VERSION_UNAVAILABLE';
  end if;
  -- Serializes same-account retries, including simultaneous locale changes.
  perform pg_advisory_xact_lock(hashtextextended('client-agreement:' || account_id::text || ':' || p_version, 0));
  select id into acceptance_id from public.client_agreement_acceptances
    where user_id = account_id and version = p_version;
  if found then
    return acceptance_id;
  end if;
  insert into public.client_agreement_acceptances (
    user_id, signer_name, email, version, locale, document_path,
    document_sha256, consent_text, is_draft
  ) values (
    account_id, normalized_name, account_email, document.version, document.locale,
    document.document_path, document.document_sha256, document.consent_text, document.is_draft
  ) returning id into acceptance_id;
  return acceptance_id;
end;
$$;

create or replace function public.review_client_agreement(
  p_id uuid, p_decision text, p_note text default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  actor_id uuid := auth.uid();
  actor_email text;
  acceptance public.client_agreement_acceptances%rowtype;
  normalized_note text := nullif(regexp_replace(p_note, '^[[:space:]]+|[[:space:]]+$', '', 'g'), '');
begin
  select email into actor_email from auth.users
    where id = actor_id and raw_app_meta_data ->> 'role' = 'admin';
  if not found then
    raise exception 'AGREEMENT_ADMIN_REQUIRED';
  end if;
  if p_decision is null or p_decision not in ('approved', 'rejected') then
    raise exception 'AGREEMENT_REVIEW_DECISION_INVALID';
  end if;
  if normalized_note is null or char_length(normalized_note) not between 3 and 1000 then
    raise exception 'AGREEMENT_REVIEW_NOTE_INVALID';
  end if;
  select * into acceptance from public.client_agreement_acceptances
    where id = p_id for update;
  if not found then
    raise exception 'AGREEMENT_ACCEPTANCE_NOT_FOUND';
  end if;
  if acceptance.status = p_decision then
    return acceptance.id;
  end if;
  if acceptance.status <> 'pending' then
    raise exception 'AGREEMENT_ALREADY_REVIEWED';
  end if;
  update public.client_agreement_acceptances
    set status = p_decision, reviewed_by = actor_id,
        reviewed_at = clock_timestamp(), review_note = normalized_note
    where id = acceptance.id;
  -- An audit insertion failure aborts the status update in the same transaction.
  insert into public.admin_audit_logs (
    actor_id, actor_email, action, target_type, target_id, status, details
  ) values (
    actor_id, actor_email, 'agreement.review', 'client_agreement_acceptance', acceptance.id::text,
    'success', jsonb_build_object('decision', p_decision, 'userId', acceptance.user_id,
      'version', acceptance.version, 'locale', acceptance.locale,
      'documentSha256', acceptance.document_sha256, 'isDraft', acceptance.is_draft,
      'note', normalized_note)
  );
  return acceptance.id;
end;
$$;

revoke all on table public.client_agreement_versions from public, anon, authenticated, service_role;
revoke all on table public.client_agreement_acceptances from public, anon, authenticated, service_role;
grant select on table public.client_agreement_versions, public.client_agreement_acceptances
  to authenticated, service_role;
revoke all on function public.is_client_agreement_admin() from public, anon, authenticated, service_role;
grant execute on function public.is_client_agreement_admin() to authenticated;
revoke all on function public.protect_client_agreement_version() from public, anon, authenticated, service_role;
revoke all on function public.protect_client_agreement_acceptance() from public, anon, authenticated, service_role;
revoke all on function public.accept_client_agreement(text, text, text, boolean) from public, anon, authenticated, service_role;
revoke all on function public.review_client_agreement(uuid, text, text) from public, anon, authenticated, service_role;
grant execute on function public.accept_client_agreement(text, text, text, boolean) to authenticated;
grant execute on function public.review_client_agreement(uuid, text, text) to authenticated;
notify pgrst, 'reload schema';
