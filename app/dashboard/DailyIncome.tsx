"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarDays, Info, WalletCards } from "lucide-react";
import { localeHtmlLang, type Locale } from "../lib/i18n";
import { dailyIncomeCopy } from "./daily-income-copy";
import { dailyIncome, type DailyIncomePosition, type IncomePurchase } from "./daily-income-model";
import { walletOverviewCopy } from "./wallet-overview-copy";
import { PortalCard, StatTile, cellClass, fieldClass, headCellClass, numberCellClass, primaryButtonClass, tableClass } from "./portal-ui";

type HistoryRow = { at: number; profit: number; total: number };

export default function DailyIncome({ positions, purchases, locale, asOf, historyAvailable, walletBalance }: {
  positions: DailyIncomePosition[]; purchases: IncomePurchase[]; locale: Locale; asOf: number; historyAvailable: boolean;
  /** When given, the credited wallet balance is shown next to (never added to) the projection. */
  walletBalance?: number | null;
}) {
  const copy = dailyIncomeCopy[locale];
  const walletCopy = walletOverviewCopy[locale];
  const [now, setNow] = useState(asOf);
  const [slug, setSlug] = useState("");
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  const money = (value: number) => new Intl.NumberFormat(localeHtmlLang[locale], { style: "currency", currency: "EUR", minimumFractionDigits: 2 }).format(value);
  const date = (value: number) => new Intl.DateTimeFormat(localeHtmlLang[locale], { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(value);
  const shortDate = (value: number) => new Intl.DateTimeFormat(localeHtmlLang[locale], { day: "numeric", month: "short", timeZone: "UTC" }).format(value);
  const compact = (value: number) => new Intl.NumberFormat(localeHtmlLang[locale], { style: "currency", currency: "EUR", notation: "compact", maximumFractionDigits: 1 }).format(value);
  const percent = (value: number) => new Intl.NumberFormat(localeHtmlLang[locale], { style: "percent", maximumFractionDigits: 2 }).format(value / 100);
  const selected = positions.filter(p => !slug || p.slug === slug);
  const calculations = selected.map(p => ({ position: p, model: dailyIncome(p, purchases, now) }));
  const valid = historyAvailable && calculations.length > 0 && calculations.every(p => p.model !== null);
  const models = calculations.flatMap(p => p.model ? [p.model] : []);
  const total = models.reduce((sum, m) => sum + m.accrued, 0);
  const daily = models.reduce((sum, m) => sum + m.daily, 0);
  const days = Math.max(0, ...models.map(m => m.days));
  const rows: HistoryRow[] = Array.from({ length: 14 }, (_, i) => ({ at: now - i * 86_400_000, profit: models.reduce((sum, m) => sum + m.history[i].profit, 0), total: models.reduce((sum, m) => sum + m.history[i].total, 0) }))
    .filter(row => models.some(m => row.at >= m.start));
  const balance = walletBalance !== undefined && walletBalance !== null && Number.isFinite(walletBalance) && walletBalance >= 0 ? money(walletBalance) : walletCopy.unavailable;
  const paused = calculations.some(({ model }) => model?.paused);

  if (!positions.length && historyAvailable) return <section className="rounded-xl border border-dashed border-line-strong bg-white px-6 py-14 text-center">
    <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-soft text-brand"><CalendarDays size={22} aria-hidden="true" /></span>
    <h2 className="mt-4 text-lg font-semibold">{copy.title}</h2>
    <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted">{copy.empty}</p>
    <Link href="/dashboard/marketplace" className={`${primaryButtonClass} mt-6`}>{copy.browse}</Link>
  </section>;

  return <div className="space-y-6">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div><h2 className="text-lg font-semibold">{copy.title}</h2><p className="mt-1 flex items-center gap-2 text-xs text-muted"><span aria-hidden="true" className="h-2 w-2 rounded-full bg-emerald-500" />{copy.refresh}</p></div>
      {positions.length > 1 && <label className="w-full text-xs font-semibold text-muted sm:w-72">{copy.property}<select value={slug} onChange={e => setSlug(e.target.value)} className={fieldClass}><option value="">{copy.all}</option>{positions.map(p => <option key={p.slug} value={p.slug}>{p.title}</option>)}</select></label>}
    </div>

    <dl className={`grid grid-cols-2 gap-3 sm:gap-4 ${walletBalance !== undefined ? "xl:grid-cols-4" : "xl:grid-cols-3"}`}>
      {walletBalance !== undefined && <StatTile emphasis icon={WalletCards} label={walletCopy.base} value={balance} hint={walletCopy.baseHint} />}
      <StatTile estimate label={copy.accrued} value={valid ? money(total) : "—"} hint={valid ? `${copy.next}: ${date(Math.min(...models.map(m => m.next)))} UTC` : undefined} />
      <StatTile label={copy.daily} value={valid ? money(daily) : "—"} />
      <StatTile label={copy.days} value={valid ? String(days) : "—"} />
    </dl>
    {!valid && <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950">{copy.unavailable}</p>}
    <p className="flex items-start gap-2 text-xs leading-5 text-muted"><Info size={14} className="mt-0.5 shrink-0" aria-hidden="true" /><span>{walletBalance !== undefined && `${walletCopy.note} `}{copy.note}</span></p>

    {valid && <>
      <PortalCard title={copy.history} description={copy.window}>
        <RunningTotalChart rows={[...rows].reverse()} money={money} date={date} shortDate={shortDate} compact={compact} />
        <details className="border-t border-line">
          <summary className="cursor-pointer px-5 py-3 text-sm font-semibold text-brand hover:bg-canvas">{copy.showTable}</summary>
          <div className="overflow-x-auto"><table className={`${tableClass} min-w-[520px]`}>
            <thead><tr><th scope="col" className={headCellClass}>{copy.date}</th><th scope="col" className={`${headCellClass} text-right`}>{copy.profit}</th><th scope="col" className={`${headCellClass} text-right`}>{copy.total}</th></tr></thead>
            <tbody>{rows.map(row => <tr key={row.at}><th scope="row" className={`${cellClass} font-normal`}>{date(row.at)}</th><td className={`${numberCellClass} text-emerald-700`}>+{money(row.profit)}</td><td className={`${numberCellClass} font-semibold`}>{money(row.total)}</td></tr>)}</tbody>
          </table></div>
        </details>
      </PortalCard>

      <PortalCard title={copy.purchases} description={copy.formula}>
        <div className="overflow-x-auto"><table className={`${tableClass} min-w-[760px]`}>
          <thead><tr>{[copy.property, copy.start, copy.capital, copy.rate, copy.days].map(label => <th key={label} scope="col" className={headCellClass}>{label}</th>)}<th scope="col" className={`${headCellClass} text-right`}>{copy.accrued}</th></tr></thead>
          <tbody>{calculations.flatMap(({ position, model }) => model ? model.lots.map((lot, index) => <tr key={`${position.slug}-${index}`}>
            <td className={`${cellClass} min-w-56`}><Link href={`/properties/${position.slug}`} className="font-semibold text-ink hover:text-brand">{position.title}</Link>{model.paused && <span className="ml-2 inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800">{copy.pausedShort}</span>}{model.accrualStart > model.start && index === 0 && <p className="mt-0.5 text-xs text-muted">{copy.accrualFrom}: {date(model.accrualStart)} UTC</p>}</td>
            <td className={`${cellClass} whitespace-nowrap text-muted`}>{date(Date.parse(lot.created_at))} UTC</td>
            <td className={`${cellClass} whitespace-nowrap tabular-nums`}>{money(lot.amount)}</td>
            <td className={`${cellClass} tabular-nums`}>{percent(position.rentalRate)}</td>
            <td className={`${cellClass} tabular-nums`}>{lot.days}</td>
            <td className={`${numberCellClass} font-semibold text-emerald-700`}>{money(lot.daily * lot.days)}</td>
          </tr>) : [])}</tbody>
        </table></div>
        {paused && <p role="status" className="border-t border-line bg-amber-50 px-5 py-3 text-sm text-amber-950">{copy.paused}</p>}
      </PortalCard>
    </>}
  </div>;
}

/** Single-series running total: 2px line over a 10% wash, end value labelled, crosshair tooltip on hover/focus. */
function RunningTotalChart({ rows, money, date, shortDate, compact }: { rows: HistoryRow[]; money: (value: number) => string; date: (value: number) => string; shortDate: (value: number) => string; compact: (value: number) => string }) {
  const [active, setActive] = useState<number | null>(null);
  const max = niceCeiling(Math.max(...rows.map(row => row.total), 0));
  const x = (index: number) => rows.length === 1 ? 100 : index / (rows.length - 1) * 100;
  const y = (value: number) => max > 0 ? value / max * 100 : 0;
  const points = rows.map((row, index) => `${x(index)},${100 - y(row.total)}`);
  const line = `M${points.join("L")}`;
  const area = `${line}L${x(rows.length - 1)},100L${x(0)},100Z`;
  const last = rows.length - 1;
  const shown = active ?? last;
  const ticks = [0, max / 2, max];
  return <div className="px-5 pb-5 pt-6">
    <div className="relative h-56 pl-14">
      {ticks.map(tick => <div key={tick} className="absolute inset-x-0" style={{ bottom: `${y(tick)}%` }}>
        <span className="absolute left-0 -translate-y-1/2 text-[11px] tabular-nums text-muted">{compact(tick)}</span>
        <div className="ml-14 border-t border-slate-100" />
      </div>)}
      <div className="absolute inset-y-0 left-14 right-2" onMouseLeave={() => setActive(null)}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible" aria-hidden="true">
          <path d={area} fill="var(--color-brand)" fillOpacity={0.1} />
          <path d={line} fill="none" stroke="var(--color-brand)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        </svg>
        {active !== null && <span aria-hidden="true" className="absolute inset-y-0 w-px bg-slate-300" style={{ left: `${x(active)}%` }} />}
        <span aria-hidden="true" className="absolute h-2.5 w-2.5 -translate-x-1/2 translate-y-1/2 rounded-full bg-brand ring-2 ring-white" style={{ left: `${x(shown)}%`, bottom: `${y(rows[shown].total)}%` }} />
        {active === null && <span className="absolute -translate-y-3 translate-x-[-100%] whitespace-nowrap pr-2 text-xs font-semibold tabular-nums text-ink" style={{ left: `${x(last)}%`, bottom: `${y(rows[last].total)}%` }}>{money(rows[last].total)}</span>}
        {rows.map((row, index) => <button key={row.at} type="button" aria-label={`${date(row.at)} UTC: ${money(row.total)}`}
          onMouseEnter={() => setActive(index)} onFocus={() => setActive(index)} onBlur={() => setActive(null)}
          className="absolute inset-y-0 -translate-x-1/2 focus-visible:outline-2 focus-visible:outline-brand"
          style={{ left: `${x(index)}%`, width: `${rows.length === 1 ? 100 : 100 / (rows.length - 1)}%` }} />)}
        {active !== null && <div role="status" className="pointer-events-none absolute z-10 w-max -translate-x-1/2 rounded-lg border border-line bg-white px-3 py-2 text-xs shadow-lg"
          style={{ left: `${Math.min(88, Math.max(12, x(active)))}%`, bottom: `calc(${y(rows[active].total)}% + 14px)` }}>
          <p className="text-muted">{date(rows[active].at)} UTC</p>
          <p className="mt-0.5 text-sm font-semibold tabular-nums text-ink">{money(rows[active].total)}</p>
          <p className="tabular-nums text-emerald-700">+{money(rows[active].profit)}</p>
        </div>}
      </div>
    </div>
    <div className="ml-14 mr-2 mt-2 flex justify-between text-[11px] text-muted"><span>{shortDate(rows[0].at)}</span>{rows.length > 2 && <span>{shortDate(rows[Math.floor(last / 2)].at)}</span>}<span>{shortDate(rows[last].at)}</span></div>
  </div>;
}

function niceCeiling(value: number) {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 2.5, 5, 10].find(candidate => candidate * magnitude >= value) ?? 10;
  return step * magnitude;
}
