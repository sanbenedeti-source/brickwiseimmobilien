import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { isAdminUser } from "@/app/lib/admin";
import { siteOrigin } from "@/app/lib/seo";
import { COINGATE_MAX_EUR, COINGATE_MIN_EUR, coinGateConfig, createCoinGateOrder, isCoinGatePaymentUrl, newCallbackToken } from "@/app/lib/coingate";

const headers = { "Cache-Control": "private, no-store" };
const uuid = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;
const fail = (error: string, status: number) => Response.json({ error }, { status, headers });

/** Opens a CoinGate checkout for the signed-in client and returns its payment page. */
export async function POST(request: Request) {
  const requestOrigin = new URL(request.url).origin;
  if (request.headers.get("origin") !== requestOrigin) return fail("forbidden", 403);
  if (!coinGateConfig()) return fail("unavailable", 503);
  try {
    const client = await createClient();
    const { data: { user }, error } = await client.auth.getUser();
    if (error || !user) return fail("unauthorized", 401);
    if (isAdminUser(user) || !user.email_confirmed_at) return fail("forbidden", 403);
    const body = await request.json().catch(() => ({})) as { amount?: unknown; clientKey?: unknown };
    const amount = String(body.amount ?? "").replace(",", ".").trim();
    if (!/^\d+(?:\.\d{1,2})?$/.test(amount) || Number(amount) < COINGATE_MIN_EUR || Number(amount) > COINGATE_MAX_EUR) return fail("amount", 400);
    const clientKey = String(body.clientKey ?? "");
    if (!uuid.test(clientKey)) return fail("invalid", 400);

    const service = createServiceClient();
    const { token, hash } = newCallbackToken();
    const { data: depositId, error: createError } = await service.rpc("create_gateway_deposit", { p_user_id: user.id, p_amount: amount, p_client_key: clientKey, p_token_hash: hash });
    if (createError || typeof depositId !== "string") return fail(createError?.message?.includes("TOO_MANY") ? "tooMany" : "unavailable", createError?.message?.includes("TOO_MANY") ? 429 : 503);
    // A repeated submit with the same key reuses the checkout that already exists.
    const { data: existing } = await service.from("gateway_deposits").select("payment_url,callback_token_hash,status").eq("id", depositId).maybeSingle();
    if (existing?.payment_url && existing.callback_token_hash !== hash) {
      return isCoinGatePaymentUrl(existing.payment_url) && ["awaiting_payment", "confirming"].includes(existing.status) ? Response.json({ url: existing.payment_url }, { headers }) : fail("invalid", 409);
    }
    if (existing?.callback_token_hash !== hash) return fail("invalid", 409);

    const origin = process.env.VERCEL_ENV === "production" ? siteOrigin : requestOrigin;
    const order = await createCoinGateOrder({ depositId, amount: Number(amount).toFixed(2), token, origin }).catch((orderError: Error) => {
      console.error(`[coingate] order for deposit ${depositId} failed: ${orderError.message}`);
      return null;
    });
    if (!order) return fail("unavailable", 503);
    const { error: attachError } = await service.rpc("attach_gateway_order", { p_id: depositId, p_order_id: order.id, p_payment_url: order.payment_url });
    if (attachError) { console.error(`[coingate] attach for deposit ${depositId} failed: ${attachError.message}`); return fail("unavailable", 503); }
    return Response.json({ url: order.payment_url }, { headers });
  } catch (unexpected) {
    console.error(`[coingate] checkout failed: ${unexpected instanceof Error ? unexpected.message : "unknown"}`);
    return fail("unavailable", 503);
  }
}
