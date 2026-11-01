import { cache } from "react";
import { createClient } from "@supabase/supabase-js";
import { TIER_MINIMUM_EUR, toInvestmentTier, type InvestmentTier } from "./investment-policy";
import { toOccupancy, toStrategy, type OccupancyStatus, type PropertyStrategy } from "./listing-badges";
import { externalProperties, getExternalPropertyBySlug, hiddenManualPropertyIds, hiddenManualPropertySlugs, isPropertyOpenForInvestment, type ListingProperty } from "./external-properties";

/** A row of the properties table (admin panel or import API). */
export type DatabasePropertyRow = {
  id: string; title: string; slug: string; description: string | null; price: number | string | null; city: string | null; address: string | null;
  property_type: string | null; bedrooms: number | null; bathrooms: number | null; area: number | string | null; rooms: number | string | null;
  image_url: string | null; status: string | null; created_at: string | null;
  monthly_rent?: number | string | null; monthly_expenses?: number | string | null; share_price?: number | string | null;
  image_urls?: string[] | null; construction_status?: string | null; monthly_value_growth?: number | string | null;
  investment_tier?: string | null; strategy?: string | null; occupancy_status?: string | null; exited_at?: string | null;
};

const number = (value: unknown) => { const parsed = Number(value); return value === null || value === undefined || value === "" || !Number.isFinite(parsed) ? null : parsed; };

/** Maps an admin-added property to the listing model used by the catalogue. It is open for
 * investment only when active, not upcoming, and given a monthly rent and a share price. */
export function mapDatabaseProperty(row: DatabasePropertyRow): ListingProperty {
  const price = number(row.price) ?? 0;
  const monthlyRent = number(row.monthly_rent) ?? 0;
  const monthlyExpenses = number(row.monthly_expenses) ?? 0;
  const sharePrice = number(row.share_price);
  const monthlyValueGrowth = number(row.monthly_value_growth) ?? 0;
  const investmentTier = toInvestmentTier(row.investment_tier);
  const constructionStatus = row.construction_status === "under_construction" || row.construction_status === "upcoming" ? row.construction_status : "completed";
  const exited = Boolean(row.exited_at);
  const investable = !exited && row.status === "active" && constructionStatus !== "upcoming" && monthlyRent > 0 && sharePrice !== null && sharePrice > 0 && price > 0;
  const annualRent = monthlyRent * 12;
  const rentalYield = price > 0 ? Math.round((monthlyRent - monthlyExpenses) * 12 / price * 10000) / 100 : 0;
  const images = (row.image_urls || []).filter((url) => typeof url === "string" && url.trim());
  const cover = row.image_url || images[0] || "";
  return {
    id: row.id, title: row.title, slug: row.slug, description: row.description || "", price,
    city: row.city || "", address: row.address || "", property_type: row.property_type || "apartment",
    bedrooms: Number(row.bedrooms) || 0, bathrooms: Number(row.bathrooms) || 0, area: number(row.area) ?? 0, rooms: number(row.rooms) ?? 0,
    image_url: cover, image_urls: images.length ? images : cover ? [cover] : [],
    status: row.status || "available", constructionStatus,
    investmentOpen: investable, listed: true, costsStated: monthlyExpenses > 0,
    created_at: row.created_at || new Date(0).toISOString(), sourceName: "Brickwise", sourceUrl: "",
    monthlyRent, monthlyExpenses, annualRent, annualYield: price > 0 ? annualRent / price * 100 : 0,
    targetTotalReturn: rentalYield, appreciationYield: 0,
    valueGrowthYield: price > 0 && monthlyValueGrowth > 0 ? Math.round(monthlyValueGrowth * 12 / price * 10000) / 100 : undefined, sharePrice: sharePrice ?? 1000, currency: "EUR",
    minInvestmentEur: TIER_MINIMUM_EUR[investmentTier], investmentTier, strategy: toStrategy(row.strategy), occupancyStatus: toOccupancy(row.occupancy_status), exited, fundedPercent: 0,
    payoutModel: "Projected rental yield = (monthly rent - stated monthly costs) x 12 / property value. No appreciation or other non-cash benefit is included.",
  };
}

/** Public admin-added properties (read once per request). An unavailable database yields none. */
export const getDatabaseProperties = cache(async (): Promise<ListingProperty[]> => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return [];
  try {
    const client = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data, error } = await client.from("properties").select("*").in("status", ["active", "available"])
      .order("created_at", { ascending: false }).abortSignal(AbortSignal.timeout(3000));
    if (error) return [];
    return ((data || []) as DatabasePropertyRow[])
      .filter((row) => !hiddenManualPropertyIds.includes(row.id) && !hiddenManualPropertySlugs.includes(row.slug) && !getExternalPropertyBySlug(row.slug))
      .map(mapDatabaseProperty);
  } catch { return []; }
});

const constructionStatuses = ["completed", "under_construction", "upcoming"] as const;
type ConstructionStatus = (typeof constructionStatuses)[number];

type CatalogueSaleSettings = { constructionStatus: ConstructionStatus; investmentTier: InvestmentTier; strategy?: PropertyStrategy; occupancyStatus?: OccupancyStatus; exited: boolean };

/** Construction status and tier the admin set for catalogue listings (by slug). Null when they cannot be read. */
const getCatalogueSaleStatus = cache(async (): Promise<Map<string, CatalogueSaleSettings> | null> => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return new Map();
  try {
    const client = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data, error } = await client.from("property_sale_status").select("property_slug,construction_status,investment_tier,strategy,occupancy_status,exited_at").abortSignal(AbortSignal.timeout(3000));
    if (error) return null;
    return new Map(((data || []) as { property_slug: string; construction_status: string; investment_tier?: string | null; strategy?: string | null; occupancy_status?: string | null; exited_at?: string | null }[])
      .filter((row) => (constructionStatuses as readonly string[]).includes(row.construction_status))
      .map((row) => [row.property_slug, { constructionStatus: row.construction_status as ConstructionStatus, investmentTier: toInvestmentTier(row.investment_tier),
        strategy: toStrategy(row.strategy), occupancyStatus: toOccupancy(row.occupancy_status), exited: Boolean(row.exited_at) }]));
  } catch { return null; }
});

/** Catalogue listings with the sale status and tier set in the admin panel. Upcoming closes a listing for purchase,
 * and when the status cannot be read no catalogue listing is open for purchase. */
export const getCatalogueProperties = cache(async (): Promise<ListingProperty[]> => {
  const statuses = await getCatalogueSaleStatus();
  return externalProperties.map((property) => {
    const saved = statuses?.get(property.slug);
    const constructionStatus = saved?.constructionStatus ?? property.constructionStatus;
    const investmentTier = saved?.investmentTier ?? toInvestmentTier(property.investmentTier);
    const exited = saved?.exited ?? Boolean(property.exited);
    return { ...property, constructionStatus, investmentTier, minInvestmentEur: TIER_MINIMUM_EUR[investmentTier],
      strategy: saved ? saved.strategy : property.strategy, occupancyStatus: saved ? saved.occupancyStatus : property.occupancyStatus, exited,
      investmentOpen: statuses !== null && !exited && constructionStatus !== "upcoming" && isPropertyOpenForInvestment(property) };
  });
});

/** Catalogue listings followed by admin-added properties. */
export const getAllProperties = cache(async (): Promise<ListingProperty[]> => [...await getCatalogueProperties(), ...await getDatabaseProperties()]);

/** Properties shown on the website: catalogue listings that are not hidden, then admin-added properties. */
export const getListedProperties = cache(async (): Promise<ListingProperty[]> => (await getAllProperties()).filter((property) => property.listed !== false));

export async function findCatalogueProperty(slug: string) {
  return (await getCatalogueProperties()).find((property) => property.slug === slug);
}

export async function findProperty(slug: string) {
  return (await findCatalogueProperty(slug)) ?? (await getDatabaseProperties()).find((property) => property.slug === slug);
}
