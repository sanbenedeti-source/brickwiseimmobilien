import Link from "next/link";
import { redirect } from "next/navigation";
import { Search } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { isAdminUser } from "@/app/lib/admin";
import { hasAdminSession } from "@/app/lib/admin-session";
import { getAdminText } from "@/app/lib/admin-copy";
import { getCurrentLocale } from "@/app/lib/server-locale";
import { localeHtmlLang } from "@/app/lib/i18n";
import { getKnownCustomersFromRequests, mergeCustomers } from "@/app/lib/customer-store";
import { getRegisteredAuthCustomers } from "../customer-list";
import { AdminAlert, AdminCard, AdminEmpty, AdminPageHeader, AdminStat, StatusBadge } from "../ui";

/** All clients with their wallet and invested amount, searchable by name or email. */
export default async function AdminCustomersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");
  if (!isAdminUser(user)) redirect("/dashboard");
  if (!(await hasAdminSession(supabase, user))) redirect("/admin/security");
  const locale = await getCurrentLocale(), t = getAdminText(locale), lang = localeHtmlLang[locale];
  const query = String((await searchParams).q || "").trim().slice(0, 120);

  const service = createServiceClient();
  const [{ data: requests }, authCustomers, { data: wallets }, { data: holdings }] = await Promise.all([
    supabase.from("property_requests").select("id,status,created_at,name,full_name,email,phone,message,properties(title,slug,city,price)").order("created_at", { ascending: false }),
    getRegisteredAuthCustomers(),
    // Wallets and holdings are owner-only under RLS; the verified admin reads them with the service role.
    service.from("wallet_accounts").select("user_id,balance"),
    service.from("property_holdings").select("user_id,shares,invested_amount"),
  ]);
  const customers = mergeCustomers(authCustomers.customers, getKnownCustomersFromRequests(requests as Parameters<typeof getKnownCustomersFromRequests>[0]));
  const balance = new Map((wallets || []).map((row) => [row.user_id, Number(row.balance)]));
  const invested = new Map<string, { amount: number; shares: number }>();
  for (const row of holdings || []) {
    const current = invested.get(row.user_id) ?? { amount: 0, shares: 0 };
    invested.set(row.user_id, { amount: current.amount + Number(row.invested_amount), shares: current.shares + Number(row.shares) });
  }
  const needle = query.toLowerCase();
  const visible = needle ? customers.filter((customer) => `${customer.fullName} ${customer.email} ${customer.phone || ""}`.toLowerCase().includes(needle)) : customers;
  const euro = (value: number) => value.toLocaleString(lang, { style: "currency", currency: "EUR" });
  const totalInvested = [...invested.values()].reduce((sum, row) => sum + row.amount, 0);
  const totalWallets = [...balance.values()].reduce((sum, value) => sum + value, 0);

  return <main className="admin-workspace">
    <AdminPageHeader eyebrow={t("Clients")} title={t("Clients")} description={t("Overview of customers captured through registration, contact, or rental participation requests.")} />
    {!authCustomers.enabled && <AdminAlert tone="warning">{t("Auth list requires service role key")}</AdminAlert>}
    <section className="admin-stats" aria-label={t("Key figures")}>
      <AdminStat label={t("Registered customers")} value={authCustomers.customers.length} />
      <AdminStat label={t("Investors")} value={invested.size} />
      <AdminStat label={t("Invested")} value={euro(totalInvested)} />
      <AdminStat label={t("Wallet balance")} value={euro(totalWallets)} />
    </section>

    <form className="mb-5 flex max-w-xl items-center gap-2" role="search">
      <label className="relative flex-1">
        <span className="sr-only">{t("Search clients")}</span>
        <Search size={16} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--admin-muted,#64748b)]" />
        <input name="q" defaultValue={query} placeholder={t("Search by name or email")} className="admin-input w-full !pl-9" />
      </label>
      <button className="admin-btn">{t("Search")}</button>
      {query && <Link href="/admin/customers" className="admin-btn admin-btn-secondary">{t("Clear")}</Link>}
    </form>

    <AdminCard title={t("Clients")} flush>
      {!visible.length ? <AdminEmpty>{query ? t("No clients match your search.") : t("No customers yet. Once a customer sends a request, they will appear here.")}</AdminEmpty>
        : <table className="admin-table admin-table-stack">
          <thead><tr><th scope="col">{t("Customer")}</th><th scope="col">{t("Status")}</th><th scope="col" className="admin-num">{t("Wallet balance")}</th><th scope="col" className="admin-num">{t("Invested")}</th><th scope="col">{t("Registered")}</th><th scope="col"><span className="sr-only">{t("Actions")}</span></th></tr></thead>
          <tbody>{visible.map((customer) => {
            const registered = customer.source === "Registration";
            const position = invested.get(customer.id);
            return <tr key={customer.id}>
              <td data-label={t("Customer")}>
                {registered ? <Link href={`/admin/customers/${encodeURIComponent(customer.id)}`} className="admin-cell-main hover:underline">{customer.fullName === "Unknown customer" ? t("Unknown customer") : customer.fullName}</Link>
                  : <p className="admin-cell-main">{customer.fullName === "Unknown customer" ? t("Unknown customer") : customer.fullName}</p>}
                <p className="admin-cell-sub">{customer.email}{customer.phone ? ` · ${customer.phone}` : ""}{!registered ? ` · ${t(customer.source)}` : ""}</p>
              </td>
              <td data-label={t("Status")}><StatusBadge status={customer.status} label={t(customer.status)} /></td>
              <td data-label={t("Wallet balance")} className="admin-num">{registered ? euro(balance.get(customer.id) ?? 0) : "—"}</td>
              <td data-label={t("Invested")} className="admin-num">{position ? <>{euro(position.amount)}<span className="admin-cell-sub block">{position.shares.toLocaleString(lang)} {t("Shares")}</span></> : "—"}</td>
              <td data-label={t("Registered")} className="whitespace-nowrap">{new Date(customer.createdAt).toLocaleDateString(lang)}</td>
              <td>{registered ? <Link href={`/admin/customers/${encodeURIComponent(customer.id)}`} className="admin-btn admin-btn-sm">{t("Manage")}</Link>
                : <a href={`mailto:${customer.email}`} className="admin-btn admin-btn-secondary admin-btn-sm">{t("Send email")}</a>}</td>
            </tr>;
          })}</tbody>
        </table>}
    </AdminCard>
  </main>;
}
