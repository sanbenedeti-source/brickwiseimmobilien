import { notFound, redirect } from "next/navigation";
import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { isAdminUser } from "@/app/lib/admin";
import { hasAdminSession } from "@/app/lib/admin-session";
import { getCurrentLocale } from "@/app/lib/server-locale";
import { getAdminText } from "@/app/lib/admin-copy";
import { localeHtmlLang } from "@/app/lib/i18n";
import { portalCopy } from "@/app/lib/portal-copy";
import { getAllProperties } from "@/app/lib/property-registry";
import { getPropertyShareSupply, getPropertyTargetReturn } from "@/app/lib/property-financials";
import { getPropertyTranslations, localizeProperty } from "@/app/lib/property-localization";
import { buildStatement, type LedgerRow } from "@/app/lib/client-finance";
import { dailyIncome } from "@/app/dashboard/daily-income-model";
import { AdminAlert, AdminCard, AdminEmpty, AdminPageHeader, AdminStat, StatusBadge } from "../../ui";
import WalletCreditForm from "../../payments/WalletCreditForm";
import ProfitPayoutForm from "./ProfitPayoutForm";

// Read once per request, like the client income page.
async function snapshotTime() { return Date.now(); }

const uuid = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;

/** One client's holdings, modelled income, real earnings and every wallet movement. Holdings and
 * the wallet ledger are private to their owner, so they are read with the service role, and only
 * after the two-factor admin session check. */
export default async function AdminCustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!uuid.test(id)) notFound();
  const client = await createClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) redirect("/sign-in");
  if (!isAdminUser(user)) redirect("/dashboard");
  if (!(await hasAdminSession(client, user))) redirect("/admin/security");
  const locale = await getCurrentLocale(), t = getAdminText(locale), lang = localeHtmlLang[locale], text = portalCopy[locale];
  const service = createServiceClient();
  const { data: { user: customer } } = await service.auth.admin.getUserById(id);
  if (!customer || isAdminUser(customer)) notFound();

  const [wallet, holdings, ledger, payouts, withdrawals, kyc, agentRow, settings, translations] = await Promise.all([
    service.from("wallet_accounts").select("balance").eq("user_id", id).maybeSingle(),
    service.from("property_holdings").select("property_slug,shares,invested_amount,first_purchased_at").eq("user_id", id),
    service.from("wallet_transactions").select("id,type,direction,amount,property_slug,shares,reference_type,idempotency_key,created_at,currency").eq("user_id", id).order("created_at").order("id").limit(5000),
    service.from("distribution_payouts").select("amount,shares,property_distributions(property_slug,period_start,period_end,created_at)").eq("user_id", id),
    service.from("withdrawal_requests").select("amount,status").eq("user_id", id),
    service.from("client_kyc_submissions").select("status").eq("user_id", id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    service.from("client_agents").select("agents(code,full_name)").eq("user_id", id).maybeSingle(),
    service.from("property_share_settings").select("property_slug,total_shares,profit_active,profit_start_date"),
    getPropertyTranslations(locale),
  ]);
  const catalog = await getAllProperties();
  const loadError = [wallet, holdings, ledger, payouts, withdrawals].some((result) => result.error);
  const titleOf = (slug: string | null) => { if (!slug) return "—"; const property = catalog.find((item) => item.slug === slug); return property ? localizeProperty(property, translations).title : slug; };
  const euro = (value: number) => value.toLocaleString(lang, { style: "currency", currency: "EUR" });
  const date = (value: string) => new Date(value).toLocaleDateString(lang, { dateStyle: "medium" });
  const now = await snapshotTime();

  const ledgerRows = ((ledger.data || []) as (LedgerRow & { currency: string })[]).map((row) => ({ ...row, amount: Number(row.amount), shares: row.shares === null ? null : Number(row.shares) }));
  const purchases = ledgerRows.filter((row) => row.type === "purchase" && row.direction === "debit" && row.property_slug)
    .map((row) => ({ property_slug: row.property_slug!, shares: Number(row.shares), amount: row.amount, currency: row.currency || "EUR", created_at: row.created_at }));
  const settingBySlug = new Map((settings.data || []).map((row) => [row.property_slug, row]));
  // The same projection the client sees in their panel.
  const positions = (holdings.data || []).map((holding) => {
    const property = catalog.find((item) => item.slug === holding.property_slug);
    const setting = settingBySlug.get(holding.property_slug);
    const rate = property ? getPropertyTargetReturn(property) : 0;
    const model = property ? dailyIncome({
      slug: holding.property_slug, title: "", shares: Number(holding.shares), rentalRate: rate,
      paused: setting?.profit_active === false, accrualStart: setting?.profit_start_date ? Date.parse(`${setting.profit_start_date}T00:00:00Z`) : null,
    }, purchases, now) : null;
    const total = property ? getPropertyShareSupply(property, { total_shares: setting?.total_shares ?? undefined }).total : 0;
    return { slug: holding.property_slug, shares: Number(holding.shares), invested: Number(holding.invested_amount), rate, model, paused: setting?.profit_active === false, ownership: total > 0 ? Number(holding.shares) / total : null };
  });
  const invested = positions.reduce((sum, row) => sum + row.invested, 0);
  const modelled = positions.reduce((sum, row) => sum + (row.model?.accrued || 0), 0);
  const modelledDaily = positions.reduce((sum, row) => sum + (row.model?.paused ? 0 : row.model?.daily || 0), 0);
  type Payout = { amount: number; shares: number; property_distributions: { property_slug: string; period_start: string; period_end: string; created_at: string } | { property_slug: string; period_start: string; period_end: string; created_at: string }[] | null };
  const distributions = ((payouts.data || []) as unknown as Payout[]).flatMap((row) => {
    const info = Array.isArray(row.property_distributions) ? row.property_distributions[0] : row.property_distributions;
    return info ? [{ ...info, amount: Number(row.amount), shares: Number(row.shares) }] : [];
  }).sort((a, b) => b.created_at.localeCompare(a.created_at));
  const profitsPaid = ledgerRows.filter((row) => row.reference_type === "profit_payout").reduce((sum, row) => sum + row.amount, 0);
  const received = distributions.reduce((sum, row) => sum + row.amount, 0) + profitsPaid;
  const withdrawn = (withdrawals.data || []).filter((row) => row.status === "paid").reduce((sum, row) => sum + Number(row.amount), 0);
  const statement = buildStatement(ledgerRows, "all", "all");
  const agentEmbed = (agentRow.data as { agents?: { code: string; full_name: string } | { code: string; full_name: string }[] | null } | null)?.agents;
  const agent = Array.isArray(agentEmbed) ? agentEmbed[0] : agentEmbed;
  const name = String(customer.user_metadata?.full_name || "").trim() || customer.email?.split("@")[0] || "—";
  const kycStatus = kyc.data?.status as string | undefined;
  const percent = (value: number) => value.toLocaleString(lang, { style: "percent", minimumFractionDigits: 2, maximumFractionDigits: 3 });

  return <main className="admin-workspace">
    <AdminPageHeader back={{ href: "/admin#customers", label: t("Customers") }} eyebrow={t("Customer")} title={name}
      description={[customer.email, customer.user_metadata?.phone ? String(customer.user_metadata.phone) : null, `${t("Registered")} ${date(customer.created_at)}`].filter(Boolean).join(" · ")}
      actions={<a href={`mailto:${customer.email}`} className="admin-btn admin-btn-secondary">{t("Send email")}</a>} />
    {loadError && <AdminAlert tone="danger">{t("Customer data could not be loaded completely.")}</AdminAlert>}
    <section className="admin-stats" aria-label={t("Key figures")}>
      <AdminStat label={t("Wallet balance")} value={euro(Number(wallet.data?.balance || 0))} />
      <AdminStat label={t("Invested")} value={euro(invested)} hint={`${positions.reduce((sum, row) => sum + row.shares, 0).toLocaleString(lang)} ${text.shares}`} />
      <AdminStat label={t("Modelled income to date")} value={euro(modelled)} hint={`${euro(modelledDaily)} / ${t("day")} · ${t("estimate, not in the wallet")}`} />
      <AdminStat label={t("Earnings paid")} value={euro(received)} hint={`${t("Property profits")}: ${euro(profitsPaid)} · ${t("Withdrawn")}: ${euro(withdrawn)}`} />
    </section>
    <AdminCard title={t("Customer")}>
      <dl className="admin-facts">
        <div><dt>{t("Identity verification")}</dt><dd><StatusBadge status={kycStatus || "new"} label={kycStatus === "approved" ? t("Approved") : kycStatus === "rejected" ? t("Rejected") : kycStatus === "pending" ? t("Pending") : t("Not provided")} /></dd></div>
        <div><dt>{t("Agent")}</dt><dd>{agent ? <>{agent.full_name} <span className="font-mono text-[12px]">{agent.code}</span></> : t("No agent")}</dd></div>
        <div className="admin-facts-wide"><dt>ID</dt><dd className="break-all text-[12px]">{customer.id}</dd></div>
      </dl>
      <details className="admin-popover mt-4"><summary className="admin-link text-[13px]">{t("Credit wallet")}</summary><div><WalletCreditForm userId={customer.id} operationId={randomUUID()} locale={locale} /></div></details>
    </AdminCard>

    {positions.length > 0 && <AdminCard title={t("Pay property profit")} description={t("Credits the client's wallet with the profit of a property they hold, based on the property's actual income. The client is notified and sees it as property profit in their income and statement.")}>
      <ProfitPayoutForm userId={customer.id} requestKey={randomUUID()} holdings={positions.map((row) => ({ slug: row.slug, title: titleOf(row.slug), shares: row.shares }))} labels={{
        property: t("Property"), amount: t("Amount (EUR)"), note: t("Period or note (visible to the client)"), notePlaceholder: t("e.g. October 2026 rental income"),
        confirm: t("This credits the client's wallet immediately."), submit: t("Pay profit"), saved: t("Profit paid to the client's wallet."),
        error: t("The profit could not be paid. Please try again."), amountError: t("Enter an amount greater than 0 with at most two decimals."),
        holding: t("The client no longer holds shares in this property."), next: t("New payout"),
      }} />
    </AdminCard>}

    <AdminCard title={t("Holdings")} description={t("Modelled income uses the property's net rental yield and activation date, exactly as the client sees it. It is an estimate, not money in the wallet; real earnings are rental distributions and property profits.")} flush>
      {!positions.length ? <AdminEmpty>{t("No holdings yet.")}</AdminEmpty> : <table className="admin-table admin-table-stack">
        <thead><tr><th scope="col">{t("Property")}</th><th scope="col" className="admin-num">{t("Shares")}</th><th scope="col" className="admin-num">{t("Ownership")}</th><th scope="col" className="admin-num">{t("Invested")}</th><th scope="col" className="admin-num">{t("Net rental yield")}</th><th scope="col" className="admin-num">{t("Per day")}</th><th scope="col" className="admin-num">{t("Modelled income to date")}</th><th scope="col">{t("Status")}</th></tr></thead>
        <tbody>{positions.map((row) => <tr key={row.slug}>
          <td data-label={t("Property")}><span className="admin-cell-main">{titleOf(row.slug)}</span></td>
          <td data-label={t("Shares")} className="admin-num">{row.shares.toLocaleString(lang)}</td>
          <td data-label={t("Ownership")} className="admin-num">{row.ownership === null ? "—" : percent(row.ownership)}</td>
          <td data-label={t("Invested")} className="admin-num">{euro(row.invested)}</td>
          <td data-label={t("Net rental yield")} className="admin-num">{(row.rate / 100).toLocaleString(lang, { style: "percent", minimumFractionDigits: 2 })}</td>
          <td data-label={t("Per day")} className="admin-num">{row.model ? euro(row.paused ? 0 : row.model.daily) : "—"}</td>
          <td data-label={t("Modelled income to date")} className="admin-num font-semibold">{row.model ? euro(row.model.accrued) : "—"}</td>
          <td data-label={t("Status")}><StatusBadge status={row.paused ? "pending" : "active"} label={t(row.paused ? "Paused" : "Accruing")} /></td>
        </tr>)}</tbody>
      </table>}
    </AdminCard>

    <AdminCard title={t("Purchases")} flush>
      {!purchases.length ? <AdminEmpty>{text.noPurchases}</AdminEmpty> : <table className="admin-table admin-table-stack">
        <thead><tr><th scope="col">{t("Date")}</th><th scope="col">{t("Property")}</th><th scope="col" className="admin-num">{t("Shares")}</th><th scope="col" className="admin-num">{t("Amount")}</th></tr></thead>
        <tbody>{[...purchases].reverse().map((row, index) => <tr key={`${row.created_at}-${index}`}>
          <td data-label={t("Date")} className="whitespace-nowrap">{date(row.created_at)}</td>
          <td data-label={t("Property")}>{titleOf(row.property_slug)}</td>
          <td data-label={t("Shares")} className="admin-num">{row.shares.toLocaleString(lang)}</td>
          <td data-label={t("Amount")} className="admin-num font-semibold">{euro(row.amount)}</td>
        </tr>)}</tbody>
      </table>}
    </AdminCard>

    <AdminCard title={t("Rental distributions received")} flush>
      {!distributions.length ? <AdminEmpty>{text.noDistributions}</AdminEmpty> : <table className="admin-table admin-table-stack">
        <thead><tr><th scope="col">{t("Date")}</th><th scope="col">{t("Property")}</th><th scope="col">{t("Period")}</th><th scope="col" className="admin-num">{t("Shares")}</th><th scope="col" className="admin-num">{t("Amount")}</th></tr></thead>
        <tbody>{distributions.map((row) => <tr key={`${row.property_slug}-${row.period_start}`}>
          <td data-label={t("Date")} className="whitespace-nowrap">{date(row.created_at)}</td>
          <td data-label={t("Property")}>{titleOf(row.property_slug)}</td>
          <td data-label={t("Period")} className="whitespace-nowrap">{row.period_start} – {row.period_end}</td>
          <td data-label={t("Shares")} className="admin-num">{row.shares.toLocaleString(lang)}</td>
          <td data-label={t("Amount")} className="admin-num font-semibold">{euro(row.amount)}</td>
        </tr>)}</tbody>
      </table>}
    </AdminCard>

    <AdminCard title={t("Wallet movements")} flush>
      {!statement.rows.length ? <AdminEmpty>{text.noTransactions}</AdminEmpty> : <table className="admin-table admin-table-stack">
        <thead><tr><th scope="col">{t("Date")}</th><th scope="col">{t("Description")}</th><th scope="col">{t("Property")}</th><th scope="col" className="admin-num">{t("Credit")}</th><th scope="col" className="admin-num">{t("Debit")}</th><th scope="col" className="admin-num">{t("Balance")}</th></tr></thead>
        <tbody>{statement.rows.map((row) => <tr key={row.id}>
          <td data-label={t("Date")} className="whitespace-nowrap">{date(row.created_at)}</td>
          <td data-label={t("Description")}>{text.transactionType[row.kind]}{row.shares ? ` · ${row.shares} ${text.shares}` : ""}</td>
          <td data-label={t("Property")}>{titleOf(row.property_slug)}</td>
          <td data-label={t("Credit")} className="admin-num text-emerald-700">{row.direction === "credit" ? euro(row.amount) : ""}</td>
          <td data-label={t("Debit")} className="admin-num">{row.direction === "debit" ? euro(row.amount) : ""}</td>
          <td data-label={t("Balance")} className="admin-num font-semibold">{euro(row.balance)}</td>
        </tr>)}</tbody>
      </table>}
    </AdminCard>
  </main>;
}
