import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const projectRoot = path.resolve(root, "..");
const require = createRequire(import.meta.url);
const slug = "test-premium-villa";
const row = (investment_tier) => ({
  id: "p1", title: "Test Villa", slug, description: "A test villa.", price: 4000000, city: "Munich", address: "Test street 1, Munich",
  property_type: "Villa", bedrooms: 5, bathrooms: 4, area: 400, rooms: null, image_url: null, image_urls: [], status: "active", created_at: "2026-10-01T00:00:00Z",
  monthly_rent: 18000, monthly_expenses: 2000, share_price: 20000, construction_status: "completed", monthly_value_growth: 0,
  investment_tier, strategy: "prime", occupancy_status: "rented", exited_at: null,
});

// Renders the real property page with the database, session and framework boundaries replaced.
function renderer(tier, user = null) {
  const cache = new Map();
  const database = {
    auth: { getUser: async () => ({ data: { user }, error: null }) },
    from(table) {
      const result = table === "properties" ? row(tier) : table === "property_share_settings" ? { total_shares: 200, blocked_shares: 10 } : table === "wallet_accounts" ? { balance: 0, currency: "EUR" } : null;
      const query = {};
      for (const method of ["select", "eq", "neq", "in", "or", "order", "limit", "abortSignal"]) query[method] = () => query;
      query.maybeSingle = async () => ({ data: result, error: null });
      query.single = query.maybeSingle;
      query.then = (resolve, reject) => Promise.resolve({ data: result && !Array.isArray(result) ? [] : [], error: null }).then(resolve, reject);
      return query;
    },
  };
  function load(filename) {
    if (cache.has(filename)) return cache.get(filename);
    if (filename.endsWith(".json")) return JSON.parse(readFileSync(filename, "utf8"));
    const code = ts.transpileModule(readFileSync(filename, "utf8"), { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
    const loaded = { exports: {} };
    cache.set(filename, loaded.exports);
    const imports = (name) => {
      if (name.endsWith(".css")) return {};
      if (name === "@/app/lib/server-locale") return { getCurrentLocale: async () => "en" };
      if (name.endsWith("supabase/server")) return { createClient: async () => database };
      if (name === "@supabase/supabase-js") return { createClient: () => database };
      if (name === "@/lib/supabase/auth") return { getCurrentUser: async () => user };
      if (/(?:^|\/)actions$/.test(name)) return new Proxy({}, { get: () => async () => { throw new Error("Rendering must never invoke a mutation"); } });
      if (name.endsWith("ClientPortalSidebar")) return { __esModule: true, default: () => null };
      if (name === "next/navigation") return { notFound() { throw new Error("notFound"); }, redirect() { throw new Error("redirect"); }, usePathname: () => `/properties/${slug}`, useRouter: () => ({}) };
      if (name === "next/link") return { __esModule: true, default: ({ href, children, ...props }) => createElement("a", { href, ...props }, children) };
      if (name === "next/image") return { __esModule: true, default: ({ alt }) => createElement("img", { alt }) };
      if (name.startsWith("@/") || name.startsWith(".")) {
        const base = name.startsWith("@/") ? path.join(projectRoot, name.slice(2)) : path.resolve(path.dirname(filename), name);
        const resolved = [base, `${base}.ts`, `${base}.tsx`, `${base}.json`].find((candidate) => existsSync(candidate) && !candidate.endsWith(path.sep));
        assert.ok(resolved, name);
        return load(resolved);
      }
      return require(name);
    };
    new Function("require", "module", "exports", "process", code)(imports, loaded, loaded.exports, { env: { NEXT_PUBLIC_SUPABASE_URL: "https://test.invalid", NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-only" } });
    cache.set(filename, loaded.exports);
    return loaded.exports;
  }
  const page = load(path.join(root, "properties/[slug]/page.tsx")).default;
  return async () => renderToStaticMarkup(await page({ params: Promise.resolve({ slug }) }));
}

for (const tier of ["premium", "super_premium"]) {
  test(`${tier} property pages show only the value and monthly rent, with an agent instead of shares`, async () => {
    for (const user of [null, { id: "client", email: "client@example.invalid", app_metadata: {}, user_metadata: {} }]) {
      const html = await renderer(tier, user)();
      const who = user ? "client" : "visitor";
      assert.ok(html.includes("€4,000,000"), `${who}: property value`);
      assert.ok(html.includes("Monthly rent") && html.includes("€18,000"), `${who}: monthly rent`);
      assert.ok(html.includes(`href="/contact?projekt=${slug}"`) && html.includes("Talk to an agent"), `${who}: agent contact`);
      for (const hidden of ["Share price", "Funded", "Minimum", "Reserve shares", "buy-shares", "€20,000", "Create client account", "Total shares"]) {
        assert.ok(!html.includes(hidden), `${who}: ${hidden} must not appear`);
      }
    }
  });
}

test("standard property pages keep their share terms and purchase flow", async () => {
  const html = await renderer("standard")();
  assert.ok(html.includes("Share price") && html.includes("Minimum"));
  assert.ok(!html.includes("Talk to an agent"));
});
