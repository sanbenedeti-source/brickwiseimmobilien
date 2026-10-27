import type { Locale } from "./i18n";

export type PropertyCurrency = "EUR";

export type PropertyReturnBreakdown = {
  rental: number;
  vacationPoint: number;
  appreciation: number;
};

/** Allocation of a target, not a claim about observed rental income. */
export function allocateTargetReturn(annualTarget: number): PropertyReturnBreakdown {
  if (!Number.isFinite(annualTarget) || annualTarget < 0) throw new RangeError("Invalid annual target");
  return {
    rental: annualTarget * 70 / 100,
    vacationPoint: annualTarget * 15 / 100,
    appreciation: annualTarget * 15 / 100,
  };
}

type PropertyFinancials = {
  currency?: PropertyCurrency;
  price?: number | null;
  sharePrice?: number;
  totalShares?: number;
  blockedShares?: number;
  fundedPercent?: number;
  annualYield?: number;
  targetTotalReturn?: number;
  targetReturnBreakdown?: PropertyReturnBreakdown;
  vacationPointYield?: number;
  appreciationYield?: number;
};

export function getPropertyCurrency(property: PropertyFinancials): PropertyCurrency {
  if (property.currency && property.currency !== "EUR") throw new Error("Unsupported property currency");
  return "EUR";
}

export function getPropertyReturnBreakdown(property: PropertyFinancials): PropertyReturnBreakdown | undefined {
  if (property.targetReturnBreakdown) return property.targetReturnBreakdown;
  if (property.vacationPointYield === undefined) return undefined;
  return {
    rental: property.annualYield ?? 0,
    vacationPoint: property.vacationPointYield,
    appreciation: property.appreciationYield ?? 0,
  };
}

export function getPropertyTargetReturn(property: PropertyFinancials) {
  // Listing targets are annual models, independent of recorded wallet earnings.
  if (property.targetTotalReturn !== undefined) return property.targetTotalReturn;
  // A component-based total includes non-cash benefits; it is not the managed
  // annual cash-profit rate stored in property_share_settings.
  const breakdown = getPropertyReturnBreakdown(property);
  if (breakdown) {
    return Math.round((breakdown.rental + breakdown.vacationPoint + breakdown.appreciation) * 100) / 100;
  }
  return 0;
}

/** All target projections use one annual model; round only for presentation. */
export function getPropertyProjection(property: PropertyFinancials, shares = 1) {
  if (!Number.isSafeInteger(shares) || shares < 0) throw new RangeError("Shares must be a nonnegative whole number");
  const sharePrice = property.sharePrice ?? 1000;
  const annualRate = getPropertyTargetReturn(property);
  if (!Number.isFinite(sharePrice) || sharePrice <= 0 || !Number.isFinite(annualRate) || annualRate < 0) {
    throw new RangeError("Invalid property financial model");
  }
  const amount = shares * sharePrice;
  const annual = amount * annualRate / 100;
  const annualPerShare = sharePrice * annualRate / 100;
  const propertyAnnual = (property.price ?? 0) * annualRate / 100;
  return {
    currency: getPropertyCurrency(property), sharePrice, shares, amount, annualRate,
    annual, monthly: annual / 12,
    annualPerShare, monthlyPerShare: annualPerShare / 12,
    propertyAnnual, propertyMonthly: propertyAnnual / 12,
  };
}

export function getPropertyShareSupply(
  property: PropertyFinancials,
  setting?: { total_shares?: number; blocked_shares?: number } | null,
) {
  const total = property.totalShares ?? setting?.total_shares
    ?? Math.max(1, Math.floor((property.price ?? 0) / (property.sharePrice || 1000)));
  const baseline = property.blockedShares ?? 0;
  // Never make already sold/reserved shares available again when loading the
  // listing's opening allocation (31 shares for Sal Rei's first phase).
  const blocked = Math.max(baseline, setting?.blocked_shares
    ?? property.blockedShares ?? Math.floor(total * (property.fundedPercent ?? 0) / 100));
  return { total, blocked, available: Math.max(0, total - blocked) };
}

export function formatPropertyMoney(value: number, currency: PropertyCurrency, locale: Locale = "en", digits = 0) {
  const locales = { en: "en-GB", de: "de-DE", fr: "fr-FR", es: "es-ES", it: "it-IT" };
  return new Intl.NumberFormat(locales[locale], {
    style: "currency", currency, minimumFractionDigits: digits, maximumFractionDigits: digits,
  }).format(value);
}
