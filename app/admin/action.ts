"use server";

import { createClient as createServiceClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { createClient } from "../../lib/supabase/server";
import { hasAdminSession } from "../lib/admin-session";
import { writeAdminMutation } from "../lib/admin-audit";

export async function updateRequestStatus(formData: FormData) {
  const requestId = String(formData.get("request_id") || "");
  const status = String(formData.get("status") || "");

  if (!requestId || !["new", "contacted", "closed"].includes(status)) {
    return;
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!(await hasAdminSession(supabase, user))) {
    return;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return;
  const admin = createServiceClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await writeAdminMutation(admin, { actor: user!, action: "property_request.status_update", targetType: "property_request", targetId: requestId, details: { status } }, [{ table: "property_requests", operation: "update", data: { status }, match: { id: requestId } }]);
  if (error) throw new Error("Request status could not be saved with its audit record.");

  revalidatePath("/admin");
}
