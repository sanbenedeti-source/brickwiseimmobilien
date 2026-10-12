-- Versioned historical migration. Do not edit an applied body; create a new migration.
-- Existing installations must be baselined using scripts/secure-wallet-migrations.mjs.
do $versioned_migration$
declare stored_checksum text;
begin
 perform pg_advisory_xact_lock(hashtextextended('brickwise-wallet-migrations',0));
 if to_regclass('public.brickwise_schema_migrations') is null then
  raise exception 'Migration registry missing; run the reviewed wallet migration baseline first';
 end if;
 select checksum into stored_checksum from public.brickwise_schema_migrations where version='002_eur_only';
 if found then
  if stored_checksum<>'d55e2f92e66d40362c2427726ac9d70dce7ab4d6ccaa80c35e783124828b98b0' then raise exception 'Migration checksum mismatch: 002_eur_only'; end if;
  return;
 end if;
 -- These scripts are retired on initialized wallets. Never re-import history or downgrade RPCs.
 if to_regclass('public.wallet_transactions') is not null then
  raise exception 'Untracked initialized wallet; review and baseline migration 002_eur_only before continuing';
 end if;
-- Switch empty financial tables to EUR without relabelling existing money.
-- Run inside a transaction. Aborts if any non-EUR records exist.
lock table public.wallet_accounts,public.wallet_transactions,public.property_holdings,public.payment_requests,public.property_share_settings in access exclusive mode;
do $guard$ begin
  if exists(select 1 from public.wallet_accounts where currency is distinct from 'EUR') then raise exception 'Non-EUR records in wallet_accounts; explicit conversion required'; end if;
  if exists(select 1 from public.wallet_transactions where currency is distinct from 'EUR') then raise exception 'Non-EUR records in wallet_transactions; explicit conversion required'; end if;
  if exists(select 1 from public.property_holdings where currency is distinct from 'EUR') then raise exception 'Non-EUR records in property_holdings; explicit conversion required'; end if;
  if exists(select 1 from public.payment_requests where currency is distinct from 'EUR') then raise exception 'Non-EUR records in payment_requests; explicit conversion required'; end if;
end $guard$;

-- Match the existing EUR listing before enabling EUR wallet purchases.
-- EUR 116,100 / EUR 100 = 1,161 shares, with 31 opening reservations.
-- Preserve existing purchases/reservations, profit settings and paused state.
update public.property_share_settings
set total_shares=1161, blocked_shares=greatest(blocked_shares,31)
where property_slug='sal-rei-boa-vista-b1-residences-ap1';
do $supply$ begin
  if exists(select 1 from public.property_share_settings where property_slug='sal-rei-boa-vista-b1-residences-ap1' and blocked_shares > total_shares)
    then raise exception 'Sal Rei reservations exceed the EUR listing supply'; end if;
end $supply$;

alter table public.wallet_accounts alter column currency set default 'EUR';
alter table public.wallet_accounts drop constraint if exists wallet_accounts_currency_check;
alter table public.wallet_accounts add constraint wallet_accounts_currency_check check (currency = 'EUR');
alter table public.wallet_transactions alter column currency set default 'EUR';
alter table public.wallet_transactions drop constraint if exists wallet_transactions_currency_check;
alter table public.wallet_transactions add constraint wallet_transactions_currency_check check (currency = 'EUR');
alter table public.property_holdings alter column currency set default 'EUR';
alter table public.property_holdings drop constraint if exists property_holdings_currency_check;
alter table public.property_holdings add constraint property_holdings_currency_check check (currency = 'EUR');
alter table public.payment_requests alter column currency set default 'EUR';
alter table public.payment_requests drop constraint if exists payment_requests_currency_check;
alter table public.payment_requests add constraint payment_requests_currency_check check (currency = 'EUR');

CREATE OR REPLACE FUNCTION public.credit_wallet_atomic(p_user_id uuid, p_amount numeric, p_currency text, p_actor_id uuid, p_customer_email text, p_customer_name text, p_idempotency_key text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.purchase_shares_with_wallet_atomic(p_user_id uuid, p_property_slug text, p_property_title text, p_shares integer, p_price_per_share numeric, p_customer_name text, p_customer_email text, p_phone text, p_message text, p_idempotency_key text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
end; $function$;

 insert into public.brickwise_schema_migrations(version,checksum,mode) values('002_eur_only','d55e2f92e66d40362c2427726ac9d70dce7ab4d6ccaa80c35e783124828b98b0','applied');
end $versioned_migration$;
