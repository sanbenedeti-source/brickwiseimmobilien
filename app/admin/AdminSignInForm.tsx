"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signInAdmin, type AdminSignInState } from "./sign-in-actions";

export type AdminSignInCopy = { title: string; intro: string; clientSession: string; email: string; password: string; submitting: string; submit: string; forgot: string; back: string };

export default function AdminSignInForm({ currentEmail, copy }: { currentEmail?: string; copy: AdminSignInCopy }) {
  const [state, action, pending] = useActionState(signInAdmin, { error: "" } as AdminSignInState);
  return (
    <main className="flex min-h-screen items-center justify-center bg-ink px-6 py-20 text-ink">
      <div className="w-full max-w-lg rounded-[28px] bg-white p-8 shadow-2xl sm:p-10">
        <p className="text-sm font-bold uppercase tracking-[0.18em] text-brand">Brickwise Immobilien</p>
        <h1 className="mt-3 text-4xl font-bold">{copy.title}</h1>
        <p className="mt-3 text-slate-600">{copy.intro}</p>
        {currentEmail && (
          <div className="mt-6 rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">
            {copy.clientSession} <strong>{currentEmail}</strong>
          </div>
        )}
        <form action={action} className="mt-7 space-y-5">
          <label className="block text-sm font-bold text-slate-600">{copy.email}
            <input name="email" type="email" required className="mt-2 w-full rounded-xl border border-line-strong px-4 py-3.5 text-base outline-none focus:border-brand" />
          </label>
          <label className="block text-sm font-bold text-slate-600">{copy.password}
            <input name="password" type="password" required className="mt-2 w-full rounded-xl border border-line-strong px-4 py-3.5 text-base outline-none focus:border-brand" />
          </label>
          {state.error && <div className="rounded-xl bg-red-50 p-4 text-sm font-semibold text-red-700">{state.error}</div>}
          <button disabled={pending} className="w-full rounded-xl bg-brand py-4 font-bold text-white disabled:opacity-60">{pending ? copy.submitting : copy.submit}</button>
        </form>
        <div className="mt-6 flex items-center justify-between text-sm">
          <Link href="/forgot-password?portal=admin" className="font-semibold text-brand">{copy.forgot}</Link>
          <Link href="/" className="text-slate-500">{copy.back}</Link>
        </div>
      </div>
    </main>
  );
}
