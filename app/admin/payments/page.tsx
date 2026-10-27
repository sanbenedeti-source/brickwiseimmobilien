import { depositText } from "@/app/funding/deposit-copy";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdminUser } from "@/app/lib/admin";
import { hasAdminSession } from "@/app/lib/admin-session";
import { getAdminText } from "@/app/lib/admin-copy";
import { getCurrentLocale } from "@/app/lib/server-locale";
import type { CompanyPaymentMethod } from "@/app/lib/company-payment-methods";
import DirectoryForm from "./DirectoryForm";
import { AdminAlert, AdminPageHeader } from "../ui";

export default async function AdminPaymentDirectory({ searchParams }: { searchParams: Promise<{ method?: string; result?: string }> }) {
  const client = await createClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) redirect("/sign-in");
  if (!isAdminUser(user)) redirect("/dashboard");
  if (!(await hasAdminSession(client, user))) redirect("/admin/security");
  const locale = await getCurrentLocale(); const t = getAdminText(locale); const query = await searchParams;
  const kind = query.method === "crypto" ? "crypto" : "bank";
  const { data, error } = await client.from("company_payment_methods").select("*").order("bank_slot", { ascending: true, nullsFirst: false }).order("label");
  const methods = (data || []) as CompanyPaymentMethod[];
  return <main className="admin-workspace">
    <AdminPageHeader
      eyebrow={t("Settings")}
      title={t("Company payment methods")}
      description={t("Manage company bank accounts and crypto addresses. Active details are shared with all signed-in clients.")}
      actions={<>
        <Link href="/funding" className="admin-btn admin-btn-secondary">{t("Preview client view")}<ArrowUpRight size={15} aria-hidden="true" /></Link>
        <Link href="/admin/payments/deposits" className="admin-btn admin-btn-secondary">{depositText(locale)("queue")}</Link>
        <Link href="/admin/payments/requests?form=new#create-payment" className="admin-btn">{t("Create payment request")}</Link>
      </>}
    />
    {query.result && <AdminAlert tone={query.result === "saved" ? "success" : "warning"}>{t(query.result === "saved" ? "Payment details saved." : "Check the payment details and try again.")}</AdminAlert>}
    {error ? <AdminAlert tone="danger">{t("Payment details could not be loaded. Please try again.")}</AdminAlert> : <>
      <nav className="admin-segmented mb-5" aria-label={t("Payment methods")}>
        <Link href="/admin/payments?method=bank_transfer" aria-current={kind === "bank" ? "page" : undefined}>{t("Bank transfer")}<span>{methods.filter(m => m.kind === "bank" && m.active).length} / 2 · {t("Visible to clients")}</span></Link>
        <Link href="/admin/payments?method=crypto" aria-current={kind === "crypto" ? "page" : undefined}>{t("Cryptocurrency")}<span>{methods.filter(m => m.kind === "crypto" && m.active).length} · {t("Visible to clients")}</span></Link>
      </nav>
      <div className="grid gap-5 xl:grid-cols-2">{kind === "bank" ? [1,2].map(slot => <DirectoryForm key={methods.find(m => m.bank_slot === slot)?.id || slot} method={methods.find(m => m.kind === "bank" && m.bank_slot === slot)} slot={slot} kind="bank" locale={locale} />) : <>{methods.filter(m => m.kind === "crypto").map(method => <DirectoryForm key={method.id} method={method} kind="crypto" locale={locale} />)}<DirectoryForm key={`new-wallet-${methods.length}`} kind="crypto" locale={locale} /></>}</div>
    </>}
  </main>;
}
