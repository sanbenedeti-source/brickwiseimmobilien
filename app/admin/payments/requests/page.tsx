import { refundText } from "../refund-copy";
import RefundForm from "../RefundForm";
import { depositText } from "@/app/funding/deposit-copy";
import { getAdminText } from "@/app/lib/admin-copy";
import { getCurrentLocale } from "@/app/lib/server-locale";
import { localeHtmlLang, type Locale } from "@/app/lib/i18n";
import { getPropertyTranslations } from "@/app/lib/property-localization";
import { getExternalPropertyBySlug } from "@/app/lib/external-properties";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { isAdminUser } from "@/app/lib/admin";
import { createClient } from "@/lib/supabase/server";
import { createPaymentRequest, updatePaymentRequest } from "../actions";
import { totalRecordedMoney } from "../../../dashboard/recorded-money";

type AuthCustomer = {
  id: string;
  email: string;
  name: string;
};

type RefundRecord = { external_reference: string; note: string; created_at: string };
type PaymentRequest = {
  refunds?: RefundRecord | RefundRecord[] | null;
  credit_transaction_id: string | null;
  id: string;
  user_id: string | null;
  customer_name: string | null;
  customer_email: string | null;
  title: string | null;
  amount: number | null;
  currency: string | null;
  crypto_asset: string | null;
  crypto_network: string | null;
  method: string | null;
  status: string | null;
  instructions: string | null;
  payment_link: string | null;
  proof_url: string | null;
  admin_note: string | null;
  created_at: string | null;
  verified_at: string | null;
  properties:
    | {
        title: string | null;
        city: string | null;
        slug: string | null;
      }
    | {
        title: string | null;
        city: string | null;
        slug: string | null;
      }[]
    | null;
};

type PropertyOption = {
  id: string;
  slug: string;
  title: string | null;
  city: string | null;
  price: number | null;
};

const methodLabels: Record<string, string> = {
  bank_transfer: "Bank transfer",
  crypto: "Cryptocurrency",
  wallet_credit: "Wallet credit",
};

const statusLabels: Record<string, string> = {
  draft: "Draft",
  sent: "Sent",
  pending: "Pending",
  paid: "Paid",
  verified: "Verified",
  failed: "Failed",
  cancelled: "Cancelled",
  refunded: "Refunded",
};

const allowedMethods = ["bank_transfer", "crypto"];

function getAdminSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }

  return createSupabaseClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function formatDate(date: string | null, locale: Locale) {
  if (!date) return "-";

  return new Date(date).toLocaleDateString(localeHtmlLang[locale], {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatMoney(amount: number | null, currency: string | null, locale: Locale) {
  if (amount === null) return "-";

  return new Intl.NumberFormat(localeHtmlLang[locale], {
    style: "currency",
    currency: currency || "EUR",
    currencyDisplay: "code",
    maximumFractionDigits: 2,
  }).format(amount);
}

function getProperty(payment: PaymentRequest) {
  if (Array.isArray(payment.properties)) {
    return payment.properties[0] || null;
  }

  return payment.properties;
}

async function getCustomers(adminSupabase: ReturnType<typeof getAdminSupabase>) {
  if (!adminSupabase) return [] as AuthCustomer[];

  const { data, error } = await adminSupabase.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });

  if (error) {
    console.error("Payment customers error:", error.message);
    return [] as AuthCustomer[];
  }

  return data.users
    .filter((customer) => customer.email && !isAdminUser(customer))
    .map((customer) => ({
      id: customer.id,
      email: customer.email || "",
      name:
        String(customer.user_metadata?.full_name || "").trim() ||
        customer.email?.split("@")[0] ||
        "Customer",
    }));
}

export default async function AdminPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ method?: string | string[]; result?: string }>;
}) {
  const locale = await getCurrentLocale();
  const t = getAdminText(locale);
  const query = await searchParams;
  const methodFromQuery = Array.isArray(query.method)
    ? query.method[0]
    : query.method;
  const selectedMethod = allowedMethods.includes(methodFromQuery || "")
    ? methodFromQuery || "bank_transfer"
    : "bank_transfer";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  if (!isAdminUser(user)) {
    redirect("/dashboard");
  }
  const translations = await getPropertyTranslations(locale);

  const adminSupabase = getAdminSupabase();
  const serviceRoleMissing = !adminSupabase;

  const customers = await getCustomers(adminSupabase);

  const { data: properties } = adminSupabase
    ? await adminSupabase
        .from("properties")
        .select("id,slug,title,city,price")
        .order("created_at", { ascending: false })
    : { data: [] };

  const { data: payments, error: paymentsError } = adminSupabase
    ? await adminSupabase
        .from("payment_requests")
        .select(
          `
          id,
          user_id,
          credit_transaction_id,
          refunds:payment_refunds(external_reference,note,created_at),
          customer_name,
          customer_email,
          title,
          amount,
          currency,
          crypto_asset,
          crypto_network,
          method,
          status,
          instructions,
          payment_link,
          proof_url,
          admin_note,
          created_at,
          verified_at,
          properties (
            title,
            city,
            slug
          )
        `
        )
        .order("created_at", { ascending: false })
    : { data: [], error: null };

  const totals = totalRecordedMoney((payments as PaymentRequest[] | null | undefined || [])
    .filter((payment) => payment.status === "paid" || payment.status === "verified"));

  return (
    <main className="admin-workspace">
      <Link href="/admin/payments/deposits" className="m-5 inline-block rounded-xl bg-emerald-700 px-5 py-3 font-bold text-white">{depositText(locale)("queue")}</Link>
      <section className="admin-hero">
        <div className="mx-auto max-w-7xl">
          <Link href="/admin" className="text-sm font-bold text-white/70">{t("Back to admin")}</Link>

          <p className="mt-10 text-lg font-bold text-emerald-300">{t("Payment operations")}</p>

          <h1 className="font-display mt-4 max-w-5xl text-6xl font-bold leading-none">{t("Manage payment requests")}</h1>

          <p className="mt-6 max-w-3xl text-xl leading-relaxed text-white/80">{t("Manage bank and crypto payments from one place. All amounts are recorded in EUR.")}</p>
        </div>
      </section>

      <section className="admin-content-section">
        {query.result && <div role="status" className={`mb-5 rounded-xl border p-4 ${query.result === "saved" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-900"}`}>{t(query.result === "saved" ? "Payment request created." : "Check the payment details and try again.")}</div>}
        {serviceRoleMissing && (
          <div className="mb-8 rounded-2xl bg-red-50 p-5 font-bold text-red-700">{t("Add SUPABASE_SERVICE_ROLE_KEY in Vercel to manage payment requests.")}</div>
        )}

        {paymentsError && (
          <div className="mb-8 rounded-2xl bg-amber-50 p-5 font-bold text-amber-800">{t("Payment table is not ready. Run SUPABASE_PAYMENT_REQUESTS_SETUP.sql in Supabase SQL Editor.")}</div>
        )}

        <div className="admin-metrics grid md:grid-cols-3">
          <AdminMetric title={t("Payment requests")} value={String(payments?.length || 0)} />
          <AdminMetric title={t("Customers")} value={String(customers.length)} />
          <AdminMetric title={t("Paid/verified volume by currency")} value={totals.length ? totals.map((total) => formatMoney(total.amount, total.currency, locale)).join(" / ") : formatMoney(0, "EUR", locale)} />
        </div>

        <div className="admin-panel">
          <div className="grid gap-4 md:grid-cols-2">
            <MethodCard
              title={t("Bank transfer")}
              label={t("SEPA/Wire")}
              active={selectedMethod === "bank_transfer"}
              href="/admin/payments/requests?method=bank_transfer"
            />
            <MethodCard
              title={t("Cryptocurrency")}
              label="BTC / ETH / USDT / USDC"
              active={selectedMethod === "crypto"}
              href="/admin/payments/requests?method=crypto"
            />
          </div>
        </div>

        <div className="admin-panel">
          <h2 className="text-4xl font-bold">{t("Create payment request")}</h2>
          <p className="mt-3 text-lg text-slate-600">{t("Choose the asset and network, then provide verified payment instructions.")}</p>

          <form key={selectedMethod} action={createPaymentRequest} className="mt-8 grid gap-5 lg:grid-cols-2">
            <div>
              <label className="text-sm font-bold text-slate-600">{t("Customer")}</label>
              <select
                name="user_id"
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-5 py-4 text-base outline-none"
                defaultValue=""
              >
                <option value="">{t("No registered user / manual email")}</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name === "Customer" ? t("Customer") : customer.name} - {customer.email}
                  </option>
                ))}
              </select>
            </div>

            <Field label={t("Customer email")} name="customer_email" type="email" required />
            <Field label={t("Customer name")} name="customer_name" />

            <div>
              <label className="text-sm font-bold text-slate-600">{t("Property")}</label>
              <select
                name="property_id"
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-5 py-4 text-base outline-none"
                defaultValue=""
              >
                <option value="">{t("No property selected")}</option>
                {(properties as PropertyOption[] | null | undefined || []).map((property) => (
                  <option key={property.id} value={property.id}>
                    {translations.get(property.slug)?.title || property.title} - {property.city} - {formatMoney(getExternalPropertyBySlug(property.slug)?.price || property.price, "EUR", locale)}
                  </option>
                ))}
              </select>
            </div>

            <Field label={t("Payment title")} name="title" required placeholder={t("Reservation deposit")} />
            <Field label={t("Amount")} name="amount" type="number" required placeholder="5000" />

            <div>
              <label className="text-sm font-bold text-slate-600">{t("Currency")}</label>
              <select
                name="currency"
                defaultValue="EUR"
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-5 py-4 text-base outline-none"
              >
                <option value="EUR">EUR</option>
              </select>
            </div>

            <input type="hidden" name="method" value={selectedMethod} />
            {selectedMethod === "crypto" && <fieldset className="admin-crypto-fields lg:col-span-2">
              <legend className="px-2 text-sm font-bold">{t("Crypto payment details")}</legend>
              <Field label={t("Crypto asset")} name="crypto_asset" required placeholder="BTC, ETH, SOL, USDT, USDC..." />
              <Field label={t("Blockchain network")} name="crypto_network" required placeholder="Bitcoin, Ethereum, Solana, TRON..." />
              <p className="text-xs text-slate-600 lg:col-span-2">{t("Specify the exact asset and network. The payment amount remains in EUR.")}</p>
            </fieldset>}

            <Field label={t("Payment link")} name="payment_link" placeholder="https://..." />

            <div className="lg:col-span-2">
              <label className="text-sm font-bold text-slate-600">{t("Instructions")}</label>
              <textarea
                name="instructions"
                rows={5}
                className="mt-2 w-full rounded-2xl border border-slate-200 px-5 py-4 text-base outline-none"
                placeholder={t("Do not send funds before bank details are verified. Use reference BW-...")}
              />
            </div>

            <div className="lg:col-span-2">
              <label className="text-sm font-bold text-slate-600">{t("Admin note")}</label>
              <textarea
                name="admin_note"
                rows={3}
                className="mt-2 w-full rounded-2xl border border-slate-200 px-5 py-4 text-base outline-none"
                placeholder={t("Internal note, visible only to admin.")}
              />
            </div>

            <button
              type="submit"
              disabled={serviceRoleMissing}
              className="rounded-2xl bg-[#0F172A] px-8 py-4 text-lg font-bold text-white disabled:opacity-60"
            >{t("Create payment request")}</button>
          </form>
        </div>

        <div className="admin-panel">
          <h2 className="text-4xl font-bold">{t("Payment requests")}</h2>

          {!payments || payments.length === 0 ? (
            <div className="mt-8 rounded-2xl bg-slate-50 p-6 text-lg text-slate-600">{t("No payment requests yet.")}</div>
          ) : (
            <div className="mt-8 space-y-5">
              {(payments as PaymentRequest[]).map((payment) => {
                const property = getProperty(payment);
                const refund = Array.isArray(payment.refunds) ? payment.refunds[0] : payment.refunds;

                return (
                  <div
                    key={payment.id}
                    className="rounded-2xl border border-slate-100 bg-slate-50 p-6"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-bold uppercase tracking-wide text-slate-500">
                          {formatDate(payment.created_at, locale)}
                        </p>
                        <h3 className="mt-2 text-3xl font-bold">{payment.title}</h3>
                        <p className="mt-2 text-lg text-slate-600">
                          {payment.customer_name || t("Customer")} - {payment.customer_email}
                        </p>
                        <p className="mt-2 text-xl font-bold">
                          {formatMoney(payment.amount, payment.currency, locale)}
                        </p>
                      </div>

                      <span className="rounded-full bg-emerald-100 px-4 py-2 text-sm font-bold text-emerald-700">
                        {t(statusLabels[payment.status || "draft"] || payment.status || "Unknown")}
                      </span>
                    </div>

                    <div className="mt-5 grid gap-4 md:grid-cols-3">
                      <Info label={t("Method")} value={t(methodLabels[payment.method || "bank_transfer"] || payment.method || "-")} />
                      {payment.method === "crypto" && <><Info label={t("Crypto asset")} value={payment.crypto_asset || "-"} /><Info label={t("Blockchain network")} value={payment.crypto_network || "-"} /></>}
                      <Info label={t("Property")} value={translations.get(property?.slug || "")?.title || property?.title || t("No property")} />
                      <Info label={t("Verified")} value={formatDate(payment.verified_at, locale)} />
                    </div>

                    {payment.instructions && (
                      <p className="mt-5 rounded-2xl bg-white p-5 text-base leading-relaxed text-slate-700">
                        {payment.instructions}
                      </p>
                    )}

                    {refund && <div className="mt-5 rounded-xl border border-slate-200 bg-white p-5 text-sm"><p className="font-bold">{t("Refunded")} ? {formatDate(refund.created_at, locale)}</p><p className="mt-2 break-all">{refundText(locale)("reference")}: {refund.external_reference}</p><p className="mt-2 whitespace-pre-line break-words">{refund.note}</p></div>}
                    {payment.status !== "refunded" && <form action={updatePaymentRequest} className="mt-5 grid gap-4 lg:grid-cols-4">
                      <input type="hidden" name="payment_id" value={payment.id} />

                      <div>
                        <label className="text-sm font-bold text-slate-600">{t("Status")}</label>
                        <select
                          name="status"
                          disabled={Boolean(payment.credit_transaction_id)}
                          defaultValue={payment.status || "draft"}
                          className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none"
                        >
                          {Object.entries(statusLabels).filter(([value]) => value !== "refunded").map(([value, label]) => (
                            <option key={value} value={value}>
                              {t(label)}
                            </option>
                          ))}
                        </select>
                      </div>

                      {payment.credit_transaction_id && <input type="hidden" name="status" value={payment.status || "verified"} />}
                      <CompactField label={t("Payment link")} name="payment_link" defaultValue={payment.payment_link || ""} />
                      <CompactField label={t("Proof URL")} name="proof_url" defaultValue={payment.proof_url || ""} />
                      <CompactField label={t("Admin note")} name="admin_note" defaultValue={payment.admin_note || ""} />

                      <button
                        type="submit"
                        className="rounded-2xl bg-[#0F172A] px-5 py-3 text-sm font-bold text-white lg:col-span-4"
                      >{t("Save payment status")}</button>
                    </form>}
                    {["paid","verified"].includes(payment.status || "") && <RefundForm paymentId={payment.id} amount={Number(payment.amount)} wallet={Boolean(payment.credit_transaction_id)} locale={locale}/>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

function AdminMetric({ title, value }: { title: string; value: string }) {
  return (
    <div className="admin-metric">
      <div className="text-5xl font-bold">{value}</div>
      <h2 className="mt-6 text-2xl font-bold">{title}</h2>
    </div>
  );
}

function MethodCard({
  title,
  label,
  active,
  href,
}: {
  title: string;
  label: string;
  active: boolean;
  href: string;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={[
        "rounded-2xl border p-5 transition",
        active
          ? "border-[#0F172A] bg-[#0F172A] text-white"
          : "border-slate-200 bg-slate-50 text-[#111111] hover:bg-white",
      ].join(" ")}
    >
      <p className={active ? "text-sm font-bold text-emerald-300" : "text-sm font-bold text-emerald-700"}>
        {label}
      </p>
      <h3 className="mt-3 text-2xl font-bold">{title}</h3>
    </Link>
  );
}

function Field({
  label,
  name,
  type = "text",
  required = false,
  placeholder = "",
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <div>
      <label htmlFor={name} className="text-sm font-bold text-slate-600">{label}</label>
      <input
        id={name}
        name={name}
        type={type}
        required={required}
        step={type === "number" ? "0.01" : undefined}
        className="mt-2 w-full rounded-2xl border border-slate-200 px-5 py-4 text-base outline-none"
        placeholder={placeholder}
      />
    </div>
  );
}

function CompactField({
  label,
  name,
  defaultValue,
}: {
  label: string;
  name: string;
  defaultValue: string;
}) {
  return (
    <div>
      <label className="text-sm font-bold text-slate-600">{label}</label>
      <input
        name={name}
        defaultValue={defaultValue}
        className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none"
      />
    </div>
  );
}

function Info({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="rounded-2xl bg-white p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-2 font-bold text-slate-800">{value || "-"}</p>
    </div>
  );
}
