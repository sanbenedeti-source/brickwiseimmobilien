"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { hasAdminSession } from "@/app/lib/admin-session";

export type DistributionState = { result: "" | "saved" | "error" };
const isoDate = /^\d{4}-\d{2}-\d{2}$/;
const validDate = (value: string) => isoDate.test(value) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;

/** Records the net rent of one period; the database splits it across current holders by shares. */
export async function recordDistribution(_previous: DistributionState, form: FormData): Promise<DistributionState> {
  try {
    const client = await createClient();
    const { data: { user }, error } = await client.auth.getUser();
    if (error || !(await hasAdminSession(client, user))) return { result: "error" };
    const slug = String(form.get("property_slug") || ""), start = String(form.get("period_start") || ""), end = String(form.get("period_end") || "");
    const amount = String(form.get("net_amount") || "").replace(",", ".").trim(), note = String(form.get("note") || "").trim();
    const today = new Date().toISOString().slice(0, 10);
    if (!/^[a-z0-9-]{1,120}$/.test(slug) || !validDate(start) || !validDate(end) || end < start || end > today
      || !/^\d+(?:\.\d{1,2})?$/.test(amount) || Number(amount) <= 0 || Number(amount) > 100_000_000
      || note.length > 1000 || form.get("confirm") !== "yes") return { result: "error" };
    const { error: rpcError } = await client.rpc("record_property_distribution", { p_property_slug: slug, p_period_start: start, p_period_end: end, p_net_amount: amount, p_note: note || null });
    if (rpcError) return { result: "error" };
    revalidatePath("/admin/distributions");
    revalidatePath("/admin/audit");
    revalidatePath("/dashboard", "layout");
    return { result: "saved" };
  } catch { return { result: "error" }; }
}
