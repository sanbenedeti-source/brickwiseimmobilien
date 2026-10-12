import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase/auth";
import { isAdminUser } from "@/app/lib/admin";
import { getCurrentLocale } from "@/app/lib/server-locale";
import { getDeposits } from "@/app/funding/deposit-store";
import { depositText } from "@/app/funding/deposit-copy";
import { getAdminText } from "@/app/lib/admin-copy";
import ReviewForm from "./ReviewForm";
export default async function DepositsPage() {
 const user=await getCurrentUser(); if(!user) redirect("/sign-in"); if(!isAdminUser(user)) redirect("/dashboard");
 const locale=await getCurrentLocale(), d=depositText(locale), t=getAdminText(locale);
 const {deposits,error}=await getDeposits();
 return <main className="admin-workspace"><section className="admin-hero"><Link href="/admin/payments">{t("Payments")}</Link><h1>{d("queue")}</h1><p>{d("adminIntro")}</p></section><section className="admin-content-section space-y-5">
 {error?<p role="alert">{d("loadError")}</p>:!deposits.length?<p>{d("empty")}</p>:deposits.map(row=><article key={row.id} className="rounded-2xl border border-slate-200 bg-white p-6"><div className="flex flex-wrap justify-between gap-3"><h2 className="text-lg font-bold">{row.destination.label} · {Number(row.requested_eur).toLocaleString(locale,{style:"currency",currency:"EUR"})}</h2><strong>{d(row.status)}</strong></div><p className="mt-2 break-all text-xs text-slate-500">{row.id} · {new Date(row.created_at).toLocaleString(locale)}</p><p className="mt-3 break-all text-sm">{t("Customer")}: {row.customer_name} ? {row.customer_email}</p><p className="mt-3 break-all text-sm">{d("reference")}: {row.transfer_reference}</p><p className="mt-3 break-all text-sm">{row.destination.bank_name} {row.destination.beneficiary} {row.destination.account_number} {row.destination.crypto_asset} {row.destination.crypto_network} {row.destination.wallet_address}</p>{row.crypto_quantity && <p className="mt-3">{d("quantity")}: {row.crypto_quantity} {row.destination.crypto_asset}</p>}{row.status==="pending"?<ReviewForm deposit={row} locale={locale}/>:<p className="mt-4 whitespace-pre-line break-words">{row.review_note}{row.status==="verified" && <> · {d("credited")}: {Number(row.credited_eur).toLocaleString(locale,{style:"currency",currency:"EUR"})}</>}</p>}</article>)}
 </section></main>;
}
