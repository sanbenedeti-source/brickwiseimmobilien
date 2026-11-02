import { localeHtmlLang, type Locale } from "@/app/lib/i18n";
import { INVESTMENT_TIERS, TIER_MINIMUM_EUR, toInvestmentTier, type InvestmentTier } from "@/app/lib/investment-policy";
import { listingBadgeCopy, OCCUPANCY_STATUSES, PROPERTY_STRATEGIES } from "@/app/lib/listing-badges";
import type { ListingProperty } from "@/app/lib/external-properties";
import type { DatabasePropertyRow } from "@/app/lib/property-registry";
import { updateCatalogueSaleStatus, updatePropertySale, updateShareSettings } from "./actions";

type T = (text: string) => string;
export type SaleBadgeRow = { strategy: string | null; occupancy_status: string | null; exited_at: string | null };
export type AdminPropertyRow = DatabasePropertyRow & { investment_tier?: string | null; strategy?: string | null; occupancy_status?: string | null; exited_at?: string | null };

export function formatEuro(value: number | string | null, locale: Locale) {
  return new Intl.NumberFormat(localeHtmlLang[locale], { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(Number(value || 0));
}

function tierName(tier: InvestmentTier, t: T) {
  return tier === "premium" ? "Premium" : tier === "super_premium" ? "Super Premium" : t("Standard");
}

function ConstructionSelect({ value, t }: { value?: string | null; t: T }) {
  return <label className="admin-field">{t("Construction status")}
    <select name="construction_status" defaultValue={value || "completed"}>
      <option value="completed">{t("Completed")}</option>
      <option value="under_construction">{t("Under construction")}</option>
      <option value="upcoming">{t("Upcoming")}</option>
    </select>
  </label>;
}

/** Tier, strategy badge, occupancy and sold status: the same fields for catalogue and admin-added properties. */
function ListingFields({ tier, badges, t, locale }: { tier?: string | null; badges?: SaleBadgeRow; t: T; locale: Locale }) {
  const badgeText = listingBadgeCopy[locale];
  return <>
    <label className="admin-field">{t("Investment tier")}
      <select name="investment_tier" defaultValue={toInvestmentTier(tier)}>
        {INVESTMENT_TIERS.map((value) => <option key={value} value={value}>{`${tierName(value, t)} · ${t("Minimum investment")} ${formatEuro(TIER_MINIMUM_EUR[value], locale)}`}</option>)}
      </select>
    </label>
    <label className="admin-field">{t("Strategy badge")}
      <select name="strategy" defaultValue={badges?.strategy ?? ""}>
        <option value="">{t("None")}</option>
        {PROPERTY_STRATEGIES.map((value) => <option key={value} value={value}>{badgeText.strategies[value]}</option>)}
      </select>
    </label>
    <label className="admin-field">{t("Occupancy")}
      <select name="occupancy_status" defaultValue={badges?.occupancy_status ?? ""}>
        <option value="">{t("Not set")}</option>
        {OCCUPANCY_STATUSES.map((value) => <option key={value} value={value}>{badgeText.occupancy[value]}</option>)}
      </select>
    </label>
    <p className="admin-help admin-field-wide">{t("The tier sets the minimum investment a client must make in this property.")}</p>
    <input type="hidden" name="exited_at" value={badges?.exited_at ?? ""} />
    <label className="admin-field admin-field-wide flex-row items-center gap-2"><input type="checkbox" name="exited" defaultChecked={Boolean(badges?.exited_at)} />{t("Sold: list under Exited and close purchases")}</label>
  </>;
}

/** Sales settings of a catalogue listing: its price, rent and share price come from its documents. */
export function CatalogueSaleForm({ listing, badges, t, locale }: { listing: ListingProperty; badges?: SaleBadgeRow; t: T; locale: Locale }) {
  return <form action={updateCatalogueSaleStatus} className="admin-form">
    <input type="hidden" name="property_slug" value={listing.slug} />
    <div className="admin-form-grid">
      <ConstructionSelect value={listing.constructionStatus} t={t} />
      <ListingFields tier={listing.investmentTier} badges={badges} t={t} locale={locale} />
      <p className="admin-help admin-field-wide">{t("The price, rent and share price of this property come from its documents and do not change here.")}</p>
    </div>
    <div><button type="submit" className="admin-btn">{t("Save sales settings")}</button></div>
  </form>;
}

/** Sales settings of an admin-added property. Price and share price lock once shares are sold. */
export function PropertySaleForm({ property, locked, t, locale }: { property: AdminPropertyRow; locked: boolean; t: T; locale: Locale }) {
  return <form action={updatePropertySale} className="admin-form">
    <input type="hidden" name="property_slug" value={property.slug} />
    <div className="admin-form-grid">
      <ConstructionSelect value={property.construction_status} t={t} />
      <label className="admin-field">{t("Publication status")}
        <select name="status" defaultValue={property.status === "draft" ? "draft" : "active"}>
          <option value="active">{t("Active")}</option>
          <option value="draft">{t("Draft")}</option>
        </select>
      </label>
      <label className="admin-field">{t("Purchase price (EUR)")}<input name="price" required type="number" min="0.01" step="0.01" defaultValue={property.price ?? ""} readOnly={locked} /></label>
      <label className="admin-field">{t("Share price (EUR)")}<input name="share_price" type="number" min="0.01" step="0.01" defaultValue={property.share_price ?? ""} readOnly={locked} /></label>
      <label className="admin-field">{t("Monthly rent (EUR)")}<input name="monthly_rent" type="number" min="0" step="0.01" defaultValue={property.monthly_rent ?? ""} /></label>
      <label className="admin-field">{t("Monthly costs (EUR)")}<input name="monthly_expenses" type="number" min="0" step="0.01" defaultValue={property.monthly_expenses ?? 0} /></label>
      <label className="admin-field">{t("Projected value growth / month (EUR)")}<input name="monthly_value_growth" type="number" min="0" step="0.01" defaultValue={property.monthly_value_growth ?? ""} /></label>
      <p className="admin-help admin-field-wide">{t("Value growth is shown separately from the rental yield and is never paid out monthly.")}</p>
      <ListingFields tier={property.investment_tier} badges={{ strategy: property.strategy ?? null, occupancy_status: property.occupancy_status ?? null, exited_at: property.exited_at ?? null }} t={t} locale={locale} />
      {locked && <p className="admin-help admin-field-wide">{t("Price and share price are locked because shares have already been sold.")}</p>}
    </div>
    <div><button type="submit" className="admin-btn">{t("Save sales settings")}</button></div>
  </form>;
}

/** Total and sold / blocked shares; the version check stops two admins overwriting each other. */
export function ShareAvailabilityForm({ slug, expectedVersion, total, blocked, available, minimumBlocked, isListing, t, locale }: {
  slug: string; expectedVersion: number; total: number; blocked: number; available: number; minimumBlocked: number; isListing: boolean; t: T; locale: Locale;
}) {
  return <form action={updateShareSettings} className="admin-form">
    <input type="hidden" name="property_slug" value={slug} />
    <input type="hidden" name="expected_version" value={expectedVersion} />
    <div className="admin-form-grid">
      <label className="admin-field">{t("Total shares")}<input name="total_shares" type="number" min="1" required readOnly={isListing} defaultValue={total} /></label>
      <label className="admin-field">{t("Sold / blocked")}<input name="blocked_shares" type="number" min={minimumBlocked} max={total} required defaultValue={blocked} /></label>
      <p className="admin-help admin-field-wide">{t("Available now:")} <strong>{available.toLocaleString(localeHtmlLang[locale])}</strong> · {t("Total shares follow the property value and share price.")}</p>
    </div>
    <div><button className="admin-btn">{t("Save shares")}</button></div>
  </form>;
}
