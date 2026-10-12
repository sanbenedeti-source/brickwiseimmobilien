-- Superseded by the refund migration; never replace its linked-credit implementation.
do $credit_idempotency_migration$ begin
 if to_regclass('public.payment_refunds') is not null then return; end if;
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
 insert into payment_requests(user_id,customer_name,customer_email,title,amount,currency,method,status,instructions,admin_note,created_by,verified_by,verified_at)
 values(p_user_id,nullif(p_customer_name,''),lower(p_customer_email),'[Wallet credit] Admin funding',p_amount,'EUR','wallet_credit','verified','Funds credited by an administrator and available in the client wallet.','Immutable wallet ledger credit',p_actor_id,p_actor_id,now());
 return v_transaction_id;
end $$;
revoke all on function public.credit_wallet_atomic(uuid,numeric,text,uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.credit_wallet_atomic(uuid,numeric,text,uuid,text,text,text) to service_role;

end $credit_idempotency_migration$;
