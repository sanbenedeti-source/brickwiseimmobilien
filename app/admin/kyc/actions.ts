"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { hasAdminSession } from "@/app/lib/admin-session";

export type ReviewState = { result: "" | "saved" | "error" };
const uuid = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;

export async function reviewKyc(_previous: ReviewState, form: FormData): Promise<ReviewState> {
  try {
    const client = await createClient();
    const { data: { user }, error } = await client.auth.getUser();
    if (error || !(await hasAdminSession(client, user))) return { result: "error" };
    const id = String(form.get("id") || ""), decision = String(form.get("decision") || ""), note = String(form.get("note") || "").trim();
    if (!uuid.test(id) || !["approved", "rejected"].includes(decision) || note.length < 3 || note.length > 1000) return { result: "error" };
    const { error: reviewError } = await client.rpc("review_kyc", { p_id: id, p_decision: decision, p_note: note });
    if (reviewError) return { result: "error" };
    revalidatePath("/admin/kyc");
    revalidatePath("/admin", "layout");
    revalidatePath("/dashboard", "layout");
    return { result: "saved" };
  } catch { return { result: "error" }; }
}
