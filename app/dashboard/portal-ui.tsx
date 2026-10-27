import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

/** Shared building blocks for the client panel sections (cards, figures, tables). */
export function PortalCard({ id, title, description, action, children, className = "" }: {
  id?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return <section id={id} className={`min-w-0 scroll-mt-24 overflow-hidden rounded-xl border border-line bg-white ${className}`}>
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4">
      <div className="min-w-0"><h2 className="text-base font-semibold text-ink">{title}</h2>{description && <p className="mt-0.5 max-w-3xl text-sm leading-6 text-muted">{description}</p>}</div>
      {action}
    </div>
    {children}
  </section>;
}

/** One headline figure. `estimate` marks projected (not credited) values with a dashed frame. */
export function StatTile({ label, value, hint, icon: Icon, emphasis = false, estimate = false }: {
  label: string;
  value: string;
  hint?: string;
  icon?: LucideIcon;
  emphasis?: boolean;
  estimate?: boolean;
}) {
  return <div className={`relative min-w-0 overflow-hidden rounded-xl border bg-white p-4 sm:p-5 ${estimate ? "border-dashed border-line-strong" : "border-line"}`}>
    {emphasis && <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1 bg-brand" />}
    <div className="flex items-start justify-between gap-3">
      <dt className="text-[13px] font-medium leading-5 text-muted">{label}</dt>
      {Icon && <Icon size={18} aria-hidden="true" className={emphasis ? "shrink-0 text-brand" : "shrink-0 text-muted"} />}
    </div>
    <dd className={`mt-2 break-words text-[21px] font-semibold sm:text-[26px] leading-tight tracking-tight ${estimate ? "text-ink-soft" : "text-ink"}`}>{value}</dd>
    {hint && <p className="mt-1.5 text-xs leading-5 text-muted">{hint}</p>}
  </div>;
}

export const tableClass = "w-full text-left text-sm";
export const headCellClass = "bg-slate-50 px-5 py-2.5 align-bottom text-[11px] font-semibold uppercase leading-4 tracking-wider text-muted";
export const cellClass = "border-t border-line px-5 py-3.5 align-top";
export const numberCellClass = `${cellClass} whitespace-nowrap text-right tabular-nums`;
export const primaryButtonClass = "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-strong";
export const secondaryButtonClass = "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-line bg-white px-4 text-sm font-semibold text-ink hover:bg-canvas";
export const fieldClass = "mt-1.5 h-11 w-full rounded-lg border border-line-strong bg-white px-3 text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15 disabled:bg-canvas";
