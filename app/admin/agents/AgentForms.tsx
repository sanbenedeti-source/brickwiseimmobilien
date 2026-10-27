"use client";

import { useActionState } from "react";
import { assignAgent, saveAgent, type AgentState } from "./actions";

type Labels = Record<"firstName" | "lastName" | "email" | "whatsapp" | "phoneHint" | "title" | "codeHint" | "uniqueCode" | "languages" | "active" | "save" | "saved" | "error" | "contact" | "duplicate" | "client" | "agent" | "none" | "assign", string>;
type Agent = { id: string; code: string; first_name: string | null; last_name: string | null; full_name: string; title: string; email: string | null; phone: string | null; languages: string[]; active: boolean };

function Message({ state, labels }: { state: AgentState; labels: Labels }) {
  if (!state.result) return null;
  if (state.result === "saved") return <p role="status" className="admin-alert admin-alert-success !mb-0">{labels.saved}{state.code && <> {labels.uniqueCode}: <strong className="font-mono">{state.code}</strong></>}</p>;
  return <p role="alert" className="admin-alert admin-alert-danger !mb-0">{state.result === "contact" ? labels.contact : state.result === "duplicate" ? labels.duplicate : labels.error}</p>;
}

/** Splits a name saved before first and last name were stored separately. */
function nameParts(agent?: Agent) {
  if (!agent) return ["", ""];
  if (agent.first_name || agent.last_name) return [agent.first_name || "", agent.last_name || ""];
  const parts = agent.full_name.trim().split(/\s+/);
  return [parts.slice(0, -1).join(" ") || parts[0], parts.length > 1 ? parts[parts.length - 1] : ""];
}

/** Creates an agent, or edits one when `agent` is given. */
export function AgentForm({ agent, labels, languageNames, defaultTitle }: { agent?: Agent; labels: Labels; languageNames: Record<string, string>; defaultTitle: string }) {
  const [state, action, pending] = useActionState(saveAgent, { result: "" } as AgentState);
  const [firstName, lastName] = nameParts(agent);
  return <form action={action} className="admin-form">
    {agent && <input type="hidden" name="id" value={agent.id} />}
    <div className="admin-form-grid">
      <label className="admin-field">{labels.firstName}<input name="first_name" required maxLength={59} defaultValue={firstName} autoComplete="off" /></label>
      <label className="admin-field">{labels.lastName}<input name="last_name" required maxLength={59} defaultValue={lastName} autoComplete="off" /></label>
      <label className="admin-field">{labels.email}<input name="email" type="email" required maxLength={254} defaultValue={agent?.email || ""} autoComplete="off" /></label>
      <label className="admin-field">{labels.whatsapp}<input name="whatsapp" type="tel" required maxLength={30} defaultValue={agent?.phone || ""} placeholder="+49 1521 0000000" autoComplete="off" /><span className="admin-help font-normal">{labels.phoneHint}</span></label>
      <label className="admin-field">{labels.title}<input name="title" maxLength={80} defaultValue={agent && agent.title !== "Brickwise agent" ? agent.title : ""} placeholder={defaultTitle} autoComplete="off" /></label>
      <div className="admin-field">{labels.uniqueCode}<p className="admin-input font-mono" aria-live="polite">{agent?.code || state.code || "—"}</p><span className="admin-help font-normal">{labels.codeHint}</span></div>
    </div>
    <fieldset className="grid gap-2"><legend className="admin-field mb-2">{labels.languages}</legend>
      <div className="flex flex-wrap gap-x-5 gap-y-2">{Object.entries(languageNames).map(([code, name]) => <label key={code} className="admin-check"><input type="checkbox" name="languages" value={code} defaultChecked={agent?.languages.includes(code)} /><span>{name}</span></label>)}</div>
    </fieldset>
    <label className="admin-check"><input type="checkbox" name="active" defaultChecked={agent ? agent.active : true} /><span>{labels.active}</span></label>
    <Message state={state} labels={labels} />
    <div><button disabled={pending} className="admin-btn">{labels.save}</button></div>
  </form>;
}

export function AssignForm({ clients, agents, labels }: { clients: { id: string; label: string }[]; agents: { id: string; label: string }[]; labels: Labels }) {
  const [state, action, pending] = useActionState(assignAgent, { result: "" } as AgentState);
  return <form action={action} className="admin-form">
    <div className="admin-form-grid">
      <label className="admin-field">{labels.client}<select name="user_id" required defaultValue=""><option value="" disabled>—</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.label}</option>)}</select></label>
      <label className="admin-field">{labels.agent}<select name="agent_id" defaultValue=""><option value="">{labels.none}</option>{agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.label}</option>)}</select></label>
    </div>
    <Message state={state} labels={labels} />
    <div><button disabled={pending} className="admin-btn">{labels.assign}</button></div>
  </form>;
}
