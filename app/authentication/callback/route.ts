import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "../../../lib/supabase/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const tokenHash = requestUrl.searchParams.get("token_hash");
  const type = requestUrl.searchParams.get("type") as EmailOtpType | null;
  const next = getSafeNextPath(requestUrl.searchParams.get("next"));
  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(new URL(await signupDestination(supabase, next), request.url));
    }
  }

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    });

    if (!error) {
      return NextResponse.redirect(new URL(await signupDestination(supabase, next), request.url));
    }
  }

  const errorPath = next.startsWith("/update-password")
    ? `/forgot-password?error=invalid-link&portal=${next.includes("portal=admin") ? "admin" : "client"}`
    : "/sign-in?error=invalid-link";

  return NextResponse.redirect(new URL(errorPath, request.url));
}

// After a signup confirmation, return the client to the property they started from
// (stored by /interface/register), then clear it so later links use the dashboard.
async function signupDestination(supabase: Awaited<ReturnType<typeof createClient>>, next: string) {
  if (next !== "/dashboard") return next;
  try {
    const { data } = await supabase.auth.getUser();
    const stored = data.user?.user_metadata?.signup_next;
    if (typeof stored !== "string" || !/^\/properties\/[a-z0-9-]{1,120}$/.test(stored)) return next;
    await supabase.auth.updateUser({ data: { signup_next: null } });
    return stored;
  } catch {
    return next;
  }
}

function getSafeNextPath(value: string | null) {
  return value === "/update-password?portal=admin" || value === "/update-password?portal=client"
    ? value
    : "/dashboard";
}
