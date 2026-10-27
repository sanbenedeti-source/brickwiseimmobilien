import type { ReactNode } from "react";
import { Check, Clock3 } from "lucide-react";
import { fillTemplate, type PortalCopy } from "../lib/portal-copy";

export type OnboardingStep = { key: string; label: string; status: "done" | "review" | "todo"; action?: ReactNode };

/** Progress card shown until every onboarding step is complete. */
export default function OnboardingChecklist({ steps, text }: { steps: OnboardingStep[]; text: PortalCopy }) {
  const done = steps.filter((step) => step.status === "done").length;
  if (done === steps.length) return null;
  const next = steps.find((step) => step.status === "todo");
  return <section className="mb-6 overflow-hidden rounded-xl border border-line bg-white">
    <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line px-5 py-4">
      <div><h2 className="text-base font-semibold">{text.onboardingTitle}</h2><p className="mt-0.5 text-sm text-muted">{text.onboardingIntro}</p></div>
      <div className="w-full max-w-xs"><p className="text-right text-xs font-semibold text-muted">{fillTemplate(text.stepsDone, { done, total: steps.length })}</p><div className="mt-1.5 h-2 overflow-hidden rounded-full bg-brand-soft" role="progressbar" aria-valuemin={0} aria-valuemax={steps.length} aria-valuenow={done}><div className="h-full rounded-full bg-brand" style={{ width: `${done / steps.length * 100}%` }} /></div></div>
    </div>
    <ol className="grid divide-y divide-line sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-3">
      {steps.map((step, index) => <li key={step.key} className={`flex items-center gap-3 px-5 py-3.5 sm:border-b sm:border-line ${step.key === next?.key ? "bg-brand-soft/50" : ""}`}>
        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${step.status === "done" ? "bg-emerald-600 text-white" : step.status === "review" ? "bg-amber-100 text-amber-800" : step.key === next?.key ? "bg-brand text-white" : "bg-canvas text-muted"}`}>
          {step.status === "done" ? <Check size={14} aria-hidden="true" /> : step.status === "review" ? <Clock3 size={14} aria-hidden="true" /> : index + 1}
        </span>
        <div className="min-w-0 flex-1"><p className={`text-sm ${step.status === "done" ? "text-muted line-through decoration-line-strong" : "font-semibold text-ink"}`}>{step.label}</p>{step.status === "review" && <p className="text-xs text-amber-800">{text.inReview}</p>}</div>
        {step.status === "todo" && step.action}
      </li>)}
    </ol>
  </section>;
}
