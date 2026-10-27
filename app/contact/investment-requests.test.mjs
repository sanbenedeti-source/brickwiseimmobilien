import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import ts from "typescript";

const root = fileURLToPath(new URL("../../", import.meta.url));
const salRei = "sal-rei-boa-vista-b1-residences-ap1";
const calgary = "calgary-beltline-rental";
const purchaseRequestId = "7e412fa4-03f3-40c0-a9fb-c98cdf54bf2e";

class Redirect extends Error {
  constructor(destination) { super(destination); this.destination = destination; }
}

// Execute the real Server Actions with isolated framework/database boundaries.
// Local financial helpers and listings are loaded without mocks.
function harness({
  settings = null, settingsError = null, rate = null, listingOverrides = {}, walletError = null,
  user = { id: "test-user", email: "client@example.com", user_metadata: {} },
  authError = null,
  previousTransactions = [], walletLookupError = null, walletBalance = Infinity,
  walletAvailableShares = Infinity, commitBeforeWalletError = false,
} = {}) {
  const saved = [];
  const walletCalls = [];
  const walletReads = [];
  const revalidated = [];
  const walletTransactions = [...previousTransactions];
  const walletState = { balance: walletBalance, shares: walletAvailableShares, debits: 0 };
  let rateRequests = 0;
  const client = {
    auth: { getUser: async () => ({ data: { user }, error: authError }) },
    from(table) {
      return {
        select() { return this; }, eq() { return this; },
        maybeSingle: async () => ({ data: settings, error: settingsError }),
        insert: async (payload) => { saved.push({ table, payload }); return { error: null }; },
      };
    },
  };
  const admin = {
    from(table) {
      assert.equal(table, "wallet_transactions");
      const filters = {};
      return {
        select() { return this; },
        eq(key, value) { filters[key] = value; return this; },
        async maybeSingle() {
          walletReads.push(filters);
          return { data: walletTransactions.find((transaction) => Object.entries(filters).every(([key, value]) => transaction[key] === value)) ?? null, error: walletLookupError };
        },
      };
    },
    async rpc(name, args) {
      walletCalls.push({ name, args });
      if (walletError && !commitBeforeWalletError) return { error: walletError };
      const amount = Math.round(args.p_shares * args.p_price_per_share * 100) / 100;
      if (walletState.balance < amount) return { error: { message: "insufficient_funds" } };
      if (walletState.shares < args.p_shares) return { error: { message: "insufficient_shares" } };
      if (walletTransactions.some((transaction) => transaction.idempotency_key === args.p_idempotency_key)) {
        return { error: { code: "23505", message: "duplicate key value violates unique constraint" } };
      }
      walletTransactions.push({
        user_id: args.p_user_id, type: "purchase", direction: "debit", property_slug: args.p_property_slug,
        shares: args.p_shares, amount, currency: "EUR", idempotency_key: args.p_idempotency_key,
      });
      walletState.balance -= amount;
      walletState.shares -= args.p_shares;
      walletState.debits++;
      return { error: walletError };
    },
  };
  const cache = new Map();
  function load(filename) {
    if (cache.has(filename)) return cache.get(filename).exports;
    const output = ts.transpileModule(readFileSync(filename, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    const loaded = { exports: {} };
    cache.set(filename, loaded);
    const require = (name) => {
      if (name === "next/navigation") return { redirect: (destination) => { throw new Redirect(destination); } };
      if (name === "react") return { cache: (fn) => fn };
      if (name === "next/cache") return { revalidatePath: (route) => revalidated.push(route) };
      if (name === "@/lib/supabase/server") return { createClient: async () => client };
      if (name === "@supabase/supabase-js") return { createClient: () => admin };
      if (name.endsWith("/exchange-rate")) return { getInvestmentExchangeRate: async () => { rateRequests++; return rate; } };
      const resolved = name.startsWith("@/") ? path.join(root, name.slice(2)) : path.resolve(path.dirname(filename), name);
      return load(`${resolved}.ts`);
    };
    new Function("require", "module", "exports", "process", output)(require, loaded, loaded.exports, {env:{NEXT_PUBLIC_SUPABASE_URL:"https://test.invalid",SUPABASE_SERVICE_ROLE_KEY:"test-only"}});
    return loaded.exports;
  }
  const listings = load(path.join(root, "app/lib/external-properties.ts"));
  for (const [slug, overrides] of Object.entries(listingOverrides)) {
    const property = listings.getExternalPropertyBySlug(slug);
    assert.ok(property, `Unknown test property: ${slug}`);
    Object.assign(property, overrides);
  }
  return {
    listings,
    contact: load(path.join(root, "app/contact/actions.ts")).createContactRequest,
    purchase: load(path.join(root, "app/dashboard/actions.ts")).createSharePurchaseRequest,
    saved,
    walletCalls,
    walletReads,
    walletTransactions,
    walletState,
    revalidated,
    get rateRequests() { return rateRequests; },
  };
}

function contactForm(shares, slug = salRei) {
  const form = new FormData();
  for (const [key, value] of Object.entries({ first_name: "Test", last_name: "Client", email: "client@example.com", message: "Please review my request.", investment_slug: slug, investment_shares: String(shares) })) form.set(key, value);
  return form;
}

function purchaseForm(shares, payment = "bank_transfer", slug = salRei) {
  const form = new FormData();
  form.set("property_slug", slug);
  form.set("shares", String(shares));
  form.set("payment_method", payment);
  return form;
}

function walletForm(shares = 20, slug = salRei) {
  const form = purchaseForm(shares, "wallet_balance", slug);
  form.set("purchase_request_id", purchaseRequestId);
  return form;
}

async function redirected(action, form, destination) {
  await assert.rejects(() => action(form), (error) => error instanceof Redirect && error.destination === destination);
}


test("completed Sal Rei remains open for investment and explicit closure is respected", () => {
  const { listings } = harness();
  assert.ok(listings.listedProperties.length > 0 && listings.listedProperties.every(listings.isPropertyOpenForInvestment));
  // Unlisted catalogue entries stay viewable for holders but accept no new investment.
  for (const property of listings.externalProperties.filter((item) => item.listed === false)) {
    assert.equal(listings.isPropertyOpenForInvestment(property), false, property.slug);
  }
  assert.equal(listings.getExternalPropertyBySlug(salRei).status, "active");
  assert.equal(listings.getExternalPropertyBySlug(salRei).constructionStatus, "completed");
  assert.equal(listings.isPropertyOpenForInvestment({ status: "active", investmentOpen: false }), false);
  assert.equal(listings.isPropertyOpenForInvestment({ status: "paused" }), false);
});

test("both Server Actions reject closed listings before creating investment requests", async () => {
  for (const [slug, overrides] of [
    [salRei, { investmentOpen: false }],
    [calgary, { investmentOpen: false }],
    [calgary, { status: "paused" }],
  ]) {
    const app = harness({ listingOverrides: { [slug]: overrides } });
    await redirected(app.contact, contactForm(20, slug), "/contact?error=investment");
    await redirected(app.purchase, purchaseForm(20, "bank_transfer", slug), "/dashboard?request=invalid#properties");
    assert.equal(app.saved.length, 0);
    assert.equal(app.rateRequests, 0);
  }
});

test("the admin account cannot buy shares and is sent back to the admin panel", async () => {
  const app = harness({ user: { id: "test-admin", email: "admin@example.com", user_metadata: {}, app_metadata: { role: "admin" } } });
  await redirected(app.purchase, walletForm(), "/admin");
  assert.equal(app.walletCalls.length, 0);
  assert.equal(app.saved.length, 0);
});

test("unlisted catalogue entries reject new contact and purchase requests", async () => {
  const { listings } = harness();
  const unlisted = listings.externalProperties.filter((item) => item.listed === false);
  assert.ok(unlisted.length > 0);
  for (const property of unlisted) {
    const app = harness();
    const shares = Math.ceil(2000 / property.sharePrice);
    await redirected(app.contact, contactForm(shares, property.slug), "/contact?error=investment");
    await redirected(app.purchase, purchaseForm(shares, "bank_transfer", property.slug), "/dashboard?request=invalid#properties");
    assert.equal(app.saved.length, 0, property.slug);
  }
});

test("every listed property accepts the EUR 2000 minimum and records its net rental yield", async () => {
  // (monthly rent - stated costs) x 12 / price; Sal Rei has no stated costs yet.
  const expectedRates = {
    [salRei]: 18.09,
    "edmonton-windsor-park-8712-120-st": 11,
    "toronto-midtown-condo": 3.51,
    "vancouver-kitsilano-suite": 3.02,
    [calgary]: 3.93,
    "ottawa-centretown-duplex": 3.91,
    "montreal-plateau-triplex": 3.9,
  };
  const { listings } = harness();
  assert.equal(listings.externalProperties.length, Object.keys(expectedRates).length);
  const euro = (value) => new Intl.NumberFormat("en-CA", {
    style: "currency", currency: "EUR", currencyDisplay: "code", minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(value);
  for (const property of listings.listedProperties) {
    const app = harness();
    const shares = Math.ceil(2000 / property.sharePrice);
    const annual = shares * property.sharePrice * expectedRates[property.slug] / 100;
    const monthly = annual / 12;
    assert.equal(property.currency, "EUR", property.slug);
    await redirected(app.contact, contactForm(shares, property.slug), "/thank-you?conversion=lead");
    await redirected(app.purchase, purchaseForm(shares, "bank_transfer", property.slug), "/dashboard/orders?request=sent");
    assert.equal(app.rateRequests, 0, property.slug);
    assert.equal(app.saved.length, 2);
    assert.ok(app.saved[0].payload.message.includes("Total amount: 2000.00 EUR"));
    assert.ok(app.saved[0].payload.message.includes(`Projected net rent per year: ${annual.toFixed(2)} EUR`), property.slug);
    assert.ok(app.saved[0].payload.message.includes(`Projected net rent per month: ${monthly.toFixed(2)} EUR`), property.slug);
    assert.ok(app.saved[1].payload.message.includes(`Projected net rent per year: ${euro(annual)}`), property.slug);
    assert.ok(app.saved[1].payload.message.includes(`Projected net rent per month: ${euro(monthly)}`), property.slug);
    for (const { payload } of app.saved) {
      assert.ok(payload.message.includes(`Projected rental yield: ${expectedRates[property.slug].toFixed(2)}%`), property.slug);
      assert.doesNotMatch(payload.message, /Target annual return|Vacation point|Appreciation|Modelled/);
      assert.doesNotMatch(payload.message, /CAD|ECB|Projected annual cash return/);
      assert.equal(payload.status, "new");
    }
  }
});

test("both Server Actions reject below-minimum, fractional, nonfinite and unavailable shares", async () => {
  const { listings } = harness();
  for (const property of listings.externalProperties) {
    const minimumShares = Math.ceil(2000 / property.sharePrice);
    for (const shares of [0, minimumShares - 1, minimumShares + 0.5, Infinity, NaN]) {
      const app = harness();
      await redirected(app.contact, contactForm(shares, property.slug), "/contact?error=investment");
      await redirected(app.purchase, purchaseForm(shares, "bank_transfer", property.slug), "/dashboard?request=invalid#properties");
      assert.equal(app.saved.length, 0);
    }
  }
  const soldOut = harness({ settings: { total_shares: 1061, blocked_shares: 1042 } });
  await redirected(soldOut.contact, contactForm(20), "/contact?error=investment");
  await redirected(soldOut.purchase, purchaseForm(20), "/dashboard?request=invalid#properties");
});

test("EUR wallet purchases use trusted listing prices and the atomic EUR ledger", async () => {
  const { listings } = harness();
  for (const property of listings.listedProperties) {
    const app = harness();
    const shares = Math.ceil(2000 / property.sharePrice);
    const form = walletForm(shares, property.slug);
    form.set("currency", "CAD");
    form.set("amount", "1");
    form.set("price_per_share", "0.01");
    form.set("user_id", "another-user");
    form.set("email", "another-client@example.com");
    await redirected(app.purchase, form, "/dashboard/orders?request=purchased");
    assert.equal(app.walletCalls.length, 1);
    assert.equal(app.walletCalls[0].name, "purchase_shares_with_wallet_atomic");
    assert.equal(app.walletCalls[0].args.p_price_per_share, property.sharePrice);
    assert.equal(app.walletCalls[0].args.p_shares, shares);
    assert.equal(app.walletCalls[0].args.p_user_id, "test-user");
    assert.equal(app.walletCalls[0].args.p_customer_email, "client@example.com");
    assert.match(app.walletCalls[0].args.p_message, /Total amount: EUR/);
    assert.equal(app.saved.length, 0);
    assert.equal(app.rateRequests, 0);
  }
});

test("wallet purchase requires authentication before looking up or debiting any wallet", async () => {
  for (const options of [{ user: null }, { authError: { message: "Invalid session" } }]) {
    const app = harness(options);
    await redirected(app.purchase, walletForm(), "/sign-in");
    assert.equal(app.walletCalls.length, 0);
    assert.equal(app.walletReads.length, 0);
    assert.equal(app.saved.length, 0);
  }
});

test("wallet purchase rejects malformed intent identifiers and invalid share amounts", async () => {
  for (const id of ["", "not-a-uuid", ` ${purchaseRequestId}`, "../../another-user", "7e412fa4-03f3-10c0-a9fb-c98cdf54bf2e"]) {
    const app = harness();
    const form = walletForm();
    form.set("purchase_request_id", id);
    await redirected(app.purchase, form, "/dashboard?request=invalid#properties");
    assert.equal(app.walletCalls.length, 0);
    assert.equal(app.walletReads.length, 0);
  }
  for (const shares of [0, 7, 20.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    const app = harness();
    await redirected(app.purchase, walletForm(shares), "/dashboard?request=invalid#properties");
    assert.equal(app.walletCalls.length, 0);
  }
});

test("repeated wallet intent records one debit and refreshes wallet, holdings, orders and property", async () => {
  const app = harness({ walletBalance: 5000, walletAvailableShares: 20 });
  const form = walletForm();
  await redirected(app.purchase, form, "/dashboard/orders?request=purchased");
  // Retry after spending the entire balance and buying the final shares.
  await redirected(app.purchase, form, "/dashboard/orders?request=purchased");
  assert.equal(app.walletCalls.length, 1);
  assert.equal(app.walletTransactions.length, 1);
  assert.deepEqual(app.walletState, { balance: 0, shares: 0, debits: 1 });
  assert.equal(app.walletCalls[0].args.p_idempotency_key, `wallet-purchase:test-user:${purchaseRequestId}`);
  for (const filters of app.walletReads) {
    assert.deepEqual(filters, { user_id: "test-user", idempotency_key: `wallet-purchase:test-user:${purchaseRequestId}` });
  }
  for (const route of ["/dashboard", "/dashboard/wallet", "/dashboard/assets", "/dashboard/orders", "/dashboard/income", "/properties", `/properties/${salRei}`]) {
    assert.ok(app.revalidated.includes(route), route);
  }
});

test("committed wallet intent succeeds on retry even when current stock is exhausted or listing closed", async () => {
  const first = harness();
  await redirected(first.purchase, walletForm(), "/dashboard/orders?request=purchased");
  for (const listingOverrides of [{}, { [salRei]: { investmentOpen: false } }]) {
    const retry = harness({ previousTransactions: first.walletTransactions, settings: { total_shares: 1061, blocked_shares: 1061 }, listingOverrides });
    await redirected(retry.purchase, walletForm(), "/dashboard/orders?request=purchased");
    assert.equal(retry.walletCalls.length, 0);
  }
});

test("concurrent wallet retry verifies a committed ledger record before interpreting RPC failure", async () => {
  for (const error of [
    { code: "23505", message: "duplicate key value violates unique constraint" },
    { message: "insufficient_funds" }, { message: "insufficient_shares" },
  ]) {
    // The first lookup sees no operation; a competing request commits before
    // this RPC reports its error. The actual transaction rollback is tested in SQL.
    const app = harness({ walletBalance: 5000, walletAvailableShares: 20, walletError: error, commitBeforeWalletError: true });
    await redirected(app.purchase, walletForm(), "/dashboard/orders?request=purchased");
    assert.equal(app.walletReads.length, 2);
    assert.equal(app.walletState.debits, 1);
    assert.equal(app.walletTransactions.length, 1);
  }
});

test("reusing a wallet intent with different purchase details is rejected without a second debit", async () => {
  const app = harness();
  await redirected(app.purchase, walletForm(), "/dashboard/orders?request=purchased");
  for (const form of [walletForm(21), walletForm(20, calgary)]) {
    await redirected(app.purchase, form, "/dashboard?request=invalid#properties");
  }
  assert.equal(app.walletCalls.length, 1);
  assert.equal(app.walletState.debits, 1);
});

test("matching a prior intent also requires purchase direction, amount and currency", async () => {
  const first = harness();
  await redirected(first.purchase, walletForm(), "/dashboard/orders?request=purchased");
  for (const change of [{ type: "credit" }, { direction: "credit" }, { amount: 1 }, { currency: "CAD" }]) {
    const app = harness({ previousTransactions: [{ ...first.walletTransactions[0], ...change }] });
    await redirected(app.purchase, walletForm(), "/dashboard?request=invalid#properties");
    assert.equal(app.walletCalls.length, 0);
  }
});

test("the same browser intent cannot reuse another customer's operation", async () => {
  const first = harness();
  await redirected(first.purchase, walletForm(), "/dashboard/orders?request=purchased");
  const second = harness({ previousTransactions: first.walletTransactions, user: { id: "second-user", email: "second@example.com", user_metadata: {} } });
  await redirected(second.purchase, walletForm(), "/dashboard/orders?request=purchased");
  assert.equal(second.walletCalls.length, 1);
  assert.equal(second.walletCalls[0].args.p_idempotency_key, `wallet-purchase:second-user:${purchaseRequestId}`);
  assert.equal(second.walletCalls[0].args.p_user_id, "second-user");
});

test("insufficient funds, stock and database failures leave the action without a completed purchase", async () => {
  for (const [options, destination] of [
    [{ walletBalance: 1999 }, "/dashboard?request=insufficient#properties"],
    [{ walletAvailableShares: 19 }, "/dashboard?request=invalid#properties"],
    [{ settings: { total_shares: 1061, blocked_shares: 1042 } }, "/dashboard?request=invalid#properties"],
    [{ walletLookupError: { message: "unavailable" } }, "/dashboard?request=error#properties"],
    [{ settingsError: { message: "unavailable" } }, "/dashboard?request=error#properties"],
    [{ walletError: { message: "unavailable" } }, "/dashboard?request=error#properties"],
  ]) {
    const app = harness(options);
    await redirected(app.purchase, walletForm(), destination);
    assert.equal(app.walletState.debits, 0);
    assert.equal(app.walletTransactions.length, 0);
    assert.equal(app.saved.length, 0);
    assert.equal(app.revalidated.length, 0);
  }
});

test("wallet submissions missing an intent cannot debit even when retried with surplus funds and stock", async () => {
  const app = harness({ walletBalance: 15000, walletAvailableShares: 100 });
  const form = purchaseForm(20, "wallet_balance");
  assert.equal(form.has("purchase_request_id"), false);
  for (let retry = 0; retry < 2; retry++) {
    await redirected(app.purchase, form, "/dashboard?request=invalid#properties");
  }
  assert.equal(app.walletCalls.length, 0);
  assert.equal(app.walletReads.length, 0);
  assert.deepEqual(app.walletState, { balance: 15000, shares: 100, debits: 0 });
});

test("concurrent dashboard wallet submissions retain one debit even with enough funds for both", async () => {
  const app = harness({ walletBalance: 15000, walletAvailableShares: 100 });
  await Promise.all([
    redirected(app.purchase, walletForm(), "/dashboard/orders?request=purchased"),
    redirected(app.purchase, walletForm(), "/dashboard/orders?request=purchased"),
  ]);
  await redirected(app.purchase, walletForm(), "/dashboard/orders?request=purchased");
  assert.deepEqual(app.walletState, { balance: 10000, shares: 80, debits: 1 });
  assert.equal(app.walletTransactions.length, 1);
  assert.ok(app.walletCalls.every(({ args }) => args.p_idempotency_key === `wallet-purchase:test-user:${purchaseRequestId}`));
});

test("bank and crypto requests remain available without a wallet intent", async () => {
  for (const payment of ["bank_transfer", "crypto"]) {
    const app = harness();
    const form = purchaseForm(20, payment);
    assert.equal(form.has("purchase_request_id"), false);
    await redirected(app.purchase, form, "/dashboard/orders?request=sent");
    assert.equal(app.saved.length, 1);
    assert.equal(app.saved[0].payload.status, "new");
    assert.equal(app.walletCalls.length, 0);
    assert.equal(app.walletReads.length, 0);
  }
});

test("Sal Rei requests record its rental yield without any non-cash target components", async () => {
  const app = harness();
  const form = contactForm(8);
  form.set("currency", "CAD");
  form.set("amount", "1");
  await redirected(app.contact, form, "/thank-you?conversion=lead");
  const message = app.saved[0].payload.message;
  assert.match(message, /Total amount: 2000\.00 EUR/);
  assert.match(message, /Projected rental yield: 18\.09%/);
  assert.match(message, /Projected net rent per year: 361\.80 EUR/);
  assert.match(message, /Projected net rent per month: 30\.15 EUR/);
  assert.doesNotMatch(message, /Rental:|Vacation point|Appreciation|non-cash/);
});

test("legacy cash settings do not replace the published rental yield", async () => {
  for (const settings of [
    null, { projected_annual_return: 9, profit_active: true },
    { projected_annual_return: 0, profit_active: false },
  ]) {
    const app = harness({ settings });
    await redirected(app.purchase, purchaseForm(20, "crypto", calgary), "/dashboard/orders?request=sent");
    const message = app.saved[0].payload.message;
    assert.match(message, /Projected rental yield: 3\.93%/);
    assert.match(message, /Projected net rent per year: EUR\s*78\.60/);
    assert.match(message, /Projected net rent per month: EUR\s*6\.55/);
    assert.match(message, /Payment method: Cryptocurrency/);
    assert.equal(app.rateRequests, 0);
  }
});

test("general inquiries remain available without investment fields or an exchange rate", async () => {
  const app = harness();
  const form = contactForm(0);
  form.delete("investment_slug");
  form.delete("investment_shares");
  await redirected(app.contact, form, "/thank-you?conversion=lead");
  assert.equal(app.rateRequests, 0);
  assert.equal(app.saved[0].payload.message, "Please review my request.");
});
