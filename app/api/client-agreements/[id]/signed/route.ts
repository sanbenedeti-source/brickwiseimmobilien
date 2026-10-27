import { createClient } from "@/lib/supabase/server";
import { isAdminUser } from "@/app/lib/admin";
import { hasAdminSession } from "@/app/lib/admin-session";
import { readSignedAgreement } from "@/app/lib/agreement-signing";

const noStore = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" };

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const client = await createClient();
    const { data: { user }, error: authError } = await client.auth.getUser();
    if (authError || !user) return new Response(null, { status: 401, headers: noStore });
    const { id } = await params;
    if (!/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(id)) return new Response(null, { status: 404, headers: noStore });
    // RLS returns the record only to its owner or a trusted administrator.
    const { data: row, error } = await client.from("client_agreement_acceptances")
      .select("id,user_id,version,signed_pdf_path,signed_pdf_sha256").eq("id", id).maybeSingle();
    if (error) return new Response(null, { status: 503, headers: noStore });
    if (!row || !row.signed_pdf_path || !row.signed_pdf_sha256) return new Response(null, { status: 404, headers: noStore });
    // Someone else's agreement additionally requires a fully confirmed admin session.
    if (row.user_id !== user.id && !(isAdminUser(user) && await hasAdminSession(client, user))) return new Response(null, { status: 404, headers: noStore });
    const bytes = await readSignedAgreement(row.signed_pdf_path, row.signed_pdf_sha256);
    const disposition = new URL(request.url).searchParams.get("view") === "1" ? "inline" : "attachment";
    return new Response(bytes as BodyInit, { headers: {
      ...noStore,
      "Content-Type": "application/pdf",
      "Content-Disposition": `${disposition}; filename="brickwise-agreement-${row.version}-${id.slice(0, 8)}.pdf"`,
      "X-Content-Type-Options": "nosniff",
    } });
  } catch { return new Response(null, { status: 503, headers: noStore }); }
}
