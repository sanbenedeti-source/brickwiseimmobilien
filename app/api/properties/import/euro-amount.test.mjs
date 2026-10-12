import assert from "node:assert/strict";
import test from "node:test";
import { isEuroCurrency, parseEuroAmount } from "./euro-amount.ts";

test("property imports preserve EUR values across supported number formats", () => {
  for (const input of [735000, "735000", "€735,000", "735.000 EUR", "735 000", "735\u202f000 €"]) {
    assert.equal(parseEuroAmount(input), 735000, String(input));
  }
  for (const input of [735000.25, "735000,25", "735,000.25 EUR", "€ 735.000,25", "735 000,25"])
    assert.equal(parseEuroAmount(input), 735000.25, String(input));
  assert.equal(parseEuroAmount("100,50"), 100.5);
  assert.equal(parseEuroAmount("0,50"), 0.5);
});

test("property import never relabels non-EUR amounts or silently truncates invalid values", () => {
  for (const input of ["C$735,000", "735000 CAD", "$735000", "USD 735000", "€735000 EUR", "73500EUR0", "", "1,23,456", "735,00.25", "735.000.25", "7 35 000", "1e6", "735000.123", NaN, Infinity, 10.123, null, {}]) {
    assert.equal(parseEuroAmount(input), null, String(input));
  }
});

test("omitted currency means EUR and explicit foreign currencies are rejected", () => {
  for (const input of [undefined, "EUR", "eur", " EUR "]) assert.equal(isEuroCurrency(input), true);
  for (const input of ["CAD", "USD", "", null, 123]) assert.equal(isEuroCurrency(input), false);
});
