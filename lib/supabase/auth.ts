import { cache } from "react";
import { createClient } from "./server";

export type CurrentUser = {
  id: string;
  email: string;
  phone: string;
  user_metadata: {
    full_name?: string;
    first_name?: string;
    last_name?: string;
    phone?: string;
    [key: string]: unknown;
  };
  app_metadata: Record<string, unknown>;
  created_at: string;
};

/**
 * One verified auth lookup per server render. getClaims validates the signed
 * JWT and avoids a second Auth API request on every portal navigation.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;

  if (error || !claims?.sub || typeof claims.email !== "string") {
    return null;
  }

  return {
    id: claims.sub,
    email: claims.email,
    phone: typeof claims.phone === "string" ? claims.phone : "",
    user_metadata:
      claims.user_metadata && typeof claims.user_metadata === "object"
        ? claims.user_metadata
        : {},
    app_metadata:
      claims.app_metadata && typeof claims.app_metadata === "object"
        ? claims.app_metadata
        : {},
    created_at: new Date(claims.iat * 1000).toISOString(),
  };
});
