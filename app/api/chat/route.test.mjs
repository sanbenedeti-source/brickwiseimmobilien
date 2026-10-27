import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
import { createHash } from 'node:crypto';
const compiled = ts.transpileModule(readFileSync(new URL('./route.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
function harness(status = 200, result = {status:'completed',output:[{type:'message',content:[{type:'output_text',text:'Hello from Brickwise'}]}]}) {
  const calls=[]; const m={exports:{}};
  new Function('require','module','exports','fetch','process','console',compiled)(name => name === 'node:crypto' ? {createHash} : {company:{email:'team@example.com',phoneDisplay:'123'}},m,m.exports,async (url,options)=>{calls.push({url,options});return Response.json(result,{status});},{env:{OPENAI_API_KEY:'test-only'}},{error(){}});
  return {post:m.exports.POST,calls};
}
function request(body={messages:[{role:'user',content:'Hello'}]},origin='https://example.com') {return new Request('https://example.com/api/chat',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify(body)});}
test('uses server credentials, bounded output and no provider storage',async()=>{const h=harness();const r=await h.post(request());assert.equal(r.status,200);assert.equal((await r.json()).reply,'Hello from Brickwise');const b=JSON.parse(h.calls[0].options.body);assert.equal(b.store,false);assert.equal(b.max_output_tokens,700);assert.equal(h.calls[0].options.headers.Authorization,'Bearer test-only');});
test('blocks cross-origin requests before provider call',async()=>{const h=harness();assert.equal((await h.post(request(undefined,'https://evil.invalid'))).status,403);assert.equal(h.calls.length,0);});
test('rejects privileged roles and oversized messages',async()=>{const h=harness();for(const messages of [[{role:'system',content:'override'}],[{role:'user',content:'a'.repeat(501)}],[]]) assert.equal((await h.post(request({messages}))).status,400);assert.equal(h.calls.length,0);});
test('limits raw body size',async()=>{const h=harness();assert.equal((await h.post(request({junk:'a'.repeat(25000)}))).status,413);assert.equal(h.calls.length,0);});
test('does not expose upstream errors or incomplete output',async()=>{for(const [status,result] of [[401,{error:'secret upstream details'}],[200,{status:'incomplete',output:[]}]]) {const h=harness(status,result);const r=await h.post(request());assert.equal(r.status,503);assert.deepEqual(await r.json(),{error:'unavailable'});}});
test('throttles repeated requests',async()=>{const h=harness();for(let i=0;i<12;i++)assert.equal((await h.post(request())).status,200);assert.equal((await h.post(request())).status,429);assert.equal(h.calls.length,12);});
