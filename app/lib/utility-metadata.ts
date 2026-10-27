import type { Metadata } from "next";
import { cookies } from "next/headers";
import { defaultLocale, i18nText, localeCookieName, normalizeLocale, supportedLocales } from "./i18n";

// Titles for pages outside the public sitemap, in supportedLocales order (en, de, fr, es, it).
const titles = {
  join: ["Create account", "Konto erstellen", "Créer un compte", "Crear cuenta", "Crea account"],
  verifyPhone: ["Verify phone number", "Telefonnummer bestätigen", "Vérifier le numéro de téléphone", "Verificar número de teléfono", "Verifica numero di telefono"],
  signIn: ["Sign in", "Anmelden", "Connexion", "Iniciar sesión", "Accedi"],
  twoFactor: ["Security code", "Sicherheitscode", "Code de sécurité", "Código de seguridad", "Codice di sicurezza"],
  forgotPassword: ["Reset password", "Passwort zurücksetzen", "Réinitialiser le mot de passe", "Restablecer contraseña", "Reimposta password"],
  updatePassword: ["Set a new password", "Neues Passwort festlegen", "Définir un nouveau mot de passe", "Establecer nueva contraseña", "Imposta una nuova password"],
  thankYou: ["Thank you", "Vielen Dank", "Merci", "Gracias", "Grazie"],
  notFound: ["Page not found", "Seite nicht gefunden", "Page introuvable", "Página no encontrada", "Pagina non trovata"],
  verifyAgent: ["Verify a Brickwise agent", "Brickwise-Agenten verifizieren", "Vérifier un agent Brickwise", "Verificar un agente de Brickwise", "Verifica un agente Brickwise"],
} satisfies Record<string, string[]>;

export async function utilityMetadata(page: keyof typeof titles): Promise<Metadata> {
  const locale = normalizeLocale((await cookies()).get(localeCookieName)?.value) || defaultLocale;
  const title = `${titles[page][supportedLocales.indexOf(locale)]} | BRICKWISE`;
  const { description, ogLocale } = i18nText[locale].metadata;
  return { title, description, openGraph: { title, description, siteName: "BRICKWISE", locale: ogLocale, type: "website" } };
}
