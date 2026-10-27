"use client";

import { useEffect, useState } from "react";
import { Info, WalletCards, TrendingUp } from "lucide-react";
import { localeHtmlLang, type Locale } from "../lib/i18n";
import { dailyIncome, type DailyIncomePosition, type IncomePurchase } from "./daily-income-model";
import { walletOverviewCopy } from "./wallet-overview-copy";
import { StatTile } from "./portal-ui";

// The credited balance and the rental projection are shown side by side but never added
// together: only the balance is money the client actually has (owner decision 2026-10-23).
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
  const money = (cents: number | null) => cents === null ? copy.unavailable : new Intl.NumberFormat(localeHtmlLang[locale], { style: "currency", currency: "EUR" }).format(cents / 100);
  return <section className="mb-6">
    <dl className="grid gap-4 md:grid-cols-2">
      <StatTile emphasis icon={WalletCards} label={copy.base} value={money(base)} hint={copy.baseHint} />
      <StatTile estimate icon={TrendingUp} label={copy.profit} value={money(profit)} hint={copy.profitHint} />
    </dl>
    <p className="mt-3 flex items-start gap-2 text-xs leading-5 text-muted"><Info size={14} className="mt-0.5 shrink-0" aria-hidden="true" />{copy.note}</p>
  </section>;
}
