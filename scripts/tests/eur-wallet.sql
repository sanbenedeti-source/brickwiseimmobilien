-- Always run in a transaction followed by ROLLBACK. No test rows persist.
do $test$
declare
  test_user uuid := gen_random_uuid();
  test_actor uuid := gen_random_uuid();
  test_slug text := 'eur-test-' || gen_random_uuid()::text;
  credit_id uuid;
  request_id uuid;
  failed boolean;
  relation text;
begin
  insert into auth.users(id,email,raw_app_meta_data,raw_user_meta_data)
    values(test_user,test_user::text || '@example.invalid','{}','{}');
  insert into auth.users(id,email,raw_app_meta_data,raw_user_meta_data)
    values(test_actor,test_actor::text || '@example.invalid','{"role":"admin"}','{}');
  insert into public.property_share_settings(property_slug,total_shares,blocked_shares)
    values(test_slug,10,0);

  failed := false;
  begin
    perform public.credit_wallet_atomic(test_user,3000,'CAD',test_actor,'test@example.invalid','Test','eur-reject-' || test_user);
  exception when others then
    if sqlerrm <> 'invalid wallet credit' then raise; end if;
    failed := true;
  end;
  if not failed then raise exception 'Foreign wallet currency accepted'; end if;

  credit_id := public.credit_wallet_atomic(test_user,3000,'EUR',test_actor,'test@example.invalid','Test','eur-credit-' || test_user);
  request_id := public.purchase_shares_with_wallet_atomic(test_user,test_slug,'Test',2,1000,'Test','test@example.invalid','','EUR integration test','eur-purchase-' || test_user);
  if not exists(select 1 from public.wallet_accounts where user_id=test_user and balance=1000 and currency='EUR') then raise exception 'Wrong EUR wallet balance'; end if;
  if not exists(select 1 from public.property_holdings where user_id=test_user and shares=2 and invested_amount=2000 and currency='EUR') then raise exception 'Wrong EUR holdings'; end if;
  if not exists(select 1 from public.payment_requests where user_id=test_user and amount=3000 and currency='EUR') then raise exception 'Wrong EUR funding record'; end if;
  if (select count(*) from public.wallet_transactions where user_id=test_user and currency='EUR') <> 2 then raise exception 'Wrong EUR transaction count'; end if;
  if not exists(select 1 from public.property_share_settings where property_slug=test_slug and blocked_shares=2) then raise exception 'Wrong share allocation'; end if;
  if not exists(select 1 from public.property_requests where id=request_id and status='completed') then raise exception 'Missing completed purchase'; end if;

  failed := false;
  begin
    perform public.purchase_shares_with_wallet_atomic(test_user,test_slug,'Test',2,1000,'Test','test@example.invalid','','EUR test','eur-insufficient-' || test_user);
  exception when others then
    if sqlerrm <> 'insufficient_funds' then raise; end if;
    failed := true;
  end;
  if not failed then raise exception 'Overspending accepted'; end if;

  failed := false;
  begin
    update public.wallet_transactions set amount=1 where id=credit_id;
  exception when others then
    if sqlerrm <> 'wallet transactions are immutable' then raise; end if;
    failed := true;
  end;
  if not failed then raise exception 'Ledger lost immutability'; end if;

  failed := false;
  begin
    insert into public.payment_requests(customer_email,title,amount,currency)
      values('test@example.invalid','Foreign currency rejection',1,'CAD');
  exception when check_violation then failed := true;
  end;
  if not failed then raise exception 'Foreign payment currency accepted'; end if;

  foreach relation in array array['wallet_accounts','wallet_transactions','property_holdings','payment_requests'] loop
    if not exists(select 1 from pg_constraint where conrelid=('public.' || relation)::regclass and conname=relation || '_currency_check' and pg_get_constraintdef(oid) like '%EUR%') then raise exception 'Missing EUR constraint on %',relation; end if;
  end loop;
  if has_function_privilege('authenticated','public.credit_wallet_atomic(uuid,numeric,text,uuid,text,text,text)','EXECUTE')
    or has_function_privilege('anon','public.purchase_shares_with_wallet_atomic(uuid,text,text,integer,numeric,text,text,text,text,text)','EXECUTE')
    or not has_function_privilege('service_role','public.credit_wallet_atomic(uuid,numeric,text,uuid,text,text,text)','EXECUTE')
    then raise exception 'Wallet privileges changed'; end if;
end $test$;
select 'EUR credit, purchase, balances, holdings, supply, currency rejection, insufficient funds, immutability and privileges passed' as result;
