import { createHash, timingSafeEqual } from "node:crypto";
import { writeAdminMutation } from "@/app/lib/admin-audit";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { NextRequest } from "next/server";
import { hasAdminSession } from "@/app/lib/admin-session";
import { createClient } from "@/lib/supabase/server";
import { isEuroCurrency, parseEuroAmount } from "./euro-amount";
import { getRequestLocale } from "@/app/lib/i18n";
import { apiCopy } from "@/app/lib/api-copy";

export const dynamic = "force-dynamic";

type ImportedPhoto = {
  url?: unknown;
  src?: unknown;
};

type ImportedProperty = {
  title?: unknown;
  slug?: unknown;
  description?: unknown;
  price?: unknown;
  currency?: unknown;
  city?: unknown;
  address?: unknown;
  property_type?: unknown;
  propertyType?: unknown;
  bedrooms?: unknown;
  bathrooms?: unknown;
  area?: unknown;
  rooms?: unknown;
  image_url?: unknown;
  imageUrl?: unknown;
  photos?: unknown;
  status?: unknown;
};

type PropertyInsert = {
  title: string;
  slug: string;
  description: string | null;
  price: number;
  city: string;
  address: string | null;
  property_type: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  area: number | null;
  rooms: number | null;
  image_url: string | null;
  status: string;
};

function createSlug(title: string, fallback?: string) {
  const source = fallback || title;
  const slug = source
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || `property-${Date.now()}`;
}

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function asNullableString(value: unknown) {
  const stringValue = asString(value);
  return stringValue || null;
}

function asNumber(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;

  const normalized = value.trim();
  if (!/^-?\d+(?:[.,]\d+)?$/.test(normalized)) return null;
  const numberValue = Number(normalized.replace(",", "."));

  return Number.isFinite(numberValue) ? numberValue : null;
}

function getFirstPhotoUrl(value: ImportedProperty) {
  const directUrl = asString(value.image_url) || asString(value.imageUrl);

  if (directUrl) {
    return directUrl;
  }

  if (!Array.isArray(value.photos)) {
    return null;
  }

  const firstPhoto = value.photos.find(
    (photo): photo is ImportedPhoto =>
      Boolean(photo) && typeof photo === "object"
  );

  return asString(firstPhoto?.url) || asString(firstPhoto?.src) || null;
}

function normalizeImportedProperty(value: unknown, index: number, copy: typeof apiCopy.en) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { errors: [`${copy.property} ${index + 1}: ${copy.objectRequired}`] };
  }
  const item = value as ImportedProperty;
  const title = asString(item.title);
  const city = asString(item.city);
  const price = parseEuroAmount(item.price);

  const errors: string[] = [];

  if (!title) errors.push(copy.titleRequired);
  if (!city) errors.push(copy.cityRequired);
  if (price === null || price <= 0) errors.push(copy.priceRequired);
  if (!isEuroCurrency(item.currency)) errors.push(copy.euroRequired);

  if (errors.length > 0) {
    return { errors: errors.map((error) => `${copy.property} ${index + 1}: ${error}`) };
  }

  const validPrice = price as number;
  const propertyType =
    asNullableString(item.property_type) || asNullableString(item.propertyType);
  const slug = createSlug(title, asString(item.slug));

  return {
    property: {
      title,
      slug,
      description: asNullableString(item.description),
      price: validPrice,
      city,
      address: asNullableString(item.address),
      property_type: propertyType,
      bedrooms: asNumber(item.bedrooms),
      bathrooms: asNumber(item.bathrooms),
      area: asNumber(item.area),
      rooms: asNumber(item.rooms),
      image_url: getFirstPhotoUrl(item),
      // Unknown statuses are imported as hidden drafts rather than published.
      status: !asString(item.status) ? "active" : importStatuses.has(asString(item.status)) ? asString(item.status) : "draft",
    } satisfies PropertyInsert,
  };
}

const importStatuses = new Set(["active", "available", "draft"]);

/** Constant-time comparison of equal-length digests (no timing leak of the key). */
function sameSecret(supplied: string, expected: string) {
  return timingSafeEqual(createHash("sha256").update(supplied).digest(), createHash("sha256").update(expected).digest());
}

async function getWriteClient(request: NextRequest) {
  const configuredApiKey = process.env.PROPERTY_IMPORT_API_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const requestApiKey = request.headers.get("x-api-key");

  if (configuredApiKey && serviceRoleKey && requestApiKey && sameSecret(requestApiKey, configuredApiKey)) {
    return {
      client: createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        serviceRoleKey,
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false,
          },
        }
      ),
      mode: "api-key",
      actor: null,
    };
  }

  const client = await createClient();
  const {
    data: { user },
    error,
  } = await client.auth.getUser();

  if (error || !(await hasAdminSession(client, user))) {
    return null;
  }

  if (!serviceRoleKey || !process.env.NEXT_PUBLIC_SUPABASE_URL) return null;
  const admin = createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  return { client: admin, mode: "admin-session", actor: user };
}

export async function POST(request: NextRequest) {
  const copy = apiCopy[getRequestLocale(request)];
  const writeClient = await getWriteClient(request);

  if (!writeClient) {
    return Response.json(
      {
        error: copy.adminRequired,
      },
      { status: 401 }
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: copy.invalidJson }, { status: 400 });
  }

  const rawProperties = Array.isArray(body)
    ? body
    : body && typeof body === "object" && Array.isArray((body as { properties?: unknown }).properties)
      ? (body as { properties: unknown[] }).properties
      : [body];

  const normalized = rawProperties.map((value, index) =>
    normalizeImportedProperty(value, index, copy)
  );
  const errors = normalized.flatMap((entry) => entry.errors || []);
  const properties = normalized
    .map((entry) => entry.property)
    .filter((property): property is PropertyInsert => Boolean(property));

  if (errors.length > 0) {
    return Response.json({ error: copy.invalidProperty, details: errors }, { status: 400 });
  }

  if (properties.length < 1 || properties.length > 200) return Response.json({ error: copy.invalidProperty }, { status: 400 });
  const { data, error } = await writeAdminMutation(writeClient.client, {
    actor: writeClient.actor, action: "property.import", targetType: "property_import",
    details: { mode: writeClient.mode, count: properties.length, slugs: properties.map(property => property.slug) },
  }, properties.map(property => ({ table: "properties", operation: "upsert", data: property })));
  if (error) return Response.json({ error: copy.propertySaveFailed, code: error.code }, { status: 500 });
  const saved = data as PropertyInsert[];

  revalidatePath("/properties");
  revalidatePath("/admin/properties");
  for (const property of saved) {
    revalidatePath(`/properties/${property.slug}`);
  }

  return Response.json({
    mode: writeClient.mode,
    savedCount: saved.length,
    saved: saved.map((property) => ({ ...property, currency: "EUR" })),
    note: copy.importNote,
  });
}
