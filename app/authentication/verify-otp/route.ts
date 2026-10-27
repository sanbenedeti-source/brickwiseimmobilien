import { NextResponse } from "next/server";
import { isAdminUser } from "@/app/lib/admin";
import { createClient } from "@/lib/supabase/server";
import { getRequestLocale } from "@/app/lib/i18n";
import { createTranslator } from "@/app/lib/translate";

export async function POST(request: Request) {
  const t = createTranslator(getRequestLocale(request));
  // Only the sign-in form on this site may start a session (no cross-site login).
  if (request.headers.get("origin") !== new URL(request.url).origin) return NextResponse.json({ error: t("This request could not be verified. Reload the page and try again.") }, { status: 403 });
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") return NextResponse.json({ error: t("This request could not be verified. Reload the page and try again.") }, { status: 415 });
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
