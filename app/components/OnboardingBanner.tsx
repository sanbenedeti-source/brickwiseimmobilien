"use client";
import { ArrowRight, FileCheck2 } from "lucide-react";
import { portalNavCopy } from "../lib/portal-nav-copy";
import type { Locale } from "../lib/i18n";
import { openProfileEvent } from "./portal-events";
import { useProfileCompletion } from "./useProfileCompletion";

/** Top-of-page reminder until the client has completed the profile and signed the agreement. */
export default function OnboardingBanner({ locale }: { locale: Locale }) {
  const { known, complete } = useProfileCompletion(locale);
  if (!known || complete) return null;
  const copy = portalNavCopy[locale];
  return (
    <div role="status" className="flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-amber-200 bg-amber-50 px-4 py-3 sm:px-6 lg:px-8">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500 text-white"><FileCheck2 size={18} aria-hidden="true" /></span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-ink">{copy.onboardingTitle}</p>
        <p className="text-sm text-amber-950">{copy.profileHint}</p>
      </div>
      <button type="button" onClick={() => window.dispatchEvent(new Event(openProfileEvent))}
        className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-amber-300 bg-white px-4 text-sm font-bold text-ink hover:border-amber-500">
        {copy.profileAction}<ArrowRight size={15} aria-hidden="true" />
      </button>
    </div>
  );
}
