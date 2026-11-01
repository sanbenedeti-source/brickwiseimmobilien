import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdminUser } from "@/app/lib/admin";
import { hasAdminSession } from "@/app/lib/admin-session";
import { getCurrentLocale } from "@/app/lib/server-locale";
import { getAdminText } from "@/app/lib/admin-copy";
import { contentLocaleLabels, contentLocales } from "@/app/lib/content-translations";
import { getExternalPropertyBySlug } from "@/app/lib/external-properties";
import { updatePropertyDetails } from "../../actions";
import { AdminAlert, AdminCard, AdminPageHeader } from "../../../ui";

type TranslationRow = { locale: string; title: string | null; description: string | null; property_type: string | null; highlights: string[] | null;
  location_description: string | null; seo_title: string | null; seo_description: string | null };

/** Edits the texts, address, size and photos of an admin-added property. */
export default async function EditPropertyPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ status?: string }> }) {
  const [{ slug }, { status }] = await Promise.all([params, searchParams]);
  const locale = await getCurrentLocale();
  const t = getAdminText(locale);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");
  if (!isAdminUser(user)) redirect("/dashboard");
  if (!(await hasAdminSession(supabase, user))) redirect("/admin/security");
  // Catalogue listings come from their documents and are not edited here.
  if (getExternalPropertyBySlug(slug)) notFound();

  const [{ data: property }, { data: translationRows }] = await Promise.all([
    supabase.from("properties").select("*").eq("slug", slug).maybeSingle(),
    supabase.from("property_translations").select("locale,title,description,property_type,highlights,location_description,seo_title,seo_description").eq("property_slug", slug),
  ]);
  if (!property) notFound();
  const translations = new Map(((translationRows || []) as TranslationRow[]).map((row) => [row.locale, row]));
  const images: string[] = Array.isArray(property.image_urls) ? property.image_urls.filter(Boolean) : [];
  const messages: Record<string, string> = {
    saved: "Property details saved.",
    invalid: "Check every language's title and description, the address and the image addresses, then try again.",
    error: "The property details could not be saved. Reload the page and try again.",
  };

  return <main className="admin-workspace">
    <AdminPageHeader back={{ href: "/admin/properties#sales-status", label: t("Manage properties") }} eyebrow={t("Edit property")}
      title={translations.get(locale)?.title || property.title} description={t("Change the texts, address, size and photos. Price, rent, shares, tier and publication are managed under Sales status.")} />
    {status && messages[status] && <AdminAlert tone={status === "saved" ? "success" : "warning"}>{t(messages[status])}</AdminAlert>}

    <AdminCard title={t("Property details")}>
      <form action={updatePropertyDetails} className="admin-form">
        <input type="hidden" name="property_slug" value={slug} />
        <div className="grid gap-3">
          <p className="admin-form-heading">{t("Required translations")}</p>
          {contentLocales.map((code, index) => {
            const row = translations.get(code);
            return <details key={code} open={index === 0} className="admin-subsection">
              <summary>{contentLocaleLabels[code]} ({code.toUpperCase()})</summary>
              <div className="admin-form-grid">
                <label className="admin-field admin-field-wide">{t("Title")}<input name={`title_${code}`} required defaultValue={row?.title ?? (code === "en" ? property.title : "")} /></label>
                <label className="admin-field admin-field-wide">{t("Description")}<textarea name={`description_${code}`} required rows={6} defaultValue={row?.description ?? (code === "en" ? property.description ?? "" : "")} /></label>
                <label className="admin-field">{t("Property type")}<input name={`property_type_${code}`} defaultValue={row?.property_type ?? ""} /></label>
                <label className="admin-field">{t("SEO title")}<input name={`seo_title_${code}`} defaultValue={row?.seo_title ?? ""} /></label>
                <label className="admin-field">{t("Highlights (one per line)")}<textarea name={`highlights_${code}`} rows={5} defaultValue={(row?.highlights || []).join("\n")} /></label>
                <label className="admin-field">{t("Location description")}<textarea name={`location_description_${code}`} rows={5} defaultValue={row?.location_description ?? ""} /></label>
                <label className="admin-field admin-field-wide">{t("SEO description")}<textarea name={`seo_description_${code}`} rows={2} defaultValue={row?.seo_description ?? ""} /></label>
              </div>
            </details>;
          })}
        </div>

        <div className="admin-form-grid">
          <label className="admin-field admin-field-wide">{t("Address")}<input name="address" required defaultValue={property.address ?? ""} /></label>
          <label className="admin-field">{t("City")}<input name="city" required defaultValue={property.city ?? ""} /></label>
          <label className="admin-field">{t("Area in sqm")}<input name="area" type="number" min="0" step="0.01" defaultValue={property.area ?? ""} /></label>
          <label className="admin-field">{t("Rooms")}<input name="rooms" type="number" min="0" step="0.5" defaultValue={property.rooms ?? ""} /></label>
          <label className="admin-field">{t("Bedrooms")}<input name="bedrooms" type="number" min="0" step="1" defaultValue={property.bedrooms ?? ""} /></label>
          <label className="admin-field">{t("Bathrooms")}<input name="bathrooms" type="number" min="0" step="1" defaultValue={property.bathrooms ?? ""} /></label>
          <label className="admin-field admin-field-wide">{t("Cover image")}<input name="image_url" defaultValue={property.image_url ?? ""} placeholder="https://... /properties/..." /></label>
          <label className="admin-field admin-field-wide">{t("Gallery images (one per line, up to 12)")}<textarea name="image_urls" rows={6} defaultValue={images.join("\n")} /></label>
          <p className="admin-help admin-field-wide">{t("Use https links or photos hosted on the website (/properties/...). The first gallery image is used as the cover when the cover field is empty.")}</p>
        </div>

        {images.length > 0 && <div className="grid grid-cols-3 gap-2 sm:grid-cols-6" aria-label={t("Current photos")}>
          {/* eslint-disable-next-line @next/next/no-img-element -- admin preview of arbitrary gallery URLs */}
          {images.map((src, index) => <img key={`${src}-${index}`} src={src} alt={`${index + 1}`} className="aspect-[4/3] w-full rounded-md border border-line object-cover" loading="lazy" />)}
        </div>}

        <div><button type="submit" className="admin-btn">{t("Save details")}</button></div>
      </form>
    </AdminCard>
  </main>;
}
