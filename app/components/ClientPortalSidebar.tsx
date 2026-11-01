"use client";
import { useLocale } from "./LocaleProvider";
import { createTranslator } from "../lib/translate";

import {
  Bitcoin,
  Building2,
  ChevronRight,
  CircleHelp,
  ClipboardList,
  House,
  Landmark,
  LogOut,
  Menu,
  PieChart,
  UserRound,
  WalletCards,
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
import ClientAgreement from "./ClientAgreement";
import { agreementCopy } from "../lib/agreement-copy";
import { portalNavCopy } from "../lib/portal-nav-copy";
import type { Locale } from "@/app/lib/i18n";
import { openDepositEvent, openProfileEvent } from "./portal-events";

export type ClientPortalActiveItem = "marketplace" | "assets" | "account" | "income" | "wallet" | "orders" | "statement" | "documents" | "property" | "funding" | "contact" | "learn" | "about" | "risk" | "none";

const sidebarCopy = portalNavCopy;

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
  useEffect(() => {
    const openProfile = () => { setMobileOpen(false); setProfileOpen(true); };
    const openDeposit = () => { setMobileOpen(false); setDepositOpen(true); };
    window.addEventListener(openProfileEvent, openProfile);
    window.addEventListener(openDepositEvent, openDeposit);
    return () => { window.removeEventListener(openProfileEvent, openProfile); window.removeEventListener(openDepositEvent, openDeposit); };
  }, []);
  const pathname = usePathname();
  const copy = sidebarCopy[locale];
  const t = createTranslator(locale);
  // Five destinations like a simple investment app; older pages light up the destination that contains them.
  const section = pathname === "/funding" ? "wallet"
    : pathname === "/properties" || pathname.startsWith("/properties/") ? "marketplace"
    : pathname.startsWith("/contact") || pathname.startsWith("/risk") || pathname.startsWith("/insights") || pathname.startsWith("/about") ? "help"
    : pathname.startsWith("/dashboard/") ? pathname.split("/")[2]
    : active;
  const current = section === "income" || section === "assets" ? "portfolio"
    : section === "statement" ? "wallet"
    : section === "documents" ? "account"
    : section === "property" ? "marketplace"
    : section;
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

        <nav className="mt-6 grid gap-1 text-[15px] text-ink-soft" aria-label={t("Open client menu")}>
          <SidebarLink href="/dashboard/marketplace" icon={Building2} label={copy.marketplace} active={current === "marketplace"} />
          <SidebarLink href="/dashboard/assets" icon={PieChart} label={copy.portfolio} active={current === "portfolio"} />
          <SidebarLink href="/dashboard/wallet" icon={WalletCards} label={copy.wallet} active={current === "wallet"} />
          <SidebarLink href="/dashboard/orders" icon={ClipboardList} label={copy.orders} active={current === "orders"} />
          <SidebarLink href="/dashboard/account" icon={UserRound} label={copy.account} active={current === "account"} />
        </nav>

        <Link href="/dashboard/account" className="mt-5 flex shrink-0 items-center gap-3 rounded-xl border-t border-line px-2 pt-5 hover:text-brand">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-canvas text-sm font-bold text-ink">{initials}</span>
          <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-ink">{fullName}</span><span className="block truncate text-xs text-muted">{email}</span></span>
          <ChevronRight size={16} aria-hidden="true" className="text-muted" />
        </Link>

        <div className="mt-auto shrink-0 border-t border-line pt-3 text-sm text-ink-soft">
          <SidebarLink href="/contact" icon={CircleHelp} label={copy.helpSupport} active={current === "help"} />
          <div className="my-1 flex items-center justify-between gap-3 px-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted">{copy.language}</span>
            <LanguageSwitcher currentLocale={locale} label={copy.language} />
          </div>
          <SidebarLink href="/logout" icon={LogOut} label={copy.logout} />
        </div>
      </aside>

      {profileOpen && <ProfileModal onClose={() => setProfileOpen(false)} onCompletionChange={() => window.dispatchEvent(new Event("brickwise:profile-updated"))} />}
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

const itemStyle = (active: boolean) => `relative flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left transition-colors ${active
  ? "bg-brand-soft font-semibold text-brand"
  : "hover:bg-canvas hover:text-ink"}`;

function SidebarLink({ href, icon: Icon, label, active = false }: { href: string; icon: typeof House; label: string; active?: boolean }) {
  const content = <><Icon size={18} aria-hidden="true" />{label}</>;
  // Logout must discard the router cache and the in-memory browser auth client.
  if (href === "/logout") return <a href={href} className={itemStyle(false)}>{content}</a>;
  return <Link href={href} className={itemStyle(active)} aria-current={active ? "page" : undefined}>{content}</Link>;
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
