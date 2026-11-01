import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
function load(path, auth, notify = async () => {}, after = callback => callback()) {
 const modules={'@/app/lib/admin':{isAdminUser:u=>u?.app_metadata?.role==='admin'},'@/app/lib/registration-notification':{notifyAdminOfRegistration:notify},'next/server':{after,NextResponse:{json:(b,i)=>Response.json(b,i),redirect:u=>Response.redirect(u,307)}},'@/app/lib/i18n':{getRequestLocale:()=> 'en'},'@/app/lib/translate':{createTranslator:()=>s=>s},'@/lib/supabase/server':{createClient:async()=>({auth})},'../../../lib/supabase/server':{createClient:async()=>({auth})},'@supabase/supabase-js':{createClient:()=>({auth})}};
 const code=ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const m={exports:{}};new Function('require','module','exports','process',code)(n=>{assert.ok(n in modules,n);return modules[n]},m,m.exports,{env:{NEXT_PUBLIC_SITE_URL:'https://www.brickwise-immo.de',NEXT_PUBLIC_SUPABASE_URL:'https://example.invalid',NEXT_PUBLIC_SUPABASE_ANON_KEY:'fixture'}});return m.exports;
}
const req=(body,headers={})=>new Request('https://www.brickwise-immo.de/interface/register',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://www.brickwise-immo.de',...headers},body:JSON.stringify(body)});
// Supabase with "Confirm email" off: signUp returns the new user together with a session.
const session={access_token:'fixture',refresh_token:'fixture'};
const signedUp=(user={})=>({data:{user:{id:'new-user',created_at:'2026-10-15T10:00:00Z',identities:[{}],app_metadata:{},...user},session},error:null});
test('signup normalizes email, keeps the canonical callback for the fallback and signs the client straight in',async()=>{let sent;const {POST}=load('app/interface/register/route.ts',{signUp:async p=>{sent=p;return signedUp()},signInWithPassword:()=>assert.fail('A returned session needs no second sign-in')});const r=await POST(req({full_name:' Test User ',email:' TEST@example.invalid ',password:'aStrongPass1'}));assert.equal(r.status,201);assert.deepEqual(await r.json(),{success:true,alreadyRegistered:false,signedIn:true,redirectTo:'/dashboard'});assert.equal(sent.email,'test@example.invalid');assert.equal(sent.options.emailRedirectTo,'https://www.brickwise-immo.de/authentication/callback');assert.equal(sent.options.data.full_name,'Test User');});
test('signup rejects malformed input without contacting Auth',async()=>{const {POST}=load('app/interface/register/route.ts',{signUp:()=>assert.fail('Auth must not be called')});for(const body of [null,[],{}, {full_name:'Test',email:'bad',password:'short'}])assert.equal((await POST(req(body))).status,400);});
test('resend rejects null and invalid email and uses canonical redirect for valid email',async()=>{let calls=0;const {POST}=load('app/interface/confirmation-email/route.ts',{resend:async p=>{calls++;assert.equal(p.type,'signup');assert.equal(p.options.emailRedirectTo,'https://www.brickwise-immo.de/authentication/callback');return {error:null}}});for(const body of [null,[],{email:'invalid'}])assert.equal((await POST(req(body))).status,400);assert.equal(calls,0);assert.equal((await POST(req({email:'test@example.invalid'}))).status,200);assert.equal(calls,1);});
test('confirmation token works without PKCE cookie and ignores external next destinations',async()=>{let verified;const {GET}=load('app/authentication/callback/route.ts',{verifyOtp:async p=>{verified=p;return {error:null}}});const r=await GET(new Request('https://www.brickwise-immo.de/authentication/callback?token_hash=fixture&type=email&next=https://attacker.invalid'));assert.deepEqual(verified,{token_hash:'fixture',type:'email'});assert.equal(r.headers.get('location'),'https://www.brickwise-immo.de/dashboard');});
test('recovery code preserves both supported portals',async()=>{const {GET}=load('app/authentication/callback/route.ts',{exchangeCodeForSession:async()=>({error:null})});for(const portal of ['admin','client']){const next='/update-password?portal='+portal;const r=await GET(new Request('https://www.brickwise-immo.de/authentication/callback?code=fixture&next='+encodeURIComponent(next)));assert.equal(r.headers.get('location'),'https://www.brickwise-immo.de'+next);}});
test('expired confirmation and recovery links return actionable error routes',async()=>{const {GET}=load('app/authentication/callback/route.ts',{verifyOtp:async()=>({error:{message:'expired'}})});for(const recovery of [false,true]){const r=await GET(new Request('https://www.brickwise-immo.de/authentication/callback?token_hash=fixture&type=email'+(recovery?'&next='+encodeURIComponent('/update-password?portal=admin'):'')));assert.equal(r.headers.get('location'),'https://www.brickwise-immo.de'+(recovery?'/forgot-password?error=invalid-link&portal=admin':'/sign-in?error=invalid-link'));}});

test('only new accounts notify the admin after the response',async()=>{
 for(const duplicate of [false,true]){
  const pending=[];const notices=[];
  const {POST}=load('app/interface/register/route.ts',{signUp:async()=>duplicate?{data:{user:{id:'new-user',created_at:'2026-10-15T10:00:00Z',identities:[]},session:null},error:null}:signedUp()},async u=>notices.push(u),cb=>pending.push(cb));
  assert.equal((await POST(req({full_name:' Test ',email:'USER@example.invalid',password:'aStrongPass1'}))).status,duplicate?200:201);
  assert.equal(notices.length,0);assert.equal(pending.length,duplicate?0:1);
  for(const cb of pending)await cb();
  if(!duplicate)assert.deepEqual(notices[0],{id:'new-user',name:'Test',email:'user@example.invalid',createdAt:'2026-10-15T10:00:00Z'});
 }
});

test('signup continues only to a property page, otherwise to the dashboard', async () => {
 for (const [next, stored] of [['/properties/calgary-beltline-rental', '/properties/calgary-beltline-rental'], ['https://attacker.invalid', null], ['/admin', null], ['//attacker.invalid', null], [undefined, null]]) {
  let sent;
  const {POST} = load('app/interface/register/route.ts', {signUp: async p => { sent = p; return signedUp(); }});
  const r = await POST(req({full_name: 'Test', email: 'user@example.invalid', password: 'aStrongPass1', next}));
  assert.equal(r.status, 201);
  assert.equal((await r.json()).redirectTo, stored || '/dashboard', String(next));
  assert.equal(sent.options.data.signup_next, stored, String(next));
  assert.equal(sent.options.emailRedirectTo, 'https://www.brickwise-immo.de/authentication/callback');
 }
});

test('confirmation returns a new client to the stored property once and ignores unsafe values', async () => {
 for (const [stored, expected] of [['/properties/calgary-beltline-rental', '/properties/calgary-beltline-rental'], ['https://attacker.invalid', '/dashboard'], [undefined, '/dashboard']]) {
  const updates = [];
  const {GET} = load('app/authentication/callback/route.ts', {
   verifyOtp: async () => ({error: null}),
   getUser: async () => ({data: {user: {user_metadata: stored === undefined ? {} : {signup_next: stored}}}}),
   updateUser: async p => { updates.push(p); return {error: null}; },
  });
  const r = await GET(new Request('https://www.brickwise-immo.de/authentication/callback?token_hash=fixture&type=email'));
  assert.equal(r.headers.get('location'), 'https://www.brickwise-immo.de' + expected);
  assert.deepEqual(updates, expected === '/dashboard' ? [] : [{data: {signup_next: null}}]);
 }
});

test('without a session from signUp the client is signed in with the same credentials', async () => {
 const signIns = [];
 const {POST} = load('app/interface/register/route.ts', {
  signUp: async () => ({data: {user: {id: 'new-user', created_at: '2026-10-15T10:00:00Z', identities: [{}]}, session: null}, error: null}),
  signInWithPassword: async p => { signIns.push(p); return {data: {user: {id: 'new-user', app_metadata: {}}, session}, error: null}; },
 });
 const r = await POST(req({full_name: 'Test', email: ' USER@example.invalid ', password: 'aStrongPass1', next: '/properties/calgary-beltline-rental'}));
 assert.equal(r.status, 201);
 assert.deepEqual(await r.json(), {success: true, alreadyRegistered: false, signedIn: true, redirectTo: '/properties/calgary-beltline-rental'});
 assert.deepEqual(signIns, [{email: 'user@example.invalid', password: 'aStrongPass1'}]);
});

test('if Supabase still refuses the sign-in, the join form gets a clear next step instead of a dead end', async () => {
 for (const [signInError, confirmationRequired] of [[{code: 'email_not_confirmed', status: 400, message: 'Email not confirmed'}, true], [{status: 429, message: 'Request rate limit reached'}, false]]) {
  const pending = [];
  const {POST} = load('app/interface/register/route.ts', {
   signUp: async () => ({data: {user: {id: 'new-user', created_at: '2026-10-15T10:00:00Z', identities: [{}]}, session: null}, error: null}),
   signInWithPassword: async () => ({data: {user: null, session: null}, error: signInError}),
  }, async () => {}, cb => pending.push(cb));
  const originalError = console.error; console.error = () => {};
  try {
   const r = await POST(req({full_name: 'Test', email: 'user@example.invalid', password: 'aStrongPass1'}));
   assert.equal(r.status, 201);
   assert.deepEqual(await r.json(), {success: true, alreadyRegistered: false, signedIn: false, confirmationRequired});
  } finally { console.error = originalError; }
  assert.equal(pending.length, 1, 'the account was created, so the admin is still notified');
 }
});

test('an existing account is reported when Supabase rejects the duplicate signUp (Confirm email off)', async () => {
 for (const error of [{code: 'user_already_exists', status: 422, message: 'User already registered'}, {status: 422, message: 'User already registered'}]) {
  const pending = [];
  const {POST} = load('app/interface/register/route.ts', {
   signUp: async () => ({data: {user: null, session: null}, error}),
   signInWithPassword: () => assert.fail('An existing account must not be signed in by registration'),
  }, async () => {}, cb => pending.push(cb));
  const r = await POST(req({full_name: 'Test', email: 'user@example.invalid', password: 'aStrongPass1'}));
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), {success: true, alreadyRegistered: true});
  assert.equal(pending.length, 0);
 }
});

test('registration refuses cross-site and non-JSON requests without contacting Auth (no login CSRF)', async () => {
 const {POST} = load('app/interface/register/route.ts', {signUp: () => assert.fail('Auth must not be called'), signInWithPassword: () => assert.fail('Auth must not be called')});
 const body = {full_name: 'Test', email: 'user@example.invalid', password: 'aStrongPass1'};
 assert.equal((await POST(req(body, {Origin: 'https://attacker.invalid'}))).status, 403);
 const noOrigin = new Request('https://www.brickwise-immo.de/interface/register', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)});
 assert.equal((await POST(noOrigin)).status, 403);
 assert.equal((await POST(req(body, {'Content-Type': 'text/plain'}))).status, 415);
});

test('an administrator is never sent into the client area after registration', async () => {
 const {POST} = load('app/interface/register/route.ts', {signUp: async () => signedUp({app_metadata: {role: 'admin'}})});
 const r = await POST(req({full_name: 'Test', email: 'user@example.invalid', password: 'aStrongPass1', next: '/properties/calgary-beltline-rental'}));
 assert.equal((await r.json()).redirectTo, '/admin');
});

test('the join form follows the registration result and never waits for email confirmation', () => {
 const form = readFileSync('app/join/JoinForm.tsx', 'utf8');
 assert.match(form, /data\.signedIn\?/);
 assert.doesNotMatch(form, /assign\(`\/sign-in\?registered=1/, 'a signed-in registration must not be sent to the confirmation notice');
 const copy = readFileSync('app/join/page.tsx', 'utf8');
 assert.doesNotMatch(copy, /we'll verify it|wir werden sie bestätigen|nous la vérifierons|lo verificaremos|lo verificheremo/);
});
