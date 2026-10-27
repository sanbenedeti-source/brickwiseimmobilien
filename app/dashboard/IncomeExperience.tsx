"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, ChartNoAxesCombined, Info, Layers3, Percent, WalletCards } from "lucide-react";
import { localeHtmlLang, type Locale } from "../lib/i18n";
import { profitCopy } from "./profit-copy";
import { positionEconomics, simulatePosition, type IncomePosition } from "./profit-model";
import { formatRecordedMoney } from "./recorded-money";
import { PortalCard, StatTile, cellClass, fieldClass, headCellClass, numberCellClass, primaryButtonClass, tableClass } from "./portal-ui";
export type { IncomePosition } from "./profit-model";

export default function IncomeExperience({ positions, locale, walletBalance = 0, walletCurrency = "EUR" }: { positions: IncomePosition[]; locale: Locale; walletBalance?: number | null; walletCurrency?: string }) {
  const copy = profitCopy[locale];
  const [selectedSlug, setSelectedSlug] = useState(positions[0]?.slug ?? "");
  const [extraShares, setExtraShares] = useState(0);
  const [months, setMonths] = useState(12);
  const selected = positions.find((position) => position.slug === selectedSlug) ?? positions[0];
  const money = (value: number) => new Intl.NumberFormat(localeHtmlLang[locale], { style: "currency", currency: "EUR", currencyDisplay: "code", maximumFractionDigits: 2 }).format(value);
  const number = (value: number) => new Intl.NumberFormat(localeHtmlLang[locale], { maximumFractionDigits: 2 }).format(value);
  const percent = (value: number) => new Intl.NumberFormat(localeHtmlLang[locale], { style: "percent", maximumFractionDigits: 3 }).format(value);
  const totals = positions.reduce((sum, position) => ({ capital: sum.capital + positionEconomics(position).capital, shares: sum.shares + position.shares, annual: sum.annual + positionEconomics(position).annual }), { capital: 0, shares: 0, annual: 0 });

  if (!selected) return <section className="rounded-xl border border-dashed border-line-strong bg-white px-6 py-14 text-center">
    <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-soft text-brand"><ChartNoAxesCombined size={22} aria-hidden="true" /></span>
    <h2 className="mt-4 text-lg font-semibold">{copy.empty}</h2><p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted">{copy.emptyText}</p>
    <Link href="/dashboard/marketplace" className={`${primaryButtonClass} mt-6`}>{copy.browse}<ArrowUpRight size={16} aria-hidden="true" /></Link>
  </section>;

  const simulation = simulatePosition(selected, extraShares, months);
  const economics = positionEconomics(selected);
  const currentProfit = economics.annual * months / 12;
  const comparisonMax = Math.max(Math.abs(currentProfit), Math.abs(simulation.profit), 1);

  return <div className="space-y-6">
    <dl className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
      <StatTile emphasis icon={WalletCards} label={copy.capital} value={money(totals.capital)} />
      <StatTile icon={Layers3} label={copy.shares} value={number(totals.shares)} />
      <StatTile estimate icon={ChartNoAxesCombined} label={copy.annual} value={money(totals.annual)} />
      <StatTile estimate icon={Percent} label={copy.roi} value={totals.capital > 0 ? percent(totals.annual / totals.capital) : "—"} />
    </dl>
    <dl className="grid divide-y divide-line rounded-xl border border-line bg-white sm:grid-cols-3 sm:divide-x sm:divide-y-0">
      {[[copy.monthly, money(totals.annual / 12)], [copy.daily, money(totals.annual / 365.2425)], [copy.wallet, walletBalance === null ? "—" : formatRecordedMoney(walletBalance, walletCurrency, localeHtmlLang[locale])]].map(([label, value]) => <div key={label} className="px-5 py-4"><dt className="text-xs font-medium text-muted">{label}</dt><dd className="mt-1 text-lg font-semibold tabular-nums">{value}</dd></div>)}
    </dl>

    <PortalCard title={copy.portfolio} action={<Link href="/dashboard/marketplace" className="inline-flex items-center gap-1 text-sm font-semibold text-brand hover:underline">{copy.browse}<ArrowUpRight size={15} aria-hidden="true" /></Link>}>
      <div className="overflow-x-auto"><table className={`${tableClass} min-w-[820px]`}>
        <thead><tr>
          <th scope="col" className={headCellClass}>{copy.property}</th>
          {[copy.shares, copy.ownership, copy.capital, copy.cost, copy.rate, copy.monthly].map((label) => <th key={label} scope="col" className={`${headCellClass} text-right`}>{label}</th>)}
        </tr></thead>
        <tbody>{positions.map((position) => {
          const values = positionEconomics(position);
          const share = totals.capital > 0 ? values.capital / totals.capital : 0;
          return <tr key={position.slug} className="hover:bg-canvas/60">
            <th scope="row" className={`${cellClass} max-w-64 font-semibold`}><Link href={`/properties/${position.slug}`} className="hover:text-brand">{position.title}</Link><p className="mt-0.5 text-xs font-normal text-muted">{position.city}</p>
              <div className="mt-2.5 flex items-center gap-2"><div className="h-1.5 w-28 overflow-hidden rounded-full bg-brand-soft" title={`${copy.allocation}: ${percent(share)}`}><div className="h-full rounded-full bg-brand" style={{ width: `${share * 100}%` }} /></div><span className="text-[11px] font-normal tabular-nums text-muted">{percent(share)}</span></div>
            </th>
            <td className={numberCellClass}>{number(position.shares)}</td>
            <td className={numberCellClass}>{position.totalShares > 0 ? percent(values.ownership) : "—"}</td>
            <td className={`${numberCellClass} font-semibold`}>{money(values.capital)}<p className="mt-0.5 text-xs font-normal text-muted">{copy.recordedCost}: {formatRecordedMoney(position.recordedInvestment.amount, position.recordedInvestment.currency, localeHtmlLang[locale])}</p></td>
            <td className={numberCellClass}>{formatRecordedMoney(values.averageCost, position.recordedInvestment.currency, localeHtmlLang[locale])}</td>
            <td className={numberCellClass}>{percent(position.annualRate / 100)}</td>
            <td className={`${numberCellClass} font-semibold text-emerald-700`}>{money(values.monthly)}</td>
          </tr>;
        })}</tbody>
      </table></div>
    </PortalCard>

    <section className="grid gap-6 xl:grid-cols-2">
      <PortalCard title={copy.calculator} description={copy.calculatorIntro}>
        <div className="p-5">
          <label htmlFor="profit-property" className="block text-xs font-semibold text-muted">{copy.property}</label><select id="profit-property" value={selected.slug} onChange={(event) => { setSelectedSlug(event.target.value); setExtraShares(0); }} className={fieldClass}>{positions.map((position) => <option key={position.slug} value={position.slug}>{position.title}</option>)}</select>
          <div className="mt-4 grid gap-4 sm:grid-cols-2"><div><label htmlFor="profit-shares" className="block text-xs font-semibold text-muted">{copy.extra}</label><input id="profit-shares" type="number" min={0} max={selected.availableShares} step={1} disabled={selected.availableShares === 0} value={simulation.extraShares} onChange={(event) => setExtraShares(simulatePosition(selected, Number(event.target.value), months).extraShares)} className={`${fieldClass} font-semibold tabular-nums`} /><p className="mt-1.5 text-xs text-muted">{selected.availableShares === 0 ? copy.soldOut : `${copy.available}: ${number(selected.availableShares)}`}</p></div><div><label htmlFor="profit-period" className="block text-xs font-semibold text-muted">{copy.period}</label><select id="profit-period" value={months} onChange={(event) => setMonths(Number(event.target.value))} className={`${fieldClass} font-semibold`}>{[1, 3, 6, 12, 24, 36, 60].map((value) => <option key={value} value={value}>{value} {copy.months.toLowerCase()}</option>)}</select></div></div>
          <div className="mt-5 rounded-xl border border-line bg-canvas p-4" aria-live="polite">
            <dl className="divide-y divide-line"><Row label={copy.extraCapital} value={money(simulation.extraInvestment)} /><Row label={copy.totalCapital} value={money(simulation.capital)} /><Row label={copy.shares} value={number(selected.shares + simulation.extraShares)} /></dl>
            <div className="mt-2 border-t border-line pt-3"><p className="text-xs font-medium text-muted">{copy.profit}</p><p className="mt-1 text-[28px] font-semibold leading-tight tracking-tight text-emerald-700">{money(simulation.profit)}</p><p className="mt-1.5 text-xs leading-5 text-muted">{copy.targetFormula} · {money(simulation.capital)} × {percent(selected.annualRate / 100)} × {months} ÷ 12</p></div>
            <dl className="mt-3 border-t border-line"><Row label={copy.combined} value={money(simulation.capitalAndProfit)} /></dl>
          </div>
          <div className="mt-5 space-y-3">{[[copy.current, currentProfit], [copy.scenario, simulation.profit]].map(([label, value], index) => <div key={String(label)}><div className="mb-1.5 flex justify-between gap-3 text-xs"><span className="text-muted">{label}</span><strong className="tabular-nums">{money(Number(value))}</strong></div><div className="h-2 rounded-full bg-brand-soft"><div className={`h-full rounded-full transition-[width] motion-reduce:transition-none ${index ? "bg-emerald-600" : "bg-brand"}`} style={{ width: `${Math.abs(Number(value)) / comparisonMax * 100}%` }} /></div></div>)}</div>
        </div>
      </PortalCard>

      <PortalCard title={copy.calculation} description={selected.title}>
        <div className="p-5">
          <dl className="divide-y divide-line"><Row label={copy.sharePrice} value={money(selected.sharePrice)} /><Row label={copy.totalShares} value={number(selected.totalShares)} /><Row label={copy.shares} value={number(selected.shares)} /><Row label={copy.ownership} value={selected.totalShares > 0 ? percent(economics.ownership) : "—"} /></dl>
          <p className="mt-2 rounded-lg bg-brand-soft px-3 py-2 font-mono text-xs leading-5 text-brand-strong">{copy.ownershipFormula}: {number(selected.shares)} ÷ {number(selected.totalShares)} = {selected.totalShares > 0 ? percent(economics.ownership) : "—"}</p>
          <dl className="mt-5 divide-y divide-line"><Row label={copy.gross} value={money(selected.monthlyRent)} /><Row label={copy.expenses} value={money(selected.monthlyExpenses)} /><Row label={copy.net} value={money(selected.monthlyRent - selected.monthlyExpenses)} /></dl>
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4"><p className="text-xs font-medium text-emerald-800">{copy.yourRent}</p><p className="mt-1 text-2xl font-semibold tabular-nums text-emerald-800">{selected.totalShares > 0 ? money(economics.rentalMonthly) : "—"}</p><p className="mt-1 text-xs leading-5 text-emerald-700">{copy.rentFormula}</p></div>
          <Link href={`/properties/${selected.slug}`} className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-brand hover:underline">{copy.details}<ArrowUpRight size={15} aria-hidden="true" /></Link>
        </div>
      </PortalCard>
    </section>
    <p className="flex items-start gap-2 text-xs leading-5 text-muted"><Info size={14} className="mt-0.5 shrink-0" aria-hidden="true" />{copy.note}</p>
  </div>;
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex items-start justify-between gap-4 py-2.5 text-sm"><dt className="text-muted">{label}</dt><dd className="text-right font-semibold tabular-nums">{value}</dd></div>;
}
