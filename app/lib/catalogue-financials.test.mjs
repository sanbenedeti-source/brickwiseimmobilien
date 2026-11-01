import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import ts from "typescript";

const directory = path.dirname(fileURLToPath(import.meta.url));
const cache = new Map();
function load(filename) {
  if (cache.has(filename)) return cache.get(filename).exports;
  const output = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const loaded = { exports: {} };
  cache.set(filename, loaded);
  new Function("require", "module", "exports", output)(
    (name) => load(path.resolve(path.dirname(filename), `${name}.ts`)), loaded, loaded.exports,
  );
  return loaded.exports;
}
const { externalProperties } = load(path.join(directory, "external-properties.ts"));
const { getPropertyCurrency, getPropertyProjection, getPropertyReturnBreakdown, getPropertyShareSupply } = load(path.join(directory, "property-financials.ts"));
const { minimumInvestmentShares, canPurchaseShares, TIER_MINIMUM_EUR, toInvestmentTier, formatMinimumInvestment } = load(path.join(directory, "investment-policy.ts"));
const { listingStage, isNewListing, toStrategy, toOccupancy, listingBadgeCopy } = load(path.join(directory, "listing-badges.ts"));
// [price, share price, published rental yield %, annual / monthly net rent on EUR 2000].
// The yield is (monthly rent - stated monthly costs) x 12 / price, rounded to 0.01 %.
const expected = {
  "sal-rei-boa-vista-b1-residences-ap1": [265366, 250, 18.09, 361.8, 30.15],
  "edmonton-windsor-park-8712-120-st": [1008000, 1000, 11, 220, 18.33],
  "toronto-midtown-condo": [735000, 250, 3.51, 70.2, 5.85],
  "vancouver-kitsilano-suite": [895000, 500, 3.02, 60.4, 5.03],
  "calgary-beltline-rental": [428000, 100, 3.93, 78.6, 6.55],
  "ottawa-centretown-duplex": [690000, 250, 3.91, 78.2, 6.52],
  "montreal-plateau-triplex": [815000, 500, 3.9, 78, 6.5],
};

test("every EUR listing reconciles property value, whole shares and the EUR 2000 net-rent model", () => {
  assert.equal(externalProperties.length, Object.keys(expected).length);
  for (const property of externalProperties) {
    const [price, sharePrice, rate, annual, monthly] = expected[property.slug];
    assert.equal(getPropertyCurrency(property), "EUR", property.slug);
    assert.equal(property.price, price);
    assert.equal(property.sharePrice, sharePrice);
    const supply = getPropertyShareSupply(property);
    assert.equal(supply.total, Math.floor(price / sharePrice), property.slug);
    assert.equal(price - supply.total * sharePrice, property.slug.startsWith("sal-rei-") ? 116 : 0);
    assert.equal(supply.available + supply.blocked, supply.total);
    const minimumShares = minimumInvestmentShares(sharePrice, 2000);
    assert.equal(minimumShares * sharePrice, 2000);
    assert.equal(canPurchaseShares(minimumShares, sharePrice, 2000, supply.available), true);
    assert.equal(canPurchaseShares(minimumShares - 1, sharePrice, 2000, supply.available), false);
    const projection = getPropertyProjection(property, minimumShares);
    assert.equal(projection.annualRate, rate, property.slug);
    assert.ok(Math.abs(projection.annual - annual) < 1e-9, property.slug);
    assert.equal(projection.monthly, projection.annual / 12);
    assert.equal(Number(projection.monthly.toFixed(2)), monthly, property.slug);
    assert.equal(projection.propertyMonthly, projection.propertyAnnual / 12);
    assert.equal(projection.monthlyPerShare, projection.annualPerShare / 12);
    assert.equal(property.annualRent, property.monthlyRent * 12);
    assert.equal(property.annualYield, property.annualRent / property.price * 100);
  }
});

test("listings publish only the rental yield their rent and stated costs support", () => {
  for (const property of externalProperties) {
    // No 26-28 % targets and no rental / vacation / appreciation split any more.
    assert.equal(getPropertyReturnBreakdown(property), undefined, property.slug);
    assert.equal(property.appreciationYield, 0, property.slug);
    const net = (property.monthlyRent - property.monthlyExpenses) * 12 / property.price * 100;
    assert.ok(Math.abs(getPropertyProjection(property).annualRate - net) < 0.005, property.slug);
    assert.ok(getPropertyProjection(property).annualRate < 20, property.slug);
    assert.equal(property.costsStated, property.monthlyExpenses > 0, property.slug);
  }
  // Sal Rei has no stated costs yet: its yield is before costs and must be labelled that way.
  assert.equal(externalProperties.find((property) => property.slug.startsWith("sal-rei-")).costsStated, false);
});

test("reservation updates change availability without changing any income denominator", () => {
  for (const property of externalProperties) {
    const original = getPropertyShareSupply(property);
    const setting = { total_shares: original.total, blocked_shares: original.blocked + 1 };
    const updated = getPropertyShareSupply(property, setting);
    assert.equal(updated.available, original.available - 1);
    assert.equal(updated.total, original.total);
    const model = getPropertyProjection(property, 1);
    assert.ok(Math.abs(model.annualPerShare * updated.total + (property.price - updated.total * property.sharePrice) * model.annualRate / 100 - model.propertyAnnual) < 1e-7);
  }
});

test("Edmonton nightly scenario distributes net rent across all shares", () => {
  const p = externalProperties.find(p => p.slug === "edmonton-windsor-park-8712-120-st");
  assert.ok(Math.abs(p.monthlyRent - 13200) < 1e-9);
  assert.ok(Math.abs(p.monthlyExpenses - 3960) < 1e-9);
  const net = p.monthlyRent - p.monthlyExpenses;
  assert.equal(net, 9240);
  assert.ok(Math.abs(net / p.totalShares * 1008 - net) < 1e-9);
  // The published yield is the net rent itself: 9,240 x 12 / 1,008,000 = 11 %.
  assert.equal(getPropertyProjection(p).annualRate, 11);
  assert.ok(Math.abs(getPropertyProjection(p).propertyMonthly - net) < 1e-9);
  assert.equal(getPropertyProjection(p, 20).annual, 2200);
  assert.equal(getPropertyProjection(p).annualPerShare, 110);
});

test("each investment tier enforces its own minimum: standard EUR 2,000, premium EUR 20,000, super premium EUR 50,000", () => {
  assert.deepEqual({ ...TIER_MINIMUM_EUR }, { standard: 2000, premium: 20000, super_premium: 50000 });
  assert.deepEqual(["premium", "super_premium", "standard", "gold", null, undefined].map(toInvestmentTier), ["premium", "super_premium", "standard", "standard", "standard", "standard"]);
  // Share price EUR 2,000: premium needs 10 shares, super premium 25.
  assert.equal(minimumInvestmentShares(2000, TIER_MINIMUM_EUR.premium), 10);
  assert.equal(minimumInvestmentShares(2000, TIER_MINIMUM_EUR.super_premium), 25);
  assert.equal(canPurchaseShares(9, 2000, TIER_MINIMUM_EUR.premium, 600), false);
  assert.equal(canPurchaseShares(10, 2000, TIER_MINIMUM_EUR.premium, 600), true);
  assert.equal(canPurchaseShares(24, 2000, TIER_MINIMUM_EUR.super_premium, 600), false);
  // Share price EUR 20,000: one share meets premium; super premium rounds up to 3 shares (EUR 60,000).
  assert.equal(minimumInvestmentShares(20000, TIER_MINIMUM_EUR.premium), 1);
  assert.equal(minimumInvestmentShares(20000, TIER_MINIMUM_EUR.super_premium), 3);
  assert.equal(formatMinimumInvestment("en", TIER_MINIMUM_EUR.super_premium), "€50,000");
  assert.equal(formatMinimumInvestment("en"), "€2,000");
});

test("listing stages, new-listing ribbon and badges follow the property data", () => {
  assert.equal(listingStage({}, 12), "available");
  assert.equal(listingStage({}, 0), "funded", "every share sold");
  assert.equal(listingStage({ exited: true }, 12), "exited", "a sold property is exited even with shares left");
  const now = Date.parse("2026-11-01T12:00:00Z");
  assert.equal(isNewListing("2026-10-20T00:00:00Z", now), true);
  assert.equal(isNewListing("2026-09-01T00:00:00Z", now), false, "older than 30 days");
  assert.equal(isNewListing("2027-01-01T00:00:00Z", now), false, "future dates are ignored");
  assert.equal(isNewListing(null, now), false);
  assert.deepEqual(["prime", "capital_growth", "high_yield", "luxury", null].map(toStrategy), ["prime", "capital_growth", "high_yield", undefined, undefined]);
  assert.deepEqual(["rented", "ready", "empty"].map(toOccupancy), ["rented", "ready", undefined]);
  for (const locale of ["en", "de", "fr", "es", "it"]) {
    const copy = listingBadgeCopy[locale];
    assert.ok(copy.strategies.high_yield && copy.occupancy.rented && copy.stages.exited && copy.emptyStage.funded, locale);
  }
});
