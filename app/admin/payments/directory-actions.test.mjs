import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { parseCompanyPaymentMethod } from '../../lib/company-payment-methods.ts';
const compiled=ts.transpileModule(readFileSync(new URL('./directory-actions.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
function harness(adminUser=true){
 const writes=[],paths=[];
 const database={from:table=>{const query={insert:payload=>{writes.push({table,payload,operation:'insert'});return query;},update:payload=>{writes.push({table,payload,operation:'update'});return query;},eq:()=>query,select:()=>query,single:async()=>({data:{id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'},error:null})};return query;}};
 const modules={
  'next/cache':{revalidatePath:path=>paths.push(path)},
  'next/navigation':{redirect:location=>{throw Object.assign(Error('redirect'),{location});}},
  '@/lib/supabase/server':{createClient:async()=>({auth:{getUser:async()=>({data:{user:{id:'admin',app_metadata:{role:adminUser?'admin':'client'}}}})}})},
  '@/app/lib/admin':{isAdminUser:user=>user?.app_metadata?.role==='admin'},'@/app/lib/admin-session':{hasAdminSession:async(_c,user)=>user?.app_metadata?.role==='admin'},
  '@/app/lib/company-payment-methods':{parseCompanyPaymentMethod},
  '@supabase/supabase-js':{createClient:()=>database},
  '@/app/lib/admin-audit':{writeAdminMutation:async(_client,event,ops)=>{assert.equal(event.action,'company_payment_method.save');for(const op of ops)writes.push({operation:op.operation,payload:op.data});return {error:null};}},
 };
 const loaded={exports:{}};
 new Function('require','module','exports','process',compiled)(name=>{assert.ok(modules[name],name);return modules[name];},loaded,loaded.exports,{env:{NEXT_PUBLIC_SUPABASE_URL:'https://example.invalid',SUPABASE_SERVICE_ROLE_KEY:'test-only'}});
 return {run:loaded.exports.saveCompanyPaymentMethod,writes,paths};
}
function form(values={}){const data=new FormData();for(const [k,v] of Object.entries({kind:'bank',bank_slot:'1',label:'Company EUR account',bank_name:'Example Bank',beneficiary:'Example Company',account_number:'EXAMPLE-ACCOUNT',...values}))data.set(k,v);return data;}
test('only administrators can save company receiving details',async()=>{const app=harness(false);await assert.rejects(app.run(form()),e=>e.location==='/sign-in');assert.equal(app.writes.length,0);});
test('bank details save as draft until activated and refresh the shared client views',async()=>{
 const app=harness();await assert.rejects(app.run(form()),e=>e.location?.endsWith('result=saved'));
 assert.equal(app.writes[0].payload.active,false);assert.equal(app.writes[0].payload.currency,'EUR');assert.equal(app.writes[0].payload.crypto_asset,null);
 assert.ok(app.paths.includes('/funding')&&app.paths.includes('/dashboard'));
});
test('editing an existing crypto wallet can publish or hide it without changing its address',async()=>{
 for(const active of ['on','']){const app=harness();await assert.rejects(app.run(form({id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',kind:'crypto',label:'Company BTC',crypto_asset:'btc',crypto_network:'Bitcoin',wallet_address:'example-address',active})),e=>e.location?.endsWith('result=saved'));
 assert.equal(app.writes[0].operation,'update');assert.equal(app.writes[0].payload.wallet_address,'example-address');assert.equal(app.writes[0].payload.active,active==='on');assert.equal(app.writes[0].payload.bank_slot,null);}
});
test('invalid bank slots, incomplete recipients and missing networks never write',async()=>{
 for(const values of [{bank_slot:'3'},{beneficiary:''},{account_number:''},{kind:'crypto',crypto_asset:'BTC',crypto_network:'',wallet_address:'example-address'},{id:'not-a-uuid'}]){const app=harness();await assert.rejects(app.run(form(values)),e=>e.location?.endsWith('result=invalid'));assert.equal(app.writes.length,0);}
});
