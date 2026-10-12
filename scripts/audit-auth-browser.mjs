import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
if (!process.env.PLAYWRIGHT_MODULE) throw new Error('Set PLAYWRIGHT_MODULE to the installed playwright entry point');
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const base=process.env.AUDIT_BASE_URL || 'http://localhost:3100';
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
const page=await browser.newPage({viewport:{width:390,height:844}});
await page.route('**/interface/confirmation-email',r=>r.fulfill({status:200,contentType:'application/json',body:'{"success":true}'}));
await page.goto(base+'/sign-in?registered=1&email=test%40example.invalid');
await page.getByRole('heading',{name:'Check your email'}).waitFor();
assert.equal(await page.getByLabel('Confirmation email',{exact:true}).inputValue(),'test@example.invalid');
await page.getByRole('button',{name:'Resend confirmation'}).click();
await page.getByText('Confirmation requested. Check your inbox and spam folder.',{exact:true}).waitFor();
assert.equal(await page.getByRole('button',{name:'Please wait…',exact:true}).isDisabled(),true);
assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true);
await page.goto(base+'/sign-in?error=invalid-link');
await page.getByText('This confirmation link is invalid or has expired. Request a new one below.',{exact:true}).waitFor();
console.log('PASS: registration notice, prefilled email, mocked resend, cooldown, expired link, mobile width. No email sent.');
}finally{await browser.close()}
