"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { hasAdminSession } from "@/app/lib/admin-session";

export type ProfitState = { result: "" | "saved" | "error" | "amount" | "holding" };
const uuid = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;

/** Credits one client's wallet with the profit of a property they hold. The same request key never
 * pays twice, so a double submit or a retry returns the first payout. */
export async function payClientProfit(_previous: ProfitState, form: FormData): Promise<ProfitState> {
  try {
    const client = await createClient();
    const { data: { user }, error } = await client.auth.getUser();
    if (error || !(await hasAdminSession(client, user))) return { result: "error" };
    const userId = String(form.get("user_id") || ""), slug = String(form.get("property_slug") || ""), key = String(form.get("client_key") || "");
    const amount = String(form.get("amount") || "").replace(",", ".").trim(), note = String(form.get("note") || "").trim();
    if (!uuid.test(userId) || !uuid.test(key) || !/^[a-z0-9-]{1,120}$/.test(slug) || note.length > 300 || /[\u0000-\u001f\u007f]/.test(note) || form.get("confirm") !== "yes") return { result: "error" };
    if (!/^\d+(?:\.\d{1,2})?$/.test(amount) || Number(amount) <= 0 || Number(amount) > 1_000_000) return { result: "amount" };
    const { error: payError } = await client.rpc("pay_client_profit", { p_user_id: userId, p_property_slug: slug, p_amount: amount, p_note: note || null, p_client_key: key });
    if (payError) return { result: payError.message?.includes("NO_HOLDING") ? "holding" : "error" };
    revalidatePath(`/admin/customers/${userId}`);
    revalidatePath("/admin/audit");
    revalidatePath("/dashboard", "layout");
    return { result: "saved" };
  } catch { return { result: "error" }; }
}

export type InvestmentState = { result: "" | "saved" | "error" | "invalid" | "funds" | "shares" };
const slugPattern = /^[a-z0-9-]{1,120}$/;
const moneyPattern = /^\d+(?:\.\d{1,2})?$/;

/** Shared checks for the three investment actions: a verified admin, a client id, a fresh request
 * key, a reason the client can read and an explicit confirmation. Null when anything is missing. */
async function readInvestmentForm(form: FormData) {
  const client = await createClient();
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !(await hasAdminSession(client, user))) return null;
  const userId = String(form.get("user_id") || ""), key = String(form.get("client_key") || ""), note = String(form.get("note") || "").trim();
  if (!uuid.test(userId) || !uuid.test(key) || note.length < 3 || note.length > 300 || /[\u0000-\u001f\u007f]/.test(note) || form.get("confirm") !== "yes") return null;
  return { client, userId, key, note };
}

function readShares(form: FormData) {
  const slug = String(form.get("property_slug") || ""), shares = Number(form.get("shares")), price = String(form.get("price_per_share") || "").replace(",", ".").trim();
  if (!slugPattern.test(slug) || !Number.isSafeInteger(shares) || shares < 1 || shares > 1_000_000 || !moneyPattern.test(price) || Number(price) <= 0) return null;
  return { slug, shares, price };
}

function refreshInvestmentViews(userId: string) {
  revalidatePath(`/admin/customers/${userId}`);
  revalidatePath("/admin/properties");
  revalidatePath("/admin/sale-requests");
  revalidatePath("/admin/audit");
  revalidatePath("/properties", "layout");
  revalidatePath("/dashboard", "layout");
}

/** Gives a client shares: paid from their wallet, or recorded as paid outside the wallet (bank transfer). */
export async function addClientShares(_previous: InvestmentState, form: FormData): Promise<InvestmentState> {
  try {
    const base = await readInvestmentForm(form);
    const order = readShares(form);
    const payment = String(form.get("payment") || "");
    if (!base || !order || !["wallet", "external"].includes(payment)) return { result: "invalid" };
    const { error } = await base.client.rpc("admin_add_shares", { p_user_id: base.userId, p_property_slug: order.slug, p_shares: order.shares,
      p_price_per_share: order.price, p_payment: payment, p_note: base.note, p_client_key: base.key });
    if (error) return { result: error.message?.includes("INSUFFICIENT_FUNDS") ? "funds" : error.message?.includes("INSUFFICIENT_SHARES") ? "shares" : "error" };
    refreshInvestmentViews(base.userId);
    return { result: "saved" };
  } catch { return { result: "error" }; }
}

/** Takes shares back from a client at the agreed price, credits their wallet and frees the shares.
 * With a sale request id the request is completed in the same transaction. */
export async function buyBackClientShares(_previous: InvestmentState, form: FormData): Promise<InvestmentState> {
  try {
    const base = await readInvestmentForm(form);
    const order = readShares(form);
    const requestId = String(form.get("sale_request_id") || "");
    if (!base || !order || (requestId && !uuid.test(requestId))) return { result: "invalid" };
    const { error } = await base.client.rpc("admin_buy_back_shares", { p_user_id: base.userId, p_property_slug: order.slug, p_shares: order.shares,
      p_price_per_share: order.price, p_note: base.note, p_client_key: base.key, p_sale_request_id: requestId || null });
    if (error) return { result: error.message?.includes("INSUFFICIENT_SHARES") || error.message?.includes("REQUEST_INVALID") ? "shares" : "error" };
    refreshInvestmentViews(base.userId);
    return { result: "saved" };
  } catch { return { result: "error" }; }
}

/** Corrects a wallet up or down; the reason is shown to the client in their statement. */
export async function adjustClientWallet(_previous: InvestmentState, form: FormData): Promise<InvestmentState> {
  try {
    const base = await readInvestmentForm(form);
    const direction = String(form.get("direction") || ""), amount = String(form.get("amount") || "").replace(",", ".").trim();
    if (!base || !["credit", "debit"].includes(direction) || !moneyPattern.test(amount) || Number(amount) <= 0 || Number(amount) > 1_000_000) return { result: "invalid" };
    const { error } = await base.client.rpc("admin_adjust_wallet", { p_user_id: base.userId, p_amount: amount, p_direction: direction, p_note: base.note, p_client_key: base.key });
    if (error) return { result: error.message?.includes("INSUFFICIENT_FUNDS") ? "funds" : "error" };
    refreshInvestmentViews(base.userId);
    return { result: "saved" };
  } catch { return { result: "error" }; }
}
