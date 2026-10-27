-- Client portal features (migration 020): identity verification (KYC), withdrawals,
-- in-panel notifications, rental distributions, share sale requests and property updates.
-- Money movements reuse the immutable wallet ledger: withdrawals hold funds with an
-- 'adjustment' debit (reversed by a 'refund' credit when rejected) and distributions are
-- 'credit' entries; reference_type tells them apart. Every admin decision requires an
-- administrator with a confirmed second factor (aal2) and writes an audit row.

create or replace function public.is_verified_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(auth.jwt() ->> 'aal', '') = 'aal2' and exists (
    select 1 from auth.users where id = (select auth.uid()) and raw_app_meta_data ->> 'role' = 'admin'
  );
$$;
revoke all on function public.is_verified_admin() from public, anon, authenticated, service_role;
grant execute on function public.is_verified_admin() to authenticated;

-- Notifications ---------------------------------------------------------------
create table if not exists public.client_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in (
    'deposit_verified', 'deposit_rejected', 'withdrawal_paid', 'withdrawal_rejected',
    'kyc_approved', 'kyc_rejected', 'agreement_approved', 'agreement_rejected',
    'distribution_credited', 'property_update', 'sale_request_updated')),
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists client_notifications_user_idx on public.client_notifications(user_id, created_at desc);
alter table public.client_notifications enable row level security;
do $policy$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'client_notifications' and policyname = 'Clients read own notifications') then
    create policy "Clients read own notifications" on public.client_notifications
      for select to authenticated using (user_id = (select auth.uid()));
  end if;
end $policy$;

create or replace function public.notify_client(p_user_id uuid, p_kind text, p_payload jsonb default '{}'::jsonb)
returns void language sql security definer set search_path = '' as $$
  insert into public.client_notifications(user_id, kind, payload) values (p_user_id, p_kind, coalesce(p_payload, '{}'::jsonb));
$$;
revoke all on function public.notify_client(uuid, text, jsonb) from public, anon, authenticated, service_role;

create or replace function public.mark_notifications_read(p_ids uuid[] default null)
returns integer language plpgsql security definer set search_path = '' as $$
declare updated integer;
begin
  if auth.uid() is null then raise exception 'NOTIFICATION_AUTH_REQUIRED'; end if;
  update public.client_notifications set read_at = now()
    where user_id = auth.uid() and read_at is null and (p_ids is null or id = any(p_ids));
  get diagnostics updated = row_count;
  return updated;
end;
$$;
revoke all on function public.mark_notifications_read(uuid[]) from public, anon, authenticated, service_role;
grant execute on function public.mark_notifications_read(uuid[]) to authenticated;

create or replace function public.notify_deposit_review()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.status = 'pending' and new.status in ('verified', 'rejected') then
    perform public.notify_client(new.user_id,
      case when new.status = 'verified' then 'deposit_verified' else 'deposit_rejected' end,
      jsonb_build_object('depositId', new.id, 'amount', coalesce(new.credited_eur, new.requested_eur), 'note', new.review_note));
  end if;
  return new;
end;
$$;
revoke all on function public.notify_deposit_review() from public, anon, authenticated, service_role;
create or replace trigger notify_deposit_review after update of status on public.deposit_submissions
  for each row execute function public.notify_deposit_review();

create or replace function public.notify_agreement_review()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.status = 'pending' and new.status in ('approved', 'rejected') then
    perform public.notify_client(new.user_id,
      case when new.status = 'approved' then 'agreement_approved' else 'agreement_rejected' end,
      jsonb_build_object('acceptanceId', new.id, 'note', new.review_note));
  end if;
  return new;
end;
$$;
revoke all on function public.notify_agreement_review() from public, anon, authenticated, service_role;
create or replace trigger notify_agreement_review after update of status on public.client_agreement_acceptances
  for each row execute function public.notify_agreement_review();

-- Identity verification (KYC) -----------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('client-kyc', 'client-kyc', false, 10485760, array['application/pdf', 'image/jpeg', 'image/png'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.client_kyc_submissions (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete restrict,
  document_type text not null check (document_type in ('passport', 'id_card', 'driving_licence')),
  identity_path text not null check (identity_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}-identity\.(pdf|jpg|png)$'),
  identity_sha256 text not null check (identity_sha256 ~ '^[a-f0-9]{64}$'),
  address_path text not null check (address_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}-address\.(pdf|jpg|png)$'),
  address_sha256 text not null check (address_sha256 ~ '^[a-f0-9]{64}$'),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid references auth.users(id) on delete restrict,
  reviewed_at timestamptz,
  review_note text check (review_note is null or char_length(btrim(review_note)) between 3 and 1000),
  created_at timestamptz not null default now(),
  check ((status = 'pending' and reviewed_by is null and reviewed_at is null and review_note is null)
    or (status <> 'pending' and reviewed_by is not null and reviewed_at is not null and review_note is not null))
);
create unique index if not exists client_kyc_one_open on public.client_kyc_submissions(user_id) where status in ('pending', 'approved');
create index if not exists client_kyc_review_idx on public.client_kyc_submissions(status, created_at desc);
alter table public.client_kyc_submissions enable row level security;
do $policy$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'client_kyc_submissions' and policyname = 'Clients and verified admins read KYC') then
    create policy "Clients and verified admins read KYC" on public.client_kyc_submissions
      for select to authenticated using (user_id = (select auth.uid()) or (select public.is_verified_admin()));
  end if;
end $policy$;

create or replace function public.submit_kyc(
  p_id uuid, p_user_id uuid, p_document_type text,
  p_identity_path text, p_identity_sha256 text, p_address_path text, p_address_sha256 text
) returns uuid language plpgsql security definer set search_path = '' as $$
begin
  if p_id is null or p_user_id is null then raise exception 'KYC_INVALID'; end if;
  if not exists (select 1 from auth.users where id = p_user_id and email_confirmed_at is not null) then
    raise exception 'KYC_CONFIRMED_EMAIL_REQUIRED';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('kyc:' || p_user_id::text, 0));
  if exists (select 1 from public.client_kyc_submissions where user_id = p_user_id and status = 'approved') then
    raise exception 'KYC_ALREADY_APPROVED';
  end if;
  if exists (select 1 from public.client_kyc_submissions where user_id = p_user_id and status = 'pending') then
    raise exception 'KYC_ALREADY_PENDING';
  end if;
  if split_part(p_identity_path, '-identity.', 1) <> p_user_id::text || '/' || p_id::text
     or split_part(p_address_path, '-address.', 1) <> p_user_id::text || '/' || p_id::text then
    raise exception 'KYC_INVALID';
  end if;
  if (select count(*) from storage.objects where bucket_id = 'client-kyc' and name in (p_identity_path, p_address_path)) <> 2 then
    raise exception 'KYC_FILES_MISSING';
  end if;
  insert into public.client_kyc_submissions(id, user_id, document_type, identity_path, identity_sha256, address_path, address_sha256)
  values (p_id, p_user_id, p_document_type, p_identity_path, p_identity_sha256, p_address_path, p_address_sha256);
  return p_id;
end;
$$;
revoke all on function public.submit_kyc(uuid, uuid, text, text, text, text, text) from public, anon, authenticated, service_role;
grant execute on function public.submit_kyc(uuid, uuid, text, text, text, text, text) to service_role;

create or replace function public.review_kyc(p_id uuid, p_decision text, p_note text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare submission public.client_kyc_submissions%rowtype; actor_email text;
  clean_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if not public.is_verified_admin() then raise exception 'KYC_ADMIN_REQUIRED'; end if;
  if p_decision is null or p_decision not in ('approved', 'rejected') then raise exception 'KYC_DECISION_INVALID'; end if;
  if clean_note is null or char_length(clean_note) not between 3 and 1000 then raise exception 'KYC_NOTE_INVALID'; end if;
  select * into submission from public.client_kyc_submissions where id = p_id for update;
  if not found then raise exception 'KYC_NOT_FOUND'; end if;
  if submission.status = p_decision then return submission.id; end if;
  if submission.status <> 'pending' then raise exception 'KYC_ALREADY_REVIEWED'; end if;
  update public.client_kyc_submissions set status = p_decision, reviewed_by = auth.uid(), reviewed_at = now(), review_note = clean_note
    where id = submission.id;
  select email into actor_email from auth.users where id = auth.uid();
  insert into public.admin_audit_logs(actor_id, actor_email, action, target_type, target_id, status, details)
  values (auth.uid(), actor_email, 'kyc.review', 'client_kyc_submission', submission.id::text, 'success',
    jsonb_build_object('decision', p_decision, 'userId', submission.user_id, 'documentType', submission.document_type, 'note', clean_note));
  perform public.notify_client(submission.user_id, case when p_decision = 'approved' then 'kyc_approved' else 'kyc_rejected' end,
    jsonb_build_object('submissionId', submission.id, 'note', clean_note));
  return submission.id;
end;
$$;
revoke all on function public.review_kyc(uuid, text, text) from public, anon, authenticated, service_role;
grant execute on function public.review_kyc(uuid, text, text) to authenticated;

-- Withdrawals ---------------------------------------------------------------------
create table if not exists public.withdrawal_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  client_key uuid not null,
  amount numeric not null check (amount >= 10 and amount <= 1000000 and amount = round(amount, 2)),
  currency text not null default 'EUR' check (currency = 'EUR'),
  account_holder text not null check (char_length(btrim(account_holder)) between 2 and 140 and account_holder !~ '[[:cntrl:]]'),
  iban text not null check (iban ~ '^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$'),
  bic text check (bic is null or bic ~ '^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$'),
  status text not null default 'pending' check (status in ('pending', 'paid', 'rejected')),
  hold_transaction_id uuid not null references public.wallet_transactions(id),
  reversal_transaction_id uuid references public.wallet_transactions(id),
  payout_reference text check (payout_reference is null or char_length(btrim(payout_reference)) between 4 and 200),
  review_note text check (review_note is null or char_length(btrim(review_note)) between 3 and 1000),
  reviewed_by uuid references auth.users(id) on delete restrict,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, client_key),
  check ((status = 'pending' and reviewed_by is null and reviewed_at is null and payout_reference is null and reversal_transaction_id is null)
    or (status = 'paid' and reviewed_by is not null and reviewed_at is not null and payout_reference is not null and review_note is not null and reversal_transaction_id is null)
    or (status = 'rejected' and reviewed_by is not null and reviewed_at is not null and review_note is not null and reversal_transaction_id is not null))
);
create index if not exists withdrawal_requests_review_idx on public.withdrawal_requests(status, created_at desc);
alter table public.withdrawal_requests enable row level security;
do $policy$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'withdrawal_requests' and policyname = 'Clients and verified admins read withdrawals') then
    create policy "Clients and verified admins read withdrawals" on public.withdrawal_requests
      for select to authenticated using (user_id = (select auth.uid()) or (select public.is_verified_admin()));
  end if;
end $policy$;

create or replace function public.request_withdrawal(
  p_amount numeric, p_account_holder text, p_iban text, p_bic text, p_client_key uuid
) returns uuid language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); existing public.withdrawal_requests%rowtype; current_balance numeric; tx uuid;
  request_id uuid := gen_random_uuid();
  norm_iban text := upper(regexp_replace(coalesce(p_iban, ''), '[[:space:]]', '', 'g'));
  norm_bic text := nullif(upper(regexp_replace(coalesce(p_bic, ''), '[[:space:]]', '', 'g')), '');
  holder text := btrim(coalesce(p_account_holder, ''));
begin
  if uid is null then raise exception 'WITHDRAWAL_AUTH_REQUIRED'; end if;
  if p_client_key is null then raise exception 'WITHDRAWAL_INVALID'; end if;
  perform pg_advisory_xact_lock(hashtextextended('withdrawal:' || uid::text, 0));
  select * into existing from public.withdrawal_requests where user_id = uid and client_key = p_client_key;
  if found then return existing.id; end if;
  if not exists (select 1 from public.client_kyc_submissions where user_id = uid and status = 'approved') then
    raise exception 'WITHDRAWAL_KYC_REQUIRED';
  end if;
  if p_amount is null or p_amount < 10 or p_amount > 1000000 or p_amount <> round(p_amount, 2) then
    raise exception 'WITHDRAWAL_AMOUNT_INVALID';
  end if;
  if norm_iban !~ '^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$' then raise exception 'WITHDRAWAL_IBAN_INVALID'; end if;
  if norm_bic is not null and norm_bic !~ '^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$' then raise exception 'WITHDRAWAL_BIC_INVALID'; end if;
  if char_length(holder) not between 2 and 140 or holder ~ '[[:cntrl:]]' then raise exception 'WITHDRAWAL_HOLDER_INVALID'; end if;
  select w.balance into current_balance from public.wallet_accounts w where w.user_id = uid for update;
  if not found or current_balance < p_amount then raise exception 'WITHDRAWAL_INSUFFICIENT_FUNDS'; end if;
  insert into public.wallet_transactions(user_id, type, direction, amount, currency, reference_type, reference_id, idempotency_key, created_by, metadata)
  values (uid, 'adjustment', 'debit', p_amount, 'EUR', 'withdrawal', request_id::text, 'withdrawal:' || request_id::text, uid,
    jsonb_build_object('ibanLast4', right(norm_iban, 4)))
  returning id into tx;
  update public.wallet_accounts set balance = balance - p_amount, updated_at = now() where user_id = uid;
  insert into public.withdrawal_requests(id, user_id, client_key, amount, account_holder, iban, bic, hold_transaction_id)
  values (request_id, uid, p_client_key, p_amount, holder, norm_iban, norm_bic, tx);
  return request_id;
end;
$$;
revoke all on function public.request_withdrawal(numeric, text, text, text, uuid) from public, anon, authenticated, service_role;
grant execute on function public.request_withdrawal(numeric, text, text, text, uuid) to authenticated;

create or replace function public.review_withdrawal(p_id uuid, p_paid boolean, p_reference text, p_note text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare request public.withdrawal_requests%rowtype; actor_email text; tx uuid;
  clean_note text := nullif(btrim(coalesce(p_note, '')), '');
  reference text := nullif(btrim(coalesce(p_reference, '')), '');
begin
  if not public.is_verified_admin() then raise exception 'WITHDRAWAL_ADMIN_REQUIRED'; end if;
  if p_paid is null then raise exception 'WITHDRAWAL_DECISION_INVALID'; end if;
  if clean_note is null or char_length(clean_note) not between 3 and 1000 then raise exception 'WITHDRAWAL_NOTE_INVALID'; end if;
  select * into request from public.withdrawal_requests where id = p_id for update;
  if not found then raise exception 'WITHDRAWAL_NOT_FOUND'; end if;
  if request.status <> 'pending' then
    if (request.status = 'paid') = p_paid then return request.id; end if;
    raise exception 'WITHDRAWAL_ALREADY_REVIEWED';
  end if;
  if p_paid then
    if reference is null or char_length(reference) not between 4 and 200 then raise exception 'WITHDRAWAL_REFERENCE_INVALID'; end if;
    update public.withdrawal_requests set status = 'paid', payout_reference = reference, review_note = clean_note,
      reviewed_by = auth.uid(), reviewed_at = now() where id = request.id;
  else
    perform 1 from public.wallet_accounts where user_id = request.user_id for update;
    insert into public.wallet_transactions(user_id, type, direction, amount, currency, reference_type, reference_id, idempotency_key, created_by, metadata)
    values (request.user_id, 'refund', 'credit', request.amount, 'EUR', 'withdrawal_reversal', request.id::text,
      'withdrawal-reversal:' || request.id::text, auth.uid(), jsonb_build_object('withdrawalId', request.id))
    returning id into tx;
    update public.wallet_accounts set balance = balance + request.amount, updated_at = now() where user_id = request.user_id;
    update public.withdrawal_requests set status = 'rejected', reversal_transaction_id = tx, review_note = clean_note,
      reviewed_by = auth.uid(), reviewed_at = now() where id = request.id;
  end if;
  select email into actor_email from auth.users where id = auth.uid();
  insert into public.admin_audit_logs(actor_id, actor_email, action, target_type, target_id, status, details)
  values (auth.uid(), actor_email, 'withdrawal.review', 'withdrawal_request', request.id::text, 'success',
    jsonb_build_object('decision', case when p_paid then 'paid' else 'rejected' end, 'userId', request.user_id,
      'amount', request.amount, 'payoutReference', reference, 'reversalTransactionId', tx, 'note', clean_note));
  perform public.notify_client(request.user_id, case when p_paid then 'withdrawal_paid' else 'withdrawal_rejected' end,
    jsonb_build_object('withdrawalId', request.id, 'amount', request.amount, 'note', clean_note));
  return request.id;
end;
$$;
revoke all on function public.review_withdrawal(uuid, boolean, text, text) from public, anon, authenticated, service_role;
grant execute on function public.review_withdrawal(uuid, boolean, text, text) to authenticated;

-- Rental distributions ------------------------------------------------------------
create table if not exists public.property_distributions (
  id uuid primary key default gen_random_uuid(),
  property_slug text not null check (property_slug ~ '^[a-z0-9-]{1,120}$'),
  period_start date not null,
  period_end date not null,
  net_amount numeric not null check (net_amount > 0 and net_amount <= 100000000 and net_amount = round(net_amount, 2)),
  total_shares integer not null check (total_shares > 0),
  distributed_amount numeric not null default 0 check (distributed_amount >= 0),
  holder_count integer not null default 0 check (holder_count >= 0),
  note text check (note is null or char_length(note) <= 1000),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  check (period_end >= period_start),
  unique (property_slug, period_start, period_end)
);
create table if not exists public.distribution_payouts (
  distribution_id uuid not null references public.property_distributions(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete restrict,
  shares integer not null check (shares > 0),
  amount numeric not null check (amount > 0),
  transaction_id uuid not null references public.wallet_transactions(id),
  primary key (distribution_id, user_id)
);
alter table public.property_distributions enable row level security;
alter table public.distribution_payouts enable row level security;
do $policy$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'property_distributions' and policyname = 'Recipients and verified admins read distributions') then
    create policy "Recipients and verified admins read distributions" on public.property_distributions
      for select to authenticated using ((select public.is_verified_admin()) or exists (
    select 1 from public.distribution_payouts p where p.distribution_id = property_distributions.id and p.user_id = (select auth.uid())));
  end if;
end $policy$;
do $policy$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'distribution_payouts' and policyname = 'Recipients and verified admins read payouts') then
    create policy "Recipients and verified admins read payouts" on public.distribution_payouts
      for select to authenticated using (user_id = (select auth.uid()) or (select public.is_verified_admin()));
  end if;
end $policy$;

create or replace function public.record_property_distribution(
  p_property_slug text, p_period_start date, p_period_end date, p_net_amount numeric, p_note text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare distribution_id uuid := gen_random_uuid(); share_total integer; holder record; payout numeric;
  paid numeric := 0; recipients integer := 0; tx uuid; actor_email text;
  clean_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if not public.is_verified_admin() then raise exception 'DISTRIBUTION_ADMIN_REQUIRED'; end if;
  if p_period_start is null or p_period_end is null or p_period_end < p_period_start or p_period_end > current_date then
    raise exception 'DISTRIBUTION_PERIOD_INVALID';
  end if;
  if p_net_amount is null or p_net_amount <= 0 or p_net_amount > 100000000 or p_net_amount <> round(p_net_amount, 2) then
    raise exception 'DISTRIBUTION_AMOUNT_INVALID';
  end if;
  if clean_note is not null and char_length(clean_note) > 1000 then raise exception 'DISTRIBUTION_NOTE_INVALID'; end if;
  perform pg_advisory_xact_lock(hashtextextended('distribution:' || coalesce(p_property_slug, ''), 0));
  select s.total_shares into share_total from public.property_share_settings s where s.property_slug = p_property_slug;
  if not found or share_total is null or share_total <= 0 then raise exception 'DISTRIBUTION_PROPERTY_UNKNOWN'; end if;
  insert into public.property_distributions(id, property_slug, period_start, period_end, net_amount, total_shares, note, created_by)
  values (distribution_id, p_property_slug, p_period_start, p_period_end, p_net_amount, share_total, clean_note, auth.uid());
  -- Each holder receives their share of the net amount, rounded down to the cent;
  -- the remainder belongs to unsold shares.
  for holder in select h.user_id, h.shares from public.property_holdings h
      where h.property_slug = p_property_slug and h.shares > 0 order by h.user_id for update loop
    payout := floor(p_net_amount * holder.shares / share_total * 100) / 100;
    continue when payout <= 0;
    insert into public.wallet_accounts(user_id, currency, balance) values (holder.user_id, 'EUR', 0) on conflict (user_id) do nothing;
    perform 1 from public.wallet_accounts where user_id = holder.user_id for update;
    insert into public.wallet_transactions(user_id, type, direction, amount, currency, property_slug, shares, reference_type, reference_id, idempotency_key, created_by, metadata)
    values (holder.user_id, 'credit', 'credit', payout, 'EUR', p_property_slug, holder.shares, 'distribution', distribution_id::text,
      'distribution:' || distribution_id::text || ':' || holder.user_id::text, auth.uid(),
      jsonb_build_object('periodStart', p_period_start, 'periodEnd', p_period_end))
    returning id into tx;
    update public.wallet_accounts set balance = balance + payout, updated_at = now() where user_id = holder.user_id;
    insert into public.distribution_payouts(distribution_id, user_id, shares, amount, transaction_id)
    values (distribution_id, holder.user_id, holder.shares, payout, tx);
    perform public.notify_client(holder.user_id, 'distribution_credited', jsonb_build_object('distributionId', distribution_id,
      'propertySlug', p_property_slug, 'amount', payout, 'periodStart', p_period_start, 'periodEnd', p_period_end));
    paid := paid + payout;
    recipients := recipients + 1;
  end loop;
  update public.property_distributions set distributed_amount = paid, holder_count = recipients where id = distribution_id;
  select email into actor_email from auth.users where id = auth.uid();
  insert into public.admin_audit_logs(actor_id, actor_email, action, target_type, target_id, status, details)
  values (auth.uid(), actor_email, 'distribution.record', 'property', p_property_slug, 'success',
    jsonb_build_object('distributionId', distribution_id, 'periodStart', p_period_start, 'periodEnd', p_period_end,
      'netAmount', p_net_amount, 'distributed', paid, 'recipients', recipients, 'totalShares', share_total));
  return distribution_id;
end;
$$;
revoke all on function public.record_property_distribution(text, date, date, numeric, text) from public, anon, authenticated, service_role;
grant execute on function public.record_property_distribution(text, date, date, numeric, text) to authenticated;

-- Share sale (exit) requests -------------------------------------------------------
create table if not exists public.share_sale_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  client_key uuid not null,
  property_slug text not null,
  shares integer not null check (shares > 0),
  note text check (note is null or char_length(note) <= 1000),
  status text not null default 'pending' check (status in ('pending', 'in_review', 'completed', 'cancelled')),
  admin_note text check (admin_note is null or char_length(btrim(admin_note)) between 3 and 1000),
  updated_by uuid references auth.users(id) on delete restrict,
  updated_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, client_key)
);
create index if not exists share_sale_requests_review_idx on public.share_sale_requests(status, created_at desc);
alter table public.share_sale_requests enable row level security;
do $policy$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'share_sale_requests' and policyname = 'Clients and verified admins read sale requests') then
    create policy "Clients and verified admins read sale requests" on public.share_sale_requests
      for select to authenticated using (user_id = (select auth.uid()) or (select public.is_verified_admin()));
  end if;
end $policy$;

create or replace function public.request_share_sale(p_property_slug text, p_shares integer, p_note text, p_client_key uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); existing uuid; held integer; open_shares integer; request_id uuid;
  clean_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if uid is null then raise exception 'SALE_AUTH_REQUIRED'; end if;
  if p_client_key is null or p_shares is null or p_shares <= 0 then raise exception 'SALE_INVALID'; end if;
  if clean_note is not null and (char_length(clean_note) > 1000 or clean_note ~ '[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]') then raise exception 'SALE_NOTE_INVALID'; end if;
  perform pg_advisory_xact_lock(hashtextextended('share-sale:' || uid::text, 0));
  select id into existing from public.share_sale_requests where user_id = uid and client_key = p_client_key;
  if found then return existing; end if;
  select shares into held from public.property_holdings where user_id = uid and property_slug = p_property_slug;
  if not found then raise exception 'SALE_NO_HOLDING'; end if;
  select coalesce(sum(shares), 0) into open_shares from public.share_sale_requests
    where user_id = uid and property_slug = p_property_slug and status in ('pending', 'in_review');
  if p_shares + open_shares > held then raise exception 'SALE_TOO_MANY_SHARES'; end if;
  insert into public.share_sale_requests(user_id, client_key, property_slug, shares, note)
  values (uid, p_client_key, p_property_slug, p_shares, clean_note) returning id into request_id;
  return request_id;
end;
$$;
revoke all on function public.request_share_sale(text, integer, text, uuid) from public, anon, authenticated, service_role;
grant execute on function public.request_share_sale(text, integer, text, uuid) to authenticated;

create or replace function public.update_share_sale_request(p_id uuid, p_status text, p_note text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare request public.share_sale_requests%rowtype; actor_email text;
  clean_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if not public.is_verified_admin() then raise exception 'SALE_ADMIN_REQUIRED'; end if;
  if p_status is null or p_status not in ('in_review', 'completed', 'cancelled') then raise exception 'SALE_STATUS_INVALID'; end if;
  if clean_note is null or char_length(clean_note) not between 3 and 1000 then raise exception 'SALE_NOTE_INVALID'; end if;
  select * into request from public.share_sale_requests where id = p_id for update;
  if not found then raise exception 'SALE_NOT_FOUND'; end if;
  if request.status = p_status then return request.id; end if;
  if request.status in ('completed', 'cancelled') or (request.status = 'in_review' and p_status = 'in_review') then
    raise exception 'SALE_ALREADY_CLOSED';
  end if;
  update public.share_sale_requests set status = p_status, admin_note = clean_note, updated_by = auth.uid(), updated_at = now()
    where id = request.id;
  select email into actor_email from auth.users where id = auth.uid();
  insert into public.admin_audit_logs(actor_id, actor_email, action, target_type, target_id, status, details)
  values (auth.uid(), actor_email, 'share_sale.update', 'share_sale_request', request.id::text, 'success',
    jsonb_build_object('status', p_status, 'userId', request.user_id, 'propertySlug', request.property_slug, 'shares', request.shares, 'note', clean_note));
  perform public.notify_client(request.user_id, 'sale_request_updated', jsonb_build_object('requestId', request.id,
    'propertySlug', request.property_slug, 'shares', request.shares, 'status', p_status, 'note', clean_note));
  return request.id;
end;
$$;
revoke all on function public.update_share_sale_request(uuid, text, text) from public, anon, authenticated, service_role;
grant execute on function public.update_share_sale_request(uuid, text, text) to authenticated;

-- Property updates for holders -------------------------------------------------------
create table if not exists public.property_updates (
  id uuid primary key default gen_random_uuid(),
  property_slug text not null check (property_slug ~ '^[a-z0-9-]{1,120}$'),
  title text not null check (char_length(btrim(title)) between 3 and 160),
  body text not null check (char_length(btrim(body)) between 3 and 5000),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);
create index if not exists property_updates_property_idx on public.property_updates(property_slug, created_at desc);
alter table public.property_updates enable row level security;
do $policy$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'property_updates' and policyname = 'Holders and verified admins read property updates') then
    create policy "Holders and verified admins read property updates" on public.property_updates
      for select to authenticated using ((select public.is_verified_admin()) or exists (
    select 1 from public.property_holdings h where h.user_id = (select auth.uid()) and h.property_slug = property_updates.property_slug));
  end if;
end $policy$;

create or replace function public.publish_property_update(p_property_slug text, p_title text, p_body text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare update_id uuid; holder record; actor_email text; recipients integer := 0;
begin
  if not public.is_verified_admin() then raise exception 'UPDATE_ADMIN_REQUIRED'; end if;
  insert into public.property_updates(property_slug, title, body, created_by)
  values (p_property_slug, btrim(p_title), btrim(p_body), auth.uid()) returning id into update_id;
  for holder in select h.user_id from public.property_holdings h where h.property_slug = p_property_slug and h.shares > 0 loop
    perform public.notify_client(holder.user_id, 'property_update', jsonb_build_object('updateId', update_id,
      'propertySlug', p_property_slug, 'title', btrim(p_title)));
    recipients := recipients + 1;
  end loop;
  select email into actor_email from auth.users where id = auth.uid();
  insert into public.admin_audit_logs(actor_id, actor_email, action, target_type, target_id, status, details)
  values (auth.uid(), actor_email, 'property_update.publish', 'property', p_property_slug, 'success',
    jsonb_build_object('updateId', update_id, 'title', btrim(p_title), 'recipients', recipients));
  return update_id;
end;
$$;
revoke all on function public.publish_property_update(text, text, text) from public, anon, authenticated, service_role;
grant execute on function public.publish_property_update(text, text, text) to authenticated;

-- Direct table access: read through RLS only; all writes go through the functions above.
revoke all on table public.client_notifications, public.client_kyc_submissions, public.withdrawal_requests,
  public.property_distributions, public.distribution_payouts, public.share_sale_requests, public.property_updates
  from public, anon, authenticated, service_role;
grant select on table public.client_notifications, public.client_kyc_submissions, public.withdrawal_requests,
  public.property_distributions, public.distribution_payouts, public.share_sale_requests, public.property_updates
  to authenticated, service_role;

notify pgrst, 'reload schema';
