-- Synthetic users and properties only; runner always rolls back the transaction.
create function pg_temp.fail_share_settings_audit() returns trigger language plpgsql as $$
begin
  if new.action = 'share_settings.update' and current_setting('brickwise.test.share_audit_failure',true) = '1' then
    raise exception 'fixture_share_audit_failure';
  end if;
  return new;
end;
$$;
create trigger fixture_fail_share_settings_audit before insert on public.admin_audit_logs
  for each row execute function pg_temp.fail_share_settings_audit();

do $test$
declare
  uid uuid := gen_random_uuid();
  actor uuid := gen_random_uuid();
  slug text := 'share-guard-' || gen_random_uuid()::text;
  empty_slug text := 'share-create-' || gen_random_uuid()::text;
  old_version bigint;
  current_version bigint;
  blocked boolean;
  audit_count bigint;
  saved jsonb;
  unchanged public.property_share_settings;
begin
  insert into auth.users(id,email,raw_app_meta_data) values
    (uid,uid::text||'@example.invalid','{}'),
    (actor,actor::text||'@example.invalid','{"role":"admin"}');
  -- Opening/manual reservations deliberately exceed purchased holdings, so
  -- the stale-form test cannot pass using a holdings-only lower bound.
  insert into public.property_share_settings(property_slug,total_shares,blocked_shares,profit_active,profit_start_date)
    values(slug,100,20,false,'2026-01-01');
  select availability_version into old_version from public.property_share_settings where property_slug=slug;
  perform public.credit_wallet_atomic(uid,10000,'EUR',actor,uid::text||'@example.invalid','Fixture','share-credit:'||uid);
  perform public.purchase_shares_with_wallet_atomic(uid,slug,'Fixture',2,1000,'Fixture',uid::text||'@example.invalid','','Fixture','share-purchase:'||uid);
  select availability_version into current_version from public.property_share_settings where property_slug=slug;
  if current_version <> old_version+1 then raise exception 'share_test_purchase_revision'; end if;
  select count(*) into audit_count from public.admin_audit_logs where target_id=slug and action='share_settings.update';

  blocked:=false;
  begin perform public.update_share_settings_atomic(actor,slug,100,20,old_version,0);
  exception when raise_exception then blocked:=sqlerrm='share_settings_stale'; end;
  if not blocked or (select blocked_shares from public.property_share_settings where property_slug=slug)<>22
    or (select count(*) from public.admin_audit_logs where target_id=slug and action='share_settings.update')<>audit_count then
    raise exception 'share_test_stale_purchase';
  end if;

  -- Old deployments and the generic audited mutation cannot bypass the guard.
  blocked:=false;
  begin perform public.admin_write_audited(actor,'share_settings.update','property',slug,'{}',jsonb_build_array(
    jsonb_build_object('table','property_share_settings','operation','upsert','data',jsonb_build_object('property_slug',slug,'total_shares',100,'blocked_shares',20))));
  exception when raise_exception then blocked:=sqlerrm='share_settings_atomic_update_required'; end;
  if not blocked then raise exception 'share_test_legacy_bypass'; end if;

  -- A current, intentional release of manual reservations still works.
  saved:=public.update_share_settings_atomic(actor,slug,100,12,current_version,10);
  if (saved->>'availability_version')::bigint <> current_version+1 or (saved->>'blocked_shares')::integer<>12
    or not exists(select 1 from public.property_share_settings where property_slug=slug and not profit_active and profit_start_date='2026-01-01')
    or current_setting('brickwise.share_settings_edit',true)=slug then raise exception 'share_test_current_edit'; end if;
  current_version:=(saved->>'availability_version')::bigint;
  blocked:=false;
  begin perform public.update_share_settings_atomic(actor,slug,100,11,current_version,10);
  exception when raise_exception then blocked:=sqlerrm='share_settings_below_owned'; end;
  if not blocked then raise exception 'share_test_opening_floor'; end if;
  blocked:=false;
  begin perform public.update_share_settings_atomic(actor,slug,100,1,current_version,0);
  exception when raise_exception then blocked:=sqlerrm='share_settings_below_owned'; end;
  if not blocked then raise exception 'share_test_holdings_floor'; end if;

  -- Admin first, then purchase: the purchase retains the new reservation level.
  saved:=public.update_share_settings_atomic(actor,slug,100,25,current_version,10);
  current_version:=(saved->>'availability_version')::bigint;
  perform public.purchase_shares_with_wallet_atomic(uid,slug,'Fixture',2,1000,'Fixture',uid::text||'@example.invalid','','Fixture','share-purchase-next:'||uid);
  if not exists(select 1 from public.property_share_settings where property_slug=slug and blocked_shares=27 and availability_version=current_version+1)
    or (select shares from public.property_holdings where user_id=uid and property_slug=slug)<>4
    or (select balance from public.wallet_accounts where user_id=uid)<>6000 then raise exception 'share_test_admin_then_purchase'; end if;
  current_version:=current_version+1;

  -- Profit-only edits do not create false conflicts or erase availability.
  update public.property_share_settings set profit_active=true,updated_at=clock_timestamp() where property_slug=slug;
  if (select availability_version from public.property_share_settings where property_slug=slug)<>current_version then raise exception 'share_test_profit_revision'; end if;
  select * into unchanged from public.property_share_settings where property_slug=slug;
  perform set_config('brickwise.test.share_audit_failure','1',true);
  blocked:=false;
  begin perform public.update_share_settings_atomic(actor,slug,100,28,current_version,10);
  exception when raise_exception then blocked:=sqlerrm='fixture_share_audit_failure'; end;
  perform set_config('brickwise.test.share_audit_failure','0',true);
  if not blocked or (select to_jsonb(s) from public.property_share_settings s where property_slug=slug)<>to_jsonb(unchanged)
    then raise exception 'share_test_audit_atomicity'; end if;

  blocked:=false;
  begin perform public.update_share_settings_atomic(uid,slug,100,28,current_version,10);
  exception when raise_exception then blocked:=sqlerrm='share_settings_admin_required'; end;
  if not blocked then raise exception 'share_test_admin_role'; end if;
  blocked:=false;
  begin perform public.update_share_settings_atomic(actor,slug,100,28,null,10);
  exception when raise_exception then blocked:=sqlerrm='share_settings_invalid'; end;
  if not blocked then raise exception 'share_test_missing_revision'; end if;

  saved:=public.update_share_settings_atomic(actor,empty_slug,50,5,-1,0);
  if (saved->>'availability_version')::bigint<>1 then raise exception 'share_test_creation'; end if;
  blocked:=false;
  begin perform public.update_share_settings_atomic(actor,empty_slug,50,6,-1,0);
  exception when raise_exception then blocked:=sqlerrm='share_settings_stale'; end;
  if not blocked then raise exception 'share_test_creation_race'; end if;
  blocked:=false;
  begin perform public.update_share_settings_atomic(actor,empty_slug||'-missing',50,6,0,0);
  exception when raise_exception then blocked:=sqlerrm='share_settings_stale'; end;
  if not blocked then raise exception 'share_test_missing_row'; end if;

  if has_function_privilege('anon','public.update_share_settings_atomic(uuid,text,integer,integer,bigint,integer)','EXECUTE')
    or has_function_privilege('authenticated','public.update_share_settings_atomic(uuid,text,integer,integer,bigint,integer)','EXECUTE')
    or not has_function_privilege('service_role','public.update_share_settings_atomic(uuid,text,integer,integer,bigint,integer)','EXECUTE') then
    raise exception 'share_test_rpc_permissions';
  end if;
end;
$test$;
