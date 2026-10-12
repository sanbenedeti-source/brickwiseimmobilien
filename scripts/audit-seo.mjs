import assert from 'node:assert/strict';
const base=process.argv[2]||'http://localhost:3020';
const origin='https://www.brickwise-immo.de';
const headers={'user-agent':'Googlebot','cookie':'brickwise-locale=it; brickwise-locale-manual=1','accept-language':'de-DE','x-vercel-ip-country':'DE'};
async function get(path){const r=await fetch(base+path,{headers,redirect:'manual',signal:AbortSignal.timeout(30000)});return {status:r.status,headers:r.headers,html:await r.text()};}
const sm=await get('/sitemap.xml');assert.equal(sm.status,200);
const urls=[...sm.html.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>m[1].replaceAll('&amp;','&'));
assert.ok(urls.length>=115);assert.equal(new Set(urls).size,urls.length);
assert.ok(urls.every(url=>url.startsWith(origin)&&! /\/(admin|dashboard|funding|sign-in|join|authentication|interface|api)(\/|\?)/.test(url)));
assert.ok(!sm.html.includes('apartament-modern-berlin'));
let checked=0;
for(let i=0;i<urls.length;i+=5){await Promise.all(urls.slice(i,i+5).map(async url=>{
 const u=new URL(url),locale=u.searchParams.get('lang');const r=await get(u.pathname+u.search);
 assert.equal(r.status,200,url);
 const canonical=[...r.html.matchAll(/<link rel="canonical" href="([^"]+)"/g)];
 assert.equal(canonical.length,1,url);assert.equal(canonical[0][1].replaceAll('&amp;','&'),url,url);
 assert.match(r.html,new RegExp('<html[^>]+lang="'+locale+'-'),url);
 assert.match(r.html,/<meta name="robots" content="index, follow"/);
 for(const lang of ['en','de','fr','es','it','x-default'])assert.ok(r.html.includes('hrefLang="'+lang+'"'),url+' '+lang);
 assert.ok(!r.html.includes('<meta name="robots" content="noindex'),url);
 const title=r.html.match(/<title>([^<]+)<\/title>/)?.[1];assert.ok(title?.includes('BRICKWISE'),url);
 if(u.pathname.startsWith('/properties/'))assert.notEqual(title,'Properties | BRICKWISE');
 checked++;
}));}
const robots=await get('/robots.txt');assert.equal(robots.status,200);assert.ok(robots.html.includes(origin+'/sitemap.xml'));
for(const path of ['/sign-in','/join','/admin','/dashboard/account','/funding','/authentication/callback','/api/properties']){
 const r=await get(path);assert.equal(r.headers.get('x-robots-tag'),'noindex, nofollow',path);
 if(path==='/sign-in'||path==='/join')assert.match(r.html,/<meta name="robots" content="noindex, nofollow"/);
}
const filtered=await get('/properties?lang=fr&city=Toronto&utm_source=test');assert.ok(filtered.html.includes('rel="canonical" href="'+origin+'/properties?lang=fr"'));
const missing=await get('/properties/seo-nonexistent-property?lang=en');assert.ok(missing.status===404||missing.html.includes('content="noindex"'));
console.log('PASS: '+checked+' sitemap language URLs return 200, correct HTML language, self canonical, hreflang and indexable metadata; robots, private noindex, filter canonical and missing property checked.');
