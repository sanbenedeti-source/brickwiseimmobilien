import { createClient } from "@/lib/supabase/server";

const headers = { "Cache-Control": "private, no-store" };

/** Latest notifications of the signed-in client (RLS limits rows to their own). */
export async function GET() {
  try {
    const client = await createClient();
    const { data: { user }, error } = await client.auth.getUser();
    if (error || !user) return Response.json({ error: "unauthorized" }, { status: 401, headers });
    const [{ data, error: listError }, { count, error: countError }] = await Promise.all([
      client.from("client_notifications").select("id,kind,payload,read_at,created_at").order("created_at", { ascending: false }).limit(20),
      client.from("client_notifications").select("id", { count: "exact", head: true }).is("read_at", null),
    ]);
    if (listError || countError) return Response.json({ error: "unavailable" }, { status: 503, headers });
    return Response.json({ items: data || [], unread: count || 0 }, { headers });
  } catch { return Response.json({ error: "unavailable" }, { status: 503, headers }); }
}

/** Marks the given notifications (or all) as read. */
export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) return Response.json({ error: "forbidden" }, { status: 403, headers });
  try {
    const client = await createClient();
    const { data: { user }, error } = await client.auth.getUser();
    if (error || !user) return Response.json({ error: "unauthorized" }, { status: 401, headers });
    const body = await request.json().catch(() => ({})) as { ids?: unknown };
    const ids = Array.isArray(body.ids) ? body.ids.filter((id): id is string => typeof id === "string" && /^[\da-f-]{36}$/i.test(id)).slice(0, 50) : null;
    const { error: markError } = await client.rpc("mark_notifications_read", { p_ids: ids });
    if (markError) return Response.json({ error: "unavailable" }, { status: 503, headers });
    return Response.json({ result: "saved" }, { headers });
  } catch { return Response.json({ error: "unavailable" }, { status: 503, headers }); }
}
