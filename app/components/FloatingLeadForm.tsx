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
  de: { button: "Interesse anmelden", title: "Interesse anmelden", intro: "Hinterlassen Sie Ihre Daten. Unser Team kontaktiert Sie.", first: "Vorname", last: "Nachname", phone: "Telefonnummer", email: "E-Mail-Adresse", comment: "Kommentar (optional)", commentPlaceholder: "Teilen Sie uns kurz mit, wofür Sie sich interessieren...", submit: "Anfrage senden", privacy: "Ihre Daten werden nur zur Bearbeitung Ihrer Anfrage verwendet." },
  it: { button: "Registra il tuo interesse", title: "Registra il tuo interesse", intro: "Lascia i tuoi dati e il nostro team ti contatterà.", first: "Nome", last: "Cognome", phone: "Numero di telefono", email: "Indirizzo e-mail", comment: "Commento (facoltativo)", commentPlaceholder: "Dicci a cosa sei interessato...", submit: "Invia richiesta", privacy: "I tuoi dati saranno utilizzati solo per rispondere alla richiesta." },
  fr: { button: "Enregistrer votre intérêt", title: "Enregistrer votre intérêt", intro: "Laissez vos coordonnées et notre équipe vous contactera.", first: "Prénom", last: "Nom", phone: "Téléphone", email: "Adresse e-mail", comment: "Commentaire (facultatif)", commentPlaceholder: "Indiquez-nous ce qui vous intéresse...", submit: "Envoyer", privacy: "Vos données servent uniquement à répondre à votre demande." },
  es: { button: "Registrar interés", title: "Registrar interés", intro: "Déjanos tus datos y nuestro equipo se pondrá en contacto.", first: "Nombre", last: "Apellidos", phone: "Teléfono", email: "Correo electrónico", comment: "Comentario (opcional)", commentPlaceholder: "Cuéntanos qué te interesa...", submit: "Enviar solicitud", privacy: "Tus datos se usarán únicamente para responder a tu solicitud." },
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
        className="fixed right-0 top-1/2 z-[70] -translate-y-1/2 animate-pulse rounded-l-xl border-y border-l border-white/70 bg-[#09679f] px-3 py-5 text-sm font-bold text-white shadow-[0_0_0_6px_rgba(22,139,211,0.16),0_14px_40px_rgba(18,65,106,0.45)] transition hover:animate-none hover:bg-[#10264a] motion-reduce:animate-none sm:px-4"
        style={{ writingMode: "vertical-rl" }}
        aria-label={text.button}
      >
        {text.button}
      </button>

      {open && (
        <Modal labelledBy="lead-form-title" onClose={() => setOpen(false)}>
          <div className="relative max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl sm:p-8">
            <button type="button" onClick={() => setOpen(false)} className="absolute right-4 top-4 rounded-full p-2 text-slate-500 hover:bg-slate-100" aria-label={sharedCopy[locale].close}><X size={22} /></button>
            <p className="text-sm font-bold uppercase tracking-[0.16em] text-[#09679f]">Brickwise</p>
            <h2 id="lead-form-title" className="mt-2 pr-10 text-3xl font-bold text-[#10264a]">{text.title}</h2>
            <p className="mt-3 text-slate-600">{text.intro}</p>
            <form action={createContactRequest} className="mt-6 grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-bold text-[#23324d]">{text.first}<input name="first_name" required autoComplete="given-name" className="mt-2 h-12 w-full rounded-lg border border-slate-300 px-4 font-normal outline-none focus:border-[#168bd3] focus:ring-2 focus:ring-[#168bd3]/15" /></label>
              <label className="text-sm font-bold text-[#23324d]">{text.last}<input name="last_name" required autoComplete="family-name" className="mt-2 h-12 w-full rounded-lg border border-slate-300 px-4 font-normal outline-none focus:border-[#168bd3] focus:ring-2 focus:ring-[#168bd3]/15" /></label>
              <label className="text-sm font-bold text-[#23324d]">{text.phone}<input name="phone" type="tel" required autoComplete="tel" className="mt-2 h-12 w-full rounded-lg border border-slate-300 px-4 font-normal outline-none focus:border-[#168bd3] focus:ring-2 focus:ring-[#168bd3]/15" /></label>
              <label className="text-sm font-bold text-[#23324d]">{text.email}<input name="email" type="email" required autoComplete="email" className="mt-2 h-12 w-full rounded-lg border border-slate-300 px-4 font-normal outline-none focus:border-[#168bd3] focus:ring-2 focus:ring-[#168bd3]/15" /></label>
              <label className="text-sm font-bold text-[#23324d] sm:col-span-2">{text.comment}<textarea name="message" rows={3} maxLength={2000} placeholder={text.commentPlaceholder} className="mt-2 w-full resize-y rounded-lg border border-slate-300 px-4 py-3 font-normal outline-none focus:border-[#168bd3] focus:ring-2 focus:ring-[#168bd3]/15" /></label>
              <input type="hidden" name="topic" value="Floating website registration form" />
              <input type="text" name="company" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
              <button type="submit" className="mt-1 min-h-12 rounded-lg bg-[#09679f] px-6 font-bold text-white transition hover:bg-[#10264a] sm:col-span-2">{text.submit}</button>
              <p className="text-xs leading-5 text-slate-500 sm:col-span-2">{text.privacy}</p>
            </form>
          </div>
        </Modal>
      )}
    </>
  );
}
