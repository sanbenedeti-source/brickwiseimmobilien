"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { hasAdminSession } from "@/app/lib/admin-session";
import { createClient } from "@/lib/supabase/server";
import { writeAdminMutation } from "@/app/lib/admin-audit";
import { findProperty } from "@/app/lib/property-registry";
import { getPropertyShareSupply } from "@/app/lib/property-financials";

export async function updateProfitSettings(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!(await hasAdminSession(supabase, user))) redirect("/admin");

  const propertySlug = String(formData.get("property_slug") || "").trim();
  // The property page sends its own path so the admin returns to it; any other value is ignored.
  const propertyPage = `/admin/properties/${encodeURIComponent(propertySlug)}`;
  const fromPropertyPage = Boolean(propertySlug) && formData.get("return_to") === propertyPage;
  const back = (status: string) => fromPropertyPage ? `${propertyPage}?status=earnings-${status}#income` : status === "saved" ? `/admin/profits?status=saved&property=${encodeURIComponent(propertySlug)}` : `/admin/profits?status=${status}`;
  const property = await findProperty(propertySlug);
  const profitStartDate = String(formData.get("profit_start_date") || "").trim();
  const profitActive = formData.get("profit_active") === "on";
  const validDate = !profitStartDate || (/^\d{4}-\d{2}-\d{2}$/.test(profitStartDate) && Number.isFinite(Date.parse(`${profitStartDate}T00:00:00Z`)) && new Date(`${profitStartDate}T00:00:00Z`).toISOString().slice(0, 10) === profitStartDate);
  if (!property || !validDate) redirect(back("invalid"));

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) redirect(back("error"));
  const admin = createServiceClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: existing, error: readError } = await admin.from("property_share_settings").select("property_slug").eq("property_slug", propertySlug).maybeSingle();
  if (readError) redirect(back("error"));
  const statusUpdate = { profit_active: profitActive, profit_start_date: profitStartDate || null, updated_at: new Date().toISOString() };
  const supply = getPropertyShareSupply(property);
  // Preserve both existing reservations and the historical wallet rate. The
  // listing's annual target is authoritative and is never written to that rate.
  const { error } = await writeAdminMutation(admin, { actor: user!, action: "profit_status.update", targetType: "property", targetId: propertySlug, details: { profitActive, profitStartDate: profitStartDate || null } }, [existing
    ? { table: "property_share_settings", operation: "update", data: statusUpdate, match: { property_slug: propertySlug } }
    : { table: "property_share_settings", operation: "insert", data: { property_slug: propertySlug, total_shares: supply.total, blocked_shares: supply.blocked, ...statusUpdate } }]);
  if (error) {
    console.error("Profit settings update failed:", error.message);
    redirect(back("error"));
  }
  revalidatePath("/admin/profits");
  revalidatePath(propertyPage);
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/income");
  revalidatePath("/properties");
  revalidatePath(`/properties/${propertySlug}`);
  redirect(back("saved"));
}
