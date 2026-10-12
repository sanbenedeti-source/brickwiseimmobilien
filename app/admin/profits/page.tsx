import { getAdminText } from "@/app/lib/admin-copy";
import { getCurrentLocale } from "@/app/lib/server-locale";
import { localeHtmlLang } from "@/app/lib/i18n";
import { getPropertyTranslations } from "@/app/lib/property-localization";
import { getPropertyMapLinks } from "@/app/lib/property-location";
import { redirect } from "next/navigation";
import { isAdminUser } from "@/app/lib/admin";
import { externalProperties } from "@/app/lib/external-properties";
import { createClient } from "@/lib/supabase/server";
import { updateProfitSettings } from "./actions";
import { formatPropertyMoney, getPropertyProjection } from "@/app/lib/property-financials";

export default async function AdminProfitsPage({ searchParams }: { searchParams: Promise<{ status?: string; property?: string }> }) {
  const locale = await getCurrentLocale();
  const t = getAdminText(locale);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!isAdminUser(user)) redirect("/admin");
  const translations = await getPropertyTranslations(locale);
  const { data: settings } = await supabase.from("property_share_settings").select("property_slug,profit_active,profit_start_date");
  const bySlug = new Map((settings || []).map((item) => [item.property_slug, item]));
  const params = await searchParams;
  const savedProperty = translations.get(params.property || "")?.title || externalProperties.find((property) => property.slug === params.property)?.title;

  const money = (value: number) => formatPropertyMoney(value, "EUR", locale, 2);
  return (
    <main className="min-h-screen bg-[#050712] px-5 py-10 text-white sm:px-8">
      <div className="mx-auto max-w-6xl">
        <p className="font-bold text-[#2f9bdb]">{t("PANEL ADMIN")}</p>
        <h1 className="mt-2 text-4xl font-bold">{t("Property returns")}</h1>
        <p className="mt-3 max-w-3xl text-white/65">{t("All property and share amounts are in EUR. Annual target income equals the investment amount multiplied by the annual target return. Monthly target income equals annual target income divided by 12.")}</p>
        {params.status === "saved" && <div className="mt-6 border-l-4 border-emerald-500 bg-emerald-50 p-4 font-bold text-emerald-800">{t("Earnings status saved successfully")}{savedProperty ? `: ${savedProperty}` : ""}.</div>}
        {params.status === "invalid" && <div className="mt-6 border-l-4 border-amber-500 bg-amber-50 p-4 font-bold text-amber-800">{t("Choose a listed property and a valid activation date.")}</div>}
        {params.status === "error" && <div className="mt-6 border-l-4 border-red-500 bg-red-50 p-4 font-bold text-red-800">{t("Earnings status could not be saved. Please try again.")}</div>}
        <div className="mt-8 grid gap-5">
          {externalProperties.map((property) => {
            const saved = bySlug.get(property.slug);
            const projection = getPropertyProjection(property);
            const map = getPropertyMapLinks(property, locale);
            return (
              <form action={updateProfitSettings} key={property.slug} className="rounded-2xl bg-white p-6 text-[#17233f] shadow-lg">
                <input type="hidden" name="property_slug" value={property.slug} />
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-bold">{translations.get(property.slug)?.title || property.title}</h2>
                    <p className="mt-1 text-sm text-[#687486]">{property.address}</p>
                    {map && <a href={map.mapUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-bold text-sky-700">{t("Open map")}</a>}
                    <p className="mt-1 text-sm text-[#687486]">{t("Property value:")} {money(property.price)} · {t("Share price:")} {money(property.sharePrice)}</p>
                  </div>
                  <div className="text-right"><p className="text-sm text-[#687486]">{t("Annual target return")}</p><strong className="text-2xl text-[#168bd3]">{new Intl.NumberFormat(localeHtmlLang[locale], { style: "percent", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(projection.annualRate / 100)}</strong></div>
                </div>
                <div className="mt-5 grid gap-3 rounded-lg bg-[#f4f7f9] p-4 text-sm sm:grid-cols-4">
                  <div>{t("Monthly target / share")}<br /><strong>{money(projection.monthlyPerShare)}</strong></div>
                  <div>{t("Annual target / share")}<br /><strong>{money(projection.annualPerShare)}</strong></div>
                  <div>{t("Monthly target / property")}<br /><strong>{money(projection.propertyMonthly)}</strong></div>
                  <div>{t("Annual target / property")}<br /><strong>{money(projection.propertyAnnual)}</strong></div>
                </div>
                <p className="mt-3 text-xs leading-5 text-[#687486]">{t("These are modelled targets. Vacation points and appreciation are included in the annual target, and are not guaranteed monthly cash payments.")}</p>
                <div className="mt-5 border-t border-slate-200 pt-5">
                  <h3 className="font-bold">{t("Recorded earnings status")}</h3>
                  <p className="mt-1 text-sm text-[#687486]">{t("Status and activation date control earnings accrual. The published annual target remains visible while accrual is paused.")}</p>
                  <div className="mt-4 grid gap-4 md:grid-cols-3 md:items-end">
                    <label className="flex h-11 items-center gap-2 text-sm font-bold"><input name="profit_active" type="checkbox" defaultChecked={saved?.profit_active ?? true} />{t("Earnings accrual active")}</label>
                    <label className="text-sm font-bold">{t("Activation date")}<input name="profit_start_date" type="date" defaultValue={saved?.profit_start_date || ""} className="mt-2 h-11 w-full rounded-lg border border-[#ccd5df] px-3" /></label>
                    <button className="h-11 rounded-lg bg-[#2f9bdb] px-5 font-bold text-white">{t("Save earnings status")}</button>
                  </div>
                </div>
              </form>
            );
          })}
        </div>
      </div>
    </main>
  );
}
