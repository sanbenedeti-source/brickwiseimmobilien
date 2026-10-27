import { redirect } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { getCurrentUser } from "@/lib/supabase/auth";
import { isAdminUser } from "@/app/lib/admin";
import { hasAdminSession } from "@/app/lib/admin-session";
import { createClient } from "@/lib/supabase/server";
import { getCurrentLocale } from "@/app/lib/server-locale";
import { localeHtmlLang } from "@/app/lib/i18n";
import { getDeposits } from "@/app/funding/deposit-store";
import { depositText } from "@/app/funding/deposit-copy";
import { getAdminText } from "@/app/lib/admin-copy";
import { getGatewayDeposits } from "@/app/funding/gateway-store";
import { coinGateConfig } from "@/app/lib/coingate";
import { getClientDirectory } from "../../client-directory";
import ReviewForm from "./ReviewForm";
import { AdminAlert, AdminCard, AdminEmpty, AdminPageHeader, AdminStat, StatusBadge } from "../../ui";

export default async function DepositsPage() {
 const user=await getCurrentUser(); if(!user) redirect("/sign-in"); if(!isAdminUser(user)) redirect("/dashboard");
 const supabase=await createClient(); const {data:{user:authUser}}=await supabase.auth.getUser(); if(!(await hasAdminSession(supabase,authUser))) redirect("/admin/security");
 const locale=await getCurrentLocale(), d=depositText(locale), t=getAdminText(locale), lang=localeHtmlLang[locale];
 const [{deposits,error},gateway,directory]=await Promise.all([getDeposits(),getGatewayDeposits(undefined,100),getClientDirectory()]);
 const gatewayConfig=coinGateConfig();
 const euro=(value:number|null)=>Number(value||0).toLocaleString(lang,{style:"currency",currency:"EUR"});
 const count=(status:string)=>deposits.filter(row=>row.status===status).length;
 const credited=deposits.reduce((sum,row)=>sum+(row.status==="verified"?Number(row.credited_eur||0):0),0);
 return <main className="admin-workspace">
  <AdminPageHeader back={{href:"/admin/payments",label:t("Payment methods")}} eyebrow={t("Operations")} title={d("queue")} description={d("adminIntro")}/>
  {error && <AdminAlert tone="danger">{d("loadError")}</AdminAlert>}
  <section className="admin-stats" aria-label={t("Key figures")}>
   <AdminStat label={t("Deposits to verify")} value={count("pending")} attention={count("pending")>0}/>
   <AdminStat label={d("verified")} value={count("verified")}/>
   <AdminStat label={d("rejected")} value={count("rejected")}/>
   <AdminStat label={d("credited")} value={euro(credited)}/>
  </section>
  {!gatewayConfig ? <AdminAlert tone="warning">{t("Automatic crypto payments are not active. Set COINGATE_API_TOKEN in Vercel to enable them.")}</AdminAlert>
   : gatewayConfig.sandbox && <AdminAlert tone="warning">{t("CoinGate sandbox mode is on: test payments credit real client wallets. Use a test client account and switch to live before launch.")}</AdminAlert>}
  {(gatewayConfig || gateway.deposits.length > 0) && <AdminCard title={t("Automatic crypto payments")} description={t("Paid through CoinGate and credited automatically. Rows under review need a manual decision: credit the wallet with Wallet credit, or refund the payment in CoinGate.")} flush>
   {gateway.error ? <AdminAlert tone="danger">{d("loadError")}</AdminAlert> : !gateway.deposits.length ? <AdminEmpty>{t("No automatic crypto payments yet.")}</AdminEmpty> : <table className="admin-table admin-table-stack">
    <thead><tr><th scope="col">{t("Date")}</th><th scope="col">{t("Customer")}</th><th scope="col">{t("CoinGate order")}</th><th scope="col">{t("Paid with")}</th><th scope="col" className="admin-num">{t("Amount")}</th><th scope="col">{t("Status")}</th></tr></thead>
    <tbody>{gateway.deposits.map(row=>{
     const person=directory.get(row.user_id);
     const label=row.status==="paid"?d("verified"):row.status==="review"?d("underReview"):d(row.status as "awaiting_payment"|"confirming"|"failed"|"expired"|"canceled"|"refunded");
     return <tr key={row.id} className={row.status==="review"?"admin-row-highlight":undefined}>
      <td data-label={t("Date")} className="whitespace-nowrap">{new Date(row.created_at).toLocaleString(lang,{dateStyle:"medium",timeStyle:"short"})}</td>
      <td data-label={t("Customer")}><span className="admin-cell-main">{person?.name||row.user_id.slice(0,8)}</span><span className="admin-cell-sub block">{person?.email}</span></td>
      <td data-label={t("CoinGate order")} className="font-mono text-[12px]">{row.provider_order_id ? `#${row.provider_order_id}` : "—"}</td>
      <td data-label={t("Paid with")}>{row.pay_currency && row.pay_amount ? `${Number(row.pay_amount).toLocaleString(lang,{maximumFractionDigits:8})} ${row.pay_currency}` : "—"}{row.review_note && <span className="admin-cell-sub block max-w-xs">{row.review_note}</span>}</td>
      <td data-label={t("Amount")} className="admin-num font-semibold">{euro(row.amount_eur)}</td>
      <td data-label={t("Status")}><StatusBadge status={row.status} label={label}/></td>
     </tr>;
    })}</tbody>
   </table>}
  </AdminCard>}
  <AdminCard title={t("Deposits")} flush>
   {!deposits.length ? <AdminEmpty>{d("empty")}</AdminEmpty> : <div className="admin-list">
    <div className="admin-list-head" aria-hidden="true"><span>{t("Date")}</span><span>{t("Customer")}</span><span>{t("Destination")}</span><span>{t("Reference")}</span><span className="admin-num">{t("Amount")}</span><span>{t("Status")}</span><span/></div>
    {deposits.map(row=>{
     const destination=row.destination;
     const route=destination.kind==="crypto"?`${destination.crypto_asset} · ${destination.crypto_network}`:t("Bank transfer");
     return <details key={row.id} className="admin-list-row" open={row.status==="pending"}>
      <summary>
       <span className="admin-list-date">{new Date(row.created_at).toLocaleDateString(lang)}</span>
       <span className="admin-list-primary"><span className="admin-cell-main">{row.customer_name||row.customer_email}</span><span className="admin-cell-sub">{row.customer_email}</span></span>
       <span className="admin-list-secondary"><span className="admin-cell-main">{destination.label}</span><span className="admin-cell-sub">{route}</span></span>
       <span className="admin-list-meta font-mono text-[12px]">{row.transfer_reference}</span>
       <span className="admin-list-amount">{euro(row.requested_eur)}</span>
       <span className="admin-list-status"><StatusBadge status={row.status} label={d(row.status)}/></span>
       <ChevronDown size={16} aria-hidden="true" className="admin-disclosure-icon"/>
      </summary>
      <div className="admin-list-detail">
       <dl className="admin-facts">
        {destination.kind==="crypto" ? <>
         <div><dt>{t("Crypto asset")}</dt><dd>{destination.crypto_asset} · {destination.crypto_network}</dd></div>
         <div className="admin-facts-wide"><dt>{t("Company wallet address")}</dt><dd className="break-all font-mono text-[12px]">{destination.wallet_address}</dd></div>
         {row.crypto_quantity && <div><dt>{d("quantity")}</dt><dd>{row.crypto_quantity} {destination.crypto_asset}</dd></div>}
        </> : <>
         <div><dt>{t("Destination")}</dt><dd>{destination.bank_name}</dd></div>
         <div><dt>{t("Beneficiary")}</dt><dd>{destination.beneficiary}</dd></div>
         <div><dt>IBAN</dt><dd className="break-all font-mono text-[12px]">{destination.account_number}</dd></div>
        </>}
        <div className="admin-facts-wide"><dt>{d("reference")}</dt><dd className="break-all">{row.transfer_reference}</dd></div>
        <div><dt>ID</dt><dd className="break-all text-[12px]">{row.id} · {new Date(row.created_at).toLocaleString(lang)}</dd></div>
       </dl>
       {row.status==="pending" ? <ReviewForm deposit={row} locale={locale}/> : <p className="admin-note whitespace-pre-line break-words">{row.review_note}{row.status==="verified" && <> · {d("credited")}: {euro(row.credited_eur)}</>}</p>}
      </div>
     </details>;
    })}
   </div>}
  </AdminCard>
 </main>;
}
