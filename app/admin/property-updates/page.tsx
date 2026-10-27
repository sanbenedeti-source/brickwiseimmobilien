import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdminUser } from "@/app/lib/admin";
import { hasAdminSession } from "@/app/lib/admin-session";
import { getCurrentLocale } from "@/app/lib/server-locale";
import { getAdminText } from "@/app/lib/admin-copy";
import { localeHtmlLang } from "@/app/lib/i18n";
import { getAllProperties } from "@/app/lib/property-registry";
import { getPropertyTranslations, localizeProperty } from "@/app/lib/property-localization";
import { AdminAlert, AdminCard, AdminEmpty, AdminPageHeader } from "../ui";
import PublishUpdateForm from "./PublishUpdateForm";

type PropertyUpdate = { id: string; property_slug: string; title: string; body: string; created_at: string };

export default async function AdminPropertyUpdatesPage() {
  const client = await createClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) redirect("/sign-in");
  if (!isAdminUser(user)) redirect("/dashboard");
  if (!(await hasAdminSession(client, user))) redirect("/admin/security");
  const locale = await getCurrentLocale(), t = getAdminText(locale), lang = localeHtmlLang[locale];
  const [{ data, error }, translations, catalog] = await Promise.all([
    client.from("property_updates").select("id,property_slug,title,body,created_at").order("created_at", { ascending: false }).limit(50),
    getPropertyTranslations(locale),
    getAllProperties(),
  ]);
  const rows = (data || []) as PropertyUpdate[];
  const titleOf = (slug: string) => { const property = catalog.find((item) => item.slug === slug); return property ? localizeProperty(property, translations).title : slug; };
  const properties = catalog.map((property) => ({ slug: property.slug, title: titleOf(property.slug) }));
  return <main className="admin-workspace">
    <AdminPageHeader eyebrow={t("Portfolio")} title={t("Property updates")} description={t("Publish news for the clients who hold shares in a property. They are notified in their panel.")} />
    <AdminCard title={t("Publish update")}>
      <PublishUpdateForm properties={properties} labels={{ property: t("Property"), title: t("Title"), body: t("Message"), submit: t("Publish update"), saved: t("Update published."), error: t("The update could not be published.") }} />
    </AdminCard>
    {error && <AdminAlert tone="danger">{t("Property updates could not be loaded.")}</AdminAlert>}
    <AdminCard title={t("Recent updates")} flush>
      {!rows.length ? <AdminEmpty>{t("No updates yet.")}</AdminEmpty> : <ul className="divide-y divide-[var(--admin-border-soft)]">
        {rows.map((row) => <li key={row.id} className="px-5 py-4">
          <p className="text-[12px] text-[var(--admin-muted)]">{new Date(row.created_at).toLocaleString(lang, { dateStyle: "medium", timeStyle: "short" })} · {titleOf(row.property_slug)}</p>
          <p className="mt-1 font-semibold">{row.title}</p>
          <p className="mt-1 whitespace-pre-line text-[13px] leading-6 text-[var(--admin-muted)]">{row.body}</p>
        </li>)}
      </ul>}
    </AdminCard>
  </main>;
}
