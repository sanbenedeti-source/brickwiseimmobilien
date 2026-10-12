"use client";

import { formatPropertyPercent } from "../properties/property-ui-copy";

import { useEffect, useState } from "react";
import { localeHtmlLang, type Locale } from "@/app/lib/i18n";

const labels = {
  en: { rate: "Projected annual return", daily: "Projected daily", weekly: "Projected weekly", monthly: "Projected monthly", annual: "Projected annual", gain: "Estimated accrued gain", value: "Estimated current value", note: "Live projection only. This is not a guaranteed return, verified valuation, or wallet credit." },
  de: { rate: "Prognostizierte Jahresrendite", daily: "Prognose täglich", weekly: "Prognose wöchentlich", monthly: "Prognose monatlich", annual: "Prognose jährlich", gain: "Geschätzter aufgelaufener Gewinn", value: "Geschätzter aktueller Wert", note: "Nur Live-Projektion. Keine garantierte Rendite, bestätigte Bewertung oder Wallet-Gutschrift." },
  fr: { rate: "Rendement annuel projeté", daily: "Projection quotidienne", weekly: "Projection hebdomadaire", monthly: "Projection mensuelle", annual: "Projection annuelle", gain: "Gain cumulé estimé", value: "Valeur actuelle estimée", note: "Projection en direct uniquement. Il ne s'agit ni d'un rendement garanti, ni d'une valorisation vérifiée, ni d'un crédit du portefeuille." },
  es: { rate: "Rendimiento anual proyectado", daily: "Proyección diaria", weekly: "Proyección semanal", monthly: "Proyección mensual", annual: "Proyección anual", gain: "Ganancia acumulada estimada", value: "Valor actual estimado", note: "Solo es una proyección en vivo. No es un rendimiento garantizado, una valoración verificada ni un abono en la cartera." },
  it: { rate: "Rendimento annuo previsto", daily: "Proiezione giornaliera", weekly: "Proiezione settimanale", monthly: "Proiezione mensile", annual: "Proiezione annuale", gain: "Guadagno maturato stimato", value: "Valore attuale stimato", note: "Solo proiezione live. Non è un rendimento garantito, una valutazione verificata o un credito sul wallet." },
} satisfies Record<Locale, { rate: string; daily: string; weekly: string; monthly: string; annual: string; gain: string; value: string; note: string }>;

const yearMs = 365.2425 * 24 * 60 * 60 * 1000;

export default function LiveProjectedGain({ principal, annualRate, purchasedAt, locale }: { principal: number; annualRate: number; purchasedAt: string; locale: Locale }) {
  const startedAt = new Date(purchasedAt).getTime();
  const [now, setNow] = useState(startedAt);
  const copy = labels[locale];

  useEffect(() => {
    const update = () => setNow(Date.now());
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const elapsed = Math.max(0, now - startedAt);
  const accruedGain = principal * (annualRate / 100) * (elapsed / yearMs);
  const annualProjection = principal * annualRate / 100;
  const money = (value: number) => new Intl.NumberFormat(localeHtmlLang[locale], { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(value);

  return <div className="mt-4 border-l-4 border-[#2f9bdb] bg-[#edf7fc] p-4"><div className="grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-4"><div><p className="text-xs text-[#687486]">{copy.rate}</p><p className="mt-1 font-bold">{formatPropertyPercent(annualRate, locale)}</p></div><div><p className="text-xs text-[#687486]">{copy.daily}</p><p className="mt-1 font-bold">{money(annualProjection / 365.2425)}</p></div><div><p className="text-xs text-[#687486]">{copy.weekly}</p><p className="mt-1 font-bold">{money(annualProjection / 52.1775)}</p></div><div><p className="text-xs text-[#687486]">{copy.monthly}</p><p className="mt-1 font-bold">{money(annualProjection / 12)}</p></div><div><p className="text-xs text-[#687486]">{copy.annual}</p><p className="mt-1 font-bold">{money(annualProjection)}</p></div><div><p className="text-xs text-[#687486]">{copy.gain}</p><p className="mt-1 font-bold text-emerald-700">{money(accruedGain)}</p></div><div><p className="text-xs text-[#687486]">{copy.value}</p><p className="mt-1 font-bold">{money(principal + accruedGain)}</p></div></div><p className="mt-3 text-xs leading-5 text-[#687486]">{copy.note}</p></div>;
}
