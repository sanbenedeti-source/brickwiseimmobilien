import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
process.loadEnvFile('.env');
const mode=process.argv[2]||'check'; assert.ok(['check','apply','verify'].includes(mode));
const sql=readFileSync('SUPABASE_PAYMENT_PRIVACY.sql','utf8');
const hash=createHash('sha256').update(sql).digest('hex');
const dir='project-backups/security-fix-06';mkdirSync(dir,{recursive:true});
const ref=new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split('.')[0];
async function query(query,read_only=true){const r=await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`,{method:'POST',headers:{Authorization:'Bearer '+process.env.SUPABASE_ACCESS_TOKEN,'Content-Type':'application/json'},body:JSON.stringify({query,read_only}),signal:AbortSignal.timeout(45000)});if(!r.ok)throw Error(await r.text());return r.json();}
const tables=['payment_requests','payment_refunds','deposit_submissions','wallet_accounts','wallet_transactions','property_holdings','admin_audit_logs'];
const fingerprint=()=>query(`select ${tables.map(t=>`(select md5(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]'::jsonb)::text) from public.${t} t) as ${t}`).join(',')},(select md5(coalesce(string_agg(id::text,',' order by id),'')) from auth.users) as users`);
const before=await fingerprint();
const tests=`
insert into auth.users(id,email) values ('06300000-0000-4000-8000-000000000001','privacy-fixture@example.invalid');
insert into payment_requests(user_id,customer_email,title,amount,currency,method,status,admin_note)
values('06300000-0000-4000-8000-000000000001','privacy-fixture@example.invalid','privacy-fixture',1,'EUR','bank_transfer','sent','private-marker');
select set_config('request.jwt.claims','{"sub":"06300000-0000-4000-8000-000000000001","email":"privacy-fixture@example.invalid","role":"authenticated"}',true);
set local role authenticated;
do $test$
declare col text; blocked boolean; n int;
begin
 select count(id) into n from payment_requests where title='privacy-fixture';
 if n<>1 then raise exception 'Own payment not readable'; end if;
 perform id,title,amount,currency,method,crypto_asset,crypto_network,status,payment_link,instructions,created_at
 from payment_requests where user_id=auth.uid() or customer_email='privacy-fixture@example.invalid';
 foreach col in array array['admin_note','created_by','verified_by','credit_transaction_id'] loop
  blocked:=false;
  begin execute format('select %I from public.payment_requests',col); exception when insufficient_privilege then blocked:=true; end;
  if not blocked then raise exception 'Private column readable: %',col; end if;
 end loop;
 blocked:=false; begin perform * from payment_requests; exception when insufficient_privilege then blocked:=true; end;
 if not blocked then raise exception 'Wildcard access allowed'; end if;
 blocked:=false; begin perform id from payment_requests where admin_note='private-marker'; exception when insufficient_privilege then blocked:=true; end;
 if not blocked then raise exception 'Private filtering allowed'; end if;
 blocked:=false; begin update payment_requests set title='changed' where title='privacy-fixture'; exception when insufficient_privilege then blocked:=true; end;
 if not blocked then raise exception 'Client update allowed'; end if;
end $test$;
reset role;
select set_config('request.jwt.claims','{"sub":"06300000-0000-4000-8000-000000000002","email":"other-fixture@example.invalid","role":"authenticated"}',true);
set local role authenticated;
do $test$ begin
 if exists(select id from payment_requests where title='privacy-fixture') then raise exception 'Another customer payment readable'; end if;
end $test$;
reset role;
set local role anon;
do $test$ declare blocked boolean:=false; begin
 begin perform id from payment_requests; exception when insufficient_privilege then blocked:=true; end;
 if not blocked then raise exception 'Anonymous read allowed'; end if;
end $test$;
reset role;
set local role service_role;
do $test$ begin
 if not exists(select id from payment_requests where title='privacy-fixture' and admin_note='private-marker') then raise exception 'Admin read broken'; end if;
 update payment_requests set admin_note='updated-private-marker' where title='privacy-fixture';
end $test$;
reset role;
`;
if(mode==='check'||mode==='verify'){
 await query('begin; set local lock_timeout=\'5s\';'+(mode==='check'?sql+'\n'+sql:'')+'\n'+tests+'\nrollback;',false);
 assert.deepEqual(await fingerprint(),before);
 if(mode==='check')writeFileSync(dir+'/checked.json',JSON.stringify({hash,before}));
 console.log('PASS: own payment/dashboard projection, private columns/wildcard/filter denied, client writes denied, other customer denied, anonymous denied, admin read/write preserved. Fixtures rolled back; data unchanged.');
}else{
 assert.equal(JSON.parse(readFileSync(dir+'/checked.json','utf8')).hash,hash);
 const acl=await query("select relacl,(select jsonb_agg(jsonb_build_object('column',attname,'acl',attacl)) from pg_attribute where attrelid=c.oid and attnum>0 and not attisdropped) as columns from pg_class c where oid='public.payment_requests'::regclass");
 writeFileSync(dir+'/before.json',JSON.stringify({acl,before}));
 await query(`begin; set local lock_timeout='5s'; select pg_advisory_xact_lock(hashtextextended('brickwise-wallet-migrations',0));
 do $v$ begin if exists(select 1 from brickwise_schema_migrations where version='006_payment_privacy' and checksum<>'${hash}') then raise exception 'Privacy migration checksum mismatch'; end if; end $v$;
 ${sql}
 insert into brickwise_schema_migrations(version,checksum,mode) values('006_payment_privacy','${hash}','applied') on conflict(version) do nothing; commit;`,false);
 assert.deepEqual(await fingerprint(),before);
 console.log('Applied payment privacy permissions; existing data unchanged.');
}
