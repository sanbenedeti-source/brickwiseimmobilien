import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { buildCustomerId, type CustomerRecord } from "../lib/customer-store";
import { isAdminUser } from "../lib/admin";

/** Registered client accounts (admins excluded), read with the service role. */
export async function getRegisteredAuthCustomers() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!serviceRoleKey || !supabaseUrl) {
    return {
      customers: [] as CustomerRecord[],
      enabled: false,
    };
  }

  const adminSupabase = createSupabaseClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { data, error } = await adminSupabase.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });

  if (error) {
    console.error("Auth users error:", error.message);
    return {
      customers: [] as CustomerRecord[],
      enabled: true,
    };
  }

  return {
    customers: data.users
      .filter((authUser) => Boolean(authUser.email) && !isAdminUser(authUser))
      .map((authUser) => ({
        id: authUser.id || buildCustomerId(authUser.email || ""),
        fullName:
          String(authUser.user_metadata?.full_name || "").trim() ||
          authUser.email?.split("@")[0] ||
          "Unknown customer",
        email: authUser.email || "",
        phone: authUser.phone || undefined,
        source: "Registration" as const,
        status: authUser.email_confirmed_at
          ? ("Active" as const)
          : ("New" as const),
        createdAt: authUser.created_at || new Date().toISOString(),
      })),
    enabled: true,
  };
}
