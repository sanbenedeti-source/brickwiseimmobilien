-- Client payment reads use an explicit allowlist; new columns stay private.
-- Admin operations use the server-only service role after authorization.
revoke all privileges on public.payment_requests from public, anon, authenticated;
do $columns$
declare cols text;
begin
  select string_agg(quote_ident(attname), ', ' order by attnum) into cols
  from pg_attribute where attrelid='public.payment_requests'::regclass
    and attnum>0 and not attisdropped;
  execute format('revoke select (%s) on public.payment_requests from public, anon, authenticated', cols);
end $columns$;
grant select (
  id, user_id, customer_name, customer_email, property_id, title, amount,
  currency, method, crypto_asset, crypto_network, status, instructions,
  payment_link, proof_url, verified_at, created_at, updated_at
) on public.payment_requests to authenticated;
grant all privileges on public.payment_requests to service_role;
notify pgrst, 'reload schema';
