"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarDays, Calculator, TrendingUp } from "lucide-react";
import { localeHtmlLang, type Locale } from "../lib/i18n";
import { dailyIncomeCopy } from "./daily-income-copy";
import { dailyIncome, type DailyIncomePosition, type IncomePurchase } from "./daily-income-model";

export default function DailyIncome({ positions, purchases, locale, asOf, historyAvailable }: {
  positions: DailyIncomePosition[]; purchases: IncomePurchase[]; locale: Locale; asOf: number; historyAvailable: boolean;
}) {
  const copy = dailyIncomeCopy[locale];
  const [now, setNow] = useState(asOf);
  const [slug, setSlug] = useState("");
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  const money = (value: number) => new Intl.NumberFormat(localeHtmlLang[locale], { style: "currency", currency: "EUR", minimumFractionDigits: 2 }).format(value);
  const date = (value: number) => new Intl.DateTimeFormat(localeHtmlLang[locale], { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(value);
  const percent = (value: number) => new Intl.NumberFormat(localeHtmlLang[locale], { style: "percent", maximumFractionDigits: 2 }).format(value / 100);
  const selected = positions.filter(p => !slug || p.slug === slug);
  const calculations = selected.map(p => ({ position: p, model: dailyIncome(p, purchases, now) }));
  const valid = historyAvailable && calculations.length > 0 && calculations.every(p => p.model !== null);
  const models = calculations.flatMap(p => p.model ? [p.model] : []);
  const total = models.reduce((sum, m) => sum + m.accrued, 0);
  const daily = models.reduce((sum, m) => sum + m.daily, 0);
  const days = Math.max(0, ...models.map(m => m.days));
  const rows = Array.from({ length: 14 }, (_, i) => ({ at: now - i * 86_400_000, profit: models.reduce((sum, m) => sum + m.history[i].profit, 0), total: models.reduce((sum, m) => sum + m.history[i].total, 0) }))
    .filter(row => models.some(m => row.at >= m.start));

  if (!positions.length && historyAvailable) return <section className="rounded-3xl border border-dashed border-sky-200 bg-white p-10 text-center"><CalendarDays className="mx-auto text-sky-600" size={36} /><h2 className="mt-5 text-2xl font-bold">{copy.title}</h2><p className="mt-3 text-slate-500">{copy.empty}</p><Link href="/dashboard/marketplace" className="mt-6 inline-block rounded-xl bg-sky-700 px-5 py-3 font-semibold text-white">{copy.browse}</Link></section>;

  return <div className="space-y-6">
    <section className="rounded-3xl bg-[#10213e] p-6 text-white sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-5"><div><p className="text-xs font-semibold uppercase tracking-widest text-sky-300">{copy.portfolio}</p><h2 className="mt-3 text-3xl font-bold">{copy.title}</h2><p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">{copy.intro}</p></div><Calculator size={32} className="text-sky-300" /></div>
      <label className="mt-6 block max-w-sm text-sm">{copy.property}<select value={slug} onChange={e => setSlug(e.target.value)} className="mt-2 block min-h-12 w-full rounded-xl border border-slate-500 bg-[#172f50] px-3 text-white"><option value="">{copy.all}</option>{positions.map(p => <option key={p.slug} value={p.slug}>{p.title}</option>)}</select></label>
      {valid ? <><div className="mt-7 grid gap-4 sm:grid-cols-3"><Metric label={copy.accrued} value={money(total)} /><Metric label={copy.daily} value={money(daily)} /><Metric label={copy.days} value={String(days)} /></div><div className="mt-5 flex flex-wrap justify-between gap-3 text-xs text-slate-300"><span>{copy.next}: {date(Math.min(...models.map(m => m.next)))} UTC</span><span>{copy.refresh}</span></div></> : <p role="status" className="mt-6 rounded-xl bg-white/10 p-5 text-sm leading-6">{copy.unavailable}</p>}
    </section>
    <p className="rounded-xl border border-sky-100 bg-sky-50 p-4 text-sm leading-6 text-sky-950">{copy.note}</p>
    {valid && <>
      <section className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-7">
        <h3 className="flex items-center gap-2 text-xl font-bold"><TrendingUp className="text-emerald-600" size={22} />{copy.history}</h3><p className="mt-2 text-sm text-slate-500">{copy.window}</p>
        <div className="mt-6 flex h-32 items-end gap-2" aria-hidden="true">{[...rows].reverse().map(row => <div key={row.at} className="flex-1 rounded-t-md bg-gradient-to-t from-sky-600 to-emerald-400" style={{ height: `${Math.max(2, total > 0 ? row.total / total * 100 : 0)}%` }} />)}</div>
        <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[520px] text-left text-sm"><thead><tr>{[copy.date, copy.profit, copy.total].map(label => <th key={label} scope="col" className="border-b p-3 font-medium text-slate-500">{label}</th>)}</tr></thead><tbody>{rows.map(row => <tr key={row.at} className="border-b border-slate-100"><th scope="row" className="p-3 text-left font-normal">{date(row.at)}</th><td className="p-3 tabular-nums text-emerald-700">+{money(row.profit)}</td><td className="p-3 font-semibold tabular-nums">{money(row.total)}</td></tr>)}</tbody></table></div>
      </section>
      <section><h3 className="mb-4 text-xl font-bold">{copy.purchases}</h3><div className="grid gap-4 lg:grid-cols-2">{calculations.map(({ position, model }) => model && <article key={position.slug} className="rounded-2xl border border-slate-200 bg-white p-5"><Link className="font-semibold text-sky-800" href={`/properties/${position.slug}`}>{position.title}</Link><p className="mt-2 text-xs text-slate-500">{copy.start}: {date(model.start)} UTC</p><p className="mt-4 rounded-lg bg-slate-50 p-3 text-sm">{copy.formula}</p><div className="mt-4 space-y-3">{model.lots.map((lot, i) => <div key={i} className="border-t border-slate-100 pt-3"><p className="text-xs text-slate-500">{date(Date.parse(lot.created_at))} UTC · {copy.rate}: {percent(position.rentalRate)}</p><p className="mt-2 font-mono text-sm leading-6">{money(lot.amount)} × {percent(position.rentalRate)} ÷ 365 × {lot.days} = <strong className="text-emerald-700">{money(lot.daily * lot.days)}</strong></p></div>)}</div></article>)}</div></section>
    </>}
  </div>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border border-white/10 bg-white/5 p-5"><p className="text-xs text-slate-300">{label}</p><p className="mt-3 text-3xl font-bold tabular-nums text-emerald-300">{value}</p></div>;
}
