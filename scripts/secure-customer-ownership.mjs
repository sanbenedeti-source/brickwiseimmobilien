import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
process.loadEnvFile('.env');
const mode=process.argv[2]||'check'; assert.ok(['check','apply','verify'].includes(mode));
const sql=readFileSync('SUPABASE_CUSTOMER_OWNERSHIP.sql','utf8');
const hash=createHash('sha256').update(sql).digest('hex');
const dir='project-backups/security-fix-13';mkdirSync(dir,{recursive:true});
const ref=new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split('.')[0];
async function query(query,read_only=true){const r=await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`,{method:'POST',headers:{Authorization:'Bearer '+process.env.SUPABASE_ACCESS_TOKEN,'Content-Type':'application/json'},body:JSON.stringify({query,read_only}),signal:AbortSignal.timeout(45000)});if(!r.ok)throw Error(await r.text());return r.json();}
const tables=['property_requests','payment_requests','payment_refunds','deposit_submissions','wallet_accounts','wallet_transactions','property_holdings','admin_audit_logs'];
const fingerprint=()=>query(`select ${tables.map(t=>`(select md5(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]'::jsonb)::text) from public.${t} t) as ${t}`).join(',')},(select md5(coalesce(string_agg(id::text,',' order by id),'')) from auth.users) as users`);
const before=await fingerprint();
const tests=readFileSync('scripts/tests/customer-ownership.sql','utf8');
if(mode==='check'||mode==='verify'){
 await query('begin; set local lock_timeout=\'5s\';'+(mode==='check'?sql+'\n'+sql:'')+'\n'+tests+'\nrollback;',false);
 assert.deepEqual(await fingerprint(),before);
 if(mode==='check')writeFileSync(dir+'/checked.json',JSON.stringify({hash,before}));
 console.log('PASS: ownership isolation, email change/reuse, unlinked records, spoofed admin, trusted admin and private payment columns. Fixtures rolled back; data unchanged.');
}else{
 assert.equal(JSON.parse(readFileSync(dir+'/checked.json','utf8')).hash,hash);
 const acl=await query("select relacl,(select jsonb_agg(jsonb_build_object('column',attname,'acl',attacl)) from pg_attribute where attrelid=c.oid and attnum>0 and not attisdropped) as columns from pg_class c where oid='public.payment_requests'::regclass");
 writeFileSync(dir+'/before.json',JSON.stringify({acl,before}));
 await query(`begin; set local lock_timeout='5s'; select pg_advisory_xact_lock(hashtextextended('brickwise-wallet-migrations',0));
 do $v$ begin if exists(select 1 from brickwise_schema_migrations where version='013_customer_ownership' and checksum<>'${hash}') then raise exception 'Privacy migration checksum mismatch'; end if; end $v$;
 ${sql}
 insert into brickwise_schema_migrations(version,checksum,mode) values('013_customer_ownership','${hash}','applied') on conflict(version) do nothing; commit;`,false);
 assert.deepEqual(await fingerprint(),before);
 console.log('Applied customer ownership policies; existing data unchanged.');
}
