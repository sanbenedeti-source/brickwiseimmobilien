-- Migration 023: official agent register and public agent verification (2026-10-25).
-- Clients can check that a person contacting them is a real Brickwise agent, by agent code, email or
-- phone. Agents are managed by a verified (two-factor) admin; the public lookup runs only through the
-- server (service role) with a rate limit, and reveals contact details only for active agents.
-- The rate limit counts per bucket (a keyed hash of the IP reduced to 4096 buckets), so the table stays
-- small, holds no personal data and needs no clean-up.

create table if not exists public.agents (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^BW-[A-HJ-NP-Z2-9]{6}$'),
  full_name text not null check (char_length(btrim(full_name)) between 2 and 120 and full_name !~ '[[:cntrl:]]'),
  title text not null check (char_length(btrim(title)) between 2 and 80 and title !~ '[[:cntrl:]]'),
  email text check (email is null or (char_length(email) <= 254 and email = lower(email) and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')),
  phone text check (phone is null or phone ~ '^\+[1-9][0-9]{6,14}$'),
  languages text[] not null default '{}' check (languages <@ array['en', 'de', 'fr', 'es', 'it']::text[]),
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deactivated_at timestamptz,
  check (email is not null or phone is not null)
);
create unique index if not exists agents_email_key on public.agents(email) where email is not null;
create unique index if not exists agents_phone_key on public.agents(phone) where phone is not null;

create table if not exists public.client_agents (
  user_id uuid primary key references auth.users(id) on delete restrict,
  agent_id uuid references public.agents(id) on delete restrict, -- null: no agent assigned
  assigned_by uuid references auth.users(id) on delete set null,
  assigned_at timestamptz not null default now()
);
create index if not exists client_agents_agent_idx on public.client_agents(agent_id);

create table if not exists public.agent_lookup_buckets (
  bucket integer primary key check (bucket between 0 and 4095),
  window_start timestamptz not null default now(),
  attempts integer not null default 0 check (attempts >= 0)
);

alter table public.agents enable row level security;
alter table public.client_agents enable row level security;
alter table public.agent_lookup_buckets enable row level security;
do $policy$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'agents' and policyname = 'Verified admins and assigned clients read agents') then
    create policy "Verified admins and assigned clients read agents" on public.agents for select to authenticated
      using ((select public.is_verified_admin()) or (active and exists (
        select 1 from public.client_agents ca where ca.agent_id = agents.id and ca.user_id = (select auth.uid()))));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'client_agents' and policyname = 'Clients and verified admins read assignments') then
    create policy "Clients and verified admins read assignments" on public.client_agents for select to authenticated
      using (user_id = (select auth.uid()) or (select public.is_verified_admin()));
  end if;
end $policy$;
revoke all on table public.agents, public.client_agents, public.agent_lookup_buckets from public, anon, authenticated, service_role;
grant select on table public.agents, public.client_agents to authenticated, service_role;

-- Creates (p_id null) or updates an agent. Codes are random, so they cannot be guessed in sequence.
create or replace function public.save_agent(p_id uuid, p_full_name text, p_title text, p_email text, p_phone text, p_languages text[], p_active boolean)
returns uuid language plpgsql security definer set search_path = '' as $$
declare agent_id uuid := p_id; new_code text; alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; actor_email text; previous public.agents%rowtype;
begin
  if not public.is_verified_admin() then raise exception 'AGENT_ADMIN_REQUIRED'; end if;
  if p_active is null then raise exception 'AGENT_INVALID'; end if;
  select email into actor_email from auth.users where id = auth.uid();
  if agent_id is null then
    loop
      new_code := 'BW-' || (select string_agg(substr(alphabet, 1 + floor(random() * 32)::int, 1), '') from generate_series(1, 6));
      exit when not exists (select 1 from public.agents where code = new_code);
    end loop;
    insert into public.agents(code, full_name, title, email, phone, languages, active, created_by, deactivated_at)
    values (new_code, btrim(p_full_name), btrim(p_title), nullif(lower(btrim(p_email)), ''), nullif(btrim(p_phone), ''),
      coalesce(p_languages, '{}'), p_active, auth.uid(), case when p_active then null else now() end)
    returning id into agent_id;
  else
    select * into previous from public.agents where id = agent_id for update;
    if not found then raise exception 'AGENT_NOT_FOUND'; end if;
    update public.agents set full_name = btrim(p_full_name), title = btrim(p_title), email = nullif(lower(btrim(p_email)), ''),
      phone = nullif(btrim(p_phone), ''), languages = coalesce(p_languages, '{}'), active = p_active, updated_at = now(),
      deactivated_at = case when p_active then null when previous.active then now() else previous.deactivated_at end
    where id = agent_id;
  end if;
  insert into public.admin_audit_logs(actor_id, actor_email, action, target_type, target_id, status, details)
  values (auth.uid(), actor_email, case when p_id is null then 'agent.create' else 'agent.update' end, 'agent', agent_id::text, 'success',
    jsonb_build_object('fullName', btrim(p_full_name), 'title', btrim(p_title), 'active', p_active,
      'email', nullif(lower(btrim(p_email)), ''), 'phone', nullif(btrim(p_phone), '')));
  return agent_id;
end;
$$;

-- Assigns a client's personal agent (p_agent_id null removes the assignment).
create or replace function public.assign_client_agent(p_user_id uuid, p_agent_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare actor_email text;
begin
  if not public.is_verified_admin() then raise exception 'AGENT_ADMIN_REQUIRED'; end if;
  if not exists (select 1 from auth.users where id = p_user_id and coalesce(raw_app_meta_data->>'role', '') <> 'admin') then raise exception 'AGENT_CLIENT_INVALID'; end if;
  if p_agent_id is not null and not exists (select 1 from public.agents where id = p_agent_id and active) then raise exception 'AGENT_NOT_ACTIVE'; end if;
  insert into public.client_agents(user_id, agent_id, assigned_by) values (p_user_id, p_agent_id, auth.uid())
  on conflict (user_id) do update set agent_id = excluded.agent_id, assigned_by = excluded.assigned_by, assigned_at = now();
  select email into actor_email from auth.users where id = auth.uid();
  insert into public.admin_audit_logs(actor_id, actor_email, action, target_type, target_id, status, details)
  values (auth.uid(), actor_email, 'agent.assign', 'user', p_user_id::text, 'success', jsonb_build_object('agentId', p_agent_id));
end;
$$;

-- Public check: by agent code, official email or official phone. Contact details only for active agents.
create or replace function public.lookup_agent(p_kind text, p_value text, p_bucket integer)
returns table (is_found boolean, is_active boolean, agent_code text, agent_name text, agent_title text, agent_languages text[], agent_email text, agent_phone text)
language plpgsql security definer set search_path = '' as $$
declare agent public.agents%rowtype; used integer;
begin
  if p_bucket is null or p_bucket not between 0 and 4095 or p_kind not in ('code', 'email', 'phone') or p_value is null or char_length(p_value) > 254 then
    raise exception 'LOOKUP_INVALID';
  end if;
  -- At most 20 checks per bucket in a 15-minute window.
  insert into public.agent_lookup_buckets as b (bucket, window_start, attempts) values (p_bucket, now(), 1)
  on conflict (bucket) do update set
    attempts = case when b.window_start < now() - interval '15 minutes' then 1 else b.attempts + 1 end,
    window_start = case when b.window_start < now() - interval '15 minutes' then now() else b.window_start end
  returning b.attempts into used;
  if used > 20 then raise exception 'LOOKUP_RATE_LIMIT'; end if;
  select * into agent from public.agents a where case p_kind
    when 'code' then a.code = upper(p_value) when 'email' then a.email = lower(p_value) else a.phone = p_value end
  limit 1;
  if not found then
    return query select false, false, null::text, null::text, null::text, null::text[], null::text, null::text;
  elsif not agent.active then
    return query select true, false, agent.code, agent.full_name, null::text, null::text[], null::text, null::text;
  else
    return query select true, true, agent.code, agent.full_name, agent.title, agent.languages, agent.email, agent.phone;
  end if;
end;
$$;

revoke all on function public.save_agent(uuid, text, text, text, text, text[], boolean) from public, anon, authenticated, service_role;
revoke all on function public.assign_client_agent(uuid, uuid) from public, anon, authenticated, service_role;
revoke all on function public.lookup_agent(text, text, integer) from public, anon, authenticated, service_role;
grant execute on function public.save_agent(uuid, text, text, text, text, text[], boolean) to authenticated;
grant execute on function public.assign_client_agent(uuid, uuid) to authenticated;
grant execute on function public.lookup_agent(text, text, integer) to service_role;

notify pgrst, 'reload schema';
