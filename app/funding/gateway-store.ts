import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { coinGateConfig, getCoinGateOrder, settlementArgs } from "../lib/coingate";

export type GatewayDeposit = {
  id: string; user_id: string; amount_eur: number; status: string; provider_order_id: number | null;
  pay_currency: string | null; pay_amount: number | null; review_note: string | null; paid_at: string | null; created_at: string;
};
const columns = "id,user_id,amount_eur,status,provider_order_id,pay_currency,pay_amount,review_note,paid_at,created_at";

/** Gateway deposits of one client (RLS) or, for an admin session, of everyone. A missing table
 * (before migration 021) reads as an empty list. */
export async function getGatewayDeposits(userId?: string, limit = 50) {
  const client = await createClient();
  let query = client.from("gateway_deposits").select(columns).neq("status", "created").order("created_at", { ascending: false }).limit(limit);
  if (userId) query = query.eq("user_id", userId);
  const { data, error } = await query;
  return { deposits: (data || []) as GatewayDeposit[], error: Boolean(error) };
}

/** Re-checks a client's open checkouts with CoinGate when they return from the payment page,
 * so a delayed callback does not keep their wallet waiting. */
export async function syncOpenGatewayDeposits(deposits: GatewayDeposit[]) {
  if (!coinGateConfig()) return false;
  const open = deposits.filter((row) => ["awaiting_payment", "confirming"].includes(row.status) && row.provider_order_id
    && Date.now() - Date.parse(row.created_at) < 3 * 86_400_000).slice(0, 3);
  if (!open.length) return false;
  const service = createServiceClient();
  const results = await Promise.allSettled(open.map(async (row) => {
    const order = await getCoinGateOrder(Number(row.provider_order_id));
    if (order.order_id !== row.id) return false;
    const { data, error } = await service.rpc("settle_gateway_deposit", settlementArgs(row.id, order));
    return !error && data !== row.status;
  }));
  return results.some((result) => result.status === "fulfilled" && result.value);
}
