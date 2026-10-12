import { createClient } from "@/lib/supabase/server";
import type { CompanyPaymentMethod } from "./company-payment-methods";

export async function getCompanyPaymentMethods() {
  const client = await createClient();
  const { data, error } = await client.from("company_payment_methods").select("*").eq("active", true).order("bank_slot", { ascending: true, nullsFirst: false }).order("label");
  return { methods: (data || []) as CompanyPaymentMethod[], error: Boolean(error) };
}
