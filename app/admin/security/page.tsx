import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { isAdminUser } from "@/app/lib/admin";
import { ADMIN_MFA_REQUIRED, getAdminMfaStatus } from "@/app/lib/admin-session";
import { getAdminText } from "@/app/lib/admin-copy";
import { getCurrentLocale } from "@/app/lib/server-locale";
import { createClient } from "@/lib/supabase/server";
import { MfaChallenge, MfaEnroll, type MfaCopy } from "./MfaForms";
import { AdminCard, AdminPageHeader } from "../ui";

export default async function AdminSecurityPage() {
  const t = getAdminText(await getCurrentLocale());
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !isAdminUser(user)) redirect("/admin");
  const status = await getAdminMfaStatus(supabase, user);
  const copy: MfaCopy = {
    start: t("Set up authenticator app"), starting: t("Preparing…"),
    scan: t("Scan this QR code with an authenticator app (for example Google Authenticator, Microsoft Authenticator or 1Password), then enter the 6-digit code it shows."),
    secret: t("Or enter this key manually:"), code: t("6-digit code"), verify: t("Confirm code"), verifying: t("Checking…"),
  };

  // Without access to the admin workspace (layout shows no shell) render a standalone card.
  if (status === "challenge" || (status === "enroll" && ADMIN_MFA_REQUIRED)) {
    return <main className="flex min-h-screen items-center justify-center bg-ink px-6 py-20 text-ink">
      <div className="w-full max-w-lg rounded-[28px] bg-white p-8 shadow-2xl sm:p-10">
        <p className="text-sm font-bold uppercase tracking-[0.18em] text-brand">Brickwise Immobilien</p>
        <h1 className="mt-3 text-3xl font-bold">{t("Two-factor authentication")}</h1>
        <p className="mt-3 text-slate-600">{status === "challenge"
          ? t("Enter the code from your authenticator app to open Panel Admin.")
          : t("Panel Admin requires an authenticator app. Set it up to continue.")}</p>
        {status === "challenge" ? <MfaChallenge copy={copy} /> : <MfaEnroll copy={copy} />}
        <a href="/logout" className="mt-6 inline-block text-sm text-slate-500">{t("Logout")}</a>
      </div>
    </main>;
  }

  return <main className="admin-workspace">
    <AdminPageHeader eyebrow={t("Settings")} title={t("Two-factor authentication")} description={t("Protect administrator access with a code from an authenticator app in addition to the password.")} />
    <div className="max-w-2xl">
      <AdminCard title={t("Security")}>
        {status === "verified"
          ? <p className="flex items-start gap-3 font-semibold text-[#0b6b47]"><ShieldCheck className="shrink-0" size={20} aria-hidden="true" />{t("Two-factor authentication is active for this account.")}</p>
          : <><p className="font-semibold">{t("Two-factor authentication is not set up yet.")}</p><MfaEnroll copy={copy} /></>}
      </AdminCard>
    </div>
  </main>;
}
