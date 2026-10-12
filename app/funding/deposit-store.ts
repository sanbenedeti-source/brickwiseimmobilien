import { createClient } from "@/lib/supabase/server";
import type { CompanyPaymentMethod } from "../lib/company-payment-methods";
export type Deposit = {
 id: string; user_id: string; customer_email: string; customer_name: string | null; destination: CompanyPaymentMethod; requested_eur: number;
 crypto_quantity: number | null; transfer_reference: string; status: "pending" | "verified" | "rejected" | "refunded";
 credited_eur: number | null; review_note: string | null; created_at: string;
};
export async function getDeposits(userId?: string) {
 const client = await createClient();
 let query = client.from("deposit_submissions").select("id,user_id,customer_email,customer_name,destination,requested_eur,crypto_quantity,transfer_reference,status,credited_eur,review_note,created_at").order("status").order("created_at",{ascending:false}).limit(100);
 if(userId) query=query.eq("user_id",userId);
 const {data,error}=await query;
 return {deposits:(data || []) as Deposit[], error:Boolean(error)};
}
