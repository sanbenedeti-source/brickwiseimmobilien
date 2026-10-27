import { getAdminText } from "@/app/lib/admin-copy";
import { getCurrentLocale } from "@/app/lib/server-locale";
import { localeHtmlLang } from "@/app/lib/i18n";
import { getPropertyTranslations } from "@/app/lib/property-localization";
import { getPropertyMapLinks } from "@/app/lib/property-location";
import { redirect } from "next/navigation";
import { hasAdminSession } from "@/app/lib/admin-session";
import { getAllProperties } from "@/app/lib/property-registry";
import { createClient } from "@/lib/supabase/server";
import { updateProfitSettings } from "./actions";
import { formatPropertyMoney, getPropertyProjection } from "@/app/lib/property-financials";
import { AdminAlert, AdminCard, AdminPageHeader } from "../ui";

export default async function AdminProfitsPage({ searchParams }: { searchParams: Promise<{ status?: string; property?: string }> }) {
  const locale = await getCurrentLocale();
  const t = getAdminText(locale);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!(await hasAdminSession(supabase, user))) redirect("/admin");
  const [translations, catalog] = await Promise.all([getPropertyTranslations(locale), getAllProperties()]);
  const { data: settings } = await supabase.from("property_share_settings").select("property_slug,profit_active,profit_start_date");
  const bySlug = new Map((settings || []).map((item) => [item.property_slug, item]));
  const params = await searchParams;
  const savedProperty = translations.get(params.property || "")?.title || catalog.find((property) => property.slug === params.property)?.title;

  const money = (value: number) => formatPropertyMoney(value, "EUR", locale, 2);
  const percent = new Intl.NumberFormat(localeHtmlLang[locale], { style: "percent", minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (
    <main className="admin-workspace">
      <AdminPageHeader
        eyebrow={t("Portfolio")}
        title={t("Property returns")}
        description={t("All property and share amounts are in EUR. Annual target income equals the investment amount multiplied by the annual target return. Monthly target income equals annual target income divided by 12.")}
      />
      {params.status === "saved" && <AdminAlert tone="success">{t("Earnings status saved successfully")}{savedProperty ? `: ${savedProperty}` : ""}.</AdminAlert>}
      {params.status === "invalid" && <AdminAlert tone="warning">{t("Choose a listed property and a valid activation date.")}</AdminAlert>}
      {params.status === "error" && <AdminAlert tone="danger">{t("Earnings status could not be saved. Please try again.")}</AdminAlert>}

      <AdminCard title={t("Recorded earnings status")} description={t("Status and activation date control earnings accrual. The published annual target remains visible while accrual is paused.")} flush>
        <table className="admin-table admin-table-stack admin-table-wide">
          <thead><tr>
            <th scope="col">{t("Property")}</th>
            <th scope="col" className="admin-num">{t("Annual target return")}</th>
            <th scope="col" className="admin-num">{t("Monthly target / share")}<br />{t("Annual target / share")}</th>
            <th scope="col" className="admin-num">{t("Monthly target / property")}<br />{t("Annual target / property")}</th>
            <th scope="col">{t("Earnings accrual active")}</th>
          </tr></thead>
          <tbody>{catalog.map((property) => {
            const saved = bySlug.get(property.slug);
            const projection = getPropertyProjection(property);
            const map = getPropertyMapLinks(property, locale);
            return <tr key={property.slug} className={params.property === property.slug ? "admin-row-highlight" : undefined}>
              <td data-label={t("Property")}>
                <p className="admin-cell-main">{translations.get(property.slug)?.title || property.title}</p>
                <p className="admin-cell-sub">{property.address}{map && <> · <a href={map.mapUrl} target="_blank" rel="noopener noreferrer" className="admin-link">{t("Open map")}</a></>}</p>
                <p className="admin-cell-sub">{t("Property value:")} {money(property.price)} · {t("Share price:")} {money(property.sharePrice)}</p>
              </td>
              <td data-label={t("Annual target return")} className="admin-num"><strong className="text-[15px] text-[var(--admin-brand)]">{percent.format(projection.annualRate / 100)}</strong></td>
              <td data-label={`${t("Monthly target / share")} · ${t("Annual target / share")}`} className="admin-num">{money(projection.monthlyPerShare)}<p className="admin-cell-sub">{money(projection.annualPerShare)}</p></td>
              <td data-label={`${t("Monthly target / property")} · ${t("Annual target / property")}`} className="admin-num">{money(projection.propertyMonthly)}<p className="admin-cell-sub">{money(projection.propertyAnnual)}</p></td>
              <td data-label={t("Earnings accrual active")}>
                <form action={updateProfitSettings} className="admin-share-form">
                  <input type="hidden" name="property_slug" value={property.slug} />
                  <label className="admin-check !text-[12.5px] !text-[var(--admin-text)] self-center"><input name="profit_active" type="checkbox" defaultChecked={saved?.profit_active ?? true} />{t("Active")}</label>
                  <label>{t("Activation date")}<input name="profit_start_date" type="date" defaultValue={saved?.profit_start_date || ""} className="admin-input !w-[150px]" /></label>
                  <button className="admin-btn admin-btn-sm">{t("Save")}</button>
                </form>
              </td>
            </tr>;
          })}</tbody>
        </table>
        <p className="admin-card-footnote">{t("These are projected net rental yields (rent minus stated costs). They are not guaranteed monthly cash payments.")}</p>
      </AdminCard>
    </main>
  );
}
