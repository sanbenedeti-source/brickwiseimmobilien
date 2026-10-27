import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const code=ts.transpileModule(readFileSync('app/lib/marketing.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
function setup(saved=null,url='https://www.brickwise-immo.de/?lang=en',referrer='') {
 const values=new Map(saved?[['brickwise-marketing-consent',saved]]:[]),scripts=[],events=[],cookies=[];let reloads=0;
 const win={localStorage:{getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)},location:{href:url,hostname:'www.brickwise-immo.de',reload:()=>reloads++},dispatchEvent:e=>events.push(e.type)};
 const doc={referrer,createElement:()=>({dataset:{}}),head:{appendChild:s=>scripts.push(s)}};
 Object.defineProperty(doc,'cookie',{get:()=> '_fbp=123; _ga=456; sb-token=keep',set:v=>cookies.push(v)});
 const m={exports:{}};new Function('require','module','exports','window','document','Event',code)(()=>JSON.parse(readFileSync('app/lib/seo-pages.json','utf8')),m,m.exports,win,doc,Event);
 return {api:m.exports,win,doc,scripts,values,events,cookies,reloads:()=>reloads};
}
test('no decision and rejection never load scripts or queue conversions',()=>{
 for(const consent of [null,'rejected']) {const h=setup(consent);h.api.trackPage();assert.equal(h.scripts.length,0);assert.equal(h.api.trackConversion('Lead'),false);assert.equal(h.win.gtag,undefined);}
});
test('acceptance loads exactly two tags with defaults before events and safe URLs',()=>{
 const h=setup();h.api.chooseConsent('accepted');h.api.trackPage();h.api.trackPage();assert.equal(h.scripts.length,2);
 const q=h.win.dataLayer.map(x=>Array.from(x));assert.equal(q[0][0],'consent');assert.equal(q[0][1],'default');assert.equal(q[0][2].ad_storage,'denied');
 assert.equal(q[2][2].ad_storage,'granted');assert.equal(q.filter(x=>x[0]==='event').length,1);
 assert.equal(q.at(-1)[2].page_location,'https://www.brickwise-immo.de/');
 assert.ok(h.scripts.every(s=>s.referrerPolicy==='no-referrer'));
});
test('withdrawal clears queued events, revokes, clears only marketing cookies and unloads scripts',()=>{
 const h=setup('accepted');h.api.trackPage();h.api.chooseConsent('rejected');assert.equal(h.reloads(),1);assert.equal(h.api.trackConversion('Lead'),false);
 assert.equal(h.win.dataLayer.length,1);assert.equal(h.win.dataLayer[0][2].ad_storage,'denied');
 assert.deepEqual(h.win.fbq.queue,[['consent','revoke']]);assert.ok(h.cookies.some(c=>c.startsWith('_fbp=')));assert.ok(!h.cookies.some(c=>c.startsWith('sb-token=')));
});
test('private pages, email/token query, hash and dirty referrer never initialize',()=>{
 for(const url of ['/dashboard','/sign-in?email=person@example.invalid','/contact?email=person@example.invalid','/?access_token=secret','/#token','/properties/a%40b']){const h=setup('accepted','https://www.brickwise-immo.de'+url);h.api.trackPage();assert.equal(h.scripts.length,0,url);}
 const h=setup('accepted','https://www.brickwise-immo.de/','https://www.brickwise-immo.de/sign-in?email=person@example.invalid');h.api.trackPage();assert.equal(h.scripts.length,0);
});
test('lead conversions work after acceptance and recheck the latest consent',()=>{
 const h=setup('accepted','https://www.brickwise-immo.de/thank-you?conversion=lead');h.api.trackPage();assert.equal(h.api.trackConversion('Lead'),true);
 assert.equal(h.win.dataLayer.at(-1)[2].page_location,'https://www.brickwise-immo.de/thank-you');h.values.clear();assert.equal(h.api.trackConversion('Lead'),false);
});
test('storage failure fails closed and unsafe navigation unloads initialized tags',()=>{
 const h=setup();h.win.localStorage.getItem=()=>{throw Error('blocked')};h.api.trackPage();assert.equal(h.scripts.length,0);
 const active=setup('accepted');active.api.trackPage();active.win.location.href='https://www.brickwise-immo.de/dashboard';active.api.checkMarketingRoute();assert.equal(active.reloads(),1);
});

test('ad landing pages keep click identifiers for attribution but still reject personal values',()=>{
 const h=setup('accepted','https://www.brickwise-immo.de/properties/toronto-midtown-condo?gclid=Cj0KCQ_abc-1&utm_source=google&lang=de');h.api.trackPage();assert.equal(h.scripts.length,2);
 assert.equal(h.win.dataLayer.at(-1)[2].page_location,'https://www.brickwise-immo.de/properties/toronto-midtown-condo?gclid=Cj0KCQ_abc-1&utm_source=google');
 for(const url of ['/?gclid=a&email=person@example.invalid','/?utm_source=person@example.invalid','/?fbclid='+'x'.repeat(201)]){const p=setup('accepted','https://www.brickwise-immo.de'+url);p.api.trackPage();assert.equal(p.scripts.length,0,url);}
});
test('leaving public pages unloads tags without deleting attribution cookies; a property enquiry stays tracked',()=>{
 const h=setup('accepted');h.api.trackPage();h.win.location.href='https://www.brickwise-immo.de/contact?projekt=toronto-midtown-condo';h.api.checkMarketingRoute();assert.equal(h.reloads(),0);
 h.win.location.href='https://www.brickwise-immo.de/dashboard';h.api.checkMarketingRoute();assert.equal(h.reloads(),1);assert.equal(h.cookies.length,0);
});
