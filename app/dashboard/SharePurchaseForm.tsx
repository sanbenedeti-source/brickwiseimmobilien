"use client";

import { useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import type { Locale } from "../lib/i18n";
import { formatPropertyMoney } from "../lib/property-financials";
import { walletPurchaseCopy } from "../lib/wallet-purchase-copy";
import type { DashboardCardCopy } from "./PropertyInvestmentCard";

function PurchaseButtons({ canBuy, canRequest, reviewMethod, locale }: { canBuy: boolean; canRequest: boolean; reviewMethod: string; locale: Locale }) {
  const { pending } = useFormStatus();
  const text = walletPurchaseCopy[locale];
  return <div className="grid gap-3" aria-busy={pending}>
    <button type="submit" name="payment_method" value="wallet_balance" disabled={pending || !canBuy} className="min-h-12 rounded-lg bg-[#2f9bdb] px-4 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-300">{pending ? text.buying : text.buyWallet}</button>
    <button type="submit" name="payment_method" value={reviewMethod} disabled={pending || !canRequest} className="min-h-12 rounded-lg border border-[#2f9bdb] px-4 text-sm font-bold text-[#237faf] disabled:cursor-not-allowed disabled:opacity-50">{text.requestReview}</button>
  </div>;
}

export default function SharePurchaseForm({ action, purchaseRequestId, propertySlug, minimumShares, availableShares, sharePrice, walletBalance, locale, copy }: {
  action: (formData: FormData) => Promise<void>; purchaseRequestId: string; propertySlug: string;
  minimumShares: number | null; availableShares: number; sharePrice: number; walletBalance: number | null; locale: Locale; copy: DashboardCardCopy;
}) {
  const [requestId] = useState(purchaseRequestId);
  const [quantity, setQuantity] = useState(String(minimumShares ?? 1));
  const [reviewMethod, setReviewMethod] = useState("bank_transfer");
  const [locked, setLocked] = useState(false);
  const submitting = useRef(false);
  const text = walletPurchaseCopy[locale];
  const shares = Number(quantity);
  const canRequest = minimumShares !== null && /^\d+$/.test(quantity) && Number.isSafeInteger(shares) && shares >= minimumShares && shares <= availableShares;
  const balanceKnown = walletBalance !== null && Number.isFinite(walletBalance) && walletBalance >= 0;
  const balanceCents = balanceKnown ? Math.round(walletBalance * 100) : 0;
  const costCents = canRequest ? Math.round(shares * sharePrice * 100) : 0;
  const canBuy = canRequest && balanceKnown && balanceCents >= costCents;
  const money = (cents: number) => formatPropertyMoney(cents / 100, "EUR", locale, 2);
  async function submit(formData: FormData) {
    try { await action(formData); }
    finally { submitting.current = false; setLocked(false); }
  }
  return <form action={submit} onSubmit={event => {
    const method = (event.nativeEvent as SubmitEvent).submitter?.getAttribute("value");
    if (submitting.current || !canRequest || (method === "wallet_balance" && !canBuy)) { event.preventDefault(); return; }
    submitting.current = true;
    setLocked(true);
  }} className="mt-5 grid gap-3 border-t border-[#e6e9ed] pt-5">
    <input type="hidden" name="purchase_request_id" value={requestId} />
    <input type="hidden" name="property_slug" value={propertySlug} />
    <label className="text-xs font-bold text-[#596579]">{copy.shares}<input name="shares" type="number" min={minimumShares ?? 1} max={availableShares} step={1} required readOnly={locked} value={quantity} onChange={event => { if (!submitting.current) setQuantity(event.target.value); }} className="mt-2 h-11 w-full rounded-lg border border-[#d7dee6] px-3 text-base" /></label>
    <div className="space-y-2 rounded-lg bg-sky-50 p-3 text-sm" aria-live="polite">
      <p>{text.availableBalance}: <strong>{balanceKnown ? money(balanceCents) : text.balanceUnavailable}</strong></p>
      {canRequest && <p>{copy.amount}: <strong>{money(costCents)}</strong></p>}
      {canBuy && <p>{text.balanceAfterPurchase}: <strong>{money(balanceCents - costCents)}</strong></p>}
      {canRequest && balanceKnown && !canBuy && <p className="text-amber-800">{text.insufficientBalance}</p>}
      {!canRequest && <p className="text-amber-800">{text.invalidQuantity.replace("{min}", String(minimumShares ?? 1)).replace("{max}", String(availableShares))}</p>}
    </div>
    <label className="text-xs font-bold text-[#596579]">{text.requestReview} · {copy.payment}<select disabled={locked} value={reviewMethod} onChange={event => setReviewMethod(event.target.value)} className="mt-2 h-11 w-full rounded-lg border border-[#d7dee6] bg-white px-3 text-base"><option value="bank_transfer">{copy.bank}</option><option value="crypto">{copy.crypto}</option></select></label>
    <PurchaseButtons canBuy={canBuy && !locked} canRequest={canRequest && !locked} reviewMethod={reviewMethod} locale={locale} />
    <p className="text-xs leading-5 text-slate-500">{text.instantNote}</p>
  </form>;
}
