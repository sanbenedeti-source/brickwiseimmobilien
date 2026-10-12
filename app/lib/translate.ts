import translations from "./ui-translations.json";
import type { Locale } from "./i18n";

const columns = { de: 0, fr: 1, es: 2, it: 3 };
export function createTranslator(locale: Locale) {
  return (source: string): string => locale === "en" ? source :
    (translations as Record<string, string[]>)[source]?.[columns[locale]] ?? source;
}

export function translateContent<T>(value: T, locale: Locale): T {
  const t = createTranslator(locale);
  function visit(item: unknown): unknown {
    if (typeof item === "string") return t(item);
    if (Array.isArray(item)) return item.map(visit);
    if (item && typeof item === "object") return Object.fromEntries(Object.entries(item).map(([key, child]) => [key, visit(child)]));
    return item;
  }
  return visit(value) as T;
}
