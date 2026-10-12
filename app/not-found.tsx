import Link from "next/link";
import { getCurrentLocale } from "./lib/server-locale";
import type { Locale } from "./lib/i18n";

const copy: Record<Locale, { title: string; text: string; home: string; properties: string }> = {
  en: { title: "Page not found", text: "This page is unavailable. You can return home or browse the properties.", home: "Back to home", properties: "View properties" },
  de: { title: "Seite nicht gefunden", text: "Diese Seite ist nicht verfügbar. Sie können zur Startseite zurückkehren oder die Immobilien ansehen.", home: "Zur Startseite", properties: "Immobilien ansehen" },
  fr: { title: "Page introuvable", text: "Cette page est indisponible. Vous pouvez retourner à l’accueil ou consulter les biens.", home: "Retour à l’accueil", properties: "Voir les biens" },
  es: { title: "Página no encontrada", text: "Esta página no está disponible. Puedes volver al inicio o consultar las propiedades.", home: "Volver al inicio", properties: "Ver propiedades" },
  it: { title: "Pagina non trovata", text: "Questa pagina non è disponibile. Puoi tornare alla pagina iniziale o consultare gli immobili.", home: "Torna alla pagina iniziale", properties: "Vedi gli immobili" },
};

export default async function NotFound() {
  const text = copy[await getCurrentLocale()];
  return (
    <main className="mx-auto min-h-[60vh] max-w-3xl px-6 pb-20 pt-36 text-center text-[#17233f]">
      <p className="text-lg font-bold text-[#168bd3]">404</p>
      <h1 className="mt-3 text-4xl font-bold">{text.title}</h1>
      <p className="mt-5 text-lg leading-8 text-[#687486]">{text.text}</p>
      <div className="mt-8 flex flex-wrap justify-center gap-4">
        <Link href="/" className="rounded-lg bg-[#17233f] px-6 py-3 font-bold text-white">{text.home}</Link>
        <Link href="/properties" className="rounded-lg border border-[#dfe5eb] px-6 py-3 font-bold">{text.properties}</Link>
      </div>
    </main>
  );
}
