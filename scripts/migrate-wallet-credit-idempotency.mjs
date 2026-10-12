import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
process.loadEnvFile('.env');
const sql=readFileSync('SUPABASE_WALLET_CREDIT_IDEMPOTENCY.sql','utf8');
const hash=createHash('sha256').update(sql).digest('hex'), mode=process.argv[2]||'check';
assert.ok(['check','apply'].includes(mode));
const dir='project-backups/security-fix-03';mkdirSync(dir,{recursive:true});
const ref=new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split('.')[0];
async function query(query,read_only=true){const r=await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`,{method:'POST',headers:{Authorization:'Bearer '+process.env.SUPABASE_ACCESS_TOKEN,'Content-Type':'application/json'},body:JSON.stringify({query,read_only}),signal:AbortSignal.timeout(30000)});if(!r.ok)throw Error(await r.text());return r.json();}
const state=()=>query('select (select count(*) from auth.users) as users,(select count(*) from wallet_transactions) as transactions,(select count(*) from payment_requests) as payments,(select count(*) from deposit_submissions) as deposits,(select count(*) from wallet_accounts) as wallets,(select coalesce(sum(balance),0) from wallet_accounts) as balance');
const before=await state();
if(mode==='check'){
 const [definition]=await query("select pg_get_functiondef(oid) as definition from pg_proc where oid='public.credit_wallet_atomic(uuid,numeric,text,uuid,text,text,text)'::regprocedure");
 writeFileSync(dir+'/function-before.sql',definition.definition);
 const tests=`do $test$
 declare uid uuid:=gen_random_uuid(); actor uuid; tx uuid; retry uuid; blocked boolean; key text:=gen_random_uuid()::text; m company_payment_methods; dep uuid;
 begin
 select id into actor from auth.users where raw_app_meta_data->>'role'='admin' limit 1;
 if actor is null then raise exception 'Admin fixture unavailable'; end if;
 insert into auth.users(id,email) values(uid,'credit-test@example.invalid');
 tx:=credit_wallet_atomic(uid,100,'EUR',actor,'credit-test@example.invalid','Test',key);
 retry:=credit_wallet_atomic(uid,100,'EUR',actor,'credit-test@example.invalid','Test',key);
 if tx<>retry then raise exception 'Retry returned another transaction'; end if;
 if (select balance from wallet_accounts where user_id=uid)<>100 or (select count(*) from payment_requests where user_id=uid)<>1 or (select count(*) from wallet_transactions where user_id=uid)<>1 then raise exception 'Repeated credit changed money or payment history'; end if;
 blocked:=false; begin perform credit_wallet_atomic(uid,101,'EUR',actor,'credit-test@example.invalid','Test',key); exception when raise_exception then blocked:=true; end;
 if not blocked then raise exception 'Different amount accepted for same operation'; end if;
 blocked:=false; begin perform credit_wallet_atomic(actor,100,'EUR',actor,'credit-test@example.invalid','Test',key); exception when raise_exception then blocked:=true; end;
 if not blocked then raise exception 'Different customer accepted for same operation'; end if;
 blocked:=false; begin perform credit_wallet_atomic(uid,100,'EUR',uid,'credit-test@example.invalid','Test',key); exception when raise_exception then blocked:=true; end;
 if not blocked then raise exception 'Different actor accepted for same operation'; end if;
 blocked:=false; begin perform credit_wallet_atomic(uid,100,'EUR',actor,'credit-test@example.invalid','Test',null); exception when raise_exception then blocked:=true; end;
 if not blocked then raise exception 'Missing operation key accepted'; end if;
 blocked:=false; begin perform credit_wallet_atomic(uid,'NaN'::numeric,'EUR',actor,'credit-test@example.invalid','Test',gen_random_uuid()::text); exception when raise_exception then blocked:=true; end;
 if not blocked then raise exception 'Nonfinite credit accepted'; end if;
 perform credit_wallet_atomic(uid,25,'EUR',actor,'credit-test@example.invalid','Test',gen_random_uuid()::text);
 if (select balance from wallet_accounts where user_id=uid)<>125 then raise exception 'New credit not recorded'; end if;
 -- Existing deposit approval must continue to work through the updated RPC.
 select * into m from company_payment_methods where active and kind='crypto' limit 1;
 if m.id is null then raise exception 'Active method fixture unavailable'; end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',uid,'role','authenticated','app_metadata','{}'::jsonb)::text,true);
 dep:=submit_deposit(m.id,50,0.01,replace(gen_random_uuid()::text,'-',''),gen_random_uuid(),to_jsonb(m)-'created_at'-'updated_at');
 perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated','app_metadata',jsonb_build_object('role','admin'))::text,true);
 tx:=review_deposit(dep,true,49,gen_random_uuid()::text,'Integration test');
 retry:=review_deposit(dep,true,49,gen_random_uuid()::text,'Integration retry');
 if tx<>retry or (select balance from wallet_accounts where user_id=uid)<>174 or (select count(*) from wallet_transactions where user_id=uid)<>3 then raise exception 'Deposit approval regression'; end if;
 if has_function_privilege('anon','public.credit_wallet_atomic(uuid,numeric,text,uuid,text,text,text)','EXECUTE') or has_function_privilege('authenticated','public.credit_wallet_atomic(uuid,numeric,text,uuid,text,text,text)','EXECUTE') or not has_function_privilege('service_role','public.credit_wallet_atomic(uuid,numeric,text,uuid,text,text,text)','EXECUTE') then raise exception 'Incorrect RPC permissions'; end if;
 end $test$;
 select 'PASS: retry, mismatched amount/customer/actor, invalid keys/amounts, new operation, deposit integration, RPC grants' as result;`;
 console.log(await query('begin; set local lock_timeout=\'5s\';'+sql+'\n'+tests+'\nrollback;',false));
 assert.deepEqual(await state(),before);
 writeFileSync(dir+'/checked.json',JSON.stringify({hash,before}));
}else{
 assert.equal(JSON.parse(readFileSync(dir+'/checked.json','utf8')).hash,hash);
 await query('begin; set local lock_timeout=\'5s\';'+sql+'\ncommit;',false);
 assert.deepEqual(await state(),before);
 writeFileSync(dir+'/applied.json',JSON.stringify({hash,before,at:new Date().toISOString()}));
 console.log('Applied; financial counts and total balance unchanged.');
}
