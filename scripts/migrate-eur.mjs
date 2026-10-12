import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';

process.loadEnvFile('.env');
const mode = process.argv[2] || 'check';
assert.ok(['check', 'apply', 'verify'].includes(mode));
const ref = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split('.')[0];
const sql = readFileSync('SUPABASE_EUR_ONLY.sql', 'utf8');
const tests = readFileSync('scripts/tests/eur-wallet.sql', 'utf8');
const hash = createHash('sha256').update(sql + tests).digest('hex');
const directory = 'project-backups/eur-migration-2026-09-27';
mkdirSync(directory, { recursive: true });
async function query(query, readOnly = true) {
  const response = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST', headers: { authorization: `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`, 'content-type': 'application/json' },
    body: JSON.stringify({ query, read_only: readOnly }), signal: AbortSignal.timeout(45000),
  });
  if (!response.ok) throw new Error(`Database HTTP ${response.status}: ${(await response.text()).slice(0, 1600)}`);
  return response.json();
}
const tables = ['wallet_accounts','wallet_transactions','property_holdings','payment_requests','property_requests','property_share_settings'];
async function fingerprint() {
  return query(`select ${tables.map(t => `(select md5(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]'::jsonb)::text) from public.${t} t) as ${t}`).join(',')},
    (select md5(coalesce(string_agg(id::text,',' order by id),'')) from auth.users) as users`);
}
const before = await fingerprint();
if (mode === 'check') {
  console.log(JSON.stringify(await query(`begin; set local lock_timeout='5s'; set local statement_timeout='30s'; ${sql}\n${sql}\n${tests}\nrollback;`, false)));
  assert.deepEqual(await fingerprint(), before, 'Rollback must leave all data unchanged');
  writeFileSync(`${directory}/checked.json`, JSON.stringify({ hash, checkedAt: new Date().toISOString() }));
  console.log('EUR migration and repeat application passed; all test data rolled back.');
}
if (mode === 'apply') {
  assert.equal(JSON.parse(readFileSync(`${directory}/checked.json`, 'utf8')).hash, hash, 'Run check for this exact migration first');
  await query(`begin; set local lock_timeout='5s'; set local statement_timeout='30s'; ${sql}\ncommit;`, false);
  const after = await fingerprint();
  // The migration intentionally aligns Sal Rei supply with its existing EUR listing.
  const financialState = rows => rows.map(row => Object.fromEntries(Object.entries(row).filter(([key]) => key !== 'property_share_settings')));
  assert.deepEqual(financialState(after), financialState(before), 'Currency migration must not change financial records or users');
  writeFileSync(`${directory}/applied.json`, JSON.stringify({ hash, appliedAt: new Date().toISOString() }));
  console.log('EUR-only migration committed; financial records and users unchanged.');
}
if (mode !== 'check') {
  const [state] = await query(`select
    (select count(*) from pg_constraint where connamespace='public'::regnamespace and conname in ('wallet_accounts_currency_check','wallet_transactions_currency_check','property_holdings_currency_check','payment_requests_currency_check') and pg_get_constraintdef(oid) like '%EUR%') as eur_constraints,
    (select count(*) from pg_proc where pronamespace='public'::regnamespace and prosrc like '%CAD%') as cad_functions,
    (select count(*) from information_schema.columns where table_schema='public' and column_name='currency' and column_default = '''EUR''::text') as eur_defaults,
    (select count(*) from auth.users where raw_app_meta_data->>'role'='admin') as admins,
    (select count(*) from auth.users where raw_app_meta_data->>'role' is distinct from 'admin') as customers,
    (select count(*) from public.wallet_accounts) as wallets,
    (select count(*) from public.property_requests) as requests,
    (select count(*) from public.wallet_transactions) as transactions,
    (select count(*) from public.property_holdings) as holdings,
    (select count(*) from public.payment_requests) as payments,
    (select total_shares from public.property_share_settings where property_slug='sal-rei-boa-vista-b1-residences-ap1') as sal_rei_total,
    (select blocked_shares from public.property_share_settings where property_slug='sal-rei-boa-vista-b1-residences-ap1') as sal_rei_blocked`);
  assert.equal(state.eur_constraints, 4);
  assert.equal(state.eur_defaults, 4);
  assert.equal(state.cad_functions, 0);
  assert.equal(state.sal_rei_total, 1161);
  assert.ok(state.sal_rei_blocked >= 31 && state.sal_rei_blocked <= 1161);
  console.log(JSON.stringify(state));
}
