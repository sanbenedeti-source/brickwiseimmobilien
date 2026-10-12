import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import postcss from 'postcss';
import tailwind from '@tailwindcss/postcss';

// The actual components run with fixture-only auth and intercepted API traffic.
// Artifacts are kept out of the application and no production server is contacted.
const require = createRequire(import.meta.url);
const esbuild = require(process.env.ESBUILD_MODULE || 'C:/Users/User/AppData/Local/npm-cache/_npx/69f9afb961c37556/node_modules/esbuild/lib/main.js');
const { default: puppeteer } = await import(pathToFileURL(process.env.PUPPETEER_MODULE || 'C:/Users/User/AppData/Local/npm-cache/_npx/0f94ee7615faf582/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js').href);
const directory = path.resolve('project-backups/agreement-flow-2026-10-02/browser-automatic-signing');
mkdirSync(directory, { recursive: true });
const manifest = JSON.parse(readFileSync('app/lib/agreement-manifest.json', 'utf8'));

const mocks = {
  'next/link': `import React from 'react'; export default function Link({href,children,...props}){return <a href={href} {...props}>{children}</a>}`,
  'next/navigation': `export const usePathname=()=>'/dashboard'; export const useSearchParams=()=>new URLSearchParams(location.search);`,
  '@/lib/supabase/client': `export const createClient=()=>({auth:{getUser:async()=>{const response=await fetch('/audit-user');return response.json()},updateUser:async payload=>{const response=await fetch('/audit-profile-save',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});return response.json()}}});`,
};
const entry = `
import React, {useState} from 'react';
import {createRoot} from 'react-dom/client';
import ClientAgreement from './app/components/ClientAgreement';
import ClientPortalSidebar from './app/components/ClientPortalSidebar';
import LocaleProvider from './app/components/LocaleProvider';
import {agreementCopy} from './app/lib/agreement-copy';
function App(){
 const params=new URLSearchParams(location.search);
 const [locale,setLocale]=useState(params.get('lang')||'en');
 window.auditSetLocale=setLocale;window.auditCopy=agreementCopy(locale);
 return <LocaleProvider locale={locale}>{params.get('view')==='profile'
  ? <ClientPortalSidebar active="account" email="fixture@example.invalid" fullName="Fixture Customer" locale={locale}/>
  : <main style={{maxWidth:920,margin:'24px auto',padding:'0 16px'}}><ClientAgreement locale={locale} signerName="Fixture Customer" canSign={true} beforeSign={async()=>{}}/></main>}
 </LocaleProvider>
}
createRoot(document.getElementById('root')).render(<App/>);
`;
await esbuild.build({ absWorkingDir: process.cwd(), tsconfigRaw: { compilerOptions: { jsx: 'react-jsx' } },
  nodePaths: [path.resolve('node_modules')], stdin: { contents: entry, resolveDir: process.cwd(), loader: 'tsx', sourcefile: 'agreement-audit-entry.tsx' },
  bundle: true, platform: 'browser', format: 'iife', jsx: 'automatic', outfile: path.join(directory, 'bundle.js'),
  define: { 'process.env.NODE_ENV': '"production"' },
  plugins: [{ name: 'fixture-services', setup(build) {
    build.onResolve({ filter: /^(next\/link|next\/navigation|@\/lib\/supabase\/client)$/ }, args => ({ path: args.path, namespace: 'fixture' }));
    build.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: mocks[args.path], loader: 'tsx', resolveDir: process.cwd() }));
  } }],
});
const css = await postcss([tailwind()]).process(readFileSync('app/globals.css', 'utf8'), { from: path.resolve('app/globals.css') });
writeFileSync(path.join(directory, 'styles.css'), css.css + '\n:root{--font-inter:Arial}html,body{overflow-x:visible!important}');
writeFileSync(path.join(directory, 'index.html'), '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/styles.css"><title>Agreement component fixture</title></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>');

const server = createServer((request, response) => {
  const resource = new URL(request.url, 'http://localhost').pathname;
  const file = { '/': ['index.html', 'text/html'], '/bundle.js': ['bundle.js', 'text/javascript'], '/styles.css': ['styles.css', 'text/css'] }[resource];
  if (!file) { response.writeHead(404); response.end(); return; }
  response.writeHead(200, { 'Content-Type': file[1], 'Cache-Control': 'no-store' });
  response.end(readFileSync(path.join(directory, file[0])));
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
let browser;
const report = { assertions: [], screenshots: [], limitations: [
  'Actual React components and generated Tailwind CSS are bundled outside Next.js; Next routing and Supabase auth are fixture stubs.',
  'The fixture supplies Arial for the Next-managed Inter font variable; production font loading is not exercised.',
  'All agreement and profile-save requests are intercepted. This does not prove production authentication, SQL/RLS behavior, deployment or PDF rendering.',
] };
function passed(message) { report.assertions.push(message); console.log(`PASS: ${message}`); }
try {
  browser = await puppeteer.launch({ executablePath: process.env.CHROME_BIN || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const page = await browser.newPage();
  const browserErrors = [], externalRequests = [], posts = [], profileSaves = [], requestOrder = [];
  page.on('pageerror', error => browserErrors.push(error.message));
  const initialMetadata = () => ({ full_name: 'Fixture Customer', first_name: 'Fixture', last_name: 'Customer' });
  const initialState = () => ({ acceptance: null, getStatus: 200, postStatus: 200, profileStatus: 200, emailConfirmed: true, metadata: initialMetadata() });
  let state = initialState();
  function user() { return { id: 'fixture-client', email: 'fixture@example.invalid', user_metadata: state.metadata }; }
  function documentFor(locale) {
    const item = manifest.documents.find(item => item.locale === locale);
    return { version: manifest.version, locale, path: item.path, sha256: item.sha256, consentText: item.consentText, isDraft: item.isDraft };
  }
  function payload(locale) { return { document: documentFor(locale), acceptance: state.acceptance, emailConfirmed: state.emailConfirmed }; }
  function accepted(locale = 'en', status = 'pending', signerName = 'Fixture Customer') {
    const document = documentFor(locale);
    return { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', version: manifest.version, signer_name: signerName, accepted_at: '2026-10-02T10:00:00Z', status,
      review_note: status === 'rejected' ? 'Please contact the team about the draft.' : null, locale,
      document_path: document.path, document_sha256: document.sha256, is_draft: document.isDraft };
  }
  await page.setRequestInterception(true);
  page.on('request', async request => {
    const url = new URL(request.url());
    if (url.protocol === 'data:' || url.protocol === 'blob:') { await request.continue(); return; }
    if (url.origin !== base) { externalRequests.push(request.url()); await request.abort(); return; }
    if (url.pathname === '/api/client-agreements') {
      if (request.method() === 'POST') {
        const body = JSON.parse(request.postData());
        posts.push(body);
        requestOrder.push('agreement-post');
        await new Promise(resolve => setTimeout(resolve, 80));
        if (state.postStatus === 200) state.acceptance = accepted(body.locale, 'pending', body.signerName);
        await request.respond({ status: state.postStatus, contentType: 'application/json', body: JSON.stringify(state.postStatus === 200 ? payload(body.locale) : { error: 'fixture_error' }) });
      } else {
        await request.respond({ status: state.getStatus, contentType: 'application/json', body: JSON.stringify(state.getStatus === 200 ? payload(url.searchParams.get('lang') || 'en') : { error: 'fixture_error' }) });
      }
      return;
    }
    if (url.pathname === '/audit-user') {
      await request.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { user: user() }, error: null }) });
      return;
    }
    if (url.pathname === '/audit-profile-save') {
      const body = JSON.parse(request.postData());
      profileSaves.push(body);
      requestOrder.push('profile-save-start');
      await new Promise(resolve => setTimeout(resolve, 80));
      if (state.profileStatus === 200) state.metadata = { ...state.metadata, ...body.data };
      requestOrder.push(state.profileStatus === 200 ? 'profile-save-complete' : 'profile-save-failed');
      await request.respond({ status: state.profileStatus, contentType: 'application/json', body: JSON.stringify({ data: { user: user() }, error: state.profileStatus === 200 ? null : { message: 'fixture_profile_failure' } }) });
      return;
    }
    await request.continue();
  });

  const waitReady = () => page.waitForFunction(() => Boolean(document.querySelector('section[aria-busy="false"]')));
  async function navigate(locale = 'en', extra = '') {
    await page.goto(`${base}/?lang=${locale}${extra}`, { waitUntil: 'networkidle0' });
    await waitReady();
  }
  async function openProfile(locale = 'en') {
    await page.goto(`${base}/?lang=${locale}&view=profile`, { waitUntil: 'networkidle0' });
    await page.evaluate(() => document.querySelectorAll('aside nav > button')[1].click());
    await page.waitForSelector('dialog[open] input[name="first_name"]');
    await waitReady();
  }
  async function clickCopy(key) {
    await page.evaluate(key => {
      const button = [...document.querySelectorAll('button')].find(button => button.textContent.trim() === window.auditCopy[key]);
      if (!button) throw new Error(`Missing button ${key}`);
      button.click();
    }, key);
  }
  async function isDisabled(key) {
    return page.evaluate(key => [...document.querySelectorAll('button')].find(button => button.textContent.trim() === window.auditCopy[key])?.disabled, key);
  }
  async function fillField(field, value) {
    const input = await page.$(`dialog input[name="${field}"]`);
    assert.ok(input, `Missing profile input ${field}`);
    await input.focus();
    await input.evaluate(node => node.select());
    await page.keyboard.press('Backspace');
    if (value) await input.type(value);
  }
  async function waitStatus(key) {
    await page.waitForFunction(key => [...document.querySelectorAll('[role="status"]')].some(node => node.textContent === window.auditCopy[key]), {}, key);
  }
  async function screenshot(name, scrollToDocument = false) {
    if (scrollToDocument) await page.$eval('section', node => node.scrollIntoView({ block: 'end' }));
    const file = path.join(directory, name);
    await page.screenshot({ path: file, fullPage: true });
    report.screenshots.push(file);
  }

  async function profileComplete() {
    return page.evaluate(() => document.querySelector('dialog')?.textContent.includes(window.auditCopy.profileComplete));
  }

  async function assertDocumentBelowForm() {
    assert.equal(await page.$eval('dialog section', node => {
      const form = document.querySelector('dialog form');
      return Boolean(form && (form.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING));
    }), true, 'Document follows the profile form');
    assert.equal(await page.$('dialog section input'), null, 'No duplicate signer field or checkbox');
  }

  await page.setViewport({ width: 1280, height: 960 });
  await navigate();
  assert.equal(await isDisabled('accept'), false);
  assert.equal(await page.$('section input'), null);
  await screenshot('agreement-required-desktop.png');
  await page.evaluate(() => {
    const button = [...document.querySelectorAll('button')].find(button => button.textContent.trim() === window.auditCopy.accept);
    button.click(); button.click();
  });
  await waitStatus('signed');
  assert.deepEqual(posts, [{ version: manifest.version, locale: 'en', signerName: 'Fixture Customer', consent: true }]);
  assert.equal(await page.$('section input'), null);
  assert.ok(await page.$('a[href$="/receipt"]'));
  await page.reload({ waitUntil: 'networkidle0' });
  await waitStatus('signed');
  assert.equal(posts.length, 1);
  passed('Explicit Sign automatically action uses the supplied profile name, sends one request for rapid clicks, and persisted pending acceptance displays Signed with a receipt.');

  await navigate('de');
  await waitStatus('signed');
  assert.equal(await page.$eval('section a[href$=".pdf"]', node => node.getAttribute('href')), documentFor('en').path);
  passed('An English acceptance retains its original PDF when the display language changes to German.');

  for (const status of ['rejected', 'approved']) {
    state.acceptance = accepted('en', status);
    await navigate();
    await waitStatus(status === 'approved' ? 'signed' : status);
    assert.equal(await page.$('section input'), null);
    if (status === 'rejected') assert.equal(await page.evaluate(() => document.body.textContent.includes(window.auditCopy.rejectedDescription)), true);
  }
  passed('Rejected and approved acceptances show their review copy and cannot open a new signature form.');

  state = { ...initialState(), getStatus: 503 };
  await navigate();
  assert.ok(await page.$('[role="alert"]'));
  state.getStatus = 200;
  await clickCopy('retry');
  await waitReady();
  await page.waitForFunction(() => [...document.querySelectorAll('button')].some(button => button.textContent.trim() === window.auditCopy.accept && !button.disabled));
  assert.equal(await page.$('[role="alert"]'), null);
  passed('A failed status load can be retried successfully.');

  for (const status of [409, 503]) {
    state = { ...initialState(), postStatus: status };
    await navigate();
    await clickCopy('accept');
    await page.waitForSelector('[role="alert"]');
    assert.equal(await isDisabled('accept'), true);
    const previousPosts = posts.length;
    await clickCopy('accept');
    assert.equal(posts.length, previousPosts);
    state.postStatus = 200;
    await clickCopy('retry');
    await waitReady();
    assert.equal(await isDisabled('accept'), false);
    assert.equal(posts.length, previousPosts, 'Refreshing alone never signs');
    await clickCopy('accept');
    await waitStatus('signed');
    assert.equal(posts.length, previousPosts + 1);
  }
  passed('Stale document and agreement write failures block signing until refresh; refresh alone never signs, and a new explicit click succeeds.');

  state = { ...initialState(), emailConfirmed: false };
  await navigate();
  assert.equal(await isDisabled('accept'), true);
  passed('An unconfirmed email cannot submit acceptance.');

  state = initialState();
  for (const viewport of [{ width: 1280, height: 960 }, { width: 390, height: 844 }]) {
    await page.setViewport(viewport);
    for (const locale of ['en', 'de', 'fr', 'es', 'it']) {
      await navigate(locale);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, `${locale} at ${viewport.width}px`);
      assert.equal(await page.$eval('section h3', node => node.textContent), await page.evaluate(() => window.auditCopy.title));
      assert.equal(await page.$eval('section a[href$=".pdf"]', node => node.getAttribute('href')), documentFor(locale).path);
      if (locale === 'de' && viewport.width === 390) await screenshot('agreement-required-mobile-de.png');
    }
  }
  passed('All five locales show matching PDF links and fit desktop 1280px and mobile 390px without horizontal overflow.');

  await navigate('en');
  assert.equal(await isDisabled('accept'), false);
  const postsBeforeLocaleChange = posts.length;
  await page.evaluate(() => window.auditSetLocale('de'));
  await page.waitForFunction(() => window.auditCopy.title === 'Profildokument');
  await waitStatus('required');
  assert.equal(await page.$eval('section a[href$=".pdf"]', node => node.getAttribute('href')), documentFor('de').path);
  assert.equal(posts.length, postsBeforeLocaleChange);
  passed('Changing language loads the matching document without signing it.');

  await page.setViewport({ width: 1280, height: 1000 });
  state = initialState();
  await openProfile();
  await assertDocumentBelowForm();
  assert.equal(await profileComplete(), false);
  await fillField('phone', '+49123456789');
  const previousPosts = posts.length;
  const previousSaves = profileSaves.length;
  await page.evaluate(() => [...document.querySelectorAll('dialog button')].find(node => node.textContent.trim() === 'Save profile').click());
  await page.waitForFunction(() => document.querySelector('dialog')?.textContent.includes('Profile saved successfully.'));
  assert.equal(profileSaves.length, previousSaves + 1);
  assert.equal(profileSaves.at(-1).data.phone, '+49123456789');
  assert.equal(posts.length, previousPosts);
  assert.equal(state.acceptance, null);
  passed('The document appears after the profile form without extra inputs; ordinary Save profile persists contact changes and never signs.');

  state = initialState();
  await openProfile();
  for (const field of ['first_name', 'last_name']) {
    await fillField(field, '');
    assert.equal(await isDisabled('accept'), true, `Signing requires ${field}`);
    await clickCopy('accept');
    assert.equal(posts.length, previousPosts);
    await fillField(field, '   ');
    assert.equal(await isDisabled('accept'), true, `Whitespace-only ${field} cannot sign`);
    await fillField(field, field === 'first_name' ? 'Fixture' : 'Customer');
  }
  assert.equal(await isDisabled('accept'), false);
  passed('Both profile names are required; empty and whitespace-only first or last names cannot sign.');

  state = { ...initialState(), profileStatus: 503 };
  await openProfile();
  await fillField('first_name', 'Updated');
  const postsBeforeFailedProfile = posts.length;
  const savesBeforeFailedProfile = profileSaves.length;
  await clickCopy('accept');
  await page.waitForFunction(() => document.querySelector('dialog')?.textContent.includes('Your profile could not be saved. Please try again.'));
  await waitReady();
  assert.equal(profileSaves.length, savesBeforeFailedProfile + 1);
  assert.equal(posts.length, postsBeforeFailedProfile);
  assert.equal(state.acceptance, null);
  assert.equal(await profileComplete(), false);
  passed('A failed profile save never sends a signature and never completes the profile.');

  state = initialState();
  await openProfile();
  await fillField('first_name', '  Updated  ');
  await fillField('last_name', '  Customer  ');
  await fillField('phone', '+49123456789');
  const postsBeforeProfileSign = posts.length;
  const savesBeforeProfileSign = profileSaves.length;
  requestOrder.length = 0;
  await screenshot('profile-sign-automatically-desktop.png', true);
  await page.evaluate(() => {
    const button = [...document.querySelectorAll('dialog button')].find(node => node.textContent.trim() === window.auditCopy.accept);
    button.click(); button.click(); button.click();
  });
  await waitStatus('signed');
  await page.waitForFunction(() => document.querySelector('dialog')?.textContent.includes(window.auditCopy.profileComplete));
  assert.equal(profileSaves.length, savesBeforeProfileSign + 1);
  assert.equal(posts.length, postsBeforeProfileSign + 1);
  assert.deepEqual(requestOrder, ['profile-save-start', 'profile-save-complete', 'agreement-post']);
  assert.equal(profileSaves.at(-1).data.first_name, 'Updated');
  assert.equal(profileSaves.at(-1).data.full_name, 'Updated Customer');
  assert.deepEqual(posts.at(-1), { version: manifest.version, locale: 'en', signerName: 'Updated Customer', consent: true });
  assert.equal(state.acceptance.status, 'pending');
  assert.equal(await profileComplete(), true);
  assert.ok(await page.$('dialog a[href$="/receipt"]'));
  await screenshot('profile-complete-desktop.png', true);
  passed('Sign automatically saves edited profile fields before posting the trimmed full name once, and a persisted pending acceptance immediately completes the profile step.');

  await openProfile('de');
  await waitStatus('signed');
  assert.equal(await profileComplete(), true);
  assert.equal(await page.$eval('dialog input[name="first_name"]', node => node.value), 'Updated');
  assert.equal(await page.$eval('dialog section a[href$=".pdf"]', node => node.getAttribute('href')), documentFor('en').path);
  assert.equal(await page.$eval('dialog section', node => node.textContent.includes('Updated Customer')), true);
  assert.ok(await page.$('dialog a[href$="/receipt"]'));
  assert.equal(posts.length, postsBeforeProfileSign + 1);
  passed('Reopening the profile in another language preserves completed status, saved names, signer receipt, and the original English document.');

  state = { ...initialState(), acceptance: accepted('en', 'rejected') };
  await openProfile();
  await waitStatus('rejected');
  assert.equal(await profileComplete(), false);
  passed('A rejected acceptance does not complete the profile.');

  for (const viewport of [{ width: 1280, height: 1000 }, { width: 390, height: 844 }]) {
    await page.setViewport(viewport);
    for (const locale of ['en', 'de', 'fr', 'es', 'it']) {
      state = initialState();
      await openProfile(locale);
      await assertDocumentBelowForm();
      assert.equal(await page.evaluate(() => {
        const dialog = document.querySelector('dialog');
        const panel = dialog.firstElementChild;
        return document.documentElement.scrollWidth <= window.innerWidth && dialog.scrollWidth <= dialog.clientWidth && panel.scrollWidth <= panel.clientWidth;
      }), true, `Profile ${locale} at ${viewport.width}px fits horizontally`);
      assert.equal(await page.$eval('dialog section h3', node => node.textContent), await page.evaluate(() => window.auditCopy.title));
      assert.equal(await page.$eval('dialog section a[href$=".pdf"]', node => node.getAttribute('href')), documentFor(locale).path);
      assert.equal(await isDisabled('accept'), false);
      await screenshot(`profile-sign-automatically-${locale}-${viewport.width}.png`, true);
      await clickCopy('accept');
      await waitStatus('signed');
      assert.equal(posts.at(-1).locale, locale);
      assert.equal(posts.at(-1).signerName, 'Fixture Customer');
      assert.equal(await profileComplete(), true);
    }
  }
  passed('Every locale signs from the actual profile modal on 1280px desktop and 390px mobile, shows its matching PDF and localized completion, and fits without horizontal overflow.');

  assert.deepEqual(browserErrors, []);
  assert.deepEqual(externalRequests, []);
  report.result = 'PASS';
  report.mockedAcceptancePosts = posts.length;
  report.mockedProfileSaves = profileSaves.length;
  report.browserErrors = browserErrors;
  passed('No browser runtime errors and no external network requests.');
} catch (error) {
  report.result = 'FAIL';
  report.error = error.stack;
  throw error;
} finally {
  writeFileSync(path.join(directory, 'results.json'), JSON.stringify(report, null, 2) + '\n');
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
