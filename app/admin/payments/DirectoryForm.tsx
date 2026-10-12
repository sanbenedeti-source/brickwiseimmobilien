import { Landmark, Bitcoin } from "lucide-react";
import { getAdminText } from "@/app/lib/admin-copy";
import type { Locale } from "@/app/lib/i18n";
import type { CompanyPaymentMethod } from "@/app/lib/company-payment-methods";
import { saveCompanyPaymentMethod } from "./directory-actions";

export default function DirectoryForm({ method, kind, slot, locale }: { method?: CompanyPaymentMethod; kind: "bank" | "crypto"; slot?: number; locale: Locale }) {
  const t = getAdminText(locale);
  const Icon = kind === "bank" ? Landmark : Bitcoin;
  const title = method?.label || (kind === "bank" ? `${t("Bank account")} ${slot}` : t("Add crypto wallet"));
  return <form action={saveCompanyPaymentMethod} className="min-w-0 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
    <input type="hidden" name="id" value={method?.id || ""} /><input type="hidden" name="kind" value={kind} />
    {kind === "bank" && <input type="hidden" name="bank_slot" value={slot} />}
    <div className="mb-6 flex items-start justify-between gap-4"><h2 className="flex items-center gap-3"><Icon size={22} className="shrink-0 text-sky-600" />{title}</h2><span className={`rounded-full px-3 py-1 text-xs font-semibold ${method?.active ? "bg-emerald-50 text-emerald-800" : "bg-slate-100 text-slate-600"}`}>{t(method?.active ? "Visible to clients" : "Not published")}</span></div>
    <div className="grid gap-4 sm:grid-cols-2">
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
      <label className="grid gap-2 text-slate-600 sm:col-span-2">{t("Instructions")}<textarea name="instructions" rows={3} maxLength={2000} defaultValue={method?.instructions || ""} className="w-full rounded-lg border border-slate-200 p-3" /></label>
    </div>
    <label className="mt-5 flex items-center gap-3 font-semibold text-slate-700"><input name="active" type="checkbox" defaultChecked={method?.active ?? false} className="h-4 w-4 accent-blue-600" />{t("Visible to clients")}</label>
    <p className="mt-2 text-xs text-slate-500">{t("Only active details appear in the client payment methods.")}</p>
    <button className="mt-5 rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700" type="submit">{t("Save payment details")}</button>
  </form>;
}
function Field({ label, name, value, required=false, max, placeholder }: { label: string; name: string; value?: string | null; required?: boolean; max: number; placeholder?: string }) {
  return <label className="grid min-w-0 gap-2 text-slate-600">{label}<input name={name} defaultValue={value || ""} required={required} maxLength={max} placeholder={placeholder} className="w-full min-w-0 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-slate-900" /></label>;
}
