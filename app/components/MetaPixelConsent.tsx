"use client";

import type { Locale } from "../lib/i18n";
import { sharedCopy } from "../lib/shared-copy";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

import { consentKey, readConsent, chooseConsent, checkMarketingRoute, stopMarketing, type Consent } from "../lib/marketing";

export default function MetaPixelConsent({ locale }: { locale: Locale }) {
  const text = sharedCopy[locale];
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [consent, setConsent] = useState<Consent>(null);
  const [ready, setReady] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      setConsent(readConsent());
      setReady(true);
    });
    const sync = (event: StorageEvent) => {
      if (event.key !== consentKey && event.key !== null) return;
      const value = readConsent();
      if (value !== "accepted") stopMarketing();
      setConsent(value);
    };
    window.addEventListener("storage", sync);
    return () => { active = false; window.removeEventListener("storage", sync); };
  }, []);

  useEffect(() => {
    if (ready) checkMarketingRoute();
  }, [ready, consent, pathname, searchParams]);

  function choose(value: Exclude<Consent, null>) {
    chooseConsent(value);
    setConsent(value);
    setSettingsOpen(false);
  }

  if (!ready) return null;

  return (
    <>
      {(consent === null || settingsOpen) && (
        <section role="dialog" aria-label={text.consentTitle} className="fixed inset-x-4 bottom-4 z-[100] mx-auto max-w-3xl border border-[#cfd6df] bg-white p-5 shadow-2xl sm:p-6">
          <h2 className="text-xl font-bold text-[#17233f]">{text.consentTitle}</h2>
          <p className="mt-2 leading-6 text-[#526078]">{text.consentText}</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <button type="button" onClick={() => choose("accepted")} className="min-h-11 w-full bg-[#17233f] px-5 font-bold text-white sm:w-auto">{text.accept}</button>
            <button type="button" onClick={() => choose("rejected")} className="min-h-11 w-full border border-[#17233f] bg-white px-5 font-bold text-[#17233f] sm:w-auto">{text.reject}</button>
            <LinkToPrivacy label={text.privacy} />
          </div>
        </section>
      )}
      {consent !== null && !settingsOpen && (
        <button type="button" onClick={() => setSettingsOpen(true)} style={{ left: "auto", right: "12px" }} className="fixed bottom-3 z-[90] border border-[#cfd6df] bg-white px-3 py-2 text-xs font-bold text-[#17233f] shadow-md" aria-label={text.change}>{text.settings}</button>
      )}
    </>
  );
}

function LinkToPrivacy({ label }: { label: string }) {
  return <a href="/privacy" className="inline-flex min-h-11 items-center px-2 font-bold text-[#2f79a5] underline">{label}</a>;
}
