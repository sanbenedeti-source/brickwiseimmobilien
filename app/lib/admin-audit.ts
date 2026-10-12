import { type SupabaseClient } from "@supabase/supabase-js";

export type AdminMutation = { table: string; operation: "insert" | "update" | "upsert"; data: object; match?: object };
export function writeAdminMutation(client: Pick<SupabaseClient, "rpc">, event: Omit<AuditEvent, "actor" | "status"> & { actor: AuditActor | null }, operations: AdminMutation[]) {
  return client.rpc("admin_write_audited", {
    p_actor: event.actor?.id || null, p_action: event.action,
    p_target_type: event.targetType, p_target_id: event.targetId || null,
    p_details: event.details || {}, p_operations: operations,
  });
}

type AuditActor = {
  id: string;
  email?: string | null;
};

type AuditEvent = {
  actor: AuditActor;
  action: string;
  targetType: string;
  targetId?: string | null;
  status?: "success" | "failure";
  details?: Record<string, unknown>;
};

