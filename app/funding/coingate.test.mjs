import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";

const require = createRequire(import.meta.url);
function compile(path, modules = {}) {
  const code = ts.transpileModule(readFileSync(path, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const loaded = { exports: {} };
  new Function("require", "module", "exports", "process", code)((name) => {
    if (name in modules) return modules[name];
    if (name === "node:crypto") return require("node:crypto");
    throw new Error(`Unexpected dependency: ${name}`);
  }, loaded, loaded.exports, process);
  return loaded.exports;
}

const coingate = compile("app/lib/coingate.ts");
const depositId = "11111111-1111-4111-8111-111111111111";
const order = (patch = {}) => ({ id: 4242, status: "paid", order_id: depositId, price_amount: "250.0", price_currency: "EUR", pay_amount: "250.12", pay_currency: "USDT", receive_amount: "247.5", receive_currency: "EUR", underpaid_amount: "0", paid_at: "2026-10-24T10:00:00Z", payment_url: "https://pay.coingate.com/invoice/abc", ...patch });

function withFetch(handler, run) {
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, init = {}) => { calls.push({ url: String(url), init }); return handler(String(url), init); };
  return run(calls).finally(() => { globalThis.fetch = original; });
}
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
function withEnv(values, run) {
  const saved = Object.fromEntries(Object.keys(values).map((key) => [key, process.env[key]]));
  Object.assign(process.env, values);
  for (const [key, value] of Object.entries(values)) if (value === undefined) delete process.env[key];
  return Promise.resolve().then(run).finally(() => { for (const [key, value] of Object.entries(saved)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } });
}

test("CoinGate stays off without a token and only its own checkout pages are accepted", async () => {
  await withEnv({ COINGATE_API_TOKEN: undefined }, () => assert.equal(coingate.coinGateConfig(), null));
  await withEnv({ COINGATE_API_TOKEN: "tok", COINGATE_ENVIRONMENT: "sandbox", COINGATE_RECEIVE_CURRENCY: undefined }, () => {
    const config = coingate.coinGateConfig();
    assert.equal(config.baseUrl, "https://api-sandbox.coingate.com/api/v2");
    assert.equal(config.receiveCurrency, null, "the integration's dashboard settings decide by default");
  });
  await withEnv({ COINGATE_API_TOKEN: "tok", COINGATE_RECEIVE_CURRENCY: "eur" }, () => assert.equal(coingate.coinGateConfig().receiveCurrency, "EUR"));
  for (const ok of ["https://pay.coingate.com/invoice/1", "https://pay-sandbox.coingate.com/x", "https://coingate.com/pay"]) assert.equal(coingate.isCoinGatePaymentUrl(ok), true, ok);
  for (const bad of ["http://pay.coingate.com/x", "https://coingate.com.evil.example/x", "https://evilcoingate.com/x", "javascript:alert(1)", null]) assert.equal(coingate.isCoinGatePaymentUrl(bad), false, String(bad));
  const { token, hash } = coingate.newCallbackToken();
  assert.match(token, /^[0-9a-f]{64}$/);
  assert.equal(coingate.callbackTokenMatches(token, hash), true);
  assert.equal(coingate.callbackTokenMatches("0".repeat(64), hash), false);
  assert.equal(coingate.callbackTokenMatches(token, "not-a-hash"), false);
});

test("settlement values come from the API order and malformed numbers are dropped", () => {
  const args = coingate.settlementArgs(depositId, order({ pay_amount: "1e9", underpaid_amount: "-5", status: "PAID" }));
  assert.equal(args.p_status, "paid");
  assert.equal(args.p_price_amount, "250.0");
  assert.equal(args.p_price_currency, "EUR");
  assert.equal(args.p_pay_amount, null);
  assert.equal(args.p_underpaid, null);
  assert.equal(args.p_paid_at, "2026-10-24T10:00:00.000Z");
});

function routeHarness({ user = { id: "u1", email_confirmed_at: "2026-10-01", app_metadata: {} }, rpc = {}, existing } = {}) {
  const calls = [];
  const service = {
    rpc: async (name, args) => { calls.push([name, args]); return rpc[name] ? rpc[name](args) : { data: name === "create_gateway_deposit" ? depositId : null, error: null }; },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: existing ? existing(calls) : { payment_url: null, callback_token_hash: calls.find(([n]) => n === "create_gateway_deposit")?.[1].p_token_hash, status: "created" }, error: null }) }) }) }),
  };
  const route = compile("app/api/deposits/coingate/route.ts", {
    "@/lib/supabase/server": { createClient: async () => ({ auth: { getUser: async () => ({ data: { user }, error: null }) } }) },
    "@/lib/supabase/service": { createServiceClient: () => service },
    "@/app/lib/admin": { isAdminUser: (candidate) => candidate?.app_metadata?.role === "admin" },
    "@/app/lib/seo": { siteOrigin: "https://www.brickwise-immo.de" },
    "@/app/lib/coingate": coingate,
  });
  return { route, calls };
}
const post = (body, origin = "https://www.brickwise-immo.de") => new Request("https://www.brickwise-immo.de/api/deposits/coingate", { method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify(body) });
const validBody = { amount: "250", clientKey: "22222222-2222-4222-8222-222222222222" };

test("a checkout opens only for a confirmed client, with a valid amount, and redirects only to CoinGate", () => withEnv({ COINGATE_API_TOKEN: "tok", COINGATE_ENVIRONMENT: "live", VERCEL_ENV: "production" }, async () => {
  assert.equal((await routeHarness().route.POST(post(validBody, "https://evil.example"))).status, 403);
  assert.equal((await routeHarness({ user: null }).route.POST(post(validBody))).status, 401);
  assert.equal((await routeHarness({ user: { id: "a", email_confirmed_at: "x", app_metadata: { role: "admin" } } }).route.POST(post(validBody))).status, 403);
  assert.equal((await routeHarness({ user: { id: "u", email_confirmed_at: null, app_metadata: {} } }).route.POST(post(validBody))).status, 403);
  for (const amount of ["9.99", "abc", "1000000.01", "10.001"]) assert.equal((await routeHarness().route.POST(post({ ...validBody, amount }))).status, 400, amount);

  await withFetch(async (url, init) => {
    const fields = new URLSearchParams(init.body);
    return json(order({ status: "new", order_id: fields.get("order_id"), price_amount: fields.get("price_amount") }));
  }, async (fetchCalls) => {
    const { route, calls } = routeHarness();
    const response = await route.POST(post(validBody));
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { url: "https://pay.coingate.com/invoice/abc" });
    assert.equal(fetchCalls[0].url, "https://api.coingate.com/api/v2/orders");
    assert.equal(fetchCalls[0].init.headers.Authorization, "Token tok");
    const sent = new URLSearchParams(fetchCalls[0].init.body);
    assert.equal(sent.get("price_amount"), "250.00");
    assert.equal(sent.get("price_currency"), "EUR");
    assert.equal(sent.has("receive_currency"), false, "no override of the dashboard settlement currency");
    assert.equal(sent.get("callback_url"), "https://www.brickwise-immo.de/api/deposits/coingate/callback");
    assert.equal(coingate.hashCallbackToken(sent.get("token")), calls[0][1].p_token_hash, "only the hash of the callback token is stored");
    assert.deepEqual(calls[1], ["attach_gateway_order", { p_id: depositId, p_order_id: 4242, p_payment_url: "https://pay.coingate.com/invoice/abc" }]);
  });

  await withFetch(async () => json(order({ status: "new", payment_url: "https://evil.example/pay" })), async () => {
    const { route, calls } = routeHarness();
    assert.equal((await route.POST(post(validBody))).status, 503);
    assert.equal(calls.some(([name]) => name === "attach_gateway_order"), false);
  });
  await withEnv({ COINGATE_API_TOKEN: undefined }, async () => assert.equal((await routeHarness().route.POST(post(validBody))).status, 503));
}));

function callbackHarness({ storedHash, providerOrderId = 4242 } = {}) {
  const calls = [];
  const service = {
    rpc: async (name, args) => { calls.push([name, args]); return { data: "paid", error: null }; },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: depositId, provider_order_id: providerOrderId, callback_token_hash: storedHash }, error: null }) }) }) }),
  };
  const route = compile("app/api/deposits/coingate/callback/route.ts", {
    "@/lib/supabase/service": { createServiceClient: () => service },
    "@/app/lib/coingate": coingate,
  });
  return { route, calls };
}
const callback = (fields, type = "application/json") => new Request("https://www.brickwise-immo.de/api/deposits/coingate/callback", {
  method: "POST", headers: { "content-type": type }, body: type === "application/json" ? JSON.stringify(fields) : new URLSearchParams(fields).toString(),
});

test("callbacks need the order's secret token and the status is always re-read from CoinGate", () => withEnv({ COINGATE_API_TOKEN: "tok", COINGATE_ENVIRONMENT: "live" }, async () => {
  const { token, hash } = coingate.newCallbackToken();
  // The body claims "paid", but the API still says "pending": the API wins.
  await withFetch(async () => json(order({ status: "pending" })), async (fetchCalls) => {
    const { route, calls } = callbackHarness({ storedHash: hash });
    const response = await route.POST(callback({ id: 4242, order_id: depositId, status: "paid", price_amount: "999999", token }));
    assert.equal(response.status, 200);
    assert.equal(fetchCalls[0].url, "https://api.coingate.com/api/v2/orders/4242");
    assert.equal(calls[0][0], "settle_gateway_deposit");
    assert.equal(calls[0][1].p_status, "pending");
    assert.equal(calls[0][1].p_price_amount, "250.0");
  });
  await withFetch(async () => json(order()), async () => {
    const { route, calls } = callbackHarness({ storedHash: hash });
    assert.equal((await route.POST(callback({ id: "4242", order_id: depositId, token }, "application/x-www-form-urlencoded"))).status, 200, "form-encoded callbacks work too");
    assert.equal(calls[0][1].p_status, "paid");
  });
  await withFetch(async () => json(order()), async (fetchCalls) => {
    assert.equal((await callbackHarness({ storedHash: hash }).route.POST(callback({ id: 4242, order_id: depositId, token: "0".repeat(64) }))).status, 403);
    assert.equal((await callbackHarness({ storedHash: hash, providerOrderId: 1 }).route.POST(callback({ id: 4242, order_id: depositId, token }))).status, 403);
    assert.equal((await callbackHarness({ storedHash: hash }).route.POST(callback({ id: 4242, order_id: "x", token }))).status, 400);
    assert.equal(fetchCalls.length, 0, "rejected callbacks never reach CoinGate or the database");
  });
  await withFetch(async () => json(order({ order_id: "33333333-3333-4333-8333-333333333333" })), async () => {
    const { route, calls } = callbackHarness({ storedHash: hash });
    assert.equal((await route.POST(callback({ id: 4242, order_id: depositId, token }))).status, 403);
    assert.equal(calls.length, 0);
  });
  await withFetch(async () => json({ message: "down" }, 500), async () => {
    assert.equal((await callbackHarness({ storedHash: hash }).route.POST(callback({ id: 4242, order_id: depositId, token }))).status, 503, "CoinGate retries later");
  });
}));
