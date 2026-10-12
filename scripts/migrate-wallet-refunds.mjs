import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
process.loadEnvFile('.env');
const sql=readFileSync('SUPABASE_WALLET_REFUNDS.sql','utf8');
const hash=createHash('sha256').update(sql).digest('hex'),mode=process.argv[2]||'check';assert.ok(['check','apply'].includes(mode));
const dir='project-backups/security-fix-05';mkdirSync(dir,{recursive:true});
const ref=new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split('.')[0];
async function query(query,read_only=true){const r=await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`,{method:'POST',headers:{Authorization:'Bearer '+process.env.SUPABASE_ACCESS_TOKEN,'Content-Type':'application/json'},body:JSON.stringify({query,read_only}),signal:AbortSignal.timeout(45000)});if(!r.ok)throw Error(await r.text());return r.json();}
const tables=['wallet_accounts','wallet_transactions','property_holdings','payment_requests','property_requests','property_share_settings','deposit_submissions','admin_audit_logs'];
const fingerprint=()=>query(`select ${tables.map(t=>`(select md5(coalesce(jsonb_agg(${t==='payment_requests'?"to_jsonb(t)-'credit_transaction_id'":"to_jsonb(t)"} order by to_jsonb(t)::text),'[]'::jsonb)::text) from public.${t} t) as ${t}`).join(',')},(select md5(coalesce(string_agg(id::text,',' order by id),'')) from auth.users) as users`);
const before=await fingerprint();
const version=`do $v$ begin
 if exists(select 1 from brickwise_schema_migrations where version='005_wallet_refunds' and checksum<>'${hash}') then raise exception 'Refund migration checksum mismatch'; end if;
 insert into brickwise_schema_migrations(version,checksum,mode) values('005_wallet_refunds','${hash}','applied') on conflict(version) do nothing;
end $v$;`;
if(mode==='check'){
 const tests=`create or replace function pg_temp.fail_refund_audit_test() returns trigger language plpgsql as $f$ begin
 if new.action='payment.refund' and new.details->>'external_reference' like 'audit-fail:%' then raise exception 'audit_test_failure'; end if;
 return new;
 end $f$;
 create trigger refund_test_audit_failure before insert on admin_audit_logs for each row execute function pg_temp.fail_refund_audit_test();
 do $test$
 declare uid uuid:=gen_random_uuid(); actor uuid; tx uuid; pid uuid; refund uuid; retry uuid; blocked boolean; external_pid uuid; m company_payment_methods; dep uuid;
 begin
 select id into actor from auth.users where raw_app_meta_data->>'role'='admin' limit 1;
 insert into auth.users(id,email) values(uid,'refund-test@example.invalid');
 tx:=credit_wallet_atomic(uid,100,'EUR',actor,'refund-test@example.invalid','Test','refund-test-credit:'||uid::text);
 select id into pid from payment_requests where credit_transaction_id=tx;
 if pid is null then raise exception 'Missing payment-credit link'; end if;
 blocked:=false; begin update payment_requests set status='refunded' where id=pid; exception when raise_exception then blocked:=true; end;
 if not blocked then raise exception 'Unreconciled status accepted'; end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',uid,'role','authenticated','app_metadata','{}'::jsonb)::text,true);
 blocked:=false; begin perform refund_payment_atomic(pid,'test-ref:'||uid::text,'Test refund'); exception when raise_exception then blocked:=true; end;
 if not blocked then raise exception 'Client can refund'; end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated','app_metadata',jsonb_build_object('role','admin'))::text,true);
 refund:=refund_payment_atomic(pid,'test-ref:'||uid::text,'Test refund');
 retry:=refund_payment_atomic(pid,'test-ref:'||uid::text,'Test refund retry');
 if refund<>retry or (select balance from wallet_accounts where user_id=uid)<>0 or (select count(*) from wallet_transactions where user_id=uid and type='refund')<>1 or (select status from payment_requests where id=pid)<>'refunded' then raise exception 'Refund or retry inconsistency'; end if;
 if (select count(*) from admin_audit_logs where action='payment.refund' and target_id=pid::text)<>1 then raise exception 'Audit event missing or duplicated'; end if;
 blocked:=false; begin update payment_requests set status='verified' where id=pid; exception when raise_exception then blocked:=true; end;
 if not blocked then raise exception 'Refunded payment can be reopened'; end if;
 blocked:=false; begin update payment_refunds set amount=1 where id=refund; exception when raise_exception then blocked:=true; end;
 if not blocked then raise exception 'Refund record mutable'; end if;
 blocked:=false; begin perform refund_payment_atomic(pid,'other-ref:'||uid::text,'Other refund'); exception when raise_exception then blocked:=true; end;
 if not blocked then raise exception 'Another refund reference accepted for same payment'; end if;
 tx:=credit_wallet_atomic(uid,50,'EUR',actor,'refund-test@example.invalid','Test','second-credit:'||uid::text);
 select id into pid from payment_requests where credit_transaction_id=tx;
 blocked:=false; begin perform refund_payment_atomic(pid,'test-ref:'||uid::text,'Duplicate outgoing transfer'); exception when unique_violation then blocked:=true; end;
 if not blocked or (select balance from wallet_accounts where user_id=uid)<>50 or (select status from payment_requests where id=pid)<>'verified' then raise exception 'Duplicate reference not rolled back'; end if;
 blocked:=false; begin perform refund_payment_atomic(pid,'audit-fail:'||uid::text,'Audit failure test'); exception when raise_exception then blocked:=sqlerrm='audit_test_failure'; end;
 if not blocked or (select balance from wallet_accounts where user_id=uid)<>50 or (select status from payment_requests where id=pid)<>'verified' or exists(select 1 from payment_refunds where payment_id=pid) then raise exception 'Audit failure did not roll back refund'; end if;
 -- Fixture spending: a real atomic purchase consumes part of the available balance.
 insert into property_share_settings(property_slug,total_shares,blocked_shares) values('refund-test-'||uid::text,10,0);
 perform purchase_shares_with_wallet_atomic(uid,'refund-test-'||uid::text,'Test',1,25,'Test','refund-test@example.invalid','','Test spending','refund-purchase:'||uid::text);
 blocked:=false; begin perform refund_payment_atomic(pid,'low-balance:'||uid::text,'Insufficient balance test'); exception when raise_exception then blocked:=sqlerrm='insufficient_refund_balance'; end;
 if not blocked or (select balance from wallet_accounts where user_id=uid)<>25 or (select status from payment_requests where id=pid)<>'verified' then raise exception 'Insufficient balance not atomic'; end if;
 insert into payment_requests(user_id,customer_email,title,amount,currency,method,status) values(uid,'refund-test@example.invalid','External payment',30,'EUR','bank_transfer','paid') returning id into external_pid;
 perform refund_payment_atomic(external_pid,'external-ref:'||uid::text,'External return');
 if (select balance from wallet_accounts where user_id=uid)<>25 or exists(select 1 from payment_refunds where payment_id=external_pid and debit_transaction_id is not null) then raise exception 'External refund affected wallet'; end if;
 -- Deposit approval and refund must agree on status and prevent reuse.
 select * into m from company_payment_methods where active and kind='crypto' limit 1;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',uid,'role','authenticated','app_metadata','{}'::jsonb)::text,true);
 dep:=submit_deposit(m.id,40,0.01,replace(gen_random_uuid()::text,'-',''),gen_random_uuid(),to_jsonb(m)-'created_at'-'updated_at');
 perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated','app_metadata',jsonb_build_object('role','admin'))::text,true);
 tx:=review_deposit(dep,true,40,'settlement:'||uid::text,'Received');
 select id into pid from payment_requests where credit_transaction_id=tx;
 perform refund_payment_atomic(pid,'deposit-ref:'||uid::text,'Deposit returned');
 if (select status from deposit_submissions where id=dep)<>'refunded' or (select balance from wallet_accounts where user_id=uid)<>25 then raise exception 'Deposit refund out of sync'; end if;
 if has_function_privilege('anon','public.refund_payment_atomic(uuid,text,text)','EXECUTE') or has_table_privilege('authenticated','public.payment_refunds','INSERT') then raise exception 'Invalid refund privileges'; end if;
 end $test$;
 select 'PASS: full refund, retry, immutable history, unauthorized access, direct status bypass, duplicate receipt rollback, insufficient balance, external payment, audit failure rollback and deposit integration' as result;`;
 const creditLegacy=readFileSync('SUPABASE_WALLET_CREDIT_IDEMPOTENCY.sql','utf8');
 console.log(await query('begin; set local lock_timeout=\'5s\';'+sql+'\n'+sql+'\n'+creditLegacy+'\n'+tests+'\nrollback;',false));
 assert.deepEqual(await fingerprint(),before);
 writeFileSync(dir+'/checked.json',JSON.stringify({hash,before}));
}else{
 assert.equal(JSON.parse(readFileSync(dir+'/checked.json','utf8')).hash,hash);
 await query('begin; set local lock_timeout=\'5s\'; select pg_advisory_xact_lock(hashtextextended(\'brickwise-wallet-migrations\',0));'+sql+'\n'+version+'\ncommit;',false);
 assert.deepEqual(await fingerprint(),before);
 writeFileSync(dir+'/applied.json',JSON.stringify({hash,before,at:new Date().toISOString()}));
 console.log('Refund migration applied; existing financial data unchanged.');
}
