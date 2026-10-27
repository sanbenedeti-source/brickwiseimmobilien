import { randomUUID, createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { isAdminUser } from "@/app/lib/admin";
import { detectKycFile, KYC_MAX_BYTES, KYC_MIN_BYTES } from "@/app/lib/client-finance";

const headers = { "Cache-Control": "private, no-store" };
const documentTypes = ["passport", "id_card", "driving_licence"];
const extensions = ["pdf", "jpg", "png"];
const uuid = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;
function reply(status: number, body: Record<string, unknown>) { return Response.json(body, { status, headers }); }

/**
 * Two steps, because a serverless request body cannot carry two 10 MB documents:
 * "start" issues one-time signed upload URLs into the private bucket (the browser uploads
 * directly), and "complete" re-reads both files, checks their real type, size and checksum,
 * then records the submission. Files that fail the checks are deleted.
 */
export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) return reply(403, { result: "error" });
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") return reply(415, { result: "error" });
  try {
    const client = await createClient();
    const { data: { user }, error } = await client.auth.getUser();
    if (error || !user) return reply(401, { result: "error" });
    if (!user.email_confirmed_at || isAdminUser(user)) return reply(403, { result: "error" });
    const text = await request.text();
    if (text.length > 2000) return reply(413, { result: "error" });
    const body = JSON.parse(text) as Record<string, unknown>;
    const identityExt = String(body.identityExt || ""), addressExt = String(body.addressExt || "");
    if (!documentTypes.includes(String(body.documentType)) || !extensions.includes(identityExt) || !extensions.includes(addressExt)) return reply(422, { result: "error" });

    const bucket = createServiceClient().storage.from("client-kyc");
    if (body.action === "start") {
      const id = randomUUID();
      const paths = { identity: `${user.id}/${id}-identity.${identityExt}`, address: `${user.id}/${id}-address.${addressExt}` };
      const signed = await Promise.all(Object.values(paths).map((path) => bucket.createSignedUploadUrl(path)));
      if (signed.some((item) => item.error || !item.data)) return reply(503, { result: "error" });
      return reply(200, { result: "ready", id, uploads: signed.map((item) => ({ path: item.data!.path, token: item.data!.token })) });
    }

    if (body.action !== "complete" || typeof body.id !== "string" || !uuid.test(body.id)) return reply(422, { result: "error" });
    const id = body.id;
    const paths = [`${user.id}/${id}-identity.${identityExt}`, `${user.id}/${id}-address.${addressExt}`];
    const cleanup = () => bucket.remove(paths).catch(() => undefined);
    const files = await Promise.all(paths.map(async (path) => {
      const { data, error: downloadError } = await bucket.download(path);
      if (downloadError || !data || data.size < KYC_MIN_BYTES || data.size > KYC_MAX_BYTES) return null;
      const bytes = new Uint8Array(await data.arrayBuffer());
      const type = detectKycFile(bytes);
      return type && path.endsWith(`.${type.extension}`) ? createHash("sha256").update(bytes).digest("hex") : null;
    }));
    if (files.some((hash) => !hash)) { await cleanup(); return reply(422, { result: "error" }); }
    const { error: recordError } = await createServiceClient().rpc("submit_kyc", {
      p_id: id, p_user_id: user.id, p_document_type: String(body.documentType),
      p_identity_path: paths[0], p_identity_sha256: files[0], p_address_path: paths[1], p_address_sha256: files[1],
    });
    if (recordError) { await cleanup(); return reply(recordError.message?.includes("KYC_ALREADY") ? 409 : 503, { result: "error" }); }
    revalidatePath("/dashboard", "layout");
    revalidatePath("/admin/kyc");
    return reply(200, { result: "saved" });
  } catch { return reply(503, { result: "error" }); }
}
