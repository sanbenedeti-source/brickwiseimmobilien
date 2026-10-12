"use server";

import { redirect } from "next/navigation";
import { isAdminUser } from "@/app/lib/admin";
import { createClient } from "@/lib/supabase/server";
import { getCurrentLocale } from "@/app/lib/server-locale";
import { getAdminText } from "@/app/lib/admin-copy";

export type AdminSignInState = { error: string };

export async function signInAdmin(
  _previousState: AdminSignInState,
  formData: FormData,
): Promise<AdminSignInState> {
  const t = getAdminText(await getCurrentLocale());
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  if (!email || !password) return { error: t("Enter the administrator email and password.") };
  const supabase = await createClient();
  await supabase.auth.signOut();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) return { error: t("Admin sign-in failed. Check your credentials and try again.") };
  if (!isAdminUser(data.user)) {
    await supabase.auth.signOut();
    return { error: t("This account is not authorized for Panel Admin.") };
  }
  redirect("/admin");
}
