import assert from "node:assert/strict";
import test from "node:test";
import { getPropertyCurrency, getPropertyProjection, getPropertyReturnBreakdown, getPropertyTargetReturn, getPropertyShareSupply, formatPropertyMoney } from "./property-financials.ts";

const property = {
  currency: "EUR", price: 116100, sharePrice: 100, totalShares: 1161, blockedShares: 31,
  annualYield: 0, vacationPointYield: 9.5, appreciationYield: 25.26,
};

test("component total is annual and a missing target never defaults to an unrelated cash rate", () => {
  assert.equal(getPropertyTargetReturn(property), 34.76);
  assert.equal(getPropertyTargetReturn({ annualYield: 5 }), 0);
});

test("opening share allocation is exact and never restores shares already reserved", () => {
  assert.deepEqual(getPropertyShareSupply(property), { total: 1161, blocked: 31, available: 1130 });
  assert.equal(getPropertyShareSupply(property, { blocked_shares: 29 }).available, 1130);
  assert.equal(getPropertyShareSupply(property, { blocked_shares: 51 }).available, 1110);
  assert.equal(getPropertyShareSupply(property, { blocked_shares: 1161 }).available, 0);
});

test("configured annual targets determine projections independently of rental income", () => {
  for (const targetTotalReturn of [28, 29, 30, 32, 34, 34.76, 36]) {
    const listing = { annualYield: 5.75, targetTotalReturn };
    assert.equal(getPropertyTargetReturn(listing), targetTotalReturn);
    assert.equal(getPropertyProjection({ ...listing, sharePrice: 100 }, 20).annual, 2000 * targetTotalReturn / 100);
  }
  assert.equal(getPropertyTargetReturn({ ...property, targetTotalReturn: 34.76 }), 34.76);
});

test("explicit target components do not mutate the separate rental input", () => {
  const listing = {
    annualYield: 5.75,
    appreciationYield: 2.9,
    targetReturnBreakdown: { rental: 5.75, vacationPoint: 9.5, appreciation: 20.75 },
  };
  assert.deepEqual(getPropertyReturnBreakdown(listing), listing.targetReturnBreakdown);
  assert.equal(getPropertyTargetReturn(listing), 36);
  assert.equal(listing.annualYield, 5.75);
  assert.equal(listing.appreciationYield, 2.9);
  assert.equal(getPropertyReturnBreakdown({ annualYield: 5.75 }), undefined);
  assert.deepEqual(getPropertyReturnBreakdown(property), { rental: 0, vacationPoint: 9.5, appreciation: 25.26 });
});

test("listing money uses EUR and rejects unsupported currencies", () => {
  assert.equal(getPropertyCurrency(property), "EUR");
  assert.equal(getPropertyCurrency({}), "EUR");
  assert.throws(() => getPropertyCurrency({ currency: "CAD" }), /Unsupported/);
  assert.match(formatPropertyMoney(100, getPropertyCurrency(property)), /€100/);
  assert.match(formatPropertyMoney(2000, "EUR", "de"), /2\.000.*€/);
});

test("annual target model uses the same capital for monthly, annual and per-share projections", () => {
  const listing = { price: 428000, sharePrice: 100, targetTotalReturn: 36, currency: "EUR" };
  const projection = getPropertyProjection(listing, 20);
  assert.equal(projection.amount, 2000);
  assert.equal(projection.annual, 720);
  assert.equal(projection.monthly, 60);
  assert.equal(projection.annualPerShare, 36);
  assert.equal(projection.monthlyPerShare, 3);
  assert.equal(projection.propertyAnnual, 154080);
  assert.equal(projection.propertyMonthly, 12840);
  for (const shares of [0, 1, 7, 20, 100]) {
    const result = getPropertyProjection({ ...property, targetTotalReturn: 34.76 }, shares);
    assert.equal(result.monthly, result.annual / 12);
    assert.equal(result.annual, result.amount * 34.76 / 100);
  }
  for (const shares of [-1, 0.5, Infinity, NaN]) assert.throws(() => getPropertyProjection(listing, shares), RangeError);
  assert.equal(getPropertyProjection({ price: 100000, sharePrice: 100 }).annual, 0);
});
