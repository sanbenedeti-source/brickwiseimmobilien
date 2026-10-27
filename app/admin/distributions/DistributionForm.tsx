"use client";

import { useActionState } from "react";
import { Coins } from "lucide-react";
import { recordDistribution, type DistributionState } from "./actions";

type Labels = { property: string; start: string; end: string; amount: string; note: string; confirm: string; submit: string; saved: string; error: string };

export default function DistributionForm({ properties, labels, today }: { properties: { slug: string; title: string }[]; labels: Labels; today: string }) {
  const [state, action, pending] = useActionState(recordDistribution, { result: "" } as DistributionState);
  return <form action={action} className="admin-form">
    <div className="admin-form-grid">
      <label className="admin-field admin-field-wide">{labels.property}
        <select name="property_slug" required defaultValue="">
          <option value="" disabled>—</option>
          {properties.map((property) => <option key={property.slug} value={property.slug}>{property.title}</option>)}
        </select>
      </label>
      <label className="admin-field">{labels.start}<input type="date" name="period_start" required max={today} /></label>
      <label className="admin-field">{labels.end}<input type="date" name="period_end" required max={today} /></label>
      <label className="admin-field">{labels.amount}<input name="net_amount" required inputMode="decimal" pattern="[0-9]+([.,][0-9]{1,2})?" placeholder="1500.00" /></label>
      <label className="admin-field">{labels.note}<input name="note" maxLength={1000} /></label>
    </div>
    <label className="admin-check"><input type="checkbox" name="confirm" value="yes" required /><span>{labels.confirm}</span></label>
    {state.result === "saved" && <p role="status" className="admin-alert admin-alert-success !mb-0">{labels.saved}</p>}
    {state.result === "error" && <p role="alert" className="admin-alert admin-alert-danger !mb-0">{labels.error}</p>}
    <div><button disabled={pending} className="admin-btn"><Coins size={15} aria-hidden="true" />{labels.submit}</button></div>
  </form>;
}
