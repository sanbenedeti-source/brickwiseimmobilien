import { cookies } from "next/headers";
import SignInForm, { SignInCopy } from "./SignInForm";
import {
  defaultLocale,
  Locale,
  localeCookieName,
  normalizeLocale,
} from "../lib/i18n";
import { utilityMetadata } from "@/app/lib/utility-metadata";

export function generateMetadata() {
  return utilityMetadata("signIn");
}

const en: SignInCopy = {
  title: "Sign in",
  intro: "Sign in securely with your email and password.",
  email: "Email",
  emailPlaceholder: "email@example.com",
  password: "Password",
  passwordPlaceholder: "Password",
  forgotPassword: "Forgot password?",
  sending: "Signing in...",
  signIn: "Sign in",
  noAccount: "No account yet?",
  join: "Join",
  accountCreated: "Your account has been created. Sign in with your email and password to continue.",
};

const de: SignInCopy = {
  title: "Anmelden",
  intro: "Melden Sie sich sicher mit E-Mail und Passwort an.",
  email: "E-Mail",
  emailPlaceholder: "email@example.com",
  password: "Passwort",
  passwordPlaceholder: "Passwort",
  forgotPassword: "Passwort vergessen?",
  sending: "Anmeldung...",
  signIn: "Anmelden",
  noAccount: "Noch kein Konto?",
  join: "Konto erstellen",
  accountCreated: "Ihr Konto wurde erstellt. Melden Sie sich mit Ihrer E-Mail-Adresse und Ihrem Passwort an, um fortzufahren.",
};



const copy: Record<Locale, SignInCopy> = {
  en,
  de,
  fr: { title: "Connexion", intro: "Connectez-vous en toute sécurité avec votre e-mail et votre mot de passe.", email: "E-mail", emailPlaceholder: "email@example.com", password: "Mot de passe", passwordPlaceholder: "Mot de passe", forgotPassword: "Mot de passe oublié ?", sending: "Connexion...", signIn: "Se connecter", noAccount: "Pas encore de compte ?", join: "Créer un compte", accountCreated: "Votre compte a été créé. Connectez-vous avec votre e-mail et votre mot de passe pour continuer." },
  es: { title: "Iniciar sesión", intro: "Accede de forma segura con tu correo y contraseña.", email: "Correo electrónico", emailPlaceholder: "email@example.com", password: "Contraseña", passwordPlaceholder: "Contraseña", forgotPassword: "¿Olvidaste tu contraseña?", sending: "Iniciando sesión...", signIn: "Iniciar sesión", noAccount: "¿Aún no tienes cuenta?", join: "Crear cuenta", accountCreated: "Tu cuenta se ha creado. Inicia sesión con tu correo y tu contraseña para continuar." },
  it: { title: "Accedi", intro: "Accedi in sicurezza con e-mail e password.", email: "E-mail", emailPlaceholder: "email@example.com", password: "Password", passwordPlaceholder: "Password", forgotPassword: "Password dimenticata?", sending: "Accesso...", signIn: "Accedi", noAccount: "Non hai ancora un account?", join: "Crea account", accountCreated: "Il tuo account è stato creato. Accedi con la tua e-mail e la tua password per continuare." },
};

async function getCurrentLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  return normalizeLocale(cookieStore.get(localeCookieName)?.value) || defaultLocale;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; registered?: string; created?: string; error?: string; next?: string }>;
}) {
  const locale = await getCurrentLocale();
  const params = await searchParams;
  const initialEmail = typeof params.email === "string" ? params.email.slice(0, 254) : "";
  return <SignInForm copy={copy[locale]} initialEmail={initialEmail} registered={params.registered === "1"} created={params.created === "1"} invalidLink={params.error === "invalid-link"} next={typeof params.next === "string" ? params.next.slice(0, 300) : ""} />;
}
