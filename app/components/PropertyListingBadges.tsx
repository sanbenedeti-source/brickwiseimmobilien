import { CircleCheck, Coins, KeyRound, ShieldCheck, Sparkles, Sprout } from "lucide-react";
import { listingBadgeCopy, type OccupancyStatus, type PropertyStrategy } from "../lib/listing-badges";
import type { Locale } from "../lib/i18n";

const strategyStyles: Record<PropertyStrategy, { icon: typeof Coins; className: string }> = {
  prime: { icon: ShieldCheck, className: "bg-[#fff6db] text-[#7a5a12]" },
  capital_growth: { icon: Sprout, className: "bg-emerald-50 text-emerald-800" },
  high_yield: { icon: Coins, className: "bg-sky-50 text-sky-800" },
};

/** Prime, Capital Growth or High Yield, chosen by the admin; no badge when unset. */
export function StrategyBadge({ strategy, locale, className = "" }: { strategy?: PropertyStrategy; locale: Locale; className?: string }) {
  if (!strategy) return null;
  const { icon: Icon, className: tone } = strategyStyles[strategy];
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold shadow-sm ${tone} ${className}`}>
    <Icon size={14} aria-hidden="true" />{listingBadgeCopy[locale].strategies[strategy]}
  </span>;
}

/** Dark ribbon across the top of a card image for properties listed in the last 30 days. */
export function NewListingRibbon({ locale }: { locale: Locale }) {
  return <span className="absolute inset-x-0 top-0 z-10 flex items-center justify-center gap-1.5 bg-ink py-1.5 text-xs font-bold text-white">
    <Sparkles size={13} aria-hidden="true" />{listingBadgeCopy[locale].newListing}
  </span>;
}

/** Rented (tenant in place) or Ready to rent. */
export function OccupancyBadge({ status, locale }: { status?: OccupancyStatus; locale: Locale }) {
  if (!status) return null;
  const Icon = status === "rented" ? KeyRound : CircleCheck;
  return <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold ${status === "rented" ? "bg-slate-100 text-slate-700" : "bg-emerald-50 text-emerald-800"}`}>
    <Icon size={15} aria-hidden="true" />{listingBadgeCopy[locale].occupancy[status]}
  </span>;
}
