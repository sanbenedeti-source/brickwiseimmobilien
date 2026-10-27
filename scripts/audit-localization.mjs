import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { apiCopy } from "../app/lib/api-copy.ts";
import { getPropertyMapLinks } from "../app/lib/property-location.ts";

const base = process.argv[2] || "http://127.0.0.1:3005";
const languages = { en: "en-CA", de: "de-DE", fr: "fr-FR", es: "es-ES", it: "it-IT" };
const missingTitles = { en: "Page not found", de: "Seite nicht gefunden", fr: "Page introuvable", es: "Página no encontrada", it: "Pagina non trovata" };
const seed = JSON.parse(readFileSync(new URL("../PROPERTY_TRANSLATIONS_SEED.json", import.meta.url), "utf8"));
const propertySlugs = [...new Set(seed.map(row => row.property_slug))];
const publicRoutes = [
  "/", "/about", "/properties", "/contact", "/funding", "/insights",
  "/insights/how-fractional-real-estate-participation-works",
  "/insights/what-to-review-before-comparing-rental-yield",
  "/insights/why-transparency-matters-in-canadian-property-access",
  "/investor-policy", "/legal-notice", "/mortgage", "/mortgage-calculator",
  "/privacy", "/real-estate-investing", "/risk", "/terms", "/thank-you",
  "/join", "/join/verify-phone", "/sign-in", "/sign-in/two-factor",
  "/forgot-password", "/update-password", "/authentication/recovery", "/admin",
  ...propertySlugs.map(slug => `/properties/${slug}`), "/localization-page-that-does-not-exist",
];
const protectedRoutes = ["/admin/properties", "/admin/profits", "/admin/payments", "/admin/audit", "/dashboard", "/dashboard/income"];
const knownSharedText = [
  // Brand names and the public office address are not translated.
  /^(?:Brickwise Immobilien|BRICKWISE|Muthgasse|Vienna|Wien|Österreich|Austria|Estoril,|8712 120 ST)/i,
];
const decode = value => value.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#x27;|&#39;|&apos;/g, "'")
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;|&#160;/g, " ")
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
  .replace(/&#([0-9]+);/g, (_, code) => String.fromCodePoint(Number(code)));
const visibleHtml = html => html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "").replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "").replace(/<!--[\s\S]*?-->/g, "");
const segments = html => [...new Set(visibleHtml(html).split(/<[^>]*>/g).map(decode).map(text => text.replace(/\s+/g, " ").trim()).filter(Boolean))];
const visibleText = html => segments(html).join(" ");
const headers = locale => ({ cookie: `brickwise-locale=${locale}; brickwise-locale-manual=1`, "accept-language": locale });
async function fetchPage(route, locale) {
  const response = await fetch(new URL(route, base), { headers: headers(locale), signal: AbortSignal.timeout(45000) });
  const html = await response.text();
  const missing = route === "/localization-page-that-does-not-exist";
  assert.ok((missing ? [200, 404] : [200]).includes(response.status), `${locale} ${route}: HTTP ${response.status}`);
  assert.equal(visibleText(html).includes(missingTitles[locale]), missing, `${locale} ${route}: correct page rather than a missing-page fallback`);
  assert.ok(html.includes(`lang="${languages[locale]}"`), `${locale} ${route}: HTML language`);
  return { html, url: response.url, status: response.status };
}
async function batches(items, run) {
  const result = [];
  for (let start = 0; start < items.length; start += 4) result.push(...await Promise.all(items.slice(start, start + 4).map(run)));
  return result;
}

const pages = new Map();
const report = { base, pageChecks: 0, mapChecks: 0, accessChecks: 0, apiChecks: 0, languageSwitchChecks: 0, sharedEnglishCandidates: [] };
for (const locale of Object.keys(languages)) {
  const records = await batches(publicRoutes, async route => {
    const page = await fetchPage(route, locale);
    report.pageChecks++;
    if (route.includes("/properties/")) {
      const slug = route.split("/").at(-1);
      const translation = seed.find(row => row.property_slug === slug && row.locale === locale);
      const text = visibleText(page.html);
      assert.ok(text.includes(translation.title), `${locale} ${slug}: localized title`);
      assert.ok(text.includes(translation.property_type), `${locale} ${slug}: localized type`);
      assert.ok(page.html.includes('id="location"'), `${locale} ${slug}: map section`);
      assert.match(page.html, /data-map-src="[^"]+"/, `${locale} ${slug}: click-to-load map`);
      assert.doesNotMatch(page.html, /<iframe[^>]+google\.com\/maps/, `${locale} ${slug}: no map before consent`);
      assert.ok(page.html.includes(`hl=${locale}`), `${locale} ${slug}: map language`);
      report.mapChecks++;
    }
    return [route, page];
  });
  pages.set(locale, new Map(records));
  console.log(`${locale}: ${records.length} public routes verified`);

  for (const route of protectedRoutes) {
    const page = await fetchPage(route, locale);
    assert.ok(["/admin", "/sign-in"].includes(new URL(page.url).pathname), `${locale} ${route}: unauthenticated access stays protected`);
    report.accessChecks++;
  }
  const response = await fetch(new URL("/api/properties", base), { headers: headers(locale), signal: AbortSignal.timeout(45000) });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-language"), languages[locale]);
  const feed = await response.json();
  assert.equal(feed.properties.length, propertySlugs.length);
  for (const property of feed.properties) {
    const translation = seed.find(row => row.property_slug === property.slug && row.locale === locale);
    assert.equal(property.title, translation.title);
    assert.equal(property.description, translation.description);
    const links = getPropertyMapLinks(property, locale);
    assert.equal(property.map?.mapUrl, links.mapUrl);
    assert.equal(property.map?.embedUrl, links.embedUrl);
    const detail = pages.get(locale).get(`/properties/${property.slug}`).html;
    assert.ok(decode(detail).includes(links.embedUrl), `${locale} ${property.slug}: exact recorded map query`);
  }
  report.apiChecks++;
  if (locale === "en") {
    const cityFeed = await (await fetch(new URL("/api/properties?city=Toronto", base), { headers: headers(locale) })).json();
    assert.equal(cityFeed.properties.length, 1);
    assert.equal(cityFeed.properties[0].slug, "toronto-midtown-condo");
    const soldFeed = await (await fetch(new URL("/api/properties?status=sold", base), { headers: headers(locale) })).json();
    assert.ok(soldFeed.properties.every(property => property.status === "sold"));
    report.apiChecks += 2;
  }
  for (const [route, key] of [["/api/client-documents", "authentication"], ["/api/properties/import", "adminRequired"]]) {
    const denied = await fetch(new URL(route, base), { method: "POST", headers: headers(locale), signal: AbortSignal.timeout(45000) });
    assert.equal(denied.status, 401, `${route}: unauthorized access`);
    assert.equal((await denied.json()).error, apiCopy[locale][key]);
    report.apiChecks++;
  }
  const switched = await fetch(new URL(`/properties?city=Toronto&lang=${locale}`, base), {
    redirect: "manual", headers: headers(locale === "en" ? "de" : "en"), signal: AbortSignal.timeout(45000),
  });
  assert.ok([307, 308].includes(switched.status));
  const destination = new URL(switched.headers.get("location"), base);
  assert.equal(destination.pathname, "/properties");
  assert.equal(destination.searchParams.get("city"), "Toronto");
  assert.equal(destination.searchParams.has("lang"), false);
  assert.ok(switched.headers.get("set-cookie")?.includes(`brickwise-locale=${locale}`));
  report.languageSwitchChecks++;
}

for (const locale of Object.keys(languages).filter(locale => locale !== "en")) {
  for (const route of publicRoutes) {
    const english = new Set(segments(pages.get("en").get(route).html).filter(text => text.length >= 65 && text.split(" ").length >= 9));
    for (const text of segments(pages.get(locale).get(route).html)) {
      if (english.has(text) && !knownSharedText.some(pattern => pattern.test(text))) report.sharedEnglishCandidates.push({ locale, route, text });
    }
  }
}
mkdirSync(".next", { recursive: true });
writeFileSync(".next/localization-audit.json", JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
assert.equal(report.sharedEnglishCandidates.length, 0, "Review and translate the remaining shared English sentences.");
console.log("PASS: all public routes, seven address maps, five languages, localized APIs, language switching and unauthenticated access checks.");
