import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const mode=process.argv[2]||'check';
const version='016_share_availability_guard';
const directory=path.join(root,'project-backups/security-fixes-01-02-2026-10-02/migration');
const hash=value=>createHash('sha256').update(value).digest('hex');
const literal=value=>"'"+String(value).replaceAll("'","''")+"'";
const tables=['auth.users','public.properties','public.property_translations','public.property_share_settings',
  'public.wallet_accounts','public.wallet_transactions','public.property_holdings','public.property_requests',
  'public.payment_requests','public.payment_refunds','public.deposit_submissions','public.admin_audit_logs',
  'public.company_payment_methods','public.client_agreement_acceptances'];

async function main() {
  assert.ok(['check','apply','verify'].includes(mode),'Use check, apply or verify.');
  process.loadEnvFile(path.join(root,'.env'));
  const ref=new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split('.')[0];
  assert.match(ref,/^[a-z0-9]+$/);
  assert.ok(process.env.SUPABASE_ACCESS_TOKEN,'Management API token required.');
  mkdirSync(directory,{recursive:true});
  const save=(name,data)=>writeFileSync(path.join(directory,name+'.json'),JSON.stringify(data,null,2)+'\n');
  async function query(sql,readOnly=true) {
    const response=await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`,{
      method:'POST',headers:{authorization:`Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`,'content-type':'application/json'},
      body:JSON.stringify({query:sql,read_only:readOnly}),signal:AbortSignal.timeout(45000),
    });
    if(!response.ok) {
      const body=await response.text();
      const state=body.match(/ERROR:\s+([A-Z0-9]{5}):/)?.[1];
      const code=body.match(/\b(?:share_settings_[a-z_]+|share_test_[a-z_]+|fixture_share_audit_failure|SHARE_MIGRATION_CHECKSUM_MISMATCH)\b/)?.[0];
      throw new Error(`Share availability database check failed: HTTP ${response.status}${state?'; SQLSTATE '+state:''}${code?'; '+code:''}; response suppressed.`);
    }
    return response.json();
  }
  const migration=readFileSync(path.join(root,'SUPABASE_SHARE_AVAILABILITY_GUARD.sql'),'utf8');
  const tests=readFileSync(path.join(root,'scripts/tests/share-availability.sql'),'utf8');
  assert.doesNotMatch(migration+'\n'+tests,/^\s*(?:begin|commit|rollback)\s*;/im,'SQL must not control the outer transaction.');
  const migrationHash=hash(migration),testsHash=hash(tests);
  const transaction="begin; set local lock_timeout='5s'; set local statement_timeout='35s'; select pg_advisory_xact_lock(hashtextextended('brickwise-wallet-migrations',0));";
  const guard=`do $guard$ begin
    if exists(select 1 from public.brickwise_schema_migrations where version=${literal(version)} and checksum<>${literal(migrationHash)}) then
      raise exception 'SHARE_MIGRATION_CHECKSUM_MISMATCH';
    end if; end $guard$;`;

  async function recordSnapshot() {
    const [value]=await query(`select ${tables.map(table=>{
      const row=table==='public.property_share_settings'?"(to_jsonb(t)-'availability_version')":'to_jsonb(t)';
      return `(select md5(coalesce(jsonb_agg(${row} order by ${row}::text),'[]'::jsonb)::text) from ${table} t) as ${table.split('.')[1]}`;
    }).join(',')}`);
    return value;
  }
  async function catalogSnapshot() {
    return query(`select
      (select jsonb_agg(jsonb_build_object('column',attname,'type',format_type(atttypid,atttypmod),'default',pg_get_expr(d.adbin,d.adrelid),'acl',attacl) order by attnum)
       from pg_attribute a left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum
       where a.attrelid='public.property_share_settings'::regclass and a.attnum>0 and not a.attisdropped) as columns,
      (select jsonb_agg(jsonb_build_object('name',p.proname,'definition',pg_get_functiondef(p.oid),'acl',p.proacl) order by p.proname)
       from pg_proc p where p.pronamespace='public'::regnamespace and p.proname in ('guard_share_availability','update_share_settings_atomic')) as functions,
      (select jsonb_agg(pg_get_triggerdef(oid) order by tgname) from pg_trigger
       where tgrelid='public.property_share_settings'::regclass and not tgisinternal) as triggers`);
  }
  async function verifyCatalog() {
    const [installed]=await query(`select checksum from public.brickwise_schema_migrations where version=${literal(version)}`);
    assert.equal(installed?.checksum,migrationHash,'Installed migration checksum mismatch.');
    const [details]=await query(`select
      exists(select 1 from pg_attribute where attrelid='public.property_share_settings'::regclass and attname='availability_version' and attnotnull and not attisdropped) as revision,
      exists(select 1 from pg_trigger where tgrelid='public.property_share_settings'::regclass and tgname='protect_share_availability' and tgenabled='O') as guard`);
    assert.ok(details.revision&&details.guard,'Availability guard/revision missing.');
  }

  const [authTriggers]=await query(`select count(*)::integer as count from pg_trigger where tgrelid='auth.users'::regclass and not tgisinternal`);
  assert.equal(authTriggers.count,0,'Review custom account triggers before synthetic fixtures.');
  const before=await recordSnapshot();
  if(mode==='check'||mode==='verify') {
    const catalogBefore=await catalogSnapshot();
    if(mode==='verify') await verifyCatalog();
    await query(`${transaction}\n${guard}\n${mode==='check'?migration+'\n'+migration:''}\n${tests}\nrollback;`,false);
    assert.deepEqual(await recordSnapshot(),before,'Existing records changed after rollback.');
    assert.deepEqual(await catalogSnapshot(),catalogBefore,'Schema changed after rollback.');
    save(mode==='check'?'checked':'verified',{checkedAt:new Date().toISOString(),migrationHash,testsHash,passed:true,rollbackVerified:true,
      assertions:['stale purchase revision rejected','legacy generic overwrite rejected','owned/opening allocations protected',
        'intentional current reservation decrease accepted','purchase after admin preserves reservations','profit metadata preserved',
        'audit failure rolls back availability','missing/create race rejected','untrusted actor and client RPC denied']});
    console.log(`PASS: ${mode}; availability revisions, stale edits, owned/opening floors, legacy bypass, purchase ordering, audit atomicity and permissions; all fixtures rolled back.`);
  } else {
    const checked=JSON.parse(readFileSync(path.join(directory,'checked.json'),'utf8'));
    assert.equal(checked.migrationHash,migrationHash,'Run check after migration edits.');
    assert.equal(checked.testsHash,testsHash,'Run check after test edits.');
    assert.ok(checked.passed&&checked.rollbackVerified);
    save('before',{checkedAt:new Date().toISOString(),catalog:await catalogSnapshot(),recordHashes:before});
    await query(`${transaction}\n${guard}\n${migration}\ninsert into public.brickwise_schema_migrations(version,checksum,mode)
      values(${literal(version)},${literal(migrationHash)},'applied') on conflict(version) do nothing; commit;`,false);
    await verifyCatalog();
    assert.deepEqual(await recordSnapshot(),before,'Existing business records changed during migration.');
    save('applied',{appliedAt:new Date().toISOString(),version,migrationHash,testsHash,existingBusinessRecordsUnchanged:true});
    console.log('PASS: availability guard applied; existing balances, holdings, reservations, orders and audit history unchanged.');
  }
}
main().catch(error=>{console.error(error.code==='ERR_ASSERTION'?error.message.split('\n')[0]:error.message);process.exitCode=1;});
