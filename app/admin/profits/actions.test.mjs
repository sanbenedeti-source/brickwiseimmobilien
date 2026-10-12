import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import { getPropertyShareSupply } from "../../lib/property-financials.ts";

const property = { slug: "sal-rei", price: 116100, sharePrice: 100, totalShares: 1161, blockedShares: 31 };
const compiled = ts.transpileModule(readFileSync(new URL("./actions.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function harness({ exists = true, adminUser = true } = {}) {
  const writes = [];
  const current = { property_slug: property.slug, total_shares: 1161, blocked_shares: 71, projected_annual_return: 9.25 };
  const database = { from: () => ({
    select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: exists ? current : null, error: null }) }) }),
    update: (payload) => ({ eq: async () => { writes.push({ kind: "update", payload }); Object.assign(current, payload); return { error: null }; } }),
    insert: async (payload) => { writes.push({ kind: "insert", payload }); return { error: null }; },
  }) };
  const modules = {
    "next/cache": { revalidatePath() {} },
    "next/navigation": { redirect(location) { throw Object.assign(new Error("redirect"), { location }); } },
    "@supabase/supabase-js": { createClient: () => database },
    "@/app/lib/admin": { isAdminUser: () => adminUser },
    "@/lib/supabase/server": { createClient: async () => ({ auth: { getUser: async () => ({ data: { user: { id: "admin" } } }) } }) },
    "@/app/lib/admin-audit": { writeAdminMutation: async (_client,event,ops) => {assert.equal(event.action,"profit_status.update");for(const op of ops){writes.push({kind:op.operation,payload:op.data});Object.assign(current,op.data);}return {error:null};} },
    "@/app/lib/external-properties": { getExternalPropertyBySlug: (slug) => slug === property.slug ? property : undefined },
    "@/app/lib/property-financials": { getPropertyShareSupply },
  };
  const loadedModule = { exports: {} };
  new Function("require", "module", "exports", "process", compiled)(
    (name) => { assert.ok(modules[name], name); return modules[name]; }, loadedModule, loadedModule.exports,
    { env: { NEXT_PUBLIC_SUPABASE_URL: "https://example.invalid", SUPABASE_SERVICE_ROLE_KEY: "test-only" } },
  );
  return { writes, current, run: loadedModule.exports.updateProfitSettings };
}

function form(overrides = {}) {
  const data = new FormData();
  for (const [key, value] of Object.entries({ property_slug: property.slug, profit_active: "on", profit_start_date: "2026-09-24", ...overrides })) data.set(key, value);
  return data;
}

test("status changes preserve historical rates and reservations even when forged financial fields are submitted", async () => {
  const app = harness();
  await assert.rejects(app.run(form({ projected_annual_return: "34.76", total_shares: "1", blocked_shares: "0" })), (error) => error.location?.includes("status=saved"));
  assert.equal(app.writes.length, 1);
  assert.equal(app.writes[0].kind, "update");
  assert.deepEqual(Object.keys(app.writes[0].payload).sort(), ["profit_active", "profit_start_date", "updated_at"]);
  assert.equal(app.current.projected_annual_return, 9.25);
  assert.equal(app.current.blocked_shares, 71);
  assert.equal(app.current.total_shares, 1161);
});

test("first status record uses authoritative opening allocation without storing target return as a wallet rate", async () => {
  const app = harness({ exists: false });
  await assert.rejects(app.run(form()), (error) => error.location?.includes("status=saved"));
  const [{ kind, payload }] = app.writes;
  assert.equal(kind, "insert");
  assert.equal(payload.total_shares, 1161);
  assert.equal(payload.blocked_shares, 31);
  assert.equal(payload.projected_annual_return, undefined);
});

test("unauthorized requests and invalid properties or dates never mutate earnings settings", async () => {
  const unauthorized = harness({ adminUser: false });
  await assert.rejects(unauthorized.run(form()), (error) => error.location === "/admin");
  assert.equal(unauthorized.writes.length, 0);
  for (const overrides of [{ property_slug: "unknown" }, { profit_start_date: "2026-02-30" }, { profit_start_date: "invalid" }]) {
    const app = harness();
    await assert.rejects(app.run(form(overrides)), (error) => error.location?.includes("status=invalid"));
    assert.equal(app.writes.length, 0);
  }
});
