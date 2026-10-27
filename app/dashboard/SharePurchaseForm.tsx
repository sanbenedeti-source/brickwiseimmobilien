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
  return <div className="grid gap-2 sm:grid-cols-2" aria-busy={pending}>
    <button type="submit" name="payment_method" value="wallet_balance" disabled={pending || !canBuy} className="min-h-11 rounded-lg bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-strong disabled:cursor-not-allowed disabled:bg-slate-300">{pending ? text.buying : text.buyWallet}</button>
    <button type="submit" name="payment_method" value={reviewMethod} disabled={pending || !canRequest} className="min-h-11 rounded-lg border border-line bg-white px-4 text-sm font-semibold text-ink hover:bg-canvas disabled:cursor-not-allowed disabled:opacity-50">{text.requestReview}</button>
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
  }} className="mt-4 grid gap-3 rounded-xl border border-line bg-canvas p-4">
    <input type="hidden" name="purchase_request_id" value={requestId} />
    <input type="hidden" name="property_slug" value={propertySlug} />
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="text-xs font-semibold text-muted">{copy.shares}<input name="shares" type="number" min={minimumShares ?? 1} max={availableShares} step={1} required readOnly={locked} value={quantity} onChange={event => { if (!submitting.current) setQuantity(event.target.value); }} className="mt-1.5 h-11 w-full rounded-lg border border-line-strong bg-white px-3 text-sm font-semibold tabular-nums text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15" /></label>
      <label className="text-xs font-semibold text-muted">{text.requestReview} · {copy.payment}<select disabled={locked} value={reviewMethod} onChange={event => setReviewMethod(event.target.value)} className="mt-1.5 h-11 w-full rounded-lg border border-line-strong bg-white px-3 text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15"><option value="bank_transfer">{copy.bank}</option><option value="crypto">{copy.crypto}</option></select></label>
    </div>
    <dl className="divide-y divide-line rounded-lg border border-line bg-white px-3 text-sm" aria-live="polite">
      <div className="flex justify-between gap-3 py-2"><dt className="text-muted">{text.availableBalance}</dt><dd className="font-semibold tabular-nums">{balanceKnown ? money(balanceCents) : text.balanceUnavailable}</dd></div>
      {canRequest && <div className="flex justify-between gap-3 py-2"><dt className="text-muted">{copy.amount}</dt><dd className="font-semibold tabular-nums">{money(costCents)}</dd></div>}
      {canBuy && <div className="flex justify-between gap-3 py-2"><dt className="text-muted">{text.balanceAfterPurchase}</dt><dd className="font-semibold tabular-nums">{money(balanceCents - costCents)}</dd></div>}
    </dl>
    {canRequest && balanceKnown && !canBuy && <p className="text-xs leading-5 text-amber-800">{text.insufficientBalance}</p>}
    {!canRequest && <p className="text-xs leading-5 text-amber-800">{text.invalidQuantity.replace("{min}", String(minimumShares ?? 1)).replace("{max}", String(availableShares))}</p>}
    <PurchaseButtons canBuy={canBuy && !locked} canRequest={canRequest && !locked} reviewMethod={reviewMethod} locale={locale} />
    <p className="text-xs leading-5 text-muted">{text.instantNote}</p>
  </form>;
}
