"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { localeCookieName, normalizeLocale } from "../lib/i18n";
import { createTranslator } from "../lib/translate";
import { isAdminUser } from "@/app/lib/admin";
import { createClient } from "@/lib/supabase/server";

export type SignInState = {
  error: string;
};

export async function signInWithPassword(
  _previousState: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const locale = normalizeLocale((await cookies()).get(localeCookieName)?.value) || "en";
  const t = createTranslator(locale);
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");

  if (!email || !password) {
    return { error: t("Enter your email address and password.") };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.user) {
    const message = error?.code === "email_not_confirmed" ? "Please confirm your email before signing in."
      : error?.status === 429 ? "Please wait before trying again."
      : error?.code === "invalid_credentials" ? "Invalid email or password."
      : "The sign-in could not be completed.";
    return { error: t(message) };
  }

  if (isAdminUser(data.user)) redirect("/admin");
  // Only same-site property and portal pages; never another origin ("//", "/\\").
  const next = String(formData.get("next") || "");
  redirect(/^\/(?:properties|dashboard|funding|contact)(?:[/?#][^\\\s]*)?$/.test(next) ? next : "/dashboard");
}
