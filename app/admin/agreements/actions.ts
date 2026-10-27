"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { hasAdminSession } from "@/app/lib/admin-session";

export type AgreementReviewState = { result: "" | "saved" | "error" };
export async function reviewAgreement(_previous: AgreementReviewState, form: FormData): Promise<AgreementReviewState> {
  try {
    const client = await createClient();
    const { data: { user }, error } = await client.auth.getUser();
    if (error || !(await hasAdminSession(client, user))) return { result: "error" };
    const id = form.get("id"), decision = form.get("decision"), note = form.get("note");
    if (typeof id !== "string" || !/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(id)
      || !["approved", "rejected"].includes(String(decision)) || typeof note !== "string"
      || note.trim().length < 3 || note.trim().length > 1000) return { result: "error" };
    const { error: reviewError } = await client.rpc("review_client_agreement", { p_id: id, p_decision: decision, p_note: note.trim() });
    if (reviewError) return { result: "error" };
    revalidatePath("/admin/agreements");
    revalidatePath("/admin");
    revalidatePath("/dashboard", "layout");
    return { result: "saved" };
  } catch { return { result: "error" }; }
}
