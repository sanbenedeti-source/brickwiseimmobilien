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
import AdminSectionTabs, { type AdminSectionTab } from "./AdminSectionTabs";
import AdminInbox from "./AdminInbox";
import { localeHtmlLang } from "@/app/lib/i18n";
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
  // Five sections; the pages of each section appear as tabs at the top of the content.
  const clients: AdminSectionTab[] = [
    { href: "/admin/customers", label: t("Clients") },
    { href: "/admin/kyc", label: t("Identity verification"), badge: attention.pendingKyc },
    { href: "/admin/agreements", label: agreementCopy(locale).queue, badge: attention.pendingAgreements },
  ];
  const money: AdminSectionTab[] = [
    { href: "/admin/payments/deposits", label: t("Deposits"), badge: attention.pendingDeposits },
    { href: "/admin/payments/withdrawals", label: t("Withdrawals"), badge: attention.pendingWithdrawals },
    { href: "/admin/payments/requests", label: t("Payment requests"), badge: attention.pendingPayments },
  ];
  const portfolio: AdminSectionTab[] = [
    { href: "/admin/properties", label: t("Properties") },
    { href: "/admin/sale-requests", label: t("Sale requests"), badge: attention.pendingSales },
    { href: "/admin/property-updates", label: t("Property updates") },
    // Earnings accrual and distributions are managed on each property page; these keep the overall lists.
    { href: "/admin/distributions", label: t("Distributions") },
  ];
  const settings: AdminSectionTab[] = [
    { href: "/admin/payments", label: t("Payment methods") },
    { href: "/admin/agents", label: t("Agents") },
    { href: "/admin/audit", label: t("Audit logs") },
    { href: "/admin/security", label: t("Security") },
  ];
  const total = (tabs: AdminSectionTab[]) => tabs.reduce((sum, tab) => sum + (tab.badge || 0), 0);
  const hrefs = (tabs: AdminSectionTab[]) => tabs.map((tab) => tab.href);
  const groups: AdminNavigationGroup[] = [{ items: [
    { href: "/admin", icon: "overview", label: t("Overview"), badge: attention.newRequests },
    // Payments clients start (deposits and withdrawals) are confirmed on one page.
    { href: "/admin/wallet", icon: "wallet", label: t("Wallet notifications"), badge: attention.pendingDeposits + attention.pendingWithdrawals },
    { href: "/admin/customers", icon: "customers", label: t("Clients"), badge: total(clients), match: hrefs(clients) },
    { href: "/admin/payments/deposits", icon: "deposits", label: t("Money"), badge: total(money), match: hrefs(money) },
    { href: "/admin/properties", icon: "properties", label: t("Properties"), badge: total(portfolio), match: hrefs(portfolio) },
    { href: "/admin/payments", icon: "methods", label: t("Settings"), match: hrefs(settings) },
  ] }];
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
        <div className="admin-topbar-actions"><AdminInbox lang={localeHtmlLang[locale]} labels={{
          title: t("Client activity"), empty: t("Nothing is waiting for you."), open: t("Open an item to confirm or reject it."), error: t("Client activity could not be loaded."),
          all: t("All wallet notifications"), kinds: { deposit: t("New deposit"), withdrawal: t("Withdrawal request"), kyc: t("Identity verification"), agreement: t("Agreement to review"), sale: t("Share sale request"), request: t("New client request") },
        }} /><LanguageSwitcher currentLocale={locale} label={t("Language")} /><Link href="/" className="admin-website">{t("View website")}<ArrowUpRight size={15} /></Link></div>
      </header>
      <div id="admin-content" tabIndex={-1}><AdminSectionTabs sections={[clients, money, portfolio, settings]} label={t("Main navigation")} />{children}</div>
    </div>
  </div>;
}
