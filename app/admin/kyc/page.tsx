import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronDown, ExternalLink } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { isAdminUser } from "@/app/lib/admin";
import { hasAdminSession } from "@/app/lib/admin-session";
import { getCurrentLocale } from "@/app/lib/server-locale";
import { getAdminText } from "@/app/lib/admin-copy";
import { localeHtmlLang } from "@/app/lib/i18n";
import { AdminAlert, AdminCard, AdminEmpty, AdminPageHeader, AdminStat, StatusBadge } from "../ui";
import DecisionForm from "../DecisionForm";
import { getClientDirectory } from "../client-directory";
import { reviewKyc } from "./actions";

type Submission = { id: string; user_id: string; document_type: string; status: string; created_at: string; reviewed_at: string | null; review_note: string | null };

export default async function AdminKycPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const client = await createClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) redirect("/sign-in");
  if (!isAdminUser(user)) redirect("/dashboard");
  if (!(await hasAdminSession(client, user))) redirect("/admin/security");
  const locale = await getCurrentLocale(), t = getAdminText(locale), lang = localeHtmlLang[locale];
  const showAll = (await searchParams).status === "all";
  let query = client.from("client_kyc_submissions").select("id,user_id,document_type,status,created_at,reviewed_at,review_note").order("status", { ascending: false }).order("created_at", { ascending: false }).limit(200);
  if (!showAll) query = query.eq("status", "pending");
  const [{ data, error }, directory, { count: approved }] = await Promise.all([
    query, getClientDirectory(),
    client.from("client_kyc_submissions").select("id", { count: "exact", head: true }).eq("status", "approved"),
  ]);
  const rows = (data || []) as Submission[];
  const pending = rows.filter((row) => row.status === "pending").length;
  const documentLabel = (type: string) => t(type === "passport" ? "Passport" : type === "id_card" ? "Identity card" : "Driving licence");
  const statusLabel = (status: string) => t(status === "approved" ? "Approved" : status === "rejected" ? "Rejected" : "Pending");
  return <main className="admin-workspace">
    <AdminPageHeader eyebrow={t("Operations")} title={t("Identity verification")} description={t("Check each client's identity document and proof of address before approving withdrawals and larger investments.")} />
    {error && <AdminAlert tone="danger">{t("Identity submissions could not be loaded.")}</AdminAlert>}
    <section className="admin-stats" aria-label={t("Key figures")}>
      <AdminStat label={t("Waiting for review")} value={showAll ? rows.filter((row) => row.status === "pending").length : pending} attention={pending > 0} />
      <AdminStat label={t("Verified clients")} value={approved || 0} />
    </section>
    <nav className="admin-segmented mb-5" aria-label={t("Identity verification")}>
      <Link href="/admin/kyc" aria-current={!showAll ? "page" : undefined}>{t("Pending")}</Link>
      <Link href="/admin/kyc?status=all" aria-current={showAll ? "page" : undefined}>{t("All")}</Link>
    </nav>
    <AdminCard title={t("Identity verification")} flush>
      {!rows.length ? <AdminEmpty>{t("No identity submissions to review.")}</AdminEmpty> : <div className="admin-list admin-list-compact">
        <div className="admin-list-head" aria-hidden="true"><span>{t("Date")}</span><span>{t("Client")}</span><span>{t("Document type")}</span><span>{t("Status")}</span><span /></div>
        {rows.map((row) => {
          const person = directory.get(row.user_id);
          return <details key={row.id} className="admin-list-row" open={row.status === "pending"}>
            <summary>
              <span className="admin-list-date">{new Date(row.created_at).toLocaleDateString(lang)}</span>
              <span className="admin-list-primary"><span className="admin-cell-main">{person?.name || row.user_id.slice(0, 8)}</span><span className="admin-cell-sub">{person?.email}</span></span>
              <span className="admin-list-secondary"><span className="admin-cell-main">{documentLabel(row.document_type)}</span></span>
              <span className="admin-list-status"><StatusBadge status={row.status} label={statusLabel(row.status)} /></span>
              <ChevronDown size={16} aria-hidden="true" className="admin-disclosure-icon" />
            </summary>
            <div className="admin-list-detail">
              <div className="admin-actions">
                <a href={`/api/kyc/${row.id}/identity`} target="_blank" rel="noreferrer" className="admin-btn admin-btn-secondary admin-btn-sm"><ExternalLink size={14} aria-hidden="true" />{t("Identity document")}</a>
                <a href={`/api/kyc/${row.id}/address`} target="_blank" rel="noreferrer" className="admin-btn admin-btn-secondary admin-btn-sm"><ExternalLink size={14} aria-hidden="true" />{t("Proof of address")}</a>
              </div>
              {row.status === "pending"
                ? <DecisionForm action={reviewKyc} hidden={{ id: row.id }} noteLabel={t("Review note")} savedLabel={t("Review saved.")} errorLabel={t("The review could not be saved. Please try again.")}
                    decisions={[{ value: "approved", label: t("Approve"), tone: "success" }, { value: "rejected", label: t("Reject"), tone: "danger" }]} />
                : <p className="admin-note">{row.review_note}{row.reviewed_at && <span className="block text-[12px] opacity-80">{new Date(row.reviewed_at).toLocaleString(lang)}</span>}</p>}
            </div>
          </details>;
        })}
      </div>}
    </AdminCard>
  </main>;
}
