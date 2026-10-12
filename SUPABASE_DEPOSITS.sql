create table if not exists public.deposit_submissions (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id),
 method_id uuid not null references public.company_payment_methods(id),
 destination jsonb not null,
 customer_email text not null, customer_name text,
 requested_eur numeric(14,2) not null check(requested_eur>0 and requested_eur<=10000000),
 crypto_quantity numeric(36,18),
 transfer_reference text not null check(length(trim(transfer_reference)) between 4 and 200),
 client_key uuid not null,
 status text not null default 'pending' check(status in ('pending','verified','rejected')),
 credited_eur numeric(14,2),
 settlement_reference text,
 review_note text,
 reviewed_by uuid references auth.users(id), reviewed_at timestamptz,
 transaction_id uuid references public.wallet_transactions(id),
 created_at timestamptz not null default now(),
 unique(user_id,client_key),
 check(status<>'verified' or (credited_eur>0 and transaction_id is not null and settlement_reference is not null)),
 check(crypto_quantity is null or (crypto_quantity>0 and crypto_quantity<100000000000000000))
);
create unique index if not exists deposit_settlement_unique on public.deposit_submissions(lower(settlement_reference)) where status='verified';
create unique index if not exists deposit_crypto_tx_unique on public.deposit_submissions(lower(destination->>'crypto_network'),lower(transfer_reference)) where destination->>'kind'='crypto' and status<>'rejected';
alter table public.deposit_submissions enable row level security;
revoke all on public.deposit_submissions from public,anon,authenticated;
grant select on public.deposit_submissions to authenticated;
grant all on public.deposit_submissions to service_role;
drop policy if exists "Read own deposits or admin" on public.deposit_submissions;
create policy "Read own deposits or admin" on public.deposit_submissions for select to authenticated using(user_id=auth.uid() or auth.jwt()->'app_metadata'->>'role'='admin');

create or replace function public.submit_deposit(p_method_id uuid,p_amount numeric,p_quantity numeric,p_reference text,p_client_key uuid,p_destination jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare m company_payment_methods; result uuid;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 if p_amount is null or p_amount<>round(p_amount,2) or p_amount<=0 or p_amount>10000000 or p_amount::text in ('NaN','Infinity','-Infinity') then raise exception 'Invalid amount'; end if;
 if p_reference is null or length(trim(p_reference)) not between 4 and 200 or p_client_key is null then raise exception 'Transfer reference required'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
 select id into result from deposit_submissions where user_id=auth.uid() and client_key=p_client_key;
 if found then return result; end if;
 if (select count(*) from deposit_submissions where user_id=auth.uid() and status='pending')>=10 then raise exception 'Too many pending deposits'; end if;
 select * into m from company_payment_methods where id=p_method_id and active for share;
 if not found then raise exception 'Payment method unavailable'; end if;
 if p_destination is null or (to_jsonb(m) - 'created_at' - 'updated_at') <> p_destination then raise exception 'Payment details changed; refresh before submitting'; end if;
 if m.kind='crypto' and (p_quantity is null or p_quantity<=0 or p_quantity>=100000000000000000 or p_quantity::text in ('NaN','Infinity','-Infinity') or trim(p_reference)!~'^[A-Za-z0-9]{20,200}$') then raise exception 'Invalid crypto transfer'; end if;
 insert into deposit_submissions(user_id,method_id,destination,customer_email,customer_name,requested_eur,crypto_quantity,transfer_reference,client_key)
 values(auth.uid(),m.id,to_jsonb(m),(select email from auth.users where id=auth.uid()),(select raw_user_meta_data->>'full_name' from auth.users where id=auth.uid()),p_amount,case when m.kind='crypto' then p_quantity else null end,trim(p_reference),p_client_key) returning id into result;
 return result;
end $$;

create or replace function public.review_deposit(p_id uuid,p_approve boolean,p_eur numeric,p_settlement text,p_note text)
returns uuid language plpgsql security definer set search_path=public as $$
declare d deposit_submissions; tx uuid; customer_email text; customer_name text;
begin
 if auth.uid() is null or coalesce(auth.jwt()->'app_metadata'->>'role','')<>'admin' then raise exception 'Admin required'; end if;
 if p_approve is null then raise exception 'Decision required'; end if;
 select * into d from deposit_submissions where id=p_id for update;
 if not found then raise exception 'Deposit not found'; end if;
 if d.status<>'pending' then return d.transaction_id; end if;
 if p_note is null or length(trim(p_note)) not between 3 and 1000 then raise exception 'Review note required'; end if;
 if p_approve then
  if p_eur is null or p_eur<=0 or p_eur>10000000 or p_eur<>round(p_eur,2) or p_eur::text in ('NaN','Infinity','-Infinity') or p_settlement is null or length(trim(p_settlement)) not between 4 and 200 then raise exception 'Confirmed amount and settlement reference required'; end if;
  select email,raw_user_meta_data->>'full_name' into customer_email,customer_name from auth.users where id=d.user_id;
  tx:=public.credit_wallet_atomic(d.user_id,p_eur,'EUR',auth.uid(),customer_email,customer_name,'deposit:'||d.id::text);
  update deposit_submissions set status='verified',credited_eur=p_eur,settlement_reference=trim(p_settlement),transaction_id=tx,review_note=trim(p_note),reviewed_by=auth.uid(),reviewed_at=now() where id=d.id;
 else
  update deposit_submissions set status='rejected',review_note=trim(p_note),reviewed_by=auth.uid(),reviewed_at=now() where id=d.id;
 end if;
 return tx;
end $$;
revoke all on function public.submit_deposit(uuid,numeric,numeric,text,uuid,jsonb) from public,anon;
revoke all on function public.review_deposit(uuid,boolean,numeric,text,text) from public,anon;
grant execute on function public.submit_deposit(uuid,numeric,numeric,text,uuid,jsonb) to authenticated;
grant execute on function public.review_deposit(uuid,boolean,numeric,text,text) to authenticated;
