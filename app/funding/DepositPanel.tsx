"use client";
import { useActionState, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Clock3, Landmark, Bitcoin } from "lucide-react";
import type { CompanyPaymentMethod } from "../lib/company-payment-methods";
import type { Locale } from "../lib/i18n";
import { getAdminText } from "../lib/admin-copy";
import { depositText } from "./deposit-copy";
import { submitDeposit, type DepositState } from "./deposit-actions";
import CompanyPaymentDirectory from "./CompanyPaymentDirectory";
import CopyPaymentValue from "./CopyPaymentValue";

const card = "rounded-xl border border-line bg-white";
const field = "mt-1.5 block min-h-11 w-full rounded-lg border border-line-strong bg-white px-3 text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15";
const primary = "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-brand px-5 text-sm font-semibold text-white hover:bg-brand-strong disabled:opacity-50";

export default function DepositPanel({methods,locale,kind,reference}:{methods:CompanyPaymentMethod[];locale:Locale;kind?:"bank"|"crypto";reference:string}) {
 const d=depositText(locale), t=getAdminText(locale);
 const [methodId,setMethodId]=useState(""); const [amount,setAmount]=useState("");
 const [step,setStep]=useState(1); const [clientKey,setClientKey]=useState("");
 const [state,action,pending]=useActionState(submitDeposit,{result:""} as DepositState);
 const selected=methods.find(m=>m.id===methodId && m.active);
 const available=methods.filter(m=>m.active && (!kind || m.kind===kind));
 const current = state.result==="saved" ? 3 : step;
 const steps = <ol className="grid gap-3 md:grid-cols-3">{(["choose","transfer","review"] as const).map((key,i)=>{
  const status = current>i+1 ? "done" : current===i+1 ? "current" : "next";
  return <li key={key} aria-current={status==="current" ? "step" : undefined} className={`relative flex items-center gap-3 overflow-hidden rounded-xl border bg-white px-4 py-3 text-sm ${status==="current"?"border-brand":"border-line"}`}>
   {status==="current" && <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1 bg-brand"/>}
   <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${status==="done"?"bg-emerald-600 text-white":status==="current"?"bg-brand text-white":"bg-canvas text-muted"}`}>{status==="done"?<Check size={14} aria-hidden="true"/>:i+1}</span>
   <span className={status==="next"?"text-muted":"font-semibold text-ink"}>{d(key).replace(/^\d+\.\s*/,"")}</span>
  </li>;
 })}</ol>;
 if(state.result==="saved") return <div className="space-y-6">{steps}<div role="status" className={`${card} p-6`}><span className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-50 text-emerald-700"><CheckCircle2 size={22} aria-hidden="true"/></span><h2 className="mt-4 text-lg font-semibold">{d("pending")}</h2><p className="mt-1.5 max-w-2xl text-sm leading-6 text-muted">{d("saved")}</p><a href="/funding" className="mt-4 inline-block text-sm font-semibold text-brand hover:underline">{d("refresh")}</a></div></div>;
 return <div className="space-y-6">
  {steps}
  {step===1 ? <form onSubmit={e=>{e.preventDefault();if(selected){setClientKey(crypto.randomUUID());setStep(2);}}} className={card}>
   <div className="border-b border-line px-5 py-4"><h2 className="text-base font-semibold">{d("choose").replace(/^\d+\.\s*/,"")}</h2></div>
   <div className="space-y-6 p-5">
    <label htmlFor="deposit-amount" className="block max-w-sm text-xs font-semibold text-muted">{d("amount")}
     <span className="relative mt-1.5 block"><span aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm font-semibold text-muted">€</span><input id="deposit-amount" type="number" min="0.01" max="10000000" step="0.01" required value={amount} onChange={e=>setAmount(e.target.value)} className={`${field} mt-0 pl-8 text-base font-semibold tabular-nums`} placeholder="500.00" /></span>
    </label>
    <fieldset><legend className="text-xs font-semibold text-muted">{t("Company payment methods")}</legend><div className="mt-2 grid gap-3 sm:grid-cols-2">{available.map(m=><label key={m.id} className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3.5 transition-colors ${methodId===m.id?"border-brand bg-brand-soft":"border-line hover:bg-canvas"}`}><input type="radio" name="destination" value={m.id} checked={methodId===m.id} onChange={()=>setMethodId(m.id)} required className="accent-[var(--color-brand)]"/><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-brand ring-1 ring-line">{m.kind==="bank"?<Landmark size={18} aria-hidden="true"/>:<Bitcoin size={18} aria-hidden="true"/>}</span><span className="min-w-0 break-words"><strong className="block text-sm">{m.label}</strong><span className="text-xs text-muted">{m.kind==="bank"?"EUR":`${m.crypto_asset} / ${m.crypto_network}`}</span></span></label>)}</div></fieldset>
    {!available.length && <p className="text-sm text-muted">{t("No active payment details yet. Please contact the team.")}</p>}
    <button disabled={!available.length} className={primary}>{d("next")}<ArrowRight size={17} aria-hidden="true"/></button>
   </div>
  </form> : selected && <div className="space-y-6">
   <button type="button" onClick={()=>setStep(1)} className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand hover:underline"><ArrowLeft size={15} aria-hidden="true"/>{d("back")}</button>
   <div className={`${card} grid gap-4 p-5 sm:grid-cols-2`}>
    <div><p className="text-xs font-medium text-muted">{d("amount")}</p><p className="mt-1 text-[26px] font-semibold leading-tight tracking-tight">{Number(amount).toLocaleString(locale,{style:"currency",currency:"EUR"})}</p></div>
    <div><p className="text-xs font-medium text-muted">{t("Payment reference")}</p><p className="mt-1 font-mono text-xl font-semibold tracking-wider">{reference}</p><CopyPaymentValue value={reference} label={t("Copy details")} copiedLabel={t("Copied")} failedLabel={t("Please select and copy the details.")}/></div>
   </div>
   <CompanyPaymentDirectory methods={[selected]} locale={locale} kind={selected.kind}/>
   {selected.kind==="crypto" && <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">{d("crypto")} <Link href="/contact" className="font-semibold underline">{d("help")}</Link></p>}
   <form action={action} className={card}>
    <input type="hidden" name="destination" value={JSON.stringify(selected)}/><input type="hidden" name="method_id" value={selected.id}/><input type="hidden" name="amount" value={amount}/><input type="hidden" name="client_key" value={clientKey}/>
    <div className="border-b border-line px-5 py-4"><h2 className="text-base font-semibold">{d("transfer").replace(/^\d+\.\s*/,"")}</h2></div>
    <div className="space-y-4 p-5">
     {selected.kind==="crypto" && <label className="block text-xs font-semibold text-muted">{d("quantity")} ({selected.crypto_asset})<input name="quantity" required type="number" min="0.000000000000000001" step="any" className={field}/></label>}
     <label className="block text-xs font-semibold text-muted">{d("reference")}<input name="transfer_reference" required minLength={selected.kind==="crypto"?20:4} maxLength={200} pattern={selected.kind==="crypto"?"[A-Za-z0-9]{20,200}":undefined} className={`${field} font-mono`}/></label>
     <label className="flex items-start gap-3 text-sm leading-6"><input name="acknowledged" type="checkbox" required className="mt-1 h-4 w-4 shrink-0 accent-[var(--color-brand)]"/>{d("acknowledge")}</label>
     {state.result==="error" && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{d("error")}</p>}
     <button disabled={pending} className={`${primary} w-full`}><Clock3 size={17} aria-hidden="true"/>{d(pending?"loading":"submit")}</button>
    </div>
   </form>
  </div>}
 </div>;
}
