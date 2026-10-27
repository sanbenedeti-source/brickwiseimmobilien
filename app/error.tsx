"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useLocale } from "./components/LocaleProvider";
import type { Locale } from "./lib/i18n";

const copy: Record<Locale, { title: string; text: string; retry: string; home: string }> = {
  en: { title: "Something went wrong", text: "This page could not be loaded. Please try again in a moment.", retry: "Try again", home: "Back to home" },
  de: { title: "Etwas ist schiefgelaufen", text: "Diese Seite konnte nicht geladen werden. Bitte versuchen Sie es gleich noch einmal.", retry: "Erneut versuchen", home: "Zur Startseite" },
  fr: { title: "Une erreur s’est produite", text: "Cette page n’a pas pu être chargée. Veuillez réessayer dans un instant.", retry: "Réessayer", home: "Retour à l’accueil" },
  es: { title: "Algo ha salido mal", text: "No se ha podido cargar esta página. Inténtalo de nuevo en unos momentos.", retry: "Reintentar", home: "Volver al inicio" },
  it: { title: "Si è verificato un errore", text: "Non è stato possibile caricare questa pagina. Riprova tra qualche istante.", retry: "Riprova", home: "Torna alla pagina iniziale" },
};

/** Localized fallback for errors below the root layout (Next shows an English screen otherwise). */
export default function Error({ error, retry }: { error: unknown; retry: () => void }) {
  const text = copy[useLocale()];
  useEffect(() => { console.error(error); }, [error]);
  return (
    <main className="mx-auto min-h-[60vh] max-w-3xl px-6 pb-20 pt-36 text-center text-ink">
      <h1 className="text-4xl font-bold">{text.title}</h1>
      <p className="mt-5 text-lg leading-8 text-muted">{text.text}</p>
      <div className="mt-8 flex flex-wrap justify-center gap-4">
        <button type="button" onClick={() => retry()} className="min-h-12 rounded-lg bg-brand px-6 font-bold text-white hover:bg-brand-strong">{text.retry}</button>
        <Link href="/" className="inline-flex min-h-12 items-center rounded-lg border border-line px-6 font-bold">{text.home}</Link>
      </div>
    </main>
  );
}
