import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

// Tests use synthetic accounts and listings in one transaction, always rolled back.
process.loadEnvFile('.env');
const project = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split('.')[0];
assert.match(project, /^[a-z0-9]+$/);
assert.ok(process.env.SUPABASE_ACCESS_TOKEN, 'Management API token is required.');
async function query(sql, readOnly = true) {
  const response = await fetch(`https://api.supabase.com/v1/projects/${project}/database/query`, {
    method: 'POST', headers: { authorization: `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`, 'content-type': 'application/json' },
    body: JSON.stringify({ query: sql, read_only: readOnly }), signal: AbortSignal.timeout(45000),
  });
  if (!response.ok) {
    const body = await response.text();
    const sqlState = body.match(/ERROR:\s+([A-Z0-9]{5}):/)?.[1];
    const knownFailure = ['Foreign wallet currency accepted', 'Wrong EUR wallet balance', 'Wrong EUR holdings',
      'Wrong EUR funding record', 'Wrong EUR transaction count', 'Wrong share allocation', 'Missing completed purchase',
      'Overspending accepted', 'Ledger lost immutability', 'Foreign payment currency accepted', 'Wallet privileges changed',
      'Duplicate purchase intent was not rejected', 'Duplicate purchase changed balance, order, holdings or stock',
      'Overselling was not rejected', 'Failed stock check changed the wallet or orders', 'Wallet purchase RPC must be service-only',
      'invalid wallet credit', 'permission denied', 'Trusted credit actor required'].find(value => body.includes(value));
    throw new Error(`Wallet database audit failed (HTTP ${response.status}${sqlState ? `; SQLSTATE ${sqlState}` : ''}${knownFailure ? `; ${knownFailure}` : ''}); response suppressed.`);
  }
  return response.json();
}

const tables = ['auth.users', 'public.wallet_accounts', 'public.wallet_transactions', 'public.property_holdings',
  'public.payment_requests', 'public.property_requests', 'public.property_share_settings', 'public.admin_audit_logs'];
const snapshotSql = `select ${tables.map(table => `(select md5(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]'::jsonb)::text) from ${table} t) as ${table.split('.')[1]}`).join(',')}`;
const replayTests = `
do $purchase_test$
declare
  fixture_user uuid := gen_random_uuid();
  fixture_actor uuid := gen_random_uuid();
  fixture_slug text := 'buy-now-test-' || gen_random_uuid()::text;
  operation_key text := 'buy-now:' || gen_random_uuid()::text;
  failed boolean;
begin
  insert into auth.users(id,email,raw_app_meta_data,raw_user_meta_data)
    values(fixture_user,fixture_user::text || '@example.invalid','{}','{}');
  insert into auth.users(id,email,raw_app_meta_data,raw_user_meta_data)
    values(fixture_actor,fixture_actor::text || '@example.invalid','{"role":"admin"}','{}');
  insert into public.property_share_settings(property_slug,total_shares,blocked_shares)
    values(fixture_slug,10,0);
  perform public.credit_wallet_atomic(fixture_user,6000,'EUR',fixture_actor,'fixture@example.invalid','Fixture','credit:' || operation_key);
  perform public.purchase_shares_with_wallet_atomic(fixture_user,fixture_slug,'Fixture',2,1000,'Fixture','fixture@example.invalid','','Buy now fixture',operation_key);

  -- A repeated intent cannot create a second debit or a second completed order.
  failed := false;
  begin
    perform public.purchase_shares_with_wallet_atomic(fixture_user,fixture_slug,'Fixture',2,1000,'Fixture','fixture@example.invalid','','Buy now fixture',operation_key);
  exception when unique_violation then failed := true;
  end;
  if not failed then raise exception 'Duplicate purchase intent was not rejected'; end if;
  if (select balance from public.wallet_accounts where user_id=fixture_user) <> 4000
    or (select count(*) from public.wallet_transactions where user_id=fixture_user and type='purchase') <> 1
    or (select count(*) from public.property_requests where user_id=fixture_user) <> 1
    or (select shares from public.property_holdings where user_id=fixture_user and property_slug=fixture_slug) <> 2
    or (select blocked_shares from public.property_share_settings where property_slug=fixture_slug) <> 2
    then raise exception 'Duplicate purchase changed balance, order, holdings or stock'; end if;

  update public.property_share_settings set blocked_shares=9 where property_slug=fixture_slug;
  failed := false;
  begin
    perform public.purchase_shares_with_wallet_atomic(fixture_user,fixture_slug,'Fixture',2,1000,'Fixture','fixture@example.invalid','','Buy now fixture',operation_key || ':sold-out');
  exception when others then
    if sqlerrm <> 'insufficient_shares' then raise; end if;
    failed := true;
  end;
  if not failed then raise exception 'Overselling was not rejected'; end if;
  if (select balance from public.wallet_accounts where user_id=fixture_user) <> 4000
    or (select count(*) from public.wallet_transactions where user_id=fixture_user and type='purchase') <> 1
    or (select count(*) from public.property_requests where user_id=fixture_user) <> 1
    then raise exception 'Failed stock check changed the wallet or orders'; end if;

  if has_function_privilege('authenticated','public.purchase_shares_with_wallet_atomic(uuid,text,text,integer,numeric,text,text,text,text,text)','EXECUTE')
    or not has_function_privilege('service_role','public.purchase_shares_with_wallet_atomic(uuid,text,text,integer,numeric,text,text,text,text,text)','EXECUTE')
    then raise exception 'Wallet purchase RPC must be service-only'; end if;
end $purchase_test$;
`;

async function main() {
  const [triggers] = await query("select count(*)::integer as count from pg_trigger where tgrelid='auth.users'::regclass and not tgisinternal");
  assert.equal(triggers.count, 0, 'Review auth triggers before running synthetic rollback fixtures.');
  const before = await query(snapshotSql);
  const existingTests = readFileSync('scripts/tests/eur-wallet.sql','utf8');
  assert.doesNotMatch(existingTests + replayTests, /^\s*(?:begin|commit|rollback)\s*;/im);
  await query(`begin; set local lock_timeout='5s'; set local statement_timeout='35s'; ${existingTests}\n${replayTests}\nrollback;`, false);
  assert.deepEqual(await query(snapshotSql), before, 'Database snapshot changed after rollback.');
  const directory = 'project-backups/wallet-buy-now-2026-10-02';
  mkdirSync(directory, { recursive: true });
  writeFileSync(`${directory}/database-verification.json`, JSON.stringify({
    passed: true, checkedAt: new Date().toISOString(), rollbackVerified: true,
    assertions: ['Admin credit is spendable in EUR', 'Purchase debits balance and updates holdings, stock and completed order',
      'Duplicate intent cannot debit twice', 'Insufficient funds and stock cannot debit', 'Ledger immutable and service-only RPC',
      'Existing customer, wallet, order, holding and audit rows unchanged'],
  }, null, 2) + '\n');
  console.log('PASS: admin credits, purchase balance/holdings/stock/order, duplicate protection, insufficient funds/stock and rollback; existing records unchanged.');
}
main().catch(error => {
  console.error(error.code === 'ERR_ASSERTION' ? error.message.split('\n')[0] : error.message);
  process.exitCode = 1;
});
