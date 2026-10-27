import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
process.loadEnvFile('.env');
const mode=process.argv[2]||'check'; assert.ok(['check','apply','verify'].includes(mode));
const sql=readFileSync('SUPABASE_DEPOSIT_REVIEW_GUARD.sql','utf8');
const hash=createHash('sha256').update(sql).digest('hex');
const version='017_deposit_review_guard';
const dir='project-backups/security-fix-17-deposit-review-guard';mkdirSync(dir,{recursive:true});
const ref=new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split('.')[0];
async function query(query,read_only=true){const r=await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`,{method:'POST',headers:{Authorization:'Bearer '+process.env.SUPABASE_ACCESS_TOKEN,'Content-Type':'application/json'},body:JSON.stringify({query,read_only}),signal:AbortSignal.timeout(45000)});if(!r.ok)throw Error(await r.text());return r.json();}
const tables=['properties','property_translations','property_share_settings','company_payment_methods','property_requests','payment_requests','payment_refunds','deposit_submissions','wallet_accounts','wallet_transactions','property_holdings','admin_audit_logs'];
const fingerprint=()=>query(`select ${tables.map(t=>`(select md5(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]'::jsonb)::text) from public.${t} t) as ${t}`).join(',')},(select md5(coalesce(string_agg(id::text,',' order by id),'')) from auth.users) as users`);
const [authTriggers]=await query("select count(*)::integer as count from pg_trigger where tgrelid='auth.users'::regclass and not tgisinternal");
assert.equal(authTriggers.count,0,'Review custom auth.users triggers before running rollback-only account fixtures.');
const before=await fingerprint();
const tests=readFileSync('scripts/tests/deposit-review-guard.sql','utf8');
if(mode==='check'||mode==='verify'){
 // check: install twice (idempotent) and test inside a transaction that is always rolled back.
 await query('begin; set local lock_timeout=\'5s\';'+(mode==='check'?sql+'\n'+sql:'')+'\n'+tests+'\nrollback;',false);
 assert.deepEqual(await fingerprint(),before);
 if(mode==='verify'){const [row]=await query(`select checksum from brickwise_schema_migrations where version='${version}'`);assert.equal(row?.checksum,hash,'Installed migration checksum mismatch.');}
 if(mode==='check')writeFileSync(dir+'/checked.json',JSON.stringify({hash,before}));
 console.log('PASS: deposit review guard assertions; fixtures rolled back, data unchanged.');
}else{
 assert.equal(JSON.parse(readFileSync(dir+'/checked.json','utf8')).hash,hash,'Run check first.');
 writeFileSync(dir+'/before.json',JSON.stringify({before}));
 await query(`begin; set local lock_timeout='5s'; select pg_advisory_xact_lock(hashtextextended('brickwise-wallet-migrations',0));
 do $v$ begin if exists(select 1 from brickwise_schema_migrations where version='${version}' and checksum<>'${hash}') then raise exception 'Deposit guard migration checksum mismatch'; end if; end $v$;
 ${sql}
 insert into brickwise_schema_migrations(version,checksum,mode) values('${version}','${hash}','applied') on conflict(version) do nothing; commit;`,false);
 assert.deepEqual(await fingerprint(),before);
 console.log('Applied deposit review guard; existing data unchanged.');
}
