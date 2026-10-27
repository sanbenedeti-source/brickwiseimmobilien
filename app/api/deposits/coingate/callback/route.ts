import { createServiceClient } from "@/lib/supabase/service";
import { callbackTokenMatches, coinGateConfig, getCoinGateOrder, settlementArgs } from "@/app/lib/coingate";

const uuid = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;

async function readFields(request: Request): Promise<Record<string, unknown>> {
  const type = request.headers.get("content-type") || "";
  if (type.includes("application/json")) return await request.json().catch(() => ({})) as Record<string, unknown>;
  return Object.fromEntries(new URLSearchParams(await request.text().catch(() => "")));
}

/** CoinGate order status callback. The body only says which order changed: the callback token
 * must match the order, and the status and amounts are re-read from the CoinGate API. */
export async function POST(request: Request) {
  if (!coinGateConfig()) return new Response(null, { status: 503 });
  try {
    const fields = await readFields(request);
    const depositId = String(fields.order_id ?? ""), orderId = Number(fields.id), token = String(fields.token ?? "");
    if (!uuid.test(depositId) || !Number.isSafeInteger(orderId) || orderId <= 0 || !/^[0-9a-f]{64}$/.test(token)) return new Response(null, { status: 400 });
    const service = createServiceClient();
    const { data: deposit, error } = await service.from("gateway_deposits").select("id,provider_order_id,callback_token_hash").eq("id", depositId).maybeSingle();
    if (error) return new Response(null, { status: 503 });
    // 403 ends CoinGate's retries, which is right for a callback that is not ours.
    if (!deposit || !callbackTokenMatches(token, deposit.callback_token_hash) || (deposit.provider_order_id !== null && Number(deposit.provider_order_id) !== orderId)) return new Response(null, { status: 403 });
    const order = await getCoinGateOrder(orderId);
    if (order.order_id !== depositId) return new Response(null, { status: 403 });
    if (deposit.provider_order_id === null) {
      const { error: attachError } = await service.rpc("attach_gateway_order", { p_id: depositId, p_order_id: orderId, p_payment_url: order.payment_url ?? null });
      if (attachError) return new Response(null, { status: 503 });
    }
    const { error: settleError } = await service.rpc("settle_gateway_deposit", settlementArgs(depositId, order));
    // Any other failure answers 503 so that CoinGate retries the callback later.
    return new Response(null, { status: settleError ? 503 : 200 });
  } catch { return new Response(null, { status: 503 }); }
}
