-- Run once in Supabase SQL Editor.
create table if not exists public.property_share_settings (
  property_slug text primary key,
  total_shares integer not null check (total_shares > 0),
  blocked_shares integer not null default 0 check (blocked_shares >= 0),
  projected_annual_return numeric(5, 2) not null default 9.00 check (projected_annual_return >= 8 and projected_annual_return <= 10),
  profit_active boolean not null default true,
  profit_start_date date,
  updated_at timestamptz not null default now(),
  constraint blocked_not_above_total check (blocked_shares <= total_shares)
);

alter table public.property_share_settings enable row level security;

drop policy if exists "Share availability is public" on public.property_share_settings;
create policy "Share availability is public"
on public.property_share_settings for select
to anon, authenticated
using (true);

-- Writes stay blocked for browser clients. The authenticated admin Server Action
-- writes with the configured service-role client.
