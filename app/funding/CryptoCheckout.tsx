"use client";
import { useState } from "react";
import { ArrowRight, ShieldCheck } from "lucide-react";
import type { Locale } from "../lib/i18n";
import { depositText } from "./deposit-copy";

const field = "mt-1.5 block min-h-11 w-full rounded-lg border border-line-strong bg-white px-3 text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15";
const primary = "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-brand px-5 text-sm font-semibold text-white hover:bg-brand-strong disabled:opacity-50";

/** Amount entry for an automatic crypto deposit; CoinGate's page handles coin, network and payment. */
export default function CryptoCheckout({ locale }: { locale: Locale }) {
  const d = depositText(locale);
  const [amount, setAmount] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true); setError("");
    try {
      const response = await fetch("/api/deposits/coingate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, clientKey: crypto.randomUUID() }),
      });
      const result = await response.json().catch(() => ({})) as { url?: string; error?: string };
      if (response.ok && result.url) { window.location.assign(result.url); return; }
      setError(result.error === "tooMany" ? d("gatewayTooMany") : result.error === "amount" ? d("gatewayMin") : d("gatewayError"));
    } catch { setError(d("gatewayError")); }
    setPending(false);
  }
  return <div className="space-y-6">
    <ol className="grid gap-3 md:grid-cols-3">{(["gatewayStep1", "gatewayStep2", "gatewayStep3"] as const).map((key, index) =>
      <li key={key} aria-current={index === 0 ? "step" : undefined} className={`relative flex items-center gap-3 overflow-hidden rounded-xl border bg-white px-4 py-3 text-sm ${index === 0 ? "border-brand" : "border-line"}`}>
        {index === 0 && <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1 bg-brand" />}
        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${index === 0 ? "bg-brand text-white" : "bg-canvas text-muted"}`}>{index + 1}</span>
        <span className={index === 0 ? "font-semibold text-ink" : "text-muted"}>{d(key).replace(/^\d+\.\s*/, "")}</span>
      </li>)}</ol>
    <form onSubmit={submit} className="rounded-xl border border-line bg-white">
      <div className="border-b border-line px-5 py-4"><h2 className="text-base font-semibold">{d("gatewayTitle")}</h2><p className="mt-1 max-w-3xl text-sm leading-6 text-muted">{d("gatewayIntro")}</p></div>
      <div className="space-y-5 p-5">
        <label htmlFor="gateway-amount" className="block max-w-sm text-xs font-semibold text-muted">{d("amount")}
          <span className="relative mt-1.5 block"><span aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm font-semibold text-muted">€</span>
            <input id="gateway-amount" type="number" min="10" max="1000000" step="0.01" required value={amount} onChange={(event) => setAmount(event.target.value)} className={`${field} mt-0 pl-8 text-base font-semibold tabular-nums`} placeholder="500.00" /></span>
          <span className="mt-1 block font-normal">{d("gatewayMin")}</span>
        </label>
        <p className="flex items-start gap-2 rounded-lg bg-canvas px-3 py-2.5 text-xs leading-5 text-muted"><ShieldCheck size={15} className="mt-0.5 shrink-0 text-brand" aria-hidden="true" />{d("gatewayNote")}</p>
        {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
        <button disabled={pending} className={primary}>{pending ? d("loading") : d("gatewaySubmit")}<ArrowRight size={17} aria-hidden="true" /></button>
      </div>
    </form>
  </div>;
}
