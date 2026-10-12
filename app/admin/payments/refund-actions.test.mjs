import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const code=ts.transpileModule(readFileSync(new URL('./refund-actions.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
function harness({admin=true,error=null}={}){
 const calls=[],paths=[];const modules={
  'next/cache':{revalidatePath:p=>paths.push(p)},
  '@/app/lib/admin':{isAdminUser:u=>u?.app_metadata?.role==='admin'},
  '@/lib/supabase/server':{createClient:async()=>({auth:{getUser:async()=>({data:{user:{app_metadata:{role:admin?'admin':'client'}}}})},rpc:async(name,args)=>{calls.push({name,args});return {data:'refund-id',error};}})},
 };const loaded={exports:{}};new Function('require','module','exports',code)(n=>{assert.ok(modules[n],n);return modules[n];},loaded,loaded.exports);
 return {run:f=>loaded.exports.refundPayment({result:''},f),calls,paths};
}
function form(extra={}){const f=new FormData();for(const [k,v] of Object.entries({payment_id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',reference:'bank-outgoing-123',note:'Payment returned',confirmed:'on',amount:'999999',user_id:'forged',...extra}))f.set(k,v);return f;}
test('refund uses original payment identity, never submitted amount or customer',async()=>{const h=harness();assert.equal((await h.run(form())).result,'saved');assert.deepEqual(h.calls[0],{name:'refund_payment_atomic',args:{p_payment_id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',p_reference:'bank-outgoing-123',p_note:'Payment returned'}});assert.ok(h.paths.includes('/dashboard/wallet')&&h.paths.includes('/funding'));});
test('refund requires administrator, confirmation, valid reference and reason',async()=>{const h=harness({admin:false});assert.equal((await h.run(form())).result,'error');assert.equal(h.calls.length,0);for(const extra of [{confirmed:''},{payment_id:'bad'},{reference:'x'},{note:''}]){const h=harness();assert.equal((await h.run(form(extra))).result,'error');assert.equal(h.calls.length,0);}});
test('insufficient balance is reported without success or refresh',async()=>{const h=harness({error:{message:'insufficient_refund_balance'}});assert.equal((await h.run(form())).result,'insufficient');assert.equal(h.paths.length,0);});
test('retry preserves payment and external receipt; raw database errors stay private',async()=>{const h=harness({error:{message:'private database error'}});assert.deepEqual(await h.run(form()),{result:'error'});await h.run(form());assert.deepEqual(h.calls[0],h.calls[1]);});
