import { createClient } from "@supabase/supabase-js";

/** Service-role client for private storage and service-only RPCs. Call it only after the
 * request has been authorised; it bypasses row-level security. */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Service storage is not configured");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}
