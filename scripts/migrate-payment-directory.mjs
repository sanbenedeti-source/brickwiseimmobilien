import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
process.loadEnvFile('.env');
const mode=process.argv[2] || 'check'; assert.ok(['check','apply','verify'].includes(mode));
const sql=readFileSync('SUPABASE_COMPANY_PAYMENT_METHODS.sql','utf8');
const hash=createHash('sha256').update(sql).digest('hex');
const directory='project-backups/payment-directory-2026-09-27';
const ref=new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split('.')[0];
async function query(query,readOnly=true){
 const r=await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`,{method:'POST',headers:{authorization:`Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`,'content-type':'application/json'},body:JSON.stringify({query,read_only:readOnly}),signal:AbortSignal.timeout(30000)});
 if(!r.ok)throw Error(`Database HTTP ${r.status}: ${(await r.text()).slice(0,1200)}`);return r.json();
}
async function state(){return query(`select (select count(*) from auth.users) as users,(select count(*) from public.property_requests) as requests,(select count(*) from public.payment_requests) as payments,(select count(*) from public.wallet_accounts) as wallets,(select count(*) from public.wallet_transactions) as transactions`);}
const before=await state();
if(mode==='check'){
 const tests=`
 insert into public.company_payment_methods(kind,label,active,crypto_asset,crypto_network,wallet_address) values ('crypto','Directory integration active',true,'DIRECTORYTEST','Test','test-active'),('crypto','Directory integration hidden',false,'DIRECTORYTEST','Test','test-hidden');
 select set_config('request.jwt.claims','{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated","app_metadata":{}}',true);
 set local role authenticated;
 do $test$ declare rejected boolean:=false; begin
  if (select count(*) from public.company_payment_methods where crypto_asset='DIRECTORYTEST')<>1 then raise exception 'Customer visibility failed'; end if;
  begin update public.company_payment_methods set wallet_address='forged' where crypto_asset='DIRECTORYTEST'; exception when insufficient_privilege then rejected:=true; end;
  if not rejected then raise exception 'Client can edit receiving addresses'; end if;
 end $test$;
 reset role;
 select set_config('request.jwt.claims','{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated","app_metadata":{"role":"admin"}}',true);
 set local role authenticated;
 do $test$ begin if (select count(*) from public.company_payment_methods where crypto_asset='DIRECTORYTEST')<>2 then raise exception 'Admin cannot read hidden entries'; end if; end $test$;
 reset role;
 set local role anon;
 do $test$ declare rejected boolean:=false; begin
  begin perform count(*) from public.company_payment_methods; exception when insufficient_privilege then rejected:=true; end;
  if not rejected then raise exception 'Anonymous user can read company payment details'; end if;
 end $test$;
 reset role;
 do $test$ declare rejected boolean:=false; begin
  begin insert into public.company_payment_methods(kind,bank_slot,label,bank_name,beneficiary,account_number) values('bank',3,'Invalid slot','Test bank','Test','Test'); exception when check_violation then rejected:=true; end;
  if not rejected then raise exception 'Third bank slot accepted'; end if;
 end $test$;
 select 'Clients see active entries; admin sees all; anonymous reads and client edits blocked; bank slots limited to two' as result;`;
 console.log(JSON.stringify(await query(`begin; set local lock_timeout='5s'; ${sql}\n${sql}\n${tests}\nrollback;`,false)));
 assert.deepEqual(await state(),before);
 writeFileSync(`${directory}/checked.json`,JSON.stringify({hash}));
}
if(mode==='apply'){
 assert.equal(JSON.parse(readFileSync(`${directory}/checked.json`,'utf8')).hash,hash);
 await query(`begin; set local lock_timeout='5s'; ${sql}\ncommit;`,false);
 assert.deepEqual(await state(),before);
 writeFileSync(`${directory}/applied.json`,JSON.stringify({hash,at:new Date().toISOString()}));
}
if(mode!=='check'){
 const rows=await query('select crypto_asset as asset,crypto_network as network,wallet_address as address from public.company_payment_methods where kind=\'crypto\' order by id');
 const expected=JSON.parse(readFileSync(`${directory}/wallets-before.json`,'utf8'));
 assert.deepEqual(rows,expected,'Initial migration must preserve all six company wallet destinations');
 const [visibility]=await query(`select count(*) filter(where kind='bank') as bank_accounts,count(*) filter(where kind='crypto' and active) as active_wallets from public.company_payment_methods`);
 console.log(JSON.stringify({walletAddressesPreserved:true,...visibility,financialState:await state()}));
}
