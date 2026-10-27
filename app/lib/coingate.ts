import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/** CoinGate crypto checkout (https://developer.coingate.com). The integration is active only
 * when COINGATE_API_TOKEN is set; without it the manual deposit report flow stays in place. */
export type CoinGateOrder = {
  id: number;
  status: string;
  order_id: string;
  price_amount: string;
  price_currency: string;
  pay_amount?: string | null;
  pay_currency?: string | null;
  receive_amount?: string | null;
  receive_currency?: string | null;
  underpaid_amount?: string | null;
  paid_at?: string | null;
  payment_url?: string | null;
};

export const COINGATE_MIN_EUR = 10;
export const COINGATE_MAX_EUR = 1_000_000;

export function coinGateConfig() {
  const token = process.env.COINGATE_API_TOKEN?.trim();
  if (!token) return null;
  const sandbox = process.env.COINGATE_ENVIRONMENT?.trim().toLowerCase() === "sandbox";
  return {
    token,
    sandbox,
    baseUrl: sandbox ? "https://api-sandbox.coingate.com/api/v2" : "https://api.coingate.com/api/v2",
    // Without an override, the currency settings of the CoinGate integration decide the settlement.
    // A value sent with the order (e.g. EUR or DO_NOT_CONVERT) takes precedence over the dashboard.
    receiveCurrency: process.env.COINGATE_RECEIVE_CURRENCY?.trim().toUpperCase() || null,
  };
}
export const isCoinGateEnabled = () => coinGateConfig() !== null;

export function newCallbackToken() {
  const token = randomBytes(32).toString("hex");
  return { token, hash: hashCallbackToken(token) };
}
export const hashCallbackToken = (token: string) => createHash("sha256").update(token, "utf8").digest("hex");
export function callbackTokenMatches(token: string, storedHash: string) {
  if (!/^[0-9a-f]{64}$/.test(storedHash)) return false;
  return timingSafeEqual(Buffer.from(hashCallbackToken(token), "hex"), Buffer.from(storedHash, "hex"));
}

/** Only CoinGate's own checkout pages are accepted as redirect targets. */
export function isCoinGatePaymentUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && (url.hostname === "coingate.com" || url.hostname.endsWith(".coingate.com"));
  } catch { return false; }
}

export async function createCoinGateOrder(input: { depositId: string; amount: string; token: string; origin: string }) {
  const config = coinGateConfig();
  if (!config) throw new Error("COINGATE_DISABLED");
  const body = new URLSearchParams({
    order_id: input.depositId,
    price_amount: input.amount,
    price_currency: "EUR",
    title: "Brickwise wallet deposit",
    description: `Wallet deposit ${input.depositId.slice(0, 8).toUpperCase()}`,
    callback_url: `${input.origin}/api/deposits/coingate/callback`,
    success_url: `${input.origin}/funding?method=crypto&payment=success`,
    cancel_url: `${input.origin}/funding?method=crypto&payment=canceled`,
    token: input.token,
  });
  if (config.receiveCurrency) body.set("receive_currency", config.receiveCurrency);
  const response = await fetch(`${config.baseUrl}/orders`, {
    method: "POST",
    headers: { Authorization: `Token ${config.token}`, "Content-Type": "application/x-www-form-urlencoded; charset=utf-8", Accept: "application/json" },
    body, cache: "no-store", signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`COINGATE_HTTP_${response.status} ${await providerReason(response)}`.trim());
  const order = await response.json() as CoinGateOrder;
  if (!Number.isSafeInteger(order.id)) throw new Error("COINGATE_RESPONSE_INVALID id");
  if (order.order_id !== input.depositId) throw new Error("COINGATE_RESPONSE_INVALID order_id");
  if (!isCoinGatePaymentUrl(order.payment_url)) throw new Error(`COINGATE_RESPONSE_INVALID payment_url host=${safeHost(order.payment_url)}`);
  return order;
}

export async function getCoinGateOrder(orderId: number) {
  const config = coinGateConfig();
  if (!config) throw new Error("COINGATE_DISABLED");
  const response = await fetch(`${config.baseUrl}/orders/${orderId}`, {
    headers: { Authorization: `Token ${config.token}`, Accept: "application/json" },
    cache: "no-store", signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`COINGATE_HTTP_${response.status}`);
  const order = await response.json() as CoinGateOrder;
  if (order.id !== orderId) throw new Error("COINGATE_RESPONSE_INVALID");
  return order;
}

/** CoinGate's error reason and messages (e.g. "OrderIsNotValid: price_amount ..."), for the server log only. */
async function providerReason(response: Response) {
  try {
    const body = await response.json() as { reason?: unknown; message?: unknown; errors?: unknown };
    const errors = Array.isArray(body.errors) ? body.errors.map(String).join("; ") : "";
    return [body.reason, body.message, errors].filter(Boolean).map(String).join(" | ").replace(/[^\w .,:;|()'/-]/g, "").slice(0, 300);
  } catch { return ""; }
}
const safeHost = (value: unknown) => { try { return new URL(String(value)).hostname.slice(0, 80); } catch { return "none"; } };

const decimal = (value: unknown) => {
  const text = typeof value === "number" ? String(value) : typeof value === "string" ? value.trim() : "";
  return /^\d+(?:\.\d+)?$/.test(text) ? text : null;
};

/** Arguments for settle_gateway_deposit, taken only from an order read back from the CoinGate API. */
export function settlementArgs(depositId: string, order: CoinGateOrder) {
  return {
    p_id: depositId,
    p_order_id: order.id,
    p_status: String(order.status || "").toLowerCase(),
    p_price_amount: decimal(order.price_amount),
    p_price_currency: String(order.price_currency || "").toUpperCase(),
    p_pay_currency: order.pay_currency ? String(order.pay_currency).slice(0, 20) : null,
    p_pay_amount: decimal(order.pay_amount),
    p_receive_currency: order.receive_currency ? String(order.receive_currency).slice(0, 20) : null,
    p_receive_amount: decimal(order.receive_amount),
    p_underpaid: decimal(order.underpaid_amount),
    p_paid_at: order.paid_at && !Number.isNaN(Date.parse(order.paid_at)) ? new Date(order.paid_at).toISOString() : null,
  };
}
