import Link from "next/link";
import { ArrowRight, Building2, Crown, Gem } from "lucide-react";
import { formatMinimumInvestment, INVESTMENT_TIERS, TIER_MINIMUM_EUR, type InvestmentTier } from "../lib/investment-policy";
import { tierCopy } from "../lib/tier-copy";
import type { Locale } from "../lib/i18n";

export const tierIcons: Record<InvestmentTier, typeof Gem> = { standard: Building2, premium: Gem, super_premium: Crown };
export const tierCardStyles: Record<InvestmentTier, string> = {
  standard: "border-line bg-white text-ink",
  premium: "border-[#e8d9b8] bg-[#fbf6ec] text-ink",
  super_premium: "border-[#14213d] bg-[#14213d] text-white",
};

/** The three investment levels with their minimum investment, each linking to its section of the property list. */
export default function InvestmentTierCards({ locale }: { locale: Locale }) {
  const copy = tierCopy[locale];
  return (
    <div className="grid gap-5 md:grid-cols-3">
      {INVESTMENT_TIERS.map((tier) => {
        const Icon = tierIcons[tier];
        const dark = tier === "super_premium";
        return (
          <Link key={tier} href={`/properties?tier=${tier}#tier-${tier}`} className={`group flex flex-col rounded-xl border p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${tierCardStyles[tier]}`}>
            <Icon size={28} aria-hidden="true" className={dark ? "text-[#f1d48a]" : tier === "premium" ? "text-[#7a5a1e]" : "text-brand"} />
            <h3 className="mt-5 text-2xl font-semibold">{copy.names[tier]}</h3>
            <p className={`mt-1 text-sm ${dark ? "text-white/70" : "text-muted"}`}>{copy.minimum}</p>
            <p className={`text-3xl font-semibold ${dark ? "text-[#f1d48a]" : "text-brand"}`}>{formatMinimumInvestment(locale, TIER_MINIMUM_EUR[tier])}</p>
            <p className={`mt-4 flex-1 leading-7 ${dark ? "text-white/80" : "text-muted"}`}>{copy.descriptions[tier]}</p>
            <span className={`mt-6 inline-flex items-center font-semibold ${dark ? "text-[#f1d48a]" : "text-brand"}`}>{copy.view}<ArrowRight size={18} className="ml-2 transition group-hover:translate-x-0.5" aria-hidden="true" /></span>
          </Link>
        );
      })}
    </div>
  );
}
