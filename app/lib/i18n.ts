export const defaultLocale = "en" as const;

export const supportedLocales = [
  "en",
  "de",
  "fr",
  "es",
  "it",
] as const;

export type Locale = (typeof supportedLocales)[number];

export const localeCookieName = "brickwise-locale";
export const localePreferenceCookieName = "brickwise-locale-manual";

export const localeLabels: Record<Locale, string> = {
  en: "English",
  de: "Deutsch",
  fr: "Français",
  es: "Español",
  it: "Italiano",
};

export const localeHtmlLang: Record<Locale, string> = {
  en: "en-CA",
  de: "de-DE",
  fr: "fr-FR",
  es: "es-ES",
  it: "it-IT",
};

const countryLocaleMap: Record<string, Locale> = {
  DE: "de",
  AT: "de",
  CH: "de",
  FR: "fr",
  BE: "fr",
  LU: "fr",
  CA: "en",
  US: "en",
  GB: "en",
  IE: "en",
  AU: "en",
  NZ: "en",
  ES: "es",
  MX: "es",
  AR: "es",
  CO: "es",
  CL: "es",
  PE: "es",
  IT: "it",
  SM: "it",
  VA: "it",
  AD: "es", BO: "es", CR: "es", CU: "es", DO: "es", EC: "es", GQ: "es", GT: "es", HN: "es", NI: "es", PA: "es", PR: "es", PY: "es", SV: "es", UY: "es", VE: "es",
  BF: "fr", BI: "fr", BJ: "fr", CD: "fr", CF: "fr", CG: "fr", CI: "fr", CM: "fr", DJ: "fr", GA: "fr", GF: "fr", GN: "fr", GP: "fr", HT: "fr", MC: "fr", MF: "fr", ML: "fr", MQ: "fr", NC: "fr", NE: "fr", PF: "fr", RE: "fr", RW: "fr", SC: "fr", SN: "fr", TD: "fr", TG: "fr", VU: "fr", WF: "fr", YT: "fr",
  LI: "de",
};

export function normalizeLocale(value?: string | null): Locale | null {
  if (!value) return null;

  const language = value.toLowerCase().split(/[-_,;]/)[0];
  return supportedLocales.includes(language as Locale)
    ? (language as Locale)
    : null;
}

export function getLocaleFromCountry(country?: string | null): Locale | null {
  if (!country) return null;
  return countryLocaleMap[country.toUpperCase()] || null;
}

export function getLocaleFromAcceptLanguage(header?: string | null): Locale | null {
  if (!header) return null;

  const languages = header
    .split(",")
    .map((part) => {
      const [language, qualityValue] = part.trim().split(";q=");
      return {
        locale: normalizeLocale(language),
        quality: qualityValue ? Number(qualityValue) : 1,
      };
    })
    .filter((entry): entry is { locale: Locale; quality: number } => Boolean(entry.locale) && Number.isFinite(entry.quality) && entry.quality > 0 && entry.quality <= 1)
    .sort((a, b) => b.quality - a.quality);

  return languages[0]?.locale || null;
}

export function resolveLocale(options: {
  cookie?: string | null;
  manualPreference?: boolean;
  query?: string | null;
  country?: string | null;
  acceptLanguage?: string | null;
}): Locale {
  return (
    normalizeLocale(options.query) ||
    (options.manualPreference ? normalizeLocale(options.cookie) : null) ||
    getLocaleFromCountry(options.country) ||
    getLocaleFromAcceptLanguage(options.acceptLanguage) ||
    normalizeLocale(options.cookie) ||
    defaultLocale
  );
}

export function getRequestLocale(request: Request): Locale {
  const cookieParts = request.headers.get("cookie")?.split(";").map((part) => part.trim()) || [];
  const cookie = cookieParts.find((part) => part.startsWith(`${localeCookieName}=`))?.slice(localeCookieName.length + 1);
  const manualPreference = cookieParts.some((part) => part === `${localePreferenceCookieName}=1`);
  return resolveLocale({
    query: new URL(request.url).searchParams.get("lang"),
    cookie,
    manualPreference,
    country: request.headers.get("x-vercel-ip-country") || request.headers.get("cf-ipcountry"),
    acceptLanguage: request.headers.get("accept-language"),
  });
}

export const i18nText: Record<
  string,
  {
    metadata: {
      title: string;
      description: string;
      ogLocale: string;
    };
    nav: {
      home: string;
      about: string;
      properties: string;
      mortgage: string;
      howItWorks: string;
      insights: string;
      contact: string;
      funding: string;
      signIn: string;
      join: string;
      menu: string;
      language: string;
    };
    footer: {
      legal: string[];
      companyTitle: string;
      company: string[];
      contactTitle: string;
      support: string;
      info: string;
      phone: string;
      whatsapp: string;
      companyAddress: string;
      investorTitle: string;
      investor: string[];
      disclaimer: string;
    };
  }
> = {
  en: {
    metadata: {
      title: "Global Fractional Real Estate Investing",
      description:
        "Digital access to cross-border real estate opportunities across the USA, Canada, Germany, Austria, and Switzerland with transparent project information.",
      ogLocale: "en_CA",
    },
    nav: {
      home: "Home",
      about: "About us",
      properties: "Properties",
      mortgage: "Mortgage",
      howItWorks: "How it works",
      insights: "Insights",
      contact: "Contact",
      funding: "Funding",
      signIn: "Sign in",
      join: "Join",
      menu: "Menu",
      language: "Language",
    },
    footer: {
      legal: [
        "Terms of Use",
        "Privacy and Cookie Policy",
        "Risk Notes",
        "Investor Policy",
        "Real Estate Investing",
      ],
      companyTitle: "Company",
      company: ["Home", "About", "Properties", "How it works", "Statistics", "Contact"],
      contactTitle: "Contact",
      support: "Support",
      info: "Info",
      phone: "Phone",
      whatsapp: "Message on WhatsApp",
      companyAddress: "Company",
      investorTitle: "Investor Area",
      investor: ["Create account", "Sign in", "Prepare funding", "Dashboard"],
      disclaimer:
        "This website does not provide investment, legal, tax, or mortgage advice. Real estate investments involve risk and may result in partial or total loss of capital.",
    },
  },
  de: {
    metadata: {
      title: "Global anteilig in Immobilien investieren",
      description:
        "Digitaler Zugang zu Immobilienchancen in den USA, Kanada, Deutschland, Österreich und der Schweiz mit transparenten Projektdaten.",
      ogLocale: "de_DE",
    },
    nav: {
      home: "Startseite",
      about: "Über uns",
      properties: "Immobilien",
      mortgage: "Finanzierung",
      howItWorks: "So funktioniert es",
      insights: "Einblicke",
      contact: "Kontakt",
      funding: "Kapital",
      signIn: "Anmelden",
      join: "Konto eröffnen",
      menu: "Menü",
      language: "Sprache",
    },
    footer: {
      legal: [
        "Nutzungsbedingungen",
        "Datenschutz und Cookies",
        "Risikohinweise",
        "Anlegerrichtlinie",
        "Immobilieninvestitionen",
      ],
      companyTitle: "Unternehmen",
      company: ["Startseite", "Über uns", "Immobilien", "So funktioniert es", "Statistiken", "Kontakt"],
      contactTitle: "Kontakt",
      support: "Support",
      info: "Info",
      phone: "Telefon",
      whatsapp: "WhatsApp-Nachricht",
      companyAddress: "Unternehmen",
      investorTitle: "Investorenbereich",
      investor: ["Konto erstellen", "Anmelden", "Finanzierung vorbereiten", "Dashboard"],
      disclaimer:
        "Diese Website bietet keine Anlage-, Rechts-, Steuer- oder Hypothekenberatung. Immobilieninvestitionen sind mit Risiken verbunden und können zu teilweisem oder vollständigem Kapitalverlust führen.",
    },
  },
  fr: {
    metadata: {
      title: "Investissement immobilier fractionné",
      description:
        "Accès numérique à des opportunités immobilières aux États-Unis, au Canada, en Allemagne, en Autriche et en Suisse.",
      ogLocale: "fr_FR",
    },
    nav: {
      home: "Accueil",
      about: "A propos",
      properties: "Biens",
      mortgage: "Hypothèque",
      howItWorks: "Fonctionnement",
      insights: "Analyses",
      contact: "Contact",
      funding: "Financement",
      signIn: "Connexion",
      join: "Rejoindre",
      menu: "Menu",
      language: "Langue",
    },
    footer: {
      legal: [
        "Conditions d'utilisation",
        "Confidentialité et cookies",
        "Notes de risque",
        "Politique investisseur",
        "Investissement immobilier",
      ],
      companyTitle: "Entreprise",
      company: ["Accueil", "À propos", "Biens", "Fonctionnement", "Statistiques", "Contact"],
      contactTitle: "Contact",
      support: "Support",
      info: "Info",
      phone: "Téléphone",
      whatsapp: "Message WhatsApp",
      companyAddress: "Entreprise",
      investorTitle: "Espace investisseur",
      investor: ["Créer un compte", "Connexion", "Préparer le financement", "Tableau de bord"],
      disclaimer:
        "Ce site ne fournit pas de conseils en investissement, juridiques, fiscaux ou hypothécaires. Les investissements immobiliers comportent des risques et peuvent entraîner une perte partielle ou totale du capital.",
    },
  },
  es: {
    metadata: {
      title: "Inversión inmobiliaria fraccionada",
      description:
        "Acceso digital a oportunidades inmobiliarias en Estados Unidos, Canadá, Alemania, Austria y Suiza.",
      ogLocale: "es_ES",
    },
    nav: {
      home: "Inicio",
      about: "Acerca de",
      properties: "Propiedades",
      mortgage: "Hipoteca",
      howItWorks: "Cómo funciona",
      insights: "Ideas",
      contact: "Contacto",
      funding: "Financiación",
      signIn: "Entrar",
      join: "Unirse",
      menu: "Menú",
      language: "Idioma",
    },
    footer: {
      legal: [
        "Términos de uso",
        "Privacidad y cookies",
        "Notas de riesgo",
        "Política del inversor",
        "Inversión inmobiliaria",
      ],
      companyTitle: "Empresa",
      company: ["Inicio", "Acerca de", "Propiedades", "Cómo funciona", "Estadísticas", "Contacto"],
      contactTitle: "Contacto",
      support: "Soporte",
      info: "Info",
      phone: "Teléfono",
      whatsapp: "Mensaje por WhatsApp",
      companyAddress: "Empresa",
      investorTitle: "Área de inversores",
      investor: ["Crear cuenta", "Entrar", "Preparar financiación", "Panel"],
      disclaimer:
        "Este sitio web no ofrece asesoramiento de inversión, legal, fiscal ni hipotecario. Las inversiones inmobiliarias implican riesgos y pueden provocar la pérdida parcial o total del capital.",
    },
  },
  it: {
    metadata: {
      title: "Investimento immobiliare frazionato",
      description:
        "Accesso digitale a opportunità immobiliari negli Stati Uniti, in Canada, Germania, Austria e Svizzera.",
      ogLocale: "it_IT",
    },
    nav: {
      home: "Home",
      about: "Chi siamo",
      properties: "Immobili",
      mortgage: "Mutuo",
      howItWorks: "Come funziona",
      insights: "Approfondimenti",
      contact: "Contatto",
      funding: "Finanziamento",
      signIn: "Accedi",
      join: "Unisciti",
      menu: "Menu",
      language: "Lingua",
    },
    footer: {
      legal: [
        "Termini d'uso",
        "Privacy e cookie",
        "Note sui rischi",
        "Politica investitori",
        "Investimenti immobiliari",
      ],
      companyTitle: "Società",
      company: ["Home", "Chi siamo", "Immobili", "Come funziona", "Statistiche", "Contatto"],
      contactTitle: "Contatto",
      support: "Supporto",
      info: "Info",
      phone: "Telefono",
      whatsapp: "Messaggio WhatsApp",
      companyAddress: "Società",
      investorTitle: "Area investitori",
      investor: ["Crea account", "Accedi", "Prepara fondi", "Dashboard"],
      disclaimer:
        "Questo sito non fornisce consulenza in materia di investimenti, legale, fiscale o di mutui. Gli investimenti immobiliari comportano rischi e possono causare la perdita parziale o totale del capitale.",
    },
  },
  sq: {
    metadata: {
      title: "Investim i pjesshëm në pasuri të paluajtshme",
      description:
        "Akses digjital në mundësi pronash në SHBA, Kanada, Gjermani, Austri dhe Zvicër.",
      ogLocale: "sq_AL",
    },
    nav: {
      home: "Kreu",
      about: "Rreth nesh",
      properties: "Prona",
      mortgage: "Kredi banese",
      howItWorks: "Si funksionon",
      insights: "Analiza",
      contact: "Kontakt",
      funding: "Financim",
      signIn: "Hyr",
      join: "Bashkohu",
      menu: "Menu",
      language: "Gjuha",
    },
    footer: {
      legal: [
        "Kushtet e përdorimit",
        "Privatësia dhe cookies",
        "Shënime rreziku",
        "Politika e investitorit",
        "Investim në prona",
      ],
      companyTitle: "Kompania",
      company: ["Kreu", "Rreth nesh", "Prona", "Si funksionon", "Statistika", "Kontakt"],
      contactTitle: "Kontakt",
      support: "Mbështetje",
      info: "Info",
      phone: "Telefon",
      whatsapp: "Mesazh në WhatsApp",
      companyAddress: "Kompania",
      investorTitle: "Zona e investitorit",
      investor: ["Krijo llogari", "Hyr", "Përgatit financimin", "Paneli"],
      disclaimer:
        "Kjo faqe nuk ofron këshilla investimi, ligjore, tatimore ose për kredi banese. Investimet në pasuri të paluajtshme kanë rrezik dhe mund të sjellin humbje të pjesshme ose të plotë të kapitalit.",
    },
  },
};
