import PhoneVerificationForm from "./PhoneVerificationForm";
import { cookies } from "next/headers";
import { defaultLocale, localeCookieName, normalizeLocale, type Locale } from "@/app/lib/i18n";
import { utilityMetadata } from "@/app/lib/utility-metadata";

export function generateMetadata() {
  return utilityMetadata("verifyPhone");
}

const copy: Record<Locale, { eyebrow: string; title: string; intro: string; phone: string; code: string; invalid: string; verifying: string; submit: string }> = {
  en: { eyebrow: "Phone verification", title: "Enter the SMS code", intro: "We sent a 6-digit code to your mobile number. This verification is required only for the initial registration.", phone: "Phone number", code: "6-digit SMS code", invalid: "The code could not be verified.", verifying: "Verifying...", submit: "Verify phone and open dashboard" },
  de: { eyebrow: "Telefonverifizierung", title: "SMS-Code eingeben", intro: "Wir haben einen sechsstelligen Code an Ihre Mobilnummer gesendet. Diese Prüfung ist nur bei der ersten Registrierung erforderlich.", phone: "Telefonnummer", code: "Sechsstelliger SMS-Code", invalid: "Der Code konnte nicht bestätigt werden.", verifying: "Code wird geprüft...", submit: "Telefon bestätigen und Dashboard öffnen" },
  fr: { eyebrow: "Vérification du téléphone", title: "Saisissez le code reçu par SMS", intro: "Nous avons envoyé un code à six chiffres à votre numéro de téléphone. Cette vérification est requise uniquement lors de la première inscription.", phone: "Numéro de téléphone", code: "Code SMS à six chiffres", invalid: "Le code n’a pas pu être vérifié.", verifying: "Vérification...", submit: "Vérifier le téléphone et ouvrir le tableau de bord" },
  es: { eyebrow: "Verificación del teléfono", title: "Introduce el código SMS", intro: "Hemos enviado un código de seis dígitos a tu número de teléfono. Esta verificación solo es necesaria durante el registro inicial.", phone: "Número de teléfono", code: "Código SMS de seis dígitos", invalid: "No se ha podido verificar el código.", verifying: "Verificando...", submit: "Verificar el teléfono y abrir el panel" },
  it: { eyebrow: "Verifica del telefono", title: "Inserisci il codice SMS", intro: "Abbiamo inviato un codice di sei cifre al tuo numero di cellulare. Questa verifica è richiesta solo durante la registrazione iniziale.", phone: "Numero di telefono", code: "Codice SMS di sei cifre", invalid: "Non è stato possibile verificare il codice.", verifying: "Verifica in corso...", submit: "Verifica il telefono e apri la dashboard" },
};

export default async function VerifyPhonePage({ searchParams }: { searchParams: Promise<{ phone?: string }> }) {
  const { phone = "" } = await searchParams;
  const cookieStore = await cookies();
  const locale = normalizeLocale(cookieStore.get(localeCookieName)?.value) || defaultLocale;
  return <PhoneVerificationForm initialPhone={phone} copy={copy[locale]} />;
}
