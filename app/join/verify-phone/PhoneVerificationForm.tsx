"use client";

import { useState } from "react";

type PhoneVerificationCopy = { eyebrow: string; title: string; intro: string; phone: string; code: string; invalid: string; verifying: string; submit: string };

export default function PhoneVerificationForm({ initialPhone, copy }: { initialPhone: string; copy: PhoneVerificationCopy }) {
  const [phone, setPhone] = useState(initialPhone);
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function verify(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    const response = await fetch("/authentication/verify-phone", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ phone, token }),
    });
    const result = await response.json().catch(() => ({})) as { error?: string; redirectTo?: string };
    if (!response.ok) {
      setMessage(result.error || copy.invalid);
      setLoading(false);
      return;
    }
    window.sessionStorage.removeItem("brickwise-pending-phone");
    window.location.replace(result.redirectTo || "/dashboard");
  }

  return <main className="min-h-screen bg-[#f5f5f2] text-[#17233f]"><section className="mx-auto flex min-h-screen max-w-7xl items-center justify-center px-5 py-28"><div className="w-full max-w-xl bg-white p-7 shadow-sm md:p-10"><p className="text-sm font-bold uppercase tracking-wide text-[#2f9bdb]">{copy.eyebrow}</p><h1 className="mt-3 text-4xl font-bold">{copy.title}</h1><p className="mt-4 leading-7 text-[#687486]">{copy.intro}</p><form onSubmit={verify} className="mt-8 grid gap-5"><label className="text-sm font-bold">{copy.phone}<input type="tel" required value={phone} onChange={(event) => setPhone(event.target.value)} className="mt-2 h-13 w-full border border-[#cfd6df] px-4 text-lg" /></label><label className="text-sm font-bold">{copy.code}<input type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" minLength={6} maxLength={6} required value={token} onChange={(event) => setToken(event.target.value.replace(/\D/g, "").slice(0, 6))} className="mt-2 h-14 w-full border border-[#cfd6df] px-4 text-center text-3xl tracking-[0.3em]" /></label>{message && <p className="bg-red-50 p-4 text-red-700">{message}</p>}<button disabled={loading || token.length !== 6} className="min-h-13 bg-[#17233f] px-5 font-bold text-white disabled:opacity-50">{loading ? copy.verifying : copy.submit}</button></form></div></section></main>;
}
