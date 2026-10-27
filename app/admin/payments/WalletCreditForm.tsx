"use client";
import { useActionState, useState } from "react";
import type { Locale } from "@/app/lib/i18n";
import { getAdminText } from "@/app/lib/admin-copy";
import { creditCustomerWallet, type WalletCreditState } from "./actions";

const messages = {
 en: { saved: "Wallet credited. This operation cannot be submitted again.", error: "Credit could not be completed. Retry this operation; do not create a new one until its status is checked.", pending: "Processing…", next: "Start a new credit" },
 de: { saved: "Wallet gutgeschrieben. Dieser Vorgang kann nicht erneut gesendet werden.", error: "Gutschrift nicht abgeschlossen. Wiederholen Sie diesen Vorgang; erstellen Sie keinen neuen, bevor der Status geprüft wurde.", pending: "Wird verarbeitet…", next: "Neue Gutschrift starten" },
 fr: { saved: "Portefeuille crédité. Cette opération ne peut plus être envoyée.", error: "Crédit non terminé. Réessayez cette opération ; n’en créez pas une nouvelle avant de vérifier son statut.", pending: "Traitement…", next: "Commencer un nouveau crédit" },
 es: { saved: "Saldo abonado. Esta operación no se puede enviar de nuevo.", error: "No se pudo completar el abono. Reintenta esta operación; no crees otra antes de comprobar su estado.", pending: "Procesando…", next: "Iniciar un nuevo abono" },
 it: { saved: "Wallet accreditato. Questa operazione non può essere inviata di nuovo.", error: "Accredito non completato. Riprova questa operazione; non crearne una nuova prima di verificarne lo stato.", pending: "Elaborazione…", next: "Avvia un nuovo accredito" },
};
export default function WalletCreditForm({userId,operationId,locale}:{userId:string;operationId:string;locale:Locale}) {
 // Preserve the operation identity across server revalidation and retries.
 const [key]=useState(operationId);
 const [state,action,pending]=useActionState(creditCustomerWallet,{result:""} as WalletCreditState);
 const t=getAdminText(locale), copy=messages[locale];
 return <form action={action} className="mt-5 space-y-3 border-t border-slate-200 pt-5">
  <input type="hidden" name="user_id" value={userId}/><input type="hidden" name="operation_id" value={key}/><input type="hidden" name="currency" value="EUR"/>
  <div className="grid grid-cols-[1fr_auto] gap-3"><label className="text-sm font-bold text-slate-600">{t("Add wallet funds (EUR)")}<input name="amount" type="number" min="0.01" max="10000000" step="0.01" required disabled={pending || state.result==="saved"} placeholder="5000" className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-4"/></label><button disabled={pending || state.result==="saved"} className="self-end rounded-xl bg-emerald-700 px-5 py-3 text-sm font-bold text-white disabled:opacity-50">{pending?copy.pending:t("Credit wallet")}</button></div>
  {state.result && <p role="status" className={`text-sm ${state.result==="saved"?"text-emerald-700":"text-red-700"}`}>{copy[state.result]}</p>}
  {state.result==="saved" && <a href="/admin" className="inline-block text-sm font-bold text-sky-700 underline">{copy.next}</a>}
 </form>;
}
