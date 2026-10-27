"use client";

import Link from "next/link";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useLocale } from "../components/LocaleProvider";
import { createTranslator } from "../lib/translate";

export type UpdatePasswordCopy = {
  title: string;
  intro: string;
  password: string;
  confirmPassword: string;
  placeholder: string;
  mismatch: string;
  update: string;
  updating: string;
  success: string;
  login: string;
};

export default function UpdatePasswordForm({ copy, portal }: { copy: UpdatePasswordCopy; portal: "admin" | "client" }) {
  const t = createTranslator(useLocale());
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [updated, setUpdated] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    if (password !== confirmPassword) {
      setMessage(copy.mismatch);
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setMessage(t(error.status === 429 ? "Please wait before trying again." : error.code === "same_password" ? "Choose a password different from your current password." : error.code === "weak_password" ? "This password is too weak or has appeared in a data breach. Choose a different password with at least 8 characters." : "Your password could not be updated. Request a new reset link and try again."));
      setLoading(false);
      return;
    }

    await supabase.auth.signOut({ scope: "local" });
    setUpdated(true);
    setLoading(false);
  }

  return (
    <main className="min-h-screen bg-canvas px-6 py-32 text-ink">
      <section className="mx-auto w-full max-w-xl bg-white p-8 shadow-sm sm:p-10">
        <p className="text-sm font-semibold uppercase text-brand">{t("Brickwise security")}</p>
        <h1 className="mt-3 text-4xl font-bold sm:text-5xl">{copy.title}</h1>
        <p className="mt-4 text-lg leading-7 text-slate-600">{copy.intro}</p>

        {updated ? (
          <div className="mt-8">
            <div className="border-l-4 border-emerald-500 bg-emerald-50 p-5 text-emerald-800">{copy.success}</div>
            <Link href={portal === "admin" ? "/admin" : "/sign-in"} className="mt-6 inline-flex bg-brand px-7 py-4 font-bold text-white transition hover:bg-brand-strong rounded-lg">
              {copy.login}
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div>
              <label className="text-sm font-bold text-slate-600">{copy.password}</label>
              <input
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="mt-2 w-full border border-line-strong px-5 py-4 text-lg outline-none focus:border-brand"
                placeholder={copy.placeholder}
              />
            </div>
            <div>
              <label className="text-sm font-bold text-slate-600">{copy.confirmPassword}</label>
              <input
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="mt-2 w-full border border-line-strong px-5 py-4 text-lg outline-none focus:border-brand"
                placeholder={copy.placeholder}
              />
            </div>

            {message && <div className="bg-red-50 p-4 text-red-700">{message}</div>}

            <button type="submit" disabled={loading} className="w-full bg-brand py-4 text-lg font-bold text-white transition hover:bg-brand-strong disabled:opacity-60 rounded-lg">
              {loading ? copy.updating : copy.update}
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
