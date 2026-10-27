"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { hasAdminSession } from "@/app/lib/admin-session";

export type ProfitState = { result: "" | "saved" | "error" | "amount" | "holding" };
const uuid = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;

/** Credits one client's wallet with the profit of a property they hold. The same request key never
 * pays twice, so a double submit or a retry returns the first payout. */
export async function payClientProfit(_previous: ProfitState, form: FormData): Promise<ProfitState> {
  try {
    const client = await createClient();
    const { data: { user }, error } = await client.auth.getUser();
    if (error || !(await hasAdminSession(client, user))) return { result: "error" };
    const userId = String(form.get("user_id") || ""), slug = String(form.get("property_slug") || ""), key = String(form.get("client_key") || "");
    const amount = String(form.get("amount") || "").replace(",", ".").trim(), note = String(form.get("note") || "").trim();
    if (!uuid.test(userId) || !uuid.test(key) || !/^[a-z0-9-]{1,120}$/.test(slug) || note.length > 300 || /[\u0000-\u001f\u007f]/.test(note) || form.get("confirm") !== "yes") return { result: "error" };
    if (!/^\d+(?:\.\d{1,2})?$/.test(amount) || Number(amount) <= 0 || Number(amount) > 1_000_000) return { result: "amount" };
    const { error: payError } = await client.rpc("pay_client_profit", { p_user_id: userId, p_property_slug: slug, p_amount: amount, p_note: note || null, p_client_key: key });
    if (payError) return { result: payError.message?.includes("NO_HOLDING") ? "holding" : "error" };
    revalidatePath(`/admin/customers/${userId}`);
    revalidatePath("/admin/audit");
    revalidatePath("/dashboard", "layout");
    return { result: "saved" };
  } catch { return { result: "error" }; }
}
