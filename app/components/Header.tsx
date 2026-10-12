import Link from "next/link";
import BrandLogo from "./BrandLogo";
import LanguageSwitcher from "./LanguageSwitcher";
import { i18nText, Locale } from "../lib/i18n";

const authenticatedCopy: Record<Locale, { dashboard: string; signOut: string }> = {
  en: { dashboard: "Dashboard", signOut: "Sign out" },
  de: { dashboard: "Dashboard", signOut: "Abmelden" },
  fr: { dashboard: "Tableau de bord", signOut: "Déconnexion" },
  es: { dashboard: "Panel", signOut: "Cerrar sesión" },
  it: { dashboard: "Dashboard", signOut: "Esci" },
};

const riskCopy: Record<Locale, string> = {
  en: "Risk warnings",
  de: "Risikohinweise",
  fr: "Avertissements",
  es: "Advertencias",
  it: "Avvertenze sui rischi",
};

export default function Header({
  locale,
  isAuthenticated,
}: {
  locale: Locale;
  isAuthenticated: boolean;
}) {
  const text = i18nText[locale].nav;
  const authText = authenticatedCopy[locale];
  const navLinks = [
    { href: "/", label: text.home },
    { href: "/properties", label: text.properties },
    { href: "/about", label: text.about },
    { href: "/insights", label: text.insights },
    { href: "/risk", label: riskCopy[locale] },
    { href: "/contact", label: text.contact },
  ];

  return (
    <header
      className="fixed inset-x-0 top-0 z-50 border-b border-[#152238]/10 bg-white/95 px-5 py-3 text-[#152238] backdrop-blur sm:px-8 lg:px-12"
    >
      <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-3">
        <BrandLogo />

        <nav className="hidden items-center gap-7 text-sm font-semibold text-[#152238] lg:flex">
          {navLinks.map((link) => (
            <Link key={link.href} href={link.href} className="transition hover:text-[#275efe]">
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-5 text-sm text-[#152238] sm:flex">
          <LanguageSwitcher currentLocale={locale} label={text.language} />

          {isAuthenticated ? (
            <>
              <a href="/logout" className="hidden font-semibold hover:text-[#275efe] md:block">
                {authText.signOut}
              </a>
              <Link href="/dashboard" className="rounded-full bg-[#2f9bdb] px-5 py-3 font-semibold text-white transition hover:bg-[#17233f] md:px-6">
                {authText.dashboard}
              </Link>
            </>
          ) : (
            <>
              <Link href="/sign-in" className="hidden font-semibold hover:text-[#275efe] md:block">
                {text.signIn}
              </Link>
              <Link href="/join" className="rounded-full bg-[#ffb629] px-5 py-3 font-semibold text-[#152238] transition hover:bg-[#2f9bdb] hover:text-white md:px-6">
                {text.join}
              </Link>
            </>
          )}
        </div>

        <details className="group relative lg:hidden">
          <summary className="flex h-11 w-11 cursor-pointer list-none items-center justify-center bg-[#152238] text-white marker:hidden [&::-webkit-details-marker]:hidden">
            <span className="sr-only">{text.menu}</span>
            <span className="flex flex-col gap-1.5">
              <span className="block h-0.5 w-5 bg-white" />
              <span className="block h-0.5 w-5 bg-white" />
              <span className="block h-0.5 w-5 bg-white" />
            </span>
          </summary>

          <div className="absolute right-0 top-14 max-h-[calc(100vh-5rem)] w-[calc(100vw-2.5rem)] max-w-sm overflow-y-auto border border-[#152238]/10 bg-white p-3 shadow-xl sm:w-96 sm:p-4">
            <nav className="grid gap-1 text-sm font-semibold sm:text-base">
              <div className="px-4 py-2">
                <LanguageSwitcher currentLocale={locale} label={text.language} />
              </div>
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="px-4 py-3 hover:bg-[#f2f3ef]"
                >
                  {link.label}
                </Link>
              ))}
              {isAuthenticated ? (
                <>
                  <Link href="/dashboard" className="px-4 py-3 hover:bg-[#f2f3ef]">
                    {authText.dashboard}
                  </Link>
                  <a href="/logout" className="mt-2 bg-[#17233f] px-4 py-3 text-center text-white">
                    {authText.signOut}
                  </a>
                </>
              ) : (
                <>
                  <Link href="/sign-in" className="px-4 py-3 hover:bg-[#f2f3ef]">
                    {text.signIn}
                  </Link>
                  <Link href="/join" className="mt-2 rounded-full bg-[#ffb629] px-4 py-3 text-center text-[#152238]">
                    {text.join}
                  </Link>
                </>
              )}
            </nav>
          </div>
        </details>
      </div>
    </header>
  );
}
