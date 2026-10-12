import { sharedCopy } from "../lib/shared-copy";
import { company } from "@/app/lib/company";
import Link from "next/link";
import { ArrowRight, ArrowUp, Info, Mail, MapPin, Phone } from "lucide-react";
import BrandLogo from "./BrandLogo";
import { i18nText, Locale } from "../lib/i18n";
import { createTranslator } from "../lib/translate";

const legalLinkHrefs = [
  "/terms",
  "/privacy",
  "/risk",
  "/investor-policy",
  "/real-estate-investing",
];

const companyLinkHrefs = [
  "/",
  "/about",
  "/properties",
  "/#how-it-works",
  "/#numbers",
  "/contact",
];

const footerCopy: Record<Locale, { explore: string; legal: string; contact: string; question: string; button: string; registration: string; important: string }> = {
  en: { explore: "Explore Brickwise", legal: "Legal & transparency", contact: "Get in touch", question: "Questions about a property?", button: "Contact our team", registration: "Company registration", important: "Important information" },
  de: { explore: "Brickwise entdecken", legal: "Rechtliches & Transparenz", contact: "Kontakt", question: "Fragen zu einer Immobilie?", button: "Unser Team kontaktieren", registration: "Registrierungsnummer", important: "Wichtige Informationen" },
  fr: { explore: "Découvrir Brickwise", legal: "Informations légales", contact: "Nous contacter", question: "Une question sur un bien ?", button: "Contacter notre équipe", registration: "Immatriculation", important: "Informations importantes" },
  es: { explore: "Descubre Brickwise", legal: "Legal y transparencia", contact: "Contacto", question: "¿Preguntas sobre una propiedad?", button: "Contacta con nuestro equipo", registration: "Registro de la empresa", important: "Información importante" },
  it: { explore: "Scopri Brickwise", legal: "Informazioni legali", contact: "Contatti", question: "Domande su un immobile?", button: "Contatta il nostro team", registration: "Numero di registrazione", important: "Informazioni importanti" },
};

export default function Footer({ locale }: { locale: Locale }) {
  const t = createTranslator(locale);
  const common = sharedCopy[locale];
  const text = i18nText[locale].footer;
  const copy = footerCopy[locale];
  const legalLinks = legalLinkHrefs.map((href, index) => ({ href, label: text.legal[index] }));
  const companyLinks = companyLinkHrefs.map((href, index) => ({ href, label: text.company[index] }));

  return (
    <footer id="contact" className="site-footer bg-white px-4 py-6 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-[1380px] overflow-hidden rounded-3xl bg-[#101e32] text-slate-100">
        <div className="flex flex-col gap-5 border-b border-white/10 bg-[#172b43] px-6 py-7 sm:flex-row sm:items-center sm:justify-between sm:px-10">
          <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">{copy.question}</h2>
          <Link href="/contact" className="inline-flex min-h-12 items-center justify-center gap-3 self-start rounded-xl bg-[#b8eddf] px-5 py-3 text-sm font-semibold text-[#102b2d] transition-colors hover:bg-white sm:shrink-0">
            {copy.button}<ArrowRight size={18} aria-hidden="true" />
          </Link>
        </div>

        <div className="grid gap-10 px-6 py-10 sm:grid-cols-2 sm:px-10 lg:grid-cols-[1.1fr_0.8fr_1fr_1.2fr] lg:gap-8 lg:py-12">
          <div>
            <BrandLogo inverted />
            <p className="mt-6 max-w-xs text-base font-semibold leading-6">{common.tagline}</p>
            <p className="mt-3 max-w-xs text-sm leading-6 text-slate-300">{common.description}</p>
            <div className="mt-6 rounded-xl border border-white/15 bg-white/5 p-4 text-sm">
              <p className="font-semibold text-white">{company.legalName}</p>
              <p className="mt-2 text-xs leading-5 text-slate-300">{copy.registration}</p>
              <p className="mt-1 tracking-wide text-slate-100">{company.registrationNumber}</p>
              <Link href="/legal-notice" className="mt-3 inline-flex items-center gap-2 text-[#b8eddf] underline-offset-4 hover:underline">{common.legal}<ArrowRight size={14} aria-hidden="true" /></Link>
            </div>
          </div>

          <nav aria-label={copy.explore}>
            <h2 className="mb-4 text-sm font-semibold text-white">{copy.explore}</h2>
            <ul className="space-y-1 text-sm text-slate-300">
              {companyLinks.map((link) => <li key={link.href}><Link href={link.href} className="inline-block py-2 transition-colors hover:text-[#b8eddf] hover:underline underline-offset-4">{link.label}</Link></li>)}
            </ul>
          </nav>

          <nav aria-label={copy.legal}>
            <h2 className="mb-4 text-sm font-semibold text-white">{copy.legal}</h2>
            <ul className="space-y-1 text-sm text-slate-300">
              <li><Link href="/legal-notice" className="inline-block py-2 hover:text-[#b8eddf] hover:underline underline-offset-4">{common.legal}</Link></li>
              {legalLinks.map((link) => <li key={link.href}><Link href={link.href} className="inline-block py-2 transition-colors hover:text-[#b8eddf] hover:underline underline-offset-4">{link.label}</Link></li>)}
            </ul>
          </nav>

          <div>
            <h2 className="mb-5 text-sm font-semibold text-white">{copy.contact}</h2>
            <address className="space-y-5 text-sm not-italic text-slate-300">
              <a href={`mailto:${company.email}`} className="flex items-start gap-3 break-all py-1 hover:text-[#b8eddf]"><Mail className="mt-0.5 shrink-0 text-[#b8eddf]" size={18} aria-hidden="true" />{company.email}</a>
              <a href={`tel:${company.phone}`} className="flex items-start gap-3 py-1 hover:text-[#b8eddf]"><Phone className="mt-0.5 shrink-0 text-[#b8eddf]" size={18} aria-hidden="true" />{company.phoneDisplay}</a>
              <a href={company.europeanMapUrl} target="_blank" rel="noreferrer" className="flex items-start gap-3 leading-6 hover:text-[#b8eddf]"><MapPin className="mt-1 shrink-0 text-[#b8eddf]" size={18} aria-hidden="true" /><span><span className="font-medium text-white">{common.office}</span><br />{company.europeanStreet}<br />{company.europeanLocality}</span></a>
            </address>
          </div>
        </div>

        <div className="mx-6 rounded-2xl border border-white/15 bg-[#192b40] p-5 sm:mx-10 sm:p-6">
          <h2 className="flex items-center gap-3 text-sm font-semibold text-white"><Info size={18} className="shrink-0 text-[#b8eddf]" aria-hidden="true" />{copy.important}</h2>
          <p className="mt-5 text-sm leading-6 text-slate-300">{text.disclaimer}</p>
          <p className="mt-3 text-sm leading-6 text-slate-300">{t("Property values, rental assumptions, projected yields, and participation models are provided for informational purposes only. Past performance and projections do not guarantee future results. Investors should review the project documents and obtain independent legal, tax, and financial advice before making a decision.")}</p>
          <p className="mt-3 text-sm leading-6 text-slate-300">{t("By using this website, you agree to the")} <Link href="/terms" className="text-white underline underline-offset-4 hover:text-[#b8eddf]">{text.legal[0]}</Link> {t("and the")} <Link href="/privacy" className="text-white underline underline-offset-4 hover:text-[#b8eddf]">{text.legal[1]}</Link>. {t("Real estate investments may be illiquid and may result in partial or total loss of capital.")}</p>
        </div>
        <div className="mx-6 mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-white/10 py-6 text-xs text-slate-300 sm:mx-10">
          <p>© {new Date().getFullYear()} {company.legalName}</p>
          <a href="#" className="inline-flex min-h-11 items-center gap-3 rounded-lg px-3 hover:bg-white/10 hover:text-white">{common.top}<ArrowUp size={16} aria-hidden="true" /></a>
        </div>
      </div>
    </footer>
  );
}
