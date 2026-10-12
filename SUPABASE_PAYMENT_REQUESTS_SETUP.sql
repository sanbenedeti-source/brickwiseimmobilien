-- Brickwise payment requests setup
-- Run this in Supabase SQL Editor before using /admin/payments.

create table if not exists public.payment_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  customer_name text,
  customer_email text not null,
  property_id uuid references public.properties(id) on delete set null,
  title text not null,
  amount numeric(12, 2) not null check (amount > 0),
  currency text not null default 'EUR' check (currency = 'EUR'),
  method text not null default 'bank_transfer',
  crypto_asset text,
  crypto_network text,
  status text not null default 'draft',
  instructions text,
  payment_link text,
  proof_url text,
  admin_note text,
  created_by uuid references auth.users(id) on delete set null,
  verified_by uuid references auth.users(id) on delete set null,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payment_requests_method_check check (
    method in ('bank_transfer', 'crypto', 'wallet_credit')
  ),
  constraint payment_requests_crypto_details_check check (
    (method = 'crypto' and crypto_asset is not null and crypto_network is not null
      and length(trim(crypto_asset)) between 1 and 30 and length(trim(crypto_network)) between 1 and 60)
    or (method <> 'crypto' and crypto_asset is null and crypto_network is null)
  ),
  constraint payment_requests_status_check check (
    status in ('draft', 'sent', 'pending', 'paid', 'verified', 'failed', 'cancelled', 'refunded')
  )
);

create index if not exists payment_requests_user_id_idx
  on public.payment_requests(user_id);

create index if not exists payment_requests_customer_email_idx
  on public.payment_requests(lower(customer_email));

create index if not exists payment_requests_status_idx
  on public.payment_requests(status);

create or replace function public.set_payment_requests_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists payment_requests_set_updated_at on public.payment_requests;

create trigger payment_requests_set_updated_at
before update on public.payment_requests
for each row
execute function public.set_payment_requests_updated_at();

alter table public.payment_requests enable row level security;

drop policy if exists "Customers can read own payment requests" on public.payment_requests;
create policy "Customers can read own payment requests"
on public.payment_requests
for select
to authenticated
using (
  (select auth.uid()) = user_id
);

-- Admin writes are performed by the app after checking the trusted administrator role and using the service role key.
-- Keep client-side writes blocked by default.

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
