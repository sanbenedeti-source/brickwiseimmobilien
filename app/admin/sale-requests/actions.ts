"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { hasAdminSession } from "@/app/lib/admin-session";

export type SaleReviewState = { result: "" | "saved" | "error" };
const uuid = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;

export async function updateSaleRequest(_previous: SaleReviewState, form: FormData): Promise<SaleReviewState> {
  try {
    const client = await createClient();
    const { data: { user }, error } = await client.auth.getUser();
    if (error || !(await hasAdminSession(client, user))) return { result: "error" };
    const id = String(form.get("id") || ""), status = String(form.get("decision") || ""), note = String(form.get("note") || "").trim();
    if (!uuid.test(id) || !["in_review", "completed", "cancelled"].includes(status) || note.length < 3 || note.length > 1000) return { result: "error" };
    const { error: rpcError } = await client.rpc("update_share_sale_request", { p_id: id, p_status: status, p_note: note });
    if (rpcError) return { result: "error" };
    revalidatePath("/admin/sale-requests");
    revalidatePath("/admin", "layout");
    revalidatePath("/dashboard", "layout");
    return { result: "saved" };
  } catch { return { result: "error" }; }
}
