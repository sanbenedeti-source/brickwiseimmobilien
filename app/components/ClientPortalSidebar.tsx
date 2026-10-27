"use client";
import { useLocale } from "./LocaleProvider";
import { createTranslator } from "../lib/translate";

import {
  ArrowDownToLine,
  ArrowRight,
  TriangleAlert,
  BadgeDollarSign,
  BookOpen,
  Building2,
  CircleCheck,
  BadgeCheck,
  CircleHelp,
  ClipboardList,
  FileCheck2,
  FolderOpen,
  House,
  Landmark,
  Layers,
  LogOut,
  Menu,
  ReceiptText,
  UserRound,
  WalletCards,
  Bitcoin,
  X,
} from "lucide-react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { readProfileFields, profilePatch, type ProfileFields } from "../lib/profile-fields";
import Modal from "./Modal";
import BrandLogo from "./BrandLogo";
import LanguageSwitcher from "./LanguageSwitcher";
import ClientAgreement, { type ClientAgreementData } from "./ClientAgreement";
import { agreementCopy } from "../lib/agreement-copy";
import type { Locale } from "@/app/lib/i18n";
import { openDepositEvent, openProfileEvent } from "./portal-events";

export type ClientPortalActiveItem = "marketplace" | "assets" | "account" | "income" | "wallet" | "orders" | "statement" | "documents" | "property" | "funding" | "contact" | "learn" | "about" | "risk" | "none";

const sidebarCopy = {
  en: { deposit: "Deposit", profile: "Complete profile", marketplace: "Properties", assets: "Assets", account: "Account", income: "Income", wallet: "Wallet", orders: "Orders", withdraw: "Withdraw", statement: "Statement", documents: "Documents", learn: "Learn", risk: "Risk warnings", about: "About us", settings: "Settings", logout: "Logout", language: "Language", investing: "Investing", money: "Money", accountGroup: "Account", help: "Help", verifyAgent: "Verify an agent", required: "Action required", profileHint: "Complete your profile and sign the cooperation agreement to invest.", profileAction: "Complete now" },
  de: { deposit: "Einzahlen", profile: "Profil vervollständigen", marketplace: "Immobilien", assets: "Vermögenswerte", account: "Konto", income: "Erträge", wallet: "Wallet", orders: "Aufträge", withdraw: "Auszahlen", statement: "Kontoauszug", documents: "Dokumente", learn: "Lernen", risk: "Risikohinweise", about: "Über uns", settings: "Einstellungen", logout: "Abmelden", language: "Sprache", investing: "Investieren", money: "Geld", accountGroup: "Konto", help: "Hilfe", verifyAgent: "Agenten verifizieren", required: "Aktion erforderlich", profileHint: "Vervollständigen Sie Ihr Profil und unterschreiben Sie den Kooperationsvertrag, um zu investieren.", profileAction: "Jetzt vervollständigen" },
  fr: { deposit: "Dépôt", profile: "Compléter le profil", marketplace: "Biens", assets: "Actifs", account: "Compte", income: "Revenus", wallet: "Portefeuille", orders: "Ordres", withdraw: "Retirer", statement: "Relevé", documents: "Documents", learn: "Apprendre", risk: "Avertissements", about: "À propos", settings: "Paramètres", logout: "Déconnexion", language: "Langue", investing: "Investir", money: "Argent", accountGroup: "Compte", help: "Aide", verifyAgent: "Vérifier un agent", required: "Action requise", profileHint: "Complétez votre profil et signez le contrat de coopération pour investir.", profileAction: "Compléter maintenant" },
  es: { deposit: "Depositar", profile: "Completar perfil", marketplace: "Propiedades", assets: "Activos", account: "Cuenta", income: "Ingresos", wallet: "Cartera", orders: "Órdenes", withdraw: "Retirar", statement: "Extracto", documents: "Documentos", learn: "Aprender", risk: "Advertencias", about: "Sobre nosotros", settings: "Configuración", logout: "Cerrar sesión", language: "Idioma", investing: "Invertir", money: "Dinero", accountGroup: "Cuenta", help: "Ayuda", verifyAgent: "Verificar un agente", required: "Acción necesaria", profileHint: "Completa tu perfil y firma el contrato de cooperación para invertir.", profileAction: "Completar ahora" },
  it: { deposit: "Deposita", profile: "Completa il profilo", marketplace: "Immobili", assets: "Asset", account: "Account", income: "Reddito", wallet: "Wallet", orders: "Ordini", withdraw: "Preleva", statement: "Estratto conto", documents: "Documenti", learn: "Impara", risk: "Avvertenze sui rischi", about: "Chi siamo", settings: "Impostazioni", logout: "Esci", language: "Lingua", investing: "Investire", money: "Denaro", accountGroup: "Account", help: "Aiuto", verifyAgent: "Verifica un agente", required: "Azione richiesta", profileHint: "Completa il profilo e firma il contratto di cooperazione per investire.", profileAction: "Completa ora" },
} satisfies Record<Locale, Record<string, string>>;

const countries = [
  "Afghanistan", "Albania", "Algeria", "Andorra", "Angola", "Antigua and Barbuda", "Argentina", "Armenia", "Australia", "Austria", "Azerbaijan",
  "Bahamas", "Bahrain", "Bangladesh", "Barbados", "Belarus", "Belgium", "Belize", "Benin", "Bhutan", "Bolivia", "Bosnia and Herzegovina", "Botswana", "Brazil", "Brunei", "Bulgaria", "Burkina Faso", "Burundi",
  "Cabo Verde", "Cambodia", "Cameroon", "Canada", "Central African Republic", "Chad", "Chile", "China", "Colombia", "Comoros", "Congo", "Costa Rica", "Cote d'Ivoire", "Croatia", "Cuba", "Cyprus", "Czechia",
  "Democratic Republic of the Congo", "Denmark", "Djibouti", "Dominica", "Dominican Republic",
  "Ecuador", "Egypt", "El Salvador", "Equatorial Guinea", "Eritrea", "Estonia", "Eswatini", "Ethiopia",
  "Fiji", "Finland", "France",
  "Gabon", "Gambia", "Georgia", "Germany", "Ghana", "Greece", "Grenada", "Guatemala", "Guinea", "Guinea-Bissau", "Guyana",
  "Haiti", "Honduras", "Hungary",
  "Iceland", "India", "Indonesia", "Iran", "Iraq", "Ireland", "Israel", "Italy",
  "Jamaica", "Japan", "Jordan",
  "Kazakhstan", "Kenya", "Kiribati", "Kosovo", "Kuwait", "Kyrgyzstan",
  "Laos", "Latvia", "Lebanon", "Lesotho", "Liberia", "Libya", "Liechtenstein", "Lithuania", "Luxembourg",
  "Madagascar", "Malawi", "Malaysia", "Maldives", "Mali", "Malta", "Marshall Islands", "Mauritania", "Mauritius", "Mexico", "Micronesia", "Moldova", "Monaco", "Mongolia", "Montenegro", "Morocco", "Mozambique", "Myanmar",
  "Namibia", "Nauru", "Nepal", "Netherlands", "New Zealand", "Nicaragua", "Niger", "Nigeria", "North Korea", "North Macedonia", "Norway",
  "Oman",
  "Pakistan", "Palau", "Palestine", "Panama", "Papua New Guinea", "Paraguay", "Peru", "Philippines", "Poland", "Portugal",
  "Qatar",
  "Romania", "Russia", "Rwanda",
  "Saint Kitts and Nevis", "Saint Lucia", "Saint Vincent and the Grenadines", "Samoa", "San Marino", "Sao Tome and Principe", "Saudi Arabia", "Senegal", "Serbia", "Seychelles", "Sierra Leone", "Singapore", "Slovakia", "Slovenia", "Solomon Islands", "Somalia", "South Africa", "South Korea", "South Sudan", "Spain", "Sri Lanka", "Sudan", "Suriname", "Sweden", "Switzerland", "Syria",
  "Taiwan", "Tajikistan", "Tanzania", "Thailand", "Timor-Leste", "Togo", "Tonga", "Trinidad and Tobago", "Tunisia", "Turkey", "Turkmenistan", "Tuvalu",
  "Uganda", "Ukraine", "United Arab Emirates", "United Kingdom", "United States", "Uruguay", "Uzbekistan",
  "Vanuatu", "Vatican City", "Venezuela", "Vietnam",
  "Yemen", "Zambia", "Zimbabwe",
] as const;

function profileSignerName(fields: Pick<ProfileFields, "first_name" | "last_name">) {
  return `${fields.first_name.trim()} ${fields.last_name.trim()}`.trim();
}

function validProfileNames(fields: Pick<ProfileFields, "first_name" | "last_name">) {
  const name = profileSignerName(fields);
  return Boolean(fields.first_name.trim() && fields.last_name.trim() && name.length <= 120 && !/[\u0000-\u001f\u007f]/.test(name));
}

export default function ClientPortalSidebar({
  active,
  email,
  fullName,
  locale = "en",
}: {
  active: ClientPortalActiveItem;
  email: string;
  fullName: string;
  locale?: Locale;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setMobileOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileOpen]);
  const [profileOpen, setProfileOpen] = useState(false);
  const [depositOpen, setDepositOpen] = useState(false);
  const [profileComplete, setProfileComplete] = useState(false);
  const [completionKnown, setCompletionKnown] = useState(false);
  const completionRequest = useRef(0);
  const updateCompletion = useCallback((complete: boolean) => {
    completionRequest.current += 1;
    setProfileComplete(complete);
    setCompletionKnown(true);
  }, []);
  useEffect(() => {
    const openProfile = () => { setMobileOpen(false); setProfileOpen(true); };
    const openDeposit = () => { setMobileOpen(false); setDepositOpen(true); };
    window.addEventListener(openProfileEvent, openProfile);
    window.addEventListener(openDepositEvent, openDeposit);
    return () => { window.removeEventListener(openProfileEvent, openProfile); window.removeEventListener(openDepositEvent, openDeposit); };
  }, []);
  useEffect(() => {
    let controller: AbortController;
    async function loadCompletion() {
      controller?.abort();
      controller = new AbortController();
      const signal = controller.signal;
      const request = ++completionRequest.current;
      try {
        const [auth, response] = await Promise.all([
          createClient().auth.getUser(),
          fetch(`/api/client-agreements?lang=${locale}`, { cache: "no-store", signal }),
        ]);
        if (auth.error || !auth.data.user || !response.ok) throw new Error("Profile unavailable");
        const agreement: ClientAgreementData = await response.json();
        const accepted = Boolean(agreement.acceptance?.id && (agreement.acceptance.status === "pending" || agreement.acceptance.status === "approved"));
        if (!signal.aborted && request === completionRequest.current) {
          setProfileComplete(accepted && validProfileNames(readProfileFields(auth.data.user.user_metadata)));
          setCompletionKnown(true);
        }
      } catch {
        if (!signal.aborted && request === completionRequest.current) { setProfileComplete(false); setCompletionKnown(true); }
      }
    }
    void loadCompletion();
    const updated = () => { void loadCompletion(); };
    window.addEventListener("brickwise:agreement-updated", updated);
    window.addEventListener("brickwise:profile-updated", updated);
    return () => {
      controller?.abort();
      window.removeEventListener("brickwise:agreement-updated", updated);
      window.removeEventListener("brickwise:profile-updated", updated);
    };
  }, [locale]);
  const pathname = usePathname();
  const copy = sidebarCopy[locale];
  const t = createTranslator(locale);
  const currentActive: ClientPortalActiveItem = pathname === "/funding"
    ? "funding"
    : pathname.startsWith("/risk")
      ? "risk"
    : pathname.startsWith("/contact")
      ? "contact"
      : pathname.startsWith("/insights")
        ? "learn"
        : pathname.startsWith("/about") || pathname.startsWith("/real-estate-investing")
          ? "about"
          : pathname === "/properties" || pathname.startsWith("/properties/")
            ? "property"
            : pathname === "/dashboard/marketplace"
              ? "marketplace"
              : pathname === "/dashboard/assets"
                ? "assets"
                : pathname === "/dashboard/account"
                  ? "account"
                  : pathname === "/dashboard/income"
                    ? "income"
                    : pathname === "/dashboard/wallet"
                      ? "wallet"
                      : pathname === "/dashboard/orders"
                        ? "orders"
                      : pathname === "/dashboard/statement"
                        ? "statement"
                      : pathname === "/dashboard/documents"
                        ? "documents"
              : active;
  const initials = fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "BW";

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-50 flex h-16 items-center border-b border-line bg-white px-4 lg:hidden">
        <BrandLogo />
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="ml-auto flex h-11 w-11 items-center justify-center border border-line"
          aria-label={t("Open client menu")}
        >
          <Menu size={21} />
        </button>
      </header>

      {mobileOpen && (
        <button
          type="button"
          className="fixed inset-0 z-50 bg-black/45 lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-label={t("Close client menu")}
        />
      )}

      <aside className={`fixed inset-y-0 left-0 z-[60] flex w-[282px] flex-col overflow-hidden border-r border-line bg-white px-4 py-5 transition-[transform,visibility] lg:visible lg:translate-x-0 ${mobileOpen ? "visible translate-x-0" : "invisible -translate-x-full"}`}>
        <div className="flex shrink-0 items-center justify-between gap-3 px-1">
          <BrandLogo />
          <button type="button" onClick={() => setMobileOpen(false)} className="flex h-11 w-11 items-center justify-center text-muted lg:hidden" aria-label={t("Close menu")}><X size={20} /></button>
        </div>

        <div className="mt-5 flex shrink-0 items-center gap-3 rounded-xl border border-line bg-canvas px-3 py-2.5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink text-sm font-bold text-white">{initials}</span>
          <div className="min-w-0"><p className="truncate text-sm font-semibold text-ink">{fullName}</p><p className="truncate text-xs text-muted">{email}</p></div>
        </div>

        {completionKnown && !profileComplete && <div className="mt-3 shrink-0 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-[13px] text-amber-950">
          <p className="font-semibold">{copy.required}</p>
          <p className="mt-0.5 leading-5">{copy.profileHint}</p>
          <button type="button" onClick={() => setProfileOpen(true)} className="mt-1.5 inline-flex items-center gap-1 font-semibold text-brand hover:underline">{copy.profileAction}<ArrowRight size={14} aria-hidden="true" /></button>
        </div>}

        <nav className="mt-3 min-h-0 flex-1 overflow-y-auto overscroll-contain pb-3 text-sm text-ink-soft">
          <SidebarLink href="/dashboard/income" icon={House} label={copy.income} active={currentActive === "income"} />
          <SidebarGroup label={copy.investing}>
            <SidebarLink href="/dashboard/marketplace" icon={Building2} label={copy.marketplace} active={currentActive === "marketplace" || currentActive === "property"} />
            <SidebarLink href="/dashboard/assets" icon={Layers} label={copy.assets} active={currentActive === "assets"} />
            <SidebarLink href="/dashboard/orders" icon={ClipboardList} label={copy.orders} active={currentActive === "orders"} />
          </SidebarGroup>
          <SidebarGroup label={copy.money}>
            <SidebarLink href="/dashboard/wallet" icon={WalletCards} label={copy.wallet} active={currentActive === "wallet"} />
            <SidebarLink href="/dashboard/statement" icon={ReceiptText} label={copy.statement} active={currentActive === "statement"} />
            <SidebarButton icon={BadgeDollarSign} label={copy.deposit} active={currentActive === "funding"} onClick={() => setDepositOpen(true)} />
            <SidebarLink href="/dashboard/wallet#withdraw" icon={ArrowDownToLine} label={copy.withdraw} />
          </SidebarGroup>
          <SidebarGroup label={copy.accountGroup}>
            <SidebarButton icon={profileComplete ? CircleCheck : FileCheck2} label={profileComplete ? agreementCopy(locale).profileComplete : copy.profile} onClick={() => setProfileOpen(true)} tone={profileComplete ? "success" : completionKnown ? "warning" : undefined} />
            <SidebarLink href="/dashboard/account" icon={UserRound} label={copy.account} active={currentActive === "account"} />
            <SidebarLink href="/dashboard/documents" icon={FolderOpen} label={copy.documents} active={currentActive === "documents"} />
          </SidebarGroup>
          <SidebarGroup label={copy.help}>
            <SidebarLink href="/insights" icon={BookOpen} label={copy.learn} active={currentActive === "learn"} />
            <SidebarLink href="/risk" icon={TriangleAlert} label={copy.risk} active={currentActive === "risk"} />
            <SidebarLink href="/verify-agent" icon={BadgeCheck} label={copy.verifyAgent} />
            <SidebarLink href="/about" icon={CircleHelp} label={copy.about} active={currentActive === "about"} />
          </SidebarGroup>
        </nav>

        <div className="shrink-0 border-t border-line pt-3 text-sm text-ink-soft">
          <div className="mb-1 flex items-center justify-between gap-3 px-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted">{copy.language}</span>
            <LanguageSwitcher currentLocale={locale} label={copy.language} />
          </div>
          <SidebarLink href="/logout" icon={LogOut} label={copy.logout} />
        </div>
      </aside>

      {profileOpen && <ProfileModal onClose={() => setProfileOpen(false)} onCompletionChange={updateCompletion} />}
      {depositOpen && <DepositModal onClose={() => setDepositOpen(false)} />}
    </>
  );
}

function DepositModal({ onClose }: { onClose: () => void }) {
  const t = createTranslator(useLocale());
  const [method, setMethod] = useState("");
  const methods = [
    { id: "crypto", label: t("Crypto Currency"), icon: Bitcoin },
    { id: "bank", label: t("Wire transfer"), icon: Landmark },
  ];

  return (
    <Modal labelledBy="deposit-title" onClose={onClose}>
      <div className="max-h-[calc(100dvh-2rem)] overflow-y-auto w-full max-w-lg rounded-2xl border border-line bg-white p-5 shadow-2xl sm:p-7">
        <div className="flex items-start justify-between gap-4"><div><h2 id="deposit-title" className="text-2xl font-semibold text-ink">{t("Select Payment Method")}</h2><p className="mt-2 text-muted">{t("Choose how you would like to prepare your deposit.")}</p></div><button type="button" onClick={onClose} aria-label={t("Close")}><X size={22} /></button></div>
        <div className="mt-6 grid gap-2">
          {methods.map(({ id, label, icon: Icon }) => <button key={id} type="button" onClick={() => setMethod(id)} className={`flex min-h-12 items-center justify-between border px-5 text-left ${method === id ? "border-brand bg-brand-soft text-brand" : "border-[#9da7b4] text-ink"}`}><Icon size={22} /><span className="font-semibold">{label}</span></button>)}
        </div>
        <p className="mt-5 text-sm text-muted">{t("Any transfer fees are charged by the selected provider, not by Brickwise.")}</p>
        <div className="mt-5 flex gap-3"><button type="button" onClick={onClose} className="min-h-11 flex-1 border border-line bg-canvas font-bold text-ink-soft">{t("Close")}</button><a href={method ? `/funding?method=${method}` : "/funding"} aria-disabled={!method} onClick={(event) => { if (!method) event.preventDefault(); }} className={`inline-flex min-h-11 flex-[1.6] items-center justify-center font-bold text-white ${method ? "bg-brand" : "pointer-events-none bg-[#9bcdea]"}`}>{method ? t("Continue") : t("Selection Required")}</a></div>
      </div>
    </Modal>
  );
}

const itemStyle = (active: boolean, tone?: "success" | "warning") => `relative flex min-h-9 w-full items-center gap-3 rounded-lg px-3 text-left transition-colors ${active
  ? "bg-brand-soft font-semibold text-brand before:absolute before:inset-y-2 before:left-0 before:w-[3px] before:rounded-full before:bg-brand"
  : tone === "success" ? "text-emerald-700 hover:bg-canvas" : "hover:bg-canvas hover:text-ink"}`;

function SidebarGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="mt-3"><p className="mb-1 px-3 text-[11px] font-bold uppercase tracking-wider text-muted">{label}</p><div className="grid gap-0.5">{children}</div></div>;
}

function SidebarLink({ href, icon: Icon, label, active = false }: { href: string; icon: typeof House; label: string; active?: boolean }) {
  const content = <><Icon size={18} aria-hidden="true" />{label}</>;
  // Logout must discard the router cache and the in-memory browser auth client.
  if (href === "/logout") return <a href={href} className={itemStyle(false)}>{content}</a>;
  return <Link href={href} className={itemStyle(active)} aria-current={active ? "page" : undefined}>{content}</Link>;
}

function SidebarButton({ icon: Icon, label, onClick, active = false, tone }: { icon: typeof House; label: string; onClick: () => void; active?: boolean; tone?: "success" | "warning" }) {
  return <button type="button" onClick={onClick} className={itemStyle(active, tone)}>
    <Icon size={18} aria-hidden="true" />{label}
    {tone === "warning" && <span className="ml-auto h-2 w-2 rounded-full bg-amber-500" aria-hidden="true" />}
  </button>;
}

function ProfileModal({ onClose, onCompletionChange }: { onClose: () => void; onCompletionChange: (complete: boolean) => void }) {
  const locale = useLocale();
  const t = createTranslator(locale);
  const [saving, setSaving] = useState(false);
  const [signing, setSigning] = useState(false);
  const [complete, setComplete] = useState(false);
  const [message, setMessage] = useState("");
  const [profile, setProfile] = useState<{ id: string; email: string; fields: ProfileFields } | null>(null);
  const [draftNames, setDraftNames] = useState({ first_name: "", last_name: "" });
  const [loadFailed, setLoadFailed] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const profileRef = useRef(profile);
  const savingRef = useRef(false);
  const signingRef = useRef(false);
  const agreementComplete = useRef(false);
  const updateCompletion = useCallback((accepted: boolean) => {
    agreementComplete.current = accepted;
    const completed = accepted && !!profileRef.current && validProfileNames(profileRef.current.fields);
    setComplete(completed);
    onCompletionChange(completed);
  }, [onCompletionChange]);

  function updateSigning(value: boolean) {
    signingRef.current = value;
    setSigning(value);
  }

  function close() {
    if (!savingRef.current && !signingRef.current) onClose();
  }
  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const { data, error } = await createClient().auth.getUser();
        if (error || !data.user) throw new Error("Profile unavailable");
        if (active) {
          const loaded = { id: data.user.id, email: data.user.email || "", fields: readProfileFields(data.user.user_metadata) };
          profileRef.current = loaded;
          setProfile(loaded);
          setDraftNames({ first_name: loaded.fields.first_name, last_name: loaded.fields.last_name });
        }
      } catch {
        if (active) setLoadFailed(true);
      }
    }
    void load();
    return () => { active = false; };
  }, []);

  async function persistProfile() {
    const current = profileRef.current;
    if (!current || !formRef.current || savingRef.current) throw new Error("Profile unavailable");
    if (!formRef.current.reportValidity() || !validProfileNames(draftNames)) {
      setMessage(agreementCopy(locale).nameRequired);
      throw new Error("Profile name required");
    }
    const formData = new FormData(formRef.current);
    savingRef.current = true;
    setSaving(true);
    setMessage("");
    try {
      const patch = profilePatch(current.fields, formData);
      const supabase = createClient();
      const { data, error: authError } = await supabase.auth.getUser();
      // This guard also runs when every field already matches the saved profile.
      if (authError || data.user?.id !== current.id) throw new Error("Session changed");
      let savedUser = data.user;
      if (Object.keys(patch).length) {
        const { data: updated, error } = await supabase.auth.updateUser({ data: patch });
        if (error) throw error;
        if (updated.user?.id !== current.id) throw new Error("Session changed");
        savedUser = updated.user;
      }
      const saved = { ...current, fields: readProfileFields(savedUser.user_metadata) };
      // Sign only the name that was actually persisted for this account.
      if (!validProfileNames(saved.fields) || profileSignerName(saved.fields) !== profileSignerName(draftNames)) {
        throw new Error("Profile name changed");
      }
      profileRef.current = saved;
      setProfile(saved);
      setMessage(t("Profile saved successfully."));
      updateCompletion(agreementComplete.current);
      window.dispatchEvent(new Event("brickwise:profile-updated"));
    } catch {
      setMessage(t("Your profile could not be saved. Please try again."));
      throw new Error("Profile save failed");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (savingRef.current || signingRef.current) return;
    try { await persistProfile(); } catch { /* The form displays the save error. */ }
  }

  function updateDraftNames() {
    if (!formRef.current) return;
    const form = new FormData(formRef.current);
    setDraftNames({ first_name: String(form.get("first_name") || ""), last_name: String(form.get("last_name") || "") });
  }

  return (
    <Modal labelledBy="profile-title" onClose={close}>
      <div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto border border-line bg-white p-5 shadow-2xl sm:p-8">
        <div className="flex items-start justify-between gap-4"><div><h2 id="profile-title" className="text-3xl font-bold text-ink">{complete ? agreementCopy(locale).profileComplete : t("Complete your profile")}</h2><p className="mt-2 text-muted">{t("Verify your account information before requesting a share purchase.")}</p></div><button type="button" onClick={close} disabled={saving || signing} className="flex h-10 w-10 items-center justify-center disabled:opacity-50" aria-label={t("Close profile")}><X size={24} /></button></div>
        <div className="mt-7 flex items-center justify-between border-t border-line pt-6"><h3 className="text-xl font-bold">{t("Fill your information")}</h3><span className="text-sm text-muted">{t("Account details")}</span></div>
        {!profile && <p role="status" className="mt-6">{loadFailed ? t("Your profile could not be loaded. Please close and reopen this window.") : t("Loading")}</p>}
        {profile && <form ref={formRef} onSubmit={saveProfile} onChange={updateDraftNames} className="mt-6 grid gap-4 sm:grid-cols-2">
          <ProfileField label={t("First name")} name="first_name" defaultValue={profile.fields.first_name} required disabled={saving || signing} />
          <ProfileField label={t("Last name")} name="last_name" defaultValue={profile.fields.last_name} required disabled={saving || signing} />
          <ProfileField label={t("Email")} name="email" defaultValue={profile.email} type="email" disabled />
          <ProfileField label={t("Date of birth")} name="date_of_birth" type="date" defaultValue={profile.fields.date_of_birth} disabled={saving || signing} />
          <label className="text-sm font-bold text-ink">{t("Gender")}<select name="gender" defaultValue={profile.fields.gender} disabled={saving || signing} className="mt-2 h-12 w-full border border-line bg-white px-4 font-normal"><option value="">{t("Select gender")}</option>{profile.fields.gender && !["female", "male", "other"].includes(profile.fields.gender) && <option value={profile.fields.gender}>{profile.fields.gender}</option>}<option value="female">{t("Female")}</option><option value="male">{t("Male")}</option><option value="other">{t("Other")}</option></select></label>
          <ProfileField label={t("Phone number")} name="phone" type="tel" defaultValue={profile.fields.phone} placeholder="+49 151 23456789" disabled={saving || signing} />
          <label className="text-sm font-bold text-ink sm:col-span-2">{t("Country")}<select name="country" defaultValue={profile.fields.country} disabled={saving || signing} className="mt-2 h-12 w-full border border-line bg-white px-4 font-normal"><option value="">{t("Select a country")}</option>{profile.fields.country && !countries.some((country) => country === profile.fields.country) && <option value={profile.fields.country}>{profile.fields.country}</option>}{countries.map((country) => <option key={country} value={country}>{t(country)}</option>)}</select></label>
          {message && <p role="status" className="sm:col-span-2 bg-brand-soft p-3 text-sm font-bold text-brand">{message}</p>}
          <button type="submit" disabled={saving || signing} className="min-h-12 bg-brand font-bold text-white hover:bg-brand-strong disabled:opacity-60 sm:col-span-2 rounded-lg">{saving ? t("Saving...") : t("Save profile")}</button>
        </form>}
        {profile && <div className="mt-6"><ClientAgreement locale={locale} signerName={profileSignerName(draftNames)} canSign={validProfileNames(draftNames)} beforeSign={persistProfile} onCompletionChange={updateCompletion} onSigningChange={updateSigning} disabled={saving || signing} /></div>}
      </div>
    </Modal>
  );
}

function ProfileField({ label, name, type = "text", defaultValue = "", placeholder = "", required = false, disabled = false }: { label: string; name: string; type?: string; defaultValue?: string; placeholder?: string; required?: boolean; disabled?: boolean }) {
  return <label className="text-sm font-bold text-ink">{label}<input name={name} type={type} defaultValue={defaultValue} placeholder={placeholder} required={required} disabled={disabled} className="mt-2 h-12 w-full border border-line-strong px-4 font-normal outline-none focus:border-brand disabled:bg-canvas" /></label>;
}
