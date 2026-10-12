import { getAdminText } from "@/app/lib/admin-copy";
import { getCurrentLocale } from "@/app/lib/server-locale";
import { localeHtmlLang, type Locale } from "@/app/lib/i18n";
import { getPropertyTranslations } from "@/app/lib/property-localization";
import { getPropertyMapLinks } from "@/app/lib/property-location";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { createProperty, updateShareSettings } from "./actions";
import {
  externalProperties,
  hiddenManualPropertyIds,
  hiddenManualPropertySlugs,
} from "@/app/lib/external-properties";
import { isAdminUser } from "@/app/lib/admin";
import ImportPropertiesForm from "./ImportPropertiesForm";
import { contentLocaleLabels, contentLocales } from "@/app/lib/content-translations";
import { getPropertyShareSupply } from "@/app/lib/property-financials";
import PropertyConstructionBadge from "@/app/components/PropertyConstructionBadge";

function formatEuro(value: number | string | null, locale: Locale) {
  return new Intl.NumberFormat(localeHtmlLang[locale], {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

export default async function AdminPropertiesPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const locale = await getCurrentLocale();
  const t = getAdminText(locale);
  const { status } = await searchParams;
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
  const translations = await getPropertyTranslations(locale);

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

  const visibleProperties = (properties || []).filter(
    (property) =>
      !hiddenManualPropertyIds.includes(property.id) &&
      !hiddenManualPropertySlugs.includes(property.slug) &&
      !externalProperties.some((listing) => listing.slug === property.slug)
  );
  const allProperties = [...externalProperties, ...visibleProperties];

  return (
    <main className="min-h-screen bg-[#050712] px-6 py-12 text-[#111111]">
      <div className="mx-auto max-w-6xl">
        {status && ["saved", "invalid", "error"].includes(status) && <p role="status" className={`mb-6 rounded-xl p-4 font-bold ${status === "saved" ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"}`}>{t(status === "saved" ? "Property saved." : status === "invalid" ? "Check the address, EUR price and required translations." : "The property could not be published. Check the service configuration and translations.")}</p>}
        <div className="mb-10 flex items-center justify-between">
          <div>
            <p className="text-lg font-bold text-emerald-300">{t("Admin Properties")}</p>

            <h1 className="font-display mt-3 text-5xl font-bold leading-none text-white">{t("Manage properties")}</h1>

            <p className="mt-4 max-w-2xl text-lg leading-relaxed text-white/70">{t("Add properties with prices in EUR, review saved assets, and manage published project pages.")}</p>
          </div>

          <a
            href="/admin"
            className="rounded-xl border border-white/40 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white hover:text-[#0b1020]"
          >{t("Back to dashboard")}</a>
        </div>

        <section className="mb-12 rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
          <h2 className="mb-2 text-3xl font-bold text-gray-900">{t("Add new property")}</h2>

          <p className="mb-8 text-base text-gray-600">{t("Fill in the details to create a new property project. All purchase prices are in EUR.")}</p>

          <form action={createProperty} className="grid gap-6">
            <div className="grid gap-4">
              <h3 className="text-xl font-bold text-gray-900">{t("Required translations")}</h3>
              <p className="text-sm text-gray-600">{t("A property cannot be published until every language has a title and description.")}</p>
              {contentLocales.map((locale, index) => (
                <details key={locale} open={index === 0} className="rounded-xl border border-gray-200 bg-gray-50 p-5">
                  <summary className="cursor-pointer text-lg font-bold text-gray-900">{contentLocaleLabels[locale]} ({locale.toUpperCase()})</summary>
                  <div className="mt-5 grid gap-5">
                    <label className="text-sm font-bold text-gray-800">{t("Title")}<input name={`title_${locale}`} required className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 font-normal" /></label>
                    <label className="text-sm font-bold text-gray-800">{t("Description")}<textarea name={`description_${locale}`} required rows={5} className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 font-normal" /></label>
                    <label className="text-sm font-bold text-gray-800">{t("Property type")}<input name={`property_type_${locale}`} className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 font-normal" /></label>
                    <label className="text-sm font-bold text-gray-800">{t("Highlights (one per line)")}<textarea name={`highlights_${locale}`} rows={4} className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 font-normal" /></label>
                    <label className="text-sm font-bold text-gray-800">{t("Location description")}<textarea name={`location_description_${locale}`} rows={3} className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 font-normal" /></label>
                    <div className="grid gap-5 md:grid-cols-2"><label className="text-sm font-bold text-gray-800">{t("SEO title")}<input name={`seo_title_${locale}`} className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 font-normal" /></label><label className="text-sm font-bold text-gray-800">{t("SEO description")}<textarea name={`seo_description_${locale}`} rows={2} className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 font-normal" /></label></div>
                  </div>
                </details>
              ))}
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <label className="text-base font-bold text-gray-900 md:col-span-2">{t("Address")}
                <input name="address" required className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 font-normal" />
              </label>
              <div>
                <label className="mb-2 block text-base font-bold text-gray-900">{t("City")}</label>
                <input
                  name="city"
                  required
                  placeholder="Toronto"
                  className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-base text-gray-900 placeholder:text-gray-400"
                />
              </div>

              <div>
                <label className="mb-2 block text-base font-bold text-gray-900">{t("Purchase price (EUR)")}</label>
                <input
                  name="price"
                  required
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder="735000"
                  className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-base text-gray-900 placeholder:text-gray-400"
                />
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-base font-bold text-gray-900">{t("Area in sqm")}</label>
                <input
                  name="area"
                  type="number"
                  min="0"
                  placeholder="78"
                  className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-base text-gray-900 placeholder:text-gray-400"
                />
              </div>

              <div>
                <label className="mb-2 block text-base font-bold text-gray-900">{t("Rooms")}</label>
                <input
                  name="rooms"
                  type="number"
                  min="0"
                  step="0.5"
                  placeholder="3"
                  className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-base text-gray-900 placeholder:text-gray-400"
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-base font-bold text-gray-900">{t("Image URL")}</label>
              <input
                name="image_url"
                placeholder="https://..."
                className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-base text-gray-900 placeholder:text-gray-400"
              />
            </div>

            <div>
              <label className="mb-2 block text-base font-bold text-gray-900">{t("Publication status")}</label>
              <select
                name="status"
                className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-base text-gray-900"
              >
                <option value="active">{t("Active")}</option>
                <option value="draft">{t("Draft")}</option>
              </select>
            </div>

            <button
              type="submit"
              className="w-fit rounded-xl bg-[#0b1020] px-6 py-3 text-base font-bold text-white transition hover:bg-[#111827]"
            >{t("Save property")}</button>
          </form>
        </section>

        <ImportPropertiesForm locale={locale} />

        <section id="share-availability" className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
          <h2 className="mb-2 text-3xl font-bold text-gray-900">{t("Share availability")}</h2>
          {shareStatusMessage && <p role={status === "shares-saved" ? "status" : "alert"} className={`mb-6 rounded-xl p-4 font-bold ${status === "shares-saved" ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"}`}>{t(shareStatusMessage)}</p>}
          <p className="mb-8 text-base text-gray-600">{t("Set the total shares and how many are already sold or blocked. Available shares are calculated automatically.")}</p>
          <div className="mb-12 grid gap-4">
            {allProperties.map((property) => {
              const saved = settingsBySlug.get(property.slug);
              const expectedVersion = saved?.availability_version ?? -1;
              const { total, blocked, available } = getPropertyShareSupply(property, saved);
              const listing = externalProperties.find((listing) => listing.slug === property.slug);
              const isListing = Boolean(listing);
              const map = getPropertyMapLinks(property, locale);
              return <form action={updateShareSettings} key={`shares-${property.slug}-${expectedVersion}`} className="grid gap-4 rounded-xl border border-gray-200 bg-gray-50 p-5 md:grid-cols-[1fr_150px_170px_auto] md:items-end">
                <input type="hidden" name="property_slug" value={property.slug} />
                <input type="hidden" name="expected_version" value={expectedVersion} />
                <div><p className="text-lg font-bold text-gray-900">{translations.get(property.slug)?.title || property.title}</p>{listing?.constructionStatus && <div className="mt-2"><PropertyConstructionBadge status={listing.constructionStatus} locale={locale} /></div>}<p className="mt-1 text-sm text-gray-500">{property.address || property.city}</p>{map && <a href={map.mapUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-bold text-sky-700">{t("Open map")}</a>}<p className="mt-1 text-sm text-gray-500">{t("Available now:")} {available.toLocaleString(localeHtmlLang[locale])}</p>{isListing && <p className="mt-1 text-xs text-gray-500">{t("Total shares follow the property value and share price.")}</p>}</div>
                <label className="text-sm font-bold text-gray-700">{t("Total shares")}<input name="total_shares" type="number" min="1" required readOnly={isListing} defaultValue={total} className="mt-2 h-11 w-full rounded-lg border border-gray-300 px-3 read-only:bg-gray-100" /></label>
                <label className="text-sm font-bold text-gray-700">{t("Sold / blocked")}<input name="blocked_shares" type="number" min={property.blockedShares ?? 0} max={total} required defaultValue={blocked} className="mt-2 h-11 w-full rounded-lg border border-gray-300 px-3" /></label>
                <button className="h-11 rounded-lg bg-[#2f9bdb] px-5 font-bold text-white hover:bg-[#17233f]">{t("Save shares")}</button>
              </form>;
            })}
          </div>

          <h2 className="mb-2 text-3xl font-bold text-gray-900">{t("Existing properties")}</h2>

          <p className="mb-8 text-base text-gray-600">{t("Overview of property projects already saved.")}</p>

          <div className="grid gap-4">
            {allProperties.map((property) => (
              <div
                key={property.id}
                className="rounded-xl border border-gray-200 bg-gray-50 p-5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-2xl font-bold text-gray-900">
                      {translations.get(property.slug)?.title || property.title}
                    </h3>

                    <p className="mt-1 text-base text-gray-700">
                      {property.city} - {formatEuro(property.price, locale)}
                    </p>

                    <p className="mt-2 text-base text-gray-500">
                      {Number(property.area || 0).toLocaleString(localeHtmlLang[locale])} m² - {Number(property.rooms || 0).toLocaleString(localeHtmlLang[locale])} {t("rooms")} - {t("Status")}: {t(property.status === "active" ? "Active" : property.status === "draft" ? "Draft" : property.status || "Unknown")}
                    </p>
                  </div>

                  <a
                    href={`/properties/${property.slug}`}
                    className="rounded-xl bg-[#0b1020] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#111827]"
                  >{t("Open")}</a>
                </div>
              </div>
            ))}

            {!allProperties.length && (
              <p className="text-gray-500">{t("No properties yet.")}</p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
