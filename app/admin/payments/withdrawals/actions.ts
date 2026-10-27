"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { hasAdminSession } from "@/app/lib/admin-session";

export type ReviewState = { result: "" | "saved" | "error" };

export async function reviewWithdrawal(_previous: ReviewState, form: FormData): Promise<ReviewState> {
  try {
    const client = await createClient();
    const { data: { user }, error } = await client.auth.getUser();
    if (error || !(await hasAdminSession(client, user))) return { result: "error" };
    const id = String(form.get("id") || ""), decision = String(form.get("decision") || "");
    const note = String(form.get("note") || "").trim(), reference = String(form.get("reference") || "").trim();
    const paid = decision === "paid";
    if (!/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(id) || !["paid", "rejected"].includes(decision)
      || note.length < 3 || note.length > 1000 || (paid && (reference.length < 4 || reference.length > 200))) return { result: "error" };
    const { error: reviewError } = await client.rpc("review_withdrawal", { p_id: id, p_paid: paid, p_reference: paid ? reference : null, p_note: note });
    if (reviewError) return { result: "error" };
    revalidatePath("/admin/payments/withdrawals");
    revalidatePath("/admin", "layout");
    revalidatePath("/dashboard", "layout");
    return { result: "saved" };
  } catch { return { result: "error" }; }
}
