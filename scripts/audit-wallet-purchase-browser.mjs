import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import ts from 'typescript';
import postcss from 'postcss';
import tailwind from '@tailwindcss/postcss';

// This renders the actual calculator with synthetic balances and a mocked action.
// No account credentials, real wallet debits, or production requests are used.
const require = createRequire(import.meta.url);
const esbuild = require(process.env.ESBUILD_MODULE || 'C:/Users/User/AppData/Local/npm-cache/_npx/69f9afb961c37556/node_modules/esbuild/lib/main.js');
const { default: puppeteer } = await import(pathToFileURL(process.env.PUPPETEER_MODULE || 'C:/Users/User/AppData/Local/npm-cache/_npx/0f94ee7615faf582/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js').href);
const directory = path.resolve(process.env.WALLET_AUDIT_DIRECTORY || 'project-backups/wallet-buy-now-2026-10-02/browser');
mkdirSync(directory, { recursive: true });
const requestId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

// Use the page's actual translated calculator copy without loading its server code.
const pageSource = ts.createSourceFile('page.tsx', readFileSync('app/properties/[slug]/page.tsx', 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const detailCopySource = pageSource.statements.filter(statement =>
  (ts.isVariableStatement(statement) && statement.declarationList.declarations.some(declaration => declaration.name.getText(pageSource) === 'detailCopy'))
  || (ts.isExpressionStatement(statement) && /^detailCopy\.(fr|es|it)\s*=/.test(statement.getText(pageSource)))
).map(statement => statement.getText(pageSource)).join('\n');
assert.ok(detailCopySource.includes('const detailCopy'), 'Page calculator copy is available');

const entry = `
import React from 'react';
import {createRoot} from 'react-dom/client';
import InvestmentCalculator from './app/properties/[slug]/InvestmentCalculator';
import LocaleProvider from './app/components/LocaleProvider';
import {investmentCopy} from './app/lib/investment-copy';
import {walletPurchaseCopy} from './app/lib/wallet-purchase-copy';
import {formatPropertyMoney} from './app/lib/property-financials';
${detailCopySource}
const params=new URLSearchParams(location.search);
const locale=params.get('lang')||'en';
const balance=params.get('balance')==='unavailable'?null:Number(params.get('balance')??25000);
window.auditText={...investmentCopy[locale],...walletPurchaseCopy[locale]};window.auditCopy=detailCopy[locale].calculator;
window.auditMoney=value=>formatPropertyMoney(value,'EUR',locale,2);
window.auditPosts=[];window.auditPending=false;window.auditActionCompleted=0;
const purchaseAction=async formData=>{
  window.auditPosts.push(Object.fromEntries(formData));window.auditPending=true;
  await new Promise(resolve=>setTimeout(resolve,200));
  window.auditPending=false;window.auditActionCompleted++;
};
const props={annualYield:28,targetTotalReturn:28,availableShares:Number(params.get('available')??2650),
  copy:detailCopy[locale].calculator,currency:'EUR',fundedPercent:0,isAuthenticated:params.get('auth')!=='false',
  minInvestment:2000,locale,monthlyExpenses:0,monthlyRent:0,propertySlug:'fixture-wallet-property',
  propertyTitle:'Fixture property',propertyValue:2650000,sharePrice:1000,totalShares:2650,
  returnBreakdown:{rental:0,vacationPoint:9.5,appreciation:18.5},walletBalance:balance,
  purchaseRequestId:params.get('request')==='missing'?undefined:'${requestId}',
  purchaseAction:params.get('action')==='missing'?undefined:purchaseAction};
const root=createRoot(document.getElementById('root'));
const render=()=>root.render(<LocaleProvider locale={locale}>
  <main style={{maxWidth:1280,margin:'0 auto',padding:'0 16px 24px'}}><InvestmentCalculator {...props}/></main>
</LocaleProvider>);
window.auditRerender=()=>{props.purchaseRequestId='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';render()};
render();
`;
await esbuild.build({ absWorkingDir: process.cwd(), tsconfigRaw: { compilerOptions: { jsx: 'react-jsx' } },
  nodePaths: [path.resolve('node_modules')], stdin: { contents: entry, resolveDir: process.cwd(), loader: 'tsx', sourcefile: 'wallet-audit-entry.tsx' },
  bundle: true, platform: 'browser', format: 'iife', jsx: 'automatic', outfile: path.join(directory, 'bundle.js'),
  define: { 'process.env.NODE_ENV': '"production"' },
  plugins: [{ name: 'fixture-next-link', setup(build) {
    build.onResolve({ filter: /^next\/link$/ }, args => ({ path: args.path, namespace: 'fixture' }));
    build.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: "import React from 'react'; export default function Link({href,children,...props}){return <a href={href} {...props}>{children}</a>}", loader: 'tsx', resolveDir: process.cwd() }));
  } }],
});
const css = await postcss([tailwind()]).process(readFileSync('app/globals.css', 'utf8'), { from: path.resolve('app/globals.css') });
writeFileSync(path.join(directory, 'styles.css'), css.css + '\n:root{--font-inter:Arial}html,body{overflow-x:visible!important}');
writeFileSync(path.join(directory, 'index.html'), '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/styles.css"><title>Wallet purchase component fixture</title></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>');
const server = createServer((request, response) => {
  const resource = new URL(request.url, 'http://localhost').pathname;
  const file = { '/': ['index.html', 'text/html'], '/bundle.js': ['bundle.js', 'text/javascript'], '/styles.css': ['styles.css', 'text/css'] }[resource];
  if (!file) { response.writeHead(404); response.end(); return; }
  response.writeHead(200, { 'Content-Type': file[1], 'Cache-Control': 'no-store' });
  response.end(readFileSync(path.join(directory, file[0])));
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const report = { assertions: [], screenshots: [], limitations: [
  'The actual calculator and page translation data run in a React fixture outside Next.js; links use a routing stub.',
  'EUR balances and available inventory are synthetic server props; every purchase action is mocked without any database access.',
  'This audit covers browser input handling and payloads, not production authentication, SQL locking, wallet ledger effects, or server redirects.',
  'The fixture uses Arial for the Next-managed font variable; production font loading is not exercised.',
] };
let browser;
function passed(message) { report.assertions.push(message); console.log(`PASS: ${message}`); }
try {
  browser = await puppeteer.launch({ executablePath: process.env.CHROME_BIN || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const page = await browser.newPage();
  const browserErrors = [], externalRequests = [];
  page.on('pageerror', error => browserErrors.push(error.message));
  await page.setRequestInterception(true);
  page.on('request', async request => {
    const url = new URL(request.url());
    if (url.protocol === 'data:' || url.protocol === 'blob:' || url.origin === base) { await request.continue(); return; }
    externalRequests.push(request.url());
    await request.abort();
  });
  async function navigate(locale = 'en', extra = '') {
    await page.goto(`${base}/?lang=${locale}${extra}`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('#payment-method');
  }
  async function quantity(value) {
    const input = await page.$('input[type="number"]');
    assert.ok(input, 'Custom quantity input exists');
    await input.focus();
    await input.evaluate(node => node.select());
    await page.keyboard.press('Backspace');
    if (value !== '') await input.type(String(value));
    await page.$eval('#payment-method', node => node.focus());
    assert.equal(await input.evaluate(node => node.value), String(value), 'Invalid quantity is never silently clamped on blur');
  }
  const submitDisabled = () => page.$eval('form button[type="submit"]', button => button.disabled);
  const posts = () => page.evaluate(() => window.auditPosts);
  async function containsCopy(key) {
    return page.evaluate(key => typeof window.auditText[key] === 'string' && document.querySelector('section').textContent.includes(window.auditText[key]), key);
  }
  async function row(key) {
    return page.evaluate(key => {
      const label = window.auditText[key];
      const span = [...document.querySelectorAll('section span')].find(node => node.textContent === label);
      return span?.parentElement.lastElementChild.textContent;
    }, key);
  }
  const money = value => page.evaluate(value => window.auditMoney(value), value);
  async function screenshot(name) {
    await page.waitForFunction(() => document.getAnimations().every(animation => animation.playState !== 'running'));
    const file = path.join(directory, name);
    await page.screenshot({ path: file, fullPage: true });
    report.screenshots.push(file);
  }
  async function blockedSubmission() {
    assert.equal(await submitDisabled(), true);
    await page.evaluate(() => {
      document.querySelector('form button[type="submit"]').click();
      document.querySelector('form').requestSubmit();
    });
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    assert.deepEqual(await posts(), [], 'Invalid inputs never invoke even a programmatic form submission');
  }

  await page.setViewport({ width: 1440, height: 1050 });
  await navigate();
  assert.equal(await page.$eval('#payment-method', node => node.value), 'wallet_balance');
  assert.equal(await page.$eval('#payment-method option:checked', node => node.textContent), `Balance (credits) — ${await money(25000)}`);
  assert.equal(await page.$eval('form button[type="submit"]', node => node.textContent.trim()), 'Buy now');
  assert.equal(await submitDisabled(), false);
  // Wallet summary labels are checked using the actual localized copy keys.
  assert.equal(await row('availableBalance'), await money(25000));
  assert.equal(await row('balanceAfterPurchase'), await money(23000));
  passed('A signed-in customer starts with Balance (credits), enabled Buy now, and the supplied EUR balance.');

  for (const shares of [4, 10, 20]) {
    await quantity(shares);
    assert.equal(await row('total'), await money(shares * 1000));
    assert.equal(await row('balanceAfterPurchase'), await money(25000 - shares * 1000));
    assert.equal(await submitDisabled(), false);
    assert.equal(await page.evaluate(shares => {
      const selected = [...document.querySelectorAll('section button[type="button"]')].filter(button => button.classList.contains('bg-[#2f9bdb]'));
      return selected.length === 1 && selected[0].firstElementChild.textContent === shares + ' ' + window.auditText.shares;
    }, shares), true, 'Preset selection follows the typed quantity');
  }
  await page.evaluate(() => [...document.querySelectorAll('section button[type="button"]')].find(button => button.firstElementChild.textContent === '4 ' + window.auditText.shares).click());
  assert.equal(await page.$eval('input[type="number"]', node => node.value), '4');
  assert.equal(await row('balanceAfterPurchase'), await money(21000));
  await quantity(20);
  await page.evaluate(async () => { window.auditRerender(); await new Promise(resolve => requestAnimationFrame(resolve)); });
  assert.equal(await page.$eval('input[name="purchase_request_id"]', node => node.value), requestId);
  assert.equal(await page.$eval('input[type="number"]', node => node.value), '20');
  passed('A server refresh with a new UUID preserves the mounted purchase intent and selected quantity.');
  await screenshot('buy-now-balance-desktop.png');
  passed('Changing share quantity recalculates the total and the remaining balance before purchase.');
  await page.evaluate(() => {
    const button = document.querySelector('form button[type="submit"]');
    button.click(); button.click(); button.click();
    document.querySelector('form').requestSubmit();
  });
  await page.waitForFunction(() => window.auditActionCompleted === 1);
  assert.deepEqual(await posts(), [{ property_slug: 'fixture-wallet-property', shares: '20', payment_method: 'wallet_balance', purchase_request_id: requestId }]);
  assert.equal(await submitDisabled(), true);
  assert.equal(await page.$eval('input[type="number"]', node => node.disabled), true);
  assert.equal(await page.$eval('#payment-method', node => node.disabled), true);
  passed('Rapid clicks and a duplicate requestSubmit invoke the purchase action once with exact quantity, wallet method, property and idempotency token.');

  for (const invalid of ['', '0', '1', '-1', '2.5', '2651']) {
    await navigate();
    await quantity(invalid);
    await blockedSubmission();
  }
  passed('Empty, zero, negative, fractional, below-minimum and over-stock quantities stay unmodified and cannot submit.');

  await navigate('en', '&balance=1999.99');
  await blockedSubmission();
  assert.equal(await containsCopy('insufficientBalance'), true);
  await screenshot('insufficient-balance-desktop.png');
  await navigate('en', '&balance=unavailable');
  await blockedSubmission();
  assert.equal(await containsCopy('balanceUnavailable'), true);
  await navigate('en', '&available=1');
  await blockedSubmission();
  await navigate('en', '&available=0');
  await blockedSubmission();
  passed('Insufficient, unavailable balances and insufficient inventory block the action with an explanatory state.');
  for (const missing of ['request', 'action']) {
    await navigate('en', `&${missing}=missing`);
    await blockedSubmission();
  }
  passed('Missing server action or purchase request token cannot submit a purchase.');

  await navigate('en', '&balance=2000');
  assert.equal(await submitDisabled(), false);
  assert.equal(await row('balanceAfterPurchase'), await money(0));
  passed('An exact balance can purchase the minimum quantity and shows zero remaining.');

  for (const method of ['bank_transfer', 'crypto']) {
    await navigate();
    await quantity(4);
    await page.select('#payment-method', method);
    assert.equal(await page.$('form button[type="submit"]'), null);
    const href = await page.$eval('a[href^="/contact?"]', node => node.getAttribute('href'));
    const query = new URL(href, base).searchParams;
    assert.equal(query.get('projekt'), 'fixture-wallet-property');
    assert.equal(query.get('shares'), '4');
    assert.equal(query.get('betrag'), '4000');
    assert.equal(query.get('currency'), 'EUR');
    assert.equal(query.get('payment'), method);
    assert.equal(await page.$eval('a[href^="/contact?"]', node => node.textContent.trim()), await page.evaluate(() => window.auditCopy.requestAmount));
    assert.deepEqual(await posts(), []);
    await page.select('#payment-method', 'wallet_balance');
    assert.equal(await submitDisabled(), false);
  }
  passed('Bank and crypto retain contact-request links with the selected quantity; returning to Balance restores Buy now.');

  await navigate('en', '&auth=false');
  assert.equal(await page.$('form button[type="submit"]'), null);
  assert.ok(await page.$('a[href^="/sign-in"]'));
  assert.deepEqual(await posts(), []);
  passed('Anonymous visitors get the sign-in link and cannot submit a wallet purchase.');

  for (const viewport of [{ width: 1440, height: 1050 }, { width: 390, height: 844 }]) {
    await page.setViewport(viewport);
    for (const locale of ['en', 'de', 'fr', 'es', 'it']) {
      await navigate(locale);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, `${locale} at ${viewport.width}px has no page overflow`);
      assert.equal(await page.evaluate(() => [...document.querySelectorAll('section button, section select')].every(node => node.scrollWidth <= node.clientWidth + 1)), true, `${locale} controls do not clip their text`);
      assert.equal(await submitDisabled(), false);
      assert.equal(await row('availableBalance'), await money(25000));
      assert.equal(await row('balanceAfterPurchase'), await money(23000));
      const localizedButton = await page.$eval('form button[type="submit"]', node => node.textContent.trim());
      const localizedOption = await page.$eval('#payment-method option:checked', node => node.textContent.trim());
      assert.ok(localizedButton && localizedOption);
      assert.equal(localizedButton, await page.evaluate(() => window.auditText.buyNow));
      assert.equal(localizedOption, await page.evaluate(() => window.auditText.balanceMethod + ' — ' + window.auditMoney(25000)));
      if (locale !== 'en') {
        assert.notEqual(localizedButton, 'Buy now', `${locale} translates Buy now`);
        assert.notEqual(localizedOption, 'Balance (credits)', `${locale} translates balance option`);
      }
      await quantity(20);
      assert.equal(await row('balanceAfterPurchase'), await money(5000));
      await screenshot(`buy-now-${locale}-${viewport.width}.png`);
      await page.click('form button[type="submit"]');
      await page.waitForFunction(() => window.auditActionCompleted === 1);
      assert.equal((await posts()).length, 1);
      assert.equal((await posts())[0].shares, '20');
    }
  }
  passed('All five locales display localized purchase controls and correct EUR totals, fit desktop/mobile, and submit the selected quantity once.');
  assert.deepEqual(browserErrors, []);
  assert.deepEqual(externalRequests, []);
  report.browserErrors = browserErrors;
  report.externalRequests = externalRequests;
  report.result = 'PASS';
  passed('No browser runtime errors or external network requests occurred; every purchase was a fixture action.');
} catch (error) {
  report.result = 'FAIL';
  report.error = error.stack;
  throw error;
} finally {
  writeFileSync(path.join(directory, 'results.json'), JSON.stringify(report, null, 2) + '\n');
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
