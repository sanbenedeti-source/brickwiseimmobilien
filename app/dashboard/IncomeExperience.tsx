"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Calculator, ChartNoAxesCombined, Info, Layers3, WalletCards } from "lucide-react";
import { localeHtmlLang, type Locale } from "../lib/i18n";
import { profitCopy } from "./profit-copy";
import { positionEconomics, simulatePosition, type IncomePosition } from "./profit-model";
import { formatRecordedMoney } from "./recorded-money";
export type { IncomePosition } from "./profit-model";

export default function IncomeExperience({ positions, locale, walletBalance = 0, walletCurrency = "EUR" }: { positions: IncomePosition[]; locale: Locale; walletBalance?: number; walletCurrency?: string }) {
  const copy = profitCopy[locale];
  const [selectedSlug, setSelectedSlug] = useState(positions[0]?.slug ?? "");
  const [extraShares, setExtraShares] = useState(0);
  const [months, setMonths] = useState(12);
  const selected = positions.find((position) => position.slug === selectedSlug) ?? positions[0];
  const money = (value: number) => new Intl.NumberFormat(localeHtmlLang[locale], { style: "currency", currency: "EUR", currencyDisplay: "code", maximumFractionDigits: 2 }).format(value);
  const number = (value: number) => new Intl.NumberFormat(localeHtmlLang[locale], { maximumFractionDigits: 2 }).format(value);
  const percent = (value: number) => new Intl.NumberFormat(localeHtmlLang[locale], { style: "percent", maximumFractionDigits: 3 }).format(value);
  const totals = positions.reduce((sum, position) => ({ capital: sum.capital + positionEconomics(position).capital, shares: sum.shares + position.shares, annual: sum.annual + positionEconomics(position).annual }), { capital: 0, shares: 0, annual: 0 });

  if (!selected) return <section className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
    <ChartNoAxesCombined className="mx-auto text-sky-600" size={36} /><h2 className="mt-5 text-2xl font-bold">{copy.empty}</h2><p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-slate-500">{copy.emptyText}</p>
    <Link href="/dashboard/marketplace" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#17233f] px-5 py-3 text-sm font-semibold text-white">{copy.browse}<ArrowUpRight size={16} /></Link>
  </section>;

  const simulation = simulatePosition(selected, extraShares, months);
  const economics = positionEconomics(selected);
  const currentProfit = economics.annual * months / 12;
  const comparisonMax = Math.max(Math.abs(currentProfit), Math.abs(simulation.profit), 1);

  return <div className="space-y-7">
    <section className="overflow-hidden rounded-[28px] bg-[#10213e] p-5 text-white shadow-lg sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-sky-300">{copy.eyebrow}</p><h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">{copy.title}</h2><p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">{copy.intro}</p></div><span className="rounded-full border border-white/15 px-3 py-1.5 text-xs text-slate-300">EUR</span></div>
      <div className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric icon={WalletCards} label={copy.capital} value={money(totals.capital)} /><Metric icon={Layers3} label={copy.shares} value={number(totals.shares)} /><Metric icon={ChartNoAxesCombined} label={copy.annual} value={money(totals.annual)} accent /><Metric icon={ArrowUpRight} label={copy.roi} value={totals.capital > 0 ? percent(totals.annual / totals.capital) : "—"} accent /></div>
      <div className="mt-5 grid gap-4 border-t border-white/10 pt-5 sm:grid-cols-3">{[[copy.monthly, money(totals.annual / 12)], [copy.daily, money(totals.annual / 365.2425)], [copy.wallet, formatRecordedMoney(walletBalance, walletCurrency, localeHtmlLang[locale])]].map(([label, value]) => <div key={label}><p className="text-xs text-slate-400">{label}</p><p className="mt-1 text-lg font-semibold tabular-nums">{value}</p></div>)}</div>
    </section>

    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-5"><h2 className="text-xl font-bold">{copy.portfolio}</h2><Link href="/dashboard/marketplace" className="inline-flex items-center gap-1 text-sm font-semibold text-sky-700">{copy.browse}<ArrowUpRight size={16} /></Link></div>
      <div className="overflow-x-auto"><table className="w-full min-w-[860px] text-left text-sm">
        <thead className="bg-slate-50 text-xs text-slate-500"><tr>{[copy.property, copy.shares, copy.ownership, copy.capital, copy.cost, copy.rate, copy.monthly].map((label) => <th key={label} scope="col" className="px-5 py-4 font-medium">{label}</th>)}</tr></thead>
        <tbody>{positions.map((position) => {
          const values = positionEconomics(position);
          return <tr key={position.slug} className="border-t border-slate-100 align-top">
            <th scope="row" className="max-w-64 px-5 py-5 font-semibold"><Link href={`/properties/${position.slug}`} className="hover:text-sky-600">{position.title}</Link><p className="mt-1 text-xs font-normal text-slate-500">{position.city}</p><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100" title={`${copy.allocation}: ${percent(totals.capital > 0 ? positionEconomics(position).capital / totals.capital : 0)}`}><div className="h-full rounded-full bg-sky-500" style={{ width: `${totals.capital > 0 ? positionEconomics(position).capital / totals.capital * 100 : 0}%` }} /></div></th>
            <td className="px-5 py-5 tabular-nums">{number(position.shares)}</td><td className="px-5 py-5 tabular-nums">{position.totalShares > 0 ? percent(values.ownership) : "—"}</td><td className="whitespace-nowrap px-5 py-5 font-semibold tabular-nums">{money(values.capital)}<p className="mt-1 text-xs font-normal text-slate-500">{copy.recordedCost}: {formatRecordedMoney(position.recordedInvestment.amount, position.recordedInvestment.currency, localeHtmlLang[locale])}</p></td><td className="whitespace-nowrap px-5 py-5 tabular-nums">{formatRecordedMoney(values.averageCost, position.recordedInvestment.currency, localeHtmlLang[locale])}</td><td className="px-5 py-5 tabular-nums">{percent(position.annualRate / 100)}</td><td className="whitespace-nowrap px-5 py-5 font-semibold tabular-nums text-emerald-700">{money(values.monthly)}</td>
          </tr>;
        })}</tbody>
      </table></div>
    </section>

    <section className="grid gap-6 xl:grid-cols-2">
      <div className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-7">
        <Calculator className="text-sky-600" size={26} /><h2 className="mt-3 text-2xl font-bold">{copy.calculator}</h2><p className="mt-2 text-sm leading-6 text-slate-500">{copy.calculatorIntro}</p>
        <label htmlFor="profit-property" className="mt-6 block text-sm font-semibold">{copy.property}</label><select id="profit-property" value={selected.slug} onChange={(event) => { setSelectedSlug(event.target.value); setExtraShares(0); }} className="mt-2 min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm focus-visible:outline-2 focus-visible:outline-sky-500">{positions.map((position) => <option key={position.slug} value={position.slug}>{position.title}</option>)}</select>
        <div className="mt-5 grid gap-5 sm:grid-cols-2"><div><label htmlFor="profit-shares" className="block text-sm font-semibold">{copy.extra}</label><input id="profit-shares" type="number" min={0} max={selected.availableShares} step={1} disabled={selected.availableShares === 0} value={simulation.extraShares} onChange={(event) => setExtraShares(simulatePosition(selected, Number(event.target.value), months).extraShares)} className="mt-2 h-12 w-full rounded-xl border border-slate-300 px-3 font-bold disabled:bg-slate-100 focus-visible:outline-2 focus-visible:outline-sky-500" /><p className="mt-2 text-xs text-slate-500">{selected.availableShares === 0 ? copy.soldOut : `${copy.available}: ${number(selected.availableShares)}`}</p></div><div><label htmlFor="profit-period" className="block text-sm font-semibold">{copy.period}</label><select id="profit-period" value={months} onChange={(event) => setMonths(Number(event.target.value))} className="mt-2 h-12 w-full rounded-xl border border-slate-300 bg-white px-3 font-bold focus-visible:outline-2 focus-visible:outline-sky-500">{[1, 3, 6, 12, 24, 36, 60].map((value) => <option key={value} value={value}>{value} {copy.months.toLowerCase()}</option>)}</select></div></div>
        <div className="mt-6 rounded-2xl bg-slate-50 p-4" aria-live="polite"><dl><Row label={copy.extraCapital} value={money(simulation.extraInvestment)} /><Row label={copy.totalCapital} value={money(simulation.capital)} /><Row label={copy.shares} value={number(selected.shares + simulation.extraShares)} /></dl><div className="mt-3 border-t border-slate-200 pt-3"><p className="text-sm text-slate-600">{copy.profit}</p><p className="mt-1 text-3xl font-bold tabular-nums text-emerald-700">{money(simulation.profit)}</p><p className="mt-2 text-xs leading-5 text-slate-500">{copy.targetFormula}<br />{money(simulation.capital)} × {percent(selected.annualRate / 100)} × {months} ÷ 12</p></div><dl className="mt-4 border-t border-slate-200 pt-2"><Row label={copy.combined} value={money(simulation.capitalAndProfit)} /></dl></div>
        <div className="mt-5 space-y-4">{[[copy.current, currentProfit], [copy.scenario, simulation.profit]].map(([label, value], index) => <div key={String(label)}><div className="mb-2 flex justify-between gap-3 text-xs"><span className="text-slate-500">{label}</span><strong>{money(Number(value))}</strong></div><div className="h-2 rounded-full bg-slate-100"><div className={`h-full rounded-full transition-[width] motion-reduce:transition-none ${index ? "bg-emerald-500" : "bg-sky-500"}`} style={{ width: `${Math.abs(Number(value)) / comparisonMax * 100}%` }} /></div></div>)}</div>
      </div>
      <div className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-7">
        <p className="text-xs font-bold uppercase tracking-wider text-sky-600">{copy.calculation}</p><h2 className="mt-3 text-2xl font-bold">{selected.title}</h2><p className="mt-2 text-sm text-slate-500">{copy.current}</p>
        <dl className="mt-5 divide-y divide-slate-100"><Row label={copy.sharePrice} value={money(selected.sharePrice)} /><Row label={copy.totalShares} value={number(selected.totalShares)} /><Row label={copy.shares} value={number(selected.shares)} /><Row label={copy.ownership} value={selected.totalShares > 0 ? percent(economics.ownership) : "—"} /></dl>
        <p className="mt-2 rounded-lg bg-sky-50 p-3 text-xs leading-5 text-sky-800">{copy.ownershipFormula}<br />{number(selected.shares)} ÷ {number(selected.totalShares)} = {selected.totalShares > 0 ? percent(economics.ownership) : "—"}</p>
        <dl className="mt-6 divide-y divide-slate-100"><Row label={copy.gross} value={money(selected.monthlyRent)} /><Row label={copy.expenses} value={money(selected.monthlyExpenses)} /><Row label={copy.net} value={money(selected.monthlyRent - selected.monthlyExpenses)} /></dl>
        <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50 p-4"><p className="text-sm text-emerald-800">{copy.yourRent}</p><p className="mt-2 text-2xl font-bold tabular-nums text-emerald-800">{selected.totalShares > 0 ? money(economics.rentalMonthly) : "—"}</p><p className="mt-2 text-xs leading-5 text-emerald-700">{copy.rentFormula}</p></div>
        <Link href={`/properties/${selected.slug}`} className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-sky-700">{copy.details}<ArrowUpRight size={16} /></Link>
      </div>
    </section>
    <p className="flex gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-5 text-xs leading-6 text-slate-500"><Info size={18} className="mt-0.5 shrink-0" />{copy.note}</p>
  </div>;
}

function Metric({ icon: Icon, label, value, accent = false }: { icon: typeof WalletCards; label: string; value: string; accent?: boolean }) {
  return <div className="min-w-0 rounded-2xl border border-white/10 bg-white/5 p-4"><Icon size={19} className={accent ? "text-emerald-300" : "text-sky-300"} /><p className="mt-4 text-xs text-slate-300">{label}</p><p className={`mt-2 break-words text-xl font-bold tabular-nums ${accent ? "text-emerald-300" : "text-white"}`}>{value}</p></div>;
}
function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex items-start justify-between gap-4 py-3 text-sm"><dt className="text-slate-500">{label}</dt><dd className="text-right font-semibold tabular-nums">{value}</dd></div>;
}
