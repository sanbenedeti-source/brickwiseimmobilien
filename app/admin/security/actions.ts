"use server";

import { redirect } from "next/navigation";
import { isAdminUser } from "@/app/lib/admin";
import { getAdminMfaStatus } from "@/app/lib/admin-session";
import { getAdminText } from "@/app/lib/admin-copy";
import { getCurrentLocale } from "@/app/lib/server-locale";
import { createClient } from "@/lib/supabase/server";

export type MfaEnrollment = { factorId: string; qrCode: string; secret: string } | { error: string };
export type MfaVerifyState = { error: string };

export async function startAdminMfaEnrollment(): Promise<MfaEnrollment> {
  const t = getAdminText(await getCurrentLocale());
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user || !isAdminUser(user)) redirect("/admin");
  // Only the first factor can be enrolled here; further factors need a confirmed session.
  if (await getAdminMfaStatus(supabase, user) !== "enroll") redirect("/admin/security");
  // Abandoned setup attempts leave unverified factors that would block a new one.
  for (const factor of user.factors ?? []) {
    if (factor.status !== "verified") await supabase.auth.mfa.unenroll({ factorId: factor.id });
  }
  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: `Brickwise admin ${new Date().toISOString().slice(0, 19)}`,
  });
  if (error || !data) {
    console.error("Admin MFA enrollment failed:", error?.message);
    return { error: t("Two-factor setup could not be started. Try again.") };
  }
  return { factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret };
}

export async function verifyAdminMfa(_previous: MfaVerifyState, formData: FormData): Promise<MfaVerifyState> {
  const t = getAdminText(await getCurrentLocale());
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user || !isAdminUser(user)) redirect("/admin");
  const code = String(formData.get("code") || "").replace(/\s+/g, "");
  if (!/^\d{6}$/.test(code)) return { error: t("Enter the 6-digit code from your authenticator app.") };
  // A new enrollment names its factor; otherwise use the verified authenticator.
  const requested = String(formData.get("factor_id") || "");
  const factor = (user.factors ?? []).find((item) => item.factor_type === "totp"
    && (requested ? item.id === requested : item.status === "verified"));
  if (!factor) return { error: t("The code could not be verified. Try again.") };
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code });
  if (error) return { error: t("The code could not be verified. Try again.") };
  redirect("/admin");
}
