"use client";

import { useActionState } from "react";
import { Megaphone } from "lucide-react";
import { publishPropertyUpdate, type PublishState } from "./actions";

type Labels = { property: string; title: string; body: string; submit: string; saved: string; error: string };

export default function PublishUpdateForm({ properties, labels }: { properties: { slug: string; title: string }[]; labels: Labels }) {
  const [state, action, pending] = useActionState(publishPropertyUpdate, { result: "" } as PublishState);
  return <form action={action} className="admin-form">
    <div className="admin-form-grid">
      <label className="admin-field">{labels.property}
        <select name="property_slug" required defaultValue="">
          <option value="" disabled>—</option>
          {properties.map((property) => <option key={property.slug} value={property.slug}>{property.title}</option>)}
        </select>
      </label>
      <label className="admin-field">{labels.title}<input name="title" required minLength={3} maxLength={160} /></label>
      <label className="admin-field admin-field-wide">{labels.body}<textarea name="body" required minLength={3} maxLength={5000} rows={5} /></label>
    </div>
    {state.result === "saved" && <p role="status" className="admin-alert admin-alert-success !mb-0">{labels.saved}</p>}
    {state.result === "error" && <p role="alert" className="admin-alert admin-alert-danger !mb-0">{labels.error}</p>}
    <div><button disabled={pending} className="admin-btn"><Megaphone size={15} aria-hidden="true" />{labels.submit}</button></div>
  </form>;
}
