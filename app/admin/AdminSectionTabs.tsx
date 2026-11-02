"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export type AdminSectionTab = { href: string; label: string; badge?: number };

/** The page belongs to the section whose tab path matches it most specifically. */
export function matchAdminSection(pathname: string, sections: AdminSectionTab[][]) {
  let best: { section: number; tab: number; length: number } | null = null;
  sections.forEach((tabs, section) => tabs.forEach((tab, index) => {
    const hit = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
    if (hit && (!best || tab.href.length > best.length)) best = { section, tab: index, length: tab.href.length };
  }));
  return best as { section: number; tab: number; length: number } | null;
}

/** Tabs for the pages of the current admin section (Clients, Money, Properties, Settings). */
export default function AdminSectionTabs({ sections, label }: { sections: AdminSectionTab[][]; label: string }) {
  const pathname = usePathname();
  const match = matchAdminSection(pathname, sections);
  if (!match || sections[match.section].length < 2) return null;
  return <div className="admin-section-tabs"><nav className="admin-segmented" aria-label={label}>
    {sections[match.section].map((tab, index) => <Link key={tab.href} href={tab.href} aria-current={index === match.tab ? "page" : undefined}>
      {tab.label}{tab.badge ? <span className="admin-tab-badge">{tab.badge > 99 ? "99+" : tab.badge}</span> : null}
    </Link>)}
  </nav></div>;
}
