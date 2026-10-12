"use server";
import { createClient } from "@/lib/supabase/server";
import { isAdminUser } from "@/app/lib/admin";
import { revalidatePath } from "next/cache";
export type RefundState={result:""|"saved"|"error"|"insufficient"};
export async function refundPayment(_state:RefundState,form:FormData):Promise<RefundState> {
 const client=await createClient(); const {data:{user}}=await client.auth.getUser();
 if(!isAdminUser(user)||form.get("confirmed")!=="on") return {result:"error"};
 const id=String(form.get("payment_id")||""); const reference=String(form.get("reference")||"").trim(); const note=String(form.get("note")||"").trim();
 if(!/^[0-9a-f-]{36}$/i.test(id)||reference.length<4||reference.length>200||note.length<3||note.length>1000) return {result:"error"};
 const {error}=await client.rpc("refund_payment_atomic",{p_payment_id:id,p_reference:reference,p_note:note});
 if(error) return {result:error.message.includes("insufficient_refund_balance")?"insufficient":"error"};
 for(const path of ["/admin","/admin/payments/requests","/admin/payments/deposits","/admin/audit","/dashboard","/dashboard/wallet","/funding"]) revalidatePath(path);
 return {result:"saved"};
}
