import { Landmark, Bitcoin } from "lucide-react";
import { getAdminText } from "@/app/lib/admin-copy";
import type { Locale } from "@/app/lib/i18n";
import type { CompanyPaymentMethod } from "@/app/lib/company-payment-methods";
import { saveCompanyPaymentMethod } from "./directory-actions";

export default function DirectoryForm({ method, kind, slot, locale }: { method?: CompanyPaymentMethod; kind: "bank" | "crypto"; slot?: number; locale: Locale }) {
  const t = getAdminText(locale);
  const Icon = kind === "bank" ? Landmark : Bitcoin;
  const title = method?.label || (kind === "bank" ? `${t("Bank account")} ${slot}` : t("Add crypto wallet"));
  return <form action={saveCompanyPaymentMethod} className="admin-card min-w-0 !mb-0">
    <input type="hidden" name="id" value={method?.id || ""} /><input type="hidden" name="kind" value={kind} />
    {kind === "bank" && <input type="hidden" name="bank_slot" value={slot} />}
    <div className="admin-card-header"><h2 className="flex items-center gap-2.5"><Icon size={18} aria-hidden="true" className="shrink-0 text-[var(--admin-brand)]" />{title}</h2><span className={`admin-badge ${method?.active ? "admin-badge-success" : "admin-badge-neutral"}`}>{t(method?.active ? "Visible to clients" : "Not published")}</span></div>
    <div className="admin-card-body admin-form">
    <div className="admin-form-grid">
      <Field label={t("Display name")} name="label" value={method?.label} max={100} required />
      {kind === "bank" ? <>
        <Field label={t("Bank name")} name="bank_name" value={method?.bank_name} max={150} required />
        <Field label={t("Beneficiary")} name="beneficiary" value={method?.beneficiary} max={150} required />
        <Field label={t("IBAN / Account number")} name="account_number" value={method?.account_number} max={80} required />
        <Field label="BIC / SWIFT" name="bic" value={method?.bic} max={30} />
        <Field label={t("Bank address")} name="bank_address" value={method?.bank_address} max={300} />
      </> : <>
        <Field label={t("Crypto asset")} name="crypto_asset" value={method?.crypto_asset} max={30} placeholder="BTC, ETH, USDT..." required />
        <Field label={t("Blockchain network")} name="crypto_network" value={method?.crypto_network} max={60} placeholder="Bitcoin, Ethereum, TRON..." required />
        <Field label={t("Company wallet address")} name="wallet_address" value={method?.wallet_address} max={200} required />
      </>}
      <label className="admin-field admin-field-wide">{t("Instructions")}<textarea name="instructions" rows={3} maxLength={2000} defaultValue={method?.instructions || ""} /></label>
    </div>
    <div><label className="admin-check font-semibold"><input name="active" type="checkbox" defaultChecked={method?.active ?? false} />{t("Visible to clients")}</label>
    <p className="admin-help mt-1">{t("Only active details appear in the client payment methods.")}</p></div>
    <div><button className="admin-btn" type="submit">{t("Save payment details")}</button></div>
    </div>
  </form>;
}
function Field({ label, name, value, required=false, max, placeholder }: { label: string; name: string; value?: string | null; required?: boolean; max: number; placeholder?: string }) {
  return <label className="admin-field min-w-0">{label}<input name={name} defaultValue={value || ""} required={required} maxLength={max} placeholder={placeholder} /></label>;
}
