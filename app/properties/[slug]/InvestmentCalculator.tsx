"use client";
import { localeHtmlLang, type Locale } from "../../lib/i18n";
import { formatPropertyMoney, getPropertyProjection, type PropertyReturnBreakdown } from "../../lib/property-financials";
import { formatMinimumInvestment, minimumInvestmentShares } from "../../lib/investment-policy";
import { formatPropertyPercent } from "../property-ui-copy";
import { investmentCopy } from "../../lib/investment-copy";
import { targetReturnCopy, rentalYieldLabel } from "../../lib/target-return-copy";
import { valueGrowthCopy } from "../../lib/value-growth-copy";
import { walletPurchaseCopy } from "../../lib/wallet-purchase-copy";

import { rentalModelCopy } from "../../lib/rental-model-copy";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { CircleDollarSign, Info, WalletCards } from "lucide-react";

type InvestmentCalculatorProps = {
  rentalModel?: "illustrative-eur-nightly";
  annualYield: number | null;
  targetTotalReturn?: number;
  availableShares: number | null;
  copy: InvestmentCalculatorCopy;
  currency?: "EUR";
  fundedPercent: number | null;
  isAuthenticated: boolean;
  minInvestment: number | null;
  locale: Locale;
  monthlyExpenses: number;
  monthlyRent: number | null;
  propertySlug: string;
  propertyTitle: string;
  propertyValue: number | null;
  sharePrice: number;
  totalShares?: number | null;
  returnBreakdown?: PropertyReturnBreakdown;
  /** Projected annual value growth (%), shown separately and never part of the rent projection. */
  valueGrowthRate?: number;
  walletBalance?: number | null;
  purchaseRequestId?: string;
  purchaseAction?: (formData: FormData) => Promise<void>;
};

export type InvestmentCalculatorCopy = {
  dashboardActive: string;
  signInRequired: string;
  title: string;
  text: string;
  propertyValue: string;
  grossYield: string;
  minimum: string;
  sharePrice: string;
  accessAmount: string;
  choosePayoutModel: string;
  monthly: string;
  annual: string;
  amountAria: string;
  enterAmount: string;
  modelledShares: string;
  monthlyGrossIncome: string;
  annualGrossIncome: string;
  propertyExposure: string;
  fundingAfter: string;
  requestAmount: string;
  signInToRequest: string;
  prepareFunding: string;
  note: string;
  onRequest: string;
};


export default function InvestmentCalculator({
  rentalModel,
  annualYield,
  targetTotalReturn,
  availableShares,
  copy,
  currency = "EUR",
  fundedPercent,
  isAuthenticated,
  minInvestment,
  locale,
  monthlyExpenses,
  monthlyRent,
  propertySlug,
  propertyTitle,
  propertyValue,
  sharePrice,
  totalShares: declaredTotalShares,
  returnBreakdown,
  valueGrowthRate = 0,
  walletBalance = null,
  purchaseRequestId: initialPurchaseRequestId,
  purchaseAction,
}: InvestmentCalculatorProps) {
  const text = investmentCopy[locale];
  const rentalText = rentalModelCopy[locale];
  const walletText = walletPurchaseCopy[locale];
  const formatPercent = (value: number, maximumFractionDigits = 2) => formatPropertyPercent(value, locale, maximumFractionDigits);
  const returnText = targetReturnCopy[locale];
  const growthText = valueGrowthCopy[locale];
  const hasTargetReturn = targetTotalReturn !== undefined || Boolean(returnBreakdown);
  const effectiveSharePrice = Math.max(1, sharePrice || minInvestment || 100);
  const maxShares = Math.max(0, Math.floor(availableShares ?? declaredTotalShares ?? (propertyValue || 0) / effectiveSharePrice));
  const minimumShares = minimumInvestmentShares(effectiveSharePrice, minInvestment ?? 0) ?? 1;
  const canInvest = minInvestment !== null && maxShares >= minimumShares;
  const [shareQuantity, setShareQuantity] = useState(String(minimumShares));
  const [payoutMode, setPayoutMode] = useState<"monthly" | "annual">("monthly");
  const [paymentMethod, setPaymentMethod] = useState(isAuthenticated ? "wallet_balance" : "bank_transfer");
  // Keep retries tied to this form even if a server refresh supplies a new UUID.
  const [purchaseRequestId] = useState(initialPurchaseRequestId);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitted = useRef(false);
  const requestedShares = Number(shareQuantity);
  const validQuantity = /^\d+$/.test(shareQuantity) && Number.isSafeInteger(requestedShares) && requestedShares >= minimumShares && requestedShares <= maxShares;
  const balanceAvailable = typeof walletBalance === "number" && Number.isFinite(walletBalance) && walletBalance >= 0;
  const balanceCents = balanceAvailable ? Math.round(walletBalance * 100) : 0;
  const purchaseCents = validQuantity ? Math.round(requestedShares * effectiveSharePrice * 100) : 0;
  const enoughBalance = balanceAvailable && validQuantity && balanceCents >= purchaseCents;
  const isWalletPayment = isAuthenticated && paymentMethod === "wallet_balance";
  const canBuy = canInvest && validQuantity && enoughBalance && Boolean(purchaseAction && purchaseRequestId);
  const canRequest = canInvest && validQuantity;

  function formatAmount(value: number, digits = 2) {
    return formatPropertyMoney(value, currency, locale, digits);
  }

  const calculation = useMemo(() => {
    const requestedShares = Number(shareQuantity);
    const shares = Math.min(maxShares, Math.max(minimumShares, Number.isFinite(requestedShares) ? Math.floor(requestedShares) : minimumShares));
    const grossMonthlyIncome = monthlyRent || 0;
    const netMonthlyIncome = Math.max(0, grossMonthlyIncome - monthlyExpenses);
    const totalShares = declaredTotalShares ?? (propertyValue ? Math.floor(propertyValue / effectiveSharePrice) : maxShares);
    const rentalIncomePerShare = propertyValue ? netMonthlyIncome * effectiveSharePrice / propertyValue : 0;
    const projection = getPropertyProjection({
      currency, price: propertyValue, sharePrice: effectiveSharePrice,
      targetTotalReturn: targetTotalReturn ?? (returnBreakdown ? returnBreakdown.rental + returnBreakdown.vacationPoint + returnBreakdown.appreciation : annualYield ?? 0),
    }, shares);
    const ownershipPercent = propertyValue ? shares * effectiveSharePrice * 100 / propertyValue : 0;
    const fundedAfter = fundedPercent !== null ? Math.min(100, fundedPercent + ownershipPercent) : null;

    return { ...projection, fundedAfter, grossMonthlyIncome, rentalIncomePerShare, netMonthlyIncome, ownershipPercent, totalShares };
  }, [annualYield, currency, declaredTotalShares, effectiveSharePrice, fundedPercent, maxShares, minimumShares, monthlyExpenses, monthlyRent, propertyValue, returnBreakdown, shareQuantity, targetTotalReturn]);

  const contactHref = `/contact?projekt=${encodeURIComponent(propertySlug)}&shares=${calculation.shares}&betrag=${calculation.amount}&currency=${currency}${hasTargetReturn ? "" : `&auszahlung=${payoutMode}`}&payment=${isWalletPayment ? "bank_transfer" : paymentMethod}`;
  const presets = [...new Set([minimumShares, minimumShares * 2, minimumShares * 5, minimumShares * 10])].filter((quantity) => quantity >= minimumShares && quantity <= maxShares);

  function updateShares(value: number) {
    if (submitted.current || !Number.isSafeInteger(value) || value < minimumShares || value > maxShares) return;
    setShareQuantity(String(value));
  }

  return (
    <section className="mt-10 overflow-hidden rounded-lg bg-white shadow-sm">
      <div className="border-b border-line bg-brand px-5 py-7 text-white md:px-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 text-sm font-semibold text-white/90"><CircleDollarSign size={18} />{isAuthenticated ? copy.dashboardActive : copy.signInRequired}</div>
            <h2 className="mt-3 text-3xl font-semibold md:text-4xl">{hasTargetReturn ? returnText.calculatorTitle : copy.title}</h2>
            <p className="mt-3 max-w-3xl text-lg text-white/90">{returnBreakdown ? returnText.calculatorText : hasTargetReturn ? returnText.configuredCalculatorText : copy.text}</p>
          </div>
          <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm sm:grid-cols-4">
            <Metric label={copy.sharePrice} value={formatAmount(effectiveSharePrice)} />
            <Metric label={copy.propertyValue} value={propertyValue ? formatAmount(propertyValue) : copy.onRequest} />
            <Metric label={rentalYieldLabel(locale, monthlyExpenses > 0 || !monthlyRent)} value={annualYield !== null || hasTargetReturn ? formatPercent(calculation.annualRate) : copy.onRequest} />
            <Metric label={text.available} value={maxShares.toLocaleString(localeHtmlLang[locale])} />
          </div>
        </div>
      </div>

      <div className="p-5 md:p-8">
        <p className="mb-2 font-semibold">{text.minimum}: {formatMinimumInvestment(locale, minInvestment ?? undefined)} · {minimumShares} {text.shares} = {formatAmount(minimumShares * effectiveSharePrice)}</p>
        {!canInvest && <p role="status" className="mb-4 rounded-md bg-amber-50 p-4 text-amber-900">{text.unavailable}</p>}
        <div className="mb-7 grid gap-3 rounded-md border border-line bg-canvas p-5 sm:grid-cols-2 lg:grid-cols-5">
          <FormulaItem label={text.propertyValue} value={propertyValue ? formatAmount(propertyValue) : copy.onRequest} />
          <FormulaItem label={text.totalShares} value={calculation.totalShares.toLocaleString(localeHtmlLang[locale])} />
          <FormulaItem label={text.sharePrice} value={formatAmount(effectiveSharePrice)} />
          <FormulaItem label={rentalModel ? rentalText.monthlyShare : returnText.monthlyPerShare} value={formatAmount(rentalModel ? calculation.rentalIncomePerShare : calculation.monthlyPerShare)} />
          <FormulaItem label={rentalModel ? rentalText.annualShare : returnText.annualPerShare} value={formatAmount(rentalModel ? calculation.rentalIncomePerShare * 12 : calculation.annualPerShare)} />
        </div>
        <p className="mb-7 text-sm text-muted">
              {propertyValue ? `${calculation.totalShares.toLocaleString(localeHtmlLang[locale])} ${text.shares} × ${formatAmount(effectiveSharePrice)} = ${formatAmount(calculation.totalShares * effectiveSharePrice)}` : copy.onRequest}
        </p>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-muted">{text.quantity}</p>
            <p className="mt-1 text-3xl font-semibold">{calculation.shares} {calculation.shares === 1 ? text.share : text.shares}</p>
          </div>
          {!hasTargetReturn && <div className="inline-flex rounded-md border border-line p-1" role="group" aria-label={copy.choosePayoutModel}>
            <button type="button" aria-pressed={payoutMode === "monthly"} onClick={() => setPayoutMode("monthly")} className={`px-4 py-2 text-sm font-semibold ${payoutMode === "monthly" ? "bg-ink text-white" : "text-muted"}`}>{copy.monthly}</button>
            <button type="button" aria-pressed={payoutMode === "annual"} onClick={() => setPayoutMode("annual")} className={`px-4 py-2 text-sm font-semibold ${payoutMode === "annual" ? "bg-ink text-white" : "text-muted"}`}>{copy.annual}</button>
          </div>}
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {presets.map((quantity) => (
            <button key={quantity} type="button" disabled={!canInvest || isSubmitting} onClick={() => updateShares(quantity)} className={`min-h-16 rounded-md border px-4 py-3 text-center transition disabled:cursor-not-allowed disabled:opacity-60 ${validQuantity && requestedShares === quantity ? "border-brand bg-brand text-white" : "border-brand text-brand hover:bg-brand-soft"}`}>
              <span className="block font-semibold">{quantity} {quantity === 1 ? text.share : text.shares}</span>
              <span className="mt-1 block text-sm">{formatAmount(quantity * effectiveSharePrice)}</span>
            </button>
          ))}
          <label className="block">
            <span className="sr-only">{text.custom}</span>
            <input disabled={!canInvest || isSubmitting} type="number" min={minimumShares} max={maxShares} step={1} required value={shareQuantity} onChange={(event) => { if (!submitted.current) setShareQuantity(event.target.value); }} aria-invalid={!validQuantity} aria-describedby={!validQuantity && canInvest ? "share-quantity-error" : undefined} aria-label={`${text.custom} ${propertyTitle}`} className="h-16 w-full rounded-md border border-line-strong px-4 text-lg font-semibold outline-none focus:border-brand disabled:opacity-60" />
            <span className="mt-1 block text-sm text-muted">{text.custom}</span>
          </label>
        </div>
        {!validQuantity && canInvest && <p id="share-quantity-error" role="status" className="mt-3 text-sm text-amber-800">{walletText.invalidQuantity.replace("{min}", String(minimumShares)).replace("{max}", String(maxShares))}</p>}

        <div className="mt-8 grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
          <div>
            <label className="block text-sm font-semibold text-muted" htmlFor="payment-method">{text.payment}</label>
            <select id="payment-method" disabled={isSubmitting} value={paymentMethod} onChange={(event) => { if (!submitted.current) setPaymentMethod(event.target.value); }} className="mt-2 min-h-12 w-full rounded-md border border-line-strong bg-white px-4 font-semibold outline-none focus:border-brand disabled:opacity-60">
              {isAuthenticated && <option value="wallet_balance">{walletText.balanceMethod}{balanceAvailable ? ` — ${formatAmount(walletBalance)}` : ""}</option>}
              <option value="bank_transfer">{text.bank}</option>
              <option value="crypto">{text.crypto}</option>
            </select>
            {isWalletPayment && <div className="mt-4 grid gap-3 rounded-md bg-brand-soft p-5" aria-live="polite">
              {balanceAvailable ? <>
                <SummaryRow label={walletText.availableBalance} value={formatAmount(walletBalance)} />
                {enoughBalance && <SummaryRow label={walletText.balanceAfterPurchase} value={formatAmount((balanceCents - purchaseCents) / 100)} />}
                {validQuantity && !enoughBalance && <p role="status" className="text-sm text-amber-800">{walletText.insufficientBalance}</p>}
              </> : <p role="status" className="text-sm text-amber-800">{walletText.balanceUnavailable}</p>}
            </div>}
            <div className="mt-4 grid gap-3 rounded-md bg-canvas p-5">
              <SummaryRow label={text.grossMonthly} value={formatAmount(calculation.grossMonthlyIncome, 2)} />
              <SummaryRow label={text.costs} value={monthlyExpenses > 0 ? `-${formatAmount(monthlyExpenses, 2)}` : "—"} />
              <SummaryRow label={text.netIncome} value={formatAmount(calculation.netMonthlyIncome, 2)} />
              <SummaryRow label={text.incomePerShare} value={formatAmount(calculation.rentalIncomePerShare, 2)} />
              <SummaryRow label={copy.sharePrice} value={formatAmount(effectiveSharePrice, 2)} />
              <SummaryRow label={copy.modelledShares} value={String(calculation.shares)} />
              <SummaryRow label={text.fees} value={formatAmount(0, 2)} />
              <SummaryRow label={text.total} value={formatAmount(calculation.amount, 2)} strong />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <Result label={`${returnText.annualTarget} · ${formatPercent(calculation.annualRate)}`} value={formatAmount(calculation.annual)} />
            <Result label={rentalModel ? rentalText.monthlyInvestor : returnText.monthlyTarget} value={formatAmount(rentalModel ? calculation.rentalIncomePerShare * calculation.shares : calculation.monthly)} />
            {/* A rental scenario already shows modelled net rent; a second monthly rental figure would contradict it. */}
            {returnBreakdown && !rentalModel && <Result label={returnText.monthlyRentalTarget} value={formatAmount(calculation.amount * returnBreakdown.rental / 100 / 12)} />}
            {valueGrowthRate > 0 && <>
              <Result label={`${growthText.growthYear} · ${formatPercent(valueGrowthRate)}`} value={formatAmount(calculation.amount * valueGrowthRate / 100)} />
              <Result label={`${growthText.totalYear} · ${formatPercent(calculation.annualRate + valueGrowthRate)}`} value={formatAmount(calculation.annual + calculation.amount * valueGrowthRate / 100)} />
              <Result label={growthText.totalMonth} value={formatAmount((calculation.annual + calculation.amount * valueGrowthRate / 100) / 12)} />
            </>}
            {returnBreakdown ? (
              <div className="grid gap-3 rounded-md bg-canvas p-5">
                <h3 className="text-sm font-semibold text-ink">{returnText.breakdownTitle}</h3>
                <SummaryRow label={`${returnText.rental} · ${formatPercent(returnBreakdown.rental)}`} value={formatAmount(calculation.amount * returnBreakdown.rental / 100, 2)} />
                <SummaryRow label={`${returnText.vacationPoint} · ${formatPercent(returnBreakdown.vacationPoint)}`} value={formatAmount(calculation.amount * returnBreakdown.vacationPoint / 100, 2)} />
                <SummaryRow label={`${returnText.appreciation} · ${formatPercent(returnBreakdown.appreciation)}`} value={formatAmount(calculation.amount * returnBreakdown.appreciation / 100, 2)} />
              </div>
            ) : null}
            <Result label={copy.propertyExposure} value={formatPercent(calculation.ownershipPercent, 4)} />
          </div>
        </div>

        {calculation.fundedAfter !== null && <div className="mt-7"><div className="mb-2 flex justify-between text-sm font-semibold text-muted"><span>{copy.fundingAfter}</span><span>{formatPercent(calculation.fundedAfter)}</span></div><div className="h-2 bg-line"><div className="h-2 bg-brand" style={{ width: `${calculation.fundedAfter}%` }} /></div></div>}

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          {isWalletPayment ? <form action={purchaseAction} onSubmit={(event) => {
            if (submitted.current || !canBuy) {
              event.preventDefault();
              return;
            }
            submitted.current = true;
            setIsSubmitting(true);
          }} className="flex w-full flex-1 sm:w-auto" aria-busy={isSubmitting}>
            <input type="hidden" name="property_slug" value={propertySlug} />
            <input type="hidden" name="shares" value={shareQuantity} />
            <input type="hidden" name="payment_method" value="wallet_balance" />
            <input type="hidden" name="purchase_request_id" value={purchaseRequestId ?? ""} />
            <button type="submit" disabled={!canBuy || isSubmitting} className="inline-flex min-h-12 w-full items-center justify-center rounded-lg bg-brand px-7 font-semibold text-white hover:bg-brand-strong disabled:cursor-not-allowed disabled:opacity-50">{isSubmitting ? walletText.buying : walletText.buyNow}</button>
          </form> : <Link aria-disabled={!canRequest || isSubmitting} tabIndex={canRequest && !isSubmitting ? undefined : -1} onClick={(event) => { if (!canRequest || submitted.current) event.preventDefault(); }} href={canRequest ? (isAuthenticated ? contactHref : `/join?next=${encodeURIComponent(`/properties/${propertySlug}`)}`) : "#"} className="inline-flex min-h-12 flex-1 items-center justify-center rounded-md bg-brand px-7 font-semibold text-white hover:bg-ink">{isAuthenticated ? walletText.requestReview : copy.signInToRequest}</Link>}
          {isWalletPayment && <Link href={canRequest ? contactHref : "#"} aria-disabled={!canRequest || isSubmitting} tabIndex={canRequest && !isSubmitting ? undefined : -1} onClick={event => { if (!canRequest || submitted.current) event.preventDefault(); }} className="inline-flex min-h-12 items-center justify-center rounded-md border border-brand px-7 font-semibold text-brand">{walletText.requestReview}</Link>}
          {isAuthenticated && <Link href="/funding" className="inline-flex min-h-12 w-full items-center justify-center rounded-md border border-brand px-7 font-semibold text-brand sm:w-auto"><WalletCards className="mr-2" size={19} />{copy.prepareFunding}</Link>}
        </div>

        <p className="mt-6 flex gap-2 text-sm leading-6 text-muted"><Info className="mt-0.5 shrink-0" size={17} /><span>{rentalModel ? (returnBreakdown ? `${rentalText.note} ${returnText.modelNote}` : rentalText.note) : returnBreakdown ? `${returnText.modelNote} ${returnText.calculatorNote}` : hasTargetReturn ? `${returnText.configuredTargetNote}${monthlyRent && !monthlyExpenses ? ` ${returnText.costsMissingNote}` : ""}` : copy.note}{valueGrowthRate > 0 ? ` ${growthText.note}` : ""}</span></p>
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div><p className="text-xs text-white/90">{label}</p><p className="mt-1 text-lg font-semibold">{value}</p></div>;
}

function Result({ label, value }: { label: string; value: string }) {
  return <div className="rounded-md bg-brand-soft p-5"><p className="text-sm font-semibold text-muted">{label}</p><p className="mt-2 text-2xl font-semibold text-ink">{value}</p></div>;
}

function SummaryRow({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return <div className={`flex items-center justify-between gap-4 ${strong ? "border-t border-line pt-3 text-lg font-semibold" : "text-sm"}`}><span className="text-muted">{label}</span><span className="font-semibold text-ink">{value}</span></div>;
}

function FormulaItem({ label, value }: { label: string; value: string }) {
  return <div><p className="text-xs text-muted">{label}</p><p className="mt-1 text-lg font-semibold text-ink">{value}</p></div>;
}
