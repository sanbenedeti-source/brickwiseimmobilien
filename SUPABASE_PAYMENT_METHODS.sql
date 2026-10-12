-- Versioned historical migration. Do not edit an applied body; create a new migration.
-- Existing installations must be baselined using scripts/secure-wallet-migrations.mjs.
do $versioned_migration$
declare stored_checksum text;
begin
 perform pg_advisory_xact_lock(hashtextextended('brickwise-wallet-migrations',0));
 if to_regclass('public.brickwise_schema_migrations') is null then
  raise exception 'Migration registry missing; run the reviewed wallet migration baseline first';
 end if;
 select checksum into stored_checksum from public.brickwise_schema_migrations where version='003_payment_methods';
 if found then
  if stored_checksum<>'3b3e447bb32c3605eec9b8219c0f98a79959fde8d25bd9ad26adf51dc0b0d453' then raise exception 'Migration checksum mismatch: 003_payment_methods'; end if;
  return;
 end if;
 -- These scripts are retired on initialized wallets. Never re-import history or downgrade RPCs.
 if to_regclass('public.wallet_transactions') is not null then
  raise exception 'Untracked initialized wallet; review and baseline migration 003_payment_methods before continuing';
 end if;
-- Run in a transaction. Existing payment history requires explicit review.
lock table public.payment_requests in access exclusive mode;
do $guard$ begin
 if exists(select 1 from public.payment_requests where method not in ('bank_transfer','crypto','wallet_credit')) then raise exception 'Review existing payment methods before migration'; end if;
end $guard$;
alter table public.payment_requests add column if not exists crypto_asset text;
alter table public.payment_requests add column if not exists crypto_network text;
alter table public.payment_requests drop constraint if exists payment_requests_method_check;
alter table public.payment_requests add constraint payment_requests_method_check check (method in ('bank_transfer','crypto','wallet_credit'));
alter table public.payment_requests drop constraint if exists payment_requests_crypto_details_check;
alter table public.payment_requests add constraint payment_requests_crypto_details_check check ((method='crypto' and crypto_asset is not null and crypto_network is not null and length(trim(crypto_asset)) between 1 and 30 and length(trim(crypto_network)) between 1 and 60) or (method<>'crypto' and crypto_asset is null and crypto_network is null));
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
$function$
;

 insert into public.brickwise_schema_migrations(version,checksum,mode) values('003_payment_methods','3b3e447bb32c3605eec9b8219c0f98a79959fde8d25bd9ad26adf51dc0b0d453','applied');
end $versioned_migration$;
