import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const requirePackage = createRequire(import.meta.url);
const modules = new Map();
function load(filename) {
  if (modules.has(filename)) return modules.get(filename).exports;
  const output = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  const loaded = { exports: {} };
  modules.set(filename, loaded);
  const require = (name) => name.startsWith(".") ? load(`${path.resolve(path.dirname(filename), name)}.ts`) : requirePackage(name);
  new Function("require", "module", "exports", output)(require, loaded, loaded.exports);
  return loaded.exports;
}
const IncomeExperience = load(fileURLToPath(new URL("./IncomeExperience.tsx", import.meta.url))).default;
const { profitCopy } = load(fileURLToPath(new URL("./profit-copy.ts", import.meta.url)));

test("portfolio renders EUR annual/monthly targets and preserves native acquisition cost and wallet currency", () => {
  const positions = [{
    slug: "calgary-beltline-rental", title: "Calgary", city: "Calgary", imageUrl: "",
    shares: 10, recordedInvestment: { amount: 900, currency: "EUR" },
    sharePrice: 100, annualRate: 36, totalShares: 1000, availableShares: 5,
    monthlyRent: 5000, monthlyExpenses: 1000,
  }];
  const html = renderToStaticMarkup(createElement(IncomeExperience, { positions, locale: "en", walletBalance: 150, walletCurrency: "EUR" }));
  const text = html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");
  assert.match(text, /Modelled capital at current EUR prices EUR 1,000/);
  assert.match(text, /Modelled annual return EUR 360/);
  assert.match(text, /Modelled monthly return EUR 30/);
  assert.match(text, /Recorded acquisition cost: EUR 900\.00/);
  assert.match(text, /EUR 90\.00/);
  assert.match(text, /Available wallet EUR 150\.00/);
  assert.doesNotMatch(text, /CAD|USD/);
  assert.deepEqual(positions[0].recordedInvestment, { amount: 900, currency: "EUR" });
});

test("private income and empty portfolio views use the selected language without changing recorded currencies", () => {
  const positions = [{
    slug: "calgary-beltline-rental", title: "Calgary", city: "Calgary", imageUrl: "",
    shares: 10, recordedInvestment: { amount: 900, currency: "EUR" },
    sharePrice: 100, annualRate: 36, totalShares: 1000, availableShares: 5,
    monthlyRent: 5000, monthlyExpenses: 1000,
  }];
  for (const locale of ["en", "de", "fr", "es", "it"]) {
    const props = { positions, locale, walletBalance: 150, walletCurrency: "EUR" };
    const text = renderToStaticMarkup(createElement(IncomeExperience, props)).replace(/<[^>]*>/g, " ").replace(/&#x27;/g, "'").replace(/\s+/g, " ");
    assert.ok(text.includes(profitCopy[locale].annual), locale);
    assert.ok(text.includes(profitCopy[locale].monthly), locale);
    assert.ok(text.includes(profitCopy[locale].recordedCost), locale);
    assert.ok(text.includes("EUR"), locale);
    assert.ok(text.includes("EUR"), locale);
    if (locale !== "en") assert.doesNotMatch(text, /Modelled capital at current EUR prices|Recorded acquisition cost|Owned shares|How the numbers work/);
    const empty = renderToStaticMarkup(createElement(IncomeExperience, { ...props, positions: [] })).replace(/&#x27;/g, "'");
    assert.ok(empty.includes(profitCopy[locale].empty), locale);
    assert.ok(empty.includes(profitCopy[locale].browse), locale);
  }
});


const DailyIncome = load(fileURLToPath(new URL("./DailyIncome.tsx", import.meta.url))).default;
const { dailyIncomeCopy } = load(fileURLToPath(new URL("./daily-income-copy.ts", import.meta.url)));
test("Income renders a localized daily timeline distinct from Assets with safe missing-history states", () => {
  const props = {
    positions: [{slug: "sample", title: "Sample", shares: 10, rentalRate: 19}],
    purchases: [{property_slug: "sample", shares: 10, amount: 1000, currency: "EUR", created_at: "2026-01-01T12:00:00Z"}],
    asOf: Date.parse("2026-01-04T12:00:00Z"), historyAvailable: true,
  };
  for (const locale of ["en", "de", "fr", "es", "it"]) {
    const html = renderToStaticMarkup(createElement(DailyIncome, {...props, locale}));
    for (const key of ["title", "days", "history", "formula", "note"]) assert.ok(html.includes(dailyIncomeCopy[locale][key]), locale + key);
    assert.doesNotMatch(html, /profit-shares|profit-period|Available wallet|Recorded acquisition cost/);
    const missing = renderToStaticMarkup(createElement(DailyIncome, {...props, locale, purchases: []}));
    assert.ok(missing.includes(dailyIncomeCopy[locale].unavailable));
    assert.ok(!missing.includes(dailyIncomeCopy[locale].history));
    const empty = renderToStaticMarkup(createElement(DailyIncome, {...props, locale, positions: [], purchases: []}));
    assert.ok(empty.includes(dailyIncomeCopy[locale].empty));
  }
});


const WalletOverview = load(fileURLToPath(new URL("./WalletOverview.tsx", import.meta.url))).default;
const { walletOverviewCopy } = load(fileURLToPath(new URL("./wallet-overview-copy.ts", import.meta.url)));
test("wallet separates unspent funds, accumulated profit and their rounded total in every language", () => {
  const props = {
    baseBalance: 150,
    positions: [{slug: "sample", title: "Sample", shares: 10, rentalRate: 19}],
    purchases: [{property_slug: "sample", shares: 10, amount: 1000, currency: "EUR", created_at: "2026-01-01T12:00:00Z"}],
    asOf: Date.parse("2026-01-04T12:00:00Z"), historyAvailable: true,
  };
  for (const locale of ["en", "de", "fr", "es", "it"]) {
    const html = renderToStaticMarkup(createElement(WalletOverview, {...props, locale}));
    for (const key of ["base", "profit", "total", "note"]) assert.ok(html.includes(walletOverviewCopy[locale][key]));
    const decimal = locale === "en" ? "." : ",";
    for (const amount of ["150"+decimal+"00", "1"+decimal+"56", "151"+decimal+"56"]) assert.ok(html.includes(amount), locale + amount);
    const empty = renderToStaticMarkup(createElement(WalletOverview, {...props, locale, positions: [], purchases: []}));
    assert.equal((empty.match(new RegExp("150" + (locale === "en" ? "\\." : ",") + "00", "g")) || []).length, 2);
    const missing = renderToStaticMarkup(createElement(WalletOverview, {...props, locale, historyAvailable: false}));
    assert.ok(missing.includes(walletOverviewCopy[locale].unavailable));
    assert.ok(!missing.includes("151"+decimal+"56"));
    const unavailableBalance = renderToStaticMarkup(createElement(WalletOverview, {...props, locale, baseBalance: null}));
    assert.ok(!unavailableBalance.includes("151"+decimal+"56"));
  }
});


const SharePurchaseForm = load(fileURLToPath(new URL("./SharePurchaseForm.tsx", import.meta.url))).default;
const { walletPurchaseCopy } = load(fileURLToPath(new URL("../lib/wallet-purchase-copy.ts", import.meta.url)));
test("property cards offer separate instant wallet purchase and agent review actions", () => {
  const props = { action: async () => {}, purchaseRequestId: "8160c427-d5ef-4145-87ef-7b9c5f4b9891", propertySlug: "sample", minimumShares: 20, availableShares: 50, sharePrice: 100, walletBalance: 2500, copy: { shares: "Shares", amount: "Amount", payment: "Payment", bank: "Bank", crypto: "Crypto" } };
  for (const locale of ["en", "de", "fr", "es", "it"]) {
    const html = renderToStaticMarkup(createElement(SharePurchaseForm, {...props, locale}));
    const wallet = html.match(/<button[^>]*value="wallet_balance"[^>]*>/)?.[0];
    const review = html.match(/<button[^>]*value="bank_transfer"[^>]*>/)?.[0];
    assert.ok(wallet); assert.ok(review);
    assert.doesNotMatch(wallet, / disabled=/); assert.doesNotMatch(review, / disabled=/);
    assert.ok(html.includes(walletPurchaseCopy[locale].buyWallet));
    assert.ok(html.includes(walletPurchaseCopy[locale].requestReview));
    assert.ok(html.includes(walletPurchaseCopy[locale].balanceAfterPurchase));
    assert.match(html, /name="purchase_request_id"/);
    assert.doesNotMatch(html, /<option value="wallet_balance"/);
    for (const walletBalance of [null, 0, 1999]) {
      const unavailable = renderToStaticMarkup(createElement(SharePurchaseForm, {...props, locale, walletBalance}));
      assert.match(unavailable.match(/<button[^>]*value="wallet_balance"[^>]*>/)[0], / disabled=/);
      assert.doesNotMatch(unavailable.match(/<button[^>]*value="bank_transfer"[^>]*>/)[0], / disabled=/);
    }
    const soldOut = renderToStaticMarkup(createElement(SharePurchaseForm, {...props, locale, availableShares: 0}));
    assert.match(soldOut.match(/<button[^>]*value="wallet_balance"[^>]*>/)[0], / disabled=/);
    assert.match(soldOut.match(/<button[^>]*value="bank_transfer"[^>]*>/)[0], / disabled=/);
  }
});
