import { formatPropertyPercent, propertyUiCopy } from "../properties/property-ui-copy";
import { localeHtmlLang, type Locale } from "../lib/i18n";
import { investmentCopy } from "../lib/investment-copy";
import { targetReturnCopy } from "../lib/target-return-copy";
import { formatMinimumInvestment, MINIMUM_INVESTMENT_EUR, minimumInvestmentShares } from "../lib/investment-policy";
import { formatPropertyMoney, getPropertyCurrency, getPropertyProjection, getPropertyReturnBreakdown, getPropertyShareSupply } from "../lib/property-financials";
import { ArrowRight, BedDouble, Bath, MapPin, TrendingUp } from "lucide-react";
import Link from "next/link";
import type { ListingProperty } from "@/app/lib/external-properties";
import { createSharePurchaseRequest } from "./actions";
import PropertyConstructionBadge from "../components/PropertyConstructionBadge";
import { randomUUID } from "node:crypto";
import SharePurchaseForm from "./SharePurchaseForm";

export type DashboardCardCopy = {
  available: string;
  targetReturn: string;
  perShare: string;
  shares: string;
  daily: string;
  weekly: string;
  monthly: string;
  annual: string;
  amount: string;
  payment: string;
  bank: string;
  crypto: string;
  agentNote: string;
  request: string;
  details: string;
  buyWithWallet: string;
  availableWallet: string;
  maximumWithWallet: string;
};

export default async function PropertyInvestmentCard({ locale, property, copy, shareAvailability, walletBalance = 0 }: { locale: Locale; property: ListingProperty; copy: DashboardCardCopy; shareAvailability?: { total: number; blocked: number; projectedReturn?: number; profitActive?: boolean }; walletBalance?: number | null }) {
  const text = investmentCopy[locale];
  const ui = propertyUiCopy[locale];
  const returnText = targetReturnCopy[locale];
  const hasReturnBreakdown = Boolean(getPropertyReturnBreakdown(property));
  const hasTargetReturn = property.targetTotalReturn !== undefined || hasReturnBreakdown;
  const currency = getPropertyCurrency(property);
  const minimumShares = minimumInvestmentShares(property.sharePrice, MINIMUM_INVESTMENT_EUR);
  const { available: availableShares } = getPropertyShareSupply(property, {
    total_shares: shareAvailability?.total,
    blocked_shares: shareAvailability?.blocked,
  });
  const money = (value: number, digits = 0) => formatPropertyMoney(value, currency, locale, digits);
  const projection = getPropertyProjection(property);
  const targetReturn = projection.annualRate;

  return (
    <article className="group overflow-hidden rounded-[14px] border border-[#e7ebef] bg-white shadow-[0_5px_18px_rgba(23,35,63,0.09)] transition hover:-translate-y-1 hover:shadow-[0_12px_28px_rgba(23,35,63,0.14)]">
      <Link href={`/properties/${property.slug}`} className="block">
        <div className="relative aspect-[16/10] overflow-hidden bg-[#e8edf1]">
          <div className="h-full bg-cover bg-center transition duration-500 group-hover:scale-[1.025]" style={{ backgroundImage: `url(${property.image_url})` }} />
          <span className="absolute bottom-4 right-4 rounded-full bg-[#2f9bdb] px-3 py-1.5 text-xs font-bold uppercase text-white">{text.primary}</span>
          <span className="absolute left-4 top-4 rounded-lg bg-white/95 px-3 py-1.5 text-sm font-bold text-[#17233f] shadow-sm">{money(property.sharePrice)} / {text.share}</span>
        </div>
      </Link>

      <div className="p-5">
        <h2 className="truncate text-lg font-bold text-[#101828]">{property.title}</h2>
        {property.constructionStatus && <div className="mt-2"><PropertyConstructionBadge status={property.constructionStatus} locale={locale} /></div>}
        <p className="mt-2 flex items-center gap-1.5 truncate text-sm text-[#596579]"><MapPin size={15} />{property.address}</p>

        <div className="mt-6 grid gap-3 text-sm">
          <div className="flex items-center justify-between"><span className="font-semibold text-[#17233f]">{copy.available}</span><strong className="text-[#168bd3]">{availableShares.toLocaleString(localeHtmlLang[locale])}</strong></div>
          <div className="flex items-center justify-between"><span className="font-semibold text-[#17233f]">{hasTargetReturn ? returnText.targetTotalReturn : copy.targetReturn}</span><strong className="text-[#168bd3]">{formatPropertyPercent(targetReturn, locale)}</strong></div>
        </div>
        {hasTargetReturn && <p className="mt-3 text-xs leading-5 text-[#596579]">{hasReturnBreakdown ? returnText.modelNote : returnText.configuredTargetNote}</p>}

        <div className="mt-5 flex items-center gap-5 border-y border-[#e6e9ed] py-3 text-sm text-[#596579]">
          <span className="flex items-center gap-1.5" title={property.bedrooms ? ui.beds : ui.rooms}><BedDouble size={17} />{property.bedrooms || property.rooms || "—"}</span>
          <span className="flex items-center gap-1.5" title={ui.baths}><Bath size={17} />{property.bathrooms || "—"}</span>
          <span className="ml-auto text-xs font-semibold text-[#7b8595]">{text.details}</span>
        </div>

        <div className="mt-4 flex items-center justify-between gap-4">
          <div><p className="text-xs text-[#7b8595]">{returnText.monthlyPerShare}</p><p className="mt-1 flex items-center gap-1.5 font-bold text-[#17233f]"><TrendingUp size={16} className="text-[#2f9bdb]" />{money(projection.monthlyPerShare, 2)}</p><p className="mt-2 text-xs text-[#7b8595]">{returnText.annualPerShare}: {money(projection.annualPerShare, 2)}</p></div>
          <Link href={`/properties/${property.slug}`} className="inline-flex min-h-11 items-center bg-[#2f9bdb] px-4 text-sm font-bold text-white hover:bg-[#17233f]">{text.view}<ArrowRight className="ml-2" size={16} /></Link>
        </div>
        <p className="mt-4 text-sm font-semibold">{text.minimum}: {formatMinimumInvestment(locale)}{minimumShares !== null && <> / {`${minimumShares} ${text.shares}`}</>}</p>
        <SharePurchaseForm action={createSharePurchaseRequest} purchaseRequestId={randomUUID()} propertySlug={property.slug} minimumShares={minimumShares} availableShares={availableShares} sharePrice={property.sharePrice} walletBalance={walletBalance} locale={locale} copy={copy} />
      </div>
    </article>
  );
}
