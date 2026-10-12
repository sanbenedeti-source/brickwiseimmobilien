import { Landmark, Bitcoin } from "lucide-react";
import { getAdminText } from "../lib/admin-copy";
import type { Locale } from "../lib/i18n";
import type { CompanyPaymentMethod } from "../lib/company-payment-methods";
import CopyPaymentValue from "./CopyPaymentValue";

export default function CompanyPaymentDirectory({ methods, locale, kind }: { methods: CompanyPaymentMethod[]; locale: Locale; kind?: "bank" | "crypto" }) {
  const t = getAdminText(locale);
  const groups = (["bank", "crypto"] as const).filter(group => !kind || kind === group);
  return <div className="space-y-8">{groups.map(group => {
    const rows = methods.filter(method => method.active && method.kind === group);
    const Icon = group === "bank" ? Landmark : Bitcoin;
    return <section key={group} id={group} className="scroll-mt-24">
      <h2 className="mb-4 flex items-center gap-3 text-2xl font-bold"><Icon className="text-sky-600" size={24} />{t(group === "bank" ? "Bank accounts" : "Company crypto wallets")}</h2>
      {!rows.length ? <p className="rounded-xl border border-dashed border-slate-300 bg-white p-5 text-slate-600">{t("No active payment details yet. Please contact the team.")}</p> : <div className="grid gap-4 xl:grid-cols-2">{rows.map(method => <article key={method.id} className="min-w-0 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">{group === "bank" ? "EUR" : `${method.crypto_asset} · ${method.crypto_network}`}</p>
        <h3 className="mt-2 text-xl font-bold">{method.label}</h3>
        {group === "bank" ? <dl className="mt-5 space-y-4">
          <Detail label={t("Bank name")} value={method.bank_name} /><Detail label={t("Beneficiary")} value={method.beneficiary} />
          <Detail label={t("IBAN / Account number")} value={method.account_number} /><Detail label="BIC / SWIFT" value={method.bic} /><Detail label={t("Bank address")} value={method.bank_address} />
        </dl> : <p className="mt-5 break-all rounded-xl bg-slate-50 p-4 font-mono text-sm leading-6 text-slate-800">{method.wallet_address}</p>}
        <CopyPaymentValue value={(group === "bank" ? method.account_number : method.wallet_address) || ""} label={t("Copy details")} copiedLabel={t("Copied")} failedLabel={t("Please select and copy the details.")} />
        {method.instructions && <p className="mt-5 whitespace-pre-line break-words border-t border-slate-100 pt-4 text-sm leading-6 text-slate-600">{method.instructions}</p>}
      </article>)}</div>}
      {group === "crypto" && rows.length > 0 && <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{t("Use the exact asset and network shown for the address.")}</p>}
    </section>;
  })}</div>;
}
function Detail({ label, value }: { label: string; value: string | null }) {
  return value ? <div><dt className="text-xs font-semibold text-slate-500">{label}</dt><dd className="mt-1 break-words text-sm font-semibold text-slate-800">{value}</dd></div> : null;
}
