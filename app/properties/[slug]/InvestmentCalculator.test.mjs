import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const requirePackage = createRequire(import.meta.url);
const modules = new Map();

// Render the real client component and its dependencies in their initial state.
function load(filename) {
  if (modules.has(filename)) return modules.get(filename).exports;
  const compiled = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
  }).outputText;
  const loaded = { exports: {} };
  modules.set(filename, loaded);
  const require = (name) => name.startsWith(".")
    ? load(`${path.resolve(path.dirname(filename), name)}.ts`)
    : requirePackage(name);
  new Function("require", "module", "exports", compiled)(require, loaded, loaded.exports);
  return loaded.exports;
}

const Calculator = load(path.join(root, "app/properties/[slug]/InvestmentCalculator.tsx")).default;
const { externalProperties, getExternalPropertyBySlug } = load(path.join(root, "app/lib/external-properties.ts"));
const { getPropertyReturnBreakdown, getPropertyShareSupply, getPropertyTargetReturn } = load(path.join(root, "app/lib/property-financials.ts"));
const { targetReturnCopy } = load(path.join(root, "app/lib/target-return-copy.ts"));
const { walletPurchaseCopy } = load(path.join(root, "app/lib/wallet-purchase-copy.ts"));
const { formatPropertyMoney } = load(path.join(root, "app/lib/property-financials.ts"));
const copy = {
  dashboardActive: "Dashboard active", signInRequired: "Sign in required",
  title: "Investment calculator", text: "Calculate investment income.",
  propertyValue: "Property value", grossYield: "Gross yield", minimum: "Minimum",
  sharePrice: "Price per share", accessAmount: "Investment amount", choosePayoutModel: "Choose payout",
  monthly: "Monthly", annual: "Annual", amountAria: "Amount", enterAmount: "Enter amount",
  modelledShares: "Modelled shares", monthlyGrossIncome: "Monthly gross income",
  annualGrossIncome: "Annual gross income", propertyExposure: "Property exposure",
  fundingAfter: "Funding after investment", requestAmount: "Request investment",
  signInToRequest: "Sign in", prepareFunding: "Prepare funding", note: "Modelled income", onRequest: "On request",
};
const purchaseRequestId = "8160c427-d5ef-4145-87ef-7b9c5f4b9891";
const purchaseAction = async () => {};

function renderProperty(property, overrides = {}) {
  const { total, available } = getPropertyShareSupply(property);
  const currency = property.currency ?? "EUR";
  const markup = renderToStaticMarkup(createElement(Calculator, {
    annualYield: getPropertyTargetReturn(property),
    targetTotalReturn: getPropertyTargetReturn(property),
    availableShares: available,
    copy,
    currency,
    fundedPercent: property.fundedPercent,
    isAuthenticated: true,
    walletBalance: 25000,
    purchaseRequestId,
    purchaseAction,
    minInvestment: 2000,
    locale: "en",
    monthlyExpenses: property.monthlyExpenses,
    monthlyRent: property.monthlyRent,
    propertySlug: property.slug,
    propertyTitle: property.title,
    propertyValue: property.price,
    sharePrice: property.sharePrice,
    totalShares: total,
    returnBreakdown: getPropertyReturnBreakdown(property),
    ...overrides,
  }));
  return { markup, text: markup.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, "").replace(/<[^>]*>/g, " ").replace(/&nbsp;|&#160;/g, " ").replace(/\s+/g, " ") };
}

test("credited balance enables Buy now and sends the exact selected purchase to the action", () => {
  const { markup, text } = renderProperty(getExternalPropertyBySlug("edmonton-windsor-park-8712-120-st"));
  assert.match(markup, /<option value="wallet_balance" selected="">Balance \(credits\) — €25,000\.00<\/option>/);
  assert.match(text, /Available balance €25,000\.00 Balance after purchase €23,000\.00/);
  const submit = markup.match(/<button\b[^>]*type="submit"[^>]*>/)?.[0];
  assert.ok(submit);
  assert.doesNotMatch(submit, / disabled=/);
  assert.match(markup, /<form\b[^>]*action=/);
  const form = markup.match(/<form\b[\s\S]*?<\/form>/)?.[0];
  assert.ok(form);
  const fields = Object.fromEntries([...form.matchAll(/<input type="hidden" name="([^"]+)" value="([^"]*)"/g)].map((match) => [match[1], match[2]]));
  assert.deepEqual(fields, {
    property_slug: "edmonton-windsor-park-8712-120-st",
    shares: "2",
    payment_method: "wallet_balance",
    purchase_request_id: purchaseRequestId,
  });
  assert.match(form, />Buy now<\/button>/);
  assert.doesNotMatch(markup, /funding_account/);
  assert.match(markup, /href="\/contact[^"]*payment=bank_transfer/);
  assert.ok(text.includes(walletPurchaseCopy.en.requestReview));
});

test("a purchase using the exact available balance leaves zero", () => {
  const { markup, text } = renderProperty(getExternalPropertyBySlug("calgary-beltline-rental"), { walletBalance: 2000 });
  assert.match(text, /Balance after purchase €0\.00/);
  assert.doesNotMatch(markup.match(/<button\b[^>]*type="submit"[^>]*>/)?.[0] ?? "", / disabled=/);
});

test("insufficient credits and an empty wallet disable purchase and offer funding", () => {
  for (const walletBalance of [0, 1999.99]) {
    const { markup, text } = renderProperty(getExternalPropertyBySlug("calgary-beltline-rental"), { walletBalance });
    assert.match(markup, /<button type="submit" disabled=""/);
    assert.ok(text.includes(walletPurchaseCopy.en.insufficientBalance));
    assert.match(markup, /href="\/funding"/);
    assert.doesNotMatch(text, /Balance after purchase|currently unavailable/);
  }
});

test("an unavailable or invalid balance cannot be mistaken for spendable credits", () => {
  for (const walletBalance of [null, Number.NaN, Number.POSITIVE_INFINITY, -1]) {
    const { markup, text } = renderProperty(getExternalPropertyBySlug("calgary-beltline-rental"), { walletBalance });
    assert.match(markup, /<button type="submit" disabled=""/);
    assert.ok(text.includes(walletPurchaseCopy.en.balanceUnavailable));
    assert.doesNotMatch(text, /Available balance €0\.00|Balance after purchase|Your balance is not enough/);
  }
});

test("anonymous visitors sign in and receive no wallet action or balance", () => {
  const { markup, text } = renderProperty(getExternalPropertyBySlug("calgary-beltline-rental"), { isAuthenticated: false });
  assert.match(markup, /href="\/sign-in"/);
  assert.doesNotMatch(markup, /<form|wallet_balance|purchase_request_id|type="submit"/);
  assert.doesNotMatch(text, /Buy now|Balance \(credits\)|Available balance|25,000/);
});

test("missing purchase wiring and insufficient stock disable the purchase", () => {
  for (const overrides of [{ purchaseAction: undefined }, { purchaseRequestId: undefined }, { availableShares: 1 }]) {
    const { markup } = renderProperty(getExternalPropertyBySlug("calgary-beltline-rental"), overrides);
    assert.match(markup, /<button type="submit" disabled=""/);
  }
});

test("wallet purchase controls and balance messages are localized in all five languages", () => {
  const property = getExternalPropertyBySlug("calgary-beltline-rental");
  for (const locale of ["en", "de", "fr", "es", "it"]) {
    const available = renderProperty(property, { locale });
    const insufficient = renderProperty(property, { locale, walletBalance: 0 });
    const unavailable = renderProperty(property, { locale, walletBalance: null });
    assert.ok(available.text.includes(walletPurchaseCopy[locale].buyNow), locale);
    assert.ok(available.text.includes(walletPurchaseCopy[locale].balanceMethod), locale);
    assert.ok(available.text.includes(walletPurchaseCopy[locale].availableBalance), locale);
    assert.ok(insufficient.text.includes(walletPurchaseCopy[locale].insufficientBalance), locale);
    assert.ok(unavailable.text.includes(walletPurchaseCopy[locale].balanceUnavailable), locale);
  }
});

test("Calgary uses its annual 28% target for both annual and monthly EUR amounts", () => {
  const { text, markup } = renderProperty(getExternalPropertyBySlug("calgary-beltline-rental"));
  assert.match(text, /Target annual return 28\.00%/);
  assert.match(text, /Modelled shares 20/);
  assert.match(text, /Total amount €2,000\.00/);
  assert.match(text, /Modelled annual return · 28\.00% €560\.00/);
  assert.match(text, /Modelled monthly return €46\.67/);
  assert.match(text, /Rental · 19\.00% €380\.00/);
  assert.match(text, /Vacation point · 2\.50% €50\.00/);
  assert.match(text, /Appreciation · 6\.50% €130\.00/);
  assert.match(text, /Modelled monthly return \/ share €2\.33/);
  assert.match(text, /Modelled annual return \/ share €28\.00/);
  assert.doesNotMatch(text, /\bCAD\b|\bUSD\b|\$|Your monthly profit|No return period/);
  assert.match(markup, /name="property_slug" value="calgary-beltline-rental"/);
  assert.match(markup, /name="shares" value="20"/);
});

test("all supported languages retain correct EUR amounts and use localized decimal percentages", () => {
  const property = getExternalPropertyBySlug("sal-rei-boa-vista-b1-residences-ap1");
  for (const locale of ["en", "de", "fr", "es", "it"]) {
    const { text } = renderProperty(property, { locale });
    const annual = formatPropertyMoney((2000 * 0.26), "EUR", locale, 2).replace(/\s+/g, " ");
    const monthly = formatPropertyMoney((2000 * 0.26) / 12, "EUR", locale, 2).replace(/\s+/g, " ");
    assert.ok(text.includes(targetReturnCopy[locale].annualTarget), locale);
    assert.ok(text.includes(targetReturnCopy[locale].monthlyTarget), locale);
    assert.ok(text.includes(annual), locale);
    assert.ok(text.includes(monthly), locale);
    assert.ok(text.includes(locale === "en" ? "26.00%" : "26,00%"), locale);
    if (locale !== "en") assert.doesNotMatch(text, /Target annual return|Modelled monthly return/);
  }
});

test("all seven EUR listings reconcile share, annual, monthly, and component amounts", () => {
  const targets = {
    "sal-rei-boa-vista-b1-residences-ap1": 26,
    "edmonton-windsor-park-8712-120-st": 26.25,
    "toronto-midtown-condo": 27,
    "vancouver-kitsilano-suite": 27.5,
    "calgary-beltline-rental": 28,
    "ottawa-centretown-duplex": 27.25,
    "montreal-plateau-triplex": 26.75,
  };
  assert.equal(externalProperties.length, Object.keys(targets).length);
  const parseMoney = (value) => Number(value.replaceAll(",", ""));
  for (const property of externalProperties) {
    assert.equal(property.currency, "EUR", property.slug);
    const breakdown = getPropertyReturnBreakdown(property);
    assert.ok(breakdown, property.slug);
    for (const minimum of [2000, 5000, 10000]) {
      const { text } = renderProperty(property, { minInvestment: minimum });
      assert.ok(text.includes("Target annual return " + targets[property.slug].toFixed(2) + "%"), property.slug);
      assert.ok(text.includes("Annual return breakdown"), property.slug);
      assert.doesNotMatch(text, /\bCAD\b|\bUSD\b|\$|No return period|Your monthly profit|Your annual profit/);
      const investment = parseMoney(text.match(/Total amount €([\d,.]+)/)?.[1] ?? "NaN");
      const selectedShares = Number(text.match(/Modelled shares (\d+)/)?.[1]);
      const annual = parseMoney(text.match(/Modelled annual return · [\d.]+% €([\d,.]+)/)?.[1] ?? "NaN");
      const monthly = parseMoney(text.match(/Modelled monthly return €([\d,.]+)/)?.[1] ?? "NaN");
      const monthlyPerShare = parseMoney(text.match(/Modelled monthly return \/ share €([\d,.]+)/)?.[1] ?? "NaN");
      const annualPerShare = parseMoney(text.match(/Modelled annual return \/ share €([\d,.]+)/)?.[1] ?? "NaN");
      const rows = [...text.matchAll(/(Rental|Vacation point|Appreciation) · ([\d.]+)% €([\d,.]+)/g)];
      assert.equal(investment, selectedShares * property.sharePrice, property.slug);
      assert.equal(selectedShares, Math.ceil(minimum / property.sharePrice), property.slug);
      assert.equal(rows.length, 3, property.slug);
      const expectedComponents = { Rental: breakdown.rental, "Vacation point": breakdown.vacationPoint, Appreciation: breakdown.appreciation };
      for (const [, label, percentage, amount] of rows) {
        assert.equal(Number(percentage), Number(expectedComponents[label].toFixed(2)), property.slug + ": " + label);
        assert.equal(Math.round(parseMoney(amount) * 100), Math.round(investment * expectedComponents[label]), property.slug + ": " + label);
      }
      assert.equal(Math.round(rows.reduce((sum, row) => sum + Number(row[2]), 0) * 100), Math.round(targets[property.slug] * 100), property.slug);
      const componentCents = rows.reduce((sum, row) => sum + Math.round(parseMoney(row[3]) * 100), 0);
      assert.ok(Math.abs(componentCents - Math.round(annual * 100)) <= 1, property.slug + ": rounded components reconcile within one cent");
      assert.equal(Math.round(annual * 100), Math.round(investment * targets[property.slug]), property.slug);
      assert.equal(Math.round(monthly * 100), Math.round(annual * 100 / 12), property.slug);
      assert.equal(Math.round(annualPerShare * 100), Math.round(property.sharePrice * targets[property.slug]), property.slug);
      assert.equal(Math.round(monthlyPerShare * 100), Math.round(property.sharePrice * targets[property.slug] / 12), property.slug);
    }
  }
});

test("a legacy cash-rate prop cannot override an explicit annual target", () => {
  const property = getExternalPropertyBySlug("calgary-beltline-rental");
  const paused = renderProperty(property, { annualYield: 0 });
  const managed = renderProperty(property, { annualYield: 9 });
  assert.equal(paused.text, managed.text);
  assert.match(paused.text, /Modelled annual return · 28\.00% €560\.00/);
  assert.match(paused.text, /Modelled monthly return €46\.67/);
});

test("listings without component data still use annual divided by twelve", () => {
  const { text } = renderProperty(getExternalPropertyBySlug("calgary-beltline-rental"), {
    annualYield: 12, targetTotalReturn: undefined, returnBreakdown: undefined,
  });
  assert.match(text, /Investment calculator/);
  assert.match(text, /Modelled annual return · 12\.00% €240\.00/);
  assert.match(text, /Modelled monthly return €20\.00/);
  assert.doesNotMatch(text, /Annual return breakdown|CAD|\$/);
});

test("Edmonton rental scenario shows net monthly cash separately from the annual target", () => {
  const property = getExternalPropertyBySlug("edmonton-windsor-park-8712-120-st");
  for (const locale of ["en", "de", "fr", "es", "it"]) {
    const { text } = renderProperty(property, { rentalModel: property.rentalModel, locale });
    const netPerShare = (property.monthlyRent - property.monthlyExpenses) / property.totalShares;
    assert.ok(text.includes(formatPropertyMoney(netPerShare, "EUR", locale, 2).replace(/\s+/g, " ")));
    assert.ok(text.includes(formatPropertyMoney(netPerShare * 2, "EUR", locale, 2).replace(/\s+/g, " ")));
    assert.ok(text.includes("660 EUR") || text.includes("EUR 660"));
    assert.doesNotMatch(text, /CAD|USD|1[.,]6015/);
    assert.doesNotMatch(text, /Modelled monthly return/);
  }
});
