"use client";

import Link from "next/link";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useLocale } from "../components/LocaleProvider";
import { createTranslator } from "../lib/translate";

export type ForgotPasswordCopy = {
  title: string;
  intro: string;
  email: string;
  emailPlaceholder: string;
  send: string;
  sending: string;
  success: string;
  invalidLink: string;
  back: string;
};

export default function ForgotPasswordForm({
  copy,
  invalidLink,
  portal,
}: {
  copy: ForgotPasswordCopy;
  invalidLink: boolean;
  portal: "admin" | "client";
}) {
  const [email, setEmail] = useState("");
  const t = createTranslator(useLocale());
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(invalidLink ? copy.invalidLink : "");
  const [sent, setSent] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    const supabase = createClient();
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
    const nextPath = portal === "admin" ? "/update-password?portal=admin" : "/update-password?portal=client";
    const redirectTo = `${siteUrl.replace(/\/$/, "")}/authentication/callback?next=${encodeURIComponent(nextPath)}`;
    const { error } = await supabase.auth.resetPasswordForEmail(
      email.trim().toLowerCase(),
      { redirectTo },
    );

    setLoading(false);

    if (error) {
      setMessage(t(error.status === 429 ? "Please wait before trying again." : "The password reset email could not be sent. Please try again."));
      return;
    }

    setSent(true);
  }

  return (
    <main className="min-h-screen bg-canvas px-6 py-32 text-ink">
      <section className="mx-auto w-full max-w-xl bg-white p-8 shadow-sm sm:p-10">
        <p className="text-sm font-semibold uppercase text-brand">{t("Brickwise security")}</p>
        <h1 className="mt-3 text-4xl font-bold sm:text-5xl">{copy.title}</h1>
        <p className="mt-4 text-lg leading-7 text-slate-600">{copy.intro}</p>

        {sent ? (
          <div role="status" className="mt-8 border-l-4 border-emerald-500 bg-emerald-50 p-5 text-emerald-800">
            {copy.success}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div>
              <label htmlFor="forgot-email" className="text-sm font-bold text-slate-600">{copy.email}</label>
              <input
                id="forgot-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="mt-2 w-full border border-line-strong px-5 py-4 text-lg outline-none focus:border-brand"
                placeholder={copy.emailPlaceholder}
              />
            </div>

            {message && <div role="alert" className="bg-red-50 p-4 text-red-700">{message}</div>}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-brand py-4 text-lg font-bold text-white transition hover:bg-brand-strong disabled:opacity-60 rounded-lg"
            >
              {loading ? copy.sending : copy.send}
            </button>
          </form>
        )}

        <Link href={portal === "admin" ? "/admin" : "/sign-in"} className="mt-5 inline-flex min-h-11 items-center font-semibold text-brand hover:underline">
          {copy.back}
        </Link>
      </section>
    </main>
  );
}
