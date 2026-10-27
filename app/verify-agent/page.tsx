import { cookies } from "next/headers";
import { Mail, Phone, ShieldAlert, ShieldCheck } from "lucide-react";
import { company } from "../lib/company";
import { agentCopy } from "../lib/agent-copy";
import { localeCookieName, normalizeLocale } from "../lib/i18n";
import { normalizeAgentCode } from "../lib/agent-verification";
import { utilityMetadata } from "../lib/utility-metadata";
import AgentVerifyForm from "./AgentVerifyForm";

export function generateMetadata() {
  return utilityMetadata("verifyAgent");
}

export default async function VerifyAgentPage({ searchParams }: { searchParams?: Promise<{ code?: string }> } = {}) {
  const locale = normalizeLocale((await cookies()).get(localeCookieName)?.value) || "en";
  const text = agentCopy[locale];
  const initialCode = normalizeAgentCode(String((await searchParams)?.code || "")) || "";
  return <main className="bg-canvas text-ink">
    <section className="mx-auto max-w-4xl px-6 pb-20 pt-32 sm:pt-36">
      <p className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-brand"><ShieldCheck size={18} aria-hidden="true" />BRICKWISE</p>
      <h1 className="font-display mt-3 text-4xl font-bold leading-tight sm:text-5xl">{text.title}</h1>
      <p className="mt-5 max-w-3xl text-lg leading-relaxed text-slate-600">{text.intro}</p>
      <div className="mt-10"><AgentVerifyForm locale={locale} initialCode={initialCode} /></div>
      <div className="mt-10 grid gap-5 md:grid-cols-2">
        <section className="rounded-2xl border border-line bg-white p-6">
          <h2 className="flex items-center gap-2 text-lg font-semibold"><ShieldAlert size={20} className="text-red-600" aria-hidden="true" />{text.rulesTitle}</h2>
          <ul className="mt-4 space-y-3 text-[15px] leading-6 text-slate-700">{text.rules.map((rule) => <li key={rule} className="flex gap-3"><span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" />{rule}</li>)}</ul>
        </section>
        <div className="grid gap-5">
          <section className="rounded-2xl border border-line bg-white p-6">
            <h2 className="text-lg font-semibold">{text.paymentTitle}</h2>
            <p className="mt-3 text-[15px] leading-6 text-slate-700">{text.paymentText}</p>
          </section>
          <section className="rounded-2xl bg-ink p-6 text-white">
            <h2 className="text-lg font-semibold">{text.reportTitle}</h2>
            <p className="mt-2 text-[15px] leading-6 text-white/75">{text.reportText}</p>
            <div className="mt-4 grid gap-2 text-[15px]">
              <a href={`mailto:${company.email}`} className="inline-flex items-center gap-2 underline-offset-4 hover:underline"><Mail size={17} aria-hidden="true" />{company.email}</a>
              <a href={`tel:${company.phone}`} className="inline-flex items-center gap-2 underline-offset-4 hover:underline"><Phone size={17} aria-hidden="true" />{company.phoneDisplay}</a>
            </div>
          </section>
        </div>
      </div>
    </section>
  </main>;
}
