import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase/auth";
import { isAdminUser } from "@/app/lib/admin";
import { getCurrentLocale } from "@/app/lib/server-locale";
import { getAdminText } from "@/app/lib/admin-copy";
import { getCompanyPaymentMethods } from "@/app/lib/company-payment-store";
import { isCoinGateEnabled } from "@/app/lib/coingate";
import ClientPortalSidebar from "@/app/components/ClientPortalSidebar";
import DepositPanel from "./DepositPanel";
import DepositHistory from "./DepositHistory";
import CryptoCheckout from "./CryptoCheckout";
import { getDeposits } from "./deposit-store";
import { getGatewayDeposits, syncOpenGatewayDeposits } from "./gateway-store";
import { depositText } from "./deposit-copy";

export default async function FundingPage({ searchParams }: { searchParams?: Promise<{ method?: string; payment?: string }> } = {}) {
  const user = await getCurrentUser();
  if (!user?.email) redirect("/sign-in");
  if (isAdminUser(user)) redirect("/admin");
  const locale = await getCurrentLocale(); const t = getAdminText(locale);
  const { methods, error } = await getCompanyPaymentMethods();
  const history = await getDeposits(user.id); const d = depositText(locale);
  const query = await searchParams;
  // With the CoinGate checkout active, crypto is paid there and credited automatically;
  // the manual report form remains only for bank transfers.
  const gateway = isCoinGateEnabled();
  const requested = query?.method === "crypto" ? "crypto" : query?.method === "bank" || query?.method === "bank_transfer" ? "bank" : undefined;
  const kind = gateway ? (requested === "bank" ? "bank" : "crypto") : requested;
  let gatewayHistory = await getGatewayDeposits(user.id);
  if (gateway && await syncOpenGatewayDeposits(gatewayHistory.deposits).catch(() => false)) gatewayHistory = await getGatewayDeposits(user.id);
  const manualMethods = gateway ? methods.filter((method) => method.kind !== "crypto") : methods;
  const notice = query?.payment === "success" ? d("gatewaySuccess") : query?.payment === "canceled" ? d("gatewayCanceled") : null;
  const name = String(user.user_metadata?.full_name || user.email.split("@")[0]);
  const reference = `BW-GL-${user.id.slice(0,8).toUpperCase()}`;
  return <>
    <ClientPortalSidebar active="funding" email={user.email} fullName={name} locale={locale} />
    <main className="min-h-screen bg-canvas pb-12 pt-16 text-ink lg:ml-[282px] lg:pt-0">
      <header className="border-b border-line bg-white px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-end justify-between gap-4">
          <div className="max-w-3xl"><Link href="/dashboard/wallet" className="inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline"><ArrowLeft size={14} aria-hidden="true" />{t("Back to dashboard")}</Link><h1 className="mt-2 text-[28px] font-bold leading-tight">{d("title")}</h1><p className="mt-1.5 text-sm leading-6 text-muted">{gateway && kind === "crypto" ? d("gatewayPageIntro") : d("intro")}</p></div>
          <nav className="inline-flex rounded-lg border border-line bg-canvas p-1" aria-label={t("Payments")}>
            {([["bank", t("Bank transfer")], ["crypto", t("Cryptocurrency")]] as const).map(([value, label]) => <Link key={value} href={`/funding?method=${value}`} aria-current={kind === value ? "page" : undefined} className={`rounded-md px-4 py-2 text-sm font-semibold ${kind === value ? "bg-white text-ink shadow-sm ring-1 ring-line" : "text-muted hover:text-ink"}`}>{label}</Link>)}
          </nav>
        </div>
      </header>
      <div className="mx-auto max-w-[1440px] space-y-6 px-4 py-7 sm:px-6 lg:px-8">
        {notice && <p role="status" className={`rounded-xl border px-4 py-3 text-sm ${query?.payment === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-line bg-white text-muted"}`}>{notice}</p>}
        {gateway && kind === "crypto" ? <CryptoCheckout locale={locale} />
          : error ? <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{t("Payment details could not be loaded. Please try again.")}</p> : <DepositPanel key={kind || "all"} methods={manualMethods} locale={locale} kind={kind} reference={reference} />}
        <DepositHistory {...history} gateway={gatewayHistory.deposits} locale={locale}/>
      </div>
    </main>
  </>;
}
