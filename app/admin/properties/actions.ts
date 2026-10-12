"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdminUser } from "@/app/lib/admin";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { contentLocales, readRequiredTranslation } from "@/app/lib/content-translations";
import { writeAdminMutation } from "@/app/lib/admin-audit";
import { getExternalPropertyBySlug } from "@/app/lib/external-properties";
import { parseEuroAmount } from "@/app/api/properties/import/euro-amount";

function createSlug(title: string) {
  const baseSlug = title
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `${baseSlug}-${Date.now()}`;
}

export async function createProperty(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    console.error("Authentication error:", userError.message);
    return;
  }

  if (!isAdminUser(user)) {
    console.error("You are not signed in as an administrator.");
    return;
  }

  let translations;
  try {
    translations = contentLocales.map((locale) => readRequiredTranslation(formData, locale));
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Property translations are incomplete.");
    redirect("/admin/properties?status=invalid");
  }
  const english = translations.find((item) => item.locale === "en")!;
  const title = english.title;
  const city = String(formData.get("city") || "").trim();
  const address = String(formData.get("address") || "").trim();
  const price = parseEuroAmount(formData.get("price"));
  const area = Number(formData.get("area") || 0);
  const rooms = Number(formData.get("rooms") || 0);
  const description = english.description;
  const image_url = String(formData.get("image_url") || "").trim();
  const status = String(formData.get("status") || "active").trim();

  if (!title || !city || !address || price === null || price <= 0 || !Number.isFinite(area) || area < 0 || !Number.isFinite(rooms) || rooms < 0 || !["active", "draft"].includes(status)) {
    redirect("/admin/properties?status=invalid");
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!serviceKey || !url) redirect("/admin/properties?status=error");
  const admin = createServiceClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  const slug = createSlug(title);

  const { error } = await writeAdminMutation(admin, { actor: user!, action: "property.create", targetType: "property", targetId: slug, details: { title, city, price, currency: "EUR", status } }, [
    { table: "properties", operation: "insert", data: { title, slug, city, address, price, area, rooms, description, image_url, status: "draft" } },
    ...translations.map(translation => ({ table: "property_translations", operation: "upsert" as const, data: { property_slug: slug, ...translation } })),
    ...(status === "active" ? [{ table: "properties", operation: "update" as const, data: { status }, match: { slug } }] : []),
  ]);
  if (error) redirect("/admin/properties?status=error");

  revalidatePath("/admin/properties");
  revalidatePath("/properties");
  redirect("/admin/properties?status=saved");
}

export async function updateShareSettings(formData: FormData) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !isAdminUser(user)) redirect("/admin");

  const propertySlug = String(formData.get("property_slug") || "").trim();
  const readInteger = (name: string, minimum: number) => {
    const value = formData.get(name);
    if (typeof value !== "string" || !/^(?:-1|0|[1-9]\d*)$/.test(value)) return null;
    const number = Number(value);
    return Number.isSafeInteger(number) && number >= minimum ? number : null;
  };
  const totalShares = readInteger("total_shares", 1);
  const blockedShares = readInteger("blocked_shares", 0);
  // A missing version is never interpreted as zero: old forms must reload.
  const expectedVersion = readInteger("expected_version", -1);
  const resultPath = (status: string) => `/admin/properties?status=${status}&property=${encodeURIComponent(propertySlug)}#share-availability`;
  if (!propertySlug || totalShares === null || blockedShares === null || expectedVersion === null || totalShares > 2147483647 || blockedShares > totalShares) {
    redirect(resultPath("shares-invalid"));
  }
  const listing = getExternalPropertyBySlug(propertySlug);
  if (listing && (totalShares !== (listing.totalShares ?? Math.floor(listing.price / listing.sharePrice)) || blockedShares < (listing.blockedShares ?? 0))) {
    redirect(resultPath("shares-invalid"));
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!serviceKey || !url) redirect(resultPath("shares-error"));
  const admin = createServiceClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  // The database locks the row, compares the version, protects owned shares and
  // writes the admin audit event in the same transaction as this change.
  let error: { message: string } | null;
  try {
    ({ error } = await admin.rpc("update_share_settings_atomic", {
      p_actor: user!.id,
      p_property_slug: propertySlug,
      p_total_shares: totalShares,
      p_blocked_shares: blockedShares,
      p_expected_version: expectedVersion,
      p_minimum_blocked_shares: listing?.blockedShares ?? 0,
    }));
  } catch {
    redirect(resultPath("shares-error"));
  }
  if (error) {
    const status = error.message === "share_settings_stale" ? "shares-stale"
      : error.message === "share_settings_below_owned" ? "shares-owned" : "shares-error";
    // Refresh stale forms with current values without retrying their old write.
    revalidatePath("/admin/properties");
    redirect(resultPath(status));
  }
  revalidatePath("/admin/properties");
  revalidatePath("/properties");
  revalidatePath(`/properties/${propertySlug}`);
  revalidatePath("/dashboard");
  revalidatePath("/");
  revalidatePath("/admin/profits");
  redirect(resultPath("shares-saved"));
}
