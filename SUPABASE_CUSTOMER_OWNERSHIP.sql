-- Identity is the immutable user ID, never a reusable contact email.
-- Unlinked guest records remain visible only to the trusted administration.
alter table public.payment_requests enable row level security;
alter table public.property_requests enable row level security;
drop policy if exists "Customers can read own payment requests" on public.payment_requests;
create policy "Customers can read own payment requests"
on public.payment_requests for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Customers read owned or unlinked email requests" on public.property_requests;
drop policy if exists "Customers read own requests" on public.property_requests;
create policy "Customers read own requests"
on public.property_requests for select to authenticated
using ((select auth.uid()) = user_id);
-- Existing trusted-admin policies, column privacy and write policies remain.
notify pgrst, 'reload schema';
