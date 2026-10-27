import type { SupabaseClient, User } from "@supabase/supabase-js";
import { isAdminUser } from "./admin";

/**
 * Phase 2 (since 2026-10-24, after the owner enrolled an authenticator): every admin
 * session must be confirmed with a second factor. An admin without one can only open
 * /admin/security to enroll.
 */
export const ADMIN_MFA_REQUIRED = true;

export type AdminMfaStatus = "verified" | "challenge" | "enroll";

/**
 * `user` must come from auth.getUser(): its factor list is returned by the Auth
 * server, unlike the session cookie. getClaims() verifies the token's signature
 * before its assurance level (aal) is trusted.
 */
export async function getAdminMfaStatus(supabase: Pick<SupabaseClient, "auth">, user: User): Promise<AdminMfaStatus> {
  const { data, error } = await supabase.auth.getClaims();
  if (!error && data?.claims.sub === user.id && data.claims.aal === "aal2") return "verified";
  return (user.factors ?? []).some((factor) => factor.status === "verified") ? "challenge" : "enroll";
}

/** Admin role plus a second factor confirmed in this session (when one is enrolled or required). */
export async function hasAdminSession(supabase: Pick<SupabaseClient, "auth">, user: User | null | undefined) {
  if (!user || !isAdminUser(user)) return false;
  const status = await getAdminMfaStatus(supabase, user);
  return status === "verified" || (status === "enroll" && !ADMIN_MFA_REQUIRED);
}
