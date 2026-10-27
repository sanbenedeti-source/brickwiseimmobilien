"use client";
import { useActionState } from "react";
import type { Locale } from "@/app/lib/i18n";
import { refundText } from "./refund-copy";
import { refundPayment, type RefundState } from "./refund-actions";
export default function RefundForm({paymentId,amount,wallet,locale}:{paymentId:string;amount:number;wallet:boolean;locale:Locale}) {
 const t=refundText(locale);const [state,action,pending]=useActionState(refundPayment,{result:""} as RefundState);
 return <details className="admin-subsection admin-subsection-danger"><summary>{t("title")} · {amount.toLocaleString(locale,{style:"currency",currency:"EUR"})}</summary><div className="admin-form"><p className="admin-help">{t("intro")}</p><p className="font-semibold">{t(wallet?"wallet":"external")}</p><form action={action} className="admin-form">
  <input name="payment_id" type="hidden" value={paymentId}/>
  <label className="admin-field">{t("reference")}<input name="reference" required minLength={4} maxLength={200}/></label>
  <label className="admin-field">{t("note")}<textarea name="note" required minLength={3} maxLength={1000} rows={3}/></label>
  <label className="flex items-start gap-3 text-sm leading-6"><input name="confirmed" type="checkbox" required className="mt-1 h-4 w-4 shrink-0"/>{t("confirm")}</label>
  {state.result && <p role="status" className={state.result==="saved"?"text-emerald-700":"text-red-700"}>{t(state.result)}</p>}
  <div><button disabled={pending||state.result==="saved"} className="admin-btn admin-btn-danger">{t(pending?"pending":"submit")}</button></div>
 </form></div></details>;
}
