-- Migration 032: listing badges and lifecycle for properties (2026-11-01).
-- strategy: prime | capital_growth | high_yield (badge on the card, optional)
-- occupancy_status: rented | ready (tenant in place or ready to rent, optional)
-- exited_at: date the property was sold; exited properties are listed under "Exited" and closed for purchase.
-- The same fields on property_sale_status apply to catalogue listings.

alter table public.properties add column if not exists strategy text;
alter table public.properties add column if not exists occupancy_status text;
alter table public.properties add column if not exists exited_at date;
alter table public.property_sale_status add column if not exists strategy text;
alter table public.property_sale_status add column if not exists occupancy_status text;
alter table public.property_sale_status add column if not exists exited_at date;

do $constraint$ begin
  if not exists (select 1 from pg_constraint where conname = 'properties_strategy_check' and conrelid = 'public.properties'::regclass) then
    alter table public.properties add constraint properties_strategy_check check (strategy is null or strategy in ('prime', 'capital_growth', 'high_yield'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'properties_occupancy_status_check' and conrelid = 'public.properties'::regclass) then
    alter table public.properties add constraint properties_occupancy_status_check check (occupancy_status is null or occupancy_status in ('rented', 'ready'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'property_sale_status_strategy_check' and conrelid = 'public.property_sale_status'::regclass) then
    alter table public.property_sale_status add constraint property_sale_status_strategy_check check (strategy is null or strategy in ('prime', 'capital_growth', 'high_yield'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'property_sale_status_occupancy_status_check' and conrelid = 'public.property_sale_status'::regclass) then
    alter table public.property_sale_status add constraint property_sale_status_occupancy_status_check check (occupancy_status is null or occupancy_status in ('rented', 'ready'));
  end if;
end $constraint$;

notify pgrst, 'reload schema';
