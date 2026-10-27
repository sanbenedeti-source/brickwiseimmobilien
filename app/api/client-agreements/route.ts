import { createClient } from "@/lib/supabase/server";
import { getRequestLocale, normalizeLocale } from "@/app/lib/i18n";
import { agreementVersion, loadClientAgreement } from "@/app/lib/client-agreements";
import { parseSignaturePng } from "@/app/lib/signed-agreement-pdf";
import { requestEvidence, signAgreement } from "@/app/lib/agreement-signing";

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
    if (!user.email_confirmed_at || !user.email) return failure(403);
    let body: Record<string, unknown>;
    try {
      const text = await request.text();
      // Room for the drawn signature image; everything else is a few short fields.
      if (text.length > 300_000) return failure(413);
      const parsed = JSON.parse(text);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return failure(400);
      body = parsed;
    } catch { return failure(400); }
    const locale = typeof body.locale === "string" ? normalizeLocale(body.locale) : null;
    const name = typeof body.signerName === "string" ? body.signerName.trim() : "";
    const signature = parseSignaturePng(body.signature);
    if (!locale || body.consent !== true || name.length < 2 || name.length > 120 || /[\u0000-\u001f\u007f]/.test(name) || !signature) return failure(422);
    if (body.version !== agreementVersion) return failure(409);
    // Read the current catalog before signing; the database snapshots its exact PDF and consent.
    const current = await loadClientAgreement(client, user.id, locale, true);
    if (current.acceptance) return Response.json(current, { headers });
    await signAgreement({
      userId: user.id, email: user.email, signerName: name, locale, document: current.document,
      signaturePng: signature, ...requestEvidence(request),
    });
    return Response.json(await loadClientAgreement(client, user.id, locale, true), { headers });
  } catch { return failure(503); }
}
