import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";
import { getCatalogueProperties } from "@/app/lib/property-registry";
import {
  hiddenManualPropertyIds,
  hiddenManualPropertySlugs,
} from "@/app/lib/external-properties";
import { getPropertyProjection, getPropertyShareSupply } from "@/app/lib/property-financials";
import { getRequestLocale, localeHtmlLang } from "@/app/lib/i18n";
import { apiCopy } from "@/app/lib/api-copy";
import { getPropertyMapLinks } from "@/app/lib/property-location";
import { getPropertyTranslations, localizeProperty } from "@/app/lib/property-localization";
import { hasAdminSession } from "@/app/lib/admin-session";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type DatabaseProperty = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  price: number | null;
  city: string | null;
  address: string | null;
  property_type: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  area: number | null;
  rooms: number | null;
  image_url: string | null;
  status: string | null;
  created_at: string | null;
};

function getPublicSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  return createSupabaseClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

async function isAdminRequest() {
  const client = await createClient();
  const { data: { user } } = await client.auth.getUser();
  return hasAdminSession(client, user);
}

export async function GET(request: NextRequest) {
  const locale = getRequestLocale(request);
  const copy = apiCopy[locale];
  const searchParams = request.nextUrl.searchParams;
  const requestedStatus = searchParams.get("status") || "active";
  // Drafts and the unfiltered list are for admins only; everyone else sees published listings.
  const status = ["active", "available"].includes(requestedStatus) || await isAdminRequest() ? requestedStatus : "active";
  const city = searchParams.get("city")?.trim() || null;
  const includeExternal = searchParams.get("includeExternal") !== "false";

  const supabase = getPublicSupabaseClient();
  let databaseProperties: DatabaseProperty[] = [];
  let shareSettings: { property_slug: string; total_shares: number; blocked_shares: number }[] = [];

  if (supabase) {
    let query = supabase
      .from("properties")
      .select("*")
      .order("created_at", { ascending: false });

    if (status !== "all") {
      query = query.in("status", status === "active" ? ["active", "available"] : [status]);
    }

    if (city) {
      query = query.ilike("city", `%${city}%`);
    }

    const { data, error } = await query;

    if (error) {
      return Response.json(
        { error: copy.propertiesLoadFailed },
        { status: 500 }
      );
    }

    databaseProperties = ((data as DatabaseProperty[] | null) || []).filter(
      (property) =>
        !hiddenManualPropertyIds.includes(property.id) &&
        !hiddenManualPropertySlugs.includes(property.slug)
    );
    const { data: settings } = await supabase.from("property_share_settings")
      .select("property_slug,total_shares,blocked_shares");
    shareSettings = settings || [];
  }

  const settingsBySlug = new Map(shareSettings.map((setting) => [setting.property_slug, setting]));
  const translations = await getPropertyTranslations(locale);
  const matchingExternal = (await getCatalogueProperties()).filter(property => property.listed !== false &&
    (status === "all" || property.status === status || (status === "active" && property.status === "available"))
    && (!city || property.city.toLowerCase().includes(city.toLowerCase()))
  );
  const properties = [
    ...(includeExternal ? matchingExternal : []),
    ...databaseProperties,
  ].map((property) => {
    const listing = { ...localizeProperty(property, translations), currency: "EUR" as const };
    const supply = getPropertyShareSupply(listing, settingsBySlug.get(property.slug));
    const projection = getPropertyProjection(listing);
    return {
      ...listing,
      totalShares: supply.total,
      blockedShares: supply.blocked,
      availableShares: supply.available,
      fundedPercent: supply.total ? supply.blocked / supply.total * 100 : 0,
      financials: { ...projection, targetPeriod: "annual" },
      map: getPropertyMapLinks(listing, locale),
    };
  });

  return Response.json({
    count: properties.length,
    properties,
  }, { headers: { "Content-Language": localeHtmlLang[locale] } });
}
