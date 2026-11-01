import { formatPropertyPercent, propertyUiCopy } from "../properties/property-ui-copy";
import { localeHtmlLang, type Locale } from "../lib/i18n";
import { investmentCopy } from "../lib/investment-copy";
import { targetReturnCopy, rentalYieldLabel } from "../lib/target-return-copy";
import { formatMinimumInvestment, minimumInvestmentShares } from "../lib/investment-policy";
import { formatPropertyMoney, getPropertyCurrency, getPropertyProjection, getPropertyReturnBreakdown, getPropertyShareSupply } from "../lib/property-financials";
import { ArrowRight, BedDouble, Bath, MapPin } from "lucide-react";
import Link from "next/link";
import type { ListingProperty } from "@/app/lib/external-properties";
import { createSharePurchaseRequest } from "./actions";
import PropertyConstructionBadge from "../components/PropertyConstructionBadge";
import PropertyTierBadge from "../components/PropertyTierBadge";
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
  const minimumShares = minimumInvestmentShares(property.sharePrice, property.minInvestmentEur);
  const { available: availableShares } = getPropertyShareSupply(property, {
    total_shares: shareAvailability?.total,
    blocked_shares: shareAvailability?.blocked,
  });
  const money = (value: number, digits = 0) => formatPropertyMoney(value, currency, locale, digits);
  const projection = getPropertyProjection(property);
  const targetReturn = projection.annualRate;

  return (
    <article className="flex flex-col overflow-hidden rounded-xl border border-line bg-white transition-shadow hover:shadow-[0_10px_30px_rgba(20,33,61,0.08)]">
      <Link href={`/properties/${property.slug}`} className="group relative block aspect-[16/9] overflow-hidden bg-canvas">
        <div className="h-full bg-cover bg-center transition duration-500 group-hover:scale-[1.02]" style={{ backgroundImage: `url(${property.image_url})` }} />
        <span className="absolute left-3 top-3 rounded-md bg-white/95 px-2.5 py-1 text-xs font-semibold text-ink shadow-sm">{money(property.sharePrice)} / {text.share}</span>
        <span className="absolute right-3 top-3 rounded-md bg-ink/85 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-white">{text.primary}</span>
      </Link>

      <div className="flex flex-1 flex-col p-5">
        <h2 className="truncate text-base font-semibold text-ink"><Link href={`/properties/${property.slug}`} className="hover:text-brand">{property.title}</Link></h2>
        <p className="mt-1 flex items-center gap-1.5 truncate text-sm text-muted"><MapPin size={14} aria-hidden="true" className="shrink-0" />{property.address}</p>
        {(property.constructionStatus || (property.investmentTier && property.investmentTier !== "standard")) && <div className="mt-2 flex flex-wrap gap-2"><PropertyConstructionBadge status={property.constructionStatus} locale={locale} /><PropertyTierBadge tier={property.investmentTier} locale={locale} /></div>}

        <dl className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line">
          <CardMetric label={hasTargetReturn ? rentalYieldLabel(locale, "costsStated" in property ? property.costsStated : undefined) : copy.targetReturn} value={formatPropertyPercent(targetReturn, locale)} accent />
          <CardMetric label={copy.perShare} value={money(property.sharePrice)} />
          <CardMetric label={copy.available} value={availableShares.toLocaleString(localeHtmlLang[locale])} />
          <CardMetric label={text.minimum} value={`${formatMinimumInvestment(locale, property.minInvestmentEur)}${minimumShares !== null ? ` / ${minimumShares} ${text.shares}` : ""}`} />
        </dl>
        {hasTargetReturn && <p className="mt-2.5 text-xs leading-5 text-muted">{hasReturnBreakdown ? returnText.modelNote : returnText.configuredTargetNote}</p>}

        <div className="mt-4 flex flex-wrap items-end justify-between gap-3 border-t border-line pt-4">
          <div><p className="text-xs text-muted">{returnText.monthlyPerShare}</p><p className="mt-0.5 font-semibold tabular-nums text-ink">{money(projection.monthlyPerShare, 2)}<span className="ml-2 text-xs font-normal text-muted">{returnText.annualPerShare}: {money(projection.annualPerShare, 2)}</span></p></div>
          <div className="flex items-center gap-3 text-xs text-muted"><span className="flex items-center gap-1" title={property.bedrooms ? ui.beds : ui.rooms}><BedDouble size={15} aria-hidden="true" />{property.bedrooms || property.rooms || "—"}</span><span className="flex items-center gap-1" title={ui.baths}><Bath size={15} aria-hidden="true" />{property.bathrooms || "—"}</span></div>
        </div>
        <Link href={`/properties/${property.slug}`} className="mt-3 inline-flex items-center gap-1 self-start text-sm font-semibold text-brand hover:underline">{text.view}<ArrowRight size={15} aria-hidden="true" /></Link>
        <SharePurchaseForm action={createSharePurchaseRequest} purchaseRequestId={randomUUID()} propertySlug={property.slug} minimumShares={minimumShares} availableShares={availableShares} sharePrice={property.sharePrice} walletBalance={walletBalance} locale={locale} copy={copy} />
      </div>
    </article>
  );
}

function CardMetric({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return <div className="bg-white px-3 py-2.5"><dt className="text-[11px] font-medium leading-4 text-muted">{label}</dt><dd className={`mt-1 text-sm font-semibold tabular-nums ${accent ? "text-brand" : "text-ink"}`}>{value}</dd></div>;
}
