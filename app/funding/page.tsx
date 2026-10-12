import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase/auth";
import { getCurrentLocale } from "@/app/lib/server-locale";
import { getAdminText } from "@/app/lib/admin-copy";
import { getCompanyPaymentMethods } from "@/app/lib/company-payment-store";
import ClientPortalSidebar from "@/app/components/ClientPortalSidebar";
import DepositPanel from "./DepositPanel";
import DepositHistory from "./DepositHistory";
import { getDeposits } from "./deposit-store";
import { depositText } from "./deposit-copy";

export default async function FundingPage({ searchParams }: { searchParams?: Promise<{ method?: string }> } = {}) {
  const user = await getCurrentUser();
  if (!user?.email) redirect("/sign-in");
  const locale = await getCurrentLocale(); const t = getAdminText(locale);
  const { methods, error } = await getCompanyPaymentMethods();
  const history = await getDeposits(user.id); const d = depositText(locale);
  const query = await searchParams;
  const kind = query?.method === "crypto" ? "crypto" : query?.method === "bank" || query?.method === "bank_transfer" ? "bank" : undefined;
  const name = String(user.user_metadata?.full_name || user.email.split("@")[0]);
  const reference = `BW-GL-${user.id.slice(0,8).toUpperCase()}`;
  return <>
    <ClientPortalSidebar active="funding" email={user.email} fullName={name} locale={locale} />
    <main className="min-h-screen bg-slate-50 px-4 pb-12 pt-24 text-slate-900 sm:px-8 lg:ml-[282px] lg:pt-10">
      <div className="mx-auto max-w-6xl">
        <Link href="/dashboard/wallet" className="text-sm font-semibold text-sky-700">{t("Back to dashboard")}</Link>
        <header className="mt-5 rounded-2xl bg-slate-900 p-7 text-white"><p className="text-xs font-bold uppercase tracking-widest text-emerald-300">EUR</p><h1 className="mt-3 text-3xl font-bold">{d("title")}</h1><p className="mt-4 text-sm leading-6 text-slate-200">{d("intro")}</p></header>
        <nav className="my-6 flex flex-wrap gap-3" aria-label={t("Payments")}><Link href="/funding?method=bank" aria-current={kind === "bank" ? "page" : undefined} className={`rounded-xl border px-5 py-3 font-semibold ${kind === "bank" ? "border-blue-600 bg-blue-600 text-white" : "border-slate-200 bg-white"}`}>{t("Bank transfer")}</Link><Link href="/funding?method=crypto" aria-current={kind === "crypto" ? "page" : undefined} className={`rounded-xl border px-5 py-3 font-semibold ${kind === "crypto" ? "border-emerald-700 bg-emerald-700 text-white" : "border-slate-200 bg-white"}`}>{t("Cryptocurrency")}</Link></nav>
        {error ? <p role="alert" className="rounded-xl bg-amber-50 p-5 text-amber-900">{t("Payment details could not be loaded. Please try again.")}</p> : <DepositPanel key={kind || "all"} methods={methods} locale={locale} kind={kind} reference={reference} />}
        <DepositHistory {...history} locale={locale}/>
      </div>
    </main>
  </>;
}
