import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";

const require = createRequire(import.meta.url);
function compile(path, modules = {}) {
  const code = ts.transpileModule(readFileSync(path, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const loaded = { exports: {} };
  new Function("require", "module", "exports", code)((name) => {
    if (name in modules) return modules[name];
    if (name === "react/jsx-runtime" || name === "react" || name === "lucide-react") return require(name);
    throw new Error(`Unexpected dependency: ${name}`);
  }, loaded, loaded.exports);
  return loaded.exports;
}

const finance = compile("app/lib/client-finance.ts");
const i18n = compile("app/lib/i18n.ts");
const copy = compile("app/lib/portal-copy.ts", { "./i18n": i18n });

test("IBANs are validated with the ISO 13616 mod-97 check and masked for display", () => {
  for (const valid of ["DE89 3704 0044 0532 0130 00", "de89370400440532013000", "GB82 WEST 1234 5698 7654 32", "FR14 2004 1010 0505 0001 3M02 606"]) assert.equal(finance.isValidIban(valid), true, valid);
  for (const invalid of ["DE89 3704 0044 0532 0130 01", "DE00", "XX89370400440532013000!", "", "DE89 3704 0044 0532 0130 0O"]) assert.equal(finance.isValidIban(invalid), false, invalid);
  assert.equal(finance.maskIban("DE89 3704 0044 0532 0130 00"), "DE89 •••• 3000");
});

test("identity documents are recognised by their content, not their name", () => {
  const bytes = (...values) => Uint8Array.from(values);
  assert.deepEqual(finance.detectKycFile(new TextEncoder().encode("%PDF-1.7 ...")), { extension: "pdf", mime: "application/pdf" });
  assert.deepEqual(finance.detectKycFile(bytes(0xff, 0xd8, 0xff, 0xe0)), { extension: "jpg", mime: "image/jpeg" });
  assert.deepEqual(finance.detectKycFile(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)), { extension: "png", mime: "image/png" });
  for (const other of [new TextEncoder().encode("<html><script>"), bytes(0x47, 0x49, 0x46, 0x38), bytes()]) assert.equal(finance.detectKycFile(other), null);
});

test("ledger rows get a readable type and a running balance across the selected period", () => {
  const row = (id, created_at, type, direction, amount, extra = {}) => ({ id, created_at, type, direction, amount, property_slug: null, shares: null, reference_type: null, idempotency_key: id, ...extra });
  const rows = [
    row("a", "2026-01-05T10:00:00Z", "credit", "credit", 5000, { reference_type: "admin_credit", idempotency_key: "deposit:1" }),
    row("b", "2026-02-01T10:00:00Z", "purchase", "debit", 2000, { property_slug: "sal-rei", shares: 8 }),
    row("c", "2026-10-01T10:00:00Z", "credit", "credit", 8, { reference_type: "distribution" }),
    row("d", "2026-10-10T10:00:00Z", "adjustment", "debit", 50, { reference_type: "withdrawal" }),
    row("e", "2026-10-12T10:00:00Z", "refund", "credit", 50, { reference_type: "withdrawal_reversal" }),
    row("f", "2026-10-13T10:00:00Z", "credit", "credit", 100, { reference_type: "admin_credit", idempotency_key: "manual-credit" }),
  ];
  assert.deepEqual(rows.map((item) => finance.ledgerKind(item)), ["deposit", "purchase", "distribution", "withdrawal", "withdrawalReturned", "walletCredit"]);
  const now = new Date("2026-10-24T12:00:00Z");
  const all = finance.buildStatement(rows, "all", "all", now);
  assert.equal(all.opening, 0);
  assert.equal(all.closing, 3108);
  assert.deepEqual(all.rows.map((item) => item.balance), [3108, 3008, 2958, 3008, 3000, 5000]);
  const recent = finance.buildStatement(rows, "30", "all", now);
  assert.equal(recent.opening, 3000);
  assert.equal(recent.rows.length, 4);
  assert.deepEqual(finance.buildStatement(rows, "year", "debit", now).rows.map((item) => item.id), ["d", "b"]);
});

test("CSV cells are quoted and cannot start a spreadsheet formula", () => {
  assert.equal(finance.csvCell('Say "hi"'), '"Say ""hi"""');
  assert.equal(finance.csvCell("=HYPERLINK(\"x\")"), '"\'=HYPERLINK(""x"")"');
  assert.equal(finance.csvCell(-50), '"-50"');
  assert.equal(finance.csvCell(null), '""');
});

test("every notification kind has a localised message in all five languages", () => {
  const { notificationMessage } = compile("app/dashboard/NotificationBell.tsx", {
    "../lib/i18n": i18n, "../lib/portal-copy": copy,
  });
  const kinds = Object.keys(copy.portalCopy.en.notificationText);
  for (const locale of ["en", "de", "fr", "es", "it"]) {
    for (const kind of kinds) {
      const message = notificationMessage({ kind, payload: { amount: 8, propertySlug: "sal-rei", title: "Quarterly", shares: 5, status: "in_review" } }, locale, { "sal-rei": "Sal Rei" });
      assert.ok(message.length > 10 && !message.includes("{"), `${locale} ${kind}: ${message}`);
    }
    assert.match(notificationMessage({ kind: "distribution_credited", payload: { amount: 8, propertySlug: "sal-rei" } }, locale, { "sal-rei": "Sal Rei" }), /Sal Rei/);
    assert.equal(Object.keys(copy.portalCopy[locale].notificationText).length, kinds.length);
  }
});

function kycHarness(options = {}) {
  const calls = [];
  const user = options.user === undefined ? { id: "11111111-1111-4111-8111-111111111111", email_confirmed_at: "2026-10-01", app_metadata: {} } : options.user;
  const stored = options.stored || {};
  const bucket = {
    async createSignedUploadUrl(path) { calls.push(["sign", path]); return { data: { path, token: "token" }, error: null }; },
    async download(path) { calls.push(["download", path]); const bytes = stored[path.split("-").pop().split(".")[0]]; return bytes ? { data: new Blob([bytes]), error: null } : { data: null, error: { message: "missing" } }; },
    async remove(paths) { calls.push(["remove", paths]); return { error: null }; },
  };
  const route = compile("app/api/kyc/route.ts", {
    "node:crypto": require("node:crypto"),
    "next/cache": { revalidatePath() {} },
    "@/lib/supabase/server": { createClient: async () => ({ auth: { getUser: async () => ({ data: { user }, error: null }) } }) },
    "@/lib/supabase/service": { createServiceClient: () => ({ storage: { from: () => bucket }, rpc: async (name, args) => { calls.push(["rpc", name, args]); return { error: options.rpcError || null }; } }) },
    "@/app/lib/admin": { isAdminUser: (candidate) => candidate?.app_metadata?.role === "admin" },
    "@/app/lib/client-finance": finance,
  });
  const post = (body, headers = {}) => route.POST(new Request("https://www.brickwise-immo.de/api/kyc", {
    method: "POST", headers: { origin: "https://www.brickwise-immo.de", "content-type": "application/json", ...headers }, body: JSON.stringify(body),
  }));
  return { calls, post, user };
}
const pdf = new Uint8Array(2048); pdf.set(new TextEncoder().encode("%PDF-1.7"));
const png = new Uint8Array(2048); png.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const base = { documentType: "passport", identityExt: "pdf", addressExt: "png" };

test("KYC uploads start only for signed-in, confirmed clients with allowed file types", async () => {
  assert.equal((await kycHarness({ user: null }).post({ ...base, action: "start" })).status, 401);
  assert.equal((await kycHarness({ user: { id: "x", email_confirmed_at: null, app_metadata: {} } }).post({ ...base, action: "start" })).status, 403);
  assert.equal((await kycHarness({ user: { id: "x", email_confirmed_at: "2026", app_metadata: { role: "admin" } } }).post({ ...base, action: "start" })).status, 403);
  assert.equal((await kycHarness().post({ ...base, action: "start" }, { origin: "https://evil.invalid" })).status, 403);
  for (const patch of [{ identityExt: "exe" }, { addressExt: "html" }, { documentType: "selfie" }]) {
    const h = kycHarness();
    assert.equal((await h.post({ ...base, ...patch, action: "start" })).status, 422);
    assert.equal(h.calls.length, 0);
  }
  const h = kycHarness();
  const response = await h.post({ ...base, action: "start" });
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.match(data.uploads[0].path, new RegExp(`^${h.user.id}/${data.id}-identity\\.pdf$`));
  assert.match(data.uploads[1].path, new RegExp(`^${h.user.id}/${data.id}-address\\.png$`));
});

test("KYC completion re-checks the stored files and deletes anything that does not match", async () => {
  const id = "22222222-2222-4222-8222-222222222222";
  const good = kycHarness({ stored: { identity: pdf, address: png } });
  assert.equal((await good.post({ ...base, action: "complete", id })).status, 200);
  const rpc = good.calls.find((call) => call[0] === "rpc");
  assert.equal(rpc[1], "submit_kyc");
  assert.equal(rpc[2].p_identity_path, `${good.user.id}/${id}-identity.pdf`);
  assert.match(rpc[2].p_identity_sha256, /^[a-f0-9]{64}$/);
  assert.equal(good.calls.some((call) => call[0] === "remove"), false);

  const disguised = kycHarness({ stored: { identity: png, address: png } });
  assert.equal((await disguised.post({ ...base, action: "complete", id })).status, 422);
  assert.ok(disguised.calls.some((call) => call[0] === "remove"));
  assert.equal(disguised.calls.some((call) => call[0] === "rpc"), false);

  const tiny = kycHarness({ stored: { identity: pdf.subarray(0, 100), address: png } });
  assert.equal((await tiny.post({ ...base, action: "complete", id })).status, 422);

  const duplicate = kycHarness({ stored: { identity: pdf, address: png }, rpcError: { message: "KYC_ALREADY_PENDING" } });
  assert.equal((await duplicate.post({ ...base, action: "complete", id })).status, 409);
  assert.ok(duplicate.calls.some((call) => call[0] === "remove"));

  assert.equal((await kycHarness().post({ ...base, action: "complete", id: "../../other" })).status, 422);
});

function actionHarness(options = {}) {
  const calls = [];
  const user = options.user === undefined ? { id: "u1", app_metadata: {} } : options.user;
  const actions = compile("app/dashboard/portal-actions.ts", {
    "next/cache": { revalidatePath() {} },
    "@/lib/supabase/server": { createClient: async () => ({
      auth: { getUser: async () => ({ data: { user } }) },
      rpc: async (name, args) => { calls.push([name, args]); return { error: options.rpcError || null }; },
    }) },
    "../lib/admin": { isAdminUser: (candidate) => candidate?.app_metadata?.role === "admin" },
    "../lib/client-finance": finance,
  });
  return { calls, actions };
}
const form = (values) => { const data = new FormData(); for (const [key, value] of Object.entries(values)) data.set(key, value); return data; };
const validWithdrawal = { amount: "250,50", account_holder: "Anna Müller", iban: "de89 3704 0044 0532 0130 00", bic: "cobadeffxxx", client_key: "33333333-3333-4333-8333-333333333333" };

test("withdrawal requests are validated before they reach the database and errors are mapped for the client", async () => {
  const ok = actionHarness();
  assert.deepEqual(await ok.actions.requestWithdrawal({ result: "" }, form(validWithdrawal)), { result: "saved" });
  assert.deepEqual(ok.calls, [["request_withdrawal", { p_amount: "250.50", p_account_holder: "Anna Müller", p_iban: "DE89370400440532013000", p_bic: "COBADEFFXXX", p_client_key: validWithdrawal.client_key }]]);
  for (const [patch, result] of [[{ amount: "5" }, "amount"], [{ amount: "abc" }, "amount"], [{ iban: "DE89 3704 0044 0532 0130 01" }, "iban"], [{ account_holder: "A" }, "error"], [{ client_key: "x" }, "error"], [{ bic: "123" }, "error"]]) {
    const h = actionHarness();
    assert.deepEqual(await h.actions.requestWithdrawal({ result: "" }, form({ ...validWithdrawal, ...patch })), { result }, JSON.stringify(patch));
    assert.equal(h.calls.length, 0);
  }
  for (const [message, result] of [["WITHDRAWAL_KYC_REQUIRED", "kyc"], ["WITHDRAWAL_INSUFFICIENT_FUNDS", "funds"], ["boom", "error"]]) {
    assert.deepEqual(await actionHarness({ rpcError: { message } }).actions.requestWithdrawal({ result: "" }, form(validWithdrawal)), { result });
  }
  assert.deepEqual(await actionHarness({ user: { id: "a", app_metadata: { role: "admin" } } }).actions.requestWithdrawal({ result: "" }, form(validWithdrawal)), { result: "error" });
  assert.deepEqual(await actionHarness({ user: null }).actions.requestWithdrawal({ result: "" }, form(validWithdrawal)), { result: "error" });
});

test("share sale requests validate the holding request and map oversized requests", async () => {
  const sale = { property_slug: "sal-rei-boa-vista-b1-residences-ap1", shares: "5", note: "Need liquidity", client_key: "44444444-4444-4444-8444-444444444444" };
  const ok = actionHarness();
  assert.deepEqual(await ok.actions.requestShareSale({ result: "" }, form(sale)), { result: "saved" });
  assert.equal(ok.calls[0][0], "request_share_sale");
  assert.deepEqual(await actionHarness({ rpcError: { message: "SALE_TOO_MANY_SHARES" } }).actions.requestShareSale({ result: "" }, form(sale)), { result: "tooMany" });
  for (const patch of [{ shares: "0" }, { shares: "1.5" }, { property_slug: "../x" }, { client_key: "" }]) {
    const h = actionHarness();
    assert.deepEqual(await h.actions.requestShareSale({ result: "" }, form({ ...sale, ...patch })), { result: "error" });
    assert.equal(h.calls.length, 0);
  }
});

test("statement exports require a session and produce a quoted CSV with a running balance", async () => {
  const ledger = [
    { id: "a", type: "credit", direction: "credit", amount: 5000, property_slug: null, shares: null, reference_type: "admin_credit", idempotency_key: "deposit:1", created_at: new Date(Date.now() - 5 * 86400000).toISOString() },
    { id: "b", type: "purchase", direction: "debit", amount: 2000, property_slug: "sal-rei", shares: 8, reference_type: null, idempotency_key: "b", created_at: new Date(Date.now() - 2 * 86400000).toISOString() },
  ];
  const route = (user) => compile("app/api/statements/route.ts", {
    "@/lib/supabase/server": { createClient: async () => ({ auth: { getUser: async () => ({ data: { user }, error: null }) } }) },
    "@/app/lib/i18n": i18n, "@/app/lib/portal-copy": copy, "@/app/lib/client-finance": finance,
    "@/app/lib/statement-data": { loadLedger: async () => ledger },
    "@/app/lib/statement-pdf": { buildTablePdf: async () => new Uint8Array([37, 80, 68, 70]) },
    "@/app/lib/property-registry": { getAllProperties: async () => [{ slug: "sal-rei", title: "Sal Rei" }] },
    "@/app/lib/property-localization": { getPropertyTranslations: async () => new Map() },
  });
  assert.equal((await route(null).GET(new Request("https://x.invalid/api/statements"))).status, 401);
  const response = await route({ id: "u1", email: "a@example.invalid", user_metadata: {} }).GET(new Request("https://x.invalid/api/statements?format=csv&range=30"));
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /text\/csv/);
  assert.match(response.headers.get("cache-control"), /no-store/);
  const bytes = new Uint8Array(await response.arrayBuffer());
  assert.deepEqual([...bytes.slice(0, 3)], [0xef, 0xbb, 0xbf], "UTF-8 BOM for spreadsheet apps");
  const csv = new TextDecoder().decode(bytes);
  assert.ok(csv.startsWith("\"Date\""), csv.slice(0, 40));
  assert.match(csv, /"Share purchase · 8 shares";"Sal Rei";"";"2000.00";"3000.00"/);
  assert.match(csv, /"Deposit";"";"5000.00";"";"5000.00"/);
  const pdf = await route({ id: "u1", email: "a@example.invalid", user_metadata: {} }).GET(new Request("https://x.invalid/api/statements?format=pdf"));
  assert.equal(pdf.headers.get("content-type"), "application/pdf");
});

function adminActionHarness(file, options = {}) {
  const calls = [];
  const actions = compile(file, {
    "next/cache": { revalidatePath() {} },
    "@/lib/supabase/server": { createClient: async () => ({
      auth: { getUser: async () => ({ data: { user: { id: "admin" } }, error: null }) },
      rpc: async (name, args) => { calls.push([name, args]); return { error: options.rpcError || null }; },
    }) },
    "@/app/lib/admin-session": { hasAdminSession: async () => options.session !== false },
  });
  return { calls, actions };
}

test("rental distributions need a verified admin, a closed past period, a positive cent amount and explicit confirmation", async () => {
  const file = "app/admin/distributions/actions.ts";
  const valid = { property_slug: "sal-rei-boa-vista-b1-residences-ap1", period_start: "2026-09-01", period_end: "2026-09-30", net_amount: "1500,50", note: "September rent", confirm: "yes" };
  const ok = adminActionHarness(file);
  assert.deepEqual(await ok.actions.recordDistribution({ result: "" }, form(valid)), { result: "saved" });
  assert.deepEqual(ok.calls, [["record_property_distribution", { p_property_slug: valid.property_slug, p_period_start: "2026-09-01", p_period_end: "2026-09-30", p_net_amount: "1500.50", p_note: "September rent" }]]);
  const future = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
  for (const patch of [{ confirm: "" }, { period_end: "2026-08-31" }, { period_end: future }, { period_start: "2026-02-30" }, { net_amount: "0" }, { net_amount: "1.234" }, { property_slug: "../x" }, { note: "x".repeat(1001) }]) {
    const h = adminActionHarness(file);
    assert.deepEqual(await h.actions.recordDistribution({ result: "" }, form({ ...valid, ...patch })), { result: "error" }, JSON.stringify(patch));
    assert.equal(h.calls.length, 0);
  }
  assert.deepEqual(await adminActionHarness(file, { session: false }).actions.recordDistribution({ result: "" }, form(valid)), { result: "error" });
  assert.deepEqual(await adminActionHarness(file, { rpcError: { message: "duplicate key" } }).actions.recordDistribution({ result: "" }, form(valid)), { result: "error" });
});

test("sale request reviews and property updates are validated before the database is called", async () => {
  const sale = adminActionHarness("app/admin/sale-requests/actions.ts");
  const review = { id: "55555555-5555-4555-8555-555555555555", decision: "completed", note: "Sold to an existing investor." };
  assert.deepEqual(await sale.actions.updateSaleRequest({ result: "" }, form(review)), { result: "saved" });
  assert.deepEqual(sale.calls, [["update_share_sale_request", { p_id: review.id, p_status: "completed", p_note: review.note }]]);
  for (const patch of [{ decision: "pending" }, { note: "ok" }, { id: "x" }]) {
    const h = adminActionHarness("app/admin/sale-requests/actions.ts");
    assert.deepEqual(await h.actions.updateSaleRequest({ result: "" }, form({ ...review, ...patch })), { result: "error" });
    assert.equal(h.calls.length, 0);
  }
  const news = adminActionHarness("app/admin/property-updates/actions.ts");
  const update = { property_slug: "calgary-beltline-rental", title: "New tenant signed", body: "A new 12-month lease starts on 1 November.\nRent is unchanged." };
  assert.deepEqual(await news.actions.publishPropertyUpdate({ result: "" }, form(update)), { result: "saved" });
  assert.deepEqual(news.calls, [["publish_property_update", { p_property_slug: update.property_slug, p_title: update.title, p_body: update.body }]]);
  for (const patch of [{ title: "Hi" }, { title: "Bad\u0007title" }, { body: "x".repeat(5001) }, { property_slug: "UPPER" }]) {
    const h = adminActionHarness("app/admin/property-updates/actions.ts");
    assert.deepEqual(await h.actions.publishPropertyUpdate({ result: "" }, form({ ...update, ...patch })), { result: "error" });
    assert.equal(h.calls.length, 0);
  }
  assert.deepEqual(await adminActionHarness("app/admin/property-updates/actions.ts", { session: false }).actions.publishPropertyUpdate({ result: "" }, form(update)), { result: "error" });
});

test("property profit payouts are validated, paid once per key and shown to the client as property profit", async () => {
  const calls = [];
  const harness = (options = {}) => compile("app/admin/customers/[id]/actions.ts", {
    "next/cache": { revalidatePath() {} },
    "@/lib/supabase/server": { createClient: async () => ({
      auth: { getUser: async () => ({ data: { user: { id: "admin" } }, error: null }) },
      rpc: async (name, args) => { calls.push([name, args]); return { error: options.rpcError || null }; },
    }) },
    "@/app/lib/admin-session": { hasAdminSession: async () => options.session !== false },
  });
  const payout = { user_id: "88888888-8888-4888-8888-888888888888", property_slug: "sal-rei-boa-vista-b1-residences-ap1", amount: "125,50", note: "October 2026 rental income", client_key: "99999999-9999-4999-8999-999999999999", confirm: "yes" };
  assert.deepEqual(await harness().payClientProfit({ result: "" }, form(payout)), { result: "saved" });
  assert.deepEqual(calls.pop(), ["pay_client_profit", { p_user_id: payout.user_id, p_property_slug: payout.property_slug, p_amount: "125.50", p_note: "October 2026 rental income", p_client_key: payout.client_key }]);
  for (const [patch, result] of [[{ amount: "0" }, "amount"], [{ amount: "1.234" }, "amount"], [{ amount: "-5" }, "amount"], [{ confirm: "" }, "error"], [{ client_key: "x" }, "error"], [{ property_slug: "../x" }, "error"], [{ note: "x".repeat(301) }, "error"]]) {
    assert.deepEqual(await harness().payClientProfit({ result: "" }, form({ ...payout, ...patch })), { result }, JSON.stringify(patch));
  }
  assert.equal(calls.length, 0, "invalid payouts never reach the database");
  assert.deepEqual(await harness({ rpcError: { message: "PROFIT_NO_HOLDING" } }).payClientProfit({ result: "" }, form(payout)), { result: "holding" });
  assert.deepEqual(await harness({ session: false }).payClientProfit({ result: "" }, form(payout)), { result: "error" });

  assert.equal(finance.ledgerKind({ type: "credit", reference_type: "profit_payout", idempotency_key: "profit:1" }), "profit");
  const bell = compile("app/dashboard/NotificationBell.tsx", { react: require("react"), "lucide-react": require("lucide-react"), "../lib/i18n": i18n, "../lib/portal-copy": copy });
  for (const locale of ["en", "de", "fr", "es", "it"]) {
    assert.ok(copy.portalCopy[locale].transactionType.profit, locale);
    const message = bell.notificationMessage({ kind: "distribution_credited", payload: { source: "profit", amount: 125.5, propertySlug: "sal-rei" } }, locale, { "sal-rei": "Sal Rei" });
    assert.ok(message.includes("Sal Rei") && message !== bell.notificationMessage({ kind: "distribution_credited", payload: { amount: 125.5, propertySlug: "sal-rei" } }, locale, { "sal-rei": "Sal Rei" }), locale);
  }
});

test("admin-added properties become investable listings only with an active status, a rent and a share price", async () => {
  const rows = [];
  let saleStatus = { data: [], error: null };
  const registry = compile("app/lib/property-registry.ts", {
    react: { cache: (fn) => fn },
    "@supabase/supabase-js": { createClient: () => ({ from: (table) => table === "property_sale_status"
      ? { select: () => ({ abortSignal: async () => saleStatus }) }
      : { select: () => ({ in: () => ({ order: () => ({ abortSignal: async () => ({ data: rows, error: null }) }) }) }) } }) },
    "./investment-policy": { MINIMUM_INVESTMENT_EUR: 500 },
    "./external-properties": { externalProperties: [{ slug: "sal-rei", status: "active", investmentOpen: true, constructionStatus: "completed" }], getExternalPropertyBySlug: (slug) => slug === "sal-rei" ? { slug } : undefined,
      hiddenManualPropertyIds: ["hidden-id"], hiddenManualPropertySlugs: [], isPropertyOpenForInvestment: (property) => property.investmentOpen ?? property.status === "active" },
  });
  const base = { id: "p1", title: "Lisbon Loft", slug: "lisbon-loft-1", description: null, price: "300000", city: "Lisbon", address: "Rua 1", property_type: null, bedrooms: 2, bathrooms: 1, area: "80", rooms: "3",
    image_url: null, status: "active", created_at: "2026-10-26T10:00:00Z", monthly_rent: "2400", monthly_expenses: "400", share_price: "250", image_urls: ["https://images.example/a.jpg", "https://images.example/b.jpg"], construction_status: "completed" };
  const listing = registry.mapDatabaseProperty(base);
  assert.equal(listing.investmentOpen, true);
  assert.equal(listing.targetTotalReturn, 8, "(2400 - 400) x 12 / 300000 = 8%");
  assert.equal(listing.sharePrice, 250);
  assert.equal(listing.image_url, "https://images.example/a.jpg");
  assert.equal(listing.costsStated, true);
  assert.equal(listing.valueGrowthYield, undefined);
  const growing = registry.mapDatabaseProperty({ ...base, monthly_value_growth: "500" });
  assert.deepEqual([growing.valueGrowthYield, growing.targetTotalReturn], [2, 8], "value growth (500 x 12 / 300000 = 2%) stays outside the rental yield");
  assert.equal(registry.mapDatabaseProperty({ ...base, construction_status: "upcoming" }).constructionStatus, "upcoming");
  for (const patch of [{ status: "draft" }, { status: "available" }, { share_price: null }, { monthly_rent: null }, { monthly_rent: "0" }, { construction_status: "upcoming" }]) {
    assert.equal(registry.mapDatabaseProperty({ ...base, ...patch }).investmentOpen, false, JSON.stringify(patch));
  }
  rows.push(base, { ...base, id: "hidden-id", slug: "hidden" }, { ...base, id: "dup", slug: "sal-rei" });
  process.env.NEXT_PUBLIC_SUPABASE_URL ||= "https://project.invalid";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||= "anon-test";
  const all = await registry.getAllProperties();
  assert.deepEqual(all.map((property) => property.slug), ["sal-rei", "lisbon-loft-1"], "hidden rows and catalogue duplicates are skipped");
  assert.equal((await registry.findProperty("sal-rei")).investmentOpen, true);
  saleStatus = { data: [{ property_slug: "sal-rei", construction_status: "upcoming" }], error: null };
  const upcoming = await registry.findProperty("sal-rei");
  assert.deepEqual([upcoming.constructionStatus, upcoming.investmentOpen], ["upcoming", false], "the admin's Upcoming status closes a catalogue listing");
  saleStatus = { data: [{ property_slug: "sal-rei", construction_status: "under_construction" }], error: null };
  assert.equal((await registry.findProperty("sal-rei")).investmentOpen, true);
  saleStatus = { data: null, error: { message: "unavailable" } };
  assert.equal((await registry.findProperty("sal-rei")).investmentOpen, false, "an unreadable sale status fails closed");
  assert.equal((await registry.findProperty("lisbon-loft-1")).title, "Lisbon Loft");
});
