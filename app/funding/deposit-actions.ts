"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isAdminUser } from "../lib/admin";
import { hasAdminSession } from "../lib/admin-session";
export type DepositState = { result: "" | "saved" | "error" };
export async function submitDeposit(_state: DepositState, form: FormData): Promise<DepositState> {
 const client = await createClient();
 const {data:{user}} = await client.auth.getUser();
 // Admin accounts are never credited (same rule as manual wallet credits).
 if (!user || isAdminUser(user) || form.get("acknowledged") !== "on") return {result:"error"};
 let destination;
 try { destination=JSON.parse(String(form.get("destination") || "")); delete destination.created_at; delete destination.updated_at; } catch { return {result:"error"}; }
 const {error} = await client.rpc("submit_deposit", {
  p_destination:destination,
  p_method_id: String(form.get("method_id") || ""), p_amount:String(form.get("amount") || ""),
  p_quantity: form.get("quantity") ? String(form.get("quantity")) : null,
  p_reference:String(form.get("transfer_reference") || "").trim(), p_client_key:String(form.get("client_key") || ""),
 });
 if (error) return {result:"error"};
 revalidatePath("/funding"); revalidatePath("/admin/payments/deposits");
 return {result:"saved"};
}
export async function reviewDeposit(_state: DepositState, form: FormData): Promise<DepositState> {
 const client = await createClient();
 const {data:{user}} = await client.auth.getUser();
 const approve = form.get("decision") === "approve";
 if (!(await hasAdminSession(client, user)) || !["approve","reject"].includes(String(form.get("decision"))) || (approve && form.get("checked")!=="on")) return {result:"error"};
 const id = String(form.get("deposit_id") || "");
 const amount = String(form.get("amount") || "").trim();
 // No admin reviews their own deposit, and a credit that differs from the
 // reported amount (fees, crypto conversion) needs an explicit confirmation.
 const {data:deposit,error:readError} = await client.from("deposit_submissions").select("user_id,requested_eur").eq("id",id).maybeSingle();
 if (readError || !deposit || deposit.user_id === user!.id) return {result:"error"};
 if (approve && (!/^\d+(?:\.\d{1,2})?$/.test(amount)
  || (Math.round(Number(amount)*100) !== Math.round(Number(deposit.requested_eur)*100) && form.get("amount_differs")!=="on"))) return {result:"error"};
 const {error} = await client.rpc("review_deposit", {
  p_id:id, p_approve:approve,
  p_eur: approve ? amount : null,
  p_settlement: approve ? String(form.get("settlement") || "").trim() : null,
  p_note:String(form.get("note") || "").trim(),
 });
 if (error) return {result:"error"};
 for (const path of ["/funding","/dashboard","/dashboard/wallet","/admin/payments/deposits","/admin/payments/requests"]) revalidatePath(path);
 return {result:"saved"};
}
