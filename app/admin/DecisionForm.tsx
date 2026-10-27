"use client";

import { useActionState } from "react";

type State = { result: "" | "saved" | "error" };
type Decision = { value: string; label: string; tone: "success" | "danger" | "neutral" };

/** Note + decision buttons shared by the admin review queues (KYC, withdrawals, sale requests). */
export default function DecisionForm({ action, hidden, decisions, noteLabel, savedLabel, errorLabel, extraField }: {
  action: (state: State, form: FormData) => Promise<State>;
  hidden: Record<string, string>;
  decisions: Decision[];
  noteLabel: string;
  savedLabel: string;
  errorLabel: string;
  extraField?: { name: string; label: string; required?: boolean; placeholder?: string };
}) {
  const [state, formAction, pending] = useActionState(action, { result: "" } as State);
  if (state.result === "saved") return <p role="status" className="admin-alert admin-alert-success !mb-0">{savedLabel}</p>;
  return <form action={formAction} className="admin-form">
    {Object.entries(hidden).map(([name, value]) => <input key={name} type="hidden" name={name} value={value} />)}
    <div className="admin-form-grid">
      {extraField && <label className="admin-field">{extraField.label}<input name={extraField.name} required={extraField.required} placeholder={extraField.placeholder} maxLength={200} /></label>}
      <label className={`admin-field ${extraField ? "" : "admin-field-wide"}`}>{noteLabel}<textarea name="note" required minLength={3} maxLength={1000} rows={2} /></label>
    </div>
    {state.result === "error" && <p role="alert" className="admin-alert admin-alert-danger !mb-0">{errorLabel}</p>}
    <div className="flex flex-wrap gap-2">{decisions.map((decision) => <button key={decision.value} name="decision" value={decision.value} disabled={pending}
      className={`admin-btn ${decision.tone === "success" ? "admin-btn-success" : decision.tone === "danger" ? "admin-btn-danger-outline" : "admin-btn-secondary"}`}>{decision.label}</button>)}</div>
  </form>;
}
