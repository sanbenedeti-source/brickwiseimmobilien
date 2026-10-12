import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import seedTranslations from "@/PROPERTY_TRANSLATIONS_SEED.json";
import type { Locale } from "./i18n";

type Translation = { property_slug: string; title: string; description: string; property_type: string | null };

/** A single translation source for home, marketplace, dashboard and detail. */
export const getPropertyTranslations = cache(async (locale: Locale) => {
  const translations = new Map<string, Translation>(seedTranslations
    .filter((item) => item.locale === locale)
    .map((item) => [item.property_slug, item]));
  const supabase = await createClient();
  const { data } = await supabase.from("property_translations")
    .select("property_slug,title,description,property_type").eq("locale", locale);
  for (const item of data || []) {
    if (item.title?.trim() && item.description?.trim()) translations.set(item.property_slug, item);
  }
  return translations;
});

export function localizeProperty<T extends { slug: string; title: string; description: string | null; property_type: string | null }>(property: T, translations: Map<string, Translation>): T {
  const translation = translations.get(property.slug);
  return translation ? { ...property, title: translation.title, description: translation.description, property_type: translation.property_type || property.property_type } : property;
}
