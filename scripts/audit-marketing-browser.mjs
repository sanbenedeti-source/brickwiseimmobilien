import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const base=process.argv[2]||'http://localhost:3020';
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
 const context=await browser.newContext();const loads=[];
 await context.route('**/*',async route=>{
  const url=route.request().url();
  if(/googletagmanager.com|facebook.net|google-analytics.com|facebook.com\/tr|googleadservices.com|doubleclick.net/.test(url)){loads.push(url);await route.fulfill({status:200,contentType:'application/javascript',body:'/* Marketing requests intercepted for consent testing. */'});return;}
  if(new URL(url).origin!==new URL(base).origin){await route.abort();return;}
  await route.continue();
 });
 const page=await context.newPage();
 await page.goto(base+'/?lang=en');await page.getByRole('button',{name:'Accept marketing',exact:true}).waitFor();
 assert.equal(loads.length,0,'No marketing requests before consent');
 await page.getByRole('button',{name:'Reject marketing',exact:true}).click();await page.reload();await page.getByRole('button',{name:'Change cookie preferences',exact:true}).waitFor();assert.equal(loads.length,0);
 await page.getByRole('button',{name:'Change cookie preferences',exact:true}).click();await page.getByRole('button',{name:'Accept marketing',exact:true}).click();
 await page.waitForFunction(()=>document.querySelectorAll('script[data-brickwise-marketing]').length===2);
 assert.equal(loads.length,2);
 const q=await page.evaluate(()=>window.dataLayer.map(x=>Array.from(x)));assert.equal(q[0][2].ad_storage,'denied');assert.equal(q.at(-1)[2].page_location,new URL(base).origin+'/');
 await page.evaluate(()=>{document.cookie='_fbp=test; path=/';document.cookie='essential-test=keep; path=/';});
 await page.getByRole('button',{name:'Change cookie preferences',exact:true}).click();
 await Promise.all([page.waitForEvent('load'),page.getByRole('button',{name:'Reject marketing',exact:true}).click()]);
 await page.getByRole('button',{name:'Change cookie preferences',exact:true}).waitFor();assert.equal(loads.length,2);assert.equal(await page.evaluate(()=>typeof window.gtag),'undefined');
 assert.ok(!(await context.cookies()).some(c=>c.name==='_fbp'));assert.ok((await context.cookies()).some(c=>c.name==='essential-test'));
 await page.evaluate(()=>localStorage.setItem('brickwise-marketing-consent','accepted'));
 await page.goto(base+'/contact?lang=en&email=privacy-test%40example.invalid');await page.getByRole('button',{name:'Change cookie preferences',exact:true}).waitFor();assert.equal(loads.length,2);
 await page.goto(base+'/sign-in?lang=en');await page.getByRole('button',{name:'Change cookie preferences',exact:true}).waitFor();assert.equal(loads.length,2);
 // A fresh public page with saved acceptance must initialize; clearing in another tab revokes.
 await page.goto(base+'/?lang=en',{referer:''});await page.waitForFunction(()=>document.querySelectorAll('script[data-brickwise-marketing]').length===2);
 const other=await context.newPage();await other.goto(base+'/sign-in?lang=en');
 await Promise.all([page.waitForEvent('load'),other.evaluate(()=>localStorage.setItem('brickwise-marketing-consent','rejected'))]);
 await page.getByRole('button',{name:'Change cookie preferences',exact:true}).waitFor();assert.equal(await page.evaluate(()=>typeof window.gtag),'undefined');
 console.log('PASS browser: initial/refused requests=0; acceptance loads two intercepted tags; withdrawal unloads tags and clears marketing cookies only; dirty/private URLs blocked; cross-tab revocation works. No marketing traffic reached providers.');
 await context.close();
} finally {await browser.close();}
