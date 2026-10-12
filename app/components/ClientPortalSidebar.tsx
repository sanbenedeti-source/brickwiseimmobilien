"use client";
import { useLocale } from "./LocaleProvider";
import { createTranslator } from "../lib/translate";

import {
  ArrowDownToLine,
  TriangleAlert,
  ArrowLeft,
  BadgeDollarSign,
  BookOpen,
  Building2,
  CircleHelp,
  CircleUserRound,
  FileCheck2,
  House,
  Landmark,
  LogOut,
  Menu,
  Settings,
  ShoppingBag,
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

export type ClientPortalActiveItem = "marketplace" | "assets" | "account" | "income" | "wallet" | "orders" | "property" | "funding" | "contact" | "learn" | "about" | "risk" | "none";

const sidebarCopy = {
  en: { deposit: "Deposit", profile: "Complete profile", marketplace: "Properties", assets: "Assets", account: "Account", income: "Income", wallet: "Wallet", orders: "Orders", withdraw: "Withdraw / Agent", learn: "Learn", risk: "Risk warnings", about: "About us", settings: "Settings", logout: "Logout", language: "Language" },
  de: { deposit: "Einzahlen", profile: "Profil vervollständigen", marketplace: "Immobilien", assets: "Vermögenswerte", account: "Konto", income: "Erträge", wallet: "Wallet", orders: "Aufträge", withdraw: "Auszahlung / Berater", learn: "Lernen", risk: "Risikohinweise", about: "Über uns", settings: "Einstellungen", logout: "Abmelden", language: "Sprache" },
  fr: { deposit: "Dépôt", profile: "Compléter le profil", marketplace: "Biens", assets: "Actifs", account: "Compte", income: "Revenus", wallet: "Portefeuille", orders: "Ordres", withdraw: "Retrait / Conseiller", learn: "Apprendre", risk: "Avertissements", about: "À propos", settings: "Paramètres", logout: "Déconnexion", language: "Langue" },
  es: { deposit: "Depositar", profile: "Completar perfil", marketplace: "Propiedades", assets: "Activos", account: "Cuenta", income: "Ingresos", wallet: "Cartera", orders: "Órdenes", withdraw: "Retirar / Asesor", learn: "Aprender", risk: "Advertencias", about: "Sobre nosotros", settings: "Configuración", logout: "Cerrar sesión", language: "Idioma" },
  it: { deposit: "Deposita", profile: "Completa il profilo", marketplace: "Immobili", assets: "Asset", account: "Account", income: "Reddito", wallet: "Wallet", orders: "Ordini", withdraw: "Prelievo / Consulente", learn: "Impara", risk: "Avvertenze sui rischi", about: "Chi siamo", settings: "Impostazioni", logout: "Esci", language: "Lingua" },
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
  const [profileOpen, setProfileOpen] = useState(false);
  const [depositOpen, setDepositOpen] = useState(false);
  const [profileComplete, setProfileComplete] = useState(false);
  const completionRequest = useRef(0);
  const updateCompletion = useCallback((complete: boolean) => {
    completionRequest.current += 1;
    setProfileComplete(complete);
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
        }
      } catch {
        if (!signal.aborted && request === completionRequest.current) setProfileComplete(false);
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
              : active;
  const initials = fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "BW";

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-50 flex h-16 items-center border-b border-[#dfe5eb] bg-white px-4 lg:hidden">
        <BrandLogo />
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="ml-auto flex h-10 w-10 items-center justify-center border border-[#d4dbe4]"
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

      <aside className={`fixed inset-y-0 left-0 z-[60] flex w-[282px] flex-col overflow-hidden border-r border-[#e1e5ea] bg-white px-5 py-5 transition-transform lg:translate-x-0 ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex shrink-0 items-center justify-between gap-3">
          <BrandLogo />
          <button type="button" onClick={() => setMobileOpen(false)} className="flex h-9 w-9 items-center justify-center text-[#687486] lg:hidden" aria-label={t("Close menu")}><X size={20} /></button>
        </div>

        <div className="mt-6 flex shrink-0 items-center gap-3 px-1">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#2f9bdb] font-bold text-white">{initials}</span>
          <div className="min-w-0"><p className="truncate font-bold text-[#17233f]">{fullName}</p><p className="truncate text-xs text-[#7a8494]">{email}</p></div>
          <Link href="/dashboard" className="ml-auto flex h-8 w-8 items-center justify-center rounded-full bg-[#2f9bdb] text-white" aria-label={t("Back to dashboard")}><ArrowLeft size={17} /></Link>
        </div>

        <nav className="mt-5 grid min-h-0 flex-1 content-start gap-1 overflow-y-auto overscroll-contain pb-4 pr-1 text-[15px] text-[#253653]">
          <button type="button" onClick={() => setDepositOpen(true)} className={`flex min-h-11 origin-left transform-gpu items-center gap-3 px-3 text-left transition duration-200 ease-out motion-safe:hover:scale-[1.03] ${currentActive === "funding" ? "bg-[#2f9bdb] text-white" : "hover:bg-[#f2f7fa]"}`}><BadgeDollarSign size={21} />{copy.deposit}</button>
          <button type="button" onClick={() => setProfileOpen(true)} className={`flex min-h-11 origin-left transform-gpu items-center gap-3 border-y border-[#e4e8ed] px-3 text-left transition duration-200 ease-out hover:bg-[#f2f7fa] motion-safe:hover:scale-[1.03] ${profileComplete ? "text-emerald-700" : ""}`}><FileCheck2 size={21} />{profileComplete ? agreementCopy(locale).profileComplete : copy.profile}</button>
          <SidebarLink href="/dashboard/marketplace" icon={Building2} label={copy.marketplace} active={currentActive === "marketplace" || currentActive === "property"} />
          <SidebarLink href="/dashboard/assets" icon={CircleUserRound} label={copy.assets} active={currentActive === "assets"} />
          <SidebarLink href="/dashboard/account" icon={Landmark} label={copy.account} active={currentActive === "account"} />
          <SidebarLink href="/dashboard/income" icon={House} label={copy.income} active={currentActive === "income"} />
          <SidebarLink href="/dashboard/wallet" icon={WalletCards} label={copy.wallet} active={currentActive === "wallet"} />
          <SidebarLink href="/dashboard/orders" icon={ShoppingBag} label={copy.orders} active={currentActive === "orders"} />
          <SidebarLink href="/contact" icon={ArrowDownToLine} label={copy.withdraw} active={currentActive === "contact"} />
          <SidebarLink href="/insights" icon={BookOpen} label={copy.learn} active={currentActive === "learn"} />
          <SidebarLink href="/risk" icon={TriangleAlert} label={copy.risk} active={currentActive === "risk"} />
          <SidebarLink href="/about" icon={CircleHelp} label={copy.about} active={currentActive === "about"} />
        </nav>

        <div className="shrink-0 grid gap-1 border-t border-[#e4e8ed] bg-white pt-4 text-[15px] text-[#253653]">
          <div className="mb-2 flex items-center justify-between gap-3 px-3">
            <span className="text-xs font-bold uppercase tracking-wide text-[#7a8494]">{copy.language}</span>
            <LanguageSwitcher currentLocale={locale} label={copy.language} />
          </div>
          <SidebarLink href="/dashboard/account" icon={Settings} label={copy.settings} active={currentActive === "account"} />
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
      <div className="max-h-[calc(100dvh-2rem)] overflow-y-auto w-full max-w-lg rounded-2xl border border-[#cfd6df] bg-white p-5 shadow-2xl sm:p-7">
        <div className="flex items-start justify-between gap-4"><div><h2 id="deposit-title" className="text-2xl font-semibold text-[#17233f]">{t("Select Payment Method")}</h2><p className="mt-2 text-[#687486]">{t("Choose how you would like to prepare your deposit.")}</p></div><button type="button" onClick={onClose} aria-label={t("Close")}><X size={22} /></button></div>
        <div className="mt-6 grid gap-2">
          {methods.map(({ id, label, icon: Icon }) => <button key={id} type="button" onClick={() => setMethod(id)} className={`flex min-h-12 items-center justify-between border px-5 text-left ${method === id ? "border-[#2f9bdb] bg-[#edf7fc] text-[#168bd3]" : "border-[#9da7b4] text-[#17233f]"}`}><Icon size={22} /><span className="font-semibold">{label}</span></button>)}
        </div>
        <p className="mt-5 text-sm text-[#7a8494]">{t("Any transfer fees are charged by the selected provider, not by Brickwise.")}</p>
        <div className="mt-5 flex gap-3"><button type="button" onClick={onClose} className="min-h-11 flex-1 border border-[#d4dbe4] bg-[#f5f6fa] font-bold text-[#35435a]">{t("Close")}</button><a href={method ? `/funding?method=${method}` : "/funding"} aria-disabled={!method} onClick={(event) => { if (!method) event.preventDefault(); }} className={`inline-flex min-h-11 flex-[1.6] items-center justify-center font-bold text-white ${method ? "bg-[#2f9bdb]" : "pointer-events-none bg-[#9bcdea]"}`}>{method ? t("Continue") : t("Selection Required")}</a></div>
      </div>
    </Modal>
  );
}

function SidebarLink({ href, icon: Icon, label, active = false }: { href: string; icon: typeof House; label: string; active?: boolean }) {
  const className = `flex min-h-11 origin-left transform-gpu items-center gap-3 px-3 transition duration-200 ease-out motion-safe:hover:scale-[1.03] ${active ? "bg-[#2f9bdb] text-white" : "hover:bg-[#f2f7fa]"}`;
  // Logout must discard the router cache and the in-memory browser auth client.
  if (href === "/logout") return <a href={href} className={className}><Icon size={21} />{label}</a>;
  return <Link href={href} className={className}><Icon size={21} />{label}</Link>;
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
      <div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto border border-[#cfd6df] bg-white p-5 shadow-2xl sm:p-8">
        <div className="flex items-start justify-between gap-4"><div><h2 id="profile-title" className="text-3xl font-bold text-[#17233f]">{complete ? agreementCopy(locale).profileComplete : t("Complete your profile")}</h2><p className="mt-2 text-[#687486]">{t("Verify your account information before requesting a share purchase.")}</p></div><button type="button" onClick={close} disabled={saving || signing} className="flex h-10 w-10 items-center justify-center disabled:opacity-50" aria-label={t("Close profile")}><X size={24} /></button></div>
        <div className="mt-7 flex items-center justify-between border-t border-[#e4e8ed] pt-6"><h3 className="text-xl font-bold">{t("Fill your information")}</h3><span className="text-sm text-[#687486]">{t("Account details")}</span></div>
        {!profile && <p role="status" className="mt-6">{loadFailed ? t("Your profile could not be loaded. Please close and reopen this window.") : t("Loading")}</p>}
        {profile && <form ref={formRef} onSubmit={saveProfile} onChange={updateDraftNames} className="mt-6 grid gap-4 sm:grid-cols-2">
          <ProfileField label={t("First name")} name="first_name" defaultValue={profile.fields.first_name} required disabled={saving || signing} />
          <ProfileField label={t("Last name")} name="last_name" defaultValue={profile.fields.last_name} required disabled={saving || signing} />
          <ProfileField label={t("Email")} name="email" defaultValue={profile.email} type="email" disabled />
          <ProfileField label={t("Date of birth")} name="date_of_birth" type="date" defaultValue={profile.fields.date_of_birth} disabled={saving || signing} />
          <label className="text-sm font-bold text-[#17233f]">{t("Gender")}<select name="gender" defaultValue={profile.fields.gender} disabled={saving || signing} className="mt-2 h-12 w-full border border-[#cfd6df] bg-white px-4 font-normal"><option value="">{t("Select gender")}</option>{profile.fields.gender && !["female", "male", "other"].includes(profile.fields.gender) && <option value={profile.fields.gender}>{profile.fields.gender}</option>}<option value="female">{t("Female")}</option><option value="male">{t("Male")}</option><option value="other">{t("Other")}</option></select></label>
          <ProfileField label={t("Phone number")} name="phone" type="tel" defaultValue={profile.fields.phone} placeholder="+1 702 123 4567" disabled={saving || signing} />
          <label className="text-sm font-bold text-[#17233f] sm:col-span-2">{t("Country")}<select name="country" defaultValue={profile.fields.country} disabled={saving || signing} className="mt-2 h-12 w-full border border-[#cfd6df] bg-white px-4 font-normal"><option value="">{t("Select a country")}</option>{profile.fields.country && !countries.some((country) => country === profile.fields.country) && <option value={profile.fields.country}>{profile.fields.country}</option>}{countries.map((country) => <option key={country} value={country}>{t(country)}</option>)}</select></label>
          {message && <p role="status" className="sm:col-span-2 bg-[#eff8fd] p-3 text-sm font-bold text-[#237faf]">{message}</p>}
          <button type="submit" disabled={saving || signing} className="min-h-12 bg-[#2f9bdb] font-bold text-white hover:bg-[#17233f] disabled:opacity-60 sm:col-span-2">{saving ? t("Saving...") : t("Save profile")}</button>
        </form>}
        {profile && <div className="mt-6"><ClientAgreement locale={locale} signerName={profileSignerName(draftNames)} canSign={validProfileNames(draftNames)} beforeSign={persistProfile} onCompletionChange={updateCompletion} onSigningChange={updateSigning} disabled={saving || signing} /></div>}
      </div>
    </Modal>
  );
}

function ProfileField({ label, name, type = "text", defaultValue = "", placeholder = "", required = false, disabled = false }: { label: string; name: string; type?: string; defaultValue?: string; placeholder?: string; required?: boolean; disabled?: boolean }) {
  return <label className="text-sm font-bold text-[#17233f]">{label}<input name={name} type={type} defaultValue={defaultValue} placeholder={placeholder} required={required} disabled={disabled} className="mt-2 h-12 w-full border border-[#cfd6df] px-4 font-normal outline-none focus:border-[#2f9bdb] disabled:bg-[#f4f6f8]" /></label>;
}
