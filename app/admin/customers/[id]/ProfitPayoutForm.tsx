"use client";

import { useActionState } from "react";
import { Coins } from "lucide-react";
import { payClientProfit, type ProfitState } from "./actions";

type Labels = Record<"property" | "amount" | "note" | "notePlaceholder" | "confirm" | "submit" | "saved" | "error" | "amountError" | "holding" | "next", string>;

/** One payout per request key (from the server). "New payout" reloads the page for a fresh key. */
export default function ProfitPayoutForm({ userId, holdings, labels, requestKey }: { userId: string; holdings: { slug: string; title: string; shares: number }[]; labels: Labels; requestKey: string }) {
  const [state, action, pending] = useActionState(payClientProfit, { result: "" } as ProfitState);
  if (state.result === "saved") return <div className="admin-form">
    <p role="status" className="admin-alert admin-alert-success !mb-0">{labels.saved}</p>
    <div><button type="button" className="admin-btn admin-btn-secondary" onClick={() => window.location.reload()}>{labels.next}</button></div>
  </div>;
  return <form action={action} className="admin-form">
    <input type="hidden" name="user_id" value={userId} />
    <input type="hidden" name="client_key" value={requestKey} />
    <div className="admin-form-grid">
      <label className="admin-field">{labels.property}
        <select name="property_slug" required defaultValue={holdings.length === 1 ? holdings[0].slug : ""}>
          {holdings.length !== 1 && <option value="" disabled>—</option>}
          {holdings.map((holding) => <option key={holding.slug} value={holding.slug}>{holding.title} · {holding.shares}</option>)}
        </select>
      </label>
      <label className="admin-field">{labels.amount}<input name="amount" required inputMode="decimal" pattern="[0-9]+([.,][0-9]{1,2})?" placeholder="125.00" /></label>
      <label className="admin-field admin-field-wide">{labels.note}<input name="note" maxLength={300} placeholder={labels.notePlaceholder} /></label>
    </div>
    <label className="admin-check"><input type="checkbox" name="confirm" value="yes" required /><span>{labels.confirm}</span></label>
    {state.result && <p role="alert" className="admin-alert admin-alert-danger !mb-0">{state.result === "amount" ? labels.amountError : state.result === "holding" ? labels.holding : labels.error}</p>}
    <div><button disabled={pending} className="admin-btn"><Coins size={15} aria-hidden="true" />{labels.submit}</button></div>
  </form>;
}
