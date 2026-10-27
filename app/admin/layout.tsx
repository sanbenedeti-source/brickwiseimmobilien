import { getAdminText } from "@/app/lib/admin-copy";
import { getCurrentLocale } from "@/app/lib/server-locale";
import LanguageSwitcher from "@/app/components/LanguageSwitcher";
import { ArrowUpRight, LogOut, Menu, ShieldCheck } from "lucide-react";
import Link from "next/link";
import BrandLogo from "@/app/components/BrandLogo";
import { isAdminUser } from "@/app/lib/admin";
import { ADMIN_MFA_REQUIRED, getAdminMfaStatus } from "@/app/lib/admin-session";
import { createClient } from "@/lib/supabase/server";
import AdminNavigation, { type AdminNavigationGroup } from "./AdminNavigation";
import { getAdminAttention } from "./attention";
import { agreementCopy } from "@/app/lib/agreement-copy";
import "./admin.css";

export async function generateMetadata() {
  const t = getAdminText(await getCurrentLocale());
  return { title: t("Administration") + " | BRICKWISE" };
}
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const locale = await getCurrentLocale();
  const t = getAdminText(locale);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !isAdminUser(user)) return <>{children}</>;
  // The workspace shell is shown only to a fully confirmed admin session.
  const mfaStatus = await getAdminMfaStatus(supabase, user);
  if (!(mfaStatus === "verified" || (mfaStatus === "enroll" && !ADMIN_MFA_REQUIRED))) return <>{children}</>;
  const attention = await getAdminAttention(supabase);
  const fullName = String(user.user_metadata?.full_name || user.email?.split("@")[0] || t("Administrator"));
  const initials = fullName.split(/\s+/).slice(0, 2).map(part => part[0]?.toUpperCase()).join("") || "AD";
  const groups: AdminNavigationGroup[] = [
    { items: [{ href: "/admin", icon: "overview", label: t("Overview") }] },
    { label: t("Operations"), items: [
      { href: "/admin#requests", icon: "requests", label: t("Client requests"), badge: attention.newRequests },
      { href: "/admin#customers", icon: "customers", label: t("Customers") },
      { href: "/admin/agreements", icon: "agreements", label: agreementCopy(locale).queue, badge: attention.pendingAgreements },
      { href: "/admin/kyc", icon: "kyc", label: t("Identity verification"), badge: attention.pendingKyc },
      { href: "/admin/payments/deposits", icon: "deposits", label: t("Deposits"), badge: attention.pendingDeposits },
      { href: "/admin/payments/withdrawals", icon: "withdrawals", label: t("Withdrawals"), badge: attention.pendingWithdrawals },
      { href: "/admin/payments/requests", icon: "paymentRequests", label: t("Payment requests"), badge: attention.pendingPayments },
      { href: "/admin/sale-requests", icon: "sales", label: t("Sale requests"), badge: attention.pendingSales },
    ] },
    { label: t("Portfolio"), items: [
      { href: "/admin/properties", icon: "properties", label: t("Properties") },
      { href: "/admin/profits", icon: "profits", label: t("Profit Management") },
      { href: "/admin/distributions", icon: "distributions", label: t("Distributions") },
      { href: "/admin/property-updates", icon: "updates", label: t("Property updates") },
    ] },
    { label: t("Settings"), items: [
      { href: "/admin/payments", icon: "methods", label: t("Payment methods") },
      { href: "/admin/agents", icon: "agents", label: t("Agents") },
      { href: "/admin/audit", icon: "audit", label: t("Audit logs") },
      { href: "/admin/security", icon: "security", label: t("Security") },
    ] },
  ];
  return <div className="admin-shell">
    <a href="#admin-content" className="admin-skip">{t("Skip to content")}</a>
    <aside className="admin-sidebar">
      <div className="admin-brand"><BrandLogo inverted /><span>{t("Administration")}</span></div>
      <AdminNavigation groups={groups} label={t("Main navigation")} />
      <div className="admin-sidebar-bottom">
        <div className="admin-profile"><span className="admin-avatar">{initials}</span><div><strong>{fullName}</strong><span>{user.email}</span></div></div>
        <a href="/logout" className="admin-logout"><LogOut size={16} />{t("Logout")}</a>
      </div>
    </aside>
    <div className="admin-main">
      <header className="admin-topbar">
        <details className="admin-mobile-menu">
          <summary aria-label={t("Main navigation")}><Menu size={20} aria-hidden="true" /></summary>
          <div className="admin-mobile-panel"><AdminNavigation groups={groups} label={t("Main navigation")} /><a href="/logout" className="admin-logout"><LogOut size={16} />{t("Logout")}</a></div>
        </details>
        <div className="admin-topbar-title">
          <span className="admin-env"><span className="admin-live-dot" aria-hidden="true" />{t("Live")}</span>
          {mfaStatus === "verified" && <span className="admin-mfa"><ShieldCheck size={15} aria-hidden="true" />{t("Two-factor authentication is active")}</span>}
        </div>
        <div className="admin-topbar-actions"><LanguageSwitcher currentLocale={locale} label={t("Language")} /><Link href="/" className="admin-website">{t("View website")}<ArrowUpRight size={15} /></Link></div>
      </header>
      <div id="admin-content" tabIndex={-1}>{children}</div>
    </div>
  </div>;
}
