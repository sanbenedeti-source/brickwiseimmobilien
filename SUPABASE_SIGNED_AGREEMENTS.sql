-- Drawn electronic signatures for client agreements (migration 019).
-- The server builds a signed PDF (archived original + evidence page), stores it in a
-- private bucket and records it here through sign_client_agreement, which only the
-- service role may execute. Versions that require a drawn signature can no longer be
-- accepted through the older name-only accept_client_agreement RPC.

alter table public.client_agreement_versions
  add column if not exists requires_signature boolean not null default false;

alter table public.client_agreement_acceptances
  add column if not exists signature_sha256 text,
  add column if not exists signed_pdf_path text,
  add column if not exists signed_pdf_sha256 text,
  add column if not exists signer_ip text,
  add column if not exists signer_user_agent text;

do $constraints$ begin
  if not exists (select 1 from pg_constraint where conname = 'client_agreement_signature_evidence') then
    alter table public.client_agreement_acceptances add constraint client_agreement_signature_evidence check (
      (signed_pdf_path is null and signed_pdf_sha256 is null and signature_sha256 is null)
      or (signed_pdf_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.pdf$'
        and signed_pdf_sha256 ~ '^[a-f0-9]{64}$' and signature_sha256 ~ '^[a-f0-9]{64}$')
    );
  end if;
  if not exists (select 1 from pg_constraint where conname = 'client_agreement_signer_evidence_length') then
    alter table public.client_agreement_acceptances add constraint client_agreement_signer_evidence_length check (
      (signer_ip is null or char_length(signer_ip) <= 64)
      and (signer_user_agent is null or char_length(signer_user_agent) <= 400)
    );
  end if;
end $constraints$;

-- Private bucket: no storage policies, so clients cannot list, read or write it directly.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('client-agreements', 'client-agreements', false, 10485760, array['application/pdf'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

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
  if document.requires_signature then
    raise exception 'AGREEMENT_SIGNATURE_REQUIRED';
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

create or replace function public.sign_client_agreement(
  p_id uuid, p_user_id uuid, p_version text, p_locale text, p_signer_name text, p_consent boolean,
  p_signed_at timestamptz, p_signature_sha256 text, p_signed_pdf_sha256 text,
  p_signer_ip text, p_user_agent text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  account_email text;
  confirmed_at timestamptz;
  document public.client_agreement_versions%rowtype;
  acceptance_id uuid;
  normalized_name text := regexp_replace(p_signer_name, '^[[:space:]]+|[[:space:]]+$', '', 'g');
  object_path text := p_user_id::text || '/' || p_id::text || '.pdf';
begin
  if p_id is null or p_user_id is null then
    raise exception 'AGREEMENT_SIGNATURE_INVALID';
  end if;
  select email, email_confirmed_at into account_email, confirmed_at
    from auth.users where id = p_user_id;
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
  if p_signature_sha256 is null or p_signature_sha256 !~ '^[a-f0-9]{64}$'
     or p_signed_pdf_sha256 is null or p_signed_pdf_sha256 !~ '^[a-f0-9]{64}$' then
    raise exception 'AGREEMENT_SIGNATURE_INVALID';
  end if;
  if p_signed_at is null or p_signed_at < clock_timestamp() - interval '10 minutes'
     or p_signed_at > clock_timestamp() + interval '1 minute' then
    raise exception 'AGREEMENT_SIGNATURE_TIME_INVALID';
  end if;
  select * into document from public.client_agreement_versions
    where version = p_version and locale = p_locale and active
    for share;
  if not found then
    raise exception 'AGREEMENT_VERSION_UNAVAILABLE';
  end if;
  if not document.requires_signature then
    raise exception 'AGREEMENT_SIGNATURE_NOT_EXPECTED';
  end if;
  if not exists (select 1 from storage.objects where bucket_id = 'client-agreements' and name = object_path) then
    raise exception 'AGREEMENT_SIGNED_PDF_MISSING';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('client-agreement:' || p_user_id::text || ':' || p_version, 0));
  select id into acceptance_id from public.client_agreement_acceptances
    where user_id = p_user_id and version = p_version;
  if found then
    return acceptance_id;
  end if;
  insert into public.client_agreement_acceptances (
    id, user_id, signer_name, email, version, locale, document_path, document_sha256,
    consent_text, is_draft, accepted_at, signature_sha256, signed_pdf_path, signed_pdf_sha256,
    signer_ip, signer_user_agent
  ) values (
    p_id, p_user_id, normalized_name, account_email, document.version, document.locale,
    document.document_path, document.document_sha256, document.consent_text, document.is_draft,
    p_signed_at, p_signature_sha256, object_path, p_signed_pdf_sha256,
    nullif(left(btrim(coalesce(p_signer_ip, '')), 64), ''), nullif(left(coalesce(p_user_agent, ''), 400), '')
  ) returning id into acceptance_id;
  return acceptance_id;
end;
$$;

revoke all on function public.accept_client_agreement(text, text, text, boolean) from public, anon, authenticated, service_role;
grant execute on function public.accept_client_agreement(text, text, text, boolean) to authenticated;
revoke all on function public.sign_client_agreement(uuid, uuid, text, text, text, boolean, timestamptz, text, text, text, text) from public, anon, authenticated, service_role;
grant execute on function public.sign_client_agreement(uuid, uuid, text, text, text, boolean, timestamptz, text, text, text, text) to service_role;

-- Catalog for cooperation-2026-10-24-v3; archived PDF checksums come from app/lib/agreement-manifest.json.
insert into public.client_agreement_versions
  (version, locale, document_path, document_sha256, consent_text, is_draft, active, requires_signature)
values
  ('cooperation-2026-10-24-v3', 'en', '/documents/agreements/cooperation-2026-10-24-v3/en.pdf', '0b2ab0c1f25b250bb3df96f008c3d807d761aedc93b59eb861381b0dbd95bc50', 'I have read the Client Cooperation Agreement in full. By drawing my signature and clicking “Sign agreement”, I accept its terms and sign it electronically with the name shown. A signed PDF copy will be stored in my client account.', true, true, true),
  ('cooperation-2026-10-24-v3', 'de', '/documents/agreements/cooperation-2026-10-24-v3/de.pdf', '27bfb81df6c0d3788f476052a6c0d63d32971b2cda85d0295ac63e09856163e5', 'Ich habe den Kundenkooperationsvertrag vollständig gelesen. Indem ich meine Unterschrift zeichne und auf „Vertrag unterschreiben“ klicke, akzeptiere ich seine Bedingungen und unterzeichne ihn elektronisch mit dem angezeigten Namen. Eine unterzeichnete PDF-Kopie wird in meinem Kundenkonto gespeichert.', true, true, true),
  ('cooperation-2026-10-24-v3', 'fr', '/documents/agreements/cooperation-2026-10-24-v3/fr.pdf', '1087977efbe515aed3f20864cab8ee0b4129772e2d2c1e07d3129848e1c466ea', 'J’ai lu l’intégralité du contrat de coopération client. En traçant ma signature et en cliquant sur « Signer le contrat », j’accepte ses conditions et je le signe électroniquement sous le nom affiché. Une copie PDF signée sera conservée dans mon compte client.', true, true, true),
  ('cooperation-2026-10-24-v3', 'es', '/documents/agreements/cooperation-2026-10-24-v3/es.pdf', '576127995457b00346728547faf5fdccc22d0a4ae08ab9b6eb8a82513b0e1ca8', 'He leído íntegramente el contrato de cooperación con el cliente. Al trazar mi firma y pulsar «Firmar contrato», acepto sus condiciones y lo firmo electrónicamente con el nombre indicado. Se guardará una copia en PDF firmada en mi cuenta de cliente.', true, true, true),
  ('cooperation-2026-10-24-v3', 'it', '/documents/agreements/cooperation-2026-10-24-v3/it.pdf', 'd268fd50ba9d4138a3cb5c0b1b229449b0700e1a171fa447da9b9f9b07360f21', 'Ho letto integralmente il contratto di cooperazione con il cliente. Tracciando la mia firma e cliccando su «Firma il contratto», ne accetto le condizioni e lo firmo elettronicamente con il nome indicato. Una copia PDF firmata sarà conservata nel mio account cliente.', true, true, true)
on conflict (version, locale) do nothing;

notify pgrst, 'reload schema';
