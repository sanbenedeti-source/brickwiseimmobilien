import { NextResponse } from "next/server";
import { isAdminUser } from "@/app/lib/admin";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }

  const destination = isAdminUser(user) ? "/admin" : "/dashboard";
  return NextResponse.redirect(new URL(destination, request.url));
}
