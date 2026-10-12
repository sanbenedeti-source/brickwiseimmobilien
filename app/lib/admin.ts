export function isAdminUser(user: { app_metadata?: Record<string, unknown> } | null | undefined) {
  if (!user) return false;
  return user.app_metadata?.role === "admin";
}
