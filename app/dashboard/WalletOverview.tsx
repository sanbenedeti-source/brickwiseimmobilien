"use client";

import { useEffect, useState } from "react";
import { WalletCards, TrendingUp, Sigma } from "lucide-react";
import { localeHtmlLang, type Locale } from "../lib/i18n";
import { dailyIncome, type DailyIncomePosition, type IncomePurchase } from "./daily-income-model";
import { walletOverviewCopy } from "./wallet-overview-copy";

export default function WalletOverview({ baseBalance, positions, purchases, historyAvailable, asOf, locale }: {
  baseBalance: number | null; positions: DailyIncomePosition[]; purchases: IncomePurchase[];
  historyAvailable: boolean; asOf: number; locale: Locale;
}) {
  const [now, setNow] = useState(asOf);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  const copy = walletOverviewCopy[locale];
  const models = positions.map(p => dailyIncome(p, purchases, now));
  const profit = historyAvailable && models.every(m => m !== null)
    ? Math.round(models.reduce((sum, m) => sum + (m?.accrued ?? 0), 0) * 100) : null;
  const base = baseBalance !== null && Number.isFinite(baseBalance) && baseBalance >= 0 ? Math.round(baseBalance * 100) : null;
  const total = base !== null && profit !== null ? base + profit : null;
  const money = (cents: number | null) => cents === null ? copy.unavailable : new Intl.NumberFormat(localeHtmlLang[locale], { style: "currency", currency: "EUR" }).format(cents / 100);
  return <section className="mb-6">
    <dl className="grid gap-4 md:grid-cols-3">
      {[{ key: "base", label: copy.base, hint: copy.baseHint, value: base, Icon: WalletCards },
        { key: "profit", label: copy.profit, hint: copy.profitHint, value: profit, Icon: TrendingUp },
        { key: "total", label: copy.total, hint: copy.totalHint, value: total, Icon: Sigma }].map(({ key, label, hint, value, Icon }) =>
        <div key={key} data-wallet-part={key} className={`min-w-0 rounded-2xl border p-6 ${key === "total" ? "border-[#10213e] bg-[#10213e] text-white" : "border-slate-200 bg-white text-slate-900"}`}>
          <Icon className={key === "total" ? "text-sky-300" : "text-sky-600"} size={24} />
          <dt className="mt-4 text-sm font-semibold">{label}</dt><dd className="mt-2 break-words text-3xl font-bold tabular-nums">{money(value)}</dd>
          <p className={`mt-3 text-xs leading-5 ${key === "total" ? "text-slate-300" : "text-slate-500"}`}>{hint}</p>
        </div>)}
    </dl>
    <p className="mt-3 text-xs leading-5 text-slate-500">{copy.note}</p>
  </section>;
}
