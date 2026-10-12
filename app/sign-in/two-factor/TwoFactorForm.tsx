"use client";

import Link from "next/link";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useLocale } from "../../components/LocaleProvider";
import { createTranslator } from "../../lib/translate";

export type TwoFactorCopy = {
  title: string;
  intro: string;
  email: string;
  emailPlaceholder: string;
  code: string;
  newCodeSent: string;
  invalidCode: string;
  checking: string;
  confirm: string;
  sending: string;
  resend: string;
  back: string;
};

export default function TwoFactorForm({
  copy,
  initialEmail,
}: {
  copy: TwoFactorCopy;
  initialEmail: string;
}) {
  const supabase = createClient();
  const t = createTranslator(useLocale());

  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [message, setMessage] = useState("");

  function getAuthRedirectUrl() {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
    return `${siteUrl.replace(/\/$/, "")}/authentication/callback`;
  }

  async function handleVerify(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    const normalizedEmail = email.trim().toLowerCase();
    const token = code.replace(/\D/g, "");

    if (!normalizedEmail) {
      setMessage(copy.emailPlaceholder);
      setLoading(false);
      return;
    }

    if (token.length !== 6) {
      setMessage(copy.invalidCode);
      setLoading(false);
      return;
    }

    const response = await fetch("/authentication/verify-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ email: normalizedEmail, token }),
    });
    const result = (await response.json().catch(() => ({}))) as {
      error?: string;
      redirectTo?: string;
    };

    if (!response.ok) {
      setMessage(result.error || copy.invalidCode);
      setLoading(false);
      return;
    }

    window.sessionStorage.removeItem("brickwise-pending-otp-email");
    window.location.replace(result.redirectTo || "/dashboard");
  }

  async function handleResend() {
    setResending(true);
    setMessage("");
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      setMessage(copy.emailPlaceholder);
      setResending(false);
      return;
    }

    const { error } = await supabase.auth.signInWithOtp({
      email: normalizedEmail,
      options: {
        emailRedirectTo: getAuthRedirectUrl(),
        shouldCreateUser: false,
      },
    });

    if (error) {
      setMessage(t(error.status === 429 ? "Please wait before trying again." : "The security code could not be sent. Please try again."));
      setResending(false);
      return;
    }

    setCode("");
    window.sessionStorage.setItem("brickwise-pending-otp-email", normalizedEmail);
    setMessage(copy.newCodeSent);
    setResending(false);
  }

  return (
    <main className="min-h-screen bg-[#f5f5f2] text-[#111111]">
      <section className="mx-auto flex min-h-screen max-w-7xl items-center justify-center px-6 py-32">
        <div className="w-full max-w-xl rounded-[32px] bg-white p-10 shadow-sm">
          <h1 className="font-display text-5xl font-bold">{copy.title}</h1>

          <p className="mt-4 text-lg text-slate-600">{copy.intro}</p>

          <form onSubmit={handleVerify} className="mt-8 space-y-5">
            <div>
              <label className="text-sm font-bold text-slate-600">{copy.email}</label>
              <input
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value.trim().toLowerCase())}
                className="mt-2 w-full rounded-2xl border border-slate-200 px-5 py-4 text-lg outline-none focus:border-[#0F172A]"
                placeholder={copy.emailPlaceholder}
              />
            </div>

            <div>
              <label className="text-sm font-bold text-slate-600">{copy.code}</label>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                minLength={6}
                maxLength={6}
                pattern="[0-9]{6}"
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                className="mt-2 w-full rounded-2xl border border-slate-200 px-5 py-4 text-center text-3xl tracking-[0.35em] outline-none focus:border-[#0F172A]"
                placeholder="000000"
              />
            </div>

            {message && <div className="rounded-2xl bg-slate-50 p-4 text-slate-700">{message}</div>}

            <button
              type="submit"
              disabled={loading || !email.trim() || code.length !== 6}
              className="w-full rounded-2xl bg-[#0F172A] py-4 text-lg font-bold text-white disabled:opacity-60"
            >
              {loading ? copy.checking : copy.confirm}
            </button>
          </form>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
            <button
              type="button"
              onClick={handleResend}
              disabled={resending || !email.trim()}
              className="font-bold text-[#0F172A] disabled:opacity-60"
            >
              {resending ? copy.sending : copy.resend}
            </button>

            <Link href="/sign-in" className="font-bold text-slate-500">
              {copy.back}
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
