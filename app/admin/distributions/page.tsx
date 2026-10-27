import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdminUser } from "@/app/lib/admin";
import { hasAdminSession } from "@/app/lib/admin-session";
import { getCurrentLocale } from "@/app/lib/server-locale";
import { getAdminText } from "@/app/lib/admin-copy";
import { localeHtmlLang } from "@/app/lib/i18n";
import { getAllProperties } from "@/app/lib/property-registry";
import { getPropertyTranslations, localizeProperty } from "@/app/lib/property-localization";
import { AdminAlert, AdminCard, AdminEmpty, AdminPageHeader, AdminStat } from "../ui";
import DistributionForm from "./DistributionForm";

type Distribution = { id: string; property_slug: string; period_start: string; period_end: string; net_amount: number; distributed_amount: number; holder_count: number; note: string | null; created_at: string };

export default async function AdminDistributionsPage() {
  const client = await createClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) redirect("/sign-in");
  if (!isAdminUser(user)) redirect("/dashboard");
  if (!(await hasAdminSession(client, user))) redirect("/admin/security");
  const locale = await getCurrentLocale(), t = getAdminText(locale), lang = localeHtmlLang[locale];
  const [{ data, error }, { data: settings }, translations, catalog] = await Promise.all([
    client.from("property_distributions").select("id,property_slug,period_start,period_end,net_amount,distributed_amount,holder_count,note,created_at").order("created_at", { ascending: false }).limit(200),
    client.from("property_share_settings").select("property_slug"),
    getPropertyTranslations(locale),
    getAllProperties(),
  ]);
  const rows = (data || []) as Distribution[];
  const titleOf = (slug: string) => { const property = catalog.find((item) => item.slug === slug); return property ? localizeProperty(property, translations).title : slug; };
  // The database can only split rent for properties that have a share configuration.
  const configured = new Set((settings || []).map((row) => row.property_slug));
  const properties = catalog.filter((property) => configured.has(property.slug)).map((property) => ({ slug: property.slug, title: titleOf(property.slug) }));
  const euro = (value: number) => Number(value).toLocaleString(lang, { style: "currency", currency: "EUR" });
  const day = (value: string) => new Date(`${value}T00:00:00Z`).toLocaleDateString(lang, { timeZone: "UTC" });
  const total = rows.reduce((sum, row) => sum + Number(row.distributed_amount), 0);
  return <main className="admin-workspace">
    <AdminPageHeader eyebrow={t("Portfolio")} title={t("Rental distributions")} description={t("Record the net rent of a period. It is split across all current holders by shares and credited to their wallets immediately.")} />
    {error && <AdminAlert tone="danger">{t("Distributions could not be loaded.")}</AdminAlert>}
    <section className="admin-stats" aria-label={t("Key figures")}>
      <AdminStat label={t("Distributions")} value={rows.length} />
      <AdminStat label={t("Distributed")} value={euro(total)} />
    </section>
    <AdminCard title={t("Record distribution")}>
      <DistributionForm properties={properties} today={new Date().toISOString().slice(0, 10)} labels={{
        property: t("Property"), start: t("Period start"), end: t("Period end"), amount: t("Net amount for all shares (EUR)"), note: t("Note (optional)"),
        confirm: t("This credits client wallets immediately and cannot be undone."), submit: t("Record distribution"),
        saved: t("Distribution recorded."), error: t("The distribution could not be recorded. Check the property, period and amount; a period can only be distributed once."),
      }} />
    </AdminCard>
    <AdminCard title={t("Distributions")} flush>
      {!rows.length ? <AdminEmpty>{t("No distributions recorded yet.")}</AdminEmpty> : <table className="admin-table admin-table-stack">
        <thead><tr><th scope="col">{t("Date")}</th><th scope="col">{t("Property")}</th><th scope="col">{t("Period")}</th><th scope="col" className="admin-num">{t("Net amount")}</th><th scope="col" className="admin-num">{t("Distributed")}</th><th scope="col" className="admin-num">{t("Holders")}</th><th scope="col">{t("Note")}</th></tr></thead>
        <tbody>{rows.map((row) => <tr key={row.id}>
          <td data-label={t("Date")} className="whitespace-nowrap">{new Date(row.created_at).toLocaleDateString(lang)}</td>
          <td data-label={t("Property")}><span className="admin-cell-main">{titleOf(row.property_slug)}</span></td>
          <td data-label={t("Period")} className="whitespace-nowrap">{day(row.period_start)} – {day(row.period_end)}</td>
          <td data-label={t("Net amount")} className="admin-num">{euro(row.net_amount)}</td>
          <td data-label={t("Distributed")} className="admin-num font-semibold">{euro(row.distributed_amount)}</td>
          <td data-label={t("Holders")} className="admin-num">{row.holder_count}</td>
          <td data-label={t("Note")} className="max-w-xs text-[var(--admin-muted)]">{row.note || "—"}</td>
        </tr>)}</tbody>
      </table>}
    </AdminCard>
  </main>;
}
