import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const base=process.argv[2]||'http://localhost:3020';
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
 const context=await browser.newContext();
 await context.addInitScript(()=>localStorage.setItem('brickwise-marketing-consent','rejected'));
 await context.route('**/*',route=>new URL(route.request().url()).origin===new URL(base).origin?route.continue():route.abort());
 const page=await context.newPage();
 async function labels(){const unlabeled=await page.locator('main input:not([type=hidden]):visible, main textarea:visible, main select:visible').evaluateAll(nodes=>nodes.filter(n=>!n.labels?.length&&!n.getAttribute('aria-label')).map(n=>n.name||n.type));assert.deepEqual(unlabeled,[]);}
 await page.goto(base+'/contact?lang=en');await labels();await page.locator('label[for=contact-email]').click();assert.equal(await page.evaluate(()=>document.activeElement.id),'contact-email');
 await page.goto(base+'/sign-in?lang=en');await labels();
 await page.goto(base+'/join?lang=en');await labels();await page.getByLabel('Full name',{exact:true}).fill('Accessibility Test');await page.getByRole('button',{name:'Next',exact:true}).click();await page.getByLabel('Password',{exact:true}).waitFor();await labels();
 await page.goto(base+'/?lang=en');
 const trigger=page.getByRole('button',{name:'Register your interest',exact:true});await trigger.click();const dialog=page.getByRole('dialog',{name:'Register your interest',exact:true});await dialog.waitFor();
 assert.equal(await page.evaluate(()=>document.querySelector('dialog').contains(document.activeElement)),true);
 assert.equal(await page.evaluate(()=>document.body.style.overflow),'hidden');
 await dialog.getByRole('button',{name:'Close',exact:true}).focus();await page.keyboard.press('Shift+Tab');assert.equal(await page.evaluate(()=>document.querySelector('dialog').contains(document.activeElement)),true);
 await dialog.getByRole('button',{name:'Send request',exact:true}).focus();await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.querySelector('dialog').contains(document.activeElement)),true);
 await page.keyboard.press('Escape');await dialog.waitFor({state:'detached'});assert.equal(await trigger.evaluate(n=>document.activeElement===n),true);assert.notEqual(await page.evaluate(()=>document.body.style.overflow),'hidden');
 await page.setViewportSize({width:320,height:480});await trigger.click();await dialog.waitFor();await dialog.getByRole('button',{name:'Send request',exact:true}).scrollIntoViewIfNeeded();
 const box=await dialog.getByRole('button',{name:'Send request',exact:true}).boundingBox();assert.ok(box.y>=0&&box.y+box.height<=480);
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=320));
 await page.keyboard.press('Escape');await dialog.waitFor({state:'detached'});
 console.log('PASS: Contact/Sign in/Join field labels; modal initial focus, Tab/Shift+Tab containment, Escape, focus restoration, background scroll lock, 320x480 scrolling and no horizontal overflow. No forms submitted.');
 await context.close();
} finally {await browser.close();}
