import { getAdminText } from "@/app/lib/admin-copy";
import { getCurrentLocale } from "@/app/lib/server-locale";
import LanguageSwitcher from "@/app/components/LanguageSwitcher";
import { ArrowUpRight, LogOut, ShieldCheck } from "lucide-react";
import Link from "next/link";
import BrandLogo from "@/app/components/BrandLogo";
import { isAdminUser } from "@/app/lib/admin";
import { createClient } from "@/lib/supabase/server";
import AdminNavigation, { type AdminNavigationItem } from "./AdminNavigation";
import { agreementCopy } from "@/app/lib/agreement-copy";
import "./admin.css";

export async function generateMetadata() {
  const t = getAdminText(await getCurrentLocale());
  return { title: t("Panel Admin") + " | Brickwise Immobilien" };
}
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const locale = await getCurrentLocale();
  const t = getAdminText(locale);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !isAdminUser(user)) return <>{children}</>;
  const fullName = String(user.user_metadata?.full_name || user.email?.split("@")[0] || t("Administrator"));
  const initials = fullName.split(/\s+/).slice(0, 2).map(part => part[0]?.toUpperCase()).join("") || "AD";
  const items: AdminNavigationItem[] = [
    { href: "/admin", icon: "overview", label: t("Panel Admin") },
    { href: "/admin#requests", icon: "requests", label: t("Client requests") },
    { href: "/admin#customers", icon: "customers", label: t("Customers") },
    { href: "/admin/agreements", icon: "audit", label: agreementCopy(locale).queue },
    { href: "/admin/properties", icon: "properties", label: t("Properties") },
    { href: "/admin/profits", icon: "profits", label: t("Profit Management") },
    { href: "/admin/payments", icon: "payments", label: t("Payments") },
    { href: "/admin/audit", icon: "audit", label: t("Audit logs") },
  ];
  return <div className="admin-shell">
    <a href="#admin-content" className="admin-skip">{t("Skip to content")}</a>
    <aside className="admin-sidebar">
      <div className="admin-brand"><BrandLogo /><span>{t("Administration")}</span></div>
      <p className="admin-nav-caption">{t("Workspace")}</p>
      <AdminNavigation items={items} label={t("Main navigation")} />
      <div className="admin-sidebar-bottom">
        <div className="admin-profile"><span className="admin-avatar">{initials}</span><div><strong>{fullName}</strong><span>{t("Administrator")}</span></div><ShieldCheck size={19} /></div>
        <a href="/logout" className="admin-logout"><LogOut size={17} />{t("Logout")}</a>
      </div>
    </aside>
    <div className="admin-main">
      <header className="admin-topbar">
        <div className="admin-topbar-title"><span className="admin-live-dot" />{t("Workspace")}<span className="admin-eur">EUR</span></div>
        <div className="admin-topbar-actions"><LanguageSwitcher currentLocale={locale} label={t("Language")} /><Link href="/" className="admin-website">{t("View website")}<ArrowUpRight size={16} /></Link></div>
      </header>
      <details className="admin-mobile-menu"><summary>{t("Main navigation")}</summary><AdminNavigation items={items} label={t("Main navigation")} /><a href="/logout" className="admin-logout"><LogOut size={17} />{t("Logout")}</a></details>
      <div id="admin-content" tabIndex={-1}>{children}</div>
    </div>
  </div>;
}
