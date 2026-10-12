import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getRequestLocale } from "@/app/lib/i18n";
import { createTranslator } from "@/app/lib/translate";

export async function POST(req: Request) {
  const t = createTranslator(getRequestLocale(req));
  let body: Record<string, unknown>;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: t("Invalid JSON request.") },
      { status: 400 }
    );
  }

  const honeypot = String(body.company || body.website || "").trim();

  if (honeypot) {
    return NextResponse.json({ success: true });
  }

  const firstName = String(body.first_name || "").trim();
  const lastName = String(body.last_name || "").trim();
  const name = String(body.name || `${firstName} ${lastName}`).trim();
  const email = String(body.email || "").trim().toLowerCase();
  const phone = String(body.phone || "").trim();
  const topic = String(body.topic || "").trim();
  const message = String(body.message || "").trim();
  const propertyId = String(body.property_id || "").trim();

  if (!name || !email || !message) {
    return NextResponse.json(
      { error: t("Name, email, and message are required.") },
      { status: 400 }
    );
  }

  if (name.length > 120 || email.length > 254 || message.length > 2000) {
    return NextResponse.json(
      { error: t("The request is too long.") },
      { status: 400 }
    );
  }

  const finalMessage = topic
    ? `${t("Topic")}: ${topic.slice(0, 80)}\n\n${message}`
    : message;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase.from("property_requests").insert({
    user_id: user?.id || null,
    name,
    email,
    phone,
    message: finalMessage,
    property_id: propertyId || null,
    status: "new",
  });

  if (error) {
    return NextResponse.json(
      { error: t("Your request could not be saved. Please try again.") },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true }, { status: 201 });
}
