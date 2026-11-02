import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { hasAdminSession } from "@/app/lib/admin-session";
import { getClientDirectory } from "@/app/admin/client-directory";
import { getAdminAttention } from "@/app/admin/attention";

export const dynamic = "force-dynamic";

export type AdminInboxItem = {
  kind: "deposit" | "withdrawal" | "kyc" | "agreement" | "sale" | "request";
  id: string; name: string; email: string; amount: number | null; shares: number | null; createdAt: string; href: string;
};

const noStore = { "Cache-Control": "no-store" };

/** Client actions waiting for the team: newest deposits, withdrawals, identity checks, agreements,
 * sale requests and enquiries. Read by the bell in the admin top bar. */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!(await hasAdminSession(supabase, user))) return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: noStore });

  const latest = 10;
  const [deposits, gateway, withdrawals, kyc, agreements, sales, requests, directory, attention] = await Promise.all([
    supabase.from("deposit_submissions").select("id,user_id,customer_name,customer_email,requested_eur,created_at").eq("status", "pending").order("created_at", { ascending: false }).limit(latest),
    supabase.from("gateway_deposits").select("id,user_id,amount_eur,created_at").eq("status", "review").order("created_at", { ascending: false }).limit(latest),
    supabase.from("withdrawal_requests").select("id,user_id,amount,created_at").eq("status", "pending").order("created_at", { ascending: false }).limit(latest),
    supabase.from("client_kyc_submissions").select("id,user_id,created_at").eq("status", "pending").order("created_at", { ascending: false }).limit(latest),
    supabase.from("client_agreement_acceptances").select("id,user_id,accepted_at").eq("status", "pending").order("accepted_at", { ascending: false }).limit(latest),
    supabase.from("share_sale_requests").select("id,user_id,shares,created_at").in("status", ["pending", "in_review"]).order("created_at", { ascending: false }).limit(latest),
    supabase.from("property_requests").select("id,name,full_name,email,created_at").or("status.is.null,status.eq.new").order("created_at", { ascending: false }).limit(latest),
    getClientDirectory(),
    getAdminAttention(supabase),
  ]);
  const person = (id: string | null | undefined) => (id ? directory.get(id) : undefined);
  const items: AdminInboxItem[] = [
    ...(deposits.data || []).map((row) => ({ kind: "deposit" as const, id: row.id, name: row.customer_name || person(row.user_id)?.name || "", email: row.customer_email || person(row.user_id)?.email || "",
      amount: Number(row.requested_eur), shares: null, createdAt: row.created_at, href: row.user_id ? `/admin/customers/${row.user_id}#deposits` : "/admin/payments/deposits" })),
    ...(gateway.data || []).map((row) => ({ kind: "deposit" as const, id: row.id, name: person(row.user_id)?.name || "", email: person(row.user_id)?.email || "",
      amount: Number(row.amount_eur), shares: null, createdAt: row.created_at, href: "/admin/payments/deposits" })),
    ...(withdrawals.data || []).map((row) => ({ kind: "withdrawal" as const, id: row.id, name: person(row.user_id)?.name || "", email: person(row.user_id)?.email || "",
      amount: Number(row.amount), shares: null, createdAt: row.created_at, href: "/admin/payments/withdrawals" })),
    ...(kyc.data || []).map((row) => ({ kind: "kyc" as const, id: row.id, name: person(row.user_id)?.name || "", email: person(row.user_id)?.email || "",
      amount: null, shares: null, createdAt: row.created_at, href: "/admin/kyc" })),
    ...(agreements.data || []).map((row) => ({ kind: "agreement" as const, id: row.id, name: person(row.user_id)?.name || "", email: person(row.user_id)?.email || "",
      amount: null, shares: null, createdAt: row.accepted_at, href: "/admin/agreements" })),
    ...(sales.data || []).map((row) => ({ kind: "sale" as const, id: row.id, name: person(row.user_id)?.name || "", email: person(row.user_id)?.email || "",
      amount: null, shares: Number(row.shares), createdAt: row.created_at, href: "/admin/sale-requests" })),
    ...(requests.data || []).map((row) => ({ kind: "request" as const, id: row.id, name: row.name || row.full_name || "", email: row.email || "",
      amount: null, shares: null, createdAt: row.created_at, href: "/admin#requests" })),
  ].filter((item) => item.createdAt).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  // The total uses the same counts as the sidebar badges (payment requests wait on the client, not the team).
  const total = attention.newRequests + attention.pendingDeposits + attention.pendingWithdrawals + attention.pendingKyc + attention.pendingAgreements + attention.pendingSales;
  return NextResponse.json({ items: items.slice(0, 20), total }, { headers: noStore });
}
