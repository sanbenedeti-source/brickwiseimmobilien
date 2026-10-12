"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";
import { Building2, ClipboardList, CreditCard, LayoutDashboard, MessageSquareText, Percent, UsersRound, ChevronRight } from "lucide-react";
const icons = { overview: LayoutDashboard, requests: MessageSquareText, properties: Building2, profits: Percent, payments: CreditCard, audit: ClipboardList, customers: UsersRound };
export type AdminNavigationItem = { href: string; label: string; icon: keyof typeof icons };
function subscribe(callback: () => void) {
  window.addEventListener("hashchange", callback);
  window.addEventListener("popstate", callback);
  return () => { window.removeEventListener("hashchange", callback); window.removeEventListener("popstate", callback); };
}
export default function AdminNavigation({ items, label }: { items: AdminNavigationItem[]; label: string }) {
  const pathname = usePathname();
  const hash = useSyncExternalStore(subscribe, () => window.location.hash, () => "");
  return <nav className="admin-navigation" aria-label={label}>{items.map(item => {
    const [path, section] = item.href.split("#");
    const onPath = pathname === path || (path !== "/admin" && pathname.startsWith(`${path}/`));
    const active = onPath && (section ? hash === `#${section}` : !hash || path !== "/admin");
    const Icon = icons[item.icon];
    const NavigationLink = section || path === "/admin" ? "a" : Link;
    return <NavigationLink key={item.href} href={item.href} className="admin-nav-link" aria-current={active ? (section ? "location" : "page") : undefined}><Icon size={19} aria-hidden="true" /><span>{item.label}</span><ChevronRight className="admin-nav-arrow" size={15} aria-hidden="true" /></NavigationLink>;
  })}</nav>;
}
