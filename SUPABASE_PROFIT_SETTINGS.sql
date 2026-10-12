alter table public.property_share_settings
  add column if not exists projected_annual_return numeric(5, 2) not null default 9.00,
  add column if not exists profit_active boolean not null default true,
  add column if not exists profit_start_date date;

alter table public.property_share_settings
  drop constraint if exists property_share_settings_return_range;

alter table public.property_share_settings
  add constraint property_share_settings_return_range
  check (projected_annual_return >= 8 and projected_annual_return <= 10);

update public.property_share_settings
set profit_start_date = coalesce(profit_start_date, current_date);
