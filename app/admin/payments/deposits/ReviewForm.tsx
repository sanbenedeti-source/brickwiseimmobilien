"use client";
import { useActionState } from "react";
import type { Locale } from "@/app/lib/i18n";
import type { Deposit } from "@/app/funding/deposit-store";
import { depositText } from "@/app/funding/deposit-copy";
import { reviewDeposit, type DepositState } from "@/app/funding/deposit-actions";
export default function ReviewForm({deposit,locale}:{deposit:Deposit;locale:Locale}) {
 const d=depositText(locale); const [state,action,pending]=useActionState(reviewDeposit,{result:""} as DepositState);
 return <form action={action} className="admin-form-grid">
  <input name="deposit_id" type="hidden" value={deposit.id}/>
  <label className="admin-field">{d("credited")} (EUR)<input name="amount" type="number" min="0.01" max="10000000" step="0.01" defaultValue={Number(deposit.requested_eur).toFixed(2)}/></label>
  <label className="admin-field">{d("settlement")}<input name="settlement" maxLength={200} defaultValue={deposit.destination.kind==="crypto"?`${deposit.destination.crypto_network}:${deposit.transfer_reference}`:""}/></label>
  <label className="admin-check admin-field-wide"><input name="amount_differs" type="checkbox"/>{d("differs")} ({d("reported")}: {Number(deposit.requested_eur).toFixed(2)} EUR)</label>
  <label className="admin-field admin-field-wide">{d("note")}<textarea name="note" required minLength={3} maxLength={1000} rows={3}/></label>
  <label className="admin-check admin-field-wide"><input name="checked" type="checkbox"/>{d("checked")}</label>
  {state.result && <p role="status" className={`admin-alert admin-field-wide ${state.result==="error"?"admin-alert-danger":"admin-alert-success"}`}>{d(state.result==="error"?"error":"reviewed")}</p>}
  <div className="admin-field-wide flex flex-wrap gap-2"><button disabled={pending} name="decision" value="approve" className="admin-btn admin-btn-success">{d(pending?"loading":"approve")}</button><button disabled={pending} name="decision" value="reject" className="admin-btn admin-btn-danger-outline">{d("reject")}</button></div>
 </form>;
}
