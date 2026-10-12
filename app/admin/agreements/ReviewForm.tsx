"use client";
import { useActionState } from "react";
import { reviewAgreement, type AgreementReviewState } from "./actions";
import { agreementCopy } from "@/app/lib/agreement-copy";
import type { Locale } from "@/app/lib/i18n";

export default function ReviewForm({ id, locale }: { id: string; locale: Locale }) {
  const copy = agreementCopy(locale);
  const [state, action, pending] = useActionState(reviewAgreement, { result: "" } as AgreementReviewState);
  return <form action={action} className="mt-5 space-y-4 border-t border-slate-200 pt-5">
    <input type="hidden" name="id" value={id} />
    <label className="block text-sm font-bold">{copy.note}
      <textarea name="note" required minLength={3} maxLength={1000} className="mt-2 block min-h-24 w-full rounded-lg border border-slate-300 p-3 font-normal" />
    </label>
    <p className="text-sm text-slate-600">{copy.reviewIntro}</p>
    {state.result && <p role="status" className={state.result === "error" ? "text-red-700" : "text-emerald-700"}>{state.result === "error" ? copy.unavailable : copy.saved}</p>}
    <div className="flex flex-wrap gap-3">
      <button name="decision" value="approved" disabled={pending} className="rounded-lg bg-emerald-700 px-5 py-3 font-bold text-white disabled:opacity-50">{copy.approve}</button>
      <button name="decision" value="rejected" disabled={pending} className="rounded-lg border border-red-200 px-5 py-3 font-bold text-red-700 disabled:opacity-50">{copy.reject}</button>
    </div>
  </form>;
}
