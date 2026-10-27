import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const code=ts.transpileModule(readFileSync(new URL('./actions.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
function harness({admin=true,fail=false}={}){
 const calls=[];const modules={
  'next/cache':{revalidatePath(){}},'next/navigation':{redirect(){throw Error('Unexpected redirect');}},
  '@/app/lib/payment-methods':{},'@/app/lib/admin':{isAdminUser:u=>u?.app_metadata?.role==='admin'},'@/app/lib/admin-session':{hasAdminSession:async(_c,u)=>u?.app_metadata?.role==='admin'},
  '@/lib/supabase/server':{createClient:async()=>({auth:{getUser:async()=>({data:{user:{id:'admin-id',app_metadata:{role:admin?'admin':'client'}}}})}})},
  '@supabase/supabase-js':{createClient:()=>({auth:{admin:{getUserById:async()=>({data:{user:{email:'actual@example.invalid',user_metadata:{full_name:'Actual customer'}}},error:null})}},rpc:async(name,args)=>{calls.push({name,args});return {data:fail?null:'transaction-id',error:fail?{message:'Test failure'}:null};}})},
  '@/app/lib/admin-audit':{writeAdminAuditLog:async()=>{}},
 };const loaded={exports:{}};
 new Function('require','module','exports','process',code)(n=>{assert.ok(modules[n],n);return modules[n];},loaded,loaded.exports,{env:{NEXT_PUBLIC_SUPABASE_URL:'https://example.invalid',SUPABASE_SERVICE_ROLE_KEY:'test'}});
 return {run:f=>loaded.exports.creditCustomerWallet({result:''},f),calls};
}
function form(extra={}){const f=new FormData();for(const [k,v] of Object.entries({user_id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',operation_id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',amount:'100.00',currency:'EUR',customer_email:'forged@example.invalid',...extra}))f.set(k,v);return f;}
test('same submitted operation keeps the same RPC key and uses authoritative customer identity',async()=>{const h=harness();const f=form();assert.equal((await h.run(f)).result,'saved');await h.run(f);assert.equal(h.calls.length,2);assert.equal(h.calls[0].args.p_idempotency_key,h.calls[1].args.p_idempotency_key);assert.equal(h.calls[0].args.p_customer_email,'actual@example.invalid');assert.equal(h.calls[0].args.p_customer_name,'Actual customer');});
test('new operation has a different key',async()=>{const h=harness();await h.run(form());await h.run(form({operation_id:'cccccccc-cccc-4ccc-8ccc-cccccccccccc'}));assert.notEqual(h.calls[0].args.p_idempotency_key,h.calls[1].args.p_idempotency_key);});
test('non-admin and invalid operation or amount cannot credit',async()=>{const h=harness({admin:false});assert.equal((await h.run(form())).result,'error');assert.equal(h.calls.length,0);for(const extra of [{operation_id:''},{operation_id:'bad'},{user_id:'bad'},{amount:'NaN'},{amount:'0'},{amount:'1.001'},{currency:'CAD'}]){const h=harness();assert.equal((await h.run(form(extra))).result,'error');assert.equal(h.calls.length,0);}});
test('failed attempt retains operation identity for retry and does not report success',async()=>{const h=harness({fail:true});assert.equal((await h.run(form())).result,'error');await h.run(form());assert.equal(h.calls[0].args.p_idempotency_key,h.calls[1].args.p_idempotency_key);});
