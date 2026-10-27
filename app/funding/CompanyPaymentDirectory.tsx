import { Landmark, Bitcoin } from "lucide-react";
import { getAdminText } from "../lib/admin-copy";
import type { Locale } from "../lib/i18n";
import type { CompanyPaymentMethod } from "../lib/company-payment-methods";
import CopyPaymentValue from "./CopyPaymentValue";

export default function CompanyPaymentDirectory({ methods, locale, kind }: { methods: CompanyPaymentMethod[]; locale: Locale; kind?: "bank" | "crypto" }) {
  const t = getAdminText(locale);
  const groups = (["bank", "crypto"] as const).filter(group => !kind || kind === group);
  return <div className="space-y-6">{groups.map(group => {
    const rows = methods.filter(method => method.active && method.kind === group);
    const Icon = group === "bank" ? Landmark : Bitcoin;
    return <section key={group} id={group} className="scroll-mt-24">
      <h2 className="mb-3 flex items-center gap-2.5 text-base font-semibold"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-soft text-brand"><Icon size={17} aria-hidden="true" /></span>{t(group === "bank" ? "Bank accounts" : "Company crypto wallets")}</h2>
      {!rows.length ? <p className="rounded-xl border border-dashed border-line-strong bg-white px-5 py-4 text-sm text-muted">{t("No active payment details yet. Please contact the team.")}</p> : <div className="grid gap-4 xl:grid-cols-2">{rows.map(method => <article key={method.id} className="min-w-0 rounded-xl border border-line bg-white">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4"><h3 className="font-semibold">{method.label}</h3><span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-700">{group === "bank" ? "EUR" : `${method.crypto_asset} · ${method.crypto_network}`}</span></div>
        <div className="px-5 py-4">
          {group === "bank" ? <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
            <Detail label={t("Bank name")} value={method.bank_name} /><Detail label={t("Beneficiary")} value={method.beneficiary} />
            <Detail label={t("IBAN / Account number")} value={method.account_number} mono /><Detail label="BIC / SWIFT" value={method.bic} mono /><Detail label={t("Bank address")} value={method.bank_address} />
          </dl> : <p className="break-all rounded-lg bg-canvas px-3 py-2.5 font-mono text-sm leading-6 text-ink">{method.wallet_address}</p>}
          <CopyPaymentValue value={(group === "bank" ? method.account_number : method.wallet_address) || ""} label={t("Copy details")} copiedLabel={t("Copied")} failedLabel={t("Please select and copy the details.")} />
          {method.instructions && <p className="mt-4 whitespace-pre-line break-words border-t border-line pt-3 text-sm leading-6 text-muted">{method.instructions}</p>}
        </div>
      </article>)}</div>}
      {group === "crypto" && rows.length > 0 && <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{t("Use the exact asset and network shown for the address.")}</p>}
    </section>;
  })}</div>;
}
function Detail({ label, value, mono = false }: { label: string; value: string | null; mono?: boolean }) {
  return value ? <div><dt className="text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</dt><dd className={`mt-0.5 break-words text-sm font-medium text-ink ${mono ? "font-mono" : ""}`}>{value}</dd></div> : null;
}
