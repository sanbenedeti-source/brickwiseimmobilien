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
import { hasAdminSession } from "@/app/lib/admin-session";
import { createClient } from "@/lib/supabase/server";
import { createPaymentRequest, updatePaymentRequest } from "../actions";
import { totalRecordedMoney } from "../../../dashboard/recorded-money";
import { ChevronDown } from "lucide-react";
import { AdminAlert, AdminCard, AdminDisclosure, AdminEmpty, AdminPageHeader, AdminStat, StatusBadge } from "../../ui";

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
  searchParams: Promise<{ method?: string | string[]; result?: string; form?: string }>;
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
  if (!(await hasAdminSession(supabase, user))) redirect("/admin/security");
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

  const paymentList = (payments as PaymentRequest[] | null | undefined) || [];
  const totals = totalRecordedMoney(paymentList.filter((payment) => payment.status === "paid" || payment.status === "verified"));
  const openCount = paymentList.filter((payment) => payment.status === "pending" || payment.status === "sent").length;
  const createOpen = query.form === "new" || Boolean(methodFromQuery) || (Boolean(query.result) && query.result !== "saved");

  return (
    <main className="admin-workspace">
      <AdminPageHeader
        back={{ href: "/admin/payments", label: t("Payment methods") }}
        eyebrow={t("Payment operations")}
        title={t("Manage payment requests")}
        description={t("Manage bank and crypto payments from one place. All amounts are recorded in EUR.")}
        actions={<>
          <Link href="/admin/payments/deposits" className="admin-btn admin-btn-secondary">{depositText(locale)("queue")}</Link>
          <a href="?form=new#create-payment" className="admin-btn">{t("Create payment request")}</a>
        </>}
      />
      {query.result && <AdminAlert tone={query.result === "saved" ? "success" : "warning"}>{t(query.result === "saved" ? "Payment request created." : "Check the payment details and try again.")}</AdminAlert>}
      {serviceRoleMissing && <AdminAlert tone="danger">{t("Add SUPABASE_SERVICE_ROLE_KEY in Vercel to manage payment requests.")}</AdminAlert>}
      {paymentsError && <AdminAlert tone="warning">{t("Payment table is not ready. Run SUPABASE_PAYMENT_REQUESTS_SETUP.sql in Supabase SQL Editor.")}</AdminAlert>}

      <section className="admin-stats" aria-label={t("Key figures")}>
        <AdminStat label={t("Payment requests")} value={paymentList.length} />
        <AdminStat label={t("Pending")} value={openCount} attention={openCount > 0} />
        <AdminStat label={t("Customers")} value={customers.length} />
        <AdminStat label={t("Paid/verified volume by currency")} value={totals.length ? totals.map((total) => formatMoney(total.amount, total.currency, locale)).join(" / ") : formatMoney(0, "EUR", locale)} />
      </section>

      <AdminCard title={t("Payment requests")} description={t("Bank and crypto payments requested from clients, newest first.")} flush>
        {!paymentList.length ? <AdminEmpty>{t("No payment requests yet.")}</AdminEmpty> : <div className="admin-list">
          <div className="admin-list-head" aria-hidden="true">
            <span>{t("Date")}</span><span>{t("Payment")}</span><span>{t("Customer")}</span><span>{t("Method")}</span><span className="admin-num">{t("Amount")}</span><span>{t("Status")}</span><span />
          </div>
          {paymentList.map((payment) => {
            const property = getProperty(payment);
            const refund = Array.isArray(payment.refunds) ? payment.refunds[0] : payment.refunds;
            const propertyTitle = translations.get(property?.slug || "")?.title || property?.title;
            const method = t(methodLabels[payment.method || "bank_transfer"] || payment.method || "-");
            return (
              <details key={payment.id} className="admin-list-row">
                <summary>
                  <span className="admin-list-date">{formatDate(payment.created_at, locale)}</span>
                  <span className="admin-list-primary"><span className="admin-cell-main">{payment.title}</span><span className="admin-cell-sub">{propertyTitle || t("No property")}</span></span>
                  <span className="admin-list-secondary"><span className="admin-cell-main">{payment.customer_name || t("Customer")}</span><span className="admin-cell-sub">{payment.customer_email}</span></span>
                  <span className="admin-list-meta">{method}{payment.method === "crypto" && <span className="admin-cell-sub">{payment.crypto_asset || "-"} · {payment.crypto_network || "-"}</span>}</span>
                  <span className="admin-list-amount admin-num">{formatMoney(payment.amount, payment.currency, locale)}</span>
                  <span className="admin-list-status"><StatusBadge status={payment.status} label={t(statusLabels[payment.status || "draft"] || payment.status || "Unknown")} /></span>
                  <ChevronDown size={16} aria-hidden="true" className="admin-disclosure-icon" />
                </summary>
                <div className="admin-list-detail">
                  <dl className="admin-facts">
                    <div><dt>{t("Property")}</dt><dd>{propertyTitle || t("No property")}</dd></div>
                    <div><dt>{t("Verified")}</dt><dd>{formatDate(payment.verified_at, locale)}</dd></div>
                    {payment.proof_url && <div><dt>{t("Proof URL")}</dt><dd><a href={payment.proof_url} target="_blank" rel="noopener noreferrer" className="admin-link break-all">{payment.proof_url}</a></dd></div>}
                    {payment.instructions && <div className="admin-facts-wide"><dt>{t("Instructions")}</dt><dd className="whitespace-pre-line">{payment.instructions}</dd></div>}
                  </dl>
                  {refund && <div className="admin-note"><p className="font-semibold">{t("Refunded")} · {formatDate(refund.created_at, locale)}</p><p className="mt-1 break-all">{refundText(locale)("reference")}: {refund.external_reference}</p><p className="mt-1 whitespace-pre-line break-words">{refund.note}</p></div>}
                  {payment.status !== "refunded" && <form action={updatePaymentRequest} className="admin-form-grid admin-form-grid-4">
                    <input type="hidden" name="payment_id" value={payment.id} />
                    <label className="admin-field">{t("Status")}
                      <select name="status" disabled={Boolean(payment.credit_transaction_id)} defaultValue={payment.status || "draft"}>
                        {Object.entries(statusLabels).filter(([value]) => value !== "refunded").map(([value, label]) => (
                          <option key={value} value={value}>{t(label)}</option>
                        ))}
                      </select>
                    </label>
                    {payment.credit_transaction_id && <input type="hidden" name="status" value={payment.status || "verified"} />}
                    <label className="admin-field">{t("Payment link")}<input name="payment_link" defaultValue={payment.payment_link || ""} /></label>
                    <label className="admin-field">{t("Proof URL")}<input name="proof_url" defaultValue={payment.proof_url || ""} /></label>
                    <label className="admin-field">{t("Admin note")}<input name="admin_note" defaultValue={payment.admin_note || ""} /></label>
                    <div className="admin-field-wide"><button type="submit" className="admin-btn">{t("Save payment status")}</button></div>
                  </form>}
                  {["paid","verified"].includes(payment.status || "") && <RefundForm paymentId={payment.id} amount={Number(payment.amount)} wallet={Boolean(payment.credit_transaction_id)} locale={locale}/>}
                </div>
              </details>
            );
          })}
        </div>}
      </AdminCard>

      <AdminDisclosure id="create-payment" title={t("Create payment request")} description={t("Choose the asset and network, then provide verified payment instructions.")} open={createOpen}>
        <nav className="admin-segmented" aria-label={t("Method")}>
          <Link href="/admin/payments/requests?method=bank_transfer#create-payment" aria-current={selectedMethod === "bank_transfer" ? "page" : undefined}>{t("Bank transfer")} <span>{t("SEPA/Wire")}</span></Link>
          <Link href="/admin/payments/requests?method=crypto#create-payment" aria-current={selectedMethod === "crypto" ? "page" : undefined}>{t("Cryptocurrency")} <span>BTC / ETH / USDT / USDC</span></Link>
        </nav>
        <form key={selectedMethod} action={createPaymentRequest} className="admin-form-grid mt-5">
          <label className="admin-field">{t("Customer")}
            <select name="user_id" defaultValue="">
              <option value="">{t("No registered user / manual email")}</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name === "Customer" ? t("Customer") : customer.name} - {customer.email}
                </option>
              ))}
            </select>
          </label>
          <Field label={t("Customer email")} name="customer_email" type="email" required />
          <Field label={t("Customer name")} name="customer_name" />
          <label className="admin-field">{t("Property")}
            <select name="property_id" defaultValue="">
              <option value="">{t("No property selected")}</option>
              {(properties as PropertyOption[] | null | undefined || []).map((property) => (
                <option key={property.id} value={property.id}>
                  {translations.get(property.slug)?.title || property.title} - {property.city} - {formatMoney(getExternalPropertyBySlug(property.slug)?.price || property.price, "EUR", locale)}
                </option>
              ))}
            </select>
          </label>
          <Field label={t("Payment title")} name="title" required placeholder={t("Reservation deposit")} />
          <Field label={t("Amount")} name="amount" type="number" required placeholder="5000" />
          <label className="admin-field">{t("Currency")}
            <select name="currency" defaultValue="EUR">
              <option value="EUR">EUR</option>
            </select>
          </label>
          <Field label={t("Payment link")} name="payment_link" placeholder="https://..." />

          <input type="hidden" name="method" value={selectedMethod} />
          {selectedMethod === "crypto" && <fieldset className="admin-crypto-fields admin-field-wide">
            <legend className="px-2 text-sm font-bold">{t("Crypto payment details")}</legend>
            <Field label={t("Crypto asset")} name="crypto_asset" required placeholder="BTC, ETH, SOL, USDT, USDC..." />
            <Field label={t("Blockchain network")} name="crypto_network" required placeholder="Bitcoin, Ethereum, Solana, TRON..." />
            <p className="admin-help admin-field-wide">{t("Specify the exact asset and network. The payment amount remains in EUR.")}</p>
          </fieldset>}

          <label className="admin-field admin-field-wide">{t("Instructions")}
            <textarea name="instructions" rows={4} placeholder={t("Do not send funds before bank details are verified. Use reference BW-...")} />
          </label>
          <label className="admin-field admin-field-wide">{t("Admin note")}
            <textarea name="admin_note" rows={2} placeholder={t("Internal note, visible only to admin.")} />
          </label>
          <div className="admin-field-wide"><button type="submit" disabled={serviceRoleMissing} className="admin-btn">{t("Create payment request")}</button></div>
        </form>
      </AdminDisclosure>
    </main>
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
    <label className="admin-field">{label}
      <input
        name={name}
        type={type}
        required={required}
        step={type === "number" ? "0.01" : undefined}
        placeholder={placeholder}
      />
    </label>
  );
}
