-- Integration assertions for SUPABASE_PROPERTY_REQUESTS_RLS.sql.
-- The runner must execute this file and the migration in ONE transaction and
-- ROLLBACK afterward. This file deliberately contains no transaction control.
-- Only generated fixtures are queried; no customer rows or JWTs are returned.

create temporary table property_requests_rls_results (
  label text primary key
) on commit drop;

do $$
declare temporary_schema text;
begin
  select nspname into temporary_schema
    from pg_namespace where oid = pg_my_temp_schema();
  execute format('grant usage on schema %I to anon, authenticated, service_role', temporary_schema);
  perform set_config('brickwise.rls.user_a', gen_random_uuid()::text, true);
  perform set_config('brickwise.rls.user_b', gen_random_uuid()::text, true);
  perform set_config('brickwise.rls.admin', gen_random_uuid()::text, true);
  perform set_config('brickwise.rls.prefix', 'property_requests_rls:' || gen_random_uuid()::text, true);
  perform set_config('brickwise.rls.own', gen_random_uuid()::text, true);
  perform set_config('brickwise.rls.other', gen_random_uuid()::text, true);
  perform set_config('brickwise.rls.other_email_match', gen_random_uuid()::text, true);
  perform set_config('brickwise.rls.unlinked', gen_random_uuid()::text, true);
  perform set_config('brickwise.rls.unlinked_other', gen_random_uuid()::text, true);
  perform set_config('brickwise.rls.unlinked_empty', gen_random_uuid()::text, true);
  -- Clear legacy individual claim settings so only request.jwt.claims applies.
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claim.email', '', true);
  perform set_config('request.jwt.claim.role', '', true);
  perform set_config('request.jwt.claims', '{}', true);
end;
$$;

grant select, insert on pg_temp.property_requests_rls_results to anon, authenticated, service_role;

create function pg_temp.rls_assert(p_ok boolean, p_label text)
returns void language plpgsql security invoker as $$
begin
  if p_ok is distinct from true then
    raise exception 'Property-request RLS assertion failed: %', p_label;
  end if;
  insert into pg_temp.property_requests_rls_results(label) values (p_label);
end;
$$;

create function pg_temp.rls_denied(p_statement text, p_label text)
returns void language plpgsql security invoker as $$
begin
  begin
    execute p_statement;
  exception when insufficient_privilege then
    perform pg_temp.rls_assert(true, p_label);
    return;
  end;
  raise exception 'Property-request RLS expected permission denial: %', p_label;
end;
$$;

create function pg_temp.rls_affected(p_statement text, p_expected bigint, p_label text)
returns void language plpgsql security invoker as $$
declare affected bigint;
begin
  execute p_statement;
  get diagnostics affected = row_count;
  perform pg_temp.rls_assert(affected = p_expected, p_label);
end;
$$;

grant execute on function pg_temp.rls_assert(boolean, text) to anon, authenticated, service_role;
grant execute on function pg_temp.rls_denied(text, text) to anon, authenticated, service_role;
grant execute on function pg_temp.rls_affected(text, bigint, text) to anon, authenticated, service_role;

-- All users are synthetic and disappear when the runner rolls back.
insert into auth.users (id, email, raw_app_meta_data)
values
  (current_setting('brickwise.rls.user_a')::uuid, current_setting('brickwise.rls.user_a') || '@example.invalid', '{"role":"client"}'::jsonb),
  (current_setting('brickwise.rls.user_b')::uuid, current_setting('brickwise.rls.user_b') || '@example.invalid', '{"role":"client"}'::jsonb),
  (current_setting('brickwise.rls.admin')::uuid, current_setting('brickwise.rls.admin') || '@example.invalid', '{"role":"admin"}'::jsonb);

-- Privileged setup includes a legacy empty-email row and a foreign-owned row
-- whose email matches A. Neither may leak through the customer email fallback.
insert into public.property_requests (id, user_id, name, email, message, status)
values
  (current_setting('brickwise.rls.own')::uuid, current_setting('brickwise.rls.user_a')::uuid, 'Synthetic owner A', current_setting('brickwise.rls.user_a') || '@example.invalid', current_setting('brickwise.rls.prefix'), 'new'),
  (current_setting('brickwise.rls.other')::uuid, current_setting('brickwise.rls.user_b')::uuid, 'Synthetic owner B', current_setting('brickwise.rls.user_b') || '@example.invalid', current_setting('brickwise.rls.prefix'), 'new'),
  (current_setting('brickwise.rls.other_email_match')::uuid, current_setting('brickwise.rls.user_b')::uuid, 'Synthetic foreign owner', current_setting('brickwise.rls.user_a') || '@example.invalid', current_setting('brickwise.rls.prefix'), 'new'),
  (current_setting('brickwise.rls.unlinked')::uuid, null, 'Synthetic unlinked A', upper(current_setting('brickwise.rls.user_a') || '@example.invalid'), current_setting('brickwise.rls.prefix'), 'new'),
  (current_setting('brickwise.rls.unlinked_other')::uuid, null, 'Synthetic unlinked B', current_setting('brickwise.rls.user_b') || '@example.invalid', current_setting('brickwise.rls.prefix'), 'new'),
  (current_setting('brickwise.rls.unlinked_empty')::uuid, null, 'Synthetic legacy empty email', '', current_setting('brickwise.rls.prefix'), 'new');

select pg_temp.rls_assert(
  not has_table_privilege('anon', 'public.property_requests', 'DELETE')
  and not has_table_privilege('authenticated', 'public.property_requests', 'DELETE'),
  'neither client role has DELETE privilege');
select pg_temp.rls_assert(
  not has_table_privilege('anon', 'public.property_requests', 'TRUNCATE')
  and not has_table_privilege('authenticated', 'public.property_requests', 'TRUNCATE'),
  'neither client role has TRUNCATE privilege');
select pg_temp.rls_assert(
  not has_table_privilege('anon', 'public.property_requests', 'SELECT'),
  'anonymous table SELECT is revoked');
select pg_temp.rls_assert((
  select count(*) = 6 and bool_and(policyname in (
    'Visitors create new unlinked requests',
    'Customers create own new requests',
    'Client request input limits',
    'Customers read own requests',
    'Role administrators read property requests',
    'Role administrators update request status'
  )) from pg_policies
  where schemaname = 'public' and tablename = 'property_requests'
), 'only the six intended policies remain after repeated migration');
select pg_temp.rls_assert(
  not exists (
    select 1 from pg_attribute
    where attrelid = 'public.property_requests'::regclass and attnum > 0 and not attisdropped
      and attname <> 'status'
      and has_column_privilege('authenticated', 'public.property_requests', attname, 'UPDATE')
  ), 'authenticated UPDATE is limited to the status column');
select pg_temp.rls_assert(
  not has_column_privilege('anon', 'public.property_requests', 'id', 'INSERT')
  and not has_column_privilege('authenticated', 'public.property_requests', 'created_at', 'INSERT'),
  'clients cannot assign protected insert columns');

set local role anon;

select pg_temp.rls_affected(format(
  'insert into public.property_requests(name,email,message,status) values (%L,%L,%L,%L)',
  'Synthetic anonymous request', 'anonymous@example.invalid', current_setting('brickwise.rls.prefix'), 'new'),
  1, 'anonymous new unlinked request is accepted');
select pg_temp.rls_denied(format(
  'insert into public.property_requests(name,email,message,status) values (%L,%L,%L,%L)',
  'Synthetic forged completion', 'anonymous@example.invalid', current_setting('brickwise.rls.prefix'), 'completed'),
  'anonymous completed request is rejected');
select pg_temp.rls_denied(format(
  'insert into public.property_requests(name,email,message,status) values (%L,%L,%L,null)',
  'Synthetic null status', 'anonymous@example.invalid', current_setting('brickwise.rls.prefix')),
  'anonymous null status is rejected');
select pg_temp.rls_denied(format(
  'insert into public.property_requests(user_id,name,email,message,status) values (%L::uuid,%L,%L,%L,%L)',
  current_setting('brickwise.rls.user_b'), 'Synthetic forged owner', 'anonymous@example.invalid', current_setting('brickwise.rls.prefix'), 'new'),
  'anonymous assigned customer owner is rejected');
select pg_temp.rls_denied(format(
  'insert into public.property_requests(id,name,email,message,status) values (%L::uuid,%L,%L,%L,%L)',
  gen_random_uuid(), 'Synthetic forged ID', 'anonymous@example.invalid', current_setting('brickwise.rls.prefix'), 'new'),
  'anonymous explicit primary key is rejected');
select pg_temp.rls_denied(
  'select id from public.property_requests where false',
  'anonymous SELECT is denied without inspecting rows');

-- Exercise the restrictive policy through real inserts, including SQL NULL.
select pg_temp.rls_denied(
  $sql$insert into public.property_requests(name,email,message,status) values ('Synthetic invalid email','invalid-email','Synthetic input','new')$sql$,
  'invalid email is rejected');
select pg_temp.rls_denied(
  $sql$insert into public.property_requests(name,email,message,status) values ('Synthetic missing email',null,'Synthetic input','new')$sql$,
  'null email is rejected');
select pg_temp.rls_denied(
  $sql$insert into public.property_requests(name,email,message,status) values (' ','fixture@example.invalid','Synthetic input','new')$sql$,
  'blank name is rejected');
select pg_temp.rls_denied(
  $sql$insert into public.property_requests(name,email,message,status) values ('Synthetic blank message','fixture@example.invalid',' ','new')$sql$,
  'blank message is rejected');
select pg_temp.rls_denied(
  $sql$insert into public.property_requests(name,email,message,status) values ('Synthetic long message','fixture@example.invalid',repeat('x',4097),'new')$sql$,
  'message above 4096 characters is rejected');
select pg_temp.rls_denied(
  $sql$insert into public.property_requests(name,email,message,phone,status) values ('Synthetic long phone','fixture@example.invalid','Synthetic input',repeat('1',81),'new')$sql$,
  'phone above 80 characters is rejected');
select pg_temp.rls_affected(
  $sql$insert into public.property_requests(full_name,email,message,phone,status) values (repeat('N',120),'limits@example.invalid',repeat('x',4096),repeat('1',80),'new')$sql$,
  1, 'full-name fallback and inclusive input limits are accepted');

reset role;
do $$
begin
  perform set_config('request.jwt.claims', jsonb_build_object(
    'sub', current_setting('brickwise.rls.user_a'),
    'email', current_setting('brickwise.rls.user_a') || '@example.invalid',
    'role', 'authenticated', 'app_metadata', jsonb_build_object('role', 'client')
  )::text, true);
end;
$$;
set local role authenticated;

select pg_temp.rls_assert(auth.uid() = current_setting('brickwise.rls.user_a')::uuid, 'authenticated fixture identity is active');
select pg_temp.rls_assert((select count(*) from public.property_requests where id = current_setting('brickwise.rls.own')::uuid) = 1, 'customer reads their linked request');
select pg_temp.rls_assert((select count(*) from public.property_requests where id = current_setting('brickwise.rls.other')::uuid) = 0, 'customer cannot read another owner');
select pg_temp.rls_assert((select count(*) from public.property_requests where id = current_setting('brickwise.rls.other_email_match')::uuid) = 0, 'matching email cannot expose another linked owner');
select pg_temp.rls_assert((select count(*) from public.property_requests where id = current_setting('brickwise.rls.unlinked')::uuid) = 0, 'unlinked records require explicit administrative assignment');
select pg_temp.rls_assert((select count(*) from public.property_requests where id = current_setting('brickwise.rls.unlinked_other')::uuid) = 0, 'customer cannot read another unlinked email');
select pg_temp.rls_affected(format(
  'insert into public.property_requests(user_id,name,email,message,status) values (%L::uuid,%L,%L,%L,%L)',
  current_setting('brickwise.rls.user_a'), 'Synthetic authenticated request', current_setting('brickwise.rls.user_a') || '@example.invalid', current_setting('brickwise.rls.prefix'), 'new'),
  1, 'customer creates their own new request');
select pg_temp.rls_denied(format(
  'insert into public.property_requests(user_id,name,email,message,status) values (%L::uuid,%L,%L,%L,%L)',
  current_setting('brickwise.rls.user_b'), 'Synthetic forged owner', current_setting('brickwise.rls.user_a') || '@example.invalid', current_setting('brickwise.rls.prefix'), 'new'),
  'customer cannot assign a foreign owner');
select pg_temp.rls_denied(format(
  'insert into public.property_requests(name,email,message,status) values (%L,%L,%L,%L)',
  'Synthetic missing owner', current_setting('brickwise.rls.user_a') || '@example.invalid', current_setting('brickwise.rls.prefix'), 'new'),
  'authenticated customer cannot create an unlinked request');
select pg_temp.rls_denied(format(
  'insert into public.property_requests(user_id,name,email,message,status) values (%L::uuid,%L,%L,%L,%L)',
  current_setting('brickwise.rls.user_a'), 'Synthetic forged completion', current_setting('brickwise.rls.user_a') || '@example.invalid', current_setting('brickwise.rls.prefix'), 'completed'),
  'customer cannot create a completed request');
select pg_temp.rls_affected(format(
  'update public.property_requests set status=%L where id=%L::uuid', 'closed', current_setting('brickwise.rls.own')),
  0, 'ordinary customer status update affects zero rows');
select pg_temp.rls_denied(format(
  'delete from public.property_requests where id=%L::uuid', current_setting('brickwise.rls.own')),
  'ordinary customer deletion is denied');

-- User-editable metadata must never grant administrator capabilities.
do $$
begin
  perform set_config('request.jwt.claims', jsonb_build_object(
    'sub', current_setting('brickwise.rls.user_a'),
    'email', current_setting('brickwise.rls.user_a') || '@example.invalid',
    'role', 'authenticated', 'app_metadata', jsonb_build_object('role', 'client'),
    'user_metadata', jsonb_build_object('role', 'admin')
  )::text, true);
end;
$$;
select pg_temp.rls_assert((select count(*) from public.property_requests where id = current_setting('brickwise.rls.other')::uuid) = 0, 'spoofed user metadata cannot read foreign requests');
select pg_temp.rls_affected(format(
  'update public.property_requests set status=%L where id=%L::uuid', 'closed', current_setting('brickwise.rls.other')),
  0, 'spoofed user metadata cannot update foreign requests');
do $$
begin
  perform set_config('request.jwt.claims', jsonb_build_object(
    'sub', current_setting('brickwise.rls.user_a'), 'email', '', 'role', 'authenticated'
  )::text, true);
end;
$$;
select pg_temp.rls_assert((select count(*) from public.property_requests where id = current_setting('brickwise.rls.unlinked_empty')::uuid) = 0, 'empty JWT email cannot match legacy empty emails');

reset role;
do $$
begin
  perform set_config('request.jwt.claims', jsonb_build_object(
    'sub', current_setting('brickwise.rls.admin'),
    'email', current_setting('brickwise.rls.admin') || '@example.invalid',
    'role', 'authenticated', 'app_metadata', jsonb_build_object('role', 'admin')
  )::text, true);
end;
$$;
set local role authenticated;

select pg_temp.rls_assert((select count(*) from public.property_requests where id = current_setting('brickwise.rls.other')::uuid) = 1, 'trusted admin reads a foreign request');
select pg_temp.rls_affected(format(
  'update public.property_requests set status=%L where id=%L::uuid', 'contacted', current_setting('brickwise.rls.other')),
  1, 'trusted admin updates an allowed request status');
select pg_temp.rls_assert((select status from public.property_requests where id = current_setting('brickwise.rls.other')::uuid) = 'contacted', 'admin update persists within the test transaction');
select pg_temp.rls_denied(format(
  'update public.property_requests set status=%L where id=%L::uuid', 'completed', current_setting('brickwise.rls.other')),
  'admin browser cannot forge a completed status');
select pg_temp.rls_denied(format(
  'update public.property_requests set status=null where id=%L::uuid', current_setting('brickwise.rls.other')),
  'admin null status is rejected');
select pg_temp.rls_denied(format(
  'update public.property_requests set user_id=%L::uuid where id=%L::uuid', current_setting('brickwise.rls.user_a'), current_setting('brickwise.rls.other')),
  'admin browser cannot reassign request ownership');
select pg_temp.rls_denied(format(
  'update public.property_requests set email=%L where id=%L::uuid', 'changed@example.invalid', current_setting('brickwise.rls.other')),
  'admin browser cannot edit the request email');
select pg_temp.rls_denied(format(
  'delete from public.property_requests where id=%L::uuid', current_setting('brickwise.rls.other')),
  'admin browser deletion is denied');

-- A fresh token without the trusted role immediately loses admin access.
do $$
begin
  perform set_config('request.jwt.claims', jsonb_build_object(
    'sub', current_setting('brickwise.rls.admin'),
    'email', current_setting('brickwise.rls.admin') || '@example.invalid',
    'role', 'authenticated', 'app_metadata', jsonb_build_object('role', 'client')
  )::text, true);
end;
$$;
select pg_temp.rls_assert((select count(*) from public.property_requests where id = current_setting('brickwise.rls.other')::uuid) = 0, 'same admin identity without trusted role loses foreign reads');
select pg_temp.rls_affected(format(
  'update public.property_requests set status=%L where id=%L::uuid', 'closed', current_setting('brickwise.rls.other')),
  0, 'same admin identity without trusted role loses updates');

reset role;
do $$
begin
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
end;
$$;
set local role service_role;

select pg_temp.rls_affected(format(
  'insert into public.property_requests(user_id,name,email,message,status) values (%L::uuid,%L,%L,%L,%L)',
  current_setting('brickwise.rls.user_a'), 'Synthetic trusted settlement', current_setting('brickwise.rls.user_a') || '@example.invalid', current_setting('brickwise.rls.prefix') || ':settlement', 'completed'),
  1, 'service role can still create completed wallet requests');

reset role;
select pg_temp.rls_assert((
  select count(*) from public.property_requests
  where message = current_setting('brickwise.rls.prefix') || ':settlement'
    and user_id = current_setting('brickwise.rls.user_a')::uuid and status = 'completed'
) = 1, 'trusted settlement survives all client restrictions');

select jsonb_build_object(
  'suite', 'property_requests_rls',
  'passed', count(*),
  'status', 'passed',
  'fixtures', 'synthetic; enclosing runner must roll back'
) as rls_test_result
from pg_temp.property_requests_rls_results;
