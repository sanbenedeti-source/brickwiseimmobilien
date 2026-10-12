import { createClient } from "@/lib/supabase/server";
import { getRequestLocale, normalizeLocale } from "@/app/lib/i18n";
import { agreementVersion, loadClientAgreement } from "@/app/lib/client-agreements";

const headers = { "Cache-Control": "private, no-store" };
function failure(status: number) { return Response.json({ error: "agreement_unavailable" }, { status, headers }); }

export async function GET(request: Request) {
  try {
    const client = await createClient();
    const { data: { user }, error } = await client.auth.getUser();
    if (error || !user) return failure(401);
    return Response.json(await loadClientAgreement(client, user.id, getRequestLocale(request), !!user.email_confirmed_at), { headers });
  } catch { return failure(503); }
}

export async function POST(request: Request) {
  // A signature must come from an explicit same-origin JSON submission.
  if (request.headers.get("origin") !== new URL(request.url).origin) return failure(403);
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") return failure(415);
  try {
    const client = await createClient();
    const { data: { user }, error } = await client.auth.getUser();
    if (error || !user) return failure(401);
    if (!user.email_confirmed_at) return failure(403);
    let body: Record<string, unknown>;
    try {
      const text = await request.text();
      if (text.length > 4096) return failure(413);
      const parsed = JSON.parse(text);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return failure(400);
      body = parsed;
    } catch { return failure(400); }
    const locale = typeof body.locale === "string" ? normalizeLocale(body.locale) : null;
    const name = typeof body.signerName === "string" ? body.signerName.trim() : "";
    if (!locale || body.consent !== true || name.length < 2 || name.length > 120 || /[\u0000-\u001f\u007f]/.test(name)) return failure(422);
    if (body.version !== agreementVersion) return failure(409);
    // Read the current catalog before accepting; the database snapshots its exact PDF and consent.
    await loadClientAgreement(client, user.id, locale, true);
    const { error: writeError } = await client.rpc("accept_client_agreement", {
      p_version: agreementVersion, p_locale: locale, p_signer_name: name, p_consent: true,
    });
    if (writeError) return failure(503);
    return Response.json(await loadClientAgreement(client, user.id, locale, true), { headers });
  } catch { return failure(503); }
}
