import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronLeft, Coins, KeyRound, MapPin, ShieldCheck, Sprout, TrendingUp } from "lucide-react";
import type { Locale } from "../../lib/i18n";
import { listingBadgeCopy, type PropertyStrategy } from "../../lib/listing-badges";
import { overviewCopy } from "./overview-copy";

export type OverviewFact = { kind: "location" | "rent" | "yield" | "growth"; title: string; text: string };

const factIcons = { location: MapPin, rent: KeyRound, yield: TrendingUp, growth: Sprout };
const strategyLook: Record<PropertyStrategy, { icon: typeof Coins; className: string; iconClass: string }> = {
  prime: { icon: ShieldCheck, className: "border-[#f0dfa8] bg-gradient-to-br from-[#fffaf0] to-[#fff3d6]", iconClass: "bg-[#a17d1f] text-white" },
  capital_growth: { icon: Sprout, className: "border-emerald-100 bg-gradient-to-br from-emerald-50/60 to-emerald-50", iconClass: "bg-emerald-600 text-white" },
  high_yield: { icon: Coins, className: "border-sky-100 bg-gradient-to-br from-sky-50/60 to-sky-50", iconClass: "bg-sky-600 text-white" },
};

/** Calm two-column property page shared by visitors and signed-in clients: story on the left,
 * a single sticky investment card on the right. The purchase calculator is passed as children. */
export default function PropertyOverview({ locale, back, gallery, title, chips, badges, facts, description, strategy, financials, card, stickyTop, children }: {
  locale: Locale;
  back: { href: string; label: string };
  gallery: ReactNode;
  title: string;
  chips: string[];
  badges: ReactNode;
  facts: OverviewFact[];
  description: string;
  strategy?: PropertyStrategy;
  financials: { title: string; rows: [string, string][] }[];
  card: { valueLabel: string; value: string; fundedPercent: number; fundedText: string; availableText: string; perSqm?: string; metrics: [string, string][]; minimumLabel: string; minimum: string; cta: ReactNode; note?: string };
  stickyTop: string;
  children?: ReactNode;
}) {
  const copy = overviewCopy[locale];
  return (
    <div className="mx-auto max-w-6xl">
      <Link href={back.href} className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-muted hover:text-brand"><ChevronLeft size={16} aria-hidden="true" />{back.label}</Link>
      <div className="mt-2">{gallery}</div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
        <div className="min-w-0">
          <h1 className="text-3xl font-bold leading-tight text-ink md:text-4xl">{title}</h1>
          {chips.length > 0 && <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
            {chips.map((chip, index) => <span key={chip} className="inline-flex items-center gap-3">{index > 0 && <span className="h-1 w-1 rounded-full bg-slate-300" aria-hidden="true" />}{chip}</span>)}
          </p>}
          {badges}

          {facts.length > 0 && <ul className="mt-7 grid gap-5 border-y border-line py-7">
            {facts.map((fact) => {
              const Icon = factIcons[fact.kind];
              return <li key={fact.kind} className="flex gap-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand"><Icon size={19} aria-hidden="true" /></span>
                <div className="min-w-0"><p className="font-semibold text-ink">{fact.title}</p><p className="mt-0.5 text-sm leading-6 text-muted">{fact.text}</p></div>
              </li>;
            })}
          </ul>}

          {description && <section className="mt-8">
            <h2 className="text-xl font-bold text-ink">{copy.aboutTitle}</h2>
            <p className="mt-3 max-w-3xl leading-7 text-slate-600">{description}</p>
          </section>}

          <section className="mt-10">
            <h2 className="text-xl font-bold text-ink">{copy.howTitle}</h2>
            <ol className="mt-4 grid gap-3 sm:grid-cols-3">
              {copy.steps.map(([stepTitle, stepText], index) => <li key={stepTitle} className="rounded-2xl border border-line bg-white p-5">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-ink text-xs font-bold text-white">{index + 1}</span>
                <p className="mt-3 font-semibold text-ink">{stepTitle}</p>
                <p className="mt-1 text-sm leading-6 text-muted">{stepText}</p>
              </li>)}
            </ol>
          </section>

          {strategy && (() => {
            const look = strategyLook[strategy];
            const Icon = look.icon;
            return <section className="mt-10">
              <h2 className="text-xl font-bold text-ink">{copy.strategyTitle}</h2>
              <div className={`mt-4 flex items-start justify-between gap-5 rounded-2xl border p-6 ${look.className}`}>
                <div><p className="text-lg font-bold text-ink">{listingBadgeCopy[locale].strategies[strategy]}</p><p className="mt-1 max-w-xl leading-7 text-slate-700">{copy.strategies[strategy]}</p></div>
                <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full shadow-sm ${look.iconClass}`}><Icon size={22} aria-hidden="true" /></span>
              </div>
            </section>;
          })()}

          {financials.length > 0 && <section className="mt-10">
            <h2 className="text-xl font-bold text-ink">{copy.financialsTitle}</h2>
            <div className="mt-4 grid overflow-hidden rounded-2xl border border-line bg-white sm:grid-cols-2">
              {financials.map((column, index) => <dl key={column.title} className={`p-5 ${index > 0 ? "border-t border-line sm:border-l sm:border-t-0" : ""}`}>
                <p className="mb-1 text-xs font-bold uppercase tracking-wider text-muted">{column.title}</p>
                {column.rows.map(([label, value]) => <div key={label} className="flex items-center justify-between gap-4 border-b border-line py-2.5 text-sm last:border-0">
                  <dt className="text-slate-600">{label}</dt><dd className="whitespace-nowrap font-semibold tabular-nums text-ink">{value}</dd>
                </div>)}
              </dl>)}
            </div>
          </section>}

          {children}
        </div>

        <aside id="reserve" className={`scroll-mt-28 lg:sticky ${stickyTop}`}>
          <div className="rounded-3xl border border-line bg-white p-6 shadow-[0_12px_40px_rgba(20,33,61,0.08)]">
            <p className="text-center text-sm text-muted">{card.valueLabel}</p>
            <p className="mt-1 text-center text-3xl font-bold tabular-nums text-brand">{card.value}</p>
            <div className="mt-5 h-2 rounded-full bg-slate-100" aria-hidden="true"><div className="h-2 rounded-full bg-emerald-500" style={{ width: `${Math.min(100, Math.max(0, card.fundedPercent))}%` }} /></div>
            <div className="mt-2 flex justify-between gap-3 text-xs font-semibold text-slate-500"><span>{card.fundedText}</span><span>{card.availableText}</span></div>
            {card.perSqm && <p className="mt-3 flex justify-end"><span className="rounded-full border border-line px-2.5 py-1 text-xs font-semibold text-ink">{card.perSqm}</span></p>}
            {card.metrics.length > 0 && <dl className="mt-5 grid gap-3 rounded-2xl bg-canvas p-4 text-sm">
              {card.metrics.map(([label, value]) => <div key={label} className="flex items-center justify-between gap-4"><dt className="text-slate-600">{label}</dt><dd className="whitespace-nowrap font-bold tabular-nums text-ink">{value}</dd></div>)}
            </dl>}
            <p className="mt-5 text-center text-sm text-muted">{card.minimumLabel} <strong className="text-ink">{card.minimum}</strong></p>
            <div className="mt-4 grid gap-2">{card.cta}</div>
          </div>
          {card.note && <p className="mt-3 px-2 text-center text-xs leading-5 text-muted">{card.note}</p>}
        </aside>
      </div>
    </div>
  );
}
