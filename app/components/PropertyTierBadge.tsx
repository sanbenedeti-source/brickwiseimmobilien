import { Crown, Gem } from "lucide-react";
import type { InvestmentTier } from "../lib/investment-policy";
import type { Locale } from "../lib/i18n";

const labels: Record<Locale, Record<Exclude<InvestmentTier, "standard">, string>> = {
  en: { premium: "Premium", super_premium: "Super Premium" },
  de: { premium: "Premium", super_premium: "Super Premium" },
  fr: { premium: "Premium", super_premium: "Super Premium" },
  es: { premium: "Premium", super_premium: "Super Premium" },
  it: { premium: "Premium", super_premium: "Super Premium" },
};

/** Marks premium tiers; standard properties carry no badge. */
export default function PropertyTierBadge({ tier, locale }: { tier?: InvestmentTier; locale: Locale }) {
  if (!tier || tier === "standard") return null;
  const Icon = tier === "super_premium" ? Crown : Gem;
  return (
    <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold ${tier === "super_premium" ? "bg-[#14213d] text-[#f1d48a]" : "bg-[#f6efe1] text-[#7a5a1e]"}`}>
      <Icon size={16} aria-hidden="true" />
      {labels[locale][tier]}
    </span>
  );
}
