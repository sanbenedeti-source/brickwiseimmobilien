import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdminUser } from "@/app/lib/admin";
import { hasAdminSession } from "@/app/lib/admin-session";
import { getCurrentLocale } from "@/app/lib/server-locale";
import { getAdminText } from "@/app/lib/admin-copy";
import { localeHtmlLang } from "@/app/lib/i18n";
import { depositText } from "@/app/funding/deposit-copy";
import type { Deposit } from "@/app/funding/deposit-store";
import { AdminAlert, AdminCard, AdminEmpty, AdminPageHeader, AdminStat, StatusBadge } from "../ui";
import DecisionForm from "../DecisionForm";
import ReviewForm from "../payments/deposits/ReviewForm";
import { getClientDirectory } from "../client-directory";
import { reviewWithdrawal } from "../payments/withdrawals/actions";

type Withdrawal = { id: string; user_id: string; amount: number; account_holder: string; iban: string; bic: string | null; status: string; payout_reference: string | null; review_note: string | null; reviewed_at: string | null; created_at: string };
type Reviewed = { id: string; user_id: string; status: string; reviewed_at: string | null; created_at: string };

const depositColumns = "id,user_id,customer_email,customer_name,destination,requested_eur,crypto_quantity,transfer_reference,status,credited_eur,review_note,created_at";

/** Every payment a client starts, in one place: deposits are confirmed here (crediting the wallet)
 * and withdrawals are marked as paid once the bank transfer has gone out. */
export default async function AdminWalletPage() {
  const client = await createClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) redirect("/sign-in");
  if (!isAdminUser(user)) redirect("/dashboard");
  if (!(await hasAdminSession(client, user))) redirect("/admin/security");
  const locale = await getCurrentLocale(), t = getAdminText(locale), d = depositText(locale), lang = localeHtmlLang[locale];

  const [deposits, withdrawals, gateway, depositHistory, withdrawalHistory, directory] = await Promise.all([
    client.from("deposit_submissions").select(depositColumns).eq("status", "pending").order("created_at", { ascending: false }).limit(100),
    client.from("withdrawal_requests").select("id,user_id,amount,account_holder,iban,bic,status,payout_reference,review_note,reviewed_at,created_at").eq("status", "pending").order("created_at", { ascending: false }).limit(100),
    client.from("gateway_deposits").select("id", { count: "exact", head: true }).eq("status", "review"),
    client.from("deposit_submissions").select("id,user_id,status,reviewed_at,created_at,credited_eur,requested_eur").neq("status", "pending").order("reviewed_at", { ascending: false }).limit(15),
    client.from("withdrawal_requests").select("id,user_id,status,reviewed_at,created_at,amount").neq("status", "pending").order("reviewed_at", { ascending: false }).limit(15),
    getClientDirectory(),
  ]);
  const pendingDeposits = (deposits.data || []) as Deposit[];
  const pendingWithdrawals = (withdrawals.data || []) as Withdrawal[];
  const loadError = [deposits, withdrawals, depositHistory, withdrawalHistory].some((result) => result.error);
  const euro = (value: number | null) => Number(value || 0).toLocaleString(lang, { style: "currency", currency: "EUR" });
  const when = (value: string) => new Date(value).toLocaleString(lang, { dateStyle: "medium", timeStyle: "short" });
  const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);
  const person = (id: string) => directory.get(id);
  const clientLink = (id: string, fallback?: string | null) => <Link href={`/admin/customers/${id}`} className="admin-link">{person(id)?.name || fallback || id.slice(0, 8)}</Link>;

  // Newest decisions first, deposits and withdrawals together.
  const history = [
    ...((depositHistory.data || []) as (Reviewed & { credited_eur: number | null; requested_eur: number })[]).map((row) => ({
      key: `d-${row.id}`, userId: row.user_id, kind: t("Deposit"), at: row.reviewed_at || row.created_at,
      amount: row.status === "verified" ? Number(row.credited_eur) : Number(row.requested_eur), status: row.status, label: d(row.status === "verified" ? "verified" : "rejected"),
    })),
    ...((withdrawalHistory.data || []) as (Reviewed & { amount: number })[]).map((row) => ({
      key: `w-${row.id}`, userId: row.user_id, kind: t("Withdrawal"), at: row.reviewed_at || row.created_at,
      amount: Number(row.amount), status: row.status, label: t(row.status === "paid" ? "Paid" : "Rejected"),
    })),
  ].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 20);

  return <main className="admin-workspace">
    <AdminPageHeader eyebrow={t("Operations")} title={t("Wallet notifications")}
      description={t("Every payment a client starts appears here. Check that a deposit has arrived, then confirm it to credit the client's wallet. Pay a withdrawal by bank transfer, then confirm it with the bank reference.")} />
    {loadError && <AdminAlert tone="danger">{d("loadError")}</AdminAlert>}
    <section className="admin-stats" aria-label={t("Key figures")}>
      <AdminStat label={t("Deposits to verify")} value={pendingDeposits.length} hint={euro(sum(pendingDeposits.map((row) => Number(row.requested_eur))))} attention={pendingDeposits.length > 0} />
      <AdminStat label={t("Withdrawals to pay")} value={pendingWithdrawals.length} hint={euro(sum(pendingWithdrawals.map((row) => Number(row.amount))))} attention={pendingWithdrawals.length > 0} />
    </section>
    {(gateway.count || 0) > 0 && <AdminAlert tone="warning">{t("Crypto payments under review need a decision on the Deposits page.")} <Link href="/admin/payments/deposits" className="admin-link">{t("Deposits")}</Link></AdminAlert>}

    <AdminCard id="deposits" title={t("Deposits to verify")} actions={<Link href="/admin/payments/deposits" className="admin-btn admin-btn-secondary admin-btn-sm">{t("All")}</Link>} flush>
      {!pendingDeposits.length ? <AdminEmpty>{t("No deposits waiting.")}</AdminEmpty> : <div className="admin-list">
        {pendingDeposits.map((row) => <details key={row.id} id={`deposit-${row.id}`} className="admin-list-row" open>
          <summary>
            <span className="admin-list-date">{new Date(row.created_at).toLocaleDateString(lang)}</span>
            <span className="admin-list-primary"><span className="admin-cell-main">{row.customer_name || person(row.user_id)?.name || row.customer_email}</span><span className="admin-cell-sub">{row.customer_email}</span></span>
            <span className="admin-list-secondary"><span className="admin-cell-main">{row.destination.label}</span><span className="admin-cell-sub">{row.destination.kind === "crypto" ? `${row.destination.crypto_asset} · ${row.destination.crypto_network}` : t("Bank transfer")}</span></span>
            <span className="admin-list-meta font-mono text-[12px]">{row.transfer_reference}</span>
            <span className="admin-list-amount">{euro(row.requested_eur)}</span>
            <span className="admin-list-status"><StatusBadge status="pending" label={d("pending")} /></span>
          </summary>
          <div className="admin-list-detail">
            <p className="admin-help">{t("Client")}: {clientLink(row.user_id, row.customer_name)} · {d("reference")}: <strong className="break-all">{row.transfer_reference}</strong> · {when(row.created_at)}</p>
            <ReviewForm deposit={row} locale={locale} />
          </div>
        </details>)}
      </div>}
    </AdminCard>

    <AdminCard id="withdrawals" title={t("Withdrawals to pay")} actions={<Link href="/admin/payments/withdrawals?status=all" className="admin-btn admin-btn-secondary admin-btn-sm">{t("All")}</Link>} flush>
      {!pendingWithdrawals.length ? <AdminEmpty>{t("No withdrawals to review.")}</AdminEmpty> : <div className="admin-list">
        {pendingWithdrawals.map((row) => <details key={row.id} id={`withdrawal-${row.id}`} className="admin-list-row" open>
          <summary>
            <span className="admin-list-date">{new Date(row.created_at).toLocaleDateString(lang)}</span>
            <span className="admin-list-primary"><span className="admin-cell-main">{person(row.user_id)?.name || row.user_id.slice(0, 8)}</span><span className="admin-cell-sub">{person(row.user_id)?.email}</span></span>
            <span className="admin-list-secondary"><span className="admin-cell-main">{row.account_holder}</span></span>
            <span className="admin-list-meta" />
            <span className="admin-list-amount">{euro(row.amount)}</span>
            <span className="admin-list-status"><StatusBadge status="pending" label={t("Pending")} /></span>
          </summary>
          <div className="admin-list-detail">
            <dl className="admin-facts">
              <div><dt>{t("Client")}</dt><dd>{clientLink(row.user_id)}</dd></div>
              <div><dt>{t("Account holder")}</dt><dd>{row.account_holder}</dd></div>
              <div><dt>{t("IBAN")}</dt><dd className="break-all font-mono text-[12px]">{row.iban.replace(/(.{4})/g, "$1 ").trim()}</dd></div>
              <div><dt>{t("BIC")}</dt><dd className="font-mono text-[12px]">{row.bic || "—"}</dd></div>
            </dl>
            <DecisionForm action={reviewWithdrawal} hidden={{ id: row.id }} noteLabel={t("Review note")} savedLabel={t("Review saved.")} errorLabel={t("The review could not be saved. Please try again.")}
              extraField={{ name: "reference", label: t("Payout reference") }}
              decisions={[{ value: "paid", label: t("Mark as paid"), tone: "success" }, { value: "rejected", label: t("Reject"), tone: "danger" }]} />
          </div>
        </details>)}
      </div>}
    </AdminCard>

    <AdminCard title={t("Recent wallet activity")} flush>
      {!history.length ? <AdminEmpty>{t("No wallet activity yet.")}</AdminEmpty> : <table className="admin-table admin-table-stack">
        <thead><tr><th scope="col">{t("Date")}</th><th scope="col">{t("Client")}</th><th scope="col">{t("Type")}</th><th scope="col" className="admin-num">{t("Amount")}</th><th scope="col">{t("Status")}</th></tr></thead>
        <tbody>{history.map((row) => <tr key={row.key}>
          <td data-label={t("Date")} className="whitespace-nowrap">{when(row.at)}</td>
          <td data-label={t("Client")}>{clientLink(row.userId)}</td>
          <td data-label={t("Type")}>{row.kind}</td>
          <td data-label={t("Amount")} className="admin-num font-semibold">{euro(row.amount)}</td>
          <td data-label={t("Status")}><StatusBadge status={row.status} label={row.label} /></td>
        </tr>)}</tbody>
      </table>}
    </AdminCard>
  </main>;
}
