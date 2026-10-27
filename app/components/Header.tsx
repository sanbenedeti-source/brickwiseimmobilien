import Link from "next/link";
import BrandLogo from "./BrandLogo";
import LanguageSwitcher from "./LanguageSwitcher";
import MobileMenu from "./MobileMenu";
import { i18nText, Locale } from "../lib/i18n";

const authenticatedCopy: Record<Locale, { dashboard: string; admin: string; signOut: string }> = {
  en: { dashboard: "Dashboard", admin: "Admin panel", signOut: "Sign out" },
  de: { dashboard: "Dashboard", admin: "Adminbereich", signOut: "Abmelden" },
  fr: { dashboard: "Tableau de bord", admin: "Espace admin", signOut: "Déconnexion" },
  es: { dashboard: "Panel", admin: "Panel de administración", signOut: "Cerrar sesión" },
  it: { dashboard: "Dashboard", admin: "Area amministratore", signOut: "Esci" },
};

const skipCopy: Record<Locale, string> = {
  en: "Skip to main content",
  de: "Zum Inhalt springen",
  fr: "Aller au contenu principal",
  es: "Saltar al contenido principal",
  it: "Vai al contenuto principale",
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
  isAdmin = false,
}: {
  locale: Locale;
  isAuthenticated: boolean;
  isAdmin?: boolean;
}) {
  const text = i18nText[locale].nav;
  const authText = authenticatedCopy[locale];
  // Administrators go back to the admin panel, never to the client dashboard.
  const accountLink = isAdmin ? { href: "/admin", label: authText.admin } : { href: "/dashboard", label: authText.dashboard };
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
      className="fixed inset-x-0 top-0 z-50 border-b border-ink/10 bg-white/95 px-5 py-3 text-ink backdrop-blur sm:px-8 lg:px-12"
    >
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-[60] focus:inline-flex focus:min-h-11 focus:items-center focus:bg-ink focus:px-4 focus:font-semibold focus:text-white">{skipCopy[locale]}</a>
      <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-3">
        <BrandLogo />

        <nav className="hidden items-center gap-4 text-sm font-semibold text-ink xl:flex">
          {navLinks.map((link) => (
            <Link key={link.href} href={link.href} className="transition hover:text-brand">
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-5 text-sm text-ink sm:flex">
          <LanguageSwitcher currentLocale={locale} label={text.language} />

          {isAuthenticated ? (
            <>
              <a href="/logout" className="hidden font-semibold hover:text-brand md:block">
                {authText.signOut}
              </a>
              <Link href={accountLink.href} className="rounded-lg bg-brand px-5 py-3 font-semibold text-white transition hover:bg-brand-strong md:px-6">
                {accountLink.label}
              </Link>
            </>
          ) : (
            <>
              <Link href="/sign-in" className="hidden font-semibold hover:text-brand md:block">
                {text.signIn}
              </Link>
              <Link href="/join" className="rounded-lg bg-brand px-5 py-3 font-semibold text-white transition hover:bg-brand-strong md:px-6">
                {text.join}
              </Link>
            </>
          )}
        </div>

        <MobileMenu className="group relative xl:hidden">
          <summary className="flex h-11 w-11 cursor-pointer list-none items-center justify-center bg-ink text-white marker:hidden [&::-webkit-details-marker]:hidden">
            <span className="sr-only">{text.menu}</span>
            <span className="flex flex-col gap-1.5">
              <span className="block h-0.5 w-5 bg-white transition group-open:translate-y-2 group-open:rotate-45" />
              <span className="block h-0.5 w-5 bg-white transition group-open:opacity-0" />
              <span className="block h-0.5 w-5 bg-white transition group-open:-translate-y-2 group-open:-rotate-45" />
            </span>
          </summary>

          <div className="absolute right-0 top-14 max-h-[calc(100dvh-5rem)] w-[calc(100vw-2.5rem)] max-w-sm overflow-y-auto border border-ink/10 bg-white p-3 shadow-xl sm:w-96 sm:p-4">
            <nav className="grid gap-1 text-sm font-semibold sm:text-base">
              <div className="px-4 py-2">
                <LanguageSwitcher currentLocale={locale} label={text.language} />
              </div>
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="px-4 py-3 hover:bg-canvas"
                >
                  {link.label}
                </Link>
              ))}
              {isAuthenticated ? (
                <>
                  <Link href={accountLink.href} className="px-4 py-3 hover:bg-canvas">
                    {accountLink.label}
                  </Link>
                  <a href="/logout" className="mt-2 bg-white px-4 py-3 text-center text-ink border border-line-strong rounded-lg">
                    {authText.signOut}
                  </a>
                </>
              ) : (
                <>
                  <Link href="/sign-in" className="px-4 py-3 hover:bg-canvas">
                    {text.signIn}
                  </Link>
                  <Link href="/join" className="mt-2 rounded-lg bg-brand px-4 py-3 text-center text-white">
                    {text.join}
                  </Link>
                </>
              )}
            </nav>
          </div>
        </MobileMenu>
      </div>
    </header>
  );
}
