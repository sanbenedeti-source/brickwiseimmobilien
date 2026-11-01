-- Migration 031: audited editing of existing admin-added properties (2026-11-01).
-- Adds the property.update action to the admin_write_audited allowlist so the admin panel can
-- change a property's details and its five translations in one audited write.

create or replace function public.admin_write_audited(p_actor uuid, p_action text, p_target_type text, p_target_id text, p_details jsonb, p_operations jsonb)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare op jsonb; tbl text; verb text; payload jsonb; match jsonb; cols text; vals text; assignments text; conflicts text; result jsonb; results jsonb:='[]'; actor_email text; allowed text[];
begin
 if p_actor is null then
  if p_action is distinct from 'property.import' then raise exception 'Actor required'; end if;
  actor_email:='property-import-api';
 else
  select email into actor_email from auth.users where id=p_actor and raw_app_meta_data->>'role'='admin';
  if not found then raise exception 'Trusted administrator required'; end if;
 end if;
 allowed:=case p_action
  when 'property.create' then array['properties','property_translations']
  when 'property.import' then array['properties']
  when 'property.sale_settings' then array['properties']
  when 'property.sale_status' then array['property_sale_status']
  when 'property.update' then array['properties','property_translations']
  when 'share_settings.update' then array['property_share_settings']
  when 'profit_status.update' then array['property_share_settings']
  when 'company_payment_method.save' then array['company_payment_methods']
  when 'payment_request.create' then array['payment_requests']
  when 'payment_request.update' then array['payment_requests']
  when 'property_request.status_update' then array['property_requests'] end;
 if allowed is null or jsonb_typeof(p_operations) is distinct from 'array' or jsonb_array_length(p_operations) not between 1 and 200 then raise exception 'Invalid audit operation'; end if;
 for op in select value from jsonb_array_elements(p_operations) loop
  tbl:=op->>'table'; verb:=op->>'operation'; payload:=op->'data'; match:=op->'match';
  if tbl is null or not(tbl=any(allowed)) or verb is null or verb not in ('insert','update','upsert') or jsonb_typeof(payload) is distinct from 'object' or payload='{}'::jsonb then raise exception 'Invalid mutation'; end if;
  if exists(select 1 from jsonb_object_keys(payload) k where not exists(select 1 from pg_attribute where attrelid=to_regclass('public.'||tbl) and attname=k and attnum>0 and not attisdropped)) then raise exception 'Invalid column'; end if;
  select string_agg(format('%I',k),',' order by k),string_agg(format('x.%I',k),',' order by k),string_agg(format('%I=x.%I',k,k),',' order by k)
  into cols,vals,assignments from jsonb_object_keys(payload) k;
  if verb='update' then
   if jsonb_typeof(match) is distinct from 'object' or not(match ? 'id' or match ? 'slug' or match ? 'property_slug') or match @> '{"id":null}' or match @> '{"slug":null}' or match @> '{"property_slug":null}' then raise exception 'Explicit update target required'; end if;
   execute format('update public.%I t set %s from jsonb_populate_record(null::public.%I,$1) x where to_jsonb(t) @> $2 returning to_jsonb(t)',tbl,assignments,tbl) into strict result using payload,match;
  else
   assignments:='';
   if verb='upsert' then
    conflicts:=case tbl when 'properties' then 'slug' when 'property_translations' then 'property_slug,locale' when 'property_share_settings' then 'property_slug' when 'property_sale_status' then 'property_slug' else 'id' end;
    select ' on conflict ('||conflicts||') do update set '||string_agg(format('%I=excluded.%I',k,k),',' order by k) into assignments from jsonb_object_keys(payload) k;
   end if;
   execute format('insert into public.%I (%s) select %s from jsonb_populate_record(null::public.%I,$1) x %s returning to_jsonb(%I)',tbl,cols,vals,tbl,assignments,tbl) into strict result using payload;
  end if;
  results:=results||jsonb_build_array(result);
 end loop;
 insert into admin_audit_logs(actor_id,actor_email,action,target_type,target_id,status,details)
 values(p_actor,actor_email,p_action,p_target_type,coalesce(p_target_id,results->0->>'id'), 'success',coalesce(p_details,'{}'::jsonb)||jsonb_build_object('operations',jsonb_array_length(p_operations)));
 return results;
end $function$;

notify pgrst, 'reload schema';
