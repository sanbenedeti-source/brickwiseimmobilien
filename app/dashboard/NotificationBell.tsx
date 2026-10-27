"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, CheckCheck } from "lucide-react";
import { localeHtmlLang, type Locale } from "../lib/i18n";
import { fillTemplate, portalCopy, type NotificationKind } from "../lib/portal-copy";

type Notification = { id: string; kind: NotificationKind; payload: Record<string, unknown>; read_at: string | null; created_at: string };

export function notificationMessage(item: Pick<Notification, "kind" | "payload">, locale: Locale, propertyTitles: Record<string, string>) {
  const text = portalCopy[locale];
  // Property profit payouts share the earnings notification kind and are marked by their payload.
  const kind: NotificationKind = item.kind === "distribution_credited" && item.payload.source === "profit" ? "profit_paid" : item.kind;
  const template = text.notificationText[kind];
  if (!template) return "";
  const amount = Number(item.payload.amount);
  const slug = String(item.payload.propertySlug || "");
  const status = String(item.payload.status || "") as keyof typeof text.saleStatus;
  return fillTemplate(template, {
    amount: Number.isFinite(amount) ? new Intl.NumberFormat(localeHtmlLang[locale], { style: "currency", currency: "EUR" }).format(amount) : "",
    property: propertyTitles[slug] || slug,
    title: String(item.payload.title || ""),
    shares: Number(item.payload.shares) || 0,
    status: text.saleStatus[status] || status,
  });
}

export default function NotificationBell({ locale, propertyTitles }: { locale: Locale; propertyTitles: Record<string, string> }) {
  const text = portalCopy[locale];
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const root = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/notifications", { cache: "no-store" });
      if (!response.ok) return;
      const data = await response.json() as { items: Notification[]; unread: number };
      setItems(data.items);
      setUnread(data.unread);
    } catch { /* The bell stays quiet when notifications are unavailable. */ }
  }, []);

  useEffect(() => {
    // Defer the first request so it never blocks the initial render of the panel.
    const first = window.setTimeout(load, 0);
    const timer = window.setInterval(load, 60_000);
    return () => { window.clearTimeout(first); window.clearInterval(timer); };
  }, [load]);
  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent ? event.key === "Escape" : !root.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", close);
    window.addEventListener("keydown", close);
    return () => { window.removeEventListener("mousedown", close); window.removeEventListener("keydown", close); };
  }, [open]);

  async function markAll() {
    await fetch("/api/notifications", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }).catch(() => undefined);
    setItems((current) => current.map((item) => ({ ...item, read_at: item.read_at || new Date().toISOString() })));
    setUnread(0);
  }

  const date = (value: string) => new Intl.DateTimeFormat(localeHtmlLang[locale], { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
  return <div ref={root} className="relative">
    <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-haspopup="true" aria-label={`${text.notifications}${unread ? ` (${unread})` : ""}`}
      className="relative inline-flex h-10 w-10 items-center justify-center rounded-lg border border-line bg-white text-ink hover:bg-canvas">
      <Bell size={18} aria-hidden="true" />
      {unread > 0 && <span className="absolute -right-1.5 -top-1.5 flex min-w-5 items-center justify-center rounded-full bg-brand px-1 text-[11px] font-bold leading-5 text-white">{unread > 99 ? "99+" : unread}</span>}
    </button>
    {open && <div className="absolute right-0 z-40 mt-2 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-line bg-white shadow-[0_16px_40px_rgba(20,33,61,0.16)]">
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3"><p className="text-sm font-semibold">{text.notifications}</p>{unread > 0 && <button type="button" onClick={markAll} className="inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline"><CheckCheck size={14} aria-hidden="true" />{text.markAllRead}</button>}</div>
      {!items.length ? <p className="px-4 py-8 text-center text-sm text-muted">{text.noNotifications}</p> : <ul className="max-h-[26rem] divide-y divide-line overflow-y-auto">{items.map((item) => <li key={item.id} className={`flex gap-3 px-4 py-3 ${item.read_at ? "" : "bg-brand-soft/40"}`}>
        <span aria-hidden="true" className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${item.read_at ? "bg-transparent" : "bg-brand"}`} />
        <div className="min-w-0"><p className="text-sm leading-5 text-ink">{notificationMessage(item, locale, propertyTitles)}</p>{typeof item.payload.note === "string" && /rejected|kyc_rejected|sale_request/.test(item.kind) && <p className="mt-0.5 text-xs leading-5 text-muted">{item.payload.note}</p>}<p className="mt-1 text-[11px] text-muted">{date(item.created_at)}</p></div>
      </li>)}</ul>}
    </div>}
  </div>;
}
