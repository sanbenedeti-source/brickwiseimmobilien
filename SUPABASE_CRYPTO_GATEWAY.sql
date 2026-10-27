-- Migration 021: automatic crypto deposits through CoinGate (2026-10-24).
-- A client chooses an EUR amount, pays on CoinGate's checkout page, and the wallet is credited
-- once CoinGate reports the order as paid. Every write runs server-side with the service role;
-- the paid status is always re-read from the CoinGate API before a credit.

create table if not exists public.gateway_deposits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  provider text not null default 'coingate' check (provider = 'coingate'),
  client_key uuid not null,
  amount_eur numeric(14,2) not null check (amount_eur >= 10 and amount_eur <= 1000000),
  status text not null default 'created'
    check (status in ('created', 'awaiting_payment', 'confirming', 'paid', 'review', 'failed', 'expired', 'canceled', 'refunded')),
  provider_order_id bigint unique,
  provider_status text check (provider_status is null or provider_status ~ '^[a-z_]{2,40}$'),
  payment_url text check (payment_url is null or payment_url ~ '^https://[a-z0-9.-]*coingate\.com/'),
  callback_token_hash text not null check (callback_token_hash ~ '^[0-9a-f]{64}$'),
  pay_currency text check (pay_currency is null or char_length(pay_currency) <= 20),
  pay_amount numeric check (pay_amount is null or pay_amount >= 0),
  receive_currency text check (receive_currency is null or char_length(receive_currency) <= 20),
  receive_amount numeric check (receive_amount is null or receive_amount >= 0),
  transaction_id uuid references public.wallet_transactions(id),
  review_note text check (review_note is null or char_length(review_note) <= 1000),
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, client_key),
  check (status <> 'paid' or transaction_id is not null)
);
create index if not exists gateway_deposits_user_idx on public.gateway_deposits(user_id, created_at desc);
create index if not exists gateway_deposits_status_idx on public.gateway_deposits(status, created_at desc);
alter table public.gateway_deposits enable row level security;
do $policy$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'gateway_deposits' and policyname = 'Clients and verified admins read gateway deposits') then
    create policy "Clients and verified admins read gateway deposits" on public.gateway_deposits
      for select to authenticated using (user_id = (select auth.uid()) or (select public.is_verified_admin()));
  end if;
end $policy$;
revoke all on table public.gateway_deposits from public, anon, authenticated, service_role;
grant select on table public.gateway_deposits to authenticated, service_role;

-- Opens a checkout for one client request. The same client key returns the same deposit.
create or replace function public.create_gateway_deposit(p_user_id uuid, p_amount numeric, p_client_key uuid, p_token_hash text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare existing uuid; deposit_id uuid;
begin
  if p_user_id is null or p_client_key is null or p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then raise exception 'GATEWAY_INVALID'; end if;
  if p_amount is null or p_amount < 10 or p_amount > 1000000 or p_amount <> round(p_amount, 2) then raise exception 'GATEWAY_AMOUNT_INVALID'; end if;
  if not exists (select 1 from auth.users where id = p_user_id and email_confirmed_at is not null
      and coalesce(raw_app_meta_data->>'role', '') <> 'admin') then raise exception 'GATEWAY_USER_INVALID'; end if;
  perform pg_advisory_xact_lock(hashtextextended('gateway-deposit:' || p_user_id::text, 0));
  select id into existing from public.gateway_deposits where user_id = p_user_id and client_key = p_client_key;
  if found then return existing; end if;
  if (select count(*) from public.gateway_deposits where user_id = p_user_id and created_at > now() - interval '1 hour') >= 10 then
    raise exception 'GATEWAY_TOO_MANY';
  end if;
  insert into public.gateway_deposits(user_id, client_key, amount_eur, callback_token_hash)
  values (p_user_id, p_client_key, p_amount, p_token_hash) returning id into deposit_id;
  return deposit_id;
end;
$$;

create or replace function public.attach_gateway_order(p_id uuid, p_order_id bigint, p_payment_url text)
returns void language plpgsql security definer set search_path = '' as $$
declare deposit public.gateway_deposits%rowtype;
begin
  select * into deposit from public.gateway_deposits where id = p_id for update;
  if not found then raise exception 'GATEWAY_NOT_FOUND'; end if;
  if deposit.provider_order_id is not null and deposit.provider_order_id <> p_order_id then raise exception 'GATEWAY_ORDER_MISMATCH'; end if;
  update public.gateway_deposits set provider_order_id = p_order_id, payment_url = p_payment_url,
    status = case when status = 'created' then 'awaiting_payment' else status end, updated_at = now()
  where id = p_id;
end;
$$;

-- Applies the order state read from the CoinGate API. Credits the wallet exactly once.
create or replace function public.settle_gateway_deposit(
  p_id uuid, p_order_id bigint, p_status text, p_price_amount numeric, p_price_currency text,
  p_pay_currency text, p_pay_amount numeric, p_receive_currency text, p_receive_amount numeric,
  p_underpaid numeric, p_paid_at timestamptz
) returns text language plpgsql security definer set search_path = '' as $$
declare deposit public.gateway_deposits%rowtype; tx uuid; customer_email text; customer_name text; next_status text;
begin
  if p_status is null or p_status !~ '^[a-z_]{2,40}$' then raise exception 'GATEWAY_STATUS_INVALID'; end if;
  select * into deposit from public.gateway_deposits where id = p_id for update;
  if not found then raise exception 'GATEWAY_NOT_FOUND'; end if;
  if deposit.provider_order_id is distinct from p_order_id then raise exception 'GATEWAY_ORDER_MISMATCH'; end if;

  update public.gateway_deposits set provider_status = p_status, pay_currency = coalesce(left(p_pay_currency, 20), pay_currency),
    pay_amount = coalesce(p_pay_amount, pay_amount), receive_currency = coalesce(left(p_receive_currency, 20), receive_currency),
    receive_amount = coalesce(p_receive_amount, receive_amount), updated_at = now()
  where id = deposit.id;

  -- A credited deposit never changes again automatically; a later refund needs a person.
  if deposit.status = 'paid' then
    if p_status in ('refunded', 'partially_refunded') then
      update public.gateway_deposits set status = 'review', review_note = 'CoinGate reported a refund after the wallet was credited.' where id = deposit.id;
      return 'review';
    end if;
    return 'paid';
  end if;
  if deposit.status = 'review' then return 'review'; end if;

  if p_status = 'paid' then
    if p_price_currency is distinct from 'EUR' or p_price_amount is distinct from deposit.amount_eur or coalesce(p_underpaid, 0) > 0 then
      update public.gateway_deposits set status = 'review', paid_at = p_paid_at,
        review_note = 'Paid amount or currency differs from the order; check before crediting.' where id = deposit.id;
      return 'review';
    end if;
    select email, raw_user_meta_data->>'full_name' into customer_email, customer_name from auth.users where id = deposit.user_id;
    insert into public.wallet_accounts(user_id, currency, balance) values (deposit.user_id, 'EUR', 0) on conflict (user_id) do nothing;
    perform 1 from public.wallet_accounts where user_id = deposit.user_id for update;
    insert into public.wallet_transactions(user_id, type, direction, amount, currency, reference_type, reference_id, idempotency_key, created_by, metadata)
    values (deposit.user_id, 'credit', 'credit', deposit.amount_eur, 'EUR', 'gateway_deposit', deposit.id::text,
      'deposit:coingate:' || p_order_id::text, null,
      jsonb_build_object('provider', 'coingate', 'orderId', p_order_id, 'payCurrency', p_pay_currency, 'payAmount', p_pay_amount))
    returning id into tx;
    update public.wallet_accounts set balance = balance + deposit.amount_eur, updated_at = now() where user_id = deposit.user_id;
    insert into public.payment_requests(user_id, customer_name, customer_email, title, amount, currency, method, status, instructions, admin_note, verified_at, credit_transaction_id)
    values (deposit.user_id, nullif(customer_name, ''), lower(customer_email), '[Wallet credit] Crypto deposit', deposit.amount_eur, 'EUR', 'wallet_credit', 'verified',
      'Crypto payment confirmed by CoinGate and credited automatically.', 'CoinGate order ' || p_order_id::text, now(), tx);
    update public.gateway_deposits set status = 'paid', transaction_id = tx, paid_at = coalesce(p_paid_at, now()) where id = deposit.id;
    perform public.notify_client(deposit.user_id, 'deposit_verified', jsonb_build_object('depositId', deposit.id, 'amount', deposit.amount_eur));
    insert into public.admin_audit_logs(actor_id, actor_email, action, target_type, target_id, status, details)
    values (null, 'coingate', 'deposit.gateway_credit', 'user', deposit.user_id::text, 'success',
      jsonb_build_object('depositId', deposit.id, 'orderId', p_order_id, 'amount', deposit.amount_eur, 'transactionId', tx, 'payCurrency', p_pay_currency));
    return 'paid';
  end if;

  next_status := case p_status
    when 'new' then 'awaiting_payment' when 'pending' then 'awaiting_payment' when 'confirming' then 'confirming'
    when 'invalid' then 'failed' when 'expired' then 'expired' when 'canceled' then 'canceled'
    when 'refunded' then 'refunded' when 'partially_refunded' then 'refunded' else deposit.status end;
  update public.gateway_deposits set status = next_status where id = deposit.id;
  return next_status;
end;
$$;

revoke all on function public.create_gateway_deposit(uuid, numeric, uuid, text) from public, anon, authenticated, service_role;
revoke all on function public.attach_gateway_order(uuid, bigint, text) from public, anon, authenticated, service_role;
revoke all on function public.settle_gateway_deposit(uuid, bigint, text, numeric, text, text, numeric, text, numeric, numeric, timestamptz) from public, anon, authenticated, service_role;
grant execute on function public.create_gateway_deposit(uuid, numeric, uuid, text) to service_role;
grant execute on function public.attach_gateway_order(uuid, bigint, text) to service_role;
grant execute on function public.settle_gateway_deposit(uuid, bigint, text, numeric, text, text, numeric, text, numeric, numeric, timestamptz) to service_role;

notify pgrst, 'reload schema';
