-- Property-request access policy, revision 2026-09-27.
-- Run the complete transaction. Safe to reapply; existing rows are not changed.
-- Deploy the contact-request API's session-derived user_id before applying.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

alter table public.property_requests
  add column if not exists user_id uuid references auth.users(id) on delete set null;

create index if not exists property_requests_user_id_idx
  on public.property_requests(user_id);
create index if not exists property_requests_email_idx
  on public.property_requests(lower(email));

alter table public.property_requests enable row level security;

-- Permissive policies combine with OR. Replace the entire policy set so legacy
-- "Anyone can create" and fixed-email admin rules cannot bypass the new rules.
do $$
declare existing record;
begin
  for existing in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'property_requests'
  loop
    execute format('drop policy %I on public.property_requests', existing.policyname);
  end loop;

  -- Table-level revocation does not remove independently granted column rights.
  for existing in
    select attname from pg_attribute
    where attrelid = 'public.property_requests'::regclass
      and attnum > 0 and not attisdropped and attacl is not null
  loop
    execute format(
      'revoke all (%I) on public.property_requests from public, anon, authenticated',
      existing.attname
    );
  end loop;
end;
$$;

revoke all on public.property_requests from public, anon, authenticated;
grant insert (user_id, property_id, name, full_name, email, phone, message, status)
  on public.property_requests to anon, authenticated;
grant select on public.property_requests to authenticated;
grant update (status) on public.property_requests to authenticated;

create policy "Visitors create new unlinked requests"
on public.property_requests for insert to anon
with check (user_id is null and status = 'new');

create policy "Customers create own new requests"
on public.property_requests for insert to authenticated
with check ((select auth.uid()) = user_id and status = 'new');

-- Applies alongside either INSERT policy. Keep investment summaries (up to
-- 2,000 user-entered characters plus server-generated details) within 4,096.
-- This is an INSERT policy, not a CHECK constraint: trusted wallet RPCs must
-- still be able to create completed orders and historical rows remain intact.
create policy "Client request input limits"
on public.property_requests as restrictive for insert to anon, authenticated
with check (
  char_length(btrim(coalesce(nullif(name, ''), full_name, ''))) between 1 and 120
  and char_length(email) between 3 and 254
  and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  and char_length(btrim(message)) between 1 and 4096
  and char_length(coalesce(phone, '')) <= 80
);

create policy "Customers read own requests"
on public.property_requests for select to authenticated
using (
  (select auth.uid()) = user_id
);

create policy "Role administrators read property requests"
on public.property_requests for select to authenticated
using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "Role administrators update request status"
on public.property_requests for update to authenticated
using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
with check (
  (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  and status in ('new', 'contacted', 'closed')
);

-- No client DELETE/TRUNCATE grants or policies. service_role privileges and
-- SECURITY DEFINER wallet functions are deliberately preserved.
commit;
