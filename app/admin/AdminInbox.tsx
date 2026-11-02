"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowDownToLine, ArrowLeftRight, Banknote, Bell, FileCheck2, IdCard, Inbox } from "lucide-react";
import type { AdminInboxItem } from "@/app/api/admin/inbox/route";

type Labels = { title: string; empty: string; open: string; error: string; all: string; kinds: Record<AdminInboxItem["kind"], string> };
const icons = { deposit: Banknote, withdrawal: ArrowDownToLine, kyc: IdCard, agreement: FileCheck2, sale: ArrowLeftRight, request: Inbox };
const REFRESH_MS = 30_000;

/** Bell in the admin top bar: new client actions (deposits first among them) with a link to confirm each.
 * It refreshes itself every 30 seconds without reloading the page, so open forms are never reset. */
export default function AdminInbox({ labels, lang }: { labels: Labels; lang: string }) {
  const [items, setItems] = useState<AdminInboxItem[]>([]);
  const [total, setTotal] = useState(0);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);
  // "x minutes ago" is measured from the last refresh, which happens at least every 30 seconds.
  const [loadedAt, setLoadedAt] = useState(0);
  const box = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/inbox", { cache: "no-store" });
      if (!response.ok) throw new Error("inbox");
      const data = await response.json() as { items: AdminInboxItem[]; total: number };
      setItems(data.items); setTotal(data.total); setFailed(false); setLoadedAt(Date.now());
    } catch { setFailed(true); }
  }, []);

  useEffect(() => {
    // Defer the first request so it never blocks the initial render of the page.
    const first = window.setTimeout(load, 0);
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") void load(); }, REFRESH_MS);
    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);
    return () => { window.clearTimeout(first); window.clearInterval(timer); window.removeEventListener("focus", onFocus); };
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent ? event.key === "Escape" : !box.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", close); };
  }, [open]);

  const relative = new Intl.RelativeTimeFormat(lang, { numeric: "auto" });
  const ago = (iso: string) => {
    const minutes = Math.round((Date.parse(iso) - loadedAt) / 60_000);
    if (Math.abs(minutes) < 60) return relative.format(minutes, "minute");
    const hours = Math.round(minutes / 60);
    return Math.abs(hours) < 24 ? relative.format(hours, "hour") : relative.format(Math.round(hours / 24), "day");
  };
  const euro = (value: number) => value.toLocaleString(lang, { style: "currency", currency: "EUR" });

  return <div ref={box} className="relative">
    <button type="button" onClick={() => { setOpen((value) => !value); if (!open) void load(); }} aria-expanded={open} aria-label={`${labels.title}${total ? ` (${total})` : ""}`}
      className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-[#dfe5ec] bg-white text-[#14213d] hover:bg-[#f5f7fa]">
      <Bell size={17} aria-hidden="true" />
      {total > 0 && <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#e0484d] px-1 text-[11px] font-bold text-white">{total > 99 ? "99+" : total}</span>}
    </button>
    {/* On phones the panel spans the top bar, since the bell is not the last item in it. */}
    {open && <div className="absolute right-0 top-11 z-50 w-[380px] overflow-hidden max-sm:fixed max-sm:left-3 max-sm:right-3 max-sm:top-[64px] max-sm:w-auto rounded-xl border border-[#dfe5ec] bg-white shadow-[0_16px_40px_rgba(20,33,61,0.16)]">
      <p className="border-b border-[#dfe5ec] px-4 py-3 text-sm font-bold text-[#14213d]">{labels.title}</p>
      {failed ? <p className="px-4 py-6 text-sm text-[#b42318]">{labels.error}</p>
        : !items.length ? <p className="px-4 py-6 text-sm text-[#5b6678]">{labels.empty}</p>
        : <ul className="max-h-[60vh] divide-y divide-[#eef1f5] overflow-y-auto">{items.map((item) => {
          const Icon = icons[item.kind];
          return <li key={`${item.kind}-${item.id}`}>
            <Link href={item.href} onClick={() => setOpen(false)} className="flex items-start gap-3 px-4 py-3 hover:bg-[#f5f7fa]">
              <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${item.kind === "deposit" ? "bg-emerald-50 text-emerald-700" : item.kind === "withdrawal" ? "bg-amber-50 text-amber-700" : "bg-[#e8f1f9] text-[#1667a8]"}`}><Icon size={16} aria-hidden="true" /></span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-[#14213d]">{labels.kinds[item.kind]}{item.amount !== null ? ` · ${euro(item.amount)}` : item.shares !== null ? ` · ${item.shares.toLocaleString(lang)}` : ""}</span>
                <span className="block truncate text-xs text-[#5b6678]">{item.name || item.email}{item.name && item.email ? ` · ${item.email}` : ""}</span>
              </span>
              <span className="shrink-0 text-[11px] text-[#5b6678]">{ago(item.createdAt)}</span>
            </Link>
          </li>;
        })}</ul>}
      <div className="flex items-center justify-between gap-3 border-t border-[#dfe5ec] px-4 py-2 text-xs">
        <span className="text-[#5b6678]">{items.length > 0 ? labels.open : ""}</span>
        <Link href="/admin/wallet" onClick={() => setOpen(false)} className="shrink-0 font-semibold text-[#1667a8] hover:underline">{labels.all}</Link>
      </div>
    </div>}
  </div>;
}
