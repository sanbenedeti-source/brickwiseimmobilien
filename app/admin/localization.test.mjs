import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const require = createRequire(import.meta.url);
const seeds = JSON.parse(readFileSync(path.join(root, "PROPERTY_TRANSLATIONS_SEED.json"), "utf8"));

export function harness(locale, companyMethods = []) {
  const cache = new Map();
  const payments = [
    { id: "eur-first", customer_email: "test@example.invalid", title: "Recorded EUR payment", amount: 1200.25, currency: "EUR", status: "paid", method: "bank_transfer", created_at: "2026-09-24T12:00:00Z", properties: null },
    { id: "eur", customer_email: "test@example.invalid", title: "Recorded EUR payment", amount: 500.5, currency: "EUR", status: "verified", method: "crypto", crypto_asset: "BTC", crypto_network: "Bitcoin", created_at: "2026-09-24T12:00:00Z", properties: null },
  ];
  const database = {
    auth: {
      getUser: async () => ({ data: { user: { id: "test-admin", email: "admin@example.invalid", app_metadata: { role: "admin" }, factors: [{ id: "factor", factor_type: "totp", status: "verified" }] } } }),
      getClaims: async () => ({ data: { claims: { sub: "test-admin", aal: "aal2" } }, error: null }),
      admin: { listUsers: async () => ({ data: { users: [] }, error: null }) },
    },
    from(table) {
      const response = { data: table === "payment_requests" ? payments : table === "company_payment_methods" ? companyMethods : [], error: null, count: 0 };
      const query = { select: () => query, order: () => query, limit: () => query, eq: () => query, or: () => query, then: (resolve, reject) => Promise.resolve(response).then(resolve, reject) };
      return query;
    },
  };
  const action = async () => { throw new Error("Rendering must never invoke a mutation"); };
  function load(filename) {
    if (cache.has(filename)) return cache.get(filename);
    if (filename.endsWith(".json")) return JSON.parse(readFileSync(filename, "utf8"));
    const code = ts.transpileModule(readFileSync(filename, "utf8"), { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
    const loadedModule = { exports: {} };
    const imports = (name) => {
      if (name.endsWith(".css")) return {};
      if (name === "@/app/lib/server-locale") return { getCurrentLocale: async () => locale };
      if (name.endsWith("supabase/server")) return { createClient: async () => database };
      if (name === "@supabase/supabase-js") return { createClient: () => database };
      if (name.endsWith("property-localization")) return { getPropertyTranslations: async () => new Map(seeds.filter((seed) => seed.locale === locale).map((seed) => [seed.property_slug, seed])) };
      if (/(?:^|\/)(?:actions?|directory-actions|sign-in-actions)$/.test(name)) return new Proxy({}, { get: () => action });
      if (name.endsWith("LanguageSwitcher")) return { __esModule: true, default: ({ label }) => createElement("span", null, label) };
      if (name === "next/navigation") return { usePathname: () => "/admin", redirect() { throw new Error("Unexpected redirect for administrator"); } };
      if (name === "next/link") return { __esModule: true, default: ({ href, children, ...props }) => createElement("a", { href, ...props }, children) };
      if (name.startsWith("@/") || name.startsWith(".")) {
        const base = name.startsWith("@/") ? path.join(root, name.slice(2)) : path.resolve(path.dirname(filename), name);
        const resolved = [base, `${base}.ts`, `${base}.tsx`, `${base}.json`].find((candidate) => existsSync(candidate));
        assert.ok(resolved, name);
        return load(resolved);
      }
      return require(name);
    };
    new Function("require", "module", "exports", "process", code)(imports, loadedModule, loadedModule.exports, { env: { NEXT_PUBLIC_SUPABASE_URL: "https://test.invalid", SUPABASE_SERVICE_ROLE_KEY: "test-only" } });
    cache.set(filename, loadedModule.exports);
    return loadedModule.exports;
  }
  return { load: (file) => load(path.join(root, file)) };
}

for (const locale of ["en", "de", "fr", "es", "it"]) {
  test(`admin ${locale}: all pages use localized UI, recorded address maps and native money`, async () => {
    const app = harness(locale);
    const t = app.load("app/lib/admin-copy.ts").getAdminText(locale);
    const catalogue = app.load("app/lib/external-properties.ts").externalProperties;
    const mapLinks = app.load("app/lib/property-location.ts").getPropertyMapLinks;
    const { localeHtmlLang } = app.load("app/lib/i18n.ts");
    const renderPage = async (file) => renderToStaticMarkup(await app.load(file).default({ searchParams: Promise.resolve({}) }));
    const properties = await renderPage("app/admin/properties/page.tsx");
    const profits = await renderPage("app/admin/profits/page.tsx");
    const payments = await renderPage("app/admin/payments/requests/page.tsx");
    const directory = await renderPage("app/admin/payments/page.tsx");
    assert.ok(directory.includes(t("Company payment methods")));
    assert.equal((directory.match(/name="bank_slot"/g) || []).length, 2);
    assert.ok(directory.includes("/admin/payments/requests"));
    assert.doesNotMatch(directory, /name="customer_email"|name="amount"/);
    const overview = await renderPage("app/admin/page.tsx");
    const cryptoForm = renderToStaticMarkup(await app.load("app/admin/payments/page.tsx").default({ searchParams: Promise.resolve({ method: "crypto" }) }));
    assert.ok(cryptoForm.includes('name="crypto_asset"') && cryptoForm.includes('name="crypto_network"'));
    assert.ok(cryptoForm.includes(t("Company wallet address")) && cryptoForm.includes("Bitcoin"));
    assert.doesNotMatch(cryptoForm + overview, /method=stripe_link|method=manual|value="stripe_link"|value="manual"|Stripe link|Crypto USDC/);
    const audit = await renderPage("app/admin/audit/page.tsx");
    const layout = renderToStaticMarkup(await app.load("app/admin/layout.tsx").default({ children: createElement("p", null, "child") }));
    for (const [html, english] of [[properties, "Manage properties"], [profits, "Property returns"], [payments, "Manage payment requests"], [overview, "Client requests"], [overview, "Deposits to verify"], [audit, "Admin audit logs"], [layout, "Client requests"]]) {
      assert.ok(html.includes(t(english)), `${locale}: ${english}`);
      if (locale !== "en") assert.ok(!html.includes(`>${english}<`), `${locale}: untranslated ${english}`);
    }
    for (const property of catalogue) {
      const map = mapLinks(property, locale).mapUrl.replaceAll("&", "&amp;");
      assert.ok(properties.includes(map), `${locale}: missing address map ${property.slug}`);
      assert.ok(profits.includes(map), `${locale}: missing profit map ${property.slug}`);
      const title = seeds.find((item) => item.property_slug === property.slug && item.locale === locale)?.title || property.title;
      assert.ok(properties.includes(title.replaceAll("&", "&amp;")), `${locale}: canonical title ${property.slug}`);
    }
    assert.equal((properties.match(/maps\/search\/\?api=1/g) || []).length, catalogue.length);
    for (const [currency, amount] of [["EUR", 1200.25], ["EUR", 500.5]]) {
      const formatted = new Intl.NumberFormat(localeHtmlLang[locale], { style: "currency", currency, currencyDisplay: "code", maximumFractionDigits: 2 }).format(amount);
      assert.ok(payments.includes(formatted), `${locale}: preserve ${currency} amounts`);
    }
  });
}
