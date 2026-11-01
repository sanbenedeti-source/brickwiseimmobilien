"use client";

import Link from "next/link";
import ConfirmationNotice from "./ConfirmationNotice";
import { useActionState, useState } from "react";
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail } from "lucide-react";
import { useLocale } from "../components/LocaleProvider";
import { createTranslator } from "../lib/translate";
import { signInWithPassword, type SignInState } from "./actions";

export type SignInCopy = {
  title: string;
  intro: string;
  email: string;
  emailPlaceholder: string;
  password: string;
  passwordPlaceholder: string;
  forgotPassword: string;
  sending: string;
  signIn: string;
  noAccount: string;
  join: string;
  accountCreated: string;
};

export default function SignInForm({ copy, initialEmail = "", registered = false, created = false, invalidLink = false, next = "" }: { copy: SignInCopy; initialEmail?: string; registered?: boolean; created?: boolean; invalidLink?: boolean; next?: string }) {
  const t = createTranslator(useLocale());
  const [showPassword, setShowPassword] = useState(false);
  const initialState: SignInState = { error: "" };
  const [state, formAction, pending] = useActionState(signInWithPassword, initialState);

  return (
    <main className="min-h-screen bg-canvas px-5 pb-20 pt-28 text-ink sm:pt-32">
      <section className="mx-auto w-full min-w-0 max-w-[620px]">
        <div className="w-full">
          <h1 className="text-center text-2xl font-bold tracking-tight sm:text-4xl">{copy.title}</h1>

          <p className="mt-3 text-center text-muted">{copy.intro}</p>

          {/* Registration normally signs the client in directly. These notices appear only when
              Supabase still requires an activation link, or the account was created but the
              automatic sign-in did not complete. */}
          {(registered || invalidLink) && <ConfirmationNotice initialEmail={initialEmail} invalidLink={invalidLink} />}
          {created && !registered && !invalidLink && <p role="status" className="mt-8 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-950">{copy.accountCreated}</p>}

          <form action={formAction} className="mt-10 space-y-5">
            {next && <input type="hidden" name="next" value={next} />}
            <div>
              <label htmlFor="sign-in-email" className="text-sm font-bold">{copy.email}</label>
              <div className="mt-2 flex min-h-14 items-center rounded-2xl border border-line-strong bg-white px-4 focus-within:border-brand focus-within:ring-4 focus-within:ring-brand-soft">
              <Mail size={19} className="shrink-0 text-muted" aria-hidden="true" />
              <input
                id="sign-in-email"
                autoComplete="email"
                type="email"
                name="email"
                required
                defaultValue={initialEmail}
                className="min-w-0 flex-1 bg-transparent px-3 py-3 outline-none"
                placeholder={copy.emailPlaceholder}
              />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between gap-4">
                <label htmlFor="sign-in-password" className="text-sm font-bold">{copy.password}</label>
                <Link href="/forgot-password" className="inline-flex min-h-11 items-center text-sm font-semibold text-brand hover:underline">
                  {copy.forgotPassword}
                </Link>
              </div>
              <div className="mt-2 flex min-h-14 items-center rounded-2xl border border-line-strong bg-white px-4 focus-within:border-brand focus-within:ring-4 focus-within:ring-brand-soft">
              <LockKeyhole size={19} className="shrink-0 text-muted" aria-hidden="true" />
              <input
                id="sign-in-password"
                autoComplete="current-password"
                type={showPassword ? "text" : "password"}
                name="password"
                required
                className="min-w-0 flex-1 bg-transparent px-3 py-3 outline-none"
                placeholder={copy.passwordPlaceholder}
              />
              <button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={t("Toggle password visibility")} aria-pressed={showPassword} className="flex h-11 w-11 shrink-0 items-center justify-center text-muted focus-visible:outline-2 focus-visible:outline-brand">
                {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
              </button>
              </div>
            </div>

            {state.error && <div role="alert" className="rounded-2xl bg-red-50 p-4 text-red-700">{state.error}</div>}

            <button
              type="submit"
              disabled={pending}
              className="flex min-h-14 w-full items-center justify-center gap-2 rounded-lg bg-brand px-5 font-bold text-white shadow-[0_12px_30px_rgba(22,103,168,.18)] hover:bg-brand-strong focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand disabled:cursor-not-allowed disabled:bg-brand-light"
            >
              {pending ? copy.sending : copy.signIn}
              {!pending && <ArrowRight size={18} aria-hidden="true" />}
            </button>
          </form>

          <p className="mt-7 text-center text-muted">
            {copy.noAccount}{" "}
            <Link href={/^\/properties\/[a-z0-9-]{1,120}$/.test(next) ? `/join?next=${encodeURIComponent(next)}` : "/join"} className="font-bold text-brand hover:underline">
              {copy.join}
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
