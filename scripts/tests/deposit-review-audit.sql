create function pg_temp.reject_deposit_audit() returns trigger language plpgsql as $$ begin
 if new.action='deposit.review' and current_setting('brickwise.test.audit_failure',true)='1' then raise exception 'fixture_deposit_audit_failure'; end if;
 return new;
end $$;
create trigger fixture_reject_deposit_audit before insert on public.admin_audit_logs for each row execute function pg_temp.reject_deposit_audit();
do $test$
declare uid uuid:=gen_random_uuid(); actor uuid; m company_payment_methods; dep uuid; blocked boolean; approve boolean;
begin
 select id into actor from auth.users where raw_app_meta_data->>'role'='admin' limit 1;
 insert into auth.users(id,email) values(uid,uid::text||'@example.invalid');
 select * into m from company_payment_methods where active and kind='crypto' limit 1;
 foreach approve in array array[true,false] loop
  perform set_config('request.jwt.claims',jsonb_build_object('sub',uid,'role','authenticated','app_metadata','{}'::jsonb)::text,true);
  dep:=submit_deposit(m.id,40,0.01,replace(gen_random_uuid()::text,'-',''),gen_random_uuid(),to_jsonb(m)-'created_at'-'updated_at');
  perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated','app_metadata',jsonb_build_object('role','admin'))::text,true);
  perform set_config('brickwise.test.audit_failure','1',true);
  blocked:=false;
  begin perform review_deposit(dep,approve,40,'audit-settlement:'||dep,'Fixture review'); exception when raise_exception then blocked:=sqlerrm='fixture_deposit_audit_failure'; end;
  if not blocked or (select status from deposit_submissions where id=dep)<>'pending' or exists(select 1 from payment_requests where user_id=uid) or exists(select 1 from wallet_transactions where user_id=uid) then raise exception 'Deposit decision not rolled back'; end if;
 end loop;
 perform set_config('brickwise.test.audit_failure','0',true);
 perform review_deposit(dep,false,40,'audit-settlement:'||dep,'Fixture rejection');
 if (select status from deposit_submissions where id=dep)<>'rejected' or (select count(*) from admin_audit_logs where action='deposit.review' and target_id=dep::text)<>1 then raise exception 'Deposit rejection audit missing'; end if;
end $test$;
