"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { hasAdminSession } from "@/app/lib/admin-session";
import { parseCompanyPaymentMethod } from "@/app/lib/company-payment-methods";
import { writeAdminMutation } from "@/app/lib/admin-audit";

export async function saveCompanyPaymentMethod(form: FormData) {
  const client = await createClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user || !(await hasAdminSession(client, user))) redirect("/sign-in");
  const kind = form.get("kind") === "crypto" ? "crypto" : "bank_transfer";
  const back = `/admin/payments?method=${kind}`;
  const payload = parseCompanyPaymentMethod(form);
  const id = String(form.get("id") || "");
  if (!payload || (id && !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(id))) redirect(`${back}&result=invalid`);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) redirect(`${back}&result=error`);
  const admin = createAdminClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const data = { ...payload, updated_at: new Date().toISOString() };
  const { error } = await writeAdminMutation(admin, { actor: user, action: "company_payment_method.save", targetType: "company_payment_method", targetId: id || null, details: { kind: payload.kind, active: payload.active } }, [
    { table: "company_payment_methods", operation: id ? "update" : "insert", data, ...(id ? { match: { id, kind: payload.kind } } : {}) },
  ]);
  if (error) redirect(`${back}&result=error`);
  revalidatePath("/admin/payments"); revalidatePath("/funding"); revalidatePath("/dashboard", "layout");
  redirect(`${back}&result=saved`);
}
