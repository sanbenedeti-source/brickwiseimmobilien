import type { Metadata } from "next";
import { i18nText, supportedLocales, type Locale } from "./i18n";
import pages from "./seo-pages.json";

export const siteOrigin = "https://www.brickwise-immo.de";
export const publicPagePaths = Object.keys(pages);
export function localizedUrl(path: string, locale: Locale) {
  const url = new URL(path, siteOrigin);
  url.search = "";
  url.hash = "";
  url.searchParams.set("lang", locale);
  return url.toString();
}
export function languageAlternates(path: string) {
  return Object.fromEntries([...supportedLocales.map(locale => [locale, localizedUrl(path, locale)]), ["x-default", localizedUrl(path, "en")]]);
}
export function publicMetadata(path: string, locale: Locale, detail?: { title: string; description: string; image?: string; article?: boolean }): Metadata {
  const labels = (pages as Record<string, string[]>)[path];
  const label = detail?.title || labels?.[supportedLocales.indexOf(locale)] || "BRICKWISE";
  const title = /brickwise/i.test(label) ? label : `${label} | BRICKWISE`;
  // Search snippets show about 155 characters; cut at a word boundary instead of mid-word.
  const fullDescription = (detail?.description || `${label}. ${i18nText[locale].metadata.description}`).replace(/\s+/g, " ").trim();
  const description = fullDescription.length <= 160 ? fullDescription : `${fullDescription.slice(0, 156).replace(/[\s,;:–-]+\S*$/, "")}…`;
  const url = localizedUrl(path, locale);
  return {
    title, description,
    robots: { index: true, follow: true },
    alternates: { canonical: url, languages: languageAlternates(path) },
    openGraph: { title, description, url, siteName: "BRICKWISE", locale: i18nText[locale].metadata.ogLocale, type: detail?.article ? "article" : "website", ...(detail?.image ? { images: [detail.image] } : {}) },
  };
}
