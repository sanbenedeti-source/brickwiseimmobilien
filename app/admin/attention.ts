import type { SupabaseClient } from "@supabase/supabase-js";

export type AdminAttention = {
  newRequests: number;
  pendingDeposits: number;
  pendingAgreements: number;
  pendingPayments: number;
  pendingKyc: number;
  pendingWithdrawals: number;
  pendingSales: number;
};

/** Open work per queue, used for the overview figures and the navigation badges. */
export async function getAdminAttention(supabase: Pick<SupabaseClient, "from">): Promise<AdminAttention> {
  // A queue that cannot be counted shows no badge instead of breaking the page.
  const count = async (request: PromiseLike<{ count: number | null; error: unknown }>) => {
    try {
      const { count: value, error } = await request;
      return error ? 0 : value ?? 0;
    } catch { return 0; }
  };
  const head = { count: "exact" as const, head: true };
  const [newRequests, manualDeposits, gatewayReview, pendingAgreements, pendingPayments, pendingKyc, pendingWithdrawals, pendingSales] = await Promise.all([
    count(supabase.from("property_requests").select("id", head).or("status.is.null,status.eq.new")),
    count(supabase.from("deposit_submissions").select("id", head).eq("status", "pending")),
    count(supabase.from("gateway_deposits").select("id", head).eq("status", "review")),
    count(supabase.from("client_agreement_acceptances").select("id", head).eq("status", "pending")),
    count(supabase.from("payment_requests").select("id", head).eq("status", "pending")),
    count(supabase.from("client_kyc_submissions").select("id", head).eq("status", "pending")),
    count(supabase.from("withdrawal_requests").select("id", head).eq("status", "pending")),
    count(supabase.from("share_sale_requests").select("id", head).or("status.eq.pending,status.eq.in_review")),
  ]);
  return { newRequests, pendingDeposits: manualDeposits + gatewayReview, pendingAgreements, pendingPayments, pendingKyc, pendingWithdrawals, pendingSales };
}
