import { createHmac } from "node:crypto";
import { createServiceClient } from "@/lib/supabase/service";
import { normalizeLookup } from "@/app/lib/agent-verification";

const headers = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" };
type LookupRow = { is_found: boolean; is_active: boolean; agent_code: string | null; agent_name: string | null; agent_title: string | null; agent_languages: string[] | null; agent_email: string | null; agent_phone: string | null };

/** Public check whether a code, email or phone belongs to a Brickwise agent, rate-limited per IP bucket. */
export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) return Response.json({ result: "error" }, { status: 403, headers });
  const body = await request.json().catch(() => ({})) as { kind?: unknown; value?: unknown };
  const lookup = normalizeLookup(body.kind, body.value);
  if (!lookup) return Response.json({ result: "invalid" }, { status: 400, headers });
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return Response.json({ result: "error" }, { status: 503, headers });
  const ip = (request.headers.get("x-forwarded-for") || "").split(",")[0].trim() || request.headers.get("x-real-ip") || "unknown";
  // Rate-limit bucket: a keyed hash of the IP reduced to 4096 values, never the address itself.
  const bucket = parseInt(createHmac("sha256", key).update(`agent-lookup:${ip}`).digest("hex").slice(0, 3), 16);
  try {
    const { data, error } = await createServiceClient().rpc("lookup_agent", { p_kind: lookup.kind, p_value: lookup.value, p_bucket: bucket });
    if (error) return Response.json({ result: error.message?.includes("RATE_LIMIT") ? "rateLimited" : "error" }, { status: error.message?.includes("RATE_LIMIT") ? 429 : 503, headers });
    const row = (Array.isArray(data) ? data[0] : data) as LookupRow | undefined;
    if (!row?.is_found) return Response.json({ result: "notFound" }, { headers });
    if (!row.is_active) return Response.json({ result: "inactive", agent: { name: row.agent_name } }, { headers });
    return Response.json({ result: "verified", agent: { code: row.agent_code, name: row.agent_name, title: row.agent_title, languages: row.agent_languages || [], email: row.agent_email, phone: row.agent_phone } }, { headers });
  } catch { return Response.json({ result: "error" }, { status: 503, headers }); }
}
