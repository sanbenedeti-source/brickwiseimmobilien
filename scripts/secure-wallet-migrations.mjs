import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
process.loadEnvFile('.env');
const mode=process.argv[2]||'check';assert.ok(['check','apply','verify'].includes(mode));
const manifest=JSON.parse(readFileSync('scripts/wallet-migration-manifest.json','utf8'));
const files=manifest.map(m=>readFileSync(m.file,'utf8'));
for(const [index,m] of manifest.entries()) {
 const source=files[index];
 const start=source.indexOf('\n',source.indexOf("raise exception 'Untracked initialized wallet"));
 const bodyStart=source.indexOf('\n',source.indexOf(' end if;',start))+1;
 const bodyEnd=source.lastIndexOf('\n insert into public.brickwise_schema_migrations');
 const body=source.slice(bodyStart,bodyEnd);
 assert.equal(createHash('sha256').update(body).digest('hex'),m.checksum,`Do not edit historical migration ${m.file}; use a new version`);
}
const baseline=`
select pg_advisory_xact_lock(hashtextextended('brickwise-wallet-migrations',0));
create table if not exists public.brickwise_schema_migrations (
 version text primary key, checksum text not null check(checksum ~ '^[0-9a-f]{64}$'),
 mode text not null check(mode in ('baseline','applied')), recorded_at timestamptz not null default now()
);
alter table public.brickwise_schema_migrations enable row level security;
revoke all on public.brickwise_schema_migrations from public,anon,authenticated;
grant all on public.brickwise_schema_migrations to service_role;
do $baseline$ begin
 if to_regclass('public.wallet_accounts') is null or to_regclass('public.property_holdings') is null or to_regclass('public.wallet_transactions') is null then raise exception 'Baseline requires an initialized wallet'; end if;
 if (select count(*) from pg_constraint where connamespace='public'::regnamespace and conname in ('wallet_accounts_currency_check','wallet_transactions_currency_check','property_holdings_currency_check','payment_requests_currency_check') and pg_get_constraintdef(oid) like '%EUR%')<>4 then raise exception 'EUR migration not verified'; end if;
 if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='payment_requests' and column_name='crypto_asset') then raise exception 'Payment method migration not verified'; end if;
 if position('return previous.id' in pg_get_functiondef('public.credit_wallet_atomic(uuid,numeric,text,uuid,text,text,text)'::regprocedure))=0 then raise exception 'Credit idempotency fix required before baseline'; end if;
 ${manifest.map(m=>`if exists(select 1 from public.brickwise_schema_migrations where version='${m.version}' and checksum<>'${m.checksum}') then raise exception 'Existing migration checksum mismatch: ${m.version}'; end if;
 insert into public.brickwise_schema_migrations(version,checksum,mode) values('${m.version}','${m.checksum}','baseline') on conflict(version) do nothing;`).join('\n')}
end $baseline$;`;
const hash=createHash('sha256').update(baseline+files.join('\n')).digest('hex');
const dir='project-backups/security-fix-04';mkdirSync(dir,{recursive:true});
const ref=new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split('.')[0];
async function query(query,read_only=true){const r=await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`,{method:'POST',headers:{Authorization:'Bearer '+process.env.SUPABASE_ACCESS_TOKEN,'Content-Type':'application/json'},body:JSON.stringify({query,read_only}),signal:AbortSignal.timeout(45000)});if(!r.ok)throw Error(await r.text());return r.json();}
const tables=['wallet_accounts','wallet_transactions','property_holdings','payment_requests','property_requests','property_share_settings','deposit_submissions'];
function fingerprintSQL(){return `select ${tables.map(t=>`(select md5(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]'::jsonb)::text) from public.${t} t) as ${t}`).join(',')},(select md5(string_agg(pg_get_functiondef(oid),'' order by proname)) from pg_proc where pronamespace='public'::regnamespace and proname in ('credit_wallet_atomic','purchase_shares_with_wallet_atomic','review_deposit','submit_deposit')) as functions,(select md5(coalesce(string_agg(id::text,',' order by id),'')) from auth.users) as users`;}
const before=await query(fingerprintSQL());
if(mode==='check'){
 // Snapshot all existing data plus real credit/purchase-shaped rows inside the rollback.
 const fixture=`do $fixture$
 declare uid uuid:=gen_random_uuid(); actor uuid; slug text:='migration-replay-'||uid::text;
 begin
 select id into actor from auth.users where raw_app_meta_data->>'role'='admin' limit 1;
 insert into auth.users(id,email) values(uid,'migration-test@example.invalid');
 perform credit_wallet_atomic(uid,3000,'EUR',actor,'migration-test@example.invalid','Test','replay-credit:'||uid::text);
 insert into property_share_settings(property_slug,total_shares,blocked_shares) values(slug,100,0);
 perform purchase_shares_with_wallet_atomic(uid,slug,'Replay fixture',2,1000,'Test','migration-test@example.invalid','','Migration replay test','replay-purchase:'||uid::text);
 end $fixture$;
 create temp table financial_before as ${fingerprintSQL()};`;
 const compare=`do $compare$ begin if (select to_jsonb(a) from financial_before a) is distinct from (select to_jsonb(b) from (${fingerprintSQL().replace(/;$/,'')}) b) then raise exception 'Migration replay changed financial records or current functions'; end if; end $compare$;`;
 console.log(await query('begin; set local lock_timeout=\'5s\';'+baseline+'\n'+fixture+'\n'+files.join('\n')+'\n'+files.join('\n')+'\n'+compare+"\nselect 'PASS: replay twice preserves full financial rows, holdings, share supply and current RPC definitions' as result; rollback;",false));
 await assert.rejects(query("begin;"+baseline+"drop table public.brickwise_schema_migrations;"+files[0]+"\nrollback;",false),/Migration registry missing/);
 // Missing registry and mismatched checksum must stop the script before old DDL executes.
 for(const [index,m] of manifest.entries()){
  for(const corrupt of [false,true]){
   const sabotage=corrupt?`update public.brickwise_schema_migrations set checksum=repeat('0',64) where version='${m.version}';`:`delete from public.brickwise_schema_migrations where version='${m.version}';`;
   await assert.rejects(query('begin;'+baseline+sabotage+files[index]+'\nrollback;',false),corrupt?/checksum mismatch/:/Untracked initialized wallet/);
  }
 }
 assert.deepEqual(await query(fingerprintSQL()),before);
 writeFileSync(dir+'/checked.json',JSON.stringify({hash,before}));
 console.log('PASS: missing migration records and mismatched checksums blocked; rollback left production data unchanged.');
}else if(mode==='apply'){
 assert.equal(JSON.parse(readFileSync(dir+'/checked.json','utf8')).hash,hash);
 await query('begin; set local lock_timeout=\'5s\';'+baseline+'\n'+files.join('\n')+'\ncommit;',false);
 assert.deepEqual(await query(fingerprintSQL()),before);
 writeFileSync(dir+'/applied.json',JSON.stringify({hash,before,at:new Date().toISOString()}));
 console.log('Applied baseline; all financial rows and wallet function definitions unchanged.');
}else{
 const rows=await query("select version,checksum from public.brickwise_schema_migrations where version in ('001_wallet_ledger','002_eur_only','003_payment_methods') order by version");
 assert.deepEqual(rows,manifest.map(({version,checksum})=>({version,checksum})));
 console.log('Verified historical migration versions and checksums.');
}
