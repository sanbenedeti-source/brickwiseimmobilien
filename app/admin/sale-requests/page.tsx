import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { isAdminUser } from "@/app/lib/admin";
import { hasAdminSession } from "@/app/lib/admin-session";
import { getCurrentLocale } from "@/app/lib/server-locale";
import { getAdminText } from "@/app/lib/admin-copy";
import { localeHtmlLang } from "@/app/lib/i18n";
import { getAllProperties } from "@/app/lib/property-registry";
import { getPropertyTranslations, localizeProperty } from "@/app/lib/property-localization";
import { AdminAlert, AdminCard, AdminEmpty, AdminPageHeader, AdminStat, StatusBadge } from "../ui";
import DecisionForm from "../DecisionForm";
import { getClientDirectory } from "../client-directory";
import { updateSaleRequest } from "./actions";

type SaleRequest = { id: string; user_id: string; property_slug: string; shares: number; note: string | null; status: string; admin_note: string | null; updated_at: string | null; created_at: string };

export default async function AdminSaleRequestsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const client = await createClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) redirect("/sign-in");
  if (!isAdminUser(user)) redirect("/dashboard");
  if (!(await hasAdminSession(client, user))) redirect("/admin/security");
  const locale = await getCurrentLocale(), t = getAdminText(locale), lang = localeHtmlLang[locale];
  const showAll = (await searchParams).status === "all";
  let query = client.from("share_sale_requests").select("id,user_id,property_slug,shares,note,status,admin_note,updated_at,created_at").order("created_at", { ascending: false }).limit(200);
  if (!showAll) query = query.in("status", ["pending", "in_review"]);
  const [{ data, error }, directory, { data: openRows }, translations, catalog] = await Promise.all([
    query, getClientDirectory(), client.from("share_sale_requests").select("shares").in("status", ["pending", "in_review"]), getPropertyTranslations(locale), getAllProperties(),
  ]);
  const rows = (data || []) as SaleRequest[];
  const titleOf = (slug: string) => { const property = catalog.find((item) => item.slug === slug); return property ? localizeProperty(property, translations).title : slug; };
  const statusLabel = (status: string) => t(status === "in_review" ? "In review" : status === "completed" ? "Completed" : status === "cancelled" ? "Cancelled" : "Pending");
  const openShares = (openRows || []).reduce((sum, row) => sum + Number(row.shares), 0);
  return <main className="admin-workspace">
    <AdminPageHeader eyebrow={t("Operations")} title={t("Sale requests")} description={t("Clients who want to sell shares. Agree timing and price with the client, then record the outcome here.")} />
    {error && <AdminAlert tone="danger">{t("Sale requests could not be loaded.")}</AdminAlert>}
    <section className="admin-stats" aria-label={t("Key figures")}>
      <AdminStat label={t("Open requests")} value={(openRows || []).length} attention={(openRows || []).length > 0} />
      <AdminStat label={t("Shares")} value={openShares.toLocaleString(lang)} />
    </section>
    <nav className="admin-segmented mb-5" aria-label={t("Sale requests")}>
      <Link href="/admin/sale-requests" aria-current={!showAll ? "page" : undefined}>{t("Open requests")}</Link>
      <Link href="/admin/sale-requests?status=all" aria-current={showAll ? "page" : undefined}>{t("All")}</Link>
    </nav>
    <AdminCard title={t("Sale requests")} flush>
      {!rows.length ? <AdminEmpty>{t("No sale requests.")}</AdminEmpty> : <div className="admin-list">
        <div className="admin-list-head" aria-hidden="true"><span>{t("Date")}</span><span>{t("Client")}</span><span>{t("Property")}</span><span /><span className="admin-num">{t("Shares")}</span><span>{t("Status")}</span><span /></div>
        {rows.map((row) => {
          const person = directory.get(row.user_id);
          const open = row.status === "pending" || row.status === "in_review";
          return <details key={row.id} className="admin-list-row" open={row.status === "pending"}>
            <summary>
              <span className="admin-list-date">{new Date(row.created_at).toLocaleDateString(lang)}</span>
              <span className="admin-list-primary"><span className="admin-cell-main">{person?.name || row.user_id.slice(0, 8)}</span><span className="admin-cell-sub">{person?.email}</span></span>
              <span className="admin-list-secondary"><span className="admin-cell-main">{titleOf(row.property_slug)}</span></span>
              <span className="admin-list-meta" />
              <span className="admin-list-amount">{row.shares.toLocaleString(lang)}</span>
              <span className="admin-list-status"><StatusBadge status={row.status} label={statusLabel(row.status)} /></span>
              <ChevronDown size={16} aria-hidden="true" className="admin-disclosure-icon" />
            </summary>
            <div className="admin-list-detail">
              <dl className="admin-facts">
                <div><dt>{t("Property")}</dt><dd>{titleOf(row.property_slug)}</dd></div>
                <div><dt>{t("Shares")}</dt><dd className="font-semibold">{row.shares.toLocaleString(lang)}</dd></div>
                <div className="admin-facts-wide"><dt>{t("Client message")}</dt><dd className="whitespace-pre-line">{row.note || "—"}</dd></div>
              </dl>
              {row.admin_note && <p className="admin-note">{row.admin_note}{row.updated_at && <span className="block text-[12px] opacity-80">{new Date(row.updated_at).toLocaleString(lang)}</span>}</p>}
              {open && <DecisionForm action={updateSaleRequest} hidden={{ id: row.id }} noteLabel={t("Review note")} savedLabel={t("Review saved.")} errorLabel={t("The review could not be saved. Please try again.")}
                decisions={[
                  ...(row.status === "pending" ? [{ value: "in_review", label: t("Mark in review"), tone: "neutral" as const }] : []),
                  { value: "completed", label: t("Mark completed"), tone: "success" as const },
                  { value: "cancelled", label: t("Cancel request"), tone: "danger" as const },
                ]} />}
            </div>
          </details>;
        })}
      </div>}
    </AdminCard>
  </main>;
}
