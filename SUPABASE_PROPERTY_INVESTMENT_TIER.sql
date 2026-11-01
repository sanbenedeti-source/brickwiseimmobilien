-- Migration 030: investment tiers for properties (2026-11-01).
-- standard = minimum €2,000, premium = minimum €20,000, super_premium = minimum €50,000.
-- The application enforces the minimum from the tier; existing properties stay standard.

alter table public.properties add column if not exists investment_tier text not null default 'standard';
alter table public.property_sale_status add column if not exists investment_tier text not null default 'standard';

do $constraint$ begin
  if not exists (select 1 from pg_constraint where conname = 'properties_investment_tier_check' and conrelid = 'public.properties'::regclass) then
    alter table public.properties add constraint properties_investment_tier_check check (investment_tier in ('standard', 'premium', 'super_premium'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'property_sale_status_investment_tier_check' and conrelid = 'public.property_sale_status'::regclass) then
    alter table public.property_sale_status add constraint property_sale_status_investment_tier_check check (investment_tier in ('standard', 'premium', 'super_premium'));
  end if;
end $constraint$;

notify pgrst, 'reload schema';
