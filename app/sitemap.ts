import type { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";
import { externalProperties, hiddenManualPropertyIds, hiddenManualPropertySlugs } from "./lib/external-properties";
import { articleTranslations } from "./insights/[slug]/translations";
import { languageAlternates, localizedUrl, publicPagePaths } from "./lib/seo";
import { supportedLocales } from "./lib/i18n";

export const revalidate = 3600;
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await supabase.from("properties").select("id,slug").in("status", ["active", "available"]).abortSignal(AbortSignal.timeout(10000));
  // Fail rather than publish an incomplete replacement during a database outage.
  if (error) throw new Error("Public property sitemap could not be loaded");
  const propertySlugs = [...externalProperties, ...(data || [])]
    .filter(p => !hiddenManualPropertyIds.includes(p.id) && !hiddenManualPropertySlugs.includes(p.slug)).map(p => p.slug);
  const paths = new Set([...publicPagePaths, ...propertySlugs.map(slug => `/properties/${encodeURIComponent(slug)}`), ...Object.keys(articleTranslations.de).map(slug => `/insights/${slug}`)]);
  return [...paths].flatMap(path => supportedLocales.map(locale => ({ url: localizedUrl(path, locale), alternates: { languages: languageAlternates(path) } })));
}
