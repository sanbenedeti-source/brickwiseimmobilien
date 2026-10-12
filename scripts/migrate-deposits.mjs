import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
process.loadEnvFile('.env');
const sql=readFileSync('SUPABASE_DEPOSITS.sql','utf8'), hash=createHash('sha256').update(sql).digest('hex');
const mode=process.argv[2]||'check'; assert.ok(['check','apply'].includes(mode));
const dir='project-backups/deposits-2026-09-27'; mkdirSync(dir,{recursive:true});
const ref=new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split('.')[0];
async function query(query,read_only=true){const r=await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`,{method:'POST',headers:{Authorization:'Bearer '+process.env.SUPABASE_ACCESS_TOKEN,'Content-Type':'application/json'},body:JSON.stringify({query,read_only}),signal:AbortSignal.timeout(30000)});if(!r.ok)throw Error(await r.text());return r.json();}
const counts=()=>query('select (select count(*) from auth.users) as users,(select count(*) from wallet_transactions) as transactions,(select count(*) from payment_requests) as payments,(select coalesce(sum(balance),0) from wallet_accounts) as balance');
const before=await counts();
if(mode==='check') {
 const tests=`
 insert into auth.users(id,email) values('de000000-0000-4000-8000-000000000001','deposit-test@example.invalid');
 insert into company_payment_methods(id,kind,bank_slot,label,bank_name,beneficiary,account_number,active) values('de000000-0000-4000-8000-000000000002','crypto',null,'Deposit test',null,null,null,false);
 `;
 // Use a complete crypto fixture; it never leaves this transaction.
 const fixture=tests.slice(0,tests.indexOf(' insert into company_payment_methods'))+`
 insert into company_payment_methods(id,kind,label,crypto_asset,crypto_network,wallet_address,active) values('de000000-0000-4000-8000-000000000002','crypto','Deposit test','BTC','Test network','test-address',true);
 select set_config('request.jwt.claims','{"sub":"de000000-0000-4000-8000-000000000001","role":"authenticated","app_metadata":{}}',true);
 set local role authenticated;
 do $test$ declare d uuid; d2 uuid; dest jsonb; blocked boolean:=false; begin
 select to_jsonb(m)-'created_at'-'updated_at' into dest from company_payment_methods m where id='de000000-0000-4000-8000-000000000002';
 d:=submit_deposit('de000000-0000-4000-8000-000000000002',100,0.01,'testtransaction000000000001','de000000-0000-4000-8000-000000000003',dest);
 d2:=submit_deposit('de000000-0000-4000-8000-000000000002',100,0.01,'testtransaction000000000001','de000000-0000-4000-8000-000000000003',dest);
 if d<>d2 or (select count(*) from deposit_submissions)<>1 then raise exception 'Idempotency failed'; end if;
 begin perform review_deposit(d,true,100,'test-settlement','Approved'); exception when raise_exception then blocked:=true; end;
 if not blocked then raise exception 'Customer approved own deposit'; end if;
 blocked:=false;
 begin update deposit_submissions set status='verified' where id=d; exception when insufficient_privilege then blocked:=true; end;
 if not blocked then raise exception 'Customer edited deposit directly'; end if;
 blocked:=false;
 begin perform submit_deposit('de000000-0000-4000-8000-000000000002',100,0.01,'testtransaction000000000001',gen_random_uuid(),dest); exception when unique_violation then blocked:=true; end;
 if not blocked then raise exception 'Duplicate transaction accepted'; end if;
 blocked:=false;
 begin perform submit_deposit('de000000-0000-4000-8000-000000000002',100,0.01,'testtransaction000000000002',gen_random_uuid(),dest||'{"wallet_address":"forged"}'::jsonb); exception when raise_exception then blocked:=true; end;
 if not blocked then raise exception 'Changed destination accepted'; end if;
 end $test$;
 do $test$ declare dest jsonb; begin
 select to_jsonb(m)-'created_at'-'updated_at' into dest from company_payment_methods m where id='de000000-0000-4000-8000-000000000002';
 perform submit_deposit('de000000-0000-4000-8000-000000000002',25,0.01,'testtransaction000000000002','de000000-0000-4000-8000-000000000004',dest);
 perform submit_deposit('de000000-0000-4000-8000-000000000002',25,0.01,'testtransaction000000000003','de000000-0000-4000-8000-000000000005',dest);
 end $test$;
 reset role;
 do $test$ begin if exists(select 1 from wallet_accounts where user_id='de000000-0000-4000-8000-000000000001') then raise exception 'Submission credited wallet'; end if; end $test$;
 select set_config('request.jwt.claims','{"sub":"de000000-0000-4000-8000-000000000099","role":"authenticated","app_metadata":{}}',true);
 set local role authenticated;
 do $test$ begin if exists(select 1 from deposit_submissions) then raise exception 'Another customer sees deposits'; end if; end $test$;
 reset role;
 select set_config('request.jwt.claims',jsonb_build_object('sub',(select id from auth.users where raw_app_meta_data->>'role'='admin' limit 1),'role','authenticated','app_metadata',jsonb_build_object('role','admin'))::text,true);
 set local role authenticated;
 do $test$ declare d uuid; tx uuid; tx2 uuid; begin
 select id into d from deposit_submissions where client_key='de000000-0000-4000-8000-000000000003';
 tx:=review_deposit(d,true,98.50,'test-settlement','Received and converted');
 tx2:=review_deposit(d,true,98.50,'test-settlement','Repeated request');
 if tx is null or tx<>tx2 then raise exception 'Approval idempotency failed'; end if;
 end $test$;
 do $test$ declare d uuid; blocked boolean:=false; begin
 select id into d from deposit_submissions where client_key='de000000-0000-4000-8000-000000000004';
 begin perform review_deposit(d,true,25,'test-settlement','Duplicate receipt'); exception when unique_violation then blocked:=true; end;
 if not blocked then raise exception 'Duplicate bank settlement accepted'; end if;
 if (select status from deposit_submissions where id=d)<>'pending' then raise exception 'Failed credit was not rolled back'; end if;
 perform review_deposit(d,false,null,null,'Funds not received');
 if (select status from deposit_submissions where id=d)<>'rejected' then raise exception 'Reject failed'; end if;
 end $test$;
 reset role;
 do $test$ begin
 if (select balance from wallet_accounts where user_id='de000000-0000-4000-8000-000000000001')<>98.50 then raise exception 'Wrong wallet balance'; end if;
 if (select count(*) from wallet_transactions where user_id='de000000-0000-4000-8000-000000000001')<>1 then raise exception 'Duplicate ledger credit'; end if;
 end $test$;
 select 'Ownership, direct-write protection, snapshot validation, duplicate transaction rejection, pending without credit, atomic EUR approval, repeated approval, duplicate settlement rollback and rejection passed' as result;
 `;
 console.log(await query('begin; set local lock_timeout=\'5s\';'+sql+'\n'+fixture+'\nrollback;',false));
 assert.deepEqual(await counts(),before);
 writeFileSync(dir+'/checked.json',JSON.stringify({hash,before}));
} else {
 assert.equal(JSON.parse(readFileSync(dir+'/checked.json','utf8')).hash,hash);
 await query('begin; set local lock_timeout=\'5s\';'+sql+'\ncommit;',false);
 assert.deepEqual(await counts(),before);
 console.log(await query('select count(*) as deposits from deposit_submissions'));
 writeFileSync(dir+'/applied.json',JSON.stringify({hash,before,at:new Date().toISOString()}));
}
