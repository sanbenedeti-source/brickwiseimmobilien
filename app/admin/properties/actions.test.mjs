import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import { contentLocales, readRequiredTranslation } from "../../lib/content-translations.ts";
import { parseEuroAmount } from "../../api/properties/import/euro-amount.ts";
import { isAdminUser } from "../../lib/admin.ts";

const compiled = ts.transpileModule(readFileSync(new URL("./actions.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function harness({ authorized = true, configured = true, translationFailure = false } = {}) {
  const writes = [];
  const service = { from(table) { return {
    upsert: async (payload) => { writes.push({ table, kind: "translations", payload }); return { error: translationFailure ? { message: "test failure" } : null }; },
    update: (payload) => ({ eq: async (key, value) => { writes.push({ table, kind: "publish", payload, key, value }); return { error: null }; } }),
  }; } };
  const session = {
    auth: { getUser: async () => ({ data: { user: authorized ? { id: "test-admin" } : null }, error: null }) },
    from: (table) => ({ insert: async (payload) => { writes.push({ table, kind: "insert", payload }); return { error: null }; } }),
  };
  const dependencies = {
    "next/cache": { revalidatePath() {} },
    "next/navigation": { redirect(location) { throw Object.assign(new Error("redirect"), { location }); } },
    "@/lib/supabase/server": { createClient: async () => session },
    "@/app/lib/admin": { isAdminUser: () => authorized }, "@/app/lib/admin-session": { hasAdminSession: async () => authorized },
    "@supabase/supabase-js": { createClient: () => service },
    "@/app/lib/content-translations": { contentLocales, readRequiredTranslation },
    "@/app/lib/admin-audit": { writeAdminMutation: async (_client,event,ops) => {
      assert.equal(event.action,"property.create");
      if(translationFailure)return {error:{message:"Atomic failure"}};
      writes.push({kind:"insert",payload:ops[0].data});
      writes.push({kind:"translations",payload:ops.filter(op=>op.table==="property_translations").map(op=>op.data)});
      const publish=ops.find(op=>op.operation==="update");if(publish)writes.push({kind:"publish",payload:publish.data});
      return {error:null};
    } },
    "@/app/lib/external-properties": { getExternalPropertyBySlug: () => undefined },
    "@/app/lib/investment-policy": { INVESTMENT_TIERS: ["standard", "premium", "super_premium"] },
    "@/app/api/properties/import/euro-amount": { parseEuroAmount },
  };
  const loadedModule = { exports: {} };
  new Function("require", "module", "exports", "process", "console", compiled)(
    (name) => { assert.ok(dependencies[name], name); return dependencies[name]; },
    loadedModule, loadedModule.exports,
    { env: configured ? { NEXT_PUBLIC_SUPABASE_URL: "https://test.invalid", SUPABASE_SERVICE_ROLE_KEY: "test-only" } : {} },
    { error() {} },
  );
  return { run: loadedModule.exports.createProperty, writes };
}

function form(overrides = {}) {
  const values = { city: "Toronto", address: "123 Test Street, Toronto", price: "735000.25", area: "75", rooms: "3", status: "active" };
  for (const locale of contentLocales) { values[`title_${locale}`] = `Test ${locale}`; values[`description_${locale}`] = `Description ${locale}`; }
  const data = new FormData();
  for (const [key, value] of Object.entries({ ...values, ...overrides })) data.set(key, value);
  return data;
}

test("an active property is published only after its address and all five translations are stored", async () => {
  const app = harness();
  await assert.rejects(app.run(form()), (error) => error.location?.includes("status=saved"));
  assert.deepEqual(app.writes.map((write) => write.kind), ["insert", "translations", "publish"]);
  assert.equal(app.writes[0].payload.status, "draft");
  assert.equal(app.writes[0].payload.address, "123 Test Street, Toronto");
  assert.equal(app.writes[0].payload.price, 735000.25);
  assert.deepEqual(app.writes[1].payload.map((value) => value.locale), contentLocales);
  assert.equal(app.writes[2].payload.status, "active");
});

test("failed translations cannot expose a partly translated listing", async () => {
  const app = harness({ translationFailure: true });
  await assert.rejects(app.run(form()), (error) => error.location?.includes("status=error"));
  assert.deepEqual(app.writes, []);
});

test("explicit drafts remain drafts even with complete translations", async () => {
  const app = harness();
  await assert.rejects(app.run(form({ status: "draft" })), (error) => error.location?.includes("status=saved"));
  assert.deepEqual(app.writes.map((write) => write.kind), ["insert", "translations"]);
});

test("missing address, translation or invalid amounts cannot create property records", async () => {
  for (const invalid of [{ address: "" }, { description_it: "" }, { price: "CAD 735000" }, { rooms: "NaN" }, { area: "-1" }, { status: "invalid" }]) {
    const app = harness();
    await assert.rejects(app.run(form(invalid)), (error) => error.location?.includes("status=invalid"));
    assert.equal(app.writes.length, 0);
  }
});

test("unauthorized or unconfigured requests never write property records", async () => {
  const unauthorized = harness({ authorized: false });
  await unauthorized.run(form());
  assert.equal(unauthorized.writes.length, 0);
  const unconfigured = harness({ configured: false });
  await assert.rejects(unconfigured.run(form()), (error) => error.location?.includes("status=error"));
  assert.equal(unconfigured.writes.length, 0);
});

const adminId = "00000000-0000-4000-8000-000000000099";

function shareHarness({ role = "admin", authError = null, configured = true, listing, rpcError = null, networkFailure = false } = {}) {
  const calls = [];
  const revalidated = [];
  const service = {
    async rpc(name, args) {
      calls.push({ name, args });
      if (networkFailure) throw new Error("Private network diagnostics");
      return { error: rpcError };
    },
    from() { throw new Error("Share availability must use the atomic RPC"); },
  };
  const dependencies = {
    "next/cache": { revalidatePath(path) { revalidated.push(path); } },
    "next/navigation": { redirect(location) { throw Object.assign(new Error("redirect"), { location }); } },
    "@/lib/supabase/server": { createClient: async () => ({ auth: { getUser: async () => ({
      data: { user: role === null ? null : { id: adminId, app_metadata: { role }, user_metadata: { role: "admin" } } }, error: authError,
    }) } }) },
    "@/app/lib/admin": { isAdminUser }, "@/app/lib/admin-session": { hasAdminSession: async (_client, user) => isAdminUser(user) },
    "@supabase/supabase-js": { createClient: () => service },
    "@/app/lib/content-translations": { contentLocales, readRequiredTranslation },
    "@/app/lib/admin-audit": { writeAdminMutation() { throw new Error("Share settings cannot use a generic table write"); } },
    "@/app/lib/external-properties": { getExternalPropertyBySlug: () => listing },
    "@/app/lib/investment-policy": { INVESTMENT_TIERS: ["standard", "premium", "super_premium"] },
    "@/app/api/properties/import/euro-amount": { parseEuroAmount },
  };
  const loadedModule = { exports: {} };
  new Function("require", "module", "exports", "process", "console", compiled)(
    (name) => { assert.ok(dependencies[name], name); return dependencies[name]; },
    loadedModule, loadedModule.exports,
    { env: configured ? { NEXT_PUBLIC_SUPABASE_URL: "https://test.invalid", SUPABASE_SERVICE_ROLE_KEY: "test-only" } : {} },
    { error() {} },
  );
  return { run: loadedModule.exports.updateShareSettings, calls, revalidated };
}

function shareForm(overrides = {}) {
  const data = new FormData();
  for (const [key, value] of Object.entries({ property_slug: "test-property", total_shares: "100", blocked_shares: "20", expected_version: "3", ...overrides })) {
    if (value !== null) data.set(key, value);
  }
  return data;
}

const shareResult = (status) => (error) => error.location === `/admin/properties?status=${status}&property=test-property#share-availability`;

test("share availability uses one atomic versioned write with the authenticated admin and revalidates affected views", async () => {
  const app = shareHarness();
  await assert.rejects(app.run(shareForm()), shareResult("shares-saved"));
  assert.deepEqual(app.calls, [{ name: "update_share_settings_atomic", args: {
    p_actor: adminId, p_property_slug: "test-property", p_total_shares: 100,
    p_blocked_shares: 20, p_expected_version: 3, p_minimum_blocked_shares: 0,
  } }]);
  assert.deepEqual(app.revalidated, ["/admin/properties", "/properties", "/properties/test-property", "/dashboard", "/", "/admin/profits"]);
});

test("share availability gets its opening allocation from the listing and ignores submitted actor or floor", async () => {
  const app = shareHarness({ listing: { totalShares: 100, blockedShares: 7 } });
  await assert.rejects(app.run(shareForm({ p_actor: "attacker", minimum_blocked_shares: "0" })), shareResult("shares-saved"));
  assert.equal(app.calls[0].args.p_actor, adminId);
  assert.equal(app.calls[0].args.p_minimum_blocked_shares, 7);
});

test("a share settings row that did not exist in the rendered form is explicitly versioned as -1", async () => {
  const app = shareHarness();
  await assert.rejects(app.run(shareForm({ expected_version: "-1" })), shareResult("shares-saved"));
  assert.equal(app.calls[0].args.p_expected_version, -1);
});

test("a stale share form is refreshed with a visible conflict and never silently retried", async () => {
  const app = shareHarness({ rpcError: { message: "share_settings_stale" } });
  await assert.rejects(app.run(shareForm()), shareResult("shares-stale"));
  assert.equal(app.calls.length, 1);
  assert.deepEqual(app.revalidated, ["/admin/properties"]);
});

test("the database owned-share floor violation is shown without retrying or reporting success", async () => {
  const app = shareHarness({ rpcError: { message: "share_settings_below_owned" } });
  await assert.rejects(app.run(shareForm()), shareResult("shares-owned"));
  assert.equal(app.calls.length, 1);
  assert.deepEqual(app.revalidated, ["/admin/properties"]);
});

test("missing, malformed, out-of-range counts or versions cannot reach the share RPC", async () => {
  for (const invalid of [
    { total_shares: null }, { blocked_shares: null }, { expected_version: null },
    { total_shares: "" }, { blocked_shares: "" }, { expected_version: "" },
    { total_shares: "0" }, { blocked_shares: "-1" }, { expected_version: "-2" },
    { total_shares: "2147483648" }, { expected_version: "9007199254740992" },
    { total_shares: "10.5" }, { blocked_shares: "1e1" }, { expected_version: "3.0" },
    { expected_version: " 3" }, { blocked_shares: "101" },
  ]) {
    const app = shareHarness();
    await assert.rejects(app.run(shareForm(invalid)), shareResult("shares-invalid"));
    assert.equal(app.calls.length, 0, JSON.stringify(invalid));
    assert.deepEqual(app.revalidated, []);
  }
});

test("listing share totals and opening allocations cannot be weakened by an admin form", async () => {
  for (const invalid of [{ total_shares: "101" }, { blocked_shares: "6" }]) {
    const app = shareHarness({ listing: { totalShares: 100, blockedShares: 7 } });
    await assert.rejects(app.run(shareForm(invalid)), shareResult("shares-invalid"));
    assert.equal(app.calls.length, 0);
  }
});

test("unauthenticated, customer-metadata admin claims and failed auth never reach the share RPC", async () => {
  for (const options of [{ role: null }, { role: "customer" }, { authError: { message: "expired session" } }]) {
    const app = shareHarness(options);
    await assert.rejects(app.run(shareForm()), (error) => error.location === "/admin");
    assert.equal(app.calls.length, 0);
    assert.deepEqual(app.revalidated, []);
  }
});

test("unconfigured, network and unknown database failures show only the safe share error", async () => {
  for (const options of [{ configured: false }, { networkFailure: true }, { rpcError: { message: "Private database diagnostics" } }]) {
    const app = shareHarness(options);
    await assert.rejects(app.run(shareForm()), shareResult("shares-error"));
    assert.equal(app.calls.length, options.configured === false ? 0 : 1);
  }
});

function saleHarness({ authorized = true, current = { price: "600000", share_price: null }, settings = null, listing } = {}) {
  const writes = [];
  const calls = [];
  const service = {
    from(table) {
      const row = table === "properties" ? current : settings;
      const query = { select: () => query, eq: () => query, maybeSingle: async () => ({ data: row, error: null }) };
      return query;
    },
    async rpc(name, args) { calls.push({ name, args }); return { error: null }; },
  };
  const dependencies = {
    "next/cache": { revalidatePath() {} },
    "next/navigation": { redirect(location) { throw Object.assign(new Error("redirect"), { location }); } },
    "@/lib/supabase/server": { createClient: async () => ({ auth: { getUser: async () => ({ data: { user: authorized ? { id: adminId } : null }, error: null }) } }) },
    "@/app/lib/admin": { isAdminUser: () => authorized }, "@/app/lib/admin-session": { hasAdminSession: async () => authorized },
    "@supabase/supabase-js": { createClient: () => service },
    "@/app/lib/content-translations": { contentLocales, readRequiredTranslation },
    "@/app/lib/admin-audit": { writeAdminMutation: async (_client, event, ops) => { writes.push(...ops.map((op) => ({ ...op, action: event.action }))); return { error: null }; } },
    "@/app/lib/external-properties": { getExternalPropertyBySlug: () => listing },
    "@/app/lib/investment-policy": { INVESTMENT_TIERS: ["standard", "premium", "super_premium"] },
    "@/app/api/properties/import/euro-amount": { parseEuroAmount },
  };
  const loadedModule = { exports: {} };
  new Function("require", "module", "exports", "process", "console", compiled)(
    (name) => { assert.ok(dependencies[name], name); return dependencies[name]; },
    loadedModule, loadedModule.exports,
    { env: { NEXT_PUBLIC_SUPABASE_URL: "https://test.invalid", SUPABASE_SERVICE_ROLE_KEY: "test-only" } },
    { error() {} },
  );
  return { run: loadedModule.exports.updatePropertySale, runCatalogue: loadedModule.exports.updateCatalogueSaleStatus, runDetails: loadedModule.exports.updatePropertyDetails, writes, calls };
}

function saleForm(overrides = {}) {
  const data = new FormData();
  for (const [key, value] of Object.entries({ property_slug: "munich-loft", construction_status: "completed", status: "active", price: "600000", monthly_rent: "2500", monthly_expenses: "300", share_price: "250", ...overrides })) data.set(key, value);
  return data;
}

const saleResult = (status) => (error) => error.location === `/admin/properties?status=${status}&property=munich-loft#sales-status`;

test("an upcoming property is opened for purchase with its pricing and gets its shares", async () => {
  const app = saleHarness();
  await assert.rejects(app.run(saleForm()), saleResult("sale-saved"));
  assert.deepEqual(app.writes, [{ action: "property.sale_settings", table: "properties", operation: "update", match: { slug: "munich-loft" },
    data: { price: 600000, monthly_rent: 2500, monthly_expenses: 300, share_price: 250, monthly_value_growth: null, construction_status: "completed", status: "active", investment_tier: "standard" } }]);
  assert.deepEqual(app.calls.map((call) => [call.args.p_total_shares, call.args.p_expected_version, call.args.p_actor]), [[2400, -1, adminId]]);
});

test("a property can be set back to upcoming, and rent changes keep sold shares untouched", async () => {
  const app = saleHarness({ current: { price: "600000", share_price: "250" }, settings: { blocked_shares: 40, availability_version: 4 } });
  await assert.rejects(app.run(saleForm({ construction_status: "upcoming", monthly_rent: "2700" })), saleResult("sale-saved"));
  assert.equal(app.writes[0].data.construction_status, "upcoming");
  assert.equal(app.calls.length, 0);
});

test("the investment tier sets the property's minimum and is saved with the sales settings", async () => {
  for (const tier of ["premium", "super_premium", "standard"]) {
    const app = saleHarness({ current: { price: "600000", share_price: "250" }, settings: { blocked_shares: 40, availability_version: 4 } });
    await assert.rejects(app.run(saleForm({ investment_tier: tier })), saleResult("sale-saved"));
    assert.equal(app.writes[0].data.investment_tier, tier);
    assert.equal(app.calls.length, 0, "changing the tier never touches sold shares");
  }
});

test("price and share price are locked once shares are sold", async () => {
  for (const change of [{ share_price: "300" }, { price: "650000" }]) {
    const app = saleHarness({ current: { price: "600000", share_price: "250" }, settings: { blocked_shares: 40, availability_version: 4 } });
    await assert.rejects(app.run(saleForm(change)), saleResult("sale-locked"));
    assert.equal(app.writes.length + app.calls.length, 0, JSON.stringify(change));
  }
});

test("invalid sales settings, catalogue listings and non-admins never write", async () => {
  for (const invalid of [{ construction_status: "sold" }, { status: "archived" }, { share_price: "700000" }, { price: "" }, { monthly_rent: "-5" }, { investment_tier: "gold" }]) {
    const app = saleHarness();
    await assert.rejects(app.run(saleForm(invalid)), saleResult("sale-invalid"));
    assert.equal(app.writes.length + app.calls.length, 0, JSON.stringify(invalid));
  }
  const listing = saleHarness({ listing: { slug: "munich-loft" } });
  await assert.rejects(listing.run(saleForm()), saleResult("sale-invalid"));
  const outsider = saleHarness({ authorized: false });
  await assert.rejects(outsider.run(saleForm()), (error) => error.location === "/admin");
  assert.equal(listing.writes.length + outsider.writes.length, 0);
});

test("a catalogue listing on the website is marked Upcoming or reopened through one audited status write", async () => {
  const app = saleHarness({ listing: { slug: "munich-loft", listed: true } });
  const data = new FormData();
  data.set("property_slug", "munich-loft");
  data.set("construction_status", "upcoming");
  await assert.rejects(app.runCatalogue(data), saleResult("sale-saved"));
  assert.equal(app.writes.length, 1);
  assert.deepEqual([app.writes[0].action, app.writes[0].table, app.writes[0].operation, app.writes[0].data.property_slug, app.writes[0].data.construction_status, app.writes[0].data.updated_by],
    ["property.sale_status", "property_sale_status", "upsert", "munich-loft", "upcoming", adminId]);
  assert.equal(app.writes[0].data.investment_tier, "standard");
  const premium = saleHarness({ listing: { slug: "munich-loft", listed: true } });
  data.set("investment_tier", "super_premium");
  await assert.rejects(premium.runCatalogue(data), saleResult("sale-saved"));
  assert.equal(premium.writes[0].data.investment_tier, "super_premium");
});

test("hidden or unknown listings, invalid statuses and non-admins cannot change a catalogue sale status", async () => {
  for (const [options, status, tier] of [[{ listing: { slug: "munich-loft", listed: false } }, "completed"], [{}, "completed"], [{ listing: { slug: "munich-loft" } }, "sold"], [{ listing: { slug: "munich-loft" } }, "completed", "gold"]]) {
    const app = saleHarness(options);
    const data = new FormData();
    data.set("property_slug", "munich-loft");
    data.set("construction_status", status);
    if (tier) data.set("investment_tier", tier);
    await assert.rejects(app.runCatalogue(data), saleResult("sale-invalid"));
    assert.equal(app.writes.length, 0);
  }
  const outsider = saleHarness({ authorized: false, listing: { slug: "munich-loft" } });
  await assert.rejects(outsider.runCatalogue(new FormData()), (error) => error.location === "/admin");
  assert.equal(outsider.writes.length, 0);
});

function detailsForm(overrides = {}) {
  const data = new FormData();
  data.set("property_slug", "munich-loft");
  for (const locale of contentLocales) { data.set(`title_${locale}`, `Loft ${locale}`); data.set(`description_${locale}`, `Description ${locale}`); }
  for (const [key, value] of Object.entries({ address: "Leopoldstr. 1", city: "Munich", area: "120", rooms: "4", bedrooms: "3", bathrooms: "2", image_url: "",
    image_urls: "/properties/munich-loft/01.webp\nhttps://images.example/02.jpg", ...overrides })) data.set(key, value);
  return data;
}
const detailsResult = (status) => (error) => error.location === `/admin/properties/munich-loft/edit?status=${status}`;

test("property details and all five translations are saved in one audited write without touching pricing", async () => {
  const app = saleHarness({ current: { slug: "munich-loft" } });
  await assert.rejects(app.runDetails(detailsForm()), detailsResult("saved"));
  assert.deepEqual(app.writes.map((write) => [write.action, write.table, write.operation]), [
    ["property.update", "properties", "update"], ...contentLocales.map(() => ["property.update", "property_translations", "upsert"]),
  ]);
  const base = app.writes[0];
  assert.deepEqual(base.match, { slug: "munich-loft" });
  assert.deepEqual(base.data, { title: "Loft en", description: "Description en", property_type: null, city: "Munich", address: "Leopoldstr. 1",
    area: 120, rooms: 4, bedrooms: 3, bathrooms: 2, image_url: "/properties/munich-loft/01.webp", image_urls: ["/properties/munich-loft/01.webp", "https://images.example/02.jpg"] });
  for (const key of ["price", "share_price", "monthly_rent", "status", "investment_tier", "slug"]) assert.equal(key in base.data, false, key);
  assert.deepEqual(app.writes.slice(1).map((write) => [write.data.property_slug, write.data.locale]), contentLocales.map((locale) => ["munich-loft", locale]));
  assert.equal(app.calls.length, 0);
});

test("missing translations, unsafe image addresses and invalid counts never write property details", async () => {
  const thirteen = Array.from({ length: 13 }, (_, index) => `/properties/a/${index}.webp`).join("\n");
  for (const invalid of [{ description_de: "" }, { city: "" }, { address: "" }, { image_urls: thirteen }, { image_urls: "javascript:alert(1)" },
    { image_urls: "//evil.example/a.jpg" }, { image_urls: "/properties/../secret" }, { image_url: "http://insecure.example/a.jpg" }, { bedrooms: "2.5" }, { area: "-1" }]) {
    const app = saleHarness({ current: { slug: "munich-loft" } });
    await assert.rejects(app.runDetails(detailsForm(invalid)), detailsResult("invalid"), JSON.stringify(invalid));
    assert.equal(app.writes.length, 0, JSON.stringify(invalid));
  }
  for (const [options, location] of [[{ listing: { slug: "munich-loft" } }, "/admin/properties"], [{ current: null }, "/admin/properties"], [{ authorized: false }, "/admin"]]) {
    const app = saleHarness(options);
    await assert.rejects(app.runDetails(detailsForm()), (error) => error.location === location);
    assert.equal(app.writes.length, 0);
  }
});
