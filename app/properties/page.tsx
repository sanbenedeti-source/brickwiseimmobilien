import Image from "next/image";
import { formatMinimumInvestment, INVESTMENT_TIERS, TIER_MINIMUM_EUR, toInvestmentTier, type InvestmentTier } from "../lib/investment-policy";
import { tierCopy } from "../lib/tier-copy";
import { tierCardStyles, tierIcons, tierPillStyles } from "../components/InvestmentTierCards";
import { getListedProperties } from "../lib/property-registry";
import { formatPropertyMoney, getPropertyCurrency, getPropertyProjection, getPropertyReturnBreakdown, getPropertyShareSupply, type PropertyCurrency, type PropertyReturnBreakdown } from "../lib/property-financials";
import { targetReturnCopy, rentalYieldLabel } from "../lib/target-return-copy";
import { valueGrowthCopy } from "../lib/value-growth-copy";
import PropertyConstructionBadge from "../components/PropertyConstructionBadge";
import PropertyTierBadge from "../components/PropertyTierBadge";
import { getPropertyTranslations, localizeProperty } from "../lib/property-localization";
import Link from "next/link";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { localeHtmlLang, type Locale } from "../lib/i18n";
import { getCurrentLocale } from "@/app/lib/server-locale";

export const revalidate = 300;

type Property = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  price: number | null;
  city: string | null;
  address: string | null;
  property_type: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  area: number | null;
  rooms: number | null;
  image_url: string | null;
  status: string | null;
  constructionStatus?: "completed" | "under_construction" | "upcoming";
  valueGrowthYield?: number;
  created_at: string | null;
  sourceName?: string;
  sourceUrl?: string;
  monthlyRent?: number;
  annualRent?: number;
  annualYield?: number;
  appreciationYield?: number;
  vacationPointYield?: number;
  targetTotalReturn?: number;
  targetReturnBreakdown?: PropertyReturnBreakdown;
  sharePrice?: number;
  totalShares?: number;
  blockedShares?: number;
  currency?: PropertyCurrency;
  minInvestment?: number;
  minInvestmentEur?: number;
  investmentTier?: InvestmentTier;
  fundedPercent?: number;
  payoutModel?: string;
};

type PropertiesCopy = {
  backHome: string;
  title: string;
  text: string;
  noPropertiesTitle: string;
  noPropertiesText: string;
  rentalShare: string;
  available: string;
  property: string;
  locationMissing: string;
  descriptionMissing: string;
  propertyValue: string;
  accessFrom: string;
  monthlyIncome: string;
  grossYield: string;
  onRequest: string;
  funded: string;
  viewRentalShare: string;
  importantNoteTitle: string;
  importantNoteText: string;
};

const propertiesCopy: Record<string, PropertiesCopy> = {
  en: {
    backHome: "Back to home",
    title: "Cross-border income properties with modelled rental participation",
    text:
      "Compare the available properties by location, value, rental assumptions and minimum investment. Review the risk notes before requesting details.",
    noPropertiesTitle: "No properties found",
    noPropertiesText: "There are currently no available properties for this selection.",
    rentalShare: "Rental share",
    available: "Available",
    property: "Property",
    locationMissing: "Location not provided",
    descriptionMissing: "No description available.",
    propertyValue: "Property value",
    accessFrom: "Minimum investment",
    monthlyIncome: "Monthly income/share",
    grossYield: "Net rental yield",
    onRequest: "On request",
    funded: "Funded",
    viewRentalShare: "View rental share",
    importantNoteTitle: "Important note",
    importantNoteText:
      "This website does not provide investment advice. Rent, yield, and payout figures are gross model calculations and are not guaranteed. Vacancy, costs, taxes, financing conditions, and market changes can reduce actual results.",
  },
  de: {
    backHome: "Zur Startseite",
    title: "Internationale Renditeimmobilien mit modellierter Mietbeteiligung",
    text:
      "Vergleichen Sie die verfügbaren Immobilien nach Lage, Wert, Mietannahmen und Mindestanlage. Prüfen Sie die Risikohinweise, bevor Sie eine Anfrage stellen.",
    noPropertiesTitle: "Keine Immobilien gefunden",
    noPropertiesText: "Für diese Auswahl sind derzeit keine Immobilien verfügbar.",
    rentalShare: "Mietanteil",
    available: "Verfügbar",
    property: "Immobilie",
    locationMissing: "Standort nicht angegeben",
    descriptionMissing: "Keine Beschreibung verfügbar.",
    propertyValue: "Immobilienwert",
    accessFrom: "Mindestanlage",
    monthlyIncome: "Monatliches Einkommen/Anteil",
    grossYield: "Nettomietrendite",
    onRequest: "Auf Anfrage",
    funded: "Finanziert",
    viewRentalShare: "Mietanteil ansehen",
    importantNoteTitle: "Wichtiger Hinweis",
    importantNoteText:
      "Diese Website bietet keine Anlageberatung. Mieten, Renditen und Auszahlungen beruhen auf Modellrechnungen und sind nicht garantiert. Leerstand, Kosten, Steuern, Finanzierungsbedingungen und Marktveränderungen können die tatsächlichen Ergebnisse mindern.",
  },
  fr: { backHome: "Retour à l’accueil", title: "Biens de rendement internationaux avec participation locative modélisée", text: "Comparez les biens disponibles selon leur emplacement, leur valeur, les hypothèses locatives et l’investissement minimum. Consultez les risques avant toute demande.", noPropertiesTitle: "Aucun bien trouvé", noPropertiesText: "Aucun bien n’est actuellement disponible pour cette sélection.", rentalShare: "Participation locative", available: "Disponible", property: "Bien", locationMissing: "Emplacement non indiqué", descriptionMissing: "Aucune description disponible.", propertyValue: "Valeur du bien", accessFrom: "Investissement minimum", monthlyIncome: "Revenu mensuel par part", grossYield: "Rendement locatif net", onRequest: "Sur demande", funded: "Financé", viewRentalShare: "Voir la participation", importantNoteTitle: "Information importante", importantNoteText: "Ce site ne fournit aucun conseil en investissement. Les loyers, rendements et versements reposent sur des calculs modélisés et ne sont pas garantis. La vacance, les coûts, les impôts, les conditions de financement et l’évolution du marché peuvent réduire les résultats réels." },
  es: { backHome: "Volver al inicio", title: "Inmuebles internacionales de renta con participación modelizada en el alquiler", text: "Compara los inmuebles disponibles por ubicación, valor, hipótesis de alquiler e inversión mínima. Revisa los riesgos antes de enviar una solicitud.", noPropertiesTitle: "No se encontraron inmuebles", noPropertiesText: "Actualmente no hay inmuebles disponibles para esta selección.", rentalShare: "Participación locativa", available: "Disponible", property: "Inmueble", locationMissing: "Ubicación no indicada", descriptionMissing: "No hay descripción disponible.", propertyValue: "Valor del inmueble", accessFrom: "Inversión mínima", monthlyIncome: "Ingreso mensual por participación", grossYield: "Rentabilidad neta del alquiler", onRequest: "Previa solicitud", funded: "Financiado", viewRentalShare: "Ver la participación", importantNoteTitle: "Aviso importante", importantNoteText: "Este sitio no ofrece asesoramiento de inversión. Los alquileres, la rentabilidad y los pagos se basan en cálculos modelizados y no están garantizados. La desocupación, los costes, los impuestos, las condiciones de financiación y los cambios del mercado pueden reducir los resultados reales." },
  it: { backHome: "Torna alla home", title: "Immobili internazionali a reddito con partecipazione locativa modellizzata", text: "Confronta gli immobili disponibili per posizione, valore, ipotesi di locazione e investimento minimo. Esamina i rischi prima di inviare una richiesta.", noPropertiesTitle: "Nessun immobile trovato", noPropertiesText: "Al momento non sono disponibili immobili per questa selezione.", rentalShare: "Partecipazione locativa", available: "Disponibile", property: "Immobile", locationMissing: "Posizione non indicata", descriptionMissing: "Nessuna descrizione disponibile.", propertyValue: "Valore dell'immobile", accessFrom: "Investimento minimo", monthlyIncome: "Reddito mensile per quota", grossYield: "Rendimento netto da affitto", onRequest: "Su richiesta", funded: "Finanziato", viewRentalShare: "Vedi la partecipazione", importantNoteTitle: "Nota importante", importantNoteText: "Questo sito non offre consulenza in materia di investimenti. Canoni, rendimenti e pagamenti si basano su calcoli modellizzati e non sono garantiti. Sfitto, costi, imposte, condizioni di finanziamento e variazioni di mercato possono ridurre i risultati effettivi." },
};


type PageProps = {
  searchParams?: Promise<{
    city?: string;
    tier?: string;
  }>;
};


function formatMoney(value: number | null | undefined, copy: PropertiesCopy, currency: PropertyCurrency, locale: Locale) {
  if (value == null || !Number.isFinite(value)) return copy.onRequest;
  return formatPropertyMoney(value, currency, locale);
}

function formatPercent(value: number | null | undefined, copy: PropertiesCopy, locale: Locale) {
  if (value == null || !Number.isFinite(value)) return copy.onRequest;
  return `${Number(value).toLocaleString(localeHtmlLang[locale], {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}%`;
}

async function getShareSettings() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return new Map<string, { total_shares: number; blocked_shares: number }>();
  const client = createSupabaseClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data } = await client.from("property_share_settings").select("property_slug,total_shares,blocked_shares");
  return new Map((data || []).map((item) => [item.property_slug, item]));
}

function filterProperties(properties: Property[], city?: string) {
  const normalizedCity = city?.trim().toLowerCase();
  if (!normalizedCity) return properties;

  return properties.filter((property) =>
    [property.city, property.address, property.title]
      .filter(Boolean)
      .some((value) => value!.toLowerCase().includes(normalizedCity))
  );
}

export default async function ProjektePage({ searchParams }: PageProps) {
  const locale = await getCurrentLocale();
  const copy = propertiesCopy[locale];
  const returnText = targetReturnCopy[locale];
  const growthText = valueGrowthCopy[locale];
  const [params, listed, translations, shareSettings] = await Promise.all([
    searchParams, getListedProperties(), getPropertyTranslations(locale), getShareSettings(),
  ]);

  const visibleProperties: Property[] = filterProperties(
    listed.map((property) => localizeProperty(property, translations)),
    params?.city
  );
  // Properties are listed in one section per investment level; ?tier= shows a single level.
  const tiers = tierCopy[locale];
  const selectedTier = params?.tier && (INVESTMENT_TIERS as readonly string[]).includes(params.tier) ? params.tier as InvestmentTier : null;
  const tierSections = (selectedTier ? [selectedTier] : INVESTMENT_TIERS).map((tier) => ({
    tier, properties: visibleProperties.filter((property) => toInvestmentTier(property.investmentTier) === tier),
  }));
  const tierHref = (tier: InvestmentTier | null) => {
    const query = new URLSearchParams();
    if (params?.city) query.set("city", params.city);
    if (tier) query.set("tier", tier);
    const search = query.toString();
    return `/properties${search ? `?${search}` : ""}`;
  };

  return (
    <main className="min-h-screen bg-canvas text-ink">
      <section className="bg-ink px-5 pb-16 pt-32 text-white sm:px-6 md:pb-24 md:pt-36">
        <div className="mx-auto max-w-7xl">
          <Link href="/" className="inline-flex min-h-11 items-center text-sm font-bold text-white/80 hover:text-white">
            {copy.backHome}
          </Link>

          <h1 className="font-display mt-8 max-w-4xl text-4xl font-bold leading-none sm:text-5xl md:mt-10 md:text-7xl">
            {copy.title}
          </h1>

          <p className="mt-6 max-w-3xl text-lg leading-relaxed text-white/75 md:mt-8 md:text-xl">
            {copy.text}
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-14 sm:px-6 md:py-20">
        {visibleProperties.length === 0 && (
          <div className="rounded-[24px] bg-white p-6 text-center shadow-sm md:rounded-[32px] md:p-10">
            <h2 className="text-3xl font-bold">{copy.noPropertiesTitle}</h2>
            <p className="mt-3 text-lg text-slate-500">
              {copy.noPropertiesText}
            </p>
          </div>
        )}

        <nav aria-label={tiers.kicker} className="mb-10 flex flex-wrap gap-3">
          {[null, ...INVESTMENT_TIERS].map((tier) => {
            const active = tier === selectedTier;
            const pill = tierPillStyles[tier ?? "all"];
            const PillIcon = pill.icon;
            return <Link key={tier ?? "all"} href={tierHref(tier)} aria-current={active ? "page" : undefined}
              className={`inline-flex min-h-11 items-center gap-2 rounded-full border-2 px-5 text-sm font-bold transition ${active ? `${pill.active} shadow-md` : pill.idle}`}>
              <PillIcon size={17} aria-hidden="true" />
              {tier ? <>{tiers.names[tier]}<span className="font-semibold opacity-80">· {formatMinimumInvestment(locale, TIER_MINIMUM_EUR[tier])}</span></> : tiers.all}
            </Link>;
          })}
        </nav>

        {visibleProperties.length > 0 && tierSections.map(({ tier, properties }) => {
          const Icon = tierIcons[tier];
          const dark = tier === "super_premium";
          return <section key={tier} id={`tier-${tier}`} aria-labelledby={`tier-${tier}-title`} className="mb-14 scroll-mt-28 last:mb-0">
            <div className={`mb-6 flex flex-wrap items-center justify-between gap-4 rounded-[24px] border p-6 md:p-7 ${tierCardStyles[tier]}`}>
              <div className="flex items-start gap-4">
                <Icon size={30} aria-hidden="true" className={`mt-1 shrink-0 ${dark ? "text-[#f1d48a]" : tier === "premium" ? "text-[#7a5a1e]" : "text-brand"}`} />
                <div>
                  <h2 id={`tier-${tier}-title`} className="text-2xl font-bold md:text-3xl">{tiers.names[tier]}</h2>
                  <p className={`mt-1 max-w-2xl leading-7 ${dark ? "text-white/80" : "text-slate-600"}`}>{tiers.descriptions[tier]}</p>
                </div>
              </div>
              <div className="text-left md:text-right">
                <p className={`text-sm ${dark ? "text-white/70" : "text-slate-500"}`}>{tiers.minimum}</p>
                <p className={`text-2xl font-bold md:text-3xl ${dark ? "text-[#f1d48a]" : "text-brand"}`}>{formatMinimumInvestment(locale, TIER_MINIMUM_EUR[tier])}</p>
              </div>
            </div>
            {properties.length === 0 ? <p className="rounded-[24px] border border-dashed border-line bg-white p-6 text-center text-lg text-slate-500 md:p-8">{tiers.empty}</p> :
        <div className="grid gap-8 sm:grid-cols-2 xl:grid-cols-3">
          {properties.map((property) => {
            const projection = getPropertyProjection(property);
            const supply = getPropertyShareSupply(property, shareSettings.get(property.slug));
            const fundedPercent = supply.blocked / supply.total * 100;
            return (
            <Link
              key={property.id}
              href={`/properties/${property.slug}`}
              className="group overflow-hidden rounded-[24px] bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl md:rounded-[32px]"
            >
              <div className="relative h-64 overflow-hidden">
                <Image
                  src={property.image_url || "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2"}
                  alt={property.title}
                  fill
                  sizes="(max-width: 639px) 100vw, (max-width: 1279px) 50vw, 420px"
                  unoptimized={!property.image_url?.startsWith("/")}
                  className="object-cover transition duration-500 group-hover:scale-105"
                />
              </div>

              <div className="p-5 md:p-7">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <span className="rounded-full bg-emerald-100 px-4 py-2 text-sm font-bold text-emerald-700">
                    {property.monthlyRent ? copy.rentalShare : copy.available}
                  </span>

                  <span className="rounded-full bg-slate-100 px-4 py-2 text-sm font-bold text-slate-700">
                    {property.property_type || copy.property}
                  </span>
                  <PropertyConstructionBadge status={property.constructionStatus} locale={locale} />
                  <PropertyTierBadge tier={property.investmentTier} locale={locale} />
                </div>

                <h2 className="text-2xl font-bold leading-tight md:text-3xl">
                  {property.title}
                </h2>

                <p className="mt-2 text-lg text-slate-500">
                  {property.address || property.city || copy.locationMissing}
                </p>

                <p className="mt-5 line-clamp-3 text-base leading-relaxed text-slate-600">
                  {property.description || copy.descriptionMissing}
                </p>

                <div className="mt-8 grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(9.5rem,1fr))]">
                  <InfoBox label={copy.propertyValue} value={formatMoney(property.price, copy, getPropertyCurrency(property), locale)} />
                  <InfoBox label={copy.accessFrom} value={formatMinimumInvestment(locale, property.minInvestmentEur)} />
                  <InfoBox label={returnText.monthlyPerShare} value={formatPropertyMoney(projection.monthlyPerShare, projection.currency, locale, 2)} />
                  <InfoBox label={returnText.annualPerShare} value={formatPropertyMoney(projection.annualPerShare, projection.currency, locale, 2)} />
                  <InfoBox label={rentalYieldLabel(locale, "costsStated" in property ? property.costsStated !== false : undefined)} value={formatPercent(projection.annualRate, copy, locale)} />
                  {property.valueGrowthYield ? <>
                    <InfoBox label={growthText.shortGrowth} value={formatPercent(property.valueGrowthYield, copy, locale)} />
                    <InfoBox label={growthText.shortTotal} value={formatPercent(projection.annualRate + property.valueGrowthYield, copy, locale)} />
                  </> : null}
                </div>

                {fundedPercent > 0 && (
                  <div className="mt-7">
                    <div className="mb-2 flex justify-between text-sm font-bold text-slate-500">
                      <span>{copy.funded}</span>
                      <span>{formatPercent(fundedPercent, copy, locale)}</span>
                    </div>
                    <div className="h-3 rounded-full bg-slate-100">
                      <div
                        className="h-3 rounded-full bg-emerald-600"
                        style={{ width: `${fundedPercent}%` }}
                      />
                    </div>
                  </div>
                )}

                <div className="mt-8 rounded-2xl bg-ink py-4 text-center text-lg font-bold text-white">
                  {copy.viewRentalShare}
                </div>
              </div>
            </Link>
            );
          })}
        </div>}
          </section>;
        })}
        {/* The target disclaimer applies to every card, so it is shown once under the grid. */}
        {visibleProperties.some((property) => property.targetTotalReturn !== undefined || getPropertyReturnBreakdown(property)) && <p className="mt-8 max-w-4xl text-sm leading-6 text-muted">{visibleProperties.some((property) => getPropertyReturnBreakdown(property)) ? returnText.modelNote : returnText.configuredTargetNote}{visibleProperties.some((property) => "costsStated" in property && property.costsStated === false) && ` ${returnText.costsMissingNote}`}</p>}
      </section>

      <section className="mx-auto max-w-7xl px-5 pb-16 sm:px-6 md:pb-24">
        <div className="rounded-[24px] bg-white p-6 shadow-sm md:rounded-[32px] md:p-10">
          <h2 className="text-3xl font-bold md:text-4xl">{copy.importantNoteTitle}</h2>

          <p className="mt-5 max-w-5xl text-lg leading-relaxed text-slate-600">
            {copy.importantNoteText}
          </p>
        </div>
      </section>
    </main>
  );
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-canvas p-4">
      <div className="whitespace-nowrap text-lg font-bold tabular-nums text-ink [overflow-wrap:normal]">{value}</div>
      <div className="mt-1 text-sm font-bold text-muted">{label}</div>
    </div>
  );
}
