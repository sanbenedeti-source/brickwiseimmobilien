"use client";

import { useActionState, useState } from "react";
import { ArrowDownToLine, CheckCircle2 } from "lucide-react";
import type { Locale } from "../lib/i18n";
import { localeHtmlLang } from "../lib/i18n";
import { portalCopy } from "../lib/portal-copy";
import { requestWithdrawal, type WithdrawState } from "./portal-actions";
import { fieldClass, primaryButtonClass } from "./portal-ui";

export default function WithdrawForm({ locale, balance, holder, requestKey }: { locale: Locale; balance: number | null; holder: string; requestKey: string }) {
  const text = portalCopy[locale];
  // One key per request: a resubmitted form returns the same request instead of creating a duplicate.
  const [key, setKey] = useState(requestKey);
  const [state, action, pending] = useActionState(async (previous: WithdrawState, form: FormData) => {
    const next = await requestWithdrawal(previous, form);
    if (next.result === "saved") setKey(crypto.randomUUID());
    return next;
  }, { result: "" } as WithdrawState);
  const errors: Partial<Record<WithdrawState["result"], string>> = { kyc: text.withdrawKycRequired, amount: text.withdrawAmountError, iban: text.withdrawIbanError, funds: text.withdrawFundsError, error: text.withdrawError };
  const money = (value: number) => value.toLocaleString(localeHtmlLang[locale], { style: "currency", currency: "EUR" });
  return <form action={action} className="grid gap-4">
    <input type="hidden" name="client_key" value={key} />
    <p className="text-sm text-muted">{text.availableBalance}: <strong className="tabular-nums text-ink">{balance === null ? "—" : money(balance)}</strong></p>
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="text-xs font-semibold text-muted">{text.withdrawAmount}<input name="amount" required inputMode="decimal" pattern="[0-9]+([.,][0-9]{1,2})?" placeholder="250.00" className={`${fieldClass} font-semibold tabular-nums`} /></label>
      <label className="text-xs font-semibold text-muted">{text.accountHolder}<input name="account_holder" required minLength={2} maxLength={140} defaultValue={holder} autoComplete="name" className={fieldClass} /></label>
      <label className="text-xs font-semibold text-muted">{text.iban}<input name="iban" required minLength={15} maxLength={42} autoComplete="off" spellCheck={false} placeholder="DE89 3704 0044 0532 0130 00" className={`${fieldClass} font-mono uppercase`} /></label>
      <label className="text-xs font-semibold text-muted">{text.bic}<input name="bic" maxLength={11} autoComplete="off" spellCheck={false} className={`${fieldClass} font-mono uppercase`} /></label>
    </div>
    {state.result === "saved" && <p role="status" className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800"><CheckCircle2 size={16} className="mt-0.5 shrink-0" aria-hidden="true" />{text.withdrawSaved}</p>}
    {errors[state.result] && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{errors[state.result]}</p>}
    <div><button disabled={pending} className={`${primaryButtonClass} disabled:opacity-60`}><ArrowDownToLine size={16} aria-hidden="true" />{pending ? text.withdrawSubmitting : text.withdrawSubmit}</button></div>
  </form>;
}
