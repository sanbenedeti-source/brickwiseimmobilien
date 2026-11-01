"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isPropertyOpenForInvestment } from "../lib/external-properties";
import { findProperty } from "../lib/property-registry";
import { canPurchaseShares } from "../lib/investment-policy";
import { getPropertyCurrency, getPropertyProjection, getPropertyReturnBreakdown, getPropertyShareSupply } from "../lib/property-financials";


export async function createContactRequest(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const firstName = String(formData.get("first_name") || "").trim();
  const lastName = String(formData.get("last_name") || "").trim();
  const email = String(formData.get("email") || "").trim();
  const phone = String(formData.get("phone") || "").trim();
  const topic = String(formData.get("topic") || "").trim();
  const submittedMessage = String(formData.get("message") || "").trim();
  const propertyId = String(formData.get("property_id") || "").trim();
  const company = String(formData.get("company") || "").trim();
  const message = submittedMessage || (topic === "Floating website registration form"
    ? "New registration of interest submitted through the floating website form."
    : "");

  const name = `${firstName} ${lastName}`.trim();

  if (company) {
    redirect("/thank-you");
  }

  if (!name || !email || !message || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) redirect("/contact?error=invalid");

  if (name.length > 120 || email.length > 254 || message.length > 2000) {
    redirect("/contact?error=invalid");
  }

  const investmentSlug = String(formData.get("investment_slug") || "");
  let investmentSummary = "";
  if (investmentSlug || formData.has("investment_shares")) {
    const property = await findProperty(investmentSlug);
    const shares = Number(formData.get("investment_shares"));
    if (!property || !isPropertyOpenForInvestment(property)) redirect("/contact?error=investment");
    const currency = getPropertyCurrency(property);
    const minimumAmount = property.minInvestmentEur;
    const { data: settings } = await supabase.from("property_share_settings")
      .select("total_shares,blocked_shares").eq("property_slug", investmentSlug).maybeSingle();
    const { available } = getPropertyShareSupply(property, settings ?? undefined);
    if (!minimumAmount || !canPurchaseShares(shares, property.sharePrice, minimumAmount, available)) redirect("/contact?error=investment");
    const returnBreakdown = getPropertyReturnBreakdown(property);
    const projection = getPropertyProjection(property, shares);
    investmentSummary = [
      "Share purchase request",
      `Property: ${property.title}`,
      `Property slug: ${property.slug}`,
      `Shares: ${shares}`,
      `Price per share: ${property.sharePrice.toFixed(2)} ${currency}`,
      `Total amount: ${(shares * property.sharePrice).toFixed(2)} ${currency}`,
      `Minimum: ${minimumAmount} EUR`,
      `Projected rental yield: ${projection.annualRate.toFixed(2)}%`,
      `Projected net rent per year: ${projection.annual.toFixed(2)} ${currency}`,
      `Projected net rent per month: ${projection.monthly.toFixed(2)} ${currency}`,
      ...(returnBreakdown ? [
        `Rental: ${returnBreakdown.rental.toFixed(2)}%`,
        `Vacation point: ${returnBreakdown.vacationPoint.toFixed(2)}%`,
        `Appreciation: ${returnBreakdown.appreciation.toFixed(2)}% (not a daily cash flow)`,
        "The annual target includes non-cash benefits. Its monthly equivalent is annual / 12, not a guaranteed rental payment.",
      ] : []),
      "",
      "",
    ].join("\n");
  }

  const finalMessage = topic
    ? `Thema: ${topic.slice(0, 80)}\n\n${message}`
    : message;

  const { error } = await supabase.from("property_requests").insert({
    user_id: user?.id || null,
    name,
    email,
    phone,
    message: investmentSummary + finalMessage,
    property_id: propertyId || null,
    status: "new",
  });

  if (error) {
    console.error("Fehler beim Speichern der Anfrage:", error.message);
    redirect("/contact?error=save");
  }

  revalidatePath("/admin");
  redirect("/thank-you?conversion=lead");
}
