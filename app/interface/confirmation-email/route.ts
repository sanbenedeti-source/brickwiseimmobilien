import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { getRequestLocale } from "@/app/lib/i18n";
import { createTranslator } from "@/app/lib/translate";

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

function json(req: Request, body: unknown, init?: ResponseInit) {
  return NextResponse.json(body, {
    ...init,
    headers: {
      ...corsHeaders(req),
      ...init?.headers,
    },
  });
}

function getSiteOrigin(req: Request) {
  const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;

  if (configuredSiteUrl) {
    return configuredSiteUrl.replace(/\/$/, "");
  }

  // The request URL, not the caller-controlled Origin header, decides the link target.
  return new URL(req.url).origin.replace(/\/$/, "");
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
  const t = createTranslator(getRequestLocale(req));
  let body: Record<string, unknown>;

  try {
    body = await req.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("Invalid body");
  } catch {
    return json(req, { error: t("Invalid JSON request.") }, { status: 400 });
  }

  const email = String(body.email || "").trim().toLowerCase();

  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json(req, { error: t("Please enter a valid email address.") }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return json(req, { error: t("The confirmation email could not be sent. Please try again later.") }, { status: 500 });
  }

  const supabase = createSupabaseClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
    options: {
      emailRedirectTo: `${getSiteOrigin(req)}/authentication/callback`,
    },
  });

  if (error) {
    const technicalDetails = getAuthErrorDetails(error);
    console.error("Supabase confirmation email error:", technicalDetails);

    const lowerMessage = error.message.toLowerCase();
    const friendlyMessage =
      lowerMessage.includes("rate limit")
        ? t("Please wait before trying again.")
        : t("The confirmation email could not be sent. Please try again later.");

    return json(req, { error: friendlyMessage }, { status: 400 });
  }

  return json(req, { success: true });
}
