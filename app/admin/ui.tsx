import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft, ArrowRight, ChevronDown } from "lucide-react";

/** Page title row shared by every admin page: optional back link, title, one-line purpose, actions. */
export function AdminPageHeader({ back, eyebrow, title, description, actions }: {
  back?: { href: string; label: string };
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return <header className="admin-page-header">
    <div className="admin-page-heading">
      {back && <Link href={back.href} className="admin-back"><ArrowLeft size={15} aria-hidden="true" />{back.label}</Link>}
      {eyebrow && <p className="admin-eyebrow">{eyebrow}</p>}
      <h1>{title}</h1>
      {description && <p className="admin-page-description">{description}</p>}
    </div>
    {actions && <div className="admin-page-actions">{actions}</div>}
  </header>;
}

/** One headline number; `attention` marks a queue that has work waiting. */
export function AdminStat({ label, value, hint, href, linkLabel, attention = false }: {
  label: string;
  value: string | number;
  hint?: string;
  href?: string;
  linkLabel?: string;
  attention?: boolean;
}) {
  return <div className={`admin-stat${attention ? " admin-stat-attention" : ""}`}>
    <p className="admin-stat-label">{label}</p>
    <p className="admin-stat-value">{value}</p>
    {hint && <p className="admin-stat-hint">{hint}</p>}
    {href && linkLabel && <Link href={href} className="admin-stat-link">{linkLabel}<ArrowRight size={14} aria-hidden="true" /></Link>}
  </div>;
}

/** White content card with a title row; children are the body (often a table). */
export function AdminCard({ id, title, description, actions, children, flush = false }: {
  id?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  flush?: boolean;
}) {
  return <section id={id} className="admin-card">
    <div className="admin-card-header">
      <div><h2>{title}</h2>{description && <p>{description}</p>}</div>
      {actions && <div className="admin-card-actions">{actions}</div>}
    </div>
    <div className={flush ? "admin-card-body-flush" : "admin-card-body"}>{children}</div>
  </section>;
}

/** A card that stays collapsed until needed, for long create/import forms. */
export function AdminDisclosure({ id, title, description, open = false, children }: {
  id?: string;
  title: string;
  description?: string;
  open?: boolean;
  children: ReactNode;
}) {
  return <details id={id} className="admin-card admin-disclosure" open={open}>
    <summary>
      <span><span className="admin-disclosure-title">{title}</span>{description && <span className="admin-disclosure-text">{description}</span>}</span>
      <ChevronDown size={18} aria-hidden="true" className="admin-disclosure-icon" />
    </summary>
    <div className="admin-card-body">{children}</div>
  </details>;
}

export function AdminAlert({ tone, children }: { tone: "success" | "warning" | "danger"; children: ReactNode }) {
  return <p role={tone === "success" ? "status" : "alert"} className={`admin-alert admin-alert-${tone}`}>{children}</p>;
}

const badgeTones = {
  new: "admin-badge-info",
  pending: "admin-badge-warning",
  in_review: "admin-badge-info",
  awaiting_payment: "admin-badge-warning",
  confirming: "admin-badge-info",
  review: "admin-badge-danger",
  expired: "admin-badge-neutral",
  canceled: "admin-badge-neutral",
  contacted: "admin-badge-info",
  active: "admin-badge-success",
  verified: "admin-badge-success",
  approved: "admin-badge-success",
  paid: "admin-badge-success",
  completed: "admin-badge-success",
  closed: "admin-badge-neutral",
  cancelled: "admin-badge-neutral",
  rejected: "admin-badge-danger",
  failed: "admin-badge-danger",
  success: "admin-badge-success",
  failure: "admin-badge-danger",
} as const;

export function StatusBadge({ status, label }: { status: string | null | undefined; label: string }) {
  const tone = badgeTones[(status || "new").toLowerCase() as keyof typeof badgeTones] ?? "admin-badge-neutral";
  return <span className={`admin-badge ${tone}`}>{label}</span>;
}

export function AdminEmpty({ children }: { children: ReactNode }) {
  return <div className="admin-empty-state">{children}</div>;
}
