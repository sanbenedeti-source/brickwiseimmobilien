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
const { rentalModelCopy } = load(path.join(root, "app/lib/rental-model-copy.ts"));
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

test("anonymous visitors are sent to sign-up for this property and receive no wallet action or balance", () => {
  const { markup, text } = renderProperty(getExternalPropertyBySlug("calgary-beltline-rental"), { isAuthenticated: false });
  assert.match(markup, /href="\/join\?next=%2Fproperties%2Fcalgary-beltline-rental"/);
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

test("Calgary shows its 3.93% net rental yield for annual and monthly EUR amounts", () => {
  const { text, markup } = renderProperty(getExternalPropertyBySlug("calgary-beltline-rental"));
  // (2,050 rent - 650 costs) x 12 / 428,000 = 3.93 %; on EUR 2,000 that is EUR 78.60 a year.
  assert.match(text, /Projected net rental yield p\.a\. 3\.93%/);
  assert.match(text, /Modelled shares 20/);
  assert.match(text, /Total amount €2,000\.00/);
  assert.match(text, /Projected rent \/ year · 3\.93% €78\.60/);
  assert.match(text, /Projected rent \/ month €6\.55/);
  assert.match(text, /Projected rent \/ share \/ month €0\.33/);
  assert.match(text, /Projected rent \/ share \/ year €3\.93/);
  assert.doesNotMatch(text, /Target annual return|Vacation|Appreciation|Annual return breakdown|28\.00%/);
  assert.doesNotMatch(text, /\bCAD\b|\bUSD\b|\$|Your monthly profit|No return period/);
  assert.match(markup, /name="property_slug" value="calgary-beltline-rental"/);
  assert.match(markup, /name="shares" value="20"/);
});

test("projected value growth is shown beside the rent for the chosen shares and never changes the rent projection", () => {
  const calgary = getExternalPropertyBySlug("calgary-beltline-rental");
  const { text } = renderProperty(calgary, { valueGrowthRate: 2 });
  // EUR 2,000 at 3.93% rent = EUR 78.60; 2% value growth = EUR 40.00; total 5.93% = EUR 118.60 a year, EUR 9.88 a month.
  assert.match(text, /Projected rent \/ year · 3\.93% €78\.60/);
  assert.match(text, /Projected value growth \/ year · 2\.00% €40\.00/);
  assert.match(text, /Total incl\. value growth \/ year · 5\.93% €118\.60/);
  assert.match(text, /Total incl\. value growth \/ month €9\.88/);
  assert.match(text, /only realised when the property or the shares are sold/);
  assert.doesNotMatch(renderProperty(calgary).text, /value growth/i);
});

test("all supported languages show the yield before costs when costs are not stated", () => {
  const property = getExternalPropertyBySlug("sal-rei-boa-vista-b1-residences-ap1");
  for (const locale of ["en", "de", "fr", "es", "it"]) {
    const { text } = renderProperty(property, { locale });
    // 4,000 x 12 / 265,366 = 18.09 % before costs; EUR 361.80 a year on EUR 2,000.
    const annual = formatPropertyMoney(361.8, "EUR", locale, 2).replace(/\s+/g, " ");
    const monthly = formatPropertyMoney(30.15, "EUR", locale, 2).replace(/\s+/g, " ");
    assert.ok(text.includes(targetReturnCopy[locale].grossTargetTotalReturn), locale);
    assert.ok(text.includes(targetReturnCopy[locale].costsMissingNote), locale);
    assert.ok(text.includes(targetReturnCopy[locale].annualTarget), locale);
    assert.ok(text.includes(targetReturnCopy[locale].monthlyTarget), locale);
    assert.ok(text.includes(annual), locale);
    assert.ok(text.includes(monthly), locale);
    // Intl decides the percent spacing per locale ("18,09 %" in de/fr/es, "18,09%" in it).
    const tag = { en: "en-GB", de: "de-DE", fr: "fr-FR", es: "es-ES", it: "it-IT" }[locale];
    assert.ok(text.includes(new Intl.NumberFormat(tag, { style: "percent", minimumFractionDigits: 2 }).format(0.1809).replace(/\s+/g, " ")), locale);
    if (locale !== "en") assert.doesNotMatch(text, /Projected rent|Target annual return/);
  }
});

test("every EUR listing reconciles shares, annual and monthly net-rent amounts", () => {
  const rates = {
    "sal-rei-boa-vista-b1-residences-ap1": 18.09,
    "edmonton-windsor-park-8712-120-st": 11,
    "toronto-midtown-condo": 3.51,
    "vancouver-kitsilano-suite": 3.02,
    "calgary-beltline-rental": 3.93,
    "ottawa-centretown-duplex": 3.91,
    "montreal-plateau-triplex": 3.9,
  };
  assert.equal(externalProperties.length, Object.keys(rates).length);
  const parseMoney = (value) => Number(value.replaceAll(",", ""));
  for (const property of externalProperties) {
    assert.equal(property.currency, "EUR", property.slug);
    assert.equal(getPropertyReturnBreakdown(property), undefined, property.slug);
    for (const minimum of [2000, 5000, 10000]) {
      const { text } = renderProperty(property, { minInvestment: minimum });
      assert.ok(text.includes(rates[property.slug].toFixed(2) + "%"), property.slug);
      assert.doesNotMatch(text, /Annual return breakdown|Vacation|Appreciation|\bCAD\b|\bUSD\b|\$|No return period|Your monthly profit|Your annual profit/);
      const investment = parseMoney(text.match(/Total amount €([\d,.]+)/)?.[1] ?? "NaN");
      const selectedShares = Number(text.match(/Modelled shares (\d+)/)?.[1]);
      const annual = parseMoney(text.match(/Projected rent \/ year · [\d.]+% €([\d,.]+)/)?.[1] ?? "NaN");
      const monthly = parseMoney(text.match(/Projected rent \/ month €([\d,.]+)/)?.[1] ?? "NaN");
      const monthlyPerShare = parseMoney(text.match(/Projected rent \/ share \/ month €([\d,.]+)/)?.[1] ?? "NaN");
      const annualPerShare = parseMoney(text.match(/Projected rent \/ share \/ year €([\d,.]+)/)?.[1] ?? "NaN");
      assert.equal(investment, selectedShares * property.sharePrice, property.slug);
      assert.equal(selectedShares, Math.ceil(minimum / property.sharePrice), property.slug);
      assert.equal(Math.round(annual * 100), Math.round(investment * rates[property.slug]), property.slug);
      assert.equal(Math.round(monthly * 100), Math.round(annual * 100 / 12), property.slug);
      assert.equal(Math.round(annualPerShare * 100), Math.round(property.sharePrice * rates[property.slug]), property.slug);
      assert.equal(Math.round(monthlyPerShare * 100), Math.round(property.sharePrice * rates[property.slug] / 12), property.slug);
    }
  }
});

test("a legacy cash-rate prop cannot override the published rental yield", () => {
  const property = getExternalPropertyBySlug("calgary-beltline-rental");
  const paused = renderProperty(property, { annualYield: 0 });
  const managed = renderProperty(property, { annualYield: 9 });
  assert.equal(paused.text, managed.text);
  assert.match(paused.text, /Projected rent \/ year · 3\.93% €78\.60/);
  assert.match(paused.text, /Projected rent \/ month €6\.55/);
});

test("listings without a configured yield still use annual divided by twelve", () => {
  const { text } = renderProperty(getExternalPropertyBySlug("calgary-beltline-rental"), {
    annualYield: 12, targetTotalReturn: undefined, returnBreakdown: undefined,
  });
  assert.match(text, /Investment calculator/);
  assert.match(text, /Projected rent \/ year · 12\.00% €240\.00/);
  assert.match(text, /Projected rent \/ month €20\.00/);
  assert.doesNotMatch(text, /Annual return breakdown|CAD|\$/);
});

test("Edmonton rental scenario shows its net monthly rent with the rental-model note", () => {
  const property = getExternalPropertyBySlug("edmonton-windsor-park-8712-120-st");
  for (const locale of ["en", "de", "fr", "es", "it"]) {
    const { text } = renderProperty(property, { rentalModel: property.rentalModel, locale });
    const netPerShare = (property.monthlyRent - property.monthlyExpenses) / property.totalShares;
    assert.ok(text.includes(formatPropertyMoney(netPerShare, "EUR", locale, 2).replace(/\s+/g, " ")));
    assert.ok(text.includes(formatPropertyMoney(netPerShare * 2, "EUR", locale, 2).replace(/\s+/g, " ")));
    assert.ok(text.includes("660 EUR") || text.includes("EUR 660"));
    assert.doesNotMatch(text, /CAD|USD|1[.,]6015/);
    // One monthly rental figure only (the investor share of net rent), no target split.
    assert.ok(!text.includes(targetReturnCopy[locale].monthlyTarget), locale);
    assert.doesNotMatch(text, /Monthly rental target|Monatliches Mietziel|Objectif locatif mensuel|Objetivo mensual de alquiler|Obiettivo locativo mensile/);
    assert.ok(text.includes(rentalModelCopy[locale].note.split(". ")[0].replace(/\s+/g, " ")), locale);
  }
});
