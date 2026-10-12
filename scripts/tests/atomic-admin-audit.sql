create function pg_temp.reject_audit() returns trigger language plpgsql as $$ begin
 if current_setting('brickwise.test.audit_failure',true)='1' then raise exception 'fixture_audit_failure'; end if;
 return new;
end $$;
create trigger fixture_reject_audit before insert on public.admin_audit_logs for each row execute function pg_temp.reject_audit();
do $test$
#variable_conflict use_variable
declare actor uuid; uid uuid:=gen_random_uuid(); tx uuid; retry uuid; blocked boolean; result jsonb; slug text:='audit-fixture-'||gen_random_uuid()::text; ops jsonb; count_before bigint; pid uuid;
begin
 select id into actor from auth.users where raw_app_meta_data->>'role'='admin' limit 1;
 if actor is null then raise exception 'Admin fixture dependency missing'; end if;
 insert into auth.users(id,email) values(uid,uid::text||'@example.invalid');
 perform set_config('brickwise.test.audit_failure','1',true);
 blocked:=false;
 begin perform credit_wallet_atomic(uid,100,'EUR',actor,'audit@example.invalid','Fixture','audit-fixture-credit:'||uid); exception when raise_exception then blocked:=sqlerrm='fixture_audit_failure'; end;
 if not blocked or exists(select 1 from wallet_transactions where user_id=uid) or exists(select 1 from wallet_accounts where user_id=uid) or exists(select 1 from payment_requests where user_id=uid) then raise exception 'Credit audit failure was not atomic'; end if;
 perform set_config('brickwise.test.audit_failure','0',true);
 tx:=credit_wallet_atomic(uid,100,'EUR',actor,'audit@example.invalid','Fixture','audit-fixture-credit:'||uid);
 retry:=credit_wallet_atomic(uid,100,'EUR',actor,'audit@example.invalid','Fixture','audit-fixture-credit:'||uid);
 if tx<>retry or (select balance from wallet_accounts where user_id=uid)<>100 or (select count(*) from admin_audit_logs where action='wallet.credit' and details->>'transactionId'=tx::text)<>1 then raise exception 'Credit replay duplicated audit or balance'; end if;

 ops:=jsonb_build_array(jsonb_build_object('table','properties','operation','upsert','data',jsonb_build_object('slug',slug,'title','Fixture','city','Test','price',100,'status','draft')));
 result:=admin_write_audited(null,'property.import','property_import',slug,'{}',ops);
 if jsonb_array_length(result)<>1 or not exists(select 1 from admin_audit_logs where action='property.import' and target_id=slug and actor_id is null) then raise exception 'API import missing audit'; end if;
 perform admin_write_audited(actor,'property.import','property_import',slug,'{}',jsonb_set(ops,'{0,data,price}','200'));
 if (select price from properties where properties.slug=slug)<>200 or (select count(*) from properties where properties.slug=slug)<>1 then raise exception 'Import upsert broken'; end if;
 select count(*) into count_before from admin_audit_logs;
 perform set_config('brickwise.test.audit_failure','1',true);
 blocked:=false;
 begin
  perform admin_write_audited(actor,'property.import','property_import',slug,'{}',jsonb_set(ops,'{0,data,price}','300')||jsonb_set(ops,'{0,data,slug}',to_jsonb(slug||'-new')));
 exception when raise_exception then blocked:=sqlerrm='fixture_audit_failure'; end;
 if not blocked or (select price from properties where properties.slug=slug)<>200 or exists(select 1 from properties where properties.slug=slug||'-new') or (select count(*) from admin_audit_logs)<>count_before then raise exception 'Import batch not rolled back'; end if;

 -- Multi-table property creation rolls back the draft and all translations.
 blocked:=false;
 begin
  perform admin_write_audited(actor,'property.create','property',slug||'-create','{}',jsonb_build_array(
   jsonb_build_object('table','properties','operation','insert','data',jsonb_build_object('slug',slug||'-create','title','Fixture','city','Test','price',100,'status','draft')),
   jsonb_build_object('table','property_translations','operation','upsert','data',jsonb_build_object('property_slug',slug||'-create','locale','en','title','Fixture','description','Fixture description'))));
 exception when raise_exception then blocked:=sqlerrm='fixture_audit_failure'; end;
 if not blocked or exists(select 1 from properties where properties.slug=slug||'-create') or exists(select 1 from property_translations where property_slug=slug||'-create') then raise exception 'Property/translation transaction not atomic'; end if;
 perform set_config('brickwise.test.audit_failure','0',true);
 result:=admin_write_audited(actor,'payment_request.create','payment_request',null,'{}',jsonb_build_array(jsonb_build_object('table','payment_requests','operation','insert','data',jsonb_build_object('user_id',uid,'customer_email','audit@example.invalid','title','Fixture','amount',25,'currency','EUR','method','bank_transfer','status','sent'))));
 pid:=(result->0->>'id')::uuid;
 perform set_config('brickwise.test.audit_failure','1',true);
 blocked:=false;
 begin perform admin_write_audited(actor,'payment_request.update','payment_request',pid::text,'{}',jsonb_build_array(jsonb_build_object('table','payment_requests','operation','update','data','{"status":"paid"}'::jsonb,'match',jsonb_build_object('id',pid)))); exception when raise_exception then blocked:=sqlerrm='fixture_audit_failure'; end;
 if not blocked or (select status from payment_requests where id=pid)<>'sent' then raise exception 'Payment update not atomic'; end if;
 perform set_config('brickwise.test.audit_failure','0',true);
 blocked:=false;
 begin perform admin_write_audited(uid,'property.import','property_import',slug,'{}',ops); exception when raise_exception then blocked:=true; end;
 if not blocked then raise exception 'Non-admin actor accepted'; end if;
 if has_function_privilege('authenticated','public.admin_write_audited(uuid,text,text,text,jsonb,jsonb)','EXECUTE') or has_function_privilege('anon','public.admin_write_audited(uuid,text,text,text,jsonb,jsonb)','EXECUTE') then raise exception 'Client RPC access allowed'; end if;
 blocked:=false;
 begin perform admin_write_audited(actor,'property.import','property_import',slug,'{}','[{"table":"wallet_accounts","operation":"insert","data":{"balance":100}}]'); exception when raise_exception then blocked:=true; end;
 if not blocked then raise exception 'Unexpected table allowed'; end if;
end $test$;
