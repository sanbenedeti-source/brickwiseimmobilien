import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {isEuroCurrency,parseEuroAmount} from './euro-amount.ts';
import * as crypto from 'node:crypto';
function compile(path,modules,env={}){const code=ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;const m={exports:{}};new Function('require','module','exports','process',code)(n=>{assert.ok(n in modules,n);return modules[n]},m,m.exports,{env});return m.exports;}
const helper=compile('app/lib/admin-audit.ts',{});
function harness({admin=false,failed=false}={}){
 const calls=[],paths=[];
 const service={rpc:async(name,args)=>{calls.push({name,args});return failed?{error:{code:'P0001'},data:null}:{error:null,data:args.p_operations.map(op=>op.data)};}};
 const modules={'node:crypto':crypto,'next/cache':{revalidatePath:p=>paths.push(p)},'@supabase/supabase-js':{createClient:()=>service},'@/app/lib/admin-audit':helper,'@/app/lib/admin':{isAdminUser:u=>u?.app_metadata?.role==='admin'},'@/app/lib/admin-session':{hasAdminSession:async(_c,u)=>u?.app_metadata?.role==='admin'},'@/lib/supabase/server':{createClient:async()=>({auth:{getUser:async()=>({data:{user:admin?{id:'trusted-admin',app_metadata:{role:'admin'}}:null},error:null})}})},'./euro-amount':{isEuroCurrency,parseEuroAmount},'@/app/lib/i18n':{getRequestLocale:()=> 'en'},'@/app/lib/api-copy':{apiCopy:{en:{propertySaveFailed:'Failed',adminRequired:'Admin required',invalidProperty:'Invalid',importNote:'Imported'}}}};
 const {POST}=compile('app/api/properties/import/route.ts',modules,{PROPERTY_IMPORT_API_KEY:'fixture-key',NEXT_PUBLIC_SUPABASE_URL:'https://example.invalid',SUPABASE_SERVICE_ROLE_KEY:'fixture-service'});
 return {calls,paths,run:(payload,key='fixture-key')=>POST(new Request('https://example.invalid/api/properties/import',{method:'POST',headers:{'x-api-key':key,'Content-Type':'application/json'},body:JSON.stringify(payload)}))};
}
const input=[{title:'One',city:'Test',price:100,currency:'EUR'},{title:'Two',city:'Test',price:200,currency:'EUR'}];
test('API imports send the entire validated batch and audit event in one RPC',async()=>{const h=harness();const r=await h.run(input);assert.equal(r.status,200);assert.equal(h.calls.length,1);assert.equal(h.calls[0].name,'admin_write_audited');assert.equal(h.calls[0].args.p_actor,null);assert.equal(h.calls[0].args.p_action,'property.import');assert.equal(h.calls[0].args.p_operations.length,2);assert.equal((await r.json()).savedCount,2);});
test('admin session identity comes from authentication and import uses the service transaction',async()=>{const h=harness({admin:true});const r=await h.run(input,'');assert.equal(r.status,200);assert.equal(h.calls[0].args.p_actor,'trusted-admin');});
test('audit failure cannot report a successful or partial import',async()=>{const h=harness({failed:true});const r=await h.run(input);assert.equal(r.status,500);assert.equal(h.paths.length,0);assert.equal((await r.json()).saved,undefined);});
test('unauthorized, invalid and empty imports never call the write RPC',async()=>{const h=harness();assert.equal((await h.run(input,'wrong')).status,401);assert.equal((await h.run([])).status,400);assert.equal((await h.run([{...input[0],currency:'CAD'}])).status,400);assert.equal(h.calls.length,0);});
test('unknown statuses are imported as hidden drafts and a key of another length is rejected',async()=>{const h=harness();const r=await h.run([{...input[0],status:'featured'},{...input[1],status:'available'},{title:'Three',city:'Test',price:300,currency:'EUR'}]);assert.equal(r.status,200);assert.deepEqual(h.calls[0].args.p_operations.map(op=>op.data.status),['draft','available','active']);assert.equal((await h.run(input,'fixture-key-longer')).status,401);});
