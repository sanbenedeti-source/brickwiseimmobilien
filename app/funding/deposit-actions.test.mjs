import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const code=ts.transpileModule(readFileSync(new URL('./deposit-actions.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
function harness({role='admin',owner='client-id',requested=2000}={}){
 const calls=[];const modules={
  'next/cache':{revalidatePath(){}},
  '../lib/admin':{isAdminUser:u=>u?.app_metadata?.role==='admin'},'../lib/admin-session':{hasAdminSession:async(_c,u)=>u?.app_metadata?.role==='admin'},
  '@/lib/supabase/server':{createClient:async()=>({
   auth:{getUser:async()=>({data:{user:{id:'admin-id',app_metadata:{role}}}})},
   from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:{user_id:owner,requested_eur:requested},error:null})})})}),
   rpc:async(name,args)=>{calls.push({name,args});return {data:'tx',error:null};},
  })},
 };const loaded={exports:{}};
 new Function('require','module','exports',code)(n=>{assert.ok(modules[n],n);return modules[n];},loaded,loaded.exports);
 return {review:f=>loaded.exports.reviewDeposit({result:''},f),submit:f=>loaded.exports.submitDeposit({result:''},f),calls};
}
function form(extra={}){const f=new FormData();for(const [k,v] of Object.entries({deposit_id:'dep',decision:'approve',checked:'on',amount:'2000.00',settlement:'bank-123',note:'Received',...extra}))f.set(k,v);return f;}
test('reported amount is credited without an extra confirmation',async()=>{const h=harness();assert.equal((await h.review(form())).result,'saved');assert.equal(h.calls[0].args.p_eur,'2000.00');});
test('a different credited amount requires explicit confirmation',async()=>{const h=harness();assert.equal((await h.review(form({amount:'20000'}))).result,'error');assert.equal(h.calls.length,0);assert.equal((await h.review(form({amount:'1985.50',amount_differs:'on'}))).result,'saved');assert.equal(h.calls[0].args.p_eur,'1985.50');});
test('malformed amounts never reach the database',async()=>{for(const amount of ['','abc','1e4','-5','10.001']){const h=harness();assert.equal((await h.review(form({amount,amount_differs:'on'}))).result,'error');assert.equal(h.calls.length,0);}});
test('an admin cannot review their own deposit or submit one',async()=>{const h=harness({owner:'admin-id'});for(const decision of ['approve','reject'])assert.equal((await h.review(form({decision}))).result,'error');const f=new FormData();f.set('acknowledged','on');assert.equal((await h.submit(f)).result,'error');assert.equal(h.calls.length,0);});
test('non-admins cannot review deposits',async()=>{const h=harness({role:'client'});assert.equal((await h.review(form())).result,'error');assert.equal(h.calls.length,0);});
