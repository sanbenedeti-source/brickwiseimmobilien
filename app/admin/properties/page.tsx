import { getAdminText } from "@/app/lib/admin-copy";
import { getCurrentLocale } from "@/app/lib/server-locale";
import { localeHtmlLang } from "@/app/lib/i18n";
import { getPropertyMapLinks } from "@/app/lib/property-location";
import { getPropertyTranslations } from "@/app/lib/property-localization";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createProperty } from "./actions";
import { formatEuro } from "./PropertyForms";
import {
  externalProperties,
  hiddenManualPropertyIds,
  hiddenManualPropertySlugs,
  isPropertyOpenForInvestment,
} from "@/app/lib/external-properties";
import { isAdminUser } from "@/app/lib/admin";
import { hasAdminSession } from "@/app/lib/admin-session";
import ImportPropertiesForm from "./ImportPropertiesForm";
import { contentLocaleLabels, contentLocales } from "@/app/lib/content-translations";
import { getPropertyShareSupply } from "@/app/lib/property-financials";
import PropertyConstructionBadge from "@/app/components/PropertyConstructionBadge";
import PropertyTierBadge from "@/app/components/PropertyTierBadge";
import { StrategyBadge } from "@/app/components/PropertyListingBadges";
import { getCatalogueProperties, mapDatabaseProperty } from "@/app/lib/property-registry";
import { AdminAlert, AdminCard, AdminDisclosure, AdminEmpty, AdminPageHeader, AdminStat, StatusBadge } from "../ui";

export default async function AdminPropertiesPage({ searchParams }: { searchParams: Promise<{ status?: string; property?: string; form?: string }> }) {
  const locale = await getCurrentLocale();
  const t = getAdminText(locale);
  const { status, property: changedSlug, form } = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  if (!isAdminUser(user)) {
    redirect("/dashboard");
  }
  if (!(await hasAdminSession(supabase, user))) redirect("/admin/security");
  const [translations, catalogue] = await Promise.all([getPropertyTranslations(locale), getCatalogueProperties()]);

  const { data: properties } = await supabase
    .from("properties")
    .select("*")
    .order("created_at", { ascending: false });

  const { data: shareSettings } = await supabase
    .from("property_share_settings")
    .select("property_slug,total_shares,blocked_shares,availability_version");
  const settingsBySlug = new Map((shareSettings || []).map((item) => [item.property_slug, item]));
  const createFailed = status === "invalid" || status === "error";

  const visibleProperties = (properties || []).filter(
    (property) =>
      !hiddenManualPropertyIds.includes(property.id) &&
      !hiddenManualPropertySlugs.includes(property.slug) &&
      !externalProperties.some((listing) => listing.slug === property.slug)
  );
  const allProperties = [...externalProperties, ...visibleProperties];
  const rows = allProperties.map((property) => ({ property, saved: settingsBySlug.get(property.slug), ...getPropertyShareSupply(property, settingsBySlug.get(property.slug)) }));
  const totals = rows.reduce((sum, row) => ({ total: sum.total + row.total, blocked: sum.blocked + row.blocked, available: sum.available + row.available }), { total: 0, blocked: 0, available: 0 });
  const number = (value: number) => value.toLocaleString(localeHtmlLang[locale]);

  return (
    <main className="admin-workspace">
      <AdminPageHeader
        eyebrow={t("Portfolio")}
        title={t("Manage properties")}
        description={t("Add properties with prices in EUR, review saved assets, and manage published project pages.")}
        actions={<>
          <a href="?form=import#import-properties" className="admin-btn admin-btn-secondary">{t("Import JSON")}</a>
          <a href="?form=add#add-property" className="admin-btn">{t("Add property")}</a>
        </>}
      />
      {status && ["saved", "invalid", "error"].includes(status) && <AdminAlert tone={status === "saved" ? "success" : "warning"}>{t(status === "saved" ? "Property saved." : status === "invalid" ? "Check the address, EUR price and required translations." : "The property could not be published. Check the service configuration and translations.")}</AdminAlert>}

      <section className="admin-stats" aria-label={t("Key figures")}>
        <AdminStat label={t("Properties")} value={number(allProperties.length)} />
        <AdminStat label={t("Total shares")} value={number(totals.total)} />
        <AdminStat label={t("Sold / blocked")} value={number(totals.blocked)} />
        <AdminStat label={t("Available shares")} value={number(totals.available)} />
      </section>

      <AdminCard id="properties" title={t("Properties")} description={t("Open a property to manage its sales settings, shares, investors and income.")} flush>
        {!rows.length ? <AdminEmpty>{t("No properties yet.")}</AdminEmpty> : <table className="admin-table admin-table-stack admin-table-wide">
          <thead><tr><th scope="col">{t("Property")}</th><th scope="col" className="admin-num">{t("Price")}</th><th scope="col">{t("Shares")}</th><th scope="col">{t("Status")}</th><th scope="col"><span className="sr-only">{t("Manage")}</span></th></tr></thead>
          <tbody>{rows.map(({ property, total, blocked, available }) => {
            const listing = catalogue.find((item) => item.slug === property.slug);
            const model = listing ?? mapDatabaseProperty(property as Parameters<typeof mapDatabaseProperty>[0]);
            const open = isPropertyOpenForInvestment(model);
            const draft = !listing && property.status === "draft";
            const hidden = listing?.listed === false;
            const map = getPropertyMapLinks(property, locale);
            return <tr key={property.slug} className={changedSlug === property.slug ? "admin-row-highlight" : undefined}>
              <td data-label={t("Property")}>
                <Link href={`/admin/properties/${encodeURIComponent(property.slug)}`} className="admin-cell-main hover:underline">{translations.get(property.slug)?.title || property.title}</Link>
                <div className="mt-1 flex flex-wrap gap-1.5"><PropertyConstructionBadge status={model.constructionStatus} locale={locale} /><PropertyTierBadge tier={model.investmentTier} locale={locale} /><StrategyBadge strategy={model.strategy} locale={locale} /></div>
                <p className="admin-cell-sub">{property.address || property.city}{map && <> · <a href={map.mapUrl} target="_blank" rel="noopener noreferrer" className="admin-link">{t("Open map")}</a></>}</p>
              </td>
              <td data-label={t("Price")} className="admin-num">{formatEuro(property.price, locale)}</td>
              <td data-label={t("Shares")} className="whitespace-nowrap">{number(blocked)} / {number(total)}<span className="admin-cell-sub block">{t("Available now:")} {number(available)}</span></td>
              <td data-label={t("Status")}><StatusBadge status={draft || hidden ? "draft" : open ? "active" : "pending"} label={t(hidden ? "Hidden" : draft ? "Draft" : open ? "Open for purchase" : "Not open for purchase")} /></td>
              <td><Link href={`/admin/properties/${encodeURIComponent(property.slug)}`} className="admin-btn admin-btn-sm">{t("Manage")}</Link></td>
            </tr>;
          })}</tbody>
        </table>}
      </AdminCard>

      <AdminDisclosure id="add-property" title={t("Add new property")} description={t("Fill in the details to create a new property project. All purchase prices are in EUR.")} open={form === "add" || createFailed}>
        <form action={createProperty} className="admin-form">
          <div className="grid gap-3">
            <p className="admin-form-heading">{t("Required translations")}</p>
            <p className="admin-help">{t("A property cannot be published until every language has a title and description.")}</p>
            {contentLocales.map((locale, index) => (
              <details key={locale} open={index === 0} className="admin-subsection">
                <summary>{contentLocaleLabels[locale]} ({locale.toUpperCase()})</summary>
                <div className="admin-form-grid">
                  <label className="admin-field admin-field-wide">{t("Title")}<input name={`title_${locale}`} required /></label>
                  <label className="admin-field admin-field-wide">{t("Description")}<textarea name={`description_${locale}`} required rows={5} /></label>
                  <label className="admin-field">{t("Property type")}<input name={`property_type_${locale}`} /></label>
                  <label className="admin-field">{t("SEO title")}<input name={`seo_title_${locale}`} /></label>
                  <label className="admin-field">{t("Highlights (one per line)")}<textarea name={`highlights_${locale}`} rows={4} /></label>
                  <label className="admin-field">{t("Location description")}<textarea name={`location_description_${locale}`} rows={4} /></label>
                  <label className="admin-field admin-field-wide">{t("SEO description")}<textarea name={`seo_description_${locale}`} rows={2} /></label>
                </div>
              </details>
            ))}
          </div>

          <div className="admin-form-grid">
            <label className="admin-field admin-field-wide">{t("Address")}<input name="address" required /></label>
            <label className="admin-field">{t("City")}<input name="city" required placeholder="Toronto" /></label>
            <label className="admin-field">{t("Purchase price (EUR)")}<input name="price" required type="number" min="0.01" step="0.01" placeholder="735000" /></label>
            <label className="admin-field">{t("Area in sqm")}<input name="area" type="number" min="0" placeholder="78" /></label>
            <label className="admin-field">{t("Rooms")}<input name="rooms" type="number" min="0" step="0.5" placeholder="3" /></label>
            <label className="admin-field">{t("Image URL")}<input name="image_url" placeholder="https://..." /></label>
            <label className="admin-field">{t("Monthly rent (EUR)")}<input name="monthly_rent" type="number" min="0" step="0.01" placeholder="2400" /></label>
            <label className="admin-field">{t("Monthly costs (EUR)")}<input name="monthly_expenses" type="number" min="0" step="0.01" placeholder="350" /></label>
            <label className="admin-field">{t("Share price (EUR)")}<input name="share_price" type="number" min="0.01" step="0.01" placeholder="250" /></label>
            <label className="admin-field">{t("Projected value growth / month (EUR)")}<input name="monthly_value_growth" type="number" min="0" step="0.01" placeholder="2100" /></label>
            <label className="admin-field">{t("Construction status")}
              <select name="construction_status" defaultValue="completed">
                <option value="completed">{t("Completed")}</option>
                <option value="under_construction">{t("Under construction")}</option>
                <option value="upcoming">{t("Upcoming")}</option>
              </select>
            </label>
            <label className="admin-field admin-field-wide">{t("Gallery image URLs (one per line)")}<textarea name="image_urls" rows={3} placeholder="https://..." /></label>
            <p className="admin-help admin-field-wide">{t("Clients can buy shares only when the property is active and has a monthly rent and a share price. The number of shares is the price divided by the share price; you can change it later under share availability.")} {t("Upcoming properties are shown with their photos and details, but clients cannot buy shares yet.")}</p>
            <label className="admin-field">{t("Publication status")}
              <select name="status">
                <option value="active">{t("Active")}</option>
                <option value="draft">{t("Draft")}</option>
              </select>
            </label>
          </div>

          <div><button type="submit" className="admin-btn">{t("Save property")}</button></div>
        </form>
      </AdminDisclosure>

      <AdminDisclosure id="import-properties" title={t("Import properties from API JSON")} open={form === "import"}>
        <ImportPropertiesForm locale={locale} />
      </AdminDisclosure>
    </main>
  );
}
