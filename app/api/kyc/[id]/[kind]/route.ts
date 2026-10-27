import { createHash } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { hasAdminSession } from "@/app/lib/admin-session";
import { detectKycFile } from "@/app/lib/client-finance";

const noStore = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" };

/** Identity documents are visible only to a fully signed-in administrator, after an integrity check. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string; kind: string }> }) {
  try {
    const { id, kind } = await params;
    if (!/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(id) || !["identity", "address"].includes(kind)) return new Response(null, { status: 404, headers: noStore });
    const client = await createClient();
    const { data: { user }, error } = await client.auth.getUser();
    if (error || !user) return new Response(null, { status: 401, headers: noStore });
    if (!(await hasAdminSession(client, user))) return new Response(null, { status: 404, headers: noStore });
    const { data: row, error: readError } = await client.from("client_kyc_submissions")
      .select("identity_path,identity_sha256,address_path,address_sha256").eq("id", id).maybeSingle();
    if (readError) return new Response(null, { status: 503, headers: noStore });
    if (!row) return new Response(null, { status: 404, headers: noStore });
    const path = kind === "identity" ? row.identity_path : row.address_path;
    const expected = kind === "identity" ? row.identity_sha256 : row.address_sha256;
    const { data, error: downloadError } = await createServiceClient().storage.from("client-kyc").download(path);
    if (downloadError || !data) return new Response(null, { status: 503, headers: noStore });
    const bytes = new Uint8Array(await data.arrayBuffer());
    const type = detectKycFile(bytes);
    if (!type || createHash("sha256").update(bytes).digest("hex") !== expected) return new Response(null, { status: 503, headers: noStore });
    return new Response(bytes as BodyInit, { headers: {
      ...noStore, "Content-Type": type.mime, "Content-Disposition": `inline; filename="kyc-${kind}-${id.slice(0, 8)}.${type.extension}"`,
      "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox",
    } });
  } catch { return new Response(null, { status: 503, headers: noStore }); }
}
