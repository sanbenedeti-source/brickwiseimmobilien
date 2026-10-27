import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const code=ts.transpileModule(readFileSync('app/lib/registration-notification.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const user={id:'fixture',name:'New user',email:'new@example.invalid',createdAt:'2026-10-15T10:00:00Z'};
function load(fetch,env={RESEND_SMTP_PASSWORD:'secret',ADMIN_EMAILS:'admin@example.invalid'}){const m={exports:{}};new Function('module','exports','process','fetch','setTimeout',code)(m,m.exports,{env},fetch,cb=>cb());return m.exports.notifyAdminOfRegistration;}
test('notification retries transient failures with the same idempotency key and no password',async()=>{const calls=[];await load(async(url,init)=>{calls.push({url,...init});return {ok:calls.length>1,status:503};})(user);assert.equal(calls.length,2);assert.equal(calls[0].body,calls[1].body);assert.equal(calls[0].headers['Idempotency-Key'],'registration/fixture');const body=JSON.parse(calls[0].body);assert.deepEqual(body.to,['admin@example.invalid']);assert.ok(body.text.includes(user.email));assert.ok(!body.text.includes('secret'));});
test('configuration and permanent delivery errors are reported',async()=>{await assert.rejects(load(()=>assert.fail('must not send'),{})(user),/configuration/);let calls=0;await assert.rejects(load(async()=>{calls++;return {ok:false,status:403}})(user),/403/);assert.equal(calls,1);});
