import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getRequestLocale } from "@/app/lib/i18n";
import { createTranslator } from "@/app/lib/translate";

export async function POST(request: Request) {
  const t = createTranslator(getRequestLocale(request));
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const phone = String(body.phone || "").trim().replace(/[\s()-]/g, "");
  const token = String(body.token || "").replace(/\D/g, "");
  if (!/^\+[1-9]\d{7,14}$/.test(phone) || token.length !== 6) {
    return NextResponse.json({ error: t("Enter a valid phone number and 6-digit code.") }, { status: 400 });
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ phone, token, type: "phone_change" });
  if (error) return NextResponse.json({ error: t(error.status === 429 ? "Please wait before trying again." : "The security code is invalid or has expired. Request a new code and try again.") }, { status: 400 });

  await supabase.auth.updateUser({ data: { phone_pending_verification: null } });
  return NextResponse.json({ success: true, redirectTo: "/dashboard" });
}
