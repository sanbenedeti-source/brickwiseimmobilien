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
const { minimumInvestmentShares, canPurchaseShares } = load(path.join(directory, "investment-policy.ts"));
const expected = {
  "sal-rei-boa-vista-b1-residences-ap1": [265366, 250, 26, 520, 43.33],
  "edmonton-windsor-park-8712-120-st": [1008000, 1000, 26.25, 525, 43.75],
  "toronto-midtown-condo": [735000, 250, 27, 540, 45.00],
  "vancouver-kitsilano-suite": [895000, 500, 27.5, 550, 45.83],
  "calgary-beltline-rental": [428000, 100, 28, 560, 46.67],
  "ottawa-centretown-duplex": [690000, 250, 27.25, 545, 45.42],
  "montreal-plateau-triplex": [815000, 500, 26.75, 535, 44.58],
};

test("every EUR listing reconciles property value, whole shares and the EUR 2000 annual/monthly model", () => {
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
    assert.equal(projection.annualRate, rate);
    assert.ok(Math.abs(projection.annual - annual) < 1e-9);
    assert.equal(projection.monthly, projection.annual / 12);
    assert.equal(Number(projection.monthly.toFixed(2)), monthly);
    assert.equal(projection.propertyMonthly, projection.propertyAnnual / 12);
    assert.equal(projection.monthlyPerShare, projection.annualPerShare / 12);
    const breakdown = getPropertyReturnBreakdown(property);
    assert.ok(Math.abs(breakdown.rental + breakdown.vacationPoint + breakdown.appreciation - rate) < 1e-9);
    assert.deepEqual(breakdown, { rental: 19, vacationPoint: 2.5, appreciation: rate - 21.5 });
    assert.equal(property.appreciationYield, breakdown.appreciation);
    assert.equal(property.annualRent, property.monthlyRent * 12);
    assert.equal(property.annualYield, property.annualRent / property.price * 100);
  }
});

test("listing targets vary from 26 to 28 percent with appreciation above vacation benefits", () => {
  const rates = externalProperties.map(property => getPropertyProjection(property).annualRate);
  assert.equal(Math.min(...rates), 26);
  assert.equal(Math.max(...rates), 28);
  assert.equal(new Set(rates).size, externalProperties.length);
  for (const property of externalProperties) {
    const breakdown = getPropertyReturnBreakdown(property);
    assert.equal(breakdown.rental, 19);
    assert.ok(breakdown.appreciation > breakdown.vacationPoint);
  }
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
  assert.ok(Math.abs(net - 9240) < 1e-9);
  assert.ok(Math.abs(net / p.totalShares * 1008 - net) < 1e-9);
  assert.ok(Math.abs(p.targetReturnBreakdown.rental + p.targetReturnBreakdown.vacationPoint + p.appreciationYield - 26.25) < 1e-9);
  assert.equal(net, 9240);
  assert.notEqual(net, getPropertyProjection(p).propertyMonthly);
  assert.equal(getPropertyProjection(p, 20).annual, 5250);
  assert.equal(getPropertyProjection(p).annualPerShare, 262.5);
});
