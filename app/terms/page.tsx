import { cookies } from "next/headers";
import { localeCookieName, normalizeLocale } from "../lib/i18n";
import { termsTranslations } from "./translations";
import { company } from "../lib/company";

const sections = [
  {
    title: "1. Scope",
    text: `These terms apply to the use of the BRICKWISE website, investor areas, contact forms, and project information pages. The website operator is ${company.legalName}, a ${company.legalForm} in ${company.registrationState}, represented by its Manager, ${company.manager}. Registered office: ${company.street}, ${company.locality}. European contact office: ${company.europeanStreet}, ${company.europeanLocality}.`,
  },
  {
    title: "2. Platform information",
    text: "BRICKWISE provides digital information about international real estate projects, rental participation models, and investor workflows. The platform does not provide investment, legal, tax, or mortgage advice.",
  },
  {
    title: "3. Account registration",
    text: "Some features require an account. Users must provide accurate information and keep account credentials confidential.",
  },
  {
    title: "4. Project information",
    text: "Property values, rents, yields, and payouts are model calculations based on available assumptions. They are not guarantees of future performance.",
  },
  {
    title: "5. Access requests",
    text: "A request submitted through the website is non-binding. Any agreement is only created after review, documentation, and separate confirmation.",
  },
  {
    title: "6. Availability",
    text: "BRICKWISE aims to keep the platform available, but uninterrupted access cannot be guaranteed.",
  },
  {
    title: "7. Liability",
    text: "Users remain responsible for their own decisions. BRICKWISE is not responsible for decisions made solely from model calculations or general website information.",
  },
  {
    title: "8. Eligibility and verification",
    text: "Access may depend on age, residence, identity, sanctions, source-of-funds, and other legal or project-specific checks. Creating an account does not guarantee eligibility for any opportunity.",
  },
  {
    title: "9. Funding and payment safety",
    text: "Never send funds until verified instructions have been issued through the official workflow and independently confirmed. Website calculations and requests do not themselves create a payment obligation.",
  },
  {
    title: "10. Fractional interests and liquidity",
    text: "Any participation structure, ownership rights, distributions, transfer restrictions, fees, and exit process are governed only by the final project documents. Interests may be illiquid and may not be redeemable on demand.",
  },
  {
    title: "11. Intellectual property",
    text: "The Brickwise name, platform design, original content, software, and brand assets may not be copied, republished, reverse engineered, or commercially reused without written permission, except where law permits.",
  },
  {
    title: "12. Acceptable use",
    text: "Users must not misuse the platform, impersonate another person, submit false information, attempt unauthorized access, interfere with security, scrape protected content, or use the service for unlawful activity.",
  },
  {
    title: "13. Third-party services",
    text: "External providers such as payment, banking, wallet, messaging, hosting, authentication, or analytics services operate under their own terms. Brickwise does not control their availability or independent processing.",
  },
  {
    title: "14. Suspension and termination",
    text: "Access may be restricted or terminated where necessary for security, legal compliance, suspected misuse, inaccurate information, or material breach of these terms. Users may request account closure subject to retention obligations.",
  },
  {
    title: "15. Changes and contact",
    text: "These terms may be updated as the platform, operating entity, services, or legal requirements evolve. Questions may be sent to info@brickwise-immo.de. Material contractual rights arise only from separately accepted final documents.",
  },
];

export default async function Terms() {
  const locale = normalizeLocale((await cookies()).get(localeCookieName)?.value) || "en";
  const translated = locale === "en" ? null : termsTranslations[locale];
  const visibleSections = translated ? translated.sections.map(([title, text]) => ({ title, text })) : sections;
  return (
    <main className="bg-canvas text-ink">
      <section className="mx-auto max-w-5xl px-6 pb-24 pt-36">
        <p className="text-lg font-bold text-emerald-700">BRICKWISE</p>
        <h1 className="font-display mt-4 text-4xl font-bold leading-tight sm:text-5xl md:text-6xl">
          {translated?.title || "Terms of Use"}
        </h1>
        <p className="mt-6 max-w-3xl text-xl leading-relaxed text-slate-600">
          {translated?.intro || "Framework terms for using the BRICKWISE platform and project information pages."}</p>

        <div className="mt-14 space-y-8 text-lg leading-relaxed text-slate-700">
          {visibleSections.map((section) => (
            <section key={section.title} className="border-t border-slate-300 pt-8">
              <h2 className="text-2xl font-bold text-ink">{section.title}</h2>
              <p className="mt-3">{section.text}</p>
            </section>
          ))}
        </div>

        <p className="mt-14 border-t border-slate-300 pt-6 text-sm text-slate-500">{translated?.note || "Effective date: 23 October 2026. These terms provide the website framework and do not replace project-specific agreements or professional legal review."}</p>
      </section>
    </main>
  );
}
