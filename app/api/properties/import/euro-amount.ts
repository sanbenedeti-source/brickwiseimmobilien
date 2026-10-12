/** Property import amounts are EUR; currency conversion belongs to the source. */
export function isEuroCurrency(value: unknown) {
  return value === undefined || (typeof value === "string" && value.trim().toUpperCase() === "EUR");
}

export function parseEuroAmount(value: unknown): number | null {
  if (typeof value === "number") {
    const cents = value * 100;
    return Number.isFinite(value) && Number.isSafeInteger(Math.round(cents))
      && Math.abs(cents - Math.round(cents)) < 0.000001 ? value : null;
  }
  if (typeof value !== "string") return null;

  // Accept one optional EUR marker at either edge, never CAD/USD or bare $.
  const text = value.trim().replace(/[\u00a0\u202f]/g, " ");
  const currencyMarkers = text.match(/EUR|€/gi) || [];
  if (currencyMarkers.length > 1) return null;
  const amount = text.replace(/^(?:EUR|€)\s*|\s*(?:EUR|€)$/gi, "").trim();
  let normalized: string;
  if (/^-?\d+(?:[.,]\d{1,2})?$/.test(amount)) {
    normalized = amount.replace(",", ".");
  } else if (/^-?\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?$/.test(amount)) {
    normalized = amount.replaceAll(",", "");
  } else if (/^-?\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?$/.test(amount)) {
    normalized = amount.replaceAll(".", "").replace(",", ".");
  } else if (/^-?\d{1,3}(?: \d{3})+(?:[.,]\d{1,2})?$/.test(amount)) {
    normalized = amount.replaceAll(" ", "").replace(",", ".");
  } else {
    return null;
  }
  return parseEuroAmount(Number(normalized));
}
