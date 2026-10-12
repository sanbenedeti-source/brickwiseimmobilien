import { NextResponse } from "next/server";
import { isAdminUser } from "@/app/lib/admin";
import { createClient } from "@/lib/supabase/server";
import { getRequestLocale } from "@/app/lib/i18n";
import { createTranslator } from "@/app/lib/translate";

export async function POST(request: Request) {
  const t = createTranslator(getRequestLocale(request));
  const { email, token } = await request.json().catch(() => ({}));
  const normalizedEmail =
    typeof email === "string" ? email.trim().toLowerCase() : "";
  const normalizedToken =
    typeof token === "string" ? token.replace(/\D/g, "") : "";

  if (!normalizedEmail || normalizedToken.length !== 6) {
    return NextResponse.json(
      { error: t("Enter your email address and the 6-digit security code.") },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    email: normalizedEmail,
    token: normalizedToken,
    type: "email",
  });

  if (error) {
    return NextResponse.json({ error: t(error.status === 429 ? "Please wait before trying again." : "The security code is invalid or has expired. Request a new code and try again.") }, { status: 400 });
  }

  const { data: { user } } = await supabase.auth.getUser();

  return NextResponse.json({
    redirectTo: isAdminUser(user) ? "/admin" : "/dashboard",
  });
}
