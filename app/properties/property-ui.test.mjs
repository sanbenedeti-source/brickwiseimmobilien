import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const root = fileURLToPath(new URL("../../", import.meta.url));
const requirePackage = createRequire(import.meta.url);
const modules = new Map();
function load(filename) {
  if (modules.has(filename)) return modules.get(filename).exports;
  const compiled = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  const loaded = { exports: {} };
  modules.set(filename, loaded);
  const require = (name) => {
    if (!name.startsWith(".")) return requirePackage(name);
    const stem = path.resolve(path.dirname(filename), name);
    return load(existsSync(`${stem}.ts`) ? `${stem}.ts` : `${stem}.tsx`);
  };
  new Function("require", "module", "exports", compiled)(require, loaded, loaded.exports);
  return loaded.exports;
}

const { externalProperties } = load(path.join(root, "app/lib/external-properties.ts"));
const Location = load(path.join(root, "app/properties/[slug]/PropertyLocation.tsx")).default;
const Gallery = load(path.join(root, "app/properties/[slug]/PropertyGallery.tsx")).default;
const PortalGallery = load(path.join(root, "app/properties/[slug]/PortalPropertyGallery.tsx")).default;
const { localizedPayment, localizedStatus, propertyGalleryCopy } = load(path.join(root, "app/properties/property-ui-copy.ts"));

test("all seven property maps render their own address and selected language, with only the verified panorama", () => {
  for (const property of externalProperties) for (const locale of ["en", "de", "fr", "es", "it"]) {
    const markup = renderToStaticMarkup(createElement(Location, { property, title: property.title, address: property.address, heading: "Map", locale }));
    assert.match(markup, /id="location"/);
    assert.ok(markup.includes(property.address), property.slug);
    assert.ok(markup.includes(`hl=${locale}`), property.slug);
    assert.match(markup, /<iframe/);
    if (property.slug === "edmonton-windsor-park-8712-120-st") assert.match(markup, /Street View/);
    else assert.doesNotMatch(markup, /Street View/);
  }
  const markup = renderToStaticMarkup(createElement(Location, { property: { address: "123 Test Street", city: "Berlin" }, title: "Database property", address: "123 Test Street", heading: "Standort", locale: "de" }));
  assert.match(markup, /123%20Test%20Street/);
  assert.match(markup, /Die Karte zeigt/);
});

test("gallery controls and native status/payment enums are localized in each supported language", () => {
  for (const locale of ["en", "de", "fr", "es", "it"]) {
    const props = { images: ["/one.jpg", "/two.jpg", "/three.jpg", "/four.jpg"], title: "Test", locale };
    const gallery = renderToStaticMarkup(createElement(Gallery, props));
    const portal = renderToStaticMarkup(createElement(PortalGallery, props));
    assert.ok(gallery.includes(propertyGalleryCopy[locale].previous));
    assert.ok(portal.includes(propertyGalleryCopy[locale].primary));
    assert.ok(portal.includes(propertyGalleryCopy[locale].more));
    if (locale !== "en") {
      assert.notEqual(localizedStatus("paid", locale), "Paid");
      assert.notEqual(localizedPayment("bank_transfer", locale), "Bank transfer");
      assert.doesNotMatch(gallery + portal, /Previous property photo|Next property photo|>Primary</);
    }
    assert.equal(localizedStatus("future_unknown_state", locale), "—");
  }
});
