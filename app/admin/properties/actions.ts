"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hasAdminSession } from "@/app/lib/admin-session";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { contentLocales, readRequiredTranslation } from "@/app/lib/content-translations";
import { writeAdminMutation } from "@/app/lib/admin-audit";
import { getExternalPropertyBySlug } from "@/app/lib/external-properties";
import { INVESTMENT_TIERS } from "@/app/lib/investment-policy";
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

  if (!(await hasAdminSession(supabase, user))) {
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
  // Investment fields: with rent and share price the property can be bought in shares in the client panel.
  const monthlyRent = formData.get("monthly_rent") ? parseEuroAmount(formData.get("monthly_rent")) : null;
  const monthlyExpenses = formData.get("monthly_expenses") ? parseEuroAmount(formData.get("monthly_expenses")) : 0;
  const sharePrice = formData.get("share_price") ? parseEuroAmount(formData.get("share_price")) : null;
  const monthlyValueGrowth = formData.get("monthly_value_growth") ? parseEuroAmount(formData.get("monthly_value_growth")) : null;
  const constructionStatus = String(formData.get("construction_status") || "completed");
  const imageUrls = String(formData.get("image_urls") || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const httpsUrl = (value: string) => { try { return new URL(value).protocol === "https:"; } catch { return false; } };

  if (!title || !city || !address || price === null || price <= 0 || !Number.isFinite(area) || area < 0 || !Number.isFinite(rooms) || rooms < 0 || !["active", "draft"].includes(status)
    || (formData.get("monthly_rent") && (monthlyRent === null || monthlyRent < 0)) || monthlyExpenses === null || monthlyExpenses < 0
    || (formData.get("share_price") && (sharePrice === null || sharePrice <= 0 || sharePrice > price))
    || (formData.get("monthly_value_growth") && (monthlyValueGrowth === null || monthlyValueGrowth < 0))
    || !["completed", "under_construction", "upcoming"].includes(constructionStatus)
    || (image_url && !httpsUrl(image_url) && !image_url.startsWith("/")) || imageUrls.length > 12 || imageUrls.some((url) => !httpsUrl(url))) {
    redirect("/admin/properties?status=invalid");
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!serviceKey || !url) redirect("/admin/properties?status=error");
  const admin = createServiceClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  const slug = createSlug(title);

  const { error } = await writeAdminMutation(admin, { actor: user!, action: "property.create", targetType: "property", targetId: slug, details: { title, city, price, currency: "EUR", status } }, [
    { table: "properties", operation: "insert", data: { title, slug, city, address, price, area, rooms, description, image_url: image_url || imageUrls[0] || "", status: "draft",
      monthly_rent: monthlyRent, monthly_expenses: monthlyExpenses, share_price: sharePrice, monthly_value_growth: monthlyValueGrowth, image_urls: imageUrls, construction_status: constructionStatus } },
    ...translations.map(translation => ({ table: "property_translations", operation: "upsert" as const, data: { property_slug: slug, ...translation } })),
    ...(status === "active" ? [{ table: "properties", operation: "update" as const, data: { status }, match: { slug } }] : []),
  ]);
  if (error) redirect("/admin/properties?status=error");

  // Shares become available for purchase: total = price / share price, none sold yet (audited by the database).
  if (sharePrice) {
    const { error: sharesError } = await admin.rpc("update_share_settings_atomic", {
      p_actor: user!.id, p_property_slug: slug, p_total_shares: Math.max(1, Math.floor(price / sharePrice)),
      p_blocked_shares: 0, p_expected_version: -1, p_minimum_blocked_shares: 0,
    });
    if (sharesError) console.error("Share availability could not be created:", sharesError.message);
  }

  revalidatePath("/admin/properties");
  revalidatePath("/properties");
  revalidatePath("/dashboard", "layout");
  redirect("/admin/properties?status=saved");
}

/** Sales settings of an admin-added property. Upcoming keeps it visible without purchases; completed or
 * under construction with a monthly rent and a share price opens it for purchase. Once shares are sold,
 * the price and the share price are locked so existing holdings keep their value. */
export async function updatePropertySale(formData: FormData) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !(await hasAdminSession(supabase, user))) redirect("/admin");

  const propertySlug = String(formData.get("property_slug") || "").trim();
  const resultPath = (status: string) => `/admin/properties?status=${status}&property=${encodeURIComponent(propertySlug)}#sales-status`;
  const price = parseEuroAmount(formData.get("price"));
  const monthlyRent = formData.get("monthly_rent") ? parseEuroAmount(formData.get("monthly_rent")) : null;
  const monthlyExpenses = formData.get("monthly_expenses") ? parseEuroAmount(formData.get("monthly_expenses")) : 0;
  const sharePrice = formData.get("share_price") ? parseEuroAmount(formData.get("share_price")) : null;
  const monthlyValueGrowth = formData.get("monthly_value_growth") ? parseEuroAmount(formData.get("monthly_value_growth")) : null;
  const constructionStatus = String(formData.get("construction_status") || "");
  const status = String(formData.get("status") || "");
  const investmentTier = String(formData.get("investment_tier") || "standard");
  if (!propertySlug || getExternalPropertyBySlug(propertySlug) || price === null || price <= 0
    || (formData.get("monthly_rent") && (monthlyRent === null || monthlyRent < 0)) || monthlyExpenses === null || monthlyExpenses < 0
    || (formData.get("share_price") && (sharePrice === null || sharePrice <= 0 || sharePrice > price))
    || (formData.get("monthly_value_growth") && (monthlyValueGrowth === null || monthlyValueGrowth < 0))
    || !["completed", "under_construction", "upcoming"].includes(constructionStatus) || !["active", "draft"].includes(status)
    || !(INVESTMENT_TIERS as readonly string[]).includes(investmentTier)) {
    redirect(resultPath("sale-invalid"));
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!serviceKey || !url) redirect(resultPath("sale-error"));
  const admin = createServiceClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const [{ data: current, error: readError }, { data: settings, error: settingsError }] = await Promise.all([
    admin.from("properties").select("price,share_price").eq("slug", propertySlug).maybeSingle(),
    admin.from("property_share_settings").select("blocked_shares,availability_version").eq("property_slug", propertySlug).maybeSingle(),
  ]);
  if (readError || settingsError) redirect(resultPath("sale-error"));
  if (!current) redirect(resultPath("sale-invalid"));
  const pricingChanged = Number(current.price) !== price || (current.share_price === null ? null : Number(current.share_price)) !== sharePrice;
  if (pricingChanged && Number(settings?.blocked_shares || 0) > 0) redirect(resultPath("sale-locked"));

  const { error } = await writeAdminMutation(admin, { actor: user!, action: "property.sale_settings", targetType: "property", targetId: propertySlug, details: { construction_status: constructionStatus, status, price, currency: "EUR", monthly_rent: monthlyRent, share_price: sharePrice, investment_tier: investmentTier } }, [
    { table: "properties", operation: "update", data: { price, monthly_rent: monthlyRent, monthly_expenses: monthlyExpenses, share_price: sharePrice, monthly_value_growth: monthlyValueGrowth, construction_status: constructionStatus, status, investment_tier: investmentTier }, match: { slug: propertySlug } },
  ]);
  if (error) redirect(resultPath("sale-error"));

  // Shares follow the price and the share price while none are sold (audited by the database).
  if (sharePrice && (!settings || pricingChanged)) {
    const { error: sharesError } = await admin.rpc("update_share_settings_atomic", {
      p_actor: user!.id, p_property_slug: propertySlug, p_total_shares: Math.max(1, Math.floor(price! / sharePrice)),
      p_blocked_shares: 0, p_expected_version: settings?.availability_version ?? -1, p_minimum_blocked_shares: 0,
    });
    if (sharesError) {
      console.error("Share availability could not be updated:", sharesError.message);
      revalidatePath("/admin/properties");
      redirect(resultPath("sale-error"));
    }
  }

  revalidatePath("/admin/properties");
  revalidatePath("/properties");
  revalidatePath(`/properties/${propertySlug}`);
  revalidatePath("/dashboard", "layout");
  revalidatePath("/");
  redirect(resultPath("sale-saved"));
}

/** Sale status of a catalogue listing shown on the website: Upcoming closes it for purchase,
 * Completed or Under construction opens it. Its price, rent and share price stay as documented. */
export async function updateCatalogueSaleStatus(formData: FormData) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !(await hasAdminSession(supabase, user))) redirect("/admin");

  const propertySlug = String(formData.get("property_slug") || "").trim();
  const constructionStatus = String(formData.get("construction_status") || "");
  const investmentTier = String(formData.get("investment_tier") || "standard");
  const resultPath = (status: string) => `/admin/properties?status=${status}&property=${encodeURIComponent(propertySlug)}#sales-status`;
  const listing = getExternalPropertyBySlug(propertySlug);
  if (!listing || listing.listed === false || !["completed", "under_construction", "upcoming"].includes(constructionStatus)
    || !(INVESTMENT_TIERS as readonly string[]).includes(investmentTier)) redirect(resultPath("sale-invalid"));

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!serviceKey || !url) redirect(resultPath("sale-error"));
  const admin = createServiceClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await writeAdminMutation(admin, { actor: user!, action: "property.sale_status", targetType: "property", targetId: propertySlug, details: { construction_status: constructionStatus, investment_tier: investmentTier } }, [
    { table: "property_sale_status", operation: "upsert", data: { property_slug: propertySlug, construction_status: constructionStatus, investment_tier: investmentTier, updated_at: new Date().toISOString(), updated_by: user!.id } },
  ]);
  if (error) redirect(resultPath("sale-error"));

  revalidatePath("/admin/properties");
  revalidatePath("/properties");
  revalidatePath(`/properties/${propertySlug}`);
  revalidatePath("/dashboard", "layout");
  revalidatePath("/");
  redirect(resultPath("sale-saved"));
}

export async function updateShareSettings(formData: FormData) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !(await hasAdminSession(supabase, user))) redirect("/admin");

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

/** Gallery entries are https URLs or files hosted by the site itself (/properties/...). */
function isPropertyImage(value: string) {
  if (/^\/(?!\/)[\w\-./]+$/.test(value)) return !value.includes("..");
  try { return new URL(value).protocol === "https:"; } catch { return false; }
}

/** Details of an admin-added property: texts in every language, address, size and photos. Price, rent,
 * shares, tier and publication stay under Sales status; the slug never changes so holdings keep their link. */
export async function updatePropertyDetails(formData: FormData) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !(await hasAdminSession(supabase, user))) redirect("/admin");

  const propertySlug = String(formData.get("property_slug") || "").trim();
  const resultPath = (status: string) => `/admin/properties/${encodeURIComponent(propertySlug)}/edit?status=${status}`;
  if (!propertySlug || getExternalPropertyBySlug(propertySlug)) redirect("/admin/properties");

  let translations;
  try {
    translations = contentLocales.map((locale) => readRequiredTranslation(formData, locale));
  } catch {
    redirect(resultPath("invalid"));
  }
  const english = translations.find((item) => item.locale === "en")!;
  const city = String(formData.get("city") || "").trim();
  const address = String(formData.get("address") || "").trim();
  const count = (name: string) => formData.get(name) === null || formData.get(name) === "" ? null : Number(formData.get(name));
  const area = count("area"), rooms = count("rooms"), bedrooms = count("bedrooms"), bathrooms = count("bathrooms");
  const coverImage = String(formData.get("image_url") || "").trim();
  const imageUrls = String(formData.get("image_urls") || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const validCount = (value: number | null, whole = false) => value === null || (Number.isFinite(value) && value >= 0 && value <= 100000 && (!whole || Number.isInteger(value)));
  if (!city || !address || city.length > 120 || address.length > 300
    || !validCount(area) || !validCount(rooms) || !validCount(bedrooms, true) || !validCount(bathrooms, true)
    || (coverImage && !isPropertyImage(coverImage)) || imageUrls.length > 12 || imageUrls.some((url) => !isPropertyImage(url))) {
    redirect(resultPath("invalid"));
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!serviceKey || !url) redirect(resultPath("error"));
  const admin = createServiceClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: current, error: readError } = await admin.from("properties").select("slug").eq("slug", propertySlug).maybeSingle();
  if (readError) redirect(resultPath("error"));
  if (!current) redirect("/admin/properties");

  const { error } = await writeAdminMutation(admin, { actor: user!, action: "property.update", targetType: "property", targetId: propertySlug, details: { title: english.title, city, images: imageUrls.length } }, [
    { table: "properties", operation: "update", match: { slug: propertySlug }, data: {
      title: english.title, description: english.description, property_type: english.property_type, city, address,
      area, rooms, bedrooms, bathrooms, image_url: coverImage || imageUrls[0] || "", image_urls: imageUrls,
    } },
    ...translations.map((translation) => ({ table: "property_translations", operation: "upsert" as const, data: { property_slug: propertySlug, ...translation } })),
  ]);
  if (error) redirect(resultPath("error"));

  revalidatePath("/admin/properties");
  revalidatePath(`/admin/properties/${propertySlug}/edit`);
  revalidatePath("/properties");
  revalidatePath(`/properties/${propertySlug}`);
  revalidatePath("/dashboard", "layout");
  revalidatePath("/");
  redirect(resultPath("saved"));
}
