-- Versioned historical migration. Do not edit an applied body; create a new migration.
-- Existing installations must be baselined using scripts/secure-wallet-migrations.mjs.
do $versioned_migration$
declare stored_checksum text;
begin
 perform pg_advisory_xact_lock(hashtextextended('brickwise-wallet-migrations',0));
 if to_regclass('public.brickwise_schema_migrations') is null then
  raise exception 'Migration registry missing; run the reviewed wallet migration baseline first';
 end if;
 select checksum into stored_checksum from public.brickwise_schema_migrations where version='001_wallet_ledger';
 if found then
  if stored_checksum<>'053575fa266558aac7e11ed50cb35eb8007b741f8e1702a3e7e8d6169828d079' then raise exception 'Migration checksum mismatch: 001_wallet_ledger'; end if;
  return;
 end if;
 -- These scripts are retired on initialized wallets. Never re-import history or downgrade RPCs.
 if to_regclass('public.wallet_transactions') is not null then
  raise exception 'Untracked initialized wallet; review and baseline migration 001_wallet_ledger before continuing';
 end if;
-- Brickwise atomic wallet ledger and property holdings.
create table if not exists public.wallet_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  currency text not null default 'EUR' check (currency = 'EUR'),
  balance numeric(14,2) not null default 0 check (balance >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('credit','purchase','refund','adjustment')),
  direction text not null check (direction in ('credit','debit')),
  amount numeric(14,2) not null check (amount > 0),
  currency text not null default 'EUR' check (currency = 'EUR'),
  property_slug text,
  shares integer check (shares is null or shares > 0),
  reference_type text,
  reference_id text,
  idempotency_key text not null unique,
  created_by uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.property_holdings (
  user_id uuid not null references auth.users(id) on delete cascade,
  property_slug text not null,
  shares integer not null check (shares > 0),
  invested_amount numeric(14,2) not null check (invested_amount > 0),
  currency text not null default 'EUR' check (currency = 'EUR'),
  first_purchased_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, property_slug)
);

create index if not exists wallet_transactions_user_created_idx on public.wallet_transactions(user_id, created_at desc);
create index if not exists property_holdings_user_idx on public.property_holdings(user_id);

alter table public.wallet_accounts enable row level security;
alter table public.wallet_transactions enable row level security;
alter table public.property_holdings enable row level security;

drop policy if exists "Users read own wallet account" on public.wallet_accounts;
create policy "Users read own wallet account" on public.wallet_accounts for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Users read own wallet transactions" on public.wallet_transactions;
create policy "Users read own wallet transactions" on public.wallet_transactions for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Users read own property holdings" on public.property_holdings;
create policy "Users read own property holdings" on public.property_holdings for select to authenticated using (auth.uid() = user_id);

create or replace function public.prevent_wallet_transaction_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'wallet transactions are immutable';
end;
$$;
drop trigger if exists wallet_transactions_immutable_update on public.wallet_transactions;
create trigger wallet_transactions_immutable_update before update or delete on public.wallet_transactions for each row execute function public.prevent_wallet_transaction_mutation();

create or replace function public.credit_wallet_atomic(
  p_user_id uuid,
  p_amount numeric,
  p_currency text,
  p_actor_id uuid,
  p_customer_email text,
  p_customer_name text,
  p_idempotency_key text
) returns uuid
language plpgsql security definer set search_path = public
as $$
declare v_transaction_id uuid;
begin
  if p_amount <= 0 or upper(p_currency) <> 'EUR' then raise exception 'invalid wallet credit'; end if;
  insert into wallet_accounts(user_id,currency,balance) values(p_user_id,'EUR',0) on conflict(user_id) do nothing;
  perform 1 from wallet_accounts where user_id=p_user_id for update;
  insert into wallet_transactions(user_id,type,direction,amount,currency,reference_type,idempotency_key,created_by,metadata)
  values(p_user_id,'credit','credit',p_amount,'EUR','admin_credit',p_idempotency_key,p_actor_id,jsonb_build_object('customer_email',p_customer_email))
  returning id into v_transaction_id;
  update wallet_accounts set balance=balance+p_amount,updated_at=now() where user_id=p_user_id;
  insert into payment_requests(user_id,customer_name,customer_email,title,amount,currency,method,status,instructions,admin_note,created_by,verified_by,verified_at)
  values(p_user_id,nullif(p_customer_name,''),lower(p_customer_email),'[Wallet credit] Admin funding',p_amount,'EUR','wallet_credit','verified','Funds credited by an administrator and available in the client wallet.','Immutable wallet ledger credit',p_actor_id,p_actor_id,now());
  return v_transaction_id;
end;
$$;

create or replace function public.purchase_shares_with_wallet_atomic(
  p_user_id uuid, p_property_slug text, p_property_title text, p_shares integer,
  p_price_per_share numeric, p_customer_name text, p_customer_email text,
  p_phone text, p_message text, p_idempotency_key text
) returns uuid language plpgsql security definer set search_path=public as $$
declare v_amount numeric(14,2); v_balance numeric(14,2); v_total integer; v_blocked integer; v_request_id uuid;
begin
  if p_shares < 1 or p_price_per_share <= 0 then raise exception 'invalid_purchase'; end if;
  v_amount:=round(p_shares*p_price_per_share,2);
  insert into wallet_accounts(user_id,currency,balance) values(p_user_id,'EUR',0) on conflict(user_id) do nothing;
  select balance into v_balance from wallet_accounts where user_id=p_user_id for update;
  if v_balance < v_amount then raise exception 'insufficient_funds'; end if;
  select total_shares,blocked_shares into v_total,v_blocked from property_share_settings where property_slug=p_property_slug for update;
  if v_total is null or v_total-v_blocked < p_shares then raise exception 'insufficient_shares'; end if;
  insert into property_requests(user_id,name,email,phone,message,status) values(p_user_id,p_customer_name,lower(p_customer_email),p_phone,p_message,'completed') returning id into v_request_id;
  insert into wallet_transactions(user_id,type,direction,amount,currency,property_slug,shares,reference_type,reference_id,idempotency_key,created_by)
  values(p_user_id,'purchase','debit',v_amount,'EUR',p_property_slug,p_shares,'property_request',v_request_id::text,p_idempotency_key,p_user_id);
  update wallet_accounts set balance=balance-v_amount,updated_at=now() where user_id=p_user_id;
  update property_share_settings set blocked_shares=blocked_shares+p_shares,updated_at=now() where property_slug=p_property_slug;
  insert into property_holdings(user_id,property_slug,shares,invested_amount,currency) values(p_user_id,p_property_slug,p_shares,v_amount,'EUR')
  on conflict(user_id,property_slug) do update set shares=property_holdings.shares+excluded.shares,invested_amount=property_holdings.invested_amount+excluded.invested_amount,updated_at=now();
  return v_request_id;
end; $$;

revoke all on function public.credit_wallet_atomic(uuid,numeric,text,uuid,text,text,text) from public,anon,authenticated;
revoke all on function public.purchase_shares_with_wallet_atomic(uuid,text,text,integer,numeric,text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.credit_wallet_atomic(uuid,numeric,text,uuid,text,text,text) to service_role;
grant execute on function public.purchase_shares_with_wallet_atomic(uuid,text,text,integer,numeric,text,text,text,text,text) to service_role;


 insert into public.brickwise_schema_migrations(version,checksum,mode) values('001_wallet_ledger','053575fa266558aac7e11ed50cb35eb8007b741f8e1702a3e7e8d6169828d079','applied');
end $versioned_migration$;
