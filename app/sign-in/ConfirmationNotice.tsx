"use client";

import { useState } from "react";
import { useLocale } from "../components/LocaleProvider";

const copy = {
  en: { title: "Check your email", text: "Open the confirmation link before signing in. Check your spam folder too.", invalid: "This confirmation link is invalid or has expired. Request a new one below.", email: "Confirmation email", send: "Resend confirmation", waiting: "Please wait…", sent: "Confirmation requested. Check your inbox and spam folder.", error: "The email could not be sent. Please wait and try again." },
  de: { title: "Prüfen Sie Ihre E-Mails", text: "Öffnen Sie vor der Anmeldung den Bestätigungslink. Prüfen Sie auch den Spam-Ordner.", invalid: "Dieser Bestätigungslink ist ungültig oder abgelaufen. Fordern Sie unten einen neuen an.", email: "E-Mail zur Bestätigung", send: "Bestätigung erneut senden", waiting: "Bitte warten…", sent: "Bestätigung angefordert. Prüfen Sie Ihren Posteingang und Spam-Ordner.", error: "Die E-Mail konnte nicht gesendet werden. Bitte versuchen Sie es später erneut." },
  fr: { title: "Consultez vos e-mails", text: "Ouvrez le lien de confirmation avant de vous connecter. Vérifiez aussi les indésirables.", invalid: "Ce lien est invalide ou a expiré. Demandez-en un nouveau ci-dessous.", email: "E-mail de confirmation", send: "Renvoyer la confirmation", waiting: "Veuillez patienter…", sent: "Confirmation demandée. Consultez votre boîte de réception et les indésirables.", error: "L’e-mail n’a pas pu être envoyé. Réessayez plus tard." },
  es: { title: "Revisa tu correo", text: "Abre el enlace de confirmación antes de iniciar sesión. Revisa también el correo no deseado.", invalid: "Este enlace no es válido o ha caducado. Solicita uno nuevo a continuación.", email: "Correo de confirmación", send: "Reenviar confirmación", waiting: "Espera…", sent: "Confirmación solicitada. Revisa tu bandeja de entrada y el correo no deseado.", error: "No se pudo enviar el correo. Inténtalo de nuevo más tarde." },
  it: { title: "Controlla la tua e-mail", text: "Apri il link di conferma prima di accedere. Controlla anche la cartella spam.", invalid: "Questo link non è valido o è scaduto. Richiedine uno nuovo qui sotto.", email: "E-mail di conferma", send: "Invia di nuovo la conferma", waiting: "Attendi…", sent: "Conferma richiesta. Controlla la posta in arrivo e lo spam.", error: "Impossibile inviare l’e-mail. Riprova più tardi." },
};

export default function ConfirmationNotice({ initialEmail, invalidLink }: { initialEmail: string; invalidLink: boolean }) {
  const text = copy[useLocale()];
  const [email, setEmail] = useState(initialEmail);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [cooldown, setCooldown] = useState(false);

  async function resend(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || cooldown) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/interface/confirmation-email", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      setMessage(response.ok ? text.sent : text.error);
      if (response.ok) {
        setCooldown(true);
        window.setTimeout(() => setCooldown(false), 60000);
      }
    } catch { setMessage(text.error); }
    finally { setBusy(false); }
  }

  return <section className="mt-8 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-950" aria-labelledby="confirmation-title">
    <h2 id="confirmation-title" className="font-bold">{text.title}</h2>
    <p className="mt-2 text-sm">{invalidLink ? text.invalid : text.text}</p>
    <form onSubmit={resend} className="mt-4 space-y-3">
      <label htmlFor="confirmation-email" className="block text-sm font-semibold">{text.email}</label>
      <input id="confirmation-email" type="email" autoComplete="email" required maxLength={254} value={email} onChange={e => setEmail(e.target.value)} className="w-full rounded-xl border border-emerald-300 bg-white p-3 text-slate-900" />
      <button disabled={busy || cooldown} className="rounded-lg bg-brand px-4 py-3 font-semibold text-white disabled:opacity-60 hover:bg-brand-strong">{busy || cooldown ? text.waiting : text.send}</button>
      <p role="status" className="text-sm">{message}</p>
    </form>
  </section>;
}
