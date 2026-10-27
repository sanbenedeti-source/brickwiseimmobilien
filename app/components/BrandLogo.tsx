"use client";

import Link from "next/link";
import { useLocale } from "./LocaleProvider";
import type { Locale } from "../lib/i18n";

// Inline instead of the full UI translation table, which would ship with every page.
const tagline: Record<Locale, string> = {
  en: "Fractional Real Estate",
  de: "Immobilienbeteiligung",
  fr: "Immobilier fractionné",
  es: "Inmuebles fraccionados",
  it: "Immobili frazionati",
};

type BrandLogoProps = {
  className?: string;
  inverted?: boolean;
};

function GlobalRealEstateMark() {
  return (
    <span className="relative flex h-10 w-10 shrink-0 items-center justify-center sm:h-11 sm:w-11">
      <svg
        viewBox="0 0 72 72"
        aria-hidden="true"
        className="h-full w-full"
        fill="none"
      >
        <path d="M7 31 33 9v25L22 44H7V31Z" fill="#152238" />
        <path d="M39 9 65 31v22H43l8-9-8-8 8 1-12-12V9Z" fill="#168BD3" />
        <path d="M7 50h20v15H7V50Z" fill="#152238" />
        <path d="M33 50h32v15H33V50Z" fill="#08A88A" />
        <path d="m27 57 18-22-1 9 9-1-20 22V53l-6 4Z" fill="#FFFFFF" />
        <circle cx="19" cy="57" r="3.6" fill="#FFFFFF" />
        <path d="M19 60.5V65" stroke="#FFFFFF" strokeWidth="2.5" />
      </svg>
    </span>
  );
}

export default function BrandLogo({ className = "", inverted = false }: BrandLogoProps) {
  const locale = useLocale();
  const primaryText = inverted ? "text-white" : "text-ink";
  const secondaryText = inverted ? "text-brand-light" : "text-muted";

  return (
    <Link href="/" className={`flex min-w-0 items-center gap-2 sm:gap-3 ${className}`}>
      <GlobalRealEstateMark />
      <span className="min-w-0 leading-none">
        <span className={`block max-w-[8.8rem] truncate text-lg font-semibold sm:max-w-none sm:text-xl ${primaryText}`}>
          BRICKWISE
        </span>
        <span className={`mt-1 block max-w-[8.8rem] truncate text-[9px] font-semibold uppercase sm:max-w-none sm:text-[10px] ${secondaryText}`}>
          {tagline[locale]}
        </span>
      </span>
    </Link>
  );
}
