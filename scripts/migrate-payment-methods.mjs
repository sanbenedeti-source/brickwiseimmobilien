import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
process.loadEnvFile('.env');
const mode=process.argv[2] || 'check';
assert.ok(['check','apply','verify'].includes(mode));
const ref=new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split('.')[0];
const sql=readFileSync('SUPABASE_PAYMENT_METHODS.sql','utf8');
const hash=createHash('sha256').update(sql).digest('hex');
const directory='project-backups/admin-refresh-2026-09-27';
async function query(query,readOnly=true) {
  const response=await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`,{method:'POST',headers:{authorization:`Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`,'content-type':'application/json'},body:JSON.stringify({query,read_only:readOnly}),signal:AbortSignal.timeout(30000)});
  if(!response.ok)throw Error(`Database HTTP ${response.status}: ${(await response.text()).slice(0,1000)}`);
  return response.json();
}
async function state(){return query(`select
 (select count(*) from auth.users) as users,
 (select count(*) from public.payment_requests) as payments,
 (select count(*) from public.wallet_accounts) as wallets,
 (select count(*) from public.wallet_transactions) as transactions,
 (select md5(coalesce(jsonb_agg(to_jsonb(t) order by id),'[]'::jsonb)::text) from public.payment_requests t) as payment_hash`);}
const before=await state();
if(mode==='check') {
 const tests=`do $test$ declare bad text; rejected boolean; uid uuid:=gen_random_uuid(); begin
 foreach bad in array array['stripe_link','manual','crypto_usdc'] loop
  rejected:=false;
  begin insert into public.payment_requests(customer_email,title,amount,method) values('test@example.invalid','Rejected method',1,bad);
  exception when check_violation then rejected:=true; end;
  if not rejected then raise exception 'Removed method accepted: %',bad; end if;
 end loop;
 rejected:=false;
 begin insert into public.payment_requests(customer_email,title,amount,method) values('test@example.invalid','Missing network',1,'crypto');
 exception when check_violation then rejected:=true; end;
 if not rejected then raise exception 'Missing crypto details accepted'; end if;
 insert into public.payment_requests(customer_email,title,amount,method,crypto_asset,crypto_network) values('test@example.invalid','BTC test',100,'crypto','BTC','Bitcoin'),('test@example.invalid','USDT test',100,'crypto','USDT','TRON');
 insert into auth.users(id,email) values(uid,uid::text||'@example.invalid');
 perform public.credit_wallet_atomic(uid,1,'EUR',uid,'test@example.invalid','Test','payment-method-test-'||uid);
 if not exists(select 1 from public.payment_requests where user_id=uid and method='wallet_credit' and currency='EUR') then raise exception 'Internal wallet credit broken'; end if;
 end $test$; select 'Removed methods rejected; BTC, USDT and internal EUR wallet credits passed' as result;`;
 console.log(JSON.stringify(await query(`begin; set local lock_timeout='5s'; ${sql}\n${sql}\n${tests}\nrollback;`,false)));
 assert.deepEqual(await state(),before);
 writeFileSync(`${directory}/checked.json`,JSON.stringify({hash}));
}
if(mode==='apply') {
 assert.equal(JSON.parse(readFileSync(`${directory}/checked.json`,'utf8')).hash,hash);
 await query(`begin; set local lock_timeout='5s'; ${sql}\ncommit;`,false);
 assert.deepEqual(await state(),before);
 writeFileSync(`${directory}/applied.json`,JSON.stringify({hash,at:new Date().toISOString()}));
}
if(mode!=='check') {
 const schema=await query(`select conname,pg_get_constraintdef(oid) as definition from pg_constraint where conrelid='public.payment_requests'::regclass and conname in ('payment_requests_method_check','payment_requests_crypto_details_check') order by conname`);
 assert.equal(schema.length,2);
 assert.ok(schema.some(row=>row.definition.includes('wallet_credit')));
 console.log(JSON.stringify({schema,state:await state()}));
}
