-- Apply after SUPABASE_PROPERTY_SHARE_SETTINGS.sql in the Supabase SQL Editor.
-- Must match the listing in app/lib/external-properties.ts:
-- EUR 265,250 / EUR 250 = 1,061 shares; 31 initially reserved = 1,030 available.
-- (The earlier EUR 100 x 1,161 allocation is obsolete; the purchase RPC enforces
-- this database total, so it must never exceed the listing total.)
-- Keep any existing reservations or purchases above the initial 31 shares.
-- Return components and EUR pricing are configured in the property listing;
-- this does not change wallet currency, profit settings, or a paused state.
insert into public.property_share_settings (property_slug, total_shares, blocked_shares)
values ('sal-rei-boa-vista-b1-residences-ap1', 1061, 31)
on conflict (property_slug) do update
set total_shares = excluded.total_shares,
    blocked_shares = greatest(public.property_share_settings.blocked_shares, excluded.blocked_shares),
    updated_at = now();
