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
    "@/app/lib/admin": { isAdminUser: () => authorized },
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
    "@/app/lib/admin": { isAdminUser },
    "@supabase/supabase-js": { createClient: () => service },
    "@/app/lib/content-translations": { contentLocales, readRequiredTranslation },
    "@/app/lib/admin-audit": { writeAdminMutation() { throw new Error("Share settings cannot use a generic table write"); } },
    "@/app/lib/external-properties": { getExternalPropertyBySlug: () => listing },
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
