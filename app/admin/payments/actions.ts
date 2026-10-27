"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { parsePaymentMethodFields } from "@/app/lib/payment-methods";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { isAdminUser } from "@/app/lib/admin";
import { hasAdminSession } from "@/app/lib/admin-session";
import { createClient } from "@/lib/supabase/server";
import { writeAdminMutation } from "@/app/lib/admin-audit";

const paymentStatuses = [
  "draft",
  "sent",
  "pending",
  "paid",
  "verified",
  "failed",
  "cancelled",
] as const;

function getAdminSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }

  return createSupabaseClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

async function requireAdminUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!(await hasAdminSession(supabase, user))) {
    return null;
  }

  return user;
}

function clean(value: FormDataEntryValue | null) {
  return String(value || "").trim();
}

export type WalletCreditState = { result: "" | "saved" | "error" };

export async function creditCustomerWallet(_state: WalletCreditState, formData: FormData): Promise<WalletCreditState> {
  const user = await requireAdminUser();
  const adminSupabase = getAdminSupabase();
  if (!user || !adminSupabase) return { result: "error" };

  const userId = clean(formData.get("user_id"));
  const operationId = clean(formData.get("operation_id"));
  const amountText = clean(formData.get("amount"));
  const amount = Number(amountText);
  const currency = clean(formData.get("currency")) || "EUR";
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuid.test(userId) || !uuid.test(operationId) || !/^\d+(?:\.\d{1,2})?$/.test(amountText) || !Number.isFinite(amount) || amount <= 0 || amount > 10000000 || currency.toUpperCase() !== "EUR") return { result: "error" };
  const { data: customerData, error: customerError } = await adminSupabase.auth.admin.getUserById(userId);
  const customer = customerData?.user;
  if (customerError || !customer?.email || isAdminUser(customer)) return { result: "error" };
  const customerEmail = customer.email.toLowerCase();
  const customerName = String(customer.user_metadata?.full_name || "");

  const { error } = await adminSupabase.rpc("credit_wallet_atomic", {
    p_user_id: userId,
    p_amount: amount,
    p_currency: currency.toUpperCase(),
    p_actor_id: user.id,
    p_customer_email: customerEmail,
    p_customer_name: customerName,
    p_idempotency_key: `admin-credit:${user.id}:${operationId.toLowerCase()}`,
  });

  if (error) { console.error("Wallet credit failed:", error.message); return { result: "error" }; }
  revalidatePath("/admin");
  revalidatePath("/admin/payments");
  revalidatePath("/admin/payments/requests");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/wallet");
  return { result: "saved" };
}

export async function createPaymentRequest(formData: FormData) {
  const user = await requireAdminUser();
  const adminSupabase = getAdminSupabase();

  if (!user || !adminSupabase) {
    return;
  }

  const customerEmail = clean(formData.get("customer_email")).toLowerCase();
  const customerName = clean(formData.get("customer_name"));
  const userId = clean(formData.get("user_id")) || null;
  const propertyId = clean(formData.get("property_id")) || null;
  const title = clean(formData.get("title"));
  const amount = Number(clean(formData.get("amount")));
  const currency = clean(formData.get("currency")) || "EUR";
  const paymentFields = parsePaymentMethodFields(formData);
  const method = paymentFields?.method || "bank_transfer";
  const instructions = clean(formData.get("instructions"));
  const paymentLink = clean(formData.get("payment_link"));
  const adminNote = clean(formData.get("admin_note"));

  if (!paymentFields || !customerEmail || !title || !Number.isFinite(amount) || amount <= 0 || currency.toUpperCase() !== "EUR") {
    redirect(`/admin/payments/requests?method=${formData.get("method") === "crypto" ? "crypto" : "bank_transfer"}&result=invalid`);
  }

  const paymentPayload = {
    user_id: userId,
    customer_name: customerName || null,
    customer_email: customerEmail,
    property_id: propertyId,
    title,
    amount,
    currency: currency.toUpperCase(),
    ...paymentFields,
    status: "sent",
    instructions: instructions || null,
    payment_link: paymentLink || null,
    admin_note: adminNote || null,
    created_by: user.id,
  };

  const { error } = await writeAdminMutation(adminSupabase, {
    actor: user, action: "payment_request.create", targetType: "payment_request",
    details: { customerEmail, amount, currency: "EUR", method, propertyId },
  }, [{ table: "payment_requests", operation: "insert", data: paymentPayload }]);

  revalidatePath("/admin");
  revalidatePath("/admin/payments");
  revalidatePath("/admin/payments/requests");
  revalidatePath("/dashboard");
  redirect(`/admin/payments/requests?method=${method}&result=${error ? "error" : "saved"}`);
}

export async function updatePaymentRequest(formData: FormData) {
  const user = await requireAdminUser();
  const adminSupabase = getAdminSupabase();

  if (!user || !adminSupabase) {
    return;
  }

  const paymentId = clean(formData.get("payment_id"));
  const status = clean(formData.get("status"));
  const proofUrl = clean(formData.get("proof_url"));
  const paymentLink = clean(formData.get("payment_link"));
  const adminNote = clean(formData.get("admin_note"));

  if (!paymentId || !paymentStatuses.includes(status as typeof paymentStatuses[number])) {
    return;
  }

  const updatePayload: Record<string, string | null> = {
    status,
    proof_url: proofUrl || null,
    payment_link: paymentLink || null,
    admin_note: adminNote || null,
  };

  if (status === "verified") {
    updatePayload.verified_by = user.id;
    updatePayload.verified_at = new Date().toISOString();
  }

  const { error } = await writeAdminMutation(adminSupabase, {
    actor: user, action: "payment_request.update", targetType: "payment_request", targetId: paymentId,
    details: { status, proofProvided: Boolean(proofUrl), paymentLinkProvided: Boolean(paymentLink) },
  }, [{ table: "payment_requests", operation: "update", data: updatePayload, match: { id: paymentId } }]);
  if (error) redirect("/admin/payments/requests?result=error");

  revalidatePath("/admin");
  revalidatePath("/admin/payments");
  revalidatePath("/admin/payments/requests");
  revalidatePath("/dashboard");
}
