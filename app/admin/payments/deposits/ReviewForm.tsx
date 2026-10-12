"use client";
import { useActionState } from "react";
import type { Locale } from "@/app/lib/i18n";
import type { Deposit } from "@/app/funding/deposit-store";
import { depositText } from "@/app/funding/deposit-copy";
import { reviewDeposit, type DepositState } from "@/app/funding/deposit-actions";
export default function ReviewForm({deposit,locale}:{deposit:Deposit;locale:Locale}) {
 const d=depositText(locale); const [state,action,pending]=useActionState(reviewDeposit,{result:""} as DepositState);
 return <form action={action} className="mt-5 space-y-4 border-t border-slate-200 pt-5">
  <input name="deposit_id" type="hidden" value={deposit.id}/>
  <label className="block text-sm font-semibold">{d("credited")} (EUR)<input name="amount" type="number" min="0.01" max="10000000" step="0.01" className="mt-2 block min-h-12 w-full rounded-lg border border-slate-300 px-3"/></label>
  <label className="block text-sm font-semibold">{d("settlement")}<input name="settlement" maxLength={200} defaultValue={deposit.destination.kind==="crypto"?`${deposit.destination.crypto_network}:${deposit.transfer_reference}`:""} className="mt-2 block min-h-12 w-full rounded-lg border border-slate-300 px-3"/></label>
  <label className="block text-sm font-semibold">{d("note")}<textarea name="note" required minLength={3} maxLength={1000} className="mt-2 block min-h-24 w-full rounded-lg border border-slate-300 p-3"/></label>
  <label className="flex items-start gap-3 text-sm leading-6"><input name="checked" type="checkbox" className="mt-1 h-4 w-4 shrink-0"/>{d("checked")}</label>
  {state.result && <p role="status" className={state.result==="error"?"text-red-700":"text-emerald-700"}>{d(state.result==="error"?"error":"reviewed")}</p>}
  <div className="flex flex-wrap gap-3"><button disabled={pending} name="decision" value="approve" className="rounded-lg bg-emerald-700 px-4 py-3 font-bold text-white disabled:opacity-50">{d(pending?"loading":"approve")}</button><button disabled={pending} name="decision" value="reject" className="rounded-lg border border-red-200 px-4 py-3 font-bold text-red-700 disabled:opacity-50">{d("reject")}</button></div>
 </form>;
}
