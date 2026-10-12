import LocaleProvider from "./components/LocaleProvider";
import { company } from "./lib/company";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Suspense } from "react";
import { cookies } from "next/headers";
import Footer from "./components/Footer";
import Header from "./components/Header";
import MetaPixelConsent from "./components/MetaPixelConsent";
import ClientPortalSidebar from "./components/ClientPortalSidebar";
import RouteShell from "./components/RouteShell";
import FloatingLeadForm from "./components/FloatingLeadForm";
import { getCurrentUser } from "@/lib/supabase/auth";
import {
  defaultLocale,
  i18nText,
  Locale,
  localeCookieName,
  localeHtmlLang,
  normalizeLocale,
} from "./lib/i18n";
import "./globals.css";

const inter = Inter({
  subsets: ["latin", "latin-ext"],
  style: ["normal", "italic"],
  variable: "--font-inter",
  display: "swap",
});

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL || "https://www.brickwise-immo.de";

async function getCurrentLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  return normalizeLocale(cookieStore.get(localeCookieName)?.value) || defaultLocale;
}

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getCurrentLocale();
  const text = i18nText[locale].metadata;

  return {
    metadataBase: new URL(siteUrl),
    title: company.searchTitle,
    description: text.description,
    robots: { index: false, follow: false },
    openGraph: {
      title: company.searchTitle,
      description: text.description,
      url: siteUrl,
      siteName: company.name,
      locale: text.ogLocale,
      type: "website",
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getCurrentLocale();
  const user = await getCurrentUser();
  const isAuthenticated = Boolean(user);
  const claimEmail = user?.email || "Client";
  const metadata = user?.user_metadata && typeof user.user_metadata === "object"
    ? user.user_metadata as Record<string, unknown>
    : {};
  const fullName = typeof metadata.full_name === "string" && metadata.full_name.trim()
    ? metadata.full_name
    : claimEmail.split("@")[0];

  return (
    <html lang={localeHtmlLang[locale]} className={inter.variable}>
      <body>
        <LocaleProvider locale={locale}>
        <RouteShell
          isAuthenticated={isAuthenticated}
          header={<Header locale={locale} isAuthenticated={isAuthenticated} />}
          footer={<Footer locale={locale} />}
          sidebar={<ClientPortalSidebar active="none" email={claimEmail} fullName={fullName} locale={locale} />}
        >
          {children}
        </RouteShell>
        <FloatingLeadForm locale={locale} />
        <Suspense fallback={null}><MetaPixelConsent locale={locale} /></Suspense>
              </LocaleProvider>
      </body>
    </html>
  );
}
