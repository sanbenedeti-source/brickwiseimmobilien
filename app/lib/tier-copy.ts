import type { Locale } from "./i18n";
import type { InvestmentTier } from "./investment-policy";

type TierCopy = {
  kicker: string;
  title: string;
  intro: string;
  all: string;
  minimum: string;
  view: string;
  empty: string;
  names: Record<InvestmentTier, string>;
  descriptions: Record<InvestmentTier, string>;
};

/** Texts that introduce the three investment levels on the home page and the property list. */
export const tierCopy: Record<Locale, TierCopy> = {
  en: {
    kicker: "Investment levels",
    title: "Three investment levels",
    intro: "Every Brickwise property belongs to one level. The level sets the minimum investment, from an accessible entry to exclusive premium properties.",
    all: "All levels",
    minimum: "Minimum investment",
    view: "View properties",
    empty: "No properties are listed in this level yet. New properties will appear here.",
    names: { standard: "Standard", premium: "Premium", super_premium: "Super Premium" },
    descriptions: {
      standard: "Accessible properties for building a portfolio step by step.",
      premium: "Selected high-value properties in sought-after locations.",
      super_premium: "Exclusive top-tier properties for larger investments.",
    },
  },
  de: {
    kicker: "Anlagestufen",
    title: "Drei Anlagestufen",
    intro: "Jede Brickwise-Immobilie gehört zu einer Stufe. Die Stufe bestimmt die Mindestanlage – vom zugänglichen Einstieg bis zu exklusiven Premium-Immobilien.",
    all: "Alle Stufen",
    minimum: "Mindestanlage",
    view: "Immobilien ansehen",
    empty: "In dieser Stufe sind noch keine Immobilien gelistet. Neue Immobilien erscheinen hier.",
    names: { standard: "Standard", premium: "Premium", super_premium: "Super Premium" },
    descriptions: {
      standard: "Zugängliche Immobilien, um ein Portfolio Schritt für Schritt aufzubauen.",
      premium: "Ausgewählte hochwertige Immobilien in gefragten Lagen.",
      super_premium: "Exklusive Spitzenimmobilien für größere Investitionen.",
    },
  },
  fr: {
    kicker: "Niveaux d’investissement",
    title: "Trois niveaux d’investissement",
    intro: "Chaque bien Brickwise appartient à un niveau. Le niveau fixe l’investissement minimum, de l’entrée accessible aux biens premium exclusifs.",
    all: "Tous les niveaux",
    minimum: "Investissement minimum",
    view: "Voir les biens",
    empty: "Aucun bien n’est encore proposé dans ce niveau. Les nouveaux biens apparaîtront ici.",
    names: { standard: "Standard", premium: "Premium", super_premium: "Super Premium" },
    descriptions: {
      standard: "Des biens accessibles pour constituer un portefeuille pas à pas.",
      premium: "Des biens haut de gamme sélectionnés dans des emplacements recherchés.",
      super_premium: "Des biens d’exception pour des investissements plus importants.",
    },
  },
  es: {
    kicker: "Niveles de inversión",
    title: "Tres niveles de inversión",
    intro: "Cada inmueble de Brickwise pertenece a un nivel. El nivel fija la inversión mínima, desde una entrada accesible hasta inmuebles premium exclusivos.",
    all: "Todos los niveles",
    minimum: "Inversión mínima",
    view: "Ver inmuebles",
    empty: "Todavía no hay inmuebles en este nivel. Los nuevos inmuebles aparecerán aquí.",
    names: { standard: "Estándar", premium: "Premium", super_premium: "Super Premium" },
    descriptions: {
      standard: "Inmuebles accesibles para construir una cartera paso a paso.",
      premium: "Inmuebles de alto valor seleccionados en ubicaciones muy demandadas.",
      super_premium: "Inmuebles exclusivos de primer nivel para inversiones mayores.",
    },
  },
  it: {
    kicker: "Livelli di investimento",
    title: "Tre livelli di investimento",
    intro: "Ogni immobile Brickwise appartiene a un livello. Il livello stabilisce l’investimento minimo, dall’ingresso accessibile agli immobili premium esclusivi.",
    all: "Tutti i livelli",
    minimum: "Investimento minimo",
    view: "Vedi gli immobili",
    empty: "Non ci sono ancora immobili in questo livello. I nuovi immobili appariranno qui.",
    names: { standard: "Standard", premium: "Premium", super_premium: "Super Premium" },
    descriptions: {
      standard: "Immobili accessibili per costruire un portafoglio passo dopo passo.",
      premium: "Immobili di pregio selezionati in zone molto richieste.",
      super_premium: "Immobili esclusivi di fascia alta per investimenti più consistenti.",
    },
  },
};
