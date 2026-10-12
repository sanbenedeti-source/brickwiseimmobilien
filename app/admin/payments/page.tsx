import { depositText } from "@/app/funding/deposit-copy";
﻿import Link from "next/link";
import { Landmark, Bitcoin, ArrowUpRight } from "lucide-react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdminUser } from "@/app/lib/admin";
import { getAdminText } from "@/app/lib/admin-copy";
import { getCurrentLocale } from "@/app/lib/server-locale";
import type { CompanyPaymentMethod } from "@/app/lib/company-payment-methods";
import DirectoryForm from "./DirectoryForm";

export default async function AdminPaymentDirectory({ searchParams }: { searchParams: Promise<{ method?: string; result?: string }> }) {
  const client = await createClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) redirect("/sign-in");
  if (!isAdminUser(user)) redirect("/dashboard");
  const locale = await getCurrentLocale(); const t = getAdminText(locale); const query = await searchParams;
  const kind = query.method === "crypto" ? "crypto" : "bank";
  const { data, error } = await client.from("company_payment_methods").select("*").order("bank_slot", { ascending: true, nullsFirst: false }).order("label");
  const methods = (data || []) as CompanyPaymentMethod[];
  return <main className="admin-workspace">
    <section className="admin-hero"><div><p>{t("Payments")}</p><h1>{t("Company payment methods")}</h1><p>{t("Manage company bank accounts and crypto addresses. Active details are shared with all signed-in clients.")}</p><div className="mt-6 flex flex-wrap gap-3"><Link href="/admin/payments/deposits" className="rounded-lg bg-emerald-500 px-4 py-3 font-semibold text-slate-950">{depositText(locale)("queue")}</Link><Link href="/funding" className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-3 font-semibold text-slate-800">{t("Preview client view")}<ArrowUpRight size={16} /></Link><Link href="/admin/payments/requests" className="rounded-lg border border-white/30 px-4 py-3 font-semibold">{t("Create payment request")}</Link></div></div></section>
    <section className="admin-content-section">
      {query.result && <p role="status" className={`mb-5 rounded-xl border p-4 ${query.result === "saved" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-900"}`}>{t(query.result === "saved" ? "Payment details saved." : "Check the payment details and try again.")}</p>}
      {error ? <p role="alert" className="rounded-xl bg-red-50 p-5 text-red-800">{t("Payment details could not be loaded. Please try again.")}</p> : <>
        <div className="admin-method-grid !mt-0 mb-6">
          <Link className={`admin-method-link ${kind === "bank" ? "ring-2 ring-blue-400" : ""}`} href="/admin/payments?method=bank_transfer" aria-current={kind === "bank" ? "page" : undefined}><span className="admin-method-icon"><Landmark size={22} /></span><h2>{t("Bank transfer")}</h2><p>{methods.filter(m => m.kind === "bank" && m.active).length} / 2 · {t("Visible to clients")}</p></Link>
          <Link className={`admin-method-link ${kind === "crypto" ? "ring-2 ring-emerald-400" : ""}`} href="/admin/payments?method=crypto" aria-current={kind === "crypto" ? "page" : undefined}><span className="admin-method-icon"><Bitcoin size={22} /></span><h2>{t("Cryptocurrency")}</h2><p>{methods.filter(m => m.kind === "crypto" && m.active).length} · {t("Visible to clients")}</p></Link>
        </div>
        <div className="grid gap-5 xl:grid-cols-2">{kind === "bank" ? [1,2].map(slot => <DirectoryForm key={methods.find(m => m.bank_slot === slot)?.id || slot} method={methods.find(m => m.kind === "bank" && m.bank_slot === slot)} slot={slot} kind="bank" locale={locale} />) : <>{methods.filter(m => m.kind === "crypto").map(method => <DirectoryForm key={method.id} method={method} kind="crypto" locale={locale} />)}<DirectoryForm key={`new-wallet-${methods.length}`} kind="crypto" locale={locale} /></>}</div>
      </>}
    </section>
  </main>;
}
