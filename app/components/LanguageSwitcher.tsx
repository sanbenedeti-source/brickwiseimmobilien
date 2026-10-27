"use client";

import { usePathname, useSearchParams } from "next/navigation";
import {
  Locale,
  localeLabels,
  supportedLocales,
} from "../lib/i18n";

export default function LanguageSwitcher({
  currentLocale,
  label,
}: {
  currentLocale: Locale;
  label: string;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function changeLocale(locale: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("lang", locale);
    const queryString = params.toString();
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- The locale proxy sets the language cookie; reload all locale-dependent client state.
    window.location.href = `${pathname}${queryString ? `?${queryString}` : ""}`;
  }

  return (
    <label className="flex items-center gap-2 text-sm font-bold text-ink">
      <span className="sr-only">{label}</span>
      <select
        value={currentLocale}
        onChange={(event) => changeLocale(event.target.value)}
        aria-label={label}
        className="min-h-10 rounded-xl border border-line-strong bg-white px-3 text-sm font-bold outline-none transition hover:border-slate-400 focus:border-ink"
      >
        {supportedLocales.map((locale) => (
          <option key={locale} value={locale}>
            {localeLabels[locale]}
          </option>
        ))}
      </select>
    </label>
  );
}
