import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import UpdatePasswordForm, { UpdatePasswordCopy } from "./UpdatePasswordForm";
import {
  defaultLocale,
  Locale,
  localeCookieName,
  normalizeLocale,
} from "@/app/lib/i18n";

const en: UpdatePasswordCopy = {
  title: "Choose a new password",
  intro: "Use at least 8 characters and avoid reusing a password from another account.",
  password: "New password",
  confirmPassword: "Confirm new password",
  placeholder: "At least 8 characters",
  mismatch: "The passwords do not match.",
  update: "Update password",
  updating: "Updating password...",
  success: "Your password was updated. You can now sign in with the new password.",
  login: "Go to login",
};

const de: UpdatePasswordCopy = {
  title: "Neues Passwort wählen",
  intro: "Verwenden Sie mindestens 8 Zeichen und kein Passwort, das Sie für ein anderes Konto nutzen.",
  password: "Neues Passwort",
  confirmPassword: "Neues Passwort bestätigen",
  placeholder: "Mindestens 8 Zeichen",
  mismatch: "Die Passwörter stimmen nicht überein.",
  update: "Passwort aktualisieren",
  updating: "Passwort wird aktualisiert...",
  success: "Ihr Passwort wurde aktualisiert. Sie können sich jetzt mit dem neuen Passwort anmelden.",
  login: "Zur Anmeldung",
};



const copy: Record<Locale, UpdatePasswordCopy> = {
  en,
  de,
  fr: { title: "Choisir un nouveau mot de passe", intro: "Utilisez au moins 8 caractères et évitez de réutiliser un autre mot de passe.", password: "Nouveau mot de passe", confirmPassword: "Confirmer le mot de passe", placeholder: "Au moins 8 caractères", mismatch: "Les mots de passe ne correspondent pas.", update: "Mettre à jour", updating: "Mise à jour...", success: "Votre mot de passe a été modifié. Vous pouvez maintenant vous connecter.", login: "Aller à la connexion" },
  es: { title: "Elige una nueva contraseña", intro: "Usa al menos 8 caracteres y evita reutilizar otra contraseña.", password: "Nueva contraseña", confirmPassword: "Confirmar contraseña", placeholder: "Al menos 8 caracteres", mismatch: "Las contraseñas no coinciden.", update: "Actualizar contraseña", updating: "Actualizando...", success: "Tu contraseña se ha actualizado. Ya puedes iniciar sesión.", login: "Ir al inicio de sesión" },
  it: { title: "Scegli una nuova password", intro: "Usa almeno 8 caratteri e non riutilizzare password di altri account.", password: "Nuova password", confirmPassword: "Conferma password", placeholder: "Almeno 8 caratteri", mismatch: "Le password non corrispondono.", update: "Aggiorna password", updating: "Aggiornamento...", success: "La password è stata aggiornata. Ora puoi accedere.", login: "Vai all'accesso" },
};

export default async function UpdatePasswordPage({ searchParams }: { searchParams: Promise<{ portal?: string }> }) {
  const params = await searchParams;
  const portal = params.portal === "admin" ? "admin" : "client";
  const cookieStore = await cookies();
  const locale = normalizeLocale(cookieStore.get(localeCookieName)?.value) || defaultLocale;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect(`/forgot-password?error=invalid-link&portal=${portal}`);

  return <UpdatePasswordForm copy={copy[locale]} portal={portal} />;
}
