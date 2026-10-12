"use client";
import { useActionState } from "react";
import type { Locale } from "@/app/lib/i18n";
import { refundText } from "./refund-copy";
import { refundPayment, type RefundState } from "./refund-actions";
export default function RefundForm({paymentId,amount,wallet,locale}:{paymentId:string;amount:number;wallet:boolean;locale:Locale}) {
 const t=refundText(locale);const [state,action,pending]=useActionState(refundPayment,{result:""} as RefundState);
 return <details className="mt-5 rounded-xl border border-red-200 bg-white p-5"><summary className="cursor-pointer font-bold text-red-800">{t("title")} · {amount.toLocaleString(locale,{style:"currency",currency:"EUR"})}</summary><p className="mt-4 text-sm leading-6 text-slate-600">{t("intro")}</p><p className="mt-3 text-sm font-semibold">{t(wallet?"wallet":"external")}</p><form action={action} className="mt-5 space-y-4">
  <input name="payment_id" type="hidden" value={paymentId}/>
  <label className="block text-sm font-bold">{t("reference")}<input name="reference" required minLength={4} maxLength={200} className="mt-2 block min-h-12 w-full rounded-lg border border-slate-300 px-3"/></label>
  <label className="block text-sm font-bold">{t("note")}<textarea name="note" required minLength={3} maxLength={1000} className="mt-2 block min-h-24 w-full rounded-lg border border-slate-300 p-3"/></label>
  <label className="flex items-start gap-3 text-sm leading-6"><input name="confirmed" type="checkbox" required className="mt-1 h-4 w-4 shrink-0"/>{t("confirm")}</label>
  {state.result && <p role="status" className={state.result==="saved"?"text-emerald-700":"text-red-700"}>{t(state.result)}</p>}
  <button disabled={pending||state.result==="saved"} className="rounded-xl bg-red-700 px-5 py-3 font-bold text-white disabled:opacity-50">{t(pending?"pending":"submit")}</button>
 </form></details>;
}
