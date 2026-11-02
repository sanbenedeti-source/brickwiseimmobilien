"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";
import { ArrowDownToLine, ArrowLeftRight, BadgeCheck, Banknote, Building2, Coins, FileCheck2, IdCard, Inbox, KeyRound, Landmark, LayoutDashboard, Megaphone, Percent, ReceiptText, ScrollText, UsersRound } from "lucide-react";

const icons = { overview: LayoutDashboard, requests: Inbox, customers: UsersRound, agreements: FileCheck2, kyc: IdCard, deposits: Banknote, withdrawals: ArrowDownToLine, paymentRequests: ReceiptText, sales: ArrowLeftRight, properties: Building2, profits: Percent, distributions: Coins, updates: Megaphone, methods: Landmark, agents: BadgeCheck, audit: ScrollText, security: KeyRound };
/** match lists every page path that belongs to the item, so a section stays highlighted on its sub-pages. */
export type AdminNavigationItem = { href: string; label: string; icon: keyof typeof icons; badge?: number; match?: string[] };
export type AdminNavigationGroup = { label?: string; items: AdminNavigationItem[] };

function subscribe(callback: () => void) {
  window.addEventListener("hashchange", callback);
  window.addEventListener("popstate", callback);
  return () => { window.removeEventListener("hashchange", callback); window.removeEventListener("popstate", callback); };
}

export default function AdminNavigation({ groups, label }: { groups: AdminNavigationGroup[]; label: string }) {
  const pathname = usePathname();
  const hash = useSyncExternalStore(subscribe, () => window.location.hash, () => "");
  const items = groups.flatMap((group) => group.items);
  // The most specific match wins, so /admin/payments/deposits does not also light up /admin/payments.
  const matches = (href: string) => {
    const [path, section] = href.split("#");
    if (section) return pathname === path && hash === `#${section}`;
    return pathname === path || (path !== "/admin" && pathname.startsWith(`${path}/`));
  };
  const specificity = (item: AdminNavigationItem) => Math.max(-1, ...(item.match ?? [item.href]).filter(matches).map((href) => href.length));
  const active = items.map((item) => ({ href: item.href, length: specificity(item) })).filter((item) => item.length >= 0).sort((a, b) => b.length - a.length)[0]?.href
    ?? (pathname === "/admin" ? "/admin" : undefined);
  return <nav className="admin-navigation" aria-label={label}>{groups.map((group, index) => <div key={group.label ?? index} className="admin-nav-group">
    {group.label && <p className="admin-nav-caption">{group.label}</p>}
    {group.items.map((item) => {
      const Icon = icons[item.icon];
      const [path, section] = item.href.split("#");
      const NavigationLink = section || path === "/admin" ? "a" : Link;
      const current = item.href === active;
      return <NavigationLink key={item.href} href={item.href} className="admin-nav-link" aria-current={current ? (section ? "location" : "page") : undefined}>
        <Icon size={18} aria-hidden="true" /><span>{item.label}</span>
        {item.badge ? <span className="admin-nav-badge">{item.badge > 99 ? "99+" : item.badge}</span> : null}
      </NavigationLink>;
    })}
  </div>)}</nav>;
}
