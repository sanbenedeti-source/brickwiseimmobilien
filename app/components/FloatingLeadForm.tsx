"use client";
import { sharedCopy } from "../lib/shared-copy";

import Modal from "./Modal";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { createContactRequest } from "@/app/contact/actions";
import type { Locale } from "@/app/lib/i18n";

const copy = {
  en: { button: "Register your interest", title: "Register your interest", intro: "Leave your details and our team will contact you.", first: "First name", last: "Last name", phone: "Phone number", email: "Email address", comment: "Comment (optional)", commentPlaceholder: "Tell us what you are interested in...", submit: "Send request", privacy: "Your details are used only to respond to your request." },
  de: { button: "Interesse bekunden", title: "Interesse bekunden", intro: "Hinterlassen Sie Ihre Daten. Unser Team kontaktiert Sie.", first: "Vorname", last: "Nachname", phone: "Telefonnummer", email: "E-Mail-Adresse", comment: "Kommentar (optional)", commentPlaceholder: "Teilen Sie uns kurz mit, wofür Sie sich interessieren...", submit: "Anfrage senden", privacy: "Ihre Daten werden nur zur Bearbeitung Ihrer Anfrage verwendet." },
  it: { button: "Manifesta il tuo interesse", title: "Manifesta il tuo interesse", intro: "Lascia i tuoi dati e il nostro team ti contatterà.", first: "Nome", last: "Cognome", phone: "Numero di telefono", email: "Indirizzo e-mail", comment: "Commento (facoltativo)", commentPlaceholder: "Dicci a cosa sei interessato...", submit: "Invia richiesta", privacy: "I tuoi dati saranno utilizzati solo per rispondere alla richiesta." },
  fr: { button: "Manifester votre intérêt", title: "Manifester votre intérêt", intro: "Laissez vos coordonnées et notre équipe vous contactera.", first: "Prénom", last: "Nom", phone: "Téléphone", email: "Adresse e-mail", comment: "Commentaire (facultatif)", commentPlaceholder: "Indiquez-nous ce qui vous intéresse...", submit: "Envoyer", privacy: "Vos données servent uniquement à répondre à votre demande." },
  es: { button: "Solicitar información", title: "Solicitar información", intro: "Déjanos tus datos y nuestro equipo se pondrá en contacto.", first: "Nombre", last: "Apellidos", phone: "Teléfono", email: "Correo electrónico", comment: "Comentario (opcional)", commentPlaceholder: "Cuéntanos qué te interesa...", submit: "Enviar solicitud", privacy: "Tus datos se usarán únicamente para responder a tu solicitud." },
} satisfies Record<Locale, Record<string, string>>;

const hiddenPaths = ["/admin", "/dashboard", "/authentication", "/funding", "/settings"];

export default function FloatingLeadForm({ locale }: { locale: Locale }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const text = copy[locale] || copy.en;

  if (hiddenPaths.some((path) => pathname === path || pathname.startsWith(`${path}/`))) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed right-0 top-1/2 z-[70] hidden -translate-y-1/2 rounded-l-lg rounded-r-none bg-brand px-3 py-5 text-sm font-semibold text-white shadow-lg ring-1 ring-white/30 transition hover:bg-brand-strong xl:block"
        style={{ writingMode: "vertical-rl" }}
        aria-label={text.button}
      >
        {text.button}
      </button>

      {open && (
        <Modal labelledBy="lead-form-title" onClose={() => setOpen(false)}>
          <div className="relative max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl sm:p-8">
            <button type="button" onClick={() => setOpen(false)} className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100" aria-label={sharedCopy[locale].close}><X size={22} /></button>
            <p className="text-sm font-bold uppercase tracking-[0.16em] text-brand">Brickwise</p>
            <h2 id="lead-form-title" className="mt-2 pr-10 text-3xl font-bold text-ink">{text.title}</h2>
            <p className="mt-3 text-slate-600">{text.intro}</p>
            <form action={createContactRequest} className="mt-6 grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-bold text-ink-soft">{text.first}<input name="first_name" required autoComplete="given-name" className="mt-2 h-12 w-full rounded-lg border border-line-strong px-4 font-normal outline-none focus:border-brand focus:ring-2 focus:ring-brand/15" /></label>
              <label className="text-sm font-bold text-ink-soft">{text.last}<input name="last_name" required autoComplete="family-name" className="mt-2 h-12 w-full rounded-lg border border-line-strong px-4 font-normal outline-none focus:border-brand focus:ring-2 focus:ring-brand/15" /></label>
              <label className="text-sm font-bold text-ink-soft">{text.phone}<input name="phone" type="tel" required autoComplete="tel" className="mt-2 h-12 w-full rounded-lg border border-line-strong px-4 font-normal outline-none focus:border-brand focus:ring-2 focus:ring-brand/15" /></label>
              <label className="text-sm font-bold text-ink-soft">{text.email}<input name="email" type="email" required autoComplete="email" className="mt-2 h-12 w-full rounded-lg border border-line-strong px-4 font-normal outline-none focus:border-brand focus:ring-2 focus:ring-brand/15" /></label>
              <label className="text-sm font-bold text-ink-soft sm:col-span-2">{text.comment}<textarea name="message" rows={3} maxLength={2000} placeholder={text.commentPlaceholder} className="mt-2 w-full resize-y rounded-lg border border-line-strong px-4 py-3 font-normal outline-none focus:border-brand focus:ring-2 focus:ring-brand/15" /></label>
              <input type="hidden" name="topic" value="Floating website registration form" />
              <input type="text" name="company" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
              <button type="submit" className="mt-1 min-h-12 rounded-lg bg-brand px-6 font-bold text-white transition hover:bg-ink sm:col-span-2">{text.submit}</button>
              <p className="text-xs leading-5 text-slate-500 sm:col-span-2">{text.privacy}</p>
            </form>
          </div>
        </Modal>
      )}
    </>
  );
}
