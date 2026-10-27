import assert from "node:assert/strict";
import test from "node:test";
import { positionEconomics, simulatePosition } from "./profit-model.ts";
import { formatRecordedMoney, totalRecordedMoney } from "./recorded-money.ts";

const position = {
  slug: "sample", title: "Sample", city: "Toronto", imageUrl: "",
  shares: 10, totalShares: 1000, recordedInvestment: { amount: 900, currency: "EUR" }, sharePrice: 100,
  annualRate: 36, availableShares: 5, monthlyRent: 5000, monthlyExpenses: 1000,
};

test("EUR target projections use current share prices and preserve the separate recorded EUR cost", () => {
  assert.deepEqual(positionEconomics(position), {
    ownership: 0.01, capital: 1000, annual: 360, monthly: 30, rentalMonthly: 40, averageCost: 90,
  });
  const result = simulatePosition(position, 2, 24);
  assert.equal(result.capital, 1200);
  assert.equal(result.profit, 864);
  assert.equal(result.capitalAndProfit, 2064);
  assert.deepEqual(position.recordedInvestment, { amount: 900, currency: "EUR" });
  const differentCost = { ...position, recordedInvestment: { amount: 1700, currency: "EUR" } };
  assert.equal(positionEconomics(differentCost).annual, 360);
  assert.equal(positionEconomics(differentCost).averageCost, 170);
  assert.equal(simulatePosition(differentCost, 2, 24).capital, 1200);
});

test("simulation accepts only whole, available shares, including sold-out properties", () => {
  for (const [requested, expected] of [[2.7, 2], [-1, 0], [100, 5], [NaN, 0], [Infinity, 0]]) {
    assert.equal(simulatePosition(position, requested, 12).extraShares, expected);
  }
  assert.equal(simulatePosition({ ...position, availableShares: 0 }, 1, 12).extraInvestment, 0);
});

test("zero return stays zero and rental losses remain visible", () => {
  assert.equal(simulatePosition({ ...position, annualRate: 0 }, 5, 60).profit, 0);
  assert.equal(positionEconomics({ ...position, monthlyExpenses: 6000 }).rentalMonthly, -10);
  assert.equal(positionEconomics({ ...position, totalShares: 0, shares: 0 }).ownership, 0);
});

test("recorded payments total in EUR and reject foreign currencies", () => {
  const records = [{ amount: 100, currency: "EUR" }, { amount: 200, currency: "EUR" }, { amount: 50, currency: "EUR" }];
  assert.deepEqual(totalRecordedMoney(records), [{ amount: 350, currency: "EUR" }]);
  assert.throws(() => formatRecordedMoney(1, "CAD"), /Unsupported/);
  assert.throws(() => totalRecordedMoney([{amount: 1, currency: "CAD"}]), /Unsupported/);
  assert.match(formatRecordedMoney(150, "EUR"), /EUR\s*150\.00/);
  assert.match(formatRecordedMoney(200, "EUR"), /EUR\s*200\.00/);
  assert.match(formatRecordedMoney(0, "EUR"), /EUR\s*0\.00/);
  assert.deepEqual(records, [{ amount: 100, currency: "EUR" }, { amount: 200, currency: "EUR" }, { amount: 50, currency: "EUR" }]);
});


// Daily income uses confirmed purchase lots, not the date of the first holding.
const { dailyIncome, INCOME_DAY_MS } = await import("./daily-income-model.ts");
const incomePosition = { slug: "sample", title: "Sample", shares: 20, rentalRate: 19 };
const first = { property_slug: "sample", shares: 10, amount: 1000, currency: "EUR", created_at: "2026-01-01T12:00:00Z" };
const second = { ...first, created_at: "2026-01-03T12:00:00Z" };
test("daily rental projection counts full days separately for each purchase without compounding", () => {
  const now = Date.parse("2026-01-04T12:00:00Z");
  const result = dailyIncome(incomePosition, [first, second], now);
  assert.equal(result.days, 3);
  assert.deepEqual(result.lots.map(l => l.days), [3, 1]);
  assert.equal(result.daily, 380 / 365);
  assert.ok(Math.abs(result.accrued - 190 / 365 * 4) < 1e-10);
  assert.equal(result.next, now + INCOME_DAY_MS);
  assert.ok(Math.abs(result.history[0].profit - 380 / 365) < 1e-10);
  const previous = dailyIncome(incomePosition, [first, second], now - 1);
  assert.deepEqual(previous.lots.map(l => l.days), [2, 0]);
});
test("missing, partial, invalid, future and non-EUR purchase histories never invent earnings", () => {
  const now = Date.parse("2026-01-04T12:00:00Z");
  for (const lots of [[], [first], [first, {...second, created_at: "invalid"}], [first, {...second, currency: "USD"}], [first, {...second, amount: -1}], [first, {...second, created_at: "2027-01-01"}]]) {
    assert.equal(dailyIncome(incomePosition, lots, now), null);
  }
});
test("admin activation date delays accrual and a paused property accrues nothing", () => {
  const now = Date.parse("2026-01-04T12:00:00Z");
  const delayed = dailyIncome({ ...incomePosition, accrualStart: Date.parse("2026-01-02T12:00:00Z") }, [first, second], now);
  assert.deepEqual(delayed.lots.map(l => l.days), [2, 1]);
  assert.ok(Math.abs(delayed.accrued - 190 / 365 * 3) < 1e-10);
  assert.equal(delayed.start, Date.parse(first.created_at));
  assert.equal(delayed.days, 2);
  const future = dailyIncome({ ...incomePosition, accrualStart: Date.parse("2026-02-01T00:00:00Z") }, [first, second], now);
  assert.equal(future.accrued, 0);
  assert.equal(future.days, 0);
  assert.equal(future.next, Date.parse("2026-02-02T00:00:00Z"));
  const paused = dailyIncome({ ...incomePosition, paused: true }, [first, second], now);
  assert.equal(paused.paused, true);
  assert.equal(paused.accrued, 0);
  assert.equal(paused.daily, 0);
  assert.ok(paused.history.every(row => row.profit === 0 && row.total === 0));
  assert.equal(dailyIncome({ ...incomePosition, accrualStart: Number.NaN }, [first, second], now), null);
});
test("leap days and daylight-saving transitions are counted as elapsed 24-hour periods", () => {
  for (const [start, end] of [["2024-02-28T12:00:00Z", "2024-03-01T12:00:00Z"], ["2026-03-28T12:00:00Z", "2026-03-30T12:00:00Z"]]) {
    const result = dailyIncome({...incomePosition, shares: 10}, [{...first, created_at: start}], Date.parse(end));
    assert.equal(result.days, 2);
    assert.equal(result.accrued, 190 / 365 * 2);
  }
});
