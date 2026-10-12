import type { Locale } from "./i18n";

export const contentLocales: Locale[] = ["en", "de", "fr", "es", "it"];

export const contentLocaleLabels: Record<Locale, string> = {
  en: "English",
  de: "Deutsch",
  fr: "Français",
  es: "Español",
  it: "Italiano",
};

export type PropertyTranslation = {
  property_slug: string;
  locale: Locale;
  title: string;
  description: string;
  property_type: string | null;
  highlights: string[];
  location_description: string | null;
  seo_title: string | null;
  seo_description: string | null;
};

export function readRequiredTranslation(formData: FormData, locale: Locale) {
  const title = String(formData.get(`title_${locale}`) || "").trim();
  const description = String(formData.get(`description_${locale}`) || "").trim();
  const propertyType = String(formData.get(`property_type_${locale}`) || "").trim();
  const locationDescription = String(formData.get(`location_description_${locale}`) || "").trim();
  const highlights = String(formData.get(`highlights_${locale}`) || "")
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);

  if (!title || !description) {
    throw new Error(`Missing required ${locale.toUpperCase()} title or description.`);
  }

  return {
    locale,
    title,
    description,
    property_type: propertyType || null,
    highlights,
    location_description: locationDescription || null,
    seo_title: String(formData.get(`seo_title_${locale}`) || "").trim() || null,
    seo_description: String(formData.get(`seo_description_${locale}`) || "").trim() || null,
  };
}
