-- Executed only inside the migration runner's rollback transaction.
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claim.email', '', true);
select set_config('request.jwt.claim.role', '', true);
select set_config('request.jwt.claims', '{}', true);

insert into auth.users(id, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data) values
  ('16000000-0000-4000-8000-000000000001', 'agreement-a@example.invalid', now(), '{}', '{}'),
  ('16000000-0000-4000-8000-000000000002', 'agreement-b@example.invalid', now(), '{}', '{"role":"admin"}'),
  ('16000000-0000-4000-8000-000000000003', 'agreement-unconfirmed@example.invalid', null, '{}', '{}'),
  ('16000000-0000-4000-8000-000000000004', 'agreement-admin@example.invalid', now(), '{"role":"admin"}', '{}');

insert into public.client_agreement_versions(version, locale, document_path, document_sha256, consent_text, is_draft, active) values
  ('agreement-fixture-v1', 'en', '/documents/agreements/agreement-fixture-v1/en.pdf', repeat('a', 64), 'I accept this draft and submit it for administrator review.', true, true),
  ('agreement-fixture-v1', 'de', '/documents/agreements/agreement-fixture-v1/de.pdf', repeat('b', 64), 'Ich akzeptiere diesen Entwurf und reiche ihn zur Pruefung ein.', true, true),
  ('agreement-fixture-v1', 'fr', '/documents/agreements/agreement-fixture-v1/fr.pdf', repeat('c', 64), 'This inactive draft must not be accepted.', true, false);

create function pg_temp.agreement_expect_error(statement text, expected text)
returns void language plpgsql security invoker as $$
declare rejected boolean := false;
begin
  begin
    execute statement;
  exception when others then
    if sqlerrm not like '%' || expected || '%' then
      raise exception 'Unexpected failure; expected %, received SQLSTATE %: %', expected, sqlstate, sqlerrm;
    end if;
    rejected := true;
  end;
  if not rejected then
    raise exception 'Expected rejected agreement operation: %', expected;
  end if;
end;
$$;
grant execute on function pg_temp.agreement_expect_error(text, text) to anon, authenticated, service_role;
do $$ declare fixture_schema text; begin
  select nspname into fixture_schema from pg_namespace where oid = pg_my_temp_schema();
  execute format('grant usage on schema %I to anon, authenticated, service_role', fixture_schema);
end $$;

-- No anonymous access, including PUBLIC's default function EXECUTE grant.
set local role anon;
select pg_temp.agreement_expect_error('select * from public.client_agreement_versions', 'permission denied');
select pg_temp.agreement_expect_error('select * from public.client_agreement_acceptances', 'permission denied');
select pg_temp.agreement_expect_error($q$select public.accept_client_agreement('agreement-fixture-v1', 'en', 'Fixture Signer', true)$q$, 'permission denied');
select pg_temp.agreement_expect_error($q$select public.review_client_agreement(gen_random_uuid(), 'approved', null)$q$, 'permission denied');
reset role;

-- A role without an authenticated account cannot submit acceptance.
set local role authenticated;
select pg_temp.agreement_expect_error($q$select public.accept_client_agreement('agreement-fixture-v1', 'en', 'Fixture Signer', true)$q$, 'AGREEMENT_AUTH_REQUIRED');
reset role;

select set_config('request.jwt.claims', '{"sub":"16000000-0000-4000-8000-000000000003","role":"authenticated","email_confirmed_at":"2026-10-02","email":"forged@example.invalid"}', true);
set local role authenticated;
select pg_temp.agreement_expect_error($q$select public.accept_client_agreement('agreement-fixture-v1', 'en', 'Fixture Signer', true)$q$, 'AGREEMENT_CONFIRMED_EMAIL_REQUIRED');
reset role;

select set_config('request.jwt.claims', '{"sub":"16000000-0000-4000-8000-000000000001","role":"authenticated","email":"forged@example.invalid"}', true);
set local role authenticated;
select pg_temp.agreement_expect_error($q$select public.accept_client_agreement('agreement-fixture-v1', 'en', 'Fixture Signer', false)$q$, 'AGREEMENT_EXPLICIT_CONSENT_REQUIRED');
select pg_temp.agreement_expect_error($q$select public.accept_client_agreement('agreement-fixture-v1', 'en', 'Fixture Signer', null)$q$, 'AGREEMENT_EXPLICIT_CONSENT_REQUIRED');
select pg_temp.agreement_expect_error($q$select public.accept_client_agreement('agreement-fixture-v1', 'en', ' A ', true)$q$, 'AGREEMENT_SIGNER_NAME_INVALID');
select pg_temp.agreement_expect_error($q$select public.accept_client_agreement('agreement-fixture-v1', 'en', E'\t \n ', true)$q$, 'AGREEMENT_SIGNER_NAME_INVALID');
select pg_temp.agreement_expect_error($q$select public.accept_client_agreement('agreement-fixture-v1', 'en', null, true)$q$, 'AGREEMENT_SIGNER_NAME_INVALID');
select pg_temp.agreement_expect_error($q$select public.accept_client_agreement('agreement-fixture-v1', 'en', repeat('x', 121), true)$q$, 'AGREEMENT_SIGNER_NAME_INVALID');
select pg_temp.agreement_expect_error($q$select public.accept_client_agreement('agreement-fixture-v1', 'en', E'Name\nHidden', true)$q$, 'AGREEMENT_SIGNER_NAME_INVALID');
select pg_temp.agreement_expect_error($q$select public.accept_client_agreement('agreement-fixture-v1', 'fr', 'Fixture Signer', true)$q$, 'AGREEMENT_VERSION_UNAVAILABLE');
select pg_temp.agreement_expect_error($q$select public.accept_client_agreement('missing', 'en', 'Fixture Signer', true)$q$, 'AGREEMENT_VERSION_UNAVAILABLE');

do $$ declare accepted uuid; repeated uuid; switched uuid; record public.client_agreement_acceptances%rowtype; begin
  accepted := public.accept_client_agreement('agreement-fixture-v1', 'en', '  First Signer  ', true);
  repeated := public.accept_client_agreement('agreement-fixture-v1', 'en', 'Changed Signer', true);
  switched := public.accept_client_agreement('agreement-fixture-v1', 'de', 'German Signer', true);
  select * into record from public.client_agreement_acceptances where id = accepted;
  if accepted <> repeated or accepted <> switched or record.id is null
     or record.signer_name <> 'First Signer' or record.locale <> 'en'
     or record.email <> 'agreement-a@example.invalid'
     or record.document_sha256 <> repeat('a', 64)
     or record.document_path <> '/documents/agreements/agreement-fixture-v1/en.pdf'
     or record.consent_text <> 'I accept this draft and submit it for administrator review.'
     or record.is_draft is not true or record.status <> 'pending'
     or record.user_id <> auth.uid() or record.accepted_at < statement_timestamp() - interval '1 minute'
     or (select count(*) from public.client_agreement_acceptances where version = 'agreement-fixture-v1') <> 1 then
    raise exception 'Agreement identity, snapshot or idempotency assertion failed';
  end if;
end $$;

select pg_temp.agreement_expect_error($q$insert into public.client_agreement_acceptances(user_id, signer_name, email, version, locale, document_path, document_sha256, consent_text, is_draft) values (auth.uid(), 'Forged Signer', 'forged@example.invalid', 'agreement-fixture-v1', 'en', '/forged.pdf', repeat('d', 64), 'forged consent', false)$q$, 'permission denied');
select pg_temp.agreement_expect_error($q$update public.client_agreement_acceptances set status = 'approved' where user_id = auth.uid()$q$, 'permission denied');
select pg_temp.agreement_expect_error($q$delete from public.client_agreement_acceptances where user_id = auth.uid()$q$, 'permission denied');
select pg_temp.agreement_expect_error($q$update public.client_agreement_versions set active = false$q$, 'permission denied');
select pg_temp.agreement_expect_error($q$select public.review_client_agreement((select id from public.client_agreement_acceptances where user_id = auth.uid() and version = 'agreement-fixture-v1'), 'approved', null)$q$, 'AGREEMENT_ADMIN_REQUIRED');
reset role;

-- Account B's editable metadata and forged JWT admin role cannot grant access.
select set_config('request.jwt.claims', '{"sub":"16000000-0000-4000-8000-000000000002","role":"authenticated","app_metadata":{"role":"admin"},"user_metadata":{"role":"admin"}}', true);
set local role authenticated;
do $$ begin
  if public.is_client_agreement_admin() or exists(select 1 from public.client_agreement_acceptances where version = 'agreement-fixture-v1') then
    raise exception 'Spoofed admin saw another customer acceptance';
  end if;
  perform public.accept_client_agreement('agreement-fixture-v1', 'de', 'Second Signer', true);
  if (select count(*) from public.client_agreement_acceptances where version = 'agreement-fixture-v1') <> 1
     or exists(select 1 from public.client_agreement_acceptances where user_id <> auth.uid()) then
    raise exception 'Customer ownership isolation failed';
  end if;
end $$;
select pg_temp.agreement_expect_error($q$select public.review_client_agreement((select id from public.client_agreement_acceptances where user_id = auth.uid() and version = 'agreement-fixture-v1'), 'approved', null)$q$, 'AGREEMENT_ADMIN_REQUIRED');
reset role;

-- Defenses remain when an elevated maintenance session attempts edits/deletes.
select pg_temp.agreement_expect_error($q$update public.client_agreement_acceptances set signer_name = 'Changed' where version = 'agreement-fixture-v1'$q$, 'AGREEMENT_ACCEPTANCE_IMMUTABLE');
select pg_temp.agreement_expect_error($q$update public.client_agreement_acceptances set user_id = '16000000-0000-4000-8000-000000000003' where version = 'agreement-fixture-v1'$q$, 'AGREEMENT_ACCEPTANCE_IMMUTABLE');
select pg_temp.agreement_expect_error($q$update public.client_agreement_acceptances set document_sha256 = repeat('e', 64) where version = 'agreement-fixture-v1'$q$, 'AGREEMENT_ACCEPTANCE_IMMUTABLE');
select pg_temp.agreement_expect_error($q$update public.client_agreement_acceptances set accepted_at = now() - interval '1 day' where version = 'agreement-fixture-v1'$q$, 'AGREEMENT_ACCEPTANCE_IMMUTABLE');
select pg_temp.agreement_expect_error($q$delete from public.client_agreement_acceptances where version = 'agreement-fixture-v1'$q$, 'AGREEMENT_ACCEPTANCE_IMMUTABLE');
select pg_temp.agreement_expect_error($q$update public.client_agreement_versions set consent_text = 'A different consent' where version = 'agreement-fixture-v1'$q$, 'AGREEMENT_VERSION_IMMUTABLE');
select pg_temp.agreement_expect_error($q$delete from public.client_agreement_versions where version = 'agreement-fixture-v1'$q$, 'AGREEMENT_VERSION_IMMUTABLE');

-- Trusted database role grants are necessary even for a real administrator.
select set_config('request.jwt.claims', '{"sub":"16000000-0000-4000-8000-000000000004","role":"authenticated"}', true);
set local role authenticated;
do $$ begin
  if not public.is_client_agreement_admin()
     or (select count(*) from public.client_agreement_acceptances where version = 'agreement-fixture-v1') <> 2 then
    raise exception 'Trusted administrator cannot inspect acceptances';
  end if;
end $$;
select pg_temp.agreement_expect_error($q$update public.client_agreement_acceptances set status = 'approved' where version = 'agreement-fixture-v1'$q$, 'permission denied');
select pg_temp.agreement_expect_error($q$select public.review_client_agreement(gen_random_uuid(), 'approved', 'Valid review note')$q$, 'AGREEMENT_ACCEPTANCE_NOT_FOUND');
select pg_temp.agreement_expect_error($q$select public.review_client_agreement(gen_random_uuid(), 'pending', null)$q$, 'AGREEMENT_REVIEW_DECISION_INVALID');
select pg_temp.agreement_expect_error($q$select public.review_client_agreement(gen_random_uuid(), 'approved', null)$q$, 'AGREEMENT_REVIEW_NOTE_INVALID');
select pg_temp.agreement_expect_error($q$select public.review_client_agreement(gen_random_uuid(), 'approved', '')$q$, 'AGREEMENT_REVIEW_NOTE_INVALID');
select pg_temp.agreement_expect_error($q$select public.review_client_agreement(gen_random_uuid(), 'approved', '   ')$q$, 'AGREEMENT_REVIEW_NOTE_INVALID');
select pg_temp.agreement_expect_error($q$select public.review_client_agreement(gen_random_uuid(), 'approved', E'\t\n ')$q$, 'AGREEMENT_REVIEW_NOTE_INVALID');
select pg_temp.agreement_expect_error($q$select public.review_client_agreement(gen_random_uuid(), 'approved', ' ab ')$q$, 'AGREEMENT_REVIEW_NOTE_INVALID');
select pg_temp.agreement_expect_error($q$select public.review_client_agreement(gen_random_uuid(), 'approved', repeat('x', 1001))$q$, 'AGREEMENT_REVIEW_NOTE_INVALID');
do $$ declare original uuid; reviewed uuid; repeated uuid; begin
  select id into original from public.client_agreement_acceptances
    where user_id = '16000000-0000-4000-8000-000000000001' and version = 'agreement-fixture-v1';
  reviewed := public.review_client_agreement(original, 'approved', '  Checked draft acceptance  ');
  repeated := public.review_client_agreement(original, 'approved', 'Retry note must not replace original');
  if original <> reviewed or original <> repeated or not exists (
    select 1 from public.client_agreement_acceptances where id = original
      and status = 'approved' and reviewed_by = auth.uid() and reviewed_at is not null
      and review_note = 'Checked draft acceptance' and signer_name = 'First Signer'
  ) then raise exception 'Approval or approval retry assertion failed'; end if;
end $$;
select pg_temp.agreement_expect_error($q$select public.review_client_agreement((select id from public.client_agreement_acceptances where user_id = '16000000-0000-4000-8000-000000000001' and version = 'agreement-fixture-v1'), 'rejected', 'Opposite decision')$q$, 'AGREEMENT_ALREADY_REVIEWED');
reset role;

create function pg_temp.agreement_reject_audit() returns trigger language plpgsql as $$ begin
  if new.action = 'agreement.review' and current_setting('brickwise.test.agreement_audit_failure', true) = '1' then
    raise exception 'fixture_agreement_audit_failure';
  end if;
  return new;
end $$;
create trigger fixture_agreement_reject_audit before insert on public.admin_audit_logs
  for each row execute function pg_temp.agreement_reject_audit();
select set_config('brickwise.test.agreement_audit_failure', '1', true);
set local role authenticated;
select pg_temp.agreement_expect_error($q$select public.review_client_agreement((select id from public.client_agreement_acceptances where user_id = '16000000-0000-4000-8000-000000000002' and version = 'agreement-fixture-v1'), 'rejected', 'Audit failure')$q$, 'fixture_agreement_audit_failure');
do $$ begin
  if not exists(select 1 from public.client_agreement_acceptances
    where user_id = '16000000-0000-4000-8000-000000000002' and version = 'agreement-fixture-v1'
      and status = 'pending' and reviewed_by is null and reviewed_at is null and review_note is null) then
    raise exception 'Audit failure did not roll back review';
  end if;
end $$;
reset role;
select set_config('brickwise.test.agreement_audit_failure', '0', true);
set local role authenticated;
do $$ declare original uuid; begin
  select id into original from public.client_agreement_acceptances
    where user_id = '16000000-0000-4000-8000-000000000002' and version = 'agreement-fixture-v1';
  perform public.review_client_agreement(original, 'rejected', 'Document needs clarification');
  perform public.review_client_agreement(original, 'rejected', 'Repeated rejection');
  if not exists(select 1 from public.client_agreement_acceptances where id = original
    and status = 'rejected' and review_note = 'Document needs clarification') then
    raise exception 'Rejection or retry assertion failed';
  end if;
end $$;
reset role;

-- A stale admin token loses authority immediately after account-role removal.
update auth.users set raw_app_meta_data = '{}' where id = '16000000-0000-4000-8000-000000000004';
select set_config('request.jwt.claims', '{"sub":"16000000-0000-4000-8000-000000000004","role":"authenticated","app_metadata":{"role":"admin"}}', true);
set local role authenticated;
do $$ begin
  if public.is_client_agreement_admin() or exists(select 1 from public.client_agreement_acceptances where version = 'agreement-fixture-v1') then
    raise exception 'Revoked administrator retained agreement access';
  end if;
end $$;
select pg_temp.agreement_expect_error($q$select public.review_client_agreement(gen_random_uuid(), 'approved', null)$q$, 'AGREEMENT_ADMIN_REQUIRED');
reset role;

do $$ begin
  if (select count(*) from public.admin_audit_logs where action = 'agreement.review'
      and details ->> 'version' = 'agreement-fixture-v1') <> 2
     or (select count(*) from public.admin_audit_logs where action = 'agreement.review'
      and details ->> 'version' = 'agreement-fixture-v1'
      and actor_id = '16000000-0000-4000-8000-000000000004'
      and actor_email = 'agreement-admin@example.invalid' and status = 'success') <> 2 then
    raise exception 'Review audit missing, duplicated or incorrectly attributed';
  end if;
  if has_table_privilege('authenticated', 'public.client_agreement_acceptances', 'INSERT,UPDATE,DELETE,TRUNCATE')
     or has_table_privilege('service_role', 'public.client_agreement_acceptances', 'INSERT,UPDATE,DELETE,TRUNCATE')
     or has_function_privilege('anon', 'public.accept_client_agreement(text,text,text,boolean)', 'EXECUTE')
     or has_function_privilege('service_role', 'public.review_client_agreement(uuid,text,text)', 'EXECUTE') then
    raise exception 'Unexpected direct agreement write privileges';
  end if;
end $$;

set local role service_role;
select pg_temp.agreement_expect_error($q$delete from public.client_agreement_acceptances where version = 'agreement-fixture-v1'$q$, 'permission denied');
reset role;
