do $test$
declare client uuid:=gen_random_uuid(); actor uuid; reviewer uuid; m company_payment_methods; dep uuid; dep2 uuid; blocked boolean;
begin
 select id into actor from auth.users where raw_app_meta_data->>'role'='admin' limit 1;
 if actor is null then raise exception 'Admin fixture missing'; end if;
 insert into auth.users(id,email) values(client,client::text||'@example.invalid');
 select * into m from company_payment_methods where active order by kind='crypto' desc limit 1;
 if m.id is null then raise exception 'Payment method fixture missing'; end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',client,'role','authenticated','app_metadata','{}'::jsonb)::text,true);
 dep:=submit_deposit(m.id,40,case when m.kind='crypto' then 0.01 end,replace(gen_random_uuid()::text,'-',''),gen_random_uuid(),to_jsonb(m)-'created_at'-'updated_at');
 dep2:=submit_deposit(m.id,40,case when m.kind='crypto' then 0.01 end,replace(gen_random_uuid()::text,'-',''),gen_random_uuid(),to_jsonb(m)-'created_at'-'updated_at');

 -- 1. A client deposit approved by a different admin is still credited.
 perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated','app_metadata',jsonb_build_object('role','admin'))::text,true);
 perform review_deposit(dep,true,40,'guard-settlement:'||dep,'Fixture approval');
 if (select status from deposit_submissions where id=dep)<>'verified' or (select count(*) from wallet_transactions where user_id=client)<>1 then raise exception 'Client deposit not credited'; end if;

 -- 2. Once the depositor is an admin, no approval (by another admin or by themselves) credits the wallet.
 update auth.users set raw_app_meta_data=coalesce(raw_app_meta_data,'{}'::jsonb)||'{"role":"admin"}'::jsonb where id=client;
 foreach reviewer in array array[actor,client] loop
  perform set_config('request.jwt.claims',jsonb_build_object('sub',reviewer,'role','authenticated','app_metadata',jsonb_build_object('role','admin'))::text,true);
  blocked:=false;
  begin perform review_deposit(dep2,true,40,'guard-settlement:'||dep2,'Fixture approval');
  exception when raise_exception then blocked:=sqlerrm in ('Admin accounts cannot be credited','Deposit cannot be verified by its owner'); end;
  if not blocked or (select status from deposit_submissions where id=dep2)<>'pending' or (select count(*) from wallet_transactions where user_id=client)<>1 then raise exception 'Admin deposit was credited'; end if;
 end loop;

 -- Rejecting such a deposit remains possible.
 perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated','app_metadata',jsonb_build_object('role','admin'))::text,true);
 perform review_deposit(dep2,false,null,null,'Fixture rejection');
 if (select status from deposit_submissions where id=dep2)<>'rejected' then raise exception 'Rejection blocked'; end if;

 -- 3. Admin accounts cannot submit deposits.
 perform set_config('request.jwt.claims',jsonb_build_object('sub',client,'role','authenticated','app_metadata',jsonb_build_object('role','admin'))::text,true);
 blocked:=false;
 begin perform submit_deposit(m.id,40,case when m.kind='crypto' then 0.01 end,replace(gen_random_uuid()::text,'-',''),gen_random_uuid(),to_jsonb(m)-'created_at'-'updated_at');
 exception when raise_exception then blocked:=sqlerrm='Admin accounts cannot be credited'; end;
 if not blocked then raise exception 'Admin deposit submitted'; end if;

 -- 4. The guard function is not callable by API roles.
 if has_function_privilege('authenticated','public.guard_deposit_review()','execute') or has_function_privilege('anon','public.guard_deposit_review()','execute') then raise exception 'Guard function exposed'; end if;
end $test$;
