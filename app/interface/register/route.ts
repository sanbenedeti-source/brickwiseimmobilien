import { getRequestLocale } from "@/app/lib/i18n";
import { createTranslator } from "@/app/lib/translate";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const allowedOrigins = new Set([
  "https://brickwise-immo.de",
  "https://www.brickwise-immo.de",
  "https://brickwise-canada.ca",
  "https://www.brickwise-canada.ca",
  "http://localhost:3000",
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

  const fullName = String(body.full_name || "").trim();
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  const referralCode = String(body.referral_code || "").trim().slice(0, 64);
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
      },
      emailRedirectTo: `${getSiteOrigin(req)}/authentication/callback`,
    },
  });

  if (error) {
    const technicalDetails = getAuthErrorDetails(error);
    console.error("Supabase signup error:", technicalDetails);

    const lowerMessage = error.message.toLowerCase();
    const friendlyMessage = lowerMessage.includes("rate limit")
      ? t("Please wait before trying again.") : t("Please check your input.");
    return json(req, { error: friendlyMessage }, { status: 400 });
  }

  const alreadyRegistered =
    data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0;

  if (alreadyRegistered) {
    return json(req, { success: true, alreadyRegistered: true }, { status: 200 });
  }

  return json(req, { success: true, alreadyRegistered: false }, { status: 201 });
}
