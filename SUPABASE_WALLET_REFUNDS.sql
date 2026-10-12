-- Full refunds only. Run through scripts/migrate-wallet-refunds.mjs.
alter table public.payment_requests add column if not exists credit_transaction_id uuid references public.wallet_transactions(id);
create unique index if not exists payment_credit_transaction_unique on public.payment_requests(credit_transaction_id) where credit_transaction_id is not null;
do $guard$ begin
 if exists(select 1 from public.payment_requests where method='wallet_credit' and credit_transaction_id is null) then raise exception 'Unlinked historical wallet credits require explicit reconciliation before this migration'; end if;
end $guard$;
-- Apply after SUPABASE_PAYMENT_METHODS.sql. Preserve service-role-only grants.
create or replace function public.credit_wallet_atomic(p_user_id uuid, p_amount numeric, p_currency text, p_actor_id uuid, p_customer_email text, p_customer_name text, p_idempotency_key text)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_transaction_id uuid; previous public.wallet_transactions;
begin
 if p_user_id is null or p_actor_id is null or p_amount is null or p_amount<=0 or p_amount::text in ('NaN','Infinity','-Infinity') or p_amount<>round(p_amount,2) or upper(p_currency) is distinct from 'EUR' then raise exception 'invalid wallet credit'; end if;
 if p_idempotency_key is null or length(trim(p_idempotency_key)) not between 1 and 200 then raise exception 'operation key required'; end if;
 -- Serialize requests for the same operation even when different wallets are supplied.
 perform pg_advisory_xact_lock(hashtextextended(p_idempotency_key,0));
 select * into previous from wallet_transactions where idempotency_key=p_idempotency_key;
 if found then
  if previous.user_id is distinct from p_user_id or previous.amount is distinct from p_amount or previous.currency is distinct from 'EUR' or previous.created_by is distinct from p_actor_id or previous.type is distinct from 'credit' or previous.direction is distinct from 'credit' or previous.reference_type is distinct from 'admin_credit' then raise exception 'operation key already used with different credit details'; end if;
  return previous.id;
 end if;
 insert into wallet_accounts(user_id,currency,balance) values(p_user_id,'EUR',0) on conflict(user_id) do nothing;
 perform 1 from wallet_accounts where user_id=p_user_id for update;
 insert into wallet_transactions(user_id,type,direction,amount,currency,reference_type,idempotency_key,created_by,metadata)
 values(p_user_id,'credit','credit',p_amount,'EUR','admin_credit',p_idempotency_key,p_actor_id,jsonb_build_object('customer_email',p_customer_email)) returning id into v_transaction_id;
 update wallet_accounts set balance=balance+p_amount,updated_at=now() where user_id=p_user_id;
 insert into payment_requests(user_id,customer_name,customer_email,title,amount,currency,method,status,instructions,admin_note,created_by,verified_by,verified_at,credit_transaction_id)
 values(p_user_id,nullif(p_customer_name,''),lower(p_customer_email),'[Wallet credit] Admin funding',p_amount,'EUR','wallet_credit','verified','Funds credited by an administrator and available in the client wallet.','Immutable wallet ledger credit',p_actor_id,p_actor_id,now(),v_transaction_id);
 return v_transaction_id;
end $$;
revoke all on function public.credit_wallet_atomic(uuid,numeric,text,uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.credit_wallet_atomic(uuid,numeric,text,uuid,text,text,text) to service_role;

create table if not exists public.payment_refunds (
 id uuid primary key default gen_random_uuid(),
 payment_id uuid not null unique references public.payment_requests(id),
 user_id uuid references auth.users(id),
 amount numeric(14,2) not null check(amount>0), currency text not null default 'EUR' check(currency='EUR'),
 credit_transaction_id uuid unique references public.wallet_transactions(id),
 debit_transaction_id uuid unique references public.wallet_transactions(id),
 external_reference text not null check(length(trim(external_reference)) between 4 and 200),
 note text not null check(length(trim(note)) between 3 and 1000),
 actor_id uuid not null references auth.users(id), created_at timestamptz not null default now(),
 check ((credit_transaction_id is null)=(debit_transaction_id is null))
);
create unique index if not exists payment_refunds_external_unique on public.payment_refunds(lower(external_reference));
alter table public.payment_refunds enable row level security;
revoke all on public.payment_refunds from public,anon,authenticated;
grant select on public.payment_refunds to authenticated;
grant select,insert on public.payment_refunds to service_role;
drop policy if exists "Read own refunds or admin" on public.payment_refunds;
create policy "Read own refunds or admin" on public.payment_refunds for select to authenticated using(user_id=auth.uid() or auth.jwt()->'app_metadata'->>'role'='admin');
create or replace function public.prevent_refund_mutation() returns trigger language plpgsql as $$
begin raise exception 'Refund records are immutable'; end $$;
drop trigger if exists payment_refunds_immutable on public.payment_refunds;
create trigger payment_refunds_immutable before update or delete on public.payment_refunds for each row execute function public.prevent_refund_mutation();

create or replace function public.guard_payment_financial_status() returns trigger language plpgsql set search_path=public as $$
begin
 if tg_op='UPDATE' then
  if exists(select 1 from payment_refunds where payment_id=old.id) or old.credit_transaction_id is not null then
   if (new.user_id,new.amount,new.currency,new.method,new.credit_transaction_id) is distinct from (old.user_id,old.amount,old.currency,old.method,old.credit_transaction_id) then raise exception 'Linked financial payment is immutable'; end if;
  end if;
  if old.status='refunded' and new.status is distinct from old.status then raise exception 'Refunded status is final'; end if;
  if old.credit_transaction_id is not null and new.status is distinct from old.status and new.status<>'refunded' then raise exception 'Wallet credit status requires ledger operation'; end if;
 end if;
 if new.method='wallet_credit' and new.credit_transaction_id is null then raise exception 'Wallet credit requires original ledger transaction'; end if;
 if new.status='refunded' and not exists(select 1 from payment_refunds where payment_id=new.id) then raise exception 'Use the atomic refund operation'; end if;
 return new;
end $$;
drop trigger if exists payment_financial_status_guard on public.payment_requests;
create trigger payment_financial_status_guard before insert or update on public.payment_requests for each row execute function public.guard_payment_financial_status();

alter table public.deposit_submissions drop constraint if exists deposit_submissions_status_check;
alter table public.deposit_submissions add constraint deposit_submissions_status_check check(status in ('pending','verified','rejected','refunded'));
-- Refunded transfers must never be reused as new deposits or settlements.
drop index if exists public.deposit_settlement_unique;
create unique index deposit_settlement_unique on public.deposit_submissions(lower(settlement_reference)) where status in ('verified','refunded');

create or replace function public.refund_payment_atomic(p_payment_id uuid,p_reference text,p_note text)
returns uuid language plpgsql security definer set search_path=public as $$
declare p payment_requests; c wallet_transactions; r payment_refunds; debit uuid; result uuid; available numeric; actor_email text;
begin
 if auth.uid() is null or coalesce(auth.jwt()->'app_metadata'->>'role','')<>'admin' then raise exception 'Admin required'; end if;
 if p_reference is null or length(trim(p_reference)) not between 4 and 200 or p_note is null or length(trim(p_note)) not between 3 and 1000 then raise exception 'External refund reference and note required'; end if;
 select * into p from payment_requests where id=p_payment_id for update;
 if not found then raise exception 'Payment not found'; end if;
 select * into r from payment_refunds where payment_id=p.id;
 if found then
  if lower(r.external_reference)<>lower(trim(p_reference)) then raise exception 'Already refunded with another reference'; end if;
  return r.id;
 end if;
 if p.status not in ('paid','verified') or p.currency<>'EUR' then raise exception 'Only received EUR payments can be refunded'; end if;
 if p.method='wallet_credit' and p.credit_transaction_id is null then raise exception 'Original wallet credit is not linked'; end if;
 if p.credit_transaction_id is not null then
  select * into c from wallet_transactions where id=p.credit_transaction_id;
  if not found or c.user_id is distinct from p.user_id or c.amount<>p.amount or c.currency<>'EUR' or c.type<>'credit' or c.direction<>'credit' then raise exception 'Invalid original credit'; end if;
  select balance into available from wallet_accounts where user_id=p.user_id for update;
  if available is null or available<p.amount then raise exception 'insufficient_refund_balance'; end if;
  insert into wallet_transactions(user_id,type,direction,amount,currency,reference_type,reference_id,idempotency_key,created_by,metadata)
  values(p.user_id,'refund','debit',p.amount,'EUR','payment_refund',p.id::text,'refund:'||p.id::text,auth.uid(),jsonb_build_object('original_credit_id',c.id,'external_reference',trim(p_reference))) returning id into debit;
  update wallet_accounts set balance=balance-p.amount,updated_at=now() where user_id=p.user_id;
 end if;
 insert into payment_refunds(payment_id,user_id,amount,currency,credit_transaction_id,debit_transaction_id,external_reference,note,actor_id)
 values(p.id,p.user_id,p.amount,'EUR',p.credit_transaction_id,debit,trim(p_reference),trim(p_note),auth.uid()) returning id into result;
 update payment_requests set status='refunded' where id=p.id;
 update deposit_submissions set status='refunded' where transaction_id=p.credit_transaction_id and status='verified';
 select email into actor_email from auth.users where id=auth.uid();
 insert into admin_audit_logs(actor_id,actor_email,action,target_type,target_id,status,details)
 values(auth.uid(),actor_email,'payment.refund','payment_request',p.id::text,'success',jsonb_build_object('refund_id',result,'amount',p.amount,'currency','EUR','debit_transaction_id',debit,'external_reference',trim(p_reference)));
 return result;
end $$;
revoke all on function public.refund_payment_atomic(uuid,text,text) from public,anon;
grant execute on function public.refund_payment_atomic(uuid,text,text) to authenticated;
