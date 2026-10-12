-- Apply through scripts/migrate-share-availability.mjs after its rollback check.
-- No balances, holdings or existing availability values are rewritten.
alter table public.property_share_settings
  add column if not exists availability_version bigint not null default 0;

create or replace function public.guard_share_availability()
returns trigger language plpgsql security definer set search_path = '' as $$
declare owned bigint;
begin
  if tg_op = 'UPDATE' then
    if new.property_slug is distinct from old.property_slug then
      raise exception 'share_settings_slug_immutable';
    end if;
    -- Covers old application deployments and generic audited upserts too.
    -- Deliberate reservation reductions must use the version-checked RPC.
    if new.blocked_shares < old.blocked_shares
      and current_setting('brickwise.share_settings_edit', true) is distinct from new.property_slug then
      raise exception 'share_settings_atomic_update_required';
    end if;
    new.availability_version := old.availability_version + case
      when new.total_shares is distinct from old.total_shares
        or new.blocked_shares is distinct from old.blocked_shares then 1 else 0 end;
  else
    new.availability_version := 1;
  end if;

  select coalesce(sum(h.shares), 0) into owned
    from public.property_holdings h where h.property_slug = new.property_slug;
  if new.blocked_shares < owned then
    raise exception 'share_settings_below_owned';
  end if;
  return new;
end;
$$;

revoke all on function public.guard_share_availability() from public, anon, authenticated, service_role;
drop trigger if exists protect_share_availability on public.property_share_settings;
create trigger protect_share_availability before insert or update on public.property_share_settings
  for each row execute function public.guard_share_availability();

create or replace function public.update_share_settings_atomic(
  p_actor uuid,
  p_property_slug text,
  p_total_shares integer,
  p_blocked_shares integer,
  p_expected_version bigint,
  p_minimum_blocked_shares integer default 0
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  actor_email text;
  previous public.property_share_settings;
  saved public.property_share_settings;
  owned bigint;
  previous_guard text;
begin
  select u.email into actor_email from auth.users u
    where u.id = p_actor and u.raw_app_meta_data ->> 'role' = 'admin';
  if not found then raise exception 'share_settings_admin_required'; end if;
  if p_property_slug is null or length(btrim(p_property_slug)) not between 1 and 300
    or p_total_shares is null or p_total_shares < 1
    or p_blocked_shares is null or p_blocked_shares < 0 or p_blocked_shares > p_total_shares
    or p_expected_version is null or p_expected_version < -1
    or p_minimum_blocked_shares is null or p_minimum_blocked_shares < 0 then
    raise exception 'share_settings_invalid';
  end if;

  -- Purchase takes this same row lock before increasing availability and holdings.
  -- The expected revision therefore cannot pass after a concurrent purchase.
  select * into previous from public.property_share_settings
    where property_slug = p_property_slug for update;
  if found then
    if p_expected_version <> previous.availability_version then
      raise exception 'share_settings_stale';
    end if;
  elsif p_expected_version <> -1 then
    raise exception 'share_settings_stale';
  end if;

  select coalesce(sum(h.shares), 0) into owned
    from public.property_holdings h where h.property_slug = p_property_slug;
  -- The opening allocation supplied by the trusted server remains reserved
  -- in addition to purchases recorded in the customer holdings ledger.
  if p_blocked_shares::bigint < owned + p_minimum_blocked_shares::bigint then
    raise exception 'share_settings_below_owned';
  end if;

  if previous.property_slug is null then
    insert into public.property_share_settings(property_slug,total_shares,blocked_shares)
      values(p_property_slug,p_total_shares,p_blocked_shares)
      on conflict(property_slug) do nothing returning * into saved;
    if not found then raise exception 'share_settings_stale'; end if;
  else
    previous_guard := current_setting('brickwise.share_settings_edit', true);
    perform set_config('brickwise.share_settings_edit', p_property_slug, true);
    update public.property_share_settings
      set total_shares = p_total_shares, blocked_shares = p_blocked_shares, updated_at = clock_timestamp()
      where property_slug = p_property_slug returning * into saved;
    perform set_config('brickwise.share_settings_edit', coalesce(previous_guard, ''), true);
  end if;

  insert into public.admin_audit_logs(actor_id,actor_email,action,target_type,target_id,status,details)
    values(p_actor,actor_email,'share_settings.update','property',p_property_slug,'success',
      jsonb_build_object('totalShares',saved.total_shares,'blockedShares',saved.blocked_shares,
        'expectedVersion',p_expected_version,'availabilityVersion',saved.availability_version,
        'ownedShares',owned,'openingBlockedShares',p_minimum_blocked_shares,
        'previousTotalShares',previous.total_shares,'previousBlockedShares',previous.blocked_shares));
  return jsonb_build_object('property_slug',saved.property_slug,'total_shares',saved.total_shares,
    'blocked_shares',saved.blocked_shares,'availability_version',saved.availability_version);
end;
$$;

revoke all on function public.update_share_settings_atomic(uuid,text,integer,integer,bigint,integer)
  from public, anon, authenticated;
grant execute on function public.update_share_settings_atomic(uuid,text,integer,integer,bigint,integer)
  to service_role;
notify pgrst, 'reload schema';
