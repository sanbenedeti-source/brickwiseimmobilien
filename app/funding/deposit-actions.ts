"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isAdminUser } from "../lib/admin";
export type DepositState = { result: "" | "saved" | "error" };
export async function submitDeposit(_state: DepositState, form: FormData): Promise<DepositState> {
 const client = await createClient();
 const {data:{user}} = await client.auth.getUser();
 if (!user || form.get("acknowledged") !== "on") return {result:"error"};
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
 if (!isAdminUser(user) || !["approve","reject"].includes(String(form.get("decision"))) || (approve && form.get("checked")!=="on")) return {result:"error"};
 const {error} = await client.rpc("review_deposit", {
  p_id:String(form.get("deposit_id") || ""), p_approve:approve,
  p_eur: approve ? String(form.get("amount") || "") : null,
  p_settlement: approve ? String(form.get("settlement") || "").trim() : null,
  p_note:String(form.get("note") || "").trim(),
 });
 if (error) return {result:"error"};
 for (const path of ["/funding","/dashboard","/dashboard/wallet","/admin/payments/deposits","/admin/payments/requests"]) revalidatePath(path);
 return {result:"saved"};
}
