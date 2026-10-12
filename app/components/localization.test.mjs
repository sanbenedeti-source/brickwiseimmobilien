import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
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
const locales = ["en", "de", "fr", "es", "it"];
let requestLocale = "en";
let authCalls = 0;

function load(relative) {
  const base = path.resolve(root, relative);
  const filename = [base, `${base}.ts`, `${base}.tsx`, `${base}.json`].find(existsSync);
  assert.ok(filename, relative);
  if (filename.endsWith(".json")) return JSON.parse(readFileSync(filename, "utf8"));
  if (modules.has(filename)) return modules.get(filename).exports;
  const compiled = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  const loaded = { exports: {} };
  modules.set(filename, loaded);
  const require = (name) => {
    if (name.endsWith("deposit-store")) return { getDeposits: async () => ({deposits:[],error:false}) };
    if (name.endsWith("deposit-actions")) return { submitDeposit: async () => { throw Error("No writes during render"); } };
    if (name === "next/link") return function TestLink({ children, ...props }) { return createElement("a", props, children); };
    if (name === "next/image") return function TestImage({ src, alt, width, height, className }) { return createElement("img", { src, alt, width, height, className }); };
    if (name === "next/headers") return { cookies: async () => ({ get: () => ({ value: requestLocale }) }) };
    if (name === "next/navigation") return { usePathname: () => "/funding", useSearchParams: () => new URLSearchParams(), notFound: () => { throw new Error("404"); }, redirect: (url) => { throw new Error(`Redirect ${url}`); } };
    if (name === "@/app/lib/company-payment-store") return { getCompanyPaymentMethods: async () => ({ methods: [{id:"wallet",kind:"crypto",label:"Company BTC",active:true,crypto_asset:"BTC",crypto_network:"Bitcoin",wallet_address:"test-address"},{id:"hidden",kind:"crypto",label:"Hidden wallet",active:false,crypto_asset:"BTC",crypto_network:"Bitcoin",wallet_address:"hidden-address"}],error:false}) };
    if (name === "@/lib/supabase/auth") return { getCurrentUser: async () => ({ id: "12345678", email: "client@example.test", user_metadata: { full_name: "Test Client" } }) };
    if (name === "@/lib/supabase/server") return { createClient: async () => ({ auth: { verifyOtp: async () => { authCalls++; return { error: { code: "otp_expired", message: "Raw English provider error", status: 400 } }; } } }) };
    if (name === "@/lib/supabase/client") return { createClient: () => { throw new Error("Unexpected browser auth operation"); } };
    if (name.startsWith("@/")) return load(name.slice(2));
    if (name.startsWith(".")) return load(path.resolve(path.dirname(filename), name));
    return requirePackage(name);
  };
  new Function("require", "module", "exports", compiled)(require, loaded, loaded.exports);
  return loaded.exports;
}

const Provider = load("app/components/LocaleProvider.tsx").default;
function render(node, locale) { return renderToStaticMarkup(createElement(Provider, { locale }, node)); }
function visible(html) { return html.replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/&amp;/g, "&").replace(/\s+/g, " "); }

test("footer retains full legal disclosures in every selected language", () => {
  const Footer = load("app/components/Footer.tsx").default;
  const expected = { en: "Property values, rental assumptions", de: "Immobilienwerte, Mietannahmen", fr: "Les valeurs immobilières, hypothèses locatives", es: "Los valores de los inmuebles, las hipótesis", it: "I valori immobiliari, le ipotesi" };
  for (const locale of locales) {
    const html = render(createElement(Footer, { locale }), locale);
    const text = visible(html);
    assert.ok(text.includes(expected[locale]), locale);
    assert.match(html, /href="\/terms"/);
    assert.match(html, /href="\/privacy"/);
    if (locale !== "en") assert.doesNotMatch(text, /Property values, rental assumptions|By using this website|Real estate investments may be illiquid|Fractional Real Estate/);
  }
});

test("all three insight articles render translated titles and complete paragraphs in five languages", async () => {
  const Page = load("app/insights/[slug]/page.tsx").default;
  const { articleTranslations } = load("app/insights/[slug]/translations.ts");
  const slugs = Object.keys(articleTranslations.de);
  assert.equal(slugs.length, 3);
  for (const locale of locales) {
    requestLocale = locale;
    for (const slug of slugs) {
      const html = render(await Page({ params: Promise.resolve({ slug }) }), locale);
      const text = visible(html);
      assert.equal((html.match(/<p /g) || []).length, 1, "one localized article date");
      assert.equal((html.match(/<p>/g) || []).length, 3, "all three article paragraphs remain visible");
      if (locale !== "en") {
        assert.ok(text.includes(articleTranslations[locale][slug].title), `${locale}/${slug}`);
        for (const paragraph of articleTranslations[locale][slug].paragraphs) assert.ok(text.includes(paragraph), `${locale}/${slug}`);
        assert.doesNotMatch(text, /Fractional real estate participation lets|Gross yield is only one|Transparency matters because/);
      }
    }
  }
});

test("funding wallet instructions and action labels do not inherit English", async () => {
  const Page = load("app/funding/page.tsx").default;
  const t = load("app/lib/admin-copy.ts").getAdminText;
  for (const locale of locales) {
    requestLocale = locale;
    const text = visible(render(await Page(), locale));
    assert.ok(text.includes(t(locale)("Company payment methods")), locale);
    assert.ok(text.includes(load("app/funding/deposit-copy.ts").depositText(locale)("intro")),locale);
    assert.ok(text.includes("Company BTC"));
    assert.ok(!text.includes("test-address"), "receiving address is shown only after selecting an amount and method");
    assert.ok(!text.includes("hidden-address"));
    if (locale !== "en") assert.doesNotMatch(text, /Company receiving wallets|Copy address|Select the exact asset|Important: send only/);
  }
});

test("mortgage headings, short options, instructions and sample-rate disclosures follow the selected language", () => {
  const Page = load("app/mortgage/page.tsx").default;
  const { createTranslator } = load("app/lib/translate.ts");
  const keys = ["Tools", "Rates", "Affordability", "Loan options", "Common terms", "Rates by city", "Rates by type", "T4 / tax documents or business income records", "1-year fixed", "Compare illustrative Canadian mortgage scenarios. These sample rates are planning assumptions, not current lender offers."];
  for (const locale of locales) {
    const text = visible(render(createElement(Page), locale));
    for (const key of keys) assert.ok(text.includes(createTranslator(locale)(key)), `${locale}: ${key}`);
    assert.doesNotMatch(text, /licensed rate API|manual admin feed|Replace sample rate data/);
    if (locale !== "en") assert.doesNotMatch(text, /Fast planning tools|common mortgage scenarios in Canada|T4 \/ tax documents|1-year fixed| average/);
    assert.ok(text.includes(new Intl.NumberFormat(locale, { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(995).replace(/\s+/g, " ")), "fees retain their numeric value with locale formatting");
  }
});

test("validation and provider authentication failures follow the selected language without external writes", async () => {
  const routes = [
    ["app/authentication/verify-phone/route.ts", "Enter a valid phone number and 6-digit code."],
    ["app/authentication/verify-otp/route.ts", "Enter your email address and the 6-digit security code."],
    ["app/interface/contact-request/route.ts", "Name, email, and message are required."],
    ["app/interface/confirmation-email/route.ts", "Please enter a valid email address."],
  ];
  const { createTranslator } = load("app/lib/translate.ts");
  const request = (locale, body) => new Request("https://example.test/action", { method: "POST", headers: { "content-type": "application/json", cookie: `brickwise-locale=${locale}; brickwise-locale-manual=1`, "accept-language": "en" }, body: JSON.stringify(body) });
  for (const locale of locales) {
    for (const [route, source] of routes) {
      const response = await load(route).POST(request(locale, {}));
      assert.equal(response.status, 400);
      assert.equal((await response.json()).error, createTranslator(locale)(source));
    }
  }
  assert.equal(authCalls, 0, "invalid submissions never reach authentication");
  for (const locale of locales) {
    const response = await load("app/authentication/verify-otp/route.ts").POST(request(locale, { email: "client@example.test", token: "123456" }));
    const data = await response.json();
    assert.equal(data.error, createTranslator(locale)("The security code is invalid or has expired. Request a new code and try again."));
    assert.doesNotMatch(data.error, /Raw English provider error/);
  }
  assert.equal(authCalls, 5);
});
