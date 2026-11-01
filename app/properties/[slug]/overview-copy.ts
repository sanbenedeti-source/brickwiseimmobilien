import type { Locale } from "../../lib/i18n";
import type { PropertyStrategy } from "../../lib/listing-badges";

type OverviewCopy = {
  howTitle: string;
  steps: [string, string][];
  strategyTitle: string;
  strategies: Record<PropertyStrategy, string>;
  financialsTitle: string;
  propertyColumn: string;
  rentalColumn: string;
  grossRent: string;
  costs: string;
  netRent: string;
  currentRent: string;
  rentShared: string;
  yieldLine: string;
  afterCosts: string;
  beforeCosts: string;
  growthLine: string;
  growthEstimate: string;
  available: string;
  investNow: string;
  aboutTitle: string;
};

/** Texts of the property overview (detail page for visitors and clients). */
export const overviewCopy: Record<Locale, OverviewCopy> = {
  en: {
    howTitle: "How it works",
    steps: [
      ["Invest in a share", "Buy shares of this property from the minimum investment."],
      ["Earn rental income", "Your share of the net rent is credited to your wallet."],
      ["Benefit from value growth", "Any increase in value is realised when the property or your shares are sold."],
    ],
    strategyTitle: "Investment strategy",
    strategies: {
      prime: "Established, sought-after location with steady rental demand and lower vacancy risk.",
      capital_growth: "Area in development where most of the expected return comes from rising property values.",
      high_yield: "Lower entry price relative to rent, focused on monthly rental income.",
    },
    financialsTitle: "Financials",
    propertyColumn: "Property",
    rentalColumn: "Rental income per year",
    grossRent: "Gross rent",
    costs: "Costs",
    netRent: "Net rent",
    currentRent: "Rent {amount} per month",
    rentShared: "Your share of the net rent is distributed monthly.",
    yieldLine: "{rate} projected rental yield p.a.",
    afterCosts: "After the stated monthly costs.",
    beforeCosts: "Before costs: operating costs have not been stated yet.",
    growthLine: "{rate} projected value growth p.a.",
    growthEstimate: "An estimate, realised only on sale.",
    available: "{amount} available",
    investNow: "Invest now",
    aboutTitle: "About this property",
  },
  de: {
    howTitle: "So funktioniert es",
    steps: [
      ["In Anteile investieren", "Kaufen Sie Anteile dieser Immobilie ab der Mindestanlage."],
      ["Mieteinnahmen erhalten", "Ihr Anteil an der Nettomiete wird Ihrem Wallet gutgeschrieben."],
      ["Von Wertsteigerung profitieren", "Eine Wertsteigerung wird beim Verkauf der Immobilie oder Ihrer Anteile realisiert."],
    ],
    strategyTitle: "Anlagestrategie",
    strategies: {
      prime: "Etablierte, gefragte Lage mit stabiler Mietnachfrage und geringerem Leerstandsrisiko.",
      capital_growth: "Aufstrebende Lage, in der ein Großteil der erwarteten Rendite aus steigenden Immobilienwerten kommt.",
      high_yield: "Niedriger Einstiegspreis im Verhältnis zur Miete, mit Fokus auf monatliche Mieteinnahmen.",
    },
    financialsTitle: "Finanzen",
    propertyColumn: "Immobilie",
    rentalColumn: "Mieteinnahmen pro Jahr",
    grossRent: "Bruttomiete",
    costs: "Kosten",
    netRent: "Nettomiete",
    currentRent: "Miete {amount} pro Monat",
    rentShared: "Ihr Anteil an der Nettomiete wird monatlich ausgeschüttet.",
    yieldLine: "{rate} prognostizierte Mietrendite p.a.",
    afterCosts: "Nach den angegebenen monatlichen Kosten.",
    beforeCosts: "Vor Kosten: Betriebskosten wurden noch nicht angegeben.",
    growthLine: "{rate} prognostizierte Wertsteigerung p.a.",
    growthEstimate: "Eine Schätzung, realisiert erst beim Verkauf.",
    available: "{amount} verfügbar",
    investNow: "Jetzt investieren",
    aboutTitle: "Über diese Immobilie",
  },
  fr: {
    howTitle: "Comment ça marche",
    steps: [
      ["Investir dans des parts", "Achetez des parts de ce bien à partir de l’investissement minimum."],
      ["Percevoir des loyers", "Votre part du loyer net est créditée sur votre portefeuille."],
      ["Profiter de la plus-value", "Toute hausse de valeur est réalisée à la vente du bien ou de vos parts."],
    ],
    strategyTitle: "Stratégie d’investissement",
    strategies: {
      prime: "Emplacement établi et recherché, avec une demande locative stable et un risque de vacance plus faible.",
      capital_growth: "Quartier en développement où l’essentiel du rendement attendu provient de la hausse des prix.",
      high_yield: "Prix d’entrée bas par rapport au loyer, axé sur les revenus locatifs mensuels.",
    },
    financialsTitle: "Données financières",
    propertyColumn: "Bien",
    rentalColumn: "Revenus locatifs par an",
    grossRent: "Loyer brut",
    costs: "Charges",
    netRent: "Loyer net",
    currentRent: "Loyer de {amount} par mois",
    rentShared: "Votre part du loyer net est distribuée chaque mois.",
    yieldLine: "{rate} de rendement locatif projeté par an",
    afterCosts: "Après les charges mensuelles indiquées.",
    beforeCosts: "Avant charges : les charges d’exploitation ne sont pas encore indiquées.",
    growthLine: "{rate} de plus-value projetée par an",
    growthEstimate: "Une estimation, réalisée uniquement à la vente.",
    available: "{amount} disponibles",
    investNow: "Investir maintenant",
    aboutTitle: "À propos de ce bien",
  },
  es: {
    howTitle: "Cómo funciona",
    steps: [
      ["Invierte en participaciones", "Compra participaciones de este inmueble desde la inversión mínima."],
      ["Recibe ingresos por alquiler", "Tu parte del alquiler neto se abona en tu monedero."],
      ["Benefíciate de la revalorización", "Cualquier revalorización se materializa al vender el inmueble o tus participaciones."],
    ],
    strategyTitle: "Estrategia de inversión",
    strategies: {
      prime: "Ubicación consolidada y muy demandada, con demanda de alquiler estable y menor riesgo de desocupación.",
      capital_growth: "Zona en desarrollo donde la mayor parte de la rentabilidad esperada procede de la revalorización.",
      high_yield: "Precio de entrada bajo en relación con el alquiler, centrado en los ingresos mensuales.",
    },
    financialsTitle: "Datos financieros",
    propertyColumn: "Inmueble",
    rentalColumn: "Ingresos por alquiler al año",
    grossRent: "Alquiler bruto",
    costs: "Costes",
    netRent: "Alquiler neto",
    currentRent: "Alquiler de {amount} al mes",
    rentShared: "Tu parte del alquiler neto se reparte cada mes.",
    yieldLine: "{rate} de rentabilidad por alquiler proyectada anual",
    afterCosts: "Después de los costes mensuales indicados.",
    beforeCosts: "Antes de costes: aún no se han indicado los costes de explotación.",
    growthLine: "{rate} de revalorización proyectada anual",
    growthEstimate: "Una estimación que solo se materializa al vender.",
    available: "{amount} disponibles",
    investNow: "Invertir ahora",
    aboutTitle: "Sobre este inmueble",
  },
  it: {
    howTitle: "Come funziona",
    steps: [
      ["Investi in quote", "Acquista quote di questo immobile a partire dall’investimento minimo."],
      ["Ricevi il reddito da affitto", "La tua quota dell’affitto netto viene accreditata nel tuo wallet."],
      ["Benefici della rivalutazione", "L’eventuale aumento di valore si realizza alla vendita dell’immobile o delle quote."],
    ],
    strategyTitle: "Strategia di investimento",
    strategies: {
      prime: "Zona affermata e richiesta, con domanda di affitto stabile e minor rischio di sfitto.",
      capital_growth: "Zona in sviluppo in cui gran parte del rendimento atteso deriva dall’aumento dei valori.",
      high_yield: "Prezzo d’ingresso basso rispetto all’affitto, orientato al reddito mensile da locazione.",
    },
    financialsTitle: "Dati finanziari",
    propertyColumn: "Immobile",
    rentalColumn: "Reddito da affitto annuo",
    grossRent: "Affitto lordo",
    costs: "Costi",
    netRent: "Affitto netto",
    currentRent: "Affitto di {amount} al mese",
    rentShared: "La tua quota dell’affitto netto viene distribuita ogni mese.",
    yieldLine: "{rate} di rendimento da affitto previsto annuo",
    afterCosts: "Dopo i costi mensili indicati.",
    beforeCosts: "Prima dei costi: i costi di gestione non sono ancora stati indicati.",
    growthLine: "{rate} di rivalutazione prevista annua",
    growthEstimate: "Una stima, realizzata solo alla vendita.",
    available: "{amount} disponibili",
    investNow: "Investi ora",
    aboutTitle: "Informazioni sull’immobile",
  },
};
