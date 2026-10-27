"use client";

import { useActionState, useState, useTransition } from "react";
import { startAdminMfaEnrollment, verifyAdminMfa, type MfaEnrollment, type MfaVerifyState } from "./actions";

export type MfaCopy = { start: string; starting: string; scan: string; secret: string; code: string; verify: string; verifying: string };

function CodeForm({ copy, factorId }: { copy: MfaCopy; factorId?: string }) {
  const [state, action, pending] = useActionState(verifyAdminMfa, { error: "" } as MfaVerifyState);
  return <form action={action} className="mt-6 space-y-4">
    {factorId && <input type="hidden" name="factor_id" value={factorId} />}
    <label className="block text-sm font-bold text-slate-600">{copy.code}
      <input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]{6,7}" maxLength={7} required autoFocus
        className="mt-2 w-full rounded-xl border border-line-strong px-4 py-3.5 text-center text-2xl tracking-[0.4em] outline-none focus:border-brand" />
    </label>
    {state.error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm font-semibold text-red-700">{state.error}</p>}
    <button disabled={pending} className="w-full rounded-xl bg-brand py-4 font-bold text-white disabled:opacity-60">{pending ? copy.verifying : copy.verify}</button>
  </form>;
}

export function MfaChallenge({ copy }: { copy: MfaCopy }) {
  return <CodeForm copy={copy} />;
}

export function MfaEnroll({ copy }: { copy: MfaCopy }) {
  const [enrollment, setEnrollment] = useState<MfaEnrollment | null>(null);
  const [pending, startTransition] = useTransition();
  if (!enrollment || "error" in enrollment) return <div className="mt-6 space-y-4">
    {enrollment && "error" in enrollment && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm font-semibold text-red-700">{enrollment.error}</p>}
    <button type="button" disabled={pending} onClick={() => startTransition(async () => setEnrollment(await startAdminMfaEnrollment()))}
      className="w-full rounded-xl bg-brand py-4 font-bold text-white disabled:opacity-60">{pending ? copy.starting : copy.start}</button>
  </div>;
  return <div className="mt-6">
    <p className="text-sm leading-6 text-slate-600">{copy.scan}</p>
    {/* eslint-disable-next-line @next/next/no-img-element -- Supabase returns the QR code as an SVG data URL. */}
    <img src={enrollment.qrCode} alt="" width={200} height={200} className="mx-auto mt-4 rounded-xl border border-slate-200 bg-white p-2" />
    <p className="mt-4 text-sm text-slate-600">{copy.secret}</p>
    <code className="mt-1 block break-all rounded-lg bg-slate-100 p-3 text-sm">{enrollment.secret}</code>
    <CodeForm copy={copy} factorId={enrollment.factorId} />
  </div>;
}
