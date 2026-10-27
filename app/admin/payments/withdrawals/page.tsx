import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { isAdminUser } from "@/app/lib/admin";
import { hasAdminSession } from "@/app/lib/admin-session";
import { getCurrentLocale } from "@/app/lib/server-locale";
import { getAdminText } from "@/app/lib/admin-copy";
import { localeHtmlLang } from "@/app/lib/i18n";
import { maskIban } from "@/app/lib/client-finance";
import { AdminAlert, AdminCard, AdminEmpty, AdminPageHeader, AdminStat, StatusBadge } from "../../ui";
import DecisionForm from "../../DecisionForm";
import { getClientDirectory } from "../../client-directory";
import { reviewWithdrawal } from "./actions";

type Withdrawal = { id: string; user_id: string; amount: number; account_holder: string; iban: string; bic: string | null; status: string; payout_reference: string | null; review_note: string | null; reviewed_at: string | null; created_at: string };

export default async function AdminWithdrawalsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const client = await createClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) redirect("/sign-in");
  if (!isAdminUser(user)) redirect("/dashboard");
  if (!(await hasAdminSession(client, user))) redirect("/admin/security");
  const locale = await getCurrentLocale(), t = getAdminText(locale), lang = localeHtmlLang[locale];
  const showAll = (await searchParams).status === "all";
  let query = client.from("withdrawal_requests").select("id,user_id,amount,account_holder,iban,bic,status,payout_reference,review_note,reviewed_at,created_at").order("status").order("created_at", { ascending: false }).limit(200);
  if (!showAll) query = query.eq("status", "pending");
  const [{ data, error }, directory, { data: pendingRows }] = await Promise.all([
    query, getClientDirectory(), client.from("withdrawal_requests").select("amount").eq("status", "pending"),
  ]);
  const rows = (data || []) as Withdrawal[];
  const euro = (value: number) => Number(value).toLocaleString(lang, { style: "currency", currency: "EUR" });
  const reserved = (pendingRows || []).reduce((sum, row) => sum + Number(row.amount), 0);
  const statusLabel = (status: string) => t(status === "paid" ? "Paid" : status === "rejected" ? "Rejected" : "Pending");
  return <main className="admin-workspace">
    <AdminPageHeader back={{ href: "/admin/payments", label: t("Payment methods") }} eyebrow={t("Operations")} title={t("Withdrawals")} description={t("Pay client withdrawals by bank transfer, then confirm them here with the bank reference. Rejected requests return the amount to the client's wallet.")} />
    {error && <AdminAlert tone="danger">{t("Withdrawals could not be loaded.")}</AdminAlert>}
    <section className="admin-stats" aria-label={t("Key figures")}>
      <AdminStat label={t("Waiting for review")} value={(pendingRows || []).length} attention={(pendingRows || []).length > 0} />
      <AdminStat label={t("Reserved for withdrawals")} value={euro(reserved)} />
    </section>
    <nav className="admin-segmented mb-5" aria-label={t("Withdrawals")}>
      <Link href="/admin/payments/withdrawals" aria-current={!showAll ? "page" : undefined}>{t("Pending")}</Link>
      <Link href="/admin/payments/withdrawals?status=all" aria-current={showAll ? "page" : undefined}>{t("All")}</Link>
    </nav>
    <AdminCard title={t("Withdrawals")} flush>
      {!rows.length ? <AdminEmpty>{t("No withdrawals to review.")}</AdminEmpty> : <div className="admin-list">
        <div className="admin-list-head" aria-hidden="true"><span>{t("Date")}</span><span>{t("Client")}</span><span>{t("Account holder")}</span><span>{t("IBAN")}</span><span className="admin-num">{t("Amount")}</span><span>{t("Status")}</span><span /></div>
        {rows.map((row) => {
          const person = directory.get(row.user_id);
          return <details key={row.id} className="admin-list-row" open={row.status === "pending"}>
            <summary>
              <span className="admin-list-date">{new Date(row.created_at).toLocaleDateString(lang)}</span>
              <span className="admin-list-primary"><span className="admin-cell-main">{person?.name || row.user_id.slice(0, 8)}</span><span className="admin-cell-sub">{person?.email}</span></span>
              <span className="admin-list-secondary"><span className="admin-cell-main">{row.account_holder}</span></span>
              <span className="admin-list-meta font-mono text-[12px]">{maskIban(row.iban)}</span>
              <span className="admin-list-amount">{euro(row.amount)}</span>
              <span className="admin-list-status"><StatusBadge status={row.status} label={statusLabel(row.status)} /></span>
              <ChevronDown size={16} aria-hidden="true" className="admin-disclosure-icon" />
            </summary>
            <div className="admin-list-detail">
              <dl className="admin-facts">
                <div><dt>{t("Account holder")}</dt><dd>{row.account_holder}</dd></div>
                <div><dt>{t("IBAN")}</dt><dd className="break-all font-mono text-[12px]">{row.iban.replace(/(.{4})/g, "$1 ").trim()}</dd></div>
                <div><dt>{t("BIC")}</dt><dd className="font-mono text-[12px]">{row.bic || "—"}</dd></div>
                <div><dt>{t("Amount")}</dt><dd className="font-semibold">{euro(row.amount)}</dd></div>
                <div className="admin-facts-wide"><dt>ID</dt><dd className="break-all text-[12px]">{row.id}</dd></div>
              </dl>
              {row.status === "pending"
                ? <DecisionForm action={reviewWithdrawal} hidden={{ id: row.id }} noteLabel={t("Review note")} savedLabel={t("Review saved.")} errorLabel={t("The review could not be saved. Please try again.")}
                    extraField={{ name: "reference", label: t("Payout reference") }}
                    decisions={[{ value: "paid", label: t("Mark as paid"), tone: "success" }, { value: "rejected", label: t("Reject"), tone: "danger" }]} />
                : <p className="admin-note">{row.payout_reference && <span className="block font-semibold">{t("Payout reference")}: {row.payout_reference}</span>}{row.review_note}{row.reviewed_at && <span className="block text-[12px] opacity-80">{new Date(row.reviewed_at).toLocaleString(lang)}</span>}</p>}
            </div>
          </details>;
        })}
      </div>}
    </AdminCard>
  </main>;
}
