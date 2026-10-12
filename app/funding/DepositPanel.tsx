"use client";
import { useActionState, useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Clock3, Landmark, Bitcoin } from "lucide-react";
import type { CompanyPaymentMethod } from "../lib/company-payment-methods";
import type { Locale } from "../lib/i18n";
import { getAdminText } from "../lib/admin-copy";
import { depositText } from "./deposit-copy";
import { submitDeposit, type DepositState } from "./deposit-actions";
import CompanyPaymentDirectory from "./CompanyPaymentDirectory";
import CopyPaymentValue from "./CopyPaymentValue";

export default function DepositPanel({methods,locale,kind,reference}:{methods:CompanyPaymentMethod[];locale:Locale;kind?:"bank"|"crypto";reference:string}) {
 const d=depositText(locale), t=getAdminText(locale);
 const [methodId,setMethodId]=useState(""); const [amount,setAmount]=useState("");
 const [step,setStep]=useState(1); const [clientKey,setClientKey]=useState("");
 const [state,action,pending]=useActionState(submitDeposit,{result:""} as DepositState);
 const selected=methods.find(m=>m.id===methodId && m.active);
 const available=methods.filter(m=>m.active && (!kind || m.kind===kind));
 if(state.result==="saved") return <div role="status" className="rounded-2xl border border-emerald-200 bg-emerald-50 p-7 text-emerald-900"><CheckCircle2 className="mb-3"/><h2 className="text-xl font-bold">{d("pending")}</h2><p className="mt-3">{d("saved")}</p><a href="/funding" className="mt-5 inline-block font-bold underline">{d("refresh")}</a></div>;
 return <div className="space-y-6">
  <ol className="grid gap-3 md:grid-cols-3">{(["choose","transfer","review"] as const).map((key,i)=><li key={key} className={`rounded-xl border p-4 text-sm font-semibold ${step===i+1?"border-emerald-300 bg-emerald-50 text-emerald-900":"border-slate-200 bg-white text-slate-600"}`}>{d(key)}</li>)}</ol>
  {step===1 ? <form onSubmit={e=>{e.preventDefault();if(selected){setClientKey(crypto.randomUUID());setStep(2);}}} className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7">
   <label htmlFor="deposit-amount" className="text-sm font-bold">{d("amount")}</label>
   <input id="deposit-amount" type="number" min="0.01" max="10000000" step="0.01" required value={amount} onChange={e=>setAmount(e.target.value)} className="mt-2 block min-h-14 w-full max-w-sm rounded-xl border border-slate-300 px-4" placeholder="500.00" />
   <fieldset className="mt-6"><legend className="font-semibold">{t("Company payment methods")}</legend><div className="mt-3 grid gap-3 sm:grid-cols-2">{available.map(m=><label key={m.id} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-4 ${methodId===m.id?"border-emerald-600 bg-emerald-50":"border-slate-200"}`}><input type="radio" name="destination" value={m.id} checked={methodId===m.id} onChange={()=>setMethodId(m.id)} required className="accent-emerald-600"/>{m.kind==="bank"?<Landmark size={20}/>:<Bitcoin size={20}/>}<span className="min-w-0 break-words"><strong className="block">{m.label}</strong><span className="text-xs text-slate-600">{m.kind==="bank"?"EUR":`${m.crypto_asset} / ${m.crypto_network}`}</span></span></label>)}</div></fieldset>
   {!available.length && <p className="mt-4 text-slate-600">{t("No active payment details yet. Please contact the team.")}</p>}
   <button disabled={!available.length} className="mt-6 flex min-h-12 items-center gap-3 rounded-xl bg-emerald-700 px-5 font-bold text-white disabled:opacity-50">{d("next")}<ArrowRight size={18}/></button>
  </form> : selected && <div className="space-y-5">
   <button type="button" onClick={()=>setStep(1)} className="font-semibold text-sky-700 underline">{d("back")}</button>
   <div className="rounded-xl bg-slate-900 p-5 text-white"><p>{d("amount")}: <strong>{Number(amount).toLocaleString(locale,{style:"currency",currency:"EUR"})}</strong></p><p className="mt-3 text-sm">{t("Payment reference")}: <strong>{reference}</strong></p><CopyPaymentValue value={reference} label={t("Copy details")} copiedLabel={t("Copied")} failedLabel={t("Please select and copy the details.")}/></div>
   <CompanyPaymentDirectory methods={[selected]} locale={locale} kind={selected.kind}/>
   {selected.kind==="crypto" && <p className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-900">{d("crypto")} <Link href="/contact" className="font-bold underline">{d("help")}</Link></p>}
   <form action={action} className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 sm:p-7">
    <input type="hidden" name="destination" value={JSON.stringify(selected)}/><input type="hidden" name="method_id" value={selected.id}/><input type="hidden" name="amount" value={amount}/><input type="hidden" name="client_key" value={clientKey}/>
    <h2 className="text-xl font-bold">{d("transfer")}</h2>
    {selected.kind==="crypto" && <label className="block text-sm font-semibold">{d("quantity")} ({selected.crypto_asset})<input name="quantity" required type="number" min="0.000000000000000001" step="any" className="mt-2 block min-h-12 w-full rounded-xl border border-slate-300 px-4"/></label>}
    <label className="block text-sm font-semibold">{d("reference")}<input name="transfer_reference" required minLength={selected.kind==="crypto"?20:4} maxLength={200} pattern={selected.kind==="crypto"?"[A-Za-z0-9]{20,200}":undefined} className="mt-2 block min-h-12 w-full rounded-xl border border-slate-300 px-4"/></label>
    <label className="flex items-start gap-3 text-sm leading-6"><input name="acknowledged" type="checkbox" required className="mt-1 h-4 w-4 shrink-0 accent-emerald-600"/>{d("acknowledge")}</label>
    {state.result==="error" && <p role="alert" className="text-red-700">{d("error")}</p>}
    <button disabled={pending} className="flex min-h-14 w-full items-center justify-center gap-3 rounded-xl bg-emerald-700 px-4 font-bold text-white disabled:opacity-50"><Clock3 size={18}/>{d(pending?"loading":"submit")}</button>
   </form>
  </div>}
 </div>;
}
