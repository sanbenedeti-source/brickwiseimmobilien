import { cookies } from "next/headers";
import TwoFactorForm, { TwoFactorCopy } from "./TwoFactorForm";
import {
  defaultLocale,
  Locale,
  localeCookieName,
  normalizeLocale,
} from "@/app/lib/i18n";

const en: TwoFactorCopy = {
  title: "Email code",
  intro: "We sent a security code to your email address. Enter the code to finish signing in.",
  email: "Email",
  emailPlaceholder: "Enter your email address",
  code: "Security code",
  newCodeSent: "A new security code was sent.",
  invalidCode: "Enter the 6-digit code from your email.",
  checking: "Checking code...",
  confirm: "Confirm login",
  sending: "Sending...",
  resend: "Send code again",
  back: "Back to login",
};

const de: TwoFactorCopy = {
  title: "E-Mail-Code",
  intro: "Wir haben einen Sicherheitscode an Ihre E-Mail-Adresse gesendet. Geben Sie den Code ein, um die Anmeldung abzuschließen.",
  email: "E-Mail",
  emailPlaceholder: "Geben Sie Ihre E-Mail-Adresse ein",
  code: "Sicherheitscode",
  newCodeSent: "Ein neuer Sicherheitscode wurde gesendet.",
  invalidCode: "Geben Sie den 6-stelligen Code aus Ihrer E-Mail ein.",
  checking: "Code wird geprüft...",
  confirm: "Anmeldung bestätigen",
  sending: "Wird gesendet...",
  resend: "Code erneut senden",
  back: "Zurück zur Anmeldung",
};



const copy: Record<Locale, TwoFactorCopy> = {
  en,
  de,
  fr: { title: "Code par e-mail", intro: "Nous avons envoyé un code de sécurité à votre adresse e-mail.", email: "E-mail", emailPlaceholder: "Saisissez votre e-mail", code: "Code de sécurité", newCodeSent: "Un nouveau code a été envoyé.", invalidCode: "Saisissez le code à 6 chiffres reçu par e-mail.", checking: "Vérification...", confirm: "Confirmer la connexion", sending: "Envoi...", resend: "Renvoyer le code", back: "Retour à la connexion" },
  es: { title: "Código por correo", intro: "Hemos enviado un código de seguridad a tu correo.", email: "Correo electrónico", emailPlaceholder: "Introduce tu correo", code: "Código de seguridad", newCodeSent: "Se ha enviado un nuevo código.", invalidCode: "Introduce el código de 6 dígitos recibido.", checking: "Comprobando...", confirm: "Confirmar acceso", sending: "Enviando...", resend: "Enviar código de nuevo", back: "Volver al inicio de sesión" },
  it: { title: "Codice via e-mail", intro: "Abbiamo inviato un codice di sicurezza al tuo indirizzo e-mail.", email: "E-mail", emailPlaceholder: "Inserisci la tua e-mail", code: "Codice di sicurezza", newCodeSent: "È stato inviato un nuovo codice.", invalidCode: "Inserisci il codice di 6 cifre ricevuto.", checking: "Verifica...", confirm: "Conferma accesso", sending: "Invio...", resend: "Invia di nuovo il codice", back: "Torna all'accesso" },
};

async function getCurrentLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  return normalizeLocale(cookieStore.get(localeCookieName)?.value) || defaultLocale;
}

export default async function TwoFactorPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const locale = await getCurrentLocale();
  const params = await searchParams;
  const initialEmail = typeof params.email === "string"
    ? params.email.trim().toLowerCase()
    : "";

  return <TwoFactorForm copy={copy[locale]} initialEmail={initialEmail} />;
}
