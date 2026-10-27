import assert from "node:assert/strict";
import test from "node:test";
import { resolveLocale, getRequestLocale, getLocaleFromAcceptLanguage } from "./i18n.ts";
import { getPropertyMapLinks } from "./property-location.ts";

test("manual language selection persists across country and browser changes, and explicit switching wins", () => {
  for (const locale of ["en", "de", "fr", "es", "it"]) {
    assert.equal(resolveLocale({ cookie: locale, manualPreference: true, country: "DE", acceptLanguage: "fr-FR" }), locale);
    assert.equal(resolveLocale({ query: locale, cookie: "it", manualPreference: true, country: "DE" }), locale);
    const request = new Request("https://example.invalid/api/properties", { headers: {
      cookie: `brickwise-locale=${locale}; brickwise-locale-manual=1`,
      "x-vercel-ip-country": "DE", "accept-language": "fr-FR",
    } });
    assert.equal(getRequestLocale(request), locale);
  }
});

test("first visits use the browser language, fall back to the country, and exclude refused languages", () => {
  assert.equal(resolveLocale({ country: "DE", acceptLanguage: "fr-FR" }), "fr");
  assert.equal(resolveLocale({ country: "ES", acceptLanguage: "en-US" }), "en");
  assert.equal(resolveLocale({ country: "DE", acceptLanguage: "pl-PL, pl;q=0.9" }), "de");
  assert.equal(resolveLocale({ country: "IT" }), "it");
  assert.equal(resolveLocale({ country: "XX", acceptLanguage: "pt-BR, fr-FR;q=0.9, en;q=0.5" }), "fr");
  assert.equal(resolveLocale({ acceptLanguage: "ja-JP" }), "en");
  assert.equal(getLocaleFromAcceptLanguage("de;q=0, fr;q=invalid"), null);
  assert.equal(getLocaleFromAcceptLanguage("de;q=0, it-IT;q=0.7, en;q=0.5"), "it");
});

test("identical street names in different cities produce distinct maps while supplied locations are preserved", () => {
  const toronto = getPropertyMapLinks({ address: "123 Main Street", city: "Toronto" }, "fr");
  const berlin = getPropertyMapLinks({ address: "123 Main Street", city: "Berlin" }, "de");
  assert.equal(toronto.query, "123 Main Street, Toronto");
  assert.equal(berlin.query, "123 Main Street, Berlin");
  assert.notEqual(toronto.mapUrl, berlin.mapUrl);
  assert.equal(getPropertyMapLinks({ address: "Le Plateau-Mont-Royal, Montreal, QC", city: "Montréal" }).query, "Le Plateau-Mont-Royal, Montreal, QC");
  const supplied = getPropertyMapLinks({ address: "8712 120 ST", city: "Edmonton", mapLocation: { latitude: 53.5237672, longitude: -113.538638, streetViewUrl: "https://www.google.com/maps/example" } });
  assert.equal(supplied.query, "53.5237672,-113.538638");
  assert.equal(supplied.precision, "point");
  assert.equal(supplied.streetViewUrl, "https://www.google.com/maps/example");
  assert.equal(getPropertyMapLinks({}), null);
});
