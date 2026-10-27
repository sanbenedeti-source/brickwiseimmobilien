import { getAdminText } from "@/app/lib/admin-copy";
import { getCurrentLocale } from "@/app/lib/server-locale";
import { localeHtmlLang, type Locale } from "@/app/lib/i18n";
import { getPropertyTranslations } from "@/app/lib/property-localization";
import { getPropertyMapLinks } from "@/app/lib/property-location";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { createProperty, updateCatalogueSaleStatus, updatePropertySale, updateShareSettings } from "./actions";
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
import { getCatalogueProperties, mapDatabaseProperty } from "@/app/lib/property-registry";
import { AdminAlert, AdminCard, AdminDisclosure, AdminEmpty, AdminPageHeader, AdminStat, StatusBadge } from "../ui";

function formatEuro(value: number | string | null, locale: Locale) {
  return new Intl.NumberFormat(localeHtmlLang[locale], {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

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
  const listedCatalogue = catalogue.filter((listing) => listing.listed !== false);

  const { data: properties } = await supabase
    .from("properties")
    .select("*")
    .order("created_at", { ascending: false });

  const { data: shareSettings } = await supabase
    .from("property_share_settings")
    .select("property_slug,total_shares,blocked_shares,availability_version");
  const settingsBySlug = new Map((shareSettings || []).map((item) => [item.property_slug, item]));
  const shareStatusMessages: Record<string, string> = {
    "shares-saved": "Share availability saved.",
    "shares-stale": "Share availability changed while this form was open. Current values are shown below. Review them before saving again.",
    "shares-owned": "Sold / blocked shares cannot be lower than shares already owned plus the property's opening allocation.",
    "shares-invalid": "Check the total and sold / blocked shares, then reload the page and try again.",
    "shares-error": "Share availability could not be saved. Reload the page and try again.",
  };
  const shareStatusMessage = status ? shareStatusMessages[status] : undefined;
  const saleStatusMessages: Record<string, string> = {
    "sale-saved": "Sales settings saved.",
    "sale-invalid": "Check the price, rent and share price, then try again.",
    "sale-locked": "Price and share price are locked because shares have already been sold.",
    "sale-error": "Sales settings could not be saved. Reload the page and try again.",
  };
  const saleStatusMessage = status ? saleStatusMessages[status] : undefined;
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

      <AdminCard id="sales-status" title={t("Sales status")} description={t("Choose when each property can be bought. Completed or Under construction with a monthly rent and a share price opens it for purchase; Upcoming keeps it visible without purchases.")}>
        {saleStatusMessage && <AdminAlert tone={status === "sale-saved" ? "success" : "warning"}>{t(saleStatusMessage)}</AdminAlert>}
        <div className="grid gap-3">
          {listedCatalogue.map((listing) => {
            const open = isPropertyOpenForInvestment(listing);
            return <details key={`sale-${listing.slug}-${listing.constructionStatus ?? ""}`} open={changedSlug === listing.slug} className="admin-subsection">
              <summary>
                <span className="inline-flex flex-wrap items-center gap-2">
                  {translations.get(listing.slug)?.title || listing.title}
                  <PropertyConstructionBadge status={listing.constructionStatus} locale={locale} />
                  <StatusBadge status={open ? "active" : "pending"} label={t(open ? "Open for purchase" : "Not open for purchase")} />
                </span>
              </summary>
              <div>
                <form action={updateCatalogueSaleStatus} className="admin-form">
                  <input type="hidden" name="property_slug" value={listing.slug} />
                  <div className="admin-form-grid">
                    <label className="admin-field">{t("Construction status")}
                      <select name="construction_status" defaultValue={listing.constructionStatus ?? "completed"}>
                        <option value="completed">{t("Completed")}</option>
                        <option value="under_construction">{t("Under construction")}</option>
                        <option value="upcoming">{t("Upcoming")}</option>
                      </select>
                    </label>
                    <p className="admin-help admin-field-wide">{t("The price, rent and share price of this property come from its documents and do not change here.")}</p>
                  </div>
                  <div><button type="submit" className="admin-btn">{t("Save sales settings")}</button></div>
                </form>
              </div>
            </details>;
          })}
          {visibleProperties.map((property) => {
            const open = mapDatabaseProperty(property).investmentOpen;
            const locked = Number(settingsBySlug.get(property.slug)?.blocked_shares || 0) > 0;
            const values = [property.status, property.construction_status, property.price, property.monthly_rent, property.monthly_expenses, property.share_price].join("|");
            return <details key={`sale-${property.slug}-${values}`} open={changedSlug === property.slug} className="admin-subsection">
              <summary>
                <span className="inline-flex flex-wrap items-center gap-2">
                  {translations.get(property.slug)?.title || property.title}
                  <PropertyConstructionBadge status={property.construction_status} locale={locale} />
                  <StatusBadge status={open ? "active" : "pending"} label={t(open ? "Open for purchase" : "Not open for purchase")} />
                </span>
              </summary>
              <div>
                <form action={updatePropertySale} className="admin-form">
                  <input type="hidden" name="property_slug" value={property.slug} />
                  <div className="admin-form-grid">
                    <label className="admin-field">{t("Construction status")}
                      <select name="construction_status" defaultValue={property.construction_status || "completed"}>
                        <option value="completed">{t("Completed")}</option>
                        <option value="under_construction">{t("Under construction")}</option>
                        <option value="upcoming">{t("Upcoming")}</option>
                      </select>
                    </label>
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
                    {locked && <p className="admin-help admin-field-wide">{t("Price and share price are locked because shares have already been sold.")}</p>}
                  </div>
                  <div><button type="submit" className="admin-btn">{t("Save sales settings")}</button></div>
                </form>
              </div>
            </details>;
          })}
        </div>
      </AdminCard>

      <AdminCard id="share-availability" title={t("Share availability")} description={`${t("Set the total shares and how many are already sold or blocked. Available shares are calculated automatically.")} ${t("Total shares follow the property value and share price.")}`} flush>
        {shareStatusMessage && <div className="admin-card-notice"><AdminAlert tone={status === "shares-saved" ? "success" : "warning"}>{t(shareStatusMessage)}</AdminAlert></div>}
        {!rows.length ? <AdminEmpty>{t("No properties yet.")}</AdminEmpty>
          : <table className="admin-table admin-table-stack admin-table-wide">
            <thead><tr><th scope="col">{t("Property")}</th><th scope="col" className="admin-num">{t("Price")}</th><th scope="col">{t("Size")}</th><th scope="col">{t("Status")}</th><th scope="col">{t("Share availability")}</th><th scope="col"><span className="sr-only">{t("Open")}</span></th></tr></thead>
            <tbody>{rows.map(({ property, saved, total, blocked, available }) => {
              const expectedVersion = saved?.availability_version ?? -1;
              const listing = catalogue.find((listing) => listing.slug === property.slug);
              const isListing = Boolean(listing);
              const map = getPropertyMapLinks(property, locale);
              const title = translations.get(property.slug)?.title || property.title;
              return <tr key={`shares-${property.slug}-${expectedVersion}`} className={changedSlug === property.slug ? "admin-row-highlight" : undefined}>
                <td data-label={t("Property")}>
                  <p className="admin-cell-main">{title}</p>
                  {(listing?.constructionStatus ?? property.construction_status) && <div className="mt-1"><PropertyConstructionBadge status={listing?.constructionStatus ?? property.construction_status} locale={locale} /></div>}
                  <p className="admin-cell-sub">{property.address || property.city}{map && <> · <a href={map.mapUrl} target="_blank" rel="noopener noreferrer" className="admin-link">{t("Open map")}</a></>}</p>
                </td>
                <td data-label={t("Price")} className="admin-num">{formatEuro(property.price, locale)}</td>
                <td data-label={t("Size")} className="whitespace-nowrap">{number(Number(property.area || 0))} m² · {number(Number(property.rooms || 0))} {t("rooms")}</td>
                <td data-label={t("Status")}><StatusBadge status={property.status} label={t(property.status === "active" ? "Active" : property.status === "draft" ? "Draft" : property.status || "Unknown")} /></td>
                <td data-label={t("Share availability")}>
                  <form action={updateShareSettings} className="admin-share-form">
                    <input type="hidden" name="property_slug" value={property.slug} />
                    <input type="hidden" name="expected_version" value={expectedVersion} />
                    <label>{t("Total shares")}<input name="total_shares" type="number" min="1" required readOnly={isListing} defaultValue={total} className="admin-input" /></label>
                    <label>{t("Sold / blocked")}<input name="blocked_shares" type="number" min={property.blockedShares ?? 0} max={total} required defaultValue={blocked} className="admin-input" /></label>
                    <button className="admin-btn admin-btn-sm">{t("Save shares")}</button>
                  </form>
                  <p className="admin-cell-sub mt-1">{t("Available now:")} <strong>{number(available)}</strong></p>
                </td>
                <td><a href={`/properties/${property.slug}`} target="_blank" rel="noopener noreferrer" className="admin-btn admin-btn-secondary admin-btn-sm">{t("Open")}</a></td>
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
