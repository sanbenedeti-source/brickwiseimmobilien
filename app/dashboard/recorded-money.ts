// The financial ledger accepts EUR only. Reject unexpected data instead of relabelling it.
export function formatRecordedMoney(amount: number, currency: string, locale = "en-CA") {
  if (currency !== "EUR") throw new Error("Unsupported ledger currency");
  return new Intl.NumberFormat(locale, {
    style: "currency", currency, currencyDisplay: "code",
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(amount);
}

export function totalRecordedMoney(records: { amount: number | null; currency: string | null }[], defaultCurrency = "EUR") {
  const totals = new Map<string, number>();
  for (const record of records) {
    const currency = record.currency || defaultCurrency;
    if (currency !== "EUR") throw new Error("Unsupported ledger currency");
    totals.set(currency, (totals.get(currency) ?? 0) + Number(record.amount || 0));
  }
  return [...totals].map(([currency, amount]) => ({ currency, amount }));
}
