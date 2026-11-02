import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { isAdminUser } from "@/app/lib/admin";
import { hasAdminSession } from "@/app/lib/admin-session";
import { getAdminText } from "@/app/lib/admin-copy";
import { getCurrentLocale } from "@/app/lib/server-locale";
import { localeHtmlLang } from "@/app/lib/i18n";
import { getPropertyTranslations } from "@/app/lib/property-localization";
import { getPropertyShareSupply } from "@/app/lib/property-financials";
import { hiddenManualPropertySlugs, isPropertyOpenForInvestment } from "@/app/lib/external-properties";
import { getCatalogueProperties, mapDatabaseProperty } from "@/app/lib/property-registry";
import PropertyConstructionBadge from "@/app/components/PropertyConstructionBadge";
import PropertyTierBadge from "@/app/components/PropertyTierBadge";
import { OccupancyBadge, StrategyBadge } from "@/app/components/PropertyListingBadges";
import { getClientDirectory } from "../../client-directory";
import { AdminAlert, AdminCard, AdminEmpty, AdminPageHeader, AdminStat, StatusBadge } from "../../ui";
import { CatalogueSaleForm, formatEuro, PropertySaleForm, ShareAvailabilityForm, type AdminPropertyRow, type SaleBadgeRow } from "../PropertyForms";

const saleMessages: Record<string, string> = {
  "sale-saved": "Sales settings saved.",
  "sale-invalid": "Check the price, rent and share price, then try again.",
  "sale-locked": "Price and share price are locked because shares have already been sold.",
  "sale-error": "Sales settings could not be saved. Reload the page and try again.",
};
const shareMessages: Record<string, string> = {
  "shares-saved": "Share availability saved.",
  "shares-stale": "Share availability changed while this form was open. Current values are shown below. Review them before saving again.",
  "shares-owned": "Sold / blocked shares cannot be lower than shares already owned plus the property's opening allocation.",
  "shares-invalid": "Check the total and sold / blocked shares, then reload the page and try again.",
  "shares-error": "Share availability could not be saved. Reload the page and try again.",
};

/** Everything about one property in one place: sales settings, shares, investors and income. */
export default async function AdminPropertyPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ status?: string }> }) {
  const [{ slug }, { status }] = await Promise.all([params, searchParams]);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");
  if (!isAdminUser(user)) redirect("/dashboard");
  if (!(await hasAdminSession(supabase, user))) redirect("/admin/security");
  if (hiddenManualPropertySlugs.includes(slug)) notFound();
  const locale = await getCurrentLocale(), t = getAdminText(locale), lang = localeHtmlLang[locale];

  const service = createServiceClient();
  const [catalogue, translations, { data: row }, { data: setting }, { data: saleRow }, { data: holdingRows }, { data: distributionRows }, directory] = await Promise.all([
    getCatalogueProperties(), getPropertyTranslations(locale),
    supabase.from("properties").select("*").eq("slug", slug).maybeSingle(),
    supabase.from("property_share_settings").select("property_slug,total_shares,blocked_shares,availability_version").eq("property_slug", slug).maybeSingle(),
    supabase.from("property_sale_status").select("strategy,occupancy_status,exited_at").eq("property_slug", slug).maybeSingle(),
    // Holdings are owner-only under RLS, so the verified admin reads them with the service role.
    service.from("property_holdings").select("user_id,shares,invested_amount,first_purchased_at").eq("property_slug", slug).order("shares", { ascending: false }),
    service.from("property_distributions").select("id,period_start,period_end,net_amount,distributed_amount,holder_count,created_at").eq("property_slug", slug).order("created_at", { ascending: false }).limit(12),
    getClientDirectory(),
  ]);
  // Hidden catalogue listings stay manageable for their existing holders.
  const listing = catalogue.find((item) => item.slug === slug);
  const property = row as AdminPropertyRow | null;
  if (!listing && !property) notFound();
  const model = listing ?? mapDatabaseProperty(property!);
  const title = translations.get(slug)?.title || model.title;
  const { total, blocked, available } = getPropertyShareSupply(model, setting ?? undefined);
  const holders = (holdingRows || []).map((holding) => ({ ...holding, shares: Number(holding.shares), invested: Number(holding.invested_amount) }));
  const heldShares = holders.reduce((sum, holding) => sum + holding.shares, 0);
  const open = isPropertyOpenForInvestment(model);
  const number = (value: number) => value.toLocaleString(lang);
  const saleMessage = status ? saleMessages[status] : undefined;
  const shareMessage = status ? shareMessages[status] : undefined;

  return <main className="admin-workspace">
    <AdminPageHeader back={{ href: "/admin/properties", label: t("Manage properties") }} eyebrow={t("Property")} title={title}
      description={model.address || model.city}
      actions={<>
        <a href={`/properties/${slug}`} target="_blank" rel="noopener noreferrer" className="admin-btn admin-btn-secondary">{t("Open")}</a>
        {property && <Link href={`/admin/properties/${encodeURIComponent(slug)}/edit`} className="admin-btn">{t("Edit details")}</Link>}
      </>} />
    <div className="mb-5 flex flex-wrap items-center gap-2">
      <PropertyConstructionBadge status={model.constructionStatus} locale={locale} />
      <PropertyTierBadge tier={model.investmentTier} locale={locale} />
      <StrategyBadge strategy={model.strategy} locale={locale} />
      <OccupancyBadge status={model.occupancyStatus} locale={locale} />
      <StatusBadge status={open ? "active" : "pending"} label={t(open ? "Open for purchase" : "Not open for purchase")} />
    </div>

    <section className="admin-stats" aria-label={t("Key figures")}>
      <AdminStat label={t("Purchase price (EUR)")} value={formatEuro(model.price, locale)} hint={`${t("Share price (EUR)")}: ${formatEuro(model.sharePrice, locale)}`} />
      <AdminStat label={t("Sold / blocked")} value={`${number(blocked)} / ${number(total)}`} hint={`${t("Available shares")}: ${number(available)}`} />
      <AdminStat label={t("Investors")} value={number(holders.length)} hint={`${number(heldShares)} ${t("Shares")}`} />
      <AdminStat label={t("Monthly rent (EUR)")} value={model.monthlyRent ? formatEuro(model.monthlyRent, locale) : "—"} />
    </section>

    <AdminCard id="sales" title={t("Sales status")} description={t("Choose when each property can be bought. Completed or Under construction with a monthly rent and a share price opens it for purchase; Upcoming keeps it visible without purchases.")}>
      {saleMessage && <AdminAlert tone={status === "sale-saved" ? "success" : "warning"}>{t(saleMessage)}</AdminAlert>}
      {property
        ? <PropertySaleForm property={property} locked={Number(setting?.blocked_shares || 0) > 0} t={t} locale={locale} />
        : <CatalogueSaleForm listing={listing!} badges={(saleRow ?? undefined) as SaleBadgeRow | undefined} t={t} locale={locale} />}
    </AdminCard>

    <AdminCard id="shares" title={t("Share availability")} description={t("Set the total shares and how many are already sold or blocked. Available shares are calculated automatically.")}>
      {shareMessage && <AdminAlert tone={status === "shares-saved" ? "success" : "warning"}>{t(shareMessage)}</AdminAlert>}
      <ShareAvailabilityForm key={setting?.availability_version ?? -1} slug={slug} expectedVersion={setting?.availability_version ?? -1} total={total} blocked={blocked} available={available}
        minimumBlocked={listing?.blockedShares ?? 0} isListing={Boolean(listing)} t={t} locale={locale} />
    </AdminCard>

    <AdminCard id="investors" title={t("Investors")} description={t("Clients who hold shares in this property. Open a client to add shares, buy shares back or pay profit.")} flush>
      {!holders.length ? <AdminEmpty>{t("No investors yet.")}</AdminEmpty> : <table className="admin-table admin-table-stack">
        <thead><tr><th scope="col">{t("Client")}</th><th scope="col" className="admin-num">{t("Shares")}</th><th scope="col" className="admin-num">{t("Ownership")}</th><th scope="col" className="admin-num">{t("Invested")}</th><th scope="col">{t("Since")}</th><th scope="col"><span className="sr-only">{t("Open")}</span></th></tr></thead>
        <tbody>{holders.map((holding) => {
          const person = directory.get(holding.user_id);
          return <tr key={holding.user_id}>
            <td data-label={t("Client")}><span className="admin-cell-main">{person?.name || holding.user_id.slice(0, 8)}</span><span className="admin-cell-sub block">{person?.email}</span></td>
            <td data-label={t("Shares")} className="admin-num">{number(holding.shares)}</td>
            <td data-label={t("Ownership")} className="admin-num">{total > 0 ? (holding.shares / total).toLocaleString(lang, { style: "percent", maximumFractionDigits: 2 }) : "—"}</td>
            <td data-label={t("Invested")} className="admin-num">{formatEuro(holding.invested, locale)}</td>
            <td data-label={t("Since")} className="whitespace-nowrap">{holding.first_purchased_at ? new Date(holding.first_purchased_at).toLocaleDateString(lang) : "—"}</td>
            <td><Link href={`/admin/customers/${holding.user_id}`} className="admin-btn admin-btn-secondary admin-btn-sm">{t("Manage")}</Link></td>
          </tr>;
        })}</tbody>
      </table>}
    </AdminCard>

    <AdminCard id="income" title={t("Rental distributions")} description={t("Net rent recorded for this property and split across its holders.")} flush
      actions={<Link href="/admin/distributions" className="admin-btn admin-btn-secondary admin-btn-sm">{t("Record distribution")}</Link>}>
      {!(distributionRows || []).length ? <AdminEmpty>{t("No distributions recorded yet.")}</AdminEmpty> : <table className="admin-table admin-table-stack">
        <thead><tr><th scope="col">{t("Period")}</th><th scope="col" className="admin-num">{t("Net amount")}</th><th scope="col" className="admin-num">{t("Distributed")}</th><th scope="col" className="admin-num">{t("Holders")}</th><th scope="col">{t("Date")}</th></tr></thead>
        <tbody>{(distributionRows || []).map((item) => <tr key={item.id}>
          <td data-label={t("Period")} className="whitespace-nowrap">{item.period_start} – {item.period_end}</td>
          <td data-label={t("Net amount")} className="admin-num">{formatEuro(item.net_amount, locale)}</td>
          <td data-label={t("Distributed")} className="admin-num">{formatEuro(item.distributed_amount, locale)}</td>
          <td data-label={t("Holders")} className="admin-num">{number(Number(item.holder_count))}</td>
          <td data-label={t("Date")} className="whitespace-nowrap">{new Date(item.created_at).toLocaleDateString(lang)}</td>
        </tr>)}</tbody>
      </table>}
    </AdminCard>
  </main>;
}
