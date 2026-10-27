import { getRequestLocale } from "@/app/lib/i18n";
import { createTranslator } from "@/app/lib/translate";
import { after, NextResponse } from "next/server";
import { notifyAdminOfRegistration } from "@/app/lib/registration-notification";
import { createClient } from "@/lib/supabase/server";

const allowedOrigins = new Set([
  "https://brickwise-immo.de",
  "https://www.brickwise-immo.de",
  "https://brickwise-canada.ca",
  "https://www.brickwise-canada.ca",
  // Local development only; never trusted by a production deployment.
  ...(process.env.NODE_ENV === "production" ? [] : ["http://localhost:3000"]),
]);

function corsHeaders(req: Request) {
  const origin = req.headers.get("origin") || "";
  const fallbackOrigin =
    process.env.NEXT_PUBLIC_SITE_URL || "https://www.brickwise-immo.de";

  return {
    "Access-Control-Allow-Origin": allowedOrigins.has(origin)
      ? origin
      : fallbackOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  };
}

function getSiteOrigin(req: Request) {
  return (process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin).replace(/\/$/, "");
}

function json(req: Request, body: unknown, init?: ResponseInit) {
  return NextResponse.json(body, {
    ...init,
    headers: {
      ...corsHeaders(req),
      ...init?.headers,
    },
  });
}

function getAuthErrorDetails(error: { message: string; status?: number; code?: string }) {
  return [
    error.code ? `Code: ${error.code}` : "",
    error.status ? `Status: ${error.status}` : "",
    `Message: ${error.message}`,
  ]
    .filter(Boolean)
    .join(" | ");
}



export function OPTIONS(req: Request) {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(req),
  });
}

export async function POST(req: Request) {
  const locale = getRequestLocale(req);
  const t = createTranslator(locale);
  let body: Record<string, unknown>;

  try {
    body = await req.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("Invalid body");
  } catch {
    return json(
      req,
      { error: t("Please check your input.") },
      { status: 400 }
    );
  }

  // Control characters (e.g. newlines) could forge lines in the admin notification.
  const fullName = String(body.full_name || "").replace(/[\u0000-\u001f\u007f]+/g, " ").trim();
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  const referralCode = String(body.referral_code || "").trim().slice(0, 64);
  // Only a property page may be stored as the post-confirmation destination.
  const signupNext = typeof body.next === "string" && /^\/properties\/[a-z0-9-]{1,120}$/.test(body.next) ? body.next : null;
  const emailLanguage = locale;

  if (!fullName || !email || !password) {
    return json(
      req,
      { error: t("Please check your input.") },
      { status: 400 }
    );
  }

  if (fullName.length > 120 || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 8) {
    return json(
      req,
      { error: t("Please check your input.") },
      { status: 400 }
    );
  }

  const supabase = await createClient();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        email_language: emailLanguage,
        referral_code: referralCode || null,
        signup_next: signupNext,
      },
      emailRedirectTo: `${getSiteOrigin(req)}/authentication/callback`,
    },
  });

  if (error) {
    const technicalDetails = getAuthErrorDetails(error);
    console.error("Supabase signup error:", technicalDetails);

    const lowerMessage = error.message.toLowerCase();
    const friendlyMessage = lowerMessage.includes("rate limit")
      ? t("Please wait before trying again.")
      : error.code === "weak_password" ? t("This password is too weak or has appeared in a data breach. Choose a different password with at least 8 characters.") : t("Please check your input.");
    return json(req, { error: friendlyMessage }, { status: 400 });
  }

  const alreadyRegistered =
    data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0;

  if (alreadyRegistered) {
    return json(req, { success: true, alreadyRegistered: true }, { status: 200 });
  }

  if (data.user?.id) {
    const registration = { id: data.user.id, name: fullName, email,
      createdAt: data.user.created_at };
    after(async () => {
      try {
        await notifyAdminOfRegistration(registration);
      } catch {
        console.error("Admin registration notification failed", { userId: registration.id });
      }
    });
  }

  return json(req, { success: true, alreadyRegistered: false }, { status: 201 });
}
