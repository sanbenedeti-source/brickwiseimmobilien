-- Migration 026: investment fields for properties added in the admin panel (2026-10-26).
-- Admin-added properties can now be offered in the client panel like the catalogue listings:
-- monthly rent and stated costs give the net rental yield, the share price sets the share count,
-- and image_urls holds the gallery. A property is open for investment only when it is active and
-- has a monthly rent and a share price (checked in the application).

alter table public.properties add column if not exists monthly_rent numeric(14,2);
alter table public.properties add column if not exists monthly_expenses numeric(14,2) not null default 0;
alter table public.properties add column if not exists share_price numeric(14,2);
alter table public.properties add column if not exists image_urls text[] not null default '{}';
alter table public.properties add column if not exists construction_status text not null default 'completed';

do $constraint$ begin
  if not exists (select 1 from pg_constraint where conname = 'properties_monthly_rent_check' and conrelid = 'public.properties'::regclass) then
    alter table public.properties add constraint properties_monthly_rent_check check (monthly_rent is null or (monthly_rent >= 0 and monthly_rent <= 100000000));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'properties_monthly_expenses_check' and conrelid = 'public.properties'::regclass) then
    alter table public.properties add constraint properties_monthly_expenses_check check (monthly_expenses >= 0 and monthly_expenses <= 100000000);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'properties_share_price_check' and conrelid = 'public.properties'::regclass) then
    alter table public.properties add constraint properties_share_price_check check (share_price is null or (share_price > 0 and share_price <= 100000000));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'properties_image_urls_check' and conrelid = 'public.properties'::regclass) then
    alter table public.properties add constraint properties_image_urls_check check (cardinality(image_urls) <= 12);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'properties_construction_status_check' and conrelid = 'public.properties'::regclass) then
    alter table public.properties add constraint properties_construction_status_check check (construction_status in ('completed', 'under_construction'));
  end if;
end $constraint$;

notify pgrst, 'reload schema';
