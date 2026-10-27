"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isAdminUser } from "../lib/admin";
import { isValidIban, normalizeIban } from "../lib/client-finance";

const uuid = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;

export type WithdrawState = { result: "" | "saved" | "kyc" | "amount" | "iban" | "funds" | "error" };
export async function requestWithdrawal(_previous: WithdrawState, form: FormData): Promise<WithdrawState> {
  try {
    const client = await createClient();
    const { data: { user } } = await client.auth.getUser();
    if (!user || isAdminUser(user)) return { result: "error" };
    const amount = String(form.get("amount") || "").replace(",", ".").trim();
    if (!/^\d+(?:\.\d{1,2})?$/.test(amount) || Number(amount) < 10 || Number(amount) > 1_000_000) return { result: "amount" };
    const iban = normalizeIban(String(form.get("iban") || ""));
    if (!isValidIban(iban)) return { result: "iban" };
    const holder = String(form.get("account_holder") || "").trim();
    const bic = String(form.get("bic") || "").replace(/\s+/g, "").toUpperCase();
    const key = String(form.get("client_key") || "");
    if (holder.length < 2 || holder.length > 140 || /[\u0000-\u001f\u007f]/.test(holder) || (bic && !/^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(bic)) || !uuid.test(key)) return { result: "error" };
    const { error } = await client.rpc("request_withdrawal", { p_amount: amount, p_account_holder: holder, p_iban: iban, p_bic: bic || null, p_client_key: key });
    if (error) {
      const message = error.message || "";
      return { result: message.includes("KYC_REQUIRED") ? "kyc" : message.includes("INSUFFICIENT") ? "funds" : message.includes("AMOUNT") ? "amount" : message.includes("IBAN") ? "iban" : "error" };
    }
    revalidatePath("/dashboard", "layout");
    revalidatePath("/admin/payments/withdrawals");
    return { result: "saved" };
  } catch { return { result: "error" }; }
}

export type SaleState = { result: "" | "saved" | "tooMany" | "error" };
export async function requestShareSale(_previous: SaleState, form: FormData): Promise<SaleState> {
  try {
    const client = await createClient();
    const { data: { user } } = await client.auth.getUser();
    if (!user || isAdminUser(user)) return { result: "error" };
    const slug = String(form.get("property_slug") || ""), shares = Number(form.get("shares")), note = String(form.get("note") || "").trim(), key = String(form.get("client_key") || "");
    if (!/^[a-z0-9-]{1,120}$/.test(slug) || !Number.isSafeInteger(shares) || shares < 1 || note.length > 1000 || !uuid.test(key)) return { result: "error" };
    const { error } = await client.rpc("request_share_sale", { p_property_slug: slug, p_shares: shares, p_note: note || null, p_client_key: key });
    if (error) return { result: error.message?.includes("TOO_MANY") || error.message?.includes("NO_HOLDING") ? "tooMany" : "error" };
    revalidatePath("/dashboard", "layout");
    revalidatePath("/admin/sale-requests");
    return { result: "saved" };
  } catch { return { result: "error" }; }
}
