-- Migration 027: "upcoming" construction status for admin-added properties (2026-10-27).
-- An upcoming property is shown with its photos and details but is not open for investment
-- (checked in the application) until its construction status is changed.

alter table public.properties drop constraint if exists properties_construction_status_check;
alter table public.properties add constraint properties_construction_status_check
  check (construction_status in ('completed', 'under_construction', 'upcoming'));

notify pgrst, 'reload schema';
