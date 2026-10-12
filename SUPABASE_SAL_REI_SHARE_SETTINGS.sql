-- Apply after SUPABASE_PROPERTY_SHARE_SETTINGS.sql in the Supabase SQL Editor.
-- EUR 116,100 / EUR 100 = 1,161 shares; 31 initially reserved = 1,130 available.
-- Keep any existing reservations or purchases above the initial 31 shares.
-- Return components and EUR pricing are configured in the property listing;
-- this does not change wallet currency, profit settings, or a paused state.
insert into public.property_share_settings (property_slug, total_shares, blocked_shares)
values ('sal-rei-boa-vista-b1-residences-ap1', 1161, 31)
on conflict (property_slug) do update
set total_shares = excluded.total_shares,
    blocked_shares = greatest(public.property_share_settings.blocked_shares, excluded.blocked_shares),
    updated_at = now();
