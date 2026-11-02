import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";

const code = ts.transpileModule(readFileSync(new URL("./route.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const rows = {
  deposit_submissions: [{ id: "d1", user_id: "c1", customer_name: "Anna Müller", customer_email: "anna@example.invalid", requested_eur: "2500.00", created_at: "2026-11-02T10:00:00Z" }],
  gateway_deposits: [],
  withdrawal_requests: [{ id: "w1", user_id: "c2", amount: "300", created_at: "2026-11-02T11:00:00Z" }],
  client_kyc_submissions: [{ id: "k1", user_id: "c1", created_at: "2026-11-01T09:00:00Z" }],
  client_agreement_acceptances: [], share_sale_requests: [], property_requests: [],
};

function harness(admin) {
  const tables = [];
  const database = {
    auth: { getUser: async () => ({ data: { user: { id: "u", app_metadata: { role: admin ? "admin" : "client" } } } }) },
    from(table) {
      tables.push(table);
      const query = { select: () => query, eq: () => query, in: () => query, or: () => query, order: () => query, limit: () => query,
        then: (resolve, reject) => Promise.resolve({ data: rows[table] || [], error: null }).then(resolve, reject) };
      return query;
    },
  };
  const modules = {
    "next/server": { NextResponse: { json: (body, init = {}) => ({ body, status: init.status || 200, headers: init.headers }) } },
    "@/lib/supabase/server": { createClient: async () => database },
    "@/app/lib/admin-session": { hasAdminSession: async (_client, user) => user?.app_metadata?.role === "admin" },
    "@/app/admin/client-directory": { getClientDirectory: async () => new Map([["c2", { name: "Ben Kraus", email: "ben@example.invalid", admin: false }]]) },
    "@/app/admin/attention": { getAdminAttention: async () => ({ newRequests: 0, pendingDeposits: 4, pendingAgreements: 0, pendingPayments: 9, pendingKyc: 1, pendingWithdrawals: 1, pendingSales: 0 }) },
  };
  const loaded = { exports: {} };
  new Function("require", "module", "exports", code)((name) => { assert.ok(modules[name], name); return modules[name]; }, loaded, loaded.exports);
  return { GET: loaded.exports.GET, tables };
}

test("only a confirmed admin session can read the inbox", async () => {
  const h = harness(false);
  const response = await h.GET();
  assert.equal(response.status, 401);
  assert.equal(response.headers["Cache-Control"], "no-store");
  assert.deepEqual(h.tables, []);
});

test("inbox lists newest first, opens payments on the wallet page and counts like the sidebar", async () => {
  const response = await harness(true).GET();
  assert.equal(response.status, 200);
  assert.deepEqual(response.body.items.map((item) => item.kind), ["withdrawal", "deposit", "kyc"]);
  const [withdrawal, deposit] = response.body.items;
  assert.equal(withdrawal.name, "Ben Kraus");
  assert.equal(withdrawal.href, "/admin/wallet#withdrawal-w1");
  assert.equal(deposit.amount, 2500);
  assert.equal(deposit.href, "/admin/wallet#deposit-d1");
  // Payment requests wait on the client, so they are not counted.
  assert.equal(response.body.total, 6);
});
