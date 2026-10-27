"use client";
import { useActionState } from "react";
import { reviewAgreement, type AgreementReviewState } from "./actions";
import { agreementCopy } from "@/app/lib/agreement-copy";
import type { Locale } from "@/app/lib/i18n";

export default function ReviewForm({ id, locale }: { id: string; locale: Locale }) {
  const copy = agreementCopy(locale);
  const [state, action, pending] = useActionState(reviewAgreement, { result: "" } as AgreementReviewState);
  return <form action={action} className="admin-form">
    <input type="hidden" name="id" value={id} />
    <label className="admin-field">{copy.note}
      <textarea name="note" required minLength={3} maxLength={1000} rows={3} />
    </label>
    {state.result && <p role="status" className={`admin-alert !mb-0 ${state.result === "error" ? "admin-alert-danger" : "admin-alert-success"}`}>{state.result === "error" ? copy.unavailable : copy.saved}</p>}
    <div className="flex flex-wrap gap-2">
      <button name="decision" value="approved" disabled={pending} className="admin-btn admin-btn-success">{copy.approve}</button>
      <button name="decision" value="rejected" disabled={pending} className="admin-btn admin-btn-danger-outline">{copy.reject}</button>
    </div>
  </form>;
}
