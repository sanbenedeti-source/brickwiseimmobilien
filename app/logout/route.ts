import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "../../lib/supabase/server";

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  const storageKey = `sb-${new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname.split(".")[0]}-auth-token`;
  const authCookies = cookieStore.getAll().filter(({ name }) =>
    name === storageKey || name.startsWith(`${storageKey}.`) || name.startsWith(`${storageKey}-`),
  );
  const supabase = await createClient();

  try {
    const { error } = await supabase.auth.signOut();
    if (error) console.error("Auth session revocation failed during logout:", error.name);
  } catch {
    console.error("Auth service unavailable during logout");
  } finally {
    // Even when remote revocation fails, never retain the local session.
    for (const { name } of authCookies) cookieStore.delete(name);
  }

  const response = NextResponse.redirect(new URL("/sign-in", request.url), 303);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
