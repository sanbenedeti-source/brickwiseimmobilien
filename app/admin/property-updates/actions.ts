"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { hasAdminSession } from "@/app/lib/admin-session";

export type PublishState = { result: "" | "saved" | "error" };

/** Publishes news for one property; the database notifies every current holder. */
export async function publishPropertyUpdate(_previous: PublishState, form: FormData): Promise<PublishState> {
  try {
    const client = await createClient();
    const { data: { user }, error } = await client.auth.getUser();
    if (error || !(await hasAdminSession(client, user))) return { result: "error" };
    const slug = String(form.get("property_slug") || ""), title = String(form.get("title") || "").trim(), body = String(form.get("body") || "").trim();
    if (!/^[a-z0-9-]{1,120}$/.test(slug) || title.length < 3 || title.length > 160 || /[\u0000-\u001f\u007f]/.test(title)
      || body.length < 3 || body.length > 5000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(body)) return { result: "error" };
    const { error: rpcError } = await client.rpc("publish_property_update", { p_property_slug: slug, p_title: title, p_body: body });
    if (rpcError) return { result: "error" };
    revalidatePath("/admin/property-updates");
    revalidatePath("/admin/audit");
    revalidatePath("/dashboard", "layout");
    return { result: "saved" };
  } catch { return { result: "error" }; }
}
