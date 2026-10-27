"use client";
import { useState } from "react";
import { BadgeCheck, CircleAlert, Mail, MessageCircle, ShieldX } from "lucide-react";
import type { Locale } from "../lib/i18n";
import { agentCopy } from "../lib/agent-copy";
import type { AgentLanguage, AgentLookupKind } from "../lib/agent-verification";

type Result =
  | { result: "verified"; agent: { code: string; name: string; title: string; languages: AgentLanguage[]; email: string | null; phone: string | null } }
  | { result: "inactive"; agent: { name: string } }
  | { result: "notFound" | "invalid" | "rateLimited" | "error" };

const field = "mt-1.5 block min-h-12 w-full rounded-lg border border-line-strong bg-white px-3 text-base text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15";

export default function AgentVerifyForm({ locale, initialCode }: { locale: Locale; initialCode: string }) {
  const text = agentCopy[locale];
  const [kind, setKind] = useState<AgentLookupKind>("code");
  const [value, setValue] = useState(initialCode);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const labels: Record<AgentLookupKind, string> = { code: text.byCode, email: text.byEmail, phone: text.byPhone };
  const placeholders: Record<AgentLookupKind, string> = { code: "BW-ABC234", email: "name@example.com", phone: "+49 1521 0000000" };

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true); setResult(null);
    try {
      const response = await fetch("/api/agents/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, value }) });
      setResult(await response.json().catch(() => ({ result: "error" })) as Result);
    } catch { setResult({ result: "error" }); }
    setPending(false);
  }

  return <div className="grid gap-5">
    <form onSubmit={submit} className="rounded-2xl border border-line bg-white p-5 sm:p-6">
      <fieldset>
        <legend className="text-xs font-semibold text-muted">{text.checkBy}</legend>
        <div className="mt-2 inline-flex flex-wrap rounded-lg border border-line bg-canvas p-1">
          {(["code", "email", "phone"] as const).map((option) => <label key={option} className={`cursor-pointer rounded-md px-3.5 py-2 text-sm font-semibold ${kind === option ? "bg-white text-ink shadow-sm ring-1 ring-line" : "text-muted hover:text-ink"}`}>
            <input type="radio" name="kind" value={option} checked={kind === option} onChange={() => { setKind(option); setValue(""); setResult(null); }} className="sr-only" />{labels[option]}
          </label>)}
        </div>
      </fieldset>
      <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <label className="text-xs font-semibold text-muted">{labels[kind]}
          <input value={value} onChange={(event) => setValue(event.target.value)} required maxLength={254} autoComplete="off" spellCheck={false}
            type={kind === "email" ? "email" : kind === "phone" ? "tel" : "text"} placeholder={placeholders[kind]} className={`${field} ${kind === "code" ? "font-mono uppercase tracking-wider" : ""}`} />
        </label>
        <button disabled={pending} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-brand px-6 text-sm font-semibold text-white hover:bg-brand-strong disabled:opacity-60">{pending ? text.checking : text.submit}</button>
      </div>
      {kind === "phone" && <p className="mt-2 text-xs text-muted">{text.phoneHint}</p>}
    </form>

    <div aria-live="polite">
      {result?.result === "verified" && <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 sm:p-6">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-emerald-900"><BadgeCheck size={22} aria-hidden="true" />{text.verifiedTitle}</h2>
        <p className="mt-3 text-xl font-semibold text-ink">{result.agent.name}</p>
        <dl className="mt-4 grid gap-x-8 gap-y-3 text-[15px] sm:grid-cols-2">
          <div><dt className="text-xs font-semibold uppercase tracking-wide text-emerald-800/80">{text.code}</dt><dd className="mt-0.5 font-mono font-semibold text-ink">{result.agent.code}</dd></div>
          <div><dt className="text-xs font-semibold uppercase tracking-wide text-emerald-800/80">{text.role}</dt><dd className="mt-0.5 text-ink">{result.agent.title === "Brickwise agent" ? text.defaultTitle : result.agent.title}</dd></div>
          {result.agent.languages.length > 0 && <div><dt className="text-xs font-semibold uppercase tracking-wide text-emerald-800/80">{text.languagesLabel}</dt><dd className="mt-0.5 text-ink">{result.agent.languages.map((language) => text.languageNames[language] || language).join(", ")}</dd></div>}
          <div><dt className="text-xs font-semibold uppercase tracking-wide text-emerald-800/80">{text.contact}</dt><dd className="mt-0.5 grid gap-1 text-ink">
            {result.agent.email && <a href={`mailto:${result.agent.email}`} className="inline-flex items-center gap-2 break-all underline-offset-4 hover:underline"><Mail size={15} aria-hidden="true" />{result.agent.email}</a>}
            {result.agent.phone && <a href={`https://wa.me/${result.agent.phone.replace(/^\+/, "")}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 underline-offset-4 hover:underline"><MessageCircle size={15} aria-hidden="true" />WhatsApp {result.agent.phone}</a>}
          </dd></div>
        </dl>
        <p className="mt-4 text-sm leading-6 text-emerald-900">{text.verifiedText}</p>
      </section>}
      {result?.result === "inactive" && <section className="rounded-2xl border border-amber-300 bg-amber-50 p-5 sm:p-6">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-amber-950"><CircleAlert size={22} aria-hidden="true" />{text.inactiveTitle}</h2>
        <p className="mt-2 text-[15px] leading-6 text-amber-950">{text.inactiveText.replace("{name}", result.agent.name)}</p>
      </section>}
      {result?.result === "notFound" && <section className="rounded-2xl border border-red-200 bg-red-50 p-5 sm:p-6">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-red-900"><ShieldX size={22} aria-hidden="true" />{text.notFoundTitle}</h2>
        <p className="mt-2 text-[15px] leading-6 text-red-900">{text.notFoundText}</p>
      </section>}
      {result && ["invalid", "rateLimited", "error"].includes(result.result) && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{result.result === "invalid" ? text.invalid : result.result === "rateLimited" ? text.rateLimited : text.error}</p>}
    </div>
  </div>;
}
