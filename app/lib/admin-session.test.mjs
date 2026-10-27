import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const load=(file,modules={})=>{const code=ts.transpileModule(readFileSync(new URL(file,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;const m={exports:{}};new Function('require','module','exports',code)(n=>{assert.ok(modules[n],n);return modules[n];},m,m.exports);return m.exports;};
const {getAdminMfaStatus,hasAdminSession,ADMIN_MFA_REQUIRED}=load('./admin-session.ts',{'./admin':load('./admin.ts')});
const admin={id:'admin-id',app_metadata:{role:'admin'}};
const enrolled={...admin,factors:[{id:'f',factor_type:'totp',status:'verified'}]};
const client=(claims,error=null)=>({auth:{getClaims:async()=>({data:claims?{claims}:null,error})}});
test('a confirmed second factor (aal2) for the same account is required once one is enrolled',async()=>{
 assert.equal(await getAdminMfaStatus(client({sub:'admin-id',aal:'aal2'}),enrolled),'verified');
 assert.equal(await getAdminMfaStatus(client({sub:'admin-id',aal:'aal1'}),enrolled),'challenge');
 assert.equal(await getAdminMfaStatus(client({sub:'someone-else',aal:'aal2'}),enrolled),'challenge');
 assert.equal(await getAdminMfaStatus(client(null,{message:'invalid JWT'}),enrolled),'challenge');
 assert.equal(await hasAdminSession(client({sub:'admin-id',aal:'aal1'}),enrolled),false);
 assert.equal(await hasAdminSession(client({sub:'admin-id',aal:'aal2'}),enrolled),true);
});
test('only verified factors count; admins without one are refused until they enroll',async()=>{
 const pending={...admin,factors:[{id:'f',factor_type:'totp',status:'unverified'}]};
 assert.equal(await getAdminMfaStatus(client({sub:'admin-id',aal:'aal1'}),pending),'enroll');
 assert.equal(ADMIN_MFA_REQUIRED,true);
 assert.equal(await hasAdminSession(client({sub:'admin-id',aal:'aal1'}),admin),false);
 assert.equal(await hasAdminSession(client({sub:'admin-id',aal:'aal1'}),pending),false);
});
test('non-admins never pass, whatever their assurance level',async()=>{
 for(const user of [null,undefined,{id:'c',app_metadata:{role:'client'}},{id:'c',user_metadata:{role:'admin'}}])
  assert.equal(await hasAdminSession(client({sub:user?.id,aal:'aal2'}),user),false);
});
