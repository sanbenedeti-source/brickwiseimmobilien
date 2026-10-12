select set_config('request.jwt.claim.sub','',true);
select set_config('request.jwt.claim.email','',true);
select set_config('request.jwt.claim.role','',true);
insert into auth.users(id,email) values
('13000000-0000-4000-8000-000000000001','ownership-a@example.invalid'),
('13000000-0000-4000-8000-000000000002','ownership-b@example.invalid');
insert into payment_requests(user_id,customer_email,title,amount,currency,method,status) values
('13000000-0000-4000-8000-000000000001','ownership-a@example.invalid','ownership-fixture',1,'EUR','bank_transfer','sent'),
('13000000-0000-4000-8000-000000000002','ownership-a@example.invalid','ownership-fixture',1,'EUR','bank_transfer','sent'),
(null,'ownership-a@example.invalid','ownership-fixture',1,'EUR','bank_transfer','sent');
insert into property_requests(user_id,name,email,message,status) values
('13000000-0000-4000-8000-000000000001','Fixture A','ownership-a@example.invalid','ownership-fixture','new'),
('13000000-0000-4000-8000-000000000002','Fixture B','ownership-a@example.invalid','ownership-fixture','new'),
(null,'Fixture unlinked','ownership-a@example.invalid','ownership-fixture','new');

create function pg_temp.assert_owned() returns void language plpgsql security invoker as $$
begin
 if (select count(id) from payment_requests where title='ownership-fixture')<>1
 or exists(select id from payment_requests where title='ownership-fixture' and user_id is distinct from auth.uid())
 or (select count(id) from property_requests where message='ownership-fixture')<>1
 or exists(select id from property_requests where message='ownership-fixture' and user_id is distinct from auth.uid()) then
 raise exception 'Ownership isolation failed'; end if;
end $$;
grant execute on function pg_temp.assert_owned() to authenticated;
do $$ declare s text; begin select nspname into s from pg_namespace where oid=pg_my_temp_schema(); execute format('grant usage on schema %I to authenticated',s); end $$;

select set_config('request.jwt.claims','{"sub":"13000000-0000-4000-8000-000000000001","email":"ownership-a@example.invalid","role":"authenticated"}',true);
set local role authenticated;
select pg_temp.assert_owned();
reset role;
-- Original owner retains access after changing address.
select set_config('request.jwt.claims','{"sub":"13000000-0000-4000-8000-000000000001","email":"new-address@example.invalid","role":"authenticated"}',true);
set local role authenticated;
select pg_temp.assert_owned();
reset role;
-- Another account using the old address sees only its own explicitly linked row.
select set_config('request.jwt.claims','{"sub":"13000000-0000-4000-8000-000000000002","email":"ownership-a@example.invalid","role":"authenticated","user_metadata":{"role":"admin"}}',true);
set local role authenticated;
select pg_temp.assert_owned();
do $$ declare blocked boolean:=false; begin
 begin perform admin_note from payment_requests; exception when insufficient_privilege then blocked:=true; end;
 if not blocked then raise exception 'Private payment columns exposed'; end if;
end $$;
reset role;
select set_config('request.jwt.claims','{"sub":"13000000-0000-4000-8000-000000000002","email":"ownership-b@example.invalid","role":"authenticated","app_metadata":{"role":"admin"}}',true);
set local role authenticated;
do $$ begin
 if (select count(id) from property_requests where message='ownership-fixture')<>3 then raise exception 'Trusted admin access lost'; end if;
end $$;
reset role;
set local role service_role;
do $$ begin
 if (select count(id) from payment_requests where title='ownership-fixture')<>3 then raise exception 'Server admin access lost'; end if;
end $$;
reset role;
