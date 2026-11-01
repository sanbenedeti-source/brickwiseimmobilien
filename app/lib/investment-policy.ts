import { localeHtmlLang, type Locale } from "./i18n";

/** The entry threshold of standard properties, shared by every language and investment surface. */
export const MINIMUM_INVESTMENT_EUR = 2_000;

/** Every property belongs to one tier, and the tier sets its minimum investment. */
export const INVESTMENT_TIERS = ["standard", "premium", "super_premium"] as const;
export type InvestmentTier = (typeof INVESTMENT_TIERS)[number];
export const TIER_MINIMUM_EUR: Record<InvestmentTier, number> = {
  standard: MINIMUM_INVESTMENT_EUR,
  premium: 20_000,
  super_premium: 50_000,
};

/** Unknown or missing values fall back to the standard tier. */
export function toInvestmentTier(value: unknown): InvestmentTier {
  return (INVESTMENT_TIERS as readonly unknown[]).includes(value) ? value as InvestmentTier : "standard";
}

export function minimumInvestmentShares(sharePrice: number, minimumAmount: number) {
  if (!Number.isFinite(sharePrice) || sharePrice <= 0 || !Number.isFinite(minimumAmount) || minimumAmount <= 0) return null;
  return Math.max(1, Math.ceil(Math.round(minimumAmount * 100) / Math.round(sharePrice * 100)));
}

export function canPurchaseShares(shares: number, sharePrice: number, minimumAmount: number, availableShares: number) {
  const minimumShares = minimumInvestmentShares(sharePrice, minimumAmount);
  return minimumShares !== null && Number.isSafeInteger(shares) && Number.isSafeInteger(availableShares)
    && shares >= minimumShares && shares <= availableShares;
}

export function formatMinimumInvestment(locale: Locale, amount: number = MINIMUM_INVESTMENT_EUR) {
  return new Intl.NumberFormat(localeHtmlLang[locale], {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(amount);
}
