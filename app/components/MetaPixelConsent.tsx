"use client";

import type { Locale } from "../lib/i18n";
import { sharedCopy } from "../lib/shared-copy";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

import { consentKey, readConsent, chooseConsent, checkMarketingRoute, stopMarketing, type Consent } from "../lib/marketing";
import { cookieSettingsEvent } from "./CookieSettingsButton";

export default function MetaPixelConsent({ locale }: { locale: Locale }) {
  const text = sharedCopy[locale];
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [consent, setConsent] = useState<Consent>(null);
  const [ready, setReady] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const visible = ready && (consent === null || settingsOpen);

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
    const openSettings = () => setSettingsOpen(true);
    window.addEventListener("storage", sync);
    window.addEventListener(cookieSettingsEvent, openSettings);
    return () => { active = false; window.removeEventListener("storage", sync); window.removeEventListener(cookieSettingsEvent, openSettings); };
  }, []);

  useEffect(() => {
    if (ready) checkMarketingRoute();
  }, [ready, consent, pathname, searchParams]);

  // The banner renders after the page content, so move keyboard focus to it when it appears.
  useEffect(() => {
    if (visible) heading.current?.focus();
  }, [visible]);

  function choose(value: Exclude<Consent, null>) {
    chooseConsent(value);
    setConsent(value);
    setSettingsOpen(false);
  }

  if (!visible) return null;

  return (
    <>
      {visible && (
        <section role="dialog" aria-label={text.consentTitle} className="fixed inset-x-3 bottom-3 z-[100] mx-auto max-w-3xl rounded-xl border border-line bg-white p-4 shadow-2xl sm:inset-x-4 sm:bottom-4 sm:p-6">
          <h2 ref={heading} tabIndex={-1} className="text-lg font-bold text-ink outline-none sm:text-xl">{text.consentTitle}</h2>
          <p className="mt-2 text-sm leading-6 text-muted sm:text-base">{text.consentText}</p>
          {/* Accept and reject are equally prominent, as German regulators expect. */}
          <div className="mt-4 grid grid-cols-2 gap-3 sm:mt-5 sm:flex sm:flex-wrap sm:items-center">
            <button type="button" onClick={() => choose("accepted")} className="min-h-11 border border-ink bg-ink px-5 font-bold text-white hover:bg-ink-soft">{text.accept}</button>
            <button type="button" onClick={() => choose("rejected")} className="min-h-11 border border-ink bg-ink px-5 font-bold text-white hover:bg-ink-soft">{text.reject}</button>
            <LinkToPrivacy label={text.privacy} />
          </div>
        </section>
      )}
    </>
  );
}

function LinkToPrivacy({ label }: { label: string }) {
  return <a href="/privacy" className="col-span-2 inline-flex min-h-11 items-center px-2 font-bold text-brand underline">{label}</a>;
}
