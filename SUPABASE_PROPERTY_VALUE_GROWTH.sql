-- Migration 029: projected value growth for admin-added properties (2026-10-27).
-- monthly_value_growth is the owner's estimate of the property's monthly increase in value (EUR).
-- It is shown next to the rental yield as a separate projection and is never paid out monthly.

alter table public.properties add column if not exists monthly_value_growth numeric(14,2);

do $constraint$ begin
  if not exists (select 1 from pg_constraint where conname = 'properties_monthly_value_growth_check' and conrelid = 'public.properties'::regclass) then
    alter table public.properties add constraint properties_monthly_value_growth_check check (monthly_value_growth is null or (monthly_value_growth >= 0 and monthly_value_growth <= 100000000));
  end if;
end $constraint$;

notify pgrst, 'reload schema';
