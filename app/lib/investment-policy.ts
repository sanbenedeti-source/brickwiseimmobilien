import { localeHtmlLang, type Locale } from "./i18n";

/** The entry threshold is shared by every language and investment surface. */
export const MINIMUM_INVESTMENT_EUR = 2_000;

export function minimumInvestmentShares(sharePrice: number, minimumAmount: number) {
  if (!Number.isFinite(sharePrice) || sharePrice <= 0 || !Number.isFinite(minimumAmount) || minimumAmount <= 0) return null;
  return Math.max(1, Math.ceil(Math.round(minimumAmount * 100) / Math.round(sharePrice * 100)));
}

export function canPurchaseShares(shares: number, sharePrice: number, minimumAmount: number, availableShares: number) {
  const minimumShares = minimumInvestmentShares(sharePrice, minimumAmount);
  return minimumShares !== null && Number.isSafeInteger(shares) && Number.isSafeInteger(availableShares)
    && shares >= minimumShares && shares <= availableShares;
}

export function formatMinimumInvestment(locale: Locale) {
  return new Intl.NumberFormat(localeHtmlLang[locale], {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(MINIMUM_INVESTMENT_EUR);
}
