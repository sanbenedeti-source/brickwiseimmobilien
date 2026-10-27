import { createServiceClient } from "@/lib/supabase/service";

export type ClientIdentity = { email: string; name: string; admin: boolean };

/** Names and emails of client accounts for admin lists (one Auth admin request per page render). */
export async function getClientDirectory(): Promise<Map<string, ClientIdentity>> {
  try {
    const { data, error } = await createServiceClient().auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (error) return new Map();
    return new Map(data.users.map((user) => [user.id, {
      email: user.email || "",
      name: String(user.user_metadata?.full_name || "").trim() || user.email?.split("@")[0] || "",
      admin: user.app_metadata?.role === "admin",
    }]));
  } catch { return new Map(); }
}
