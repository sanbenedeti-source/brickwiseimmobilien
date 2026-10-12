create table if not exists public.company_payment_methods (
 id uuid primary key default gen_random_uuid(),
 kind text not null check(kind in ('bank','crypto')),
 bank_slot smallint unique check(bank_slot in (1,2)),
 label text not null check(length(trim(label)) between 1 and 100),
 active boolean not null default false,
 currency text not null default 'EUR' check(currency='EUR'),
 bank_name text, beneficiary text, account_number text, bic text, bank_address text,
 crypto_asset text, crypto_network text, wallet_address text,
 instructions text check(instructions is null or length(instructions)<=2000),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 constraint company_payment_method_fields check (
  (kind='bank' and bank_slot is not null and bank_name is not null and length(trim(bank_name)) between 1 and 150 and beneficiary is not null and length(trim(beneficiary)) between 1 and 150 and account_number is not null and length(trim(account_number)) between 1 and 80 and crypto_asset is null and crypto_network is null and wallet_address is null)
  or (kind='crypto' and bank_slot is null and bank_name is null and beneficiary is null and account_number is null and bic is null and bank_address is null and crypto_asset is not null and length(trim(crypto_asset)) between 1 and 30 and crypto_network is not null and length(trim(crypto_network)) between 1 and 60 and wallet_address is not null and length(trim(wallet_address)) between 1 and 200)
 )
);
create unique index if not exists company_wallet_destination_unique on public.company_payment_methods(crypto_asset,crypto_network,wallet_address) where kind='crypto';
alter table public.company_payment_methods enable row level security;
revoke all on public.company_payment_methods from public,anon,authenticated;
grant select on public.company_payment_methods to authenticated;
grant all on public.company_payment_methods to service_role;
drop policy if exists "Clients read active company payment methods" on public.company_payment_methods;
create policy "Clients read active company payment methods" on public.company_payment_methods for select to authenticated using (auth.uid() is not null and (active or auth.jwt()->'app_metadata'->>'role'='admin'));
-- Preserve the exact receiving wallets already published to signed-in clients.
-- Fixed IDs prevent reruns from overwriting edits or reactivating hidden entries.
insert into public.company_payment_methods(id,kind,label,active,crypto_asset,crypto_network,wallet_address) values
('ac000000-0000-4000-8000-000000000001','crypto','BTC / Bitcoin',true,'BTC','Bitcoin','bc1qr6n6gnneejul6l6y0j7a26yzjpuqcaaxx256qf'),
('ac000000-0000-4000-8000-000000000002','crypto','ETH / Ethereum',true,'ETH','Ethereum','0xD16b560431093537a5FbE2cDe8cD1725c377De4f'),
('ac000000-0000-4000-8000-000000000003','crypto','USDT / TRON (TRC20)',true,'USDT','TRON (TRC20)','TYQCRrhtAkptYEwz1BC7158VwMHvu4iH7A'),
('ac000000-0000-4000-8000-000000000004','crypto','USDT / Ethereum (ERC20)',true,'USDT','Ethereum (ERC20)','0xD16b560431093537a5FbE2cDe8cD1725c377De4f'),
('ac000000-0000-4000-8000-000000000005','crypto','USDC / Solana',true,'USDC','Solana','AS27a9U8ztZEDJDHJG74DX68A6SYP8aien5yADBmp3Pi'),
('ac000000-0000-4000-8000-000000000006','crypto','USDC / Ethereum (ERC20)',true,'USDC','Ethereum (ERC20)','0xD16b560431093537a5FbE2cDe8cD1725c377De4f')
on conflict(id) do nothing;
