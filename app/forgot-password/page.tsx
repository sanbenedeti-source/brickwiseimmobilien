import { cookies } from "next/headers";
import ForgotPasswordForm, { ForgotPasswordCopy } from "./ForgotPasswordForm";
import {
  defaultLocale,
  Locale,
  localeCookieName,
  normalizeLocale,
} from "@/app/lib/i18n";
import { utilityMetadata } from "@/app/lib/utility-metadata";

export function generateMetadata() {
  return utilityMetadata("forgotPassword");
}

const en: ForgotPasswordCopy = {
  title: "Reset your password",
  intro: "Enter your account email and we will send you a secure password reset link.",
  email: "Email",
  emailPlaceholder: "email@example.com",
  send: "Send reset link",
  sending: "Sending reset link...",
  success: "If an account exists for this email, a password reset link has been sent. Check your inbox and spam folder.",
  invalidLink: "This password reset link is invalid or has expired. Request a new link below.",
  back: "Back to login",
};

const de: ForgotPasswordCopy = {
  title: "Passwort zurücksetzen",
  intro: "Geben Sie Ihre Konto-E-Mail ein. Wir senden Ihnen einen sicheren Link zum Zurücksetzen des Passworts.",
  email: "E-Mail",
  emailPlaceholder: "email@example.com",
  send: "Reset-Link senden",
  sending: "Reset-Link wird gesendet...",
  success: "Falls ein Konto für diese E-Mail existiert, wurde ein Reset-Link gesendet. Prüfen Sie Posteingang und Spam-Ordner.",
  invalidLink: "Dieser Reset-Link ist ungültig oder abgelaufen. Fordern Sie unten einen neuen Link an.",
  back: "Zurück zur Anmeldung",
};



const copy: Record<Locale, ForgotPasswordCopy> = {
  en,
  de,
  fr: { title: "Réinitialiser votre mot de passe", intro: "Saisissez l’e-mail de votre compte et nous vous enverrons un lien sécurisé.", email: "E-mail", emailPlaceholder: "email@example.com", send: "Envoyer le lien", sending: "Envoi du lien...", success: "Si un compte existe pour cet e-mail, un lien a été envoyé. Vérifiez votre boîte de réception et les spams.", invalidLink: "Ce lien est invalide ou expiré. Demandez-en un nouveau ci-dessous.", back: "Retour à la connexion" },
  es: { title: "Restablecer contraseña", intro: "Introduce el correo de tu cuenta y te enviaremos un enlace seguro.", email: "Correo electrónico", emailPlaceholder: "email@example.com", send: "Enviar enlace", sending: "Enviando enlace...", success: "Si existe una cuenta con este correo, se ha enviado un enlace. Revisa tu bandeja de entrada y spam.", invalidLink: "Este enlace no es válido o ha caducado. Solicita uno nuevo abajo.", back: "Volver al inicio de sesión" },
  it: { title: "Reimposta la password", intro: "Inserisci l'e-mail del tuo account e ti invieremo un link sicuro.", email: "E-mail", emailPlaceholder: "email@example.com", send: "Invia link", sending: "Invio del link...", success: "Se esiste un account per questa e-mail, è stato inviato un link. Controlla posta in arrivo e spam.", invalidLink: "Questo link non è valido o è scaduto. Richiedine uno nuovo qui sotto.", back: "Torna all'accesso" },
};

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; portal?: string }>;
}) {
  const cookieStore = await cookies();
  const locale = normalizeLocale(cookieStore.get(localeCookieName)?.value) || defaultLocale;
  const params = await searchParams;

  return (
    <ForgotPasswordForm
      copy={copy[locale]}
      invalidLink={params.error === "invalid-link"}
      portal={params.portal === "admin" ? "admin" : "client"}
    />
  );
}
