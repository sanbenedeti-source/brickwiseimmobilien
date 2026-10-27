// Name and document number match the Sunbiz entity list. Address and manager
// are owner-supplied and have not been checked against the detailed filing.
import type { Locale } from "./i18n";

export const company = {
  name: "BRICKWISE",
  legalName: "BRICKWISE LLC",
  registrationNumber: "L26000105795",
  legalForm: "Limited Liability Company (LLC)",
  registrationState: "Florida, United States",
  manager: "Pascal Mile",
  registrationAuthority: "Florida Department of State, Division of Corporations",
  registryName: "Florida Division of Corporations (Sunbiz)",
  registryUrl: "https://search.sunbiz.org/Inquiry/CorporationSearch/ByName",
  searchTitle: "BRICKWISE | Global Fractional Real Estate Investing",
  email: "info@brickwise-immo.de",
  phone: "+4915212289889",
  phoneDisplay: "+49 1521 2289889",
  street: "370 NE 75th Street, Unit 126",
  locality: "Miami, Florida 33138, United States",
  mapUrl: "https://maps.google.com/?q=370+NE+75th+Street,+Unit+126,+Miami,+Florida,+United+States+33138",
  europeanStreet: "Bobinethöfe 38",
  europeanLocality: "54294 Trier, Germany",
  europeanMapUrl: "https://maps.google.com/?q=Bobineth%C3%B6fe+38,+54294+Trier,+Germany",
} as const;

const countryNames: Record<string, Record<Locale, string>> = {
  Germany: { en: "Germany", de: "Deutschland", fr: "Allemagne", es: "Alemania", it: "Germania" },
  "United States": { en: "United States", de: "Vereinigte Staaten", fr: "États-Unis", es: "Estados Unidos", it: "Stati Uniti" },
};

/** Address and registration strings are stored in English; show the country in the page language. */
export function localizeCountry(text: string, locale: Locale) {
  return text.replace(/Germany|United States/g, (name) => countryNames[name][locale]);
}
