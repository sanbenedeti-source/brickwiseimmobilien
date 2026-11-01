import type { Locale } from "./i18n";

/** Optional investment strategy shown as a badge on the property card. */
export const PROPERTY_STRATEGIES = ["prime", "capital_growth", "high_yield"] as const;
export type PropertyStrategy = (typeof PROPERTY_STRATEGIES)[number];
/** Rented = a tenant is in place; ready = vacant and ready to rent. */
export const OCCUPANCY_STATUSES = ["rented", "ready"] as const;
export type OccupancyStatus = (typeof OCCUPANCY_STATUSES)[number];
/** Available = can be bought or is upcoming, funded = every share is sold, exited = the property was sold. */
export const LISTING_STAGES = ["available", "funded", "exited"] as const;
export type ListingStage = (typeof LISTING_STAGES)[number];

const NEW_LISTING_DAYS = 30;

export function toStrategy(value: unknown): PropertyStrategy | undefined {
  return (PROPERTY_STRATEGIES as readonly unknown[]).includes(value) ? value as PropertyStrategy : undefined;
}

export function toOccupancy(value: unknown): OccupancyStatus | undefined {
  return (OCCUPANCY_STATUSES as readonly unknown[]).includes(value) ? value as OccupancyStatus : undefined;
}

export function isNewListing(createdAt: string | null | undefined, now = Date.now()) {
  const created = createdAt ? Date.parse(createdAt) : NaN;
  return Number.isFinite(created) && now - created >= 0 && now - created < NEW_LISTING_DAYS * 86_400_000;
}

export function listingStage(property: { exited?: boolean }, availableShares: number): ListingStage {
  if (property.exited) return "exited";
  return availableShares <= 0 ? "funded" : "available";
}

type ListingBadgeCopy = {
  strategies: Record<PropertyStrategy, string>;
  occupancy: Record<OccupancyStatus, string>;
  stages: Record<ListingStage, string>;
  newListing: string;
  funded: string;
  fiveYearReturn: string;
  yearlyReturn: string;
  emptyStage: Record<Exclude<ListingStage, "available">, string>;
};

export const listingBadgeCopy: Record<Locale, ListingBadgeCopy> = {
  en: {
    strategies: { prime: "Prime", capital_growth: "Capital Growth", high_yield: "High Yield" },
    occupancy: { rented: "Rented", ready: "Ready to rent" },
    stages: { available: "Available", funded: "Funded", exited: "Exited" },
    newListing: "New listing",
    funded: "funded",
    fiveYearReturn: "5-year total return",
    yearlyReturn: "Yearly return (rent + value growth)",
    emptyStage: { funded: "No fully funded properties yet.", exited: "No properties have been sold yet." },
  },
  de: {
    strategies: { prime: "Prime", capital_growth: "Wertzuwachs", high_yield: "Hohe Rendite" },
    occupancy: { rented: "Vermietet", ready: "Bezugsfertig" },
    stages: { available: "Verfügbar", funded: "Finanziert", exited: "Verkauft" },
    newListing: "Neu",
    funded: "finanziert",
    fiveYearReturn: "Gesamtrendite 5 Jahre",
    yearlyReturn: "Jährliche Rendite (Miete + Wertsteigerung)",
    emptyStage: { funded: "Noch keine vollständig finanzierten Immobilien.", exited: "Noch keine Immobilie wurde verkauft." },
  },
  fr: {
    strategies: { prime: "Prime", capital_growth: "Plus-value", high_yield: "Haut rendement" },
    occupancy: { rented: "Loué", ready: "Prêt à louer" },
    stages: { available: "Disponibles", funded: "Financés", exited: "Vendus" },
    newListing: "Nouveau",
    funded: "financé",
    fiveYearReturn: "Rendement total sur 5 ans",
    yearlyReturn: "Rendement annuel (loyer + plus-value)",
    emptyStage: { funded: "Aucun bien entièrement financé pour le moment.", exited: "Aucun bien n’a encore été vendu." },
  },
  es: {
    strategies: { prime: "Prime", capital_growth: "Revalorización", high_yield: "Alta rentabilidad" },
    occupancy: { rented: "Alquilado", ready: "Listo para alquilar" },
    stages: { available: "Disponibles", funded: "Financiados", exited: "Vendidos" },
    newListing: "Nuevo",
    funded: "financiado",
    fiveYearReturn: "Rentabilidad total a 5 años",
    yearlyReturn: "Rentabilidad anual (alquiler + revalorización)",
    emptyStage: { funded: "Todavía no hay inmuebles totalmente financiados.", exited: "Todavía no se ha vendido ningún inmueble." },
  },
  it: {
    strategies: { prime: "Prime", capital_growth: "Rivalutazione", high_yield: "Alto rendimento" },
    occupancy: { rented: "Affittato", ready: "Pronto da affittare" },
    stages: { available: "Disponibili", funded: "Finanziati", exited: "Venduti" },
    newListing: "Novità",
    funded: "finanziato",
    fiveYearReturn: "Rendimento totale a 5 anni",
    yearlyReturn: "Rendimento annuo (affitto + rivalutazione)",
    emptyStage: { funded: "Ancora nessun immobile completamente finanziato.", exited: "Nessun immobile è stato ancora venduto." },
  },
};
