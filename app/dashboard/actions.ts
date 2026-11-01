"use server";

import { canPurchaseShares } from "../lib/investment-policy";
import { getPropertyCurrency, getPropertyProjection, getPropertyReturnBreakdown, getPropertyShareSupply } from "../lib/property-financials";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isPropertyOpenForInvestment } from "@/app/lib/external-properties";
import { findProperty } from "@/app/lib/property-registry";
import { isAdminUser } from "@/app/lib/admin";
import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

const allowedMethods = new Set(["bank_transfer", "crypto", "wallet_balance"]);
const purchaseRequestIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function completeWalletPurchase(slug: string): never {
  for (const path of ["/dashboard", "/dashboard/wallet", "/dashboard/assets", "/dashboard/income", "/dashboard/orders", "/dashboard/marketplace", "/properties", `/properties/${slug}`, "/admin"]) {
    revalidatePath(path);
  }
  redirect("/dashboard/orders?request=purchased");
}

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key
    ? createSupabaseClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
    : null;
}

function money(value: number, currency: "EUR") {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency,
    currencyDisplay: "code",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export async function createSharePurchaseRequest(formData: FormData) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user?.email) redirect("/sign-in");
  // Administrators never buy shares with the admin account.
  if (isAdminUser(user)) redirect("/admin");
  const userId = user.id;

  const slug = String(formData.get("property_slug") || "");
  const requestedShares = Number(formData.get("shares"));
  const paymentMethod = String(formData.get("payment_method") || "");
  const submittedRequestId = formData.get("purchase_request_id");
  // Catalogue listing or a property added in the admin panel; prices always come from the server.
  const property = await findProperty(slug);

  if (!property || !Number.isSafeInteger(requestedShares) || requestedShares < 1 || !allowedMethods.has(paymentMethod)
    || (paymentMethod === "wallet_balance" && submittedRequestId === null)
    || (submittedRequestId !== null && (typeof submittedRequestId !== "string" || !purchaseRequestIdPattern.test(submittedRequestId)))) {
    redirect("/dashboard?request=invalid#properties");
  }

  const currency = getPropertyCurrency(property);
  // The property tier sets the minimum (standard €2,000, premium €20,000, super premium €50,000).
  const minimumAmount = property.minInvestmentEur;
  if (!canPurchaseShares(requestedShares, property.sharePrice, minimumAmount, Number.MAX_SAFE_INTEGER)) {
    redirect("/dashboard?request=invalid#properties");
  }

  const projection = getPropertyProjection(property, requestedShares);
  const totalAmount = projection.amount;
  const admin = paymentMethod === "wallet_balance" ? getAdminClient() : null;
  const purchaseRequestId = typeof submittedRequestId === "string" ? submittedRequestId.toLowerCase() : null;
  const idempotencyKey = `wallet-purchase:${userId}:${purchaseRequestId}`;

  // A retry may arrive after its purchase consumed the remaining balance or stock.
  // Read only this customer's operation and verify the entire trusted purchase.
  async function isCompletedPurchase() {
    if (!admin || !purchaseRequestId) return false;
    const { data: previous, error } = await admin.from("wallet_transactions")
      .select("user_id,type,direction,property_slug,shares,amount,currency")
      .eq("user_id", userId).eq("idempotency_key", idempotencyKey).maybeSingle();
    if (error) redirect("/dashboard?request=error#properties");
    if (!previous) return false;
    if (previous.user_id !== userId || previous.type !== "purchase" || previous.direction !== "debit"
      || previous.property_slug !== slug || Number(previous.shares) !== requestedShares
      || Number(previous.amount) !== Math.round(totalAmount * 100) / 100 || previous.currency !== currency) {
      redirect("/dashboard?request=invalid#properties");
    }
    return true;
  }

  if (paymentMethod === "wallet_balance" && !admin) redirect("/dashboard?request=error#properties");
  if (await isCompletedPurchase()) completeWalletPurchase(slug);
  if (!isPropertyOpenForInvestment(property)) redirect("/dashboard?request=invalid#properties");

  const { data: shareSetting, error: shareSettingError } = await supabase.from("property_share_settings").select("total_shares,blocked_shares").eq("property_slug", slug).maybeSingle();
  if (shareSettingError) redirect("/dashboard?request=error#properties");
  const { available: availableShares } = getPropertyShareSupply(property, shareSetting ?? undefined);
  if (!canPurchaseShares(requestedShares, property.sharePrice, minimumAmount, availableShares)) {
    if (await isCompletedPurchase()) completeWalletPurchase(slug);
    redirect("/dashboard?request=invalid#properties");
  }

  const returnBreakdown = getPropertyReturnBreakdown(property);
  const methodLabel = paymentMethod === "crypto" ? "Cryptocurrency" : paymentMethod === "wallet_balance" ? "Wallet balance" : "Bank transfer";
  const name = String(user.user_metadata?.full_name || user.email.split("@")[0] || "Client");

  const message = [
    "Share purchase request",
    `Property: ${property.title}`,
    `Property slug: ${property.slug}`,
    `Shares: ${requestedShares}`,
    `Price per share: ${money(property.sharePrice, currency)}`,
    `Total amount: ${money(totalAmount, currency)}`,
    `Projected rental yield: ${projection.annualRate.toFixed(2)}%`,
    ...(returnBreakdown ? [
      `Rental: ${returnBreakdown.rental.toFixed(2)}%`,
      `Vacation point: ${returnBreakdown.vacationPoint.toFixed(2)}%`,
      `Appreciation: ${returnBreakdown.appreciation.toFixed(2)}% (not a daily cash flow)`,
      "The annual target includes non-cash benefits. Its monthly equivalent is annual / 12, not a guaranteed rental payment.",
    ] : []),
    `Payment method: ${methodLabel}`,
    `Projected net rent per day: ${money(projection.annual / 365.2425, currency)}`,
    `Projected net rent per week: ${money(projection.annual / 52.1775, currency)}`,
    `Projected net rent per month: ${money(projection.monthly, currency)}`,
    `Projected net rent per year: ${money(projection.annual, currency)}`,
    "Next step: Agent must contact the client and provide verified payment instructions.",
  ].join("\n");

  const requestPayload = {
    user_id: user.id,
    name,
    email: user.email,
    phone: String(user.user_metadata?.phone || ""),
    message,
    status: paymentMethod === "wallet_balance" ? "completed" : "new",
  };

  if (paymentMethod === "wallet_balance") {
    if (!admin) redirect("/dashboard?request=error#properties");

    requestPayload.message = message.replace(
      "Next step: Agent must contact the client and provide verified payment instructions.",
      "Wallet transaction: Completed instantly from available funds.",
    );
    const { error } = await admin.rpc("purchase_shares_with_wallet_atomic", {
      p_user_id: user.id,
      p_property_slug: slug,
      p_property_title: property.title,
      p_shares: requestedShares,
      p_price_per_share: property.sharePrice,
      p_customer_name: name,
      p_customer_email: user.email,
      p_phone: String(user.user_metadata?.phone || ""),
      p_message: requestPayload.message,
      p_idempotency_key: idempotencyKey,
    });
    // Concurrent retries are rolled back by the ledger's unique operation key.
    // Confirm the committed operation before interpreting balance/stock errors.
    if (error && await isCompletedPurchase()) completeWalletPurchase(slug);
    if (error?.message.includes("insufficient_funds")) redirect("/dashboard?request=insufficient#properties");
    if (error?.message.includes("insufficient_shares")) redirect("/dashboard?request=invalid#properties");
    if (error) redirect("/dashboard?request=error#properties");
    completeWalletPurchase(slug);
  }

  const { error } = await supabase.from("property_requests").insert(requestPayload);

  if (error) {
    console.error("Share purchase request failed:", error.message);
    redirect("/dashboard?request=error#properties");
  }

  revalidatePath("/dashboard");
  revalidatePath("/admin");
  redirect("/dashboard/orders?request=sent");
}
