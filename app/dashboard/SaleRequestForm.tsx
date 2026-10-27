"use client";

import { useActionState, useState } from "react";
import { ArrowLeftRight, CheckCircle2 } from "lucide-react";
import { localeHtmlLang, type Locale } from "../lib/i18n";
import { fillTemplate, portalCopy } from "../lib/portal-copy";
import { requestShareSale, type SaleState } from "./portal-actions";
import { fieldClass, primaryButtonClass } from "./portal-ui";

export default function SaleRequestForm({ locale, holdings, requestKey }: { locale: Locale; holdings: { slug: string; title: string; shares: number }[]; requestKey: string }) {
  const text = portalCopy[locale];
  // One key per request: a resubmitted form returns the same request instead of creating a duplicate.
  const [key, setKey] = useState(requestKey);
  const [slug, setSlug] = useState(holdings[0]?.slug || "");
  const [state, action, pending] = useActionState(async (previous: SaleState, form: FormData) => {
    const next = await requestShareSale(previous, form);
    if (next.result === "saved") setKey(crypto.randomUUID());
    return next;
  }, { result: "" } as SaleState);
  const held = holdings.find((holding) => holding.slug === slug)?.shares || 0;
  return <form action={action} className="grid gap-4">
    <input type="hidden" name="client_key" value={key} />
    <div className="grid gap-4">
      <label className="text-xs font-semibold text-muted">{text.property}
        <select name="property_slug" required value={slug} onChange={(event) => setSlug(event.target.value)} className={fieldClass}>
          {holdings.map((holding) => <option key={holding.slug} value={holding.slug}>{holding.title}</option>)}
        </select>
      </label>
      <label className="text-xs font-semibold text-muted">{text.saleShares}<input name="shares" type="number" required min={1} max={held || undefined} step={1} className={`${fieldClass} max-w-[200px] font-semibold tabular-nums`} /></label>
    </div>
    <p className="-mt-2 text-xs text-muted">{fillTemplate(text.sharesHeld, { shares: held.toLocaleString(localeHtmlLang[locale]) })}</p>
    <label className="text-xs font-semibold text-muted">{text.saleNote}<textarea name="note" maxLength={1000} rows={3} className={fieldClass} /></label>
    {state.result === "saved" && <p role="status" className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800"><CheckCircle2 size={16} className="mt-0.5 shrink-0" aria-hidden="true" />{text.saleSaved}</p>}
    {state.result === "tooMany" && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{text.saleTooMany}</p>}
    {state.result === "error" && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{text.saleError}</p>}
    <div><button disabled={pending} className={`${primaryButtonClass} disabled:opacity-60`}><ArrowLeftRight size={16} aria-hidden="true" />{pending ? text.withdrawSubmitting : text.saleSubmit}</button></div>
  </form>;
}
