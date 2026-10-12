import { ArrowUpRight, Landmark, Bitcoin, UsersRound, MessageSquareText, Activity } from "lucide-react";
import { getAdminText } from "@/app/lib/admin-copy";
import { getCurrentLocale } from "@/app/lib/server-locale";
import { localeHtmlLang, type Locale } from "@/app/lib/i18n";
import { getPropertyTranslations } from "@/app/lib/property-localization";
import { getExternalPropertyBySlug } from "@/app/lib/external-properties";
import { getPropertyMapLinks } from "@/app/lib/property-location";
import Link from "next/link";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "../../lib/supabase/server";
import { updateRequestStatus } from "./action";
import {
  buildCustomerId,
  getKnownCustomersFromRequests,
  mergeCustomers,
  type CustomerRecord,
} from "../lib/customer-store";
import { isAdminUser } from "../lib/admin";
import WalletCreditForm from "./payments/WalletCreditForm";
import AdminSignInForm from "./AdminSignInForm";
import { agreementCopy } from "@/app/lib/agreement-copy";

const adminSignInCopies = {
  en: { title: "Admin Panel", intro: "Sign in with an authorized administrator account.", clientSession: "A client session is active for", email: "Admin email", password: "Password", submitting: "Signing in...", submit: "Sign in to Admin Panel", forgot: "Forgot password?", back: "Back to website" },
  de: { title: "Admin-Panel", intro: "Melden Sie sich mit einem autorisierten Administratorkonto an.", clientSession: "Eine Kundensitzung ist aktiv für", email: "Admin-E-Mail", password: "Passwort", submitting: "Anmeldung...", submit: "Im Admin-Panel anmelden", forgot: "Passwort vergessen?", back: "Zur Website" },
  fr: { title: "Panneau Admin", intro: "Connectez-vous avec un compte administrateur autorisé.", clientSession: "Une session client est active pour", email: "E-mail administrateur", password: "Mot de passe", submitting: "Connexion...", submit: "Accéder au panneau admin", forgot: "Mot de passe oublié ?", back: "Retour au site" },
  es: { title: "Panel Admin", intro: "Inicia sesión con una cuenta de administrador autorizada.", clientSession: "Hay una sesión de cliente activa para", email: "Correo de administrador", password: "Contraseña", submitting: "Iniciando sesión...", submit: "Entrar al Panel Admin", forgot: "¿Olvidaste la contraseña?", back: "Volver al sitio" },
  it: { title: "Pannello Admin", intro: "Accedi con un account amministratore autorizzato.", clientSession: "È attiva una sessione cliente per", email: "E-mail amministratore", password: "Password", submitting: "Accesso...", submit: "Accedi al Pannello Admin", forgot: "Password dimenticata?", back: "Torna al sito" },
};

type AdminRequestItem = {
  id: string;
  status: string | null;
  created_at: string | null;
  name: string | null;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  message: string | null;
  properties:
    | {
        title: string | null;
        slug: string | null;
        city: string | null;
        price: number | null;
      }
    | {
        title: string | null;
        slug: string | null;
        city: string | null;
        price: number | null;
      }[]
    | null;
};

function formatPrice(price: number | null, locale: Locale) {
  if (!price) return getAdminText(locale)("On request");

  return new Intl.NumberFormat(localeHtmlLang[locale], {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(price);
}

function formatDate(date: string | null, locale: Locale) {
  if (!date) return "-";

  return new Date(date).toLocaleDateString(localeHtmlLang[locale], {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function getProperty(request: AdminRequestItem) {
  if (Array.isArray(request.properties)) {
    return request.properties[0] || null;
  }

  return request.properties;
}

function getCustomerName(request: AdminRequestItem) {
  return request.name || request.full_name || "Unknown customer";
}

const paymentMethodCards = [
  { title: "Bank transfer", description: "Verified bank details for deposits and property payments.", href: "/admin/payments?method=bank_transfer", value: "SEPA/Wire", icon: Landmark },
  { title: "Cryptocurrency", description: "Choose the asset and network, then provide verified payment instructions.", href: "/admin/payments?method=crypto", value: "BTC / ETH / USDT / USDC", icon: Bitcoin },
];

async function getRegisteredAuthCustomers() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!serviceRoleKey || !supabaseUrl) {
    return {
      customers: [] as CustomerRecord[],
      enabled: false,
    };
  }

  const adminSupabase = createSupabaseClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { data, error } = await adminSupabase.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });

  if (error) {
    console.error("Auth users error:", error.message);
    return {
      customers: [] as CustomerRecord[],
      enabled: true,
    };
  }

  return {
    customers: data.users
      .filter((authUser) => Boolean(authUser.email) && !isAdminUser(authUser))
      .map((authUser) => ({
        id: authUser.id || buildCustomerId(authUser.email || ""),
        fullName:
          String(authUser.user_metadata?.full_name || "").trim() ||
          authUser.email?.split("@")[0] ||
          "Unknown customer",
        email: authUser.email || "",
        phone: authUser.phone || undefined,
        source: "Registration" as const,
        status: authUser.email_confirmed_at
          ? ("Active" as const)
          : ("New" as const),
        createdAt: authUser.created_at || new Date().toISOString(),
      })),
    enabled: true,
  };
}

export default async function AdminPage() {
  const locale = await getCurrentLocale();
  const t = getAdminText(locale);
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!isAdminUser(user)) return <AdminSignInForm currentEmail={user?.email} copy={adminSignInCopies[locale]} />;
  const translations = await getPropertyTranslations(locale);

  const { count: requestsCount } = await supabase
    .from("property_requests")
    .select("*", { count: "exact", head: true });

  const { data: requests, error } = await supabase
    .from("property_requests")
    .select(`
      id,
      status,
      created_at,
      name,
      full_name,
      email,
      phone,
      message,
      properties (
        title,
        slug,
        city,
        price
      )
    `)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Admin requests error:", error);
  }

  const requestCustomers = getKnownCustomersFromRequests(
    requests as AdminRequestItem[] | null
  );
  const authCustomers = await getRegisteredAuthCustomers();
  const customers = mergeCustomers(authCustomers.customers, requestCustomers);

  return (
    <main className="admin-workspace">
      <section className="admin-hero">
        <div className="mx-auto max-w-7xl">
          <p className="text-lg font-bold text-emerald-300">{t("Panel Admin")}</p>

          <h1 className="font-display mt-4 max-w-5xl text-6xl font-bold leading-none">{t("Manage customer requests")}</h1>

          <p className="mt-6 max-w-3xl text-xl leading-relaxed text-white/80">{t("Review customer profiles, property requests, and participation interest from one operational dashboard.")}</p>

          <div className="mt-8">
            <Link
              href="/admin/properties"
              className="inline-flex rounded-xl bg-white px-5 py-3 font-semibold text-[#0b1020]"
            >{t("Add property")}</Link>
            <Link
              href="/admin/payments"
              className="ml-4 inline-flex rounded-xl border border-white/30 px-5 py-3 font-semibold text-white"
            >{t("Manage payments")}</Link>
          </div>
        </div>
      </section>

      <section className="admin-content-section">
        <div className="admin-metrics grid md:grid-cols-3">
          <AdminCard
            icon={MessageSquareText}
            title={t("All requests")}
            description={t("Total number of customer requests.")}
            value={String(requestsCount || 0)}
          />

          <AdminCard
            icon={UsersRound}
            title={t("Registered customers")}
            description={t("Customers from registration, contact, and property requests.")}
            value={String(customers.length)}
          />

          <AdminCard
            icon={Activity}
            title={t("Status")}
            description={t("Backend and Supabase are connected.")}
            value={t("Online")}
          />
        </div>

        <div className="admin-panel admin-payment-hub">
          <p className="text-lg font-bold text-emerald-300">{t("Payments")}</p>
          <h2 className="mt-3 text-4xl font-bold">{t("Company payment methods")}</h2>
          <p className="mt-4 max-w-4xl text-lg leading-relaxed text-white/75">{t("Manage company bank accounts and crypto addresses. Active details are shared with all signed-in clients.")}</p>

          <div className="admin-method-grid">
            {paymentMethodCards.map((method) => (
              <Link
                key={method.href}
                href={method.href}
                className="admin-method-link"
              >
                <span className="admin-method-icon"><method.icon size={22} aria-hidden="true" /></span>
                <ArrowUpRight className="admin-method-arrow" size={22} aria-hidden="true" />
                <p className="text-sm font-bold uppercase tracking-wide text-emerald-700">
                  {t(method.value)}
                </p>
                <h3 className="mt-3 text-2xl font-bold">{t(method.title)}</h3>
                <p className="mt-3 text-sm leading-relaxed text-slate-600">
                  {t(method.description)}
                </p>
              </Link>
            ))}
          </div>
        </div>

        <div id="customers" className="admin-panel">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-4xl font-bold">{t("All customers")}</h2>
              <p className="mt-3 text-lg text-slate-600">{t("Overview of customers captured through registration, contact, or rental participation requests.")}</p>
            </div>

            <div className="rounded-2xl bg-slate-50 px-5 py-3 text-sm font-bold text-slate-600">
              {authCustomers.enabled
                ? t("Supabase Auth connected")
                : t("Auth list requires service role key")}
            </div>
          </div>

          {customers.length === 0 ? (
            <div className="admin-empty">
              <p className="text-lg text-slate-600">{t("No customers yet. Once a customer sends a request, they will appear here.")}</p>
            </div>
          ) : (
            <div className="mt-8 grid gap-5 md:grid-cols-2">
              {customers.map((customer) => (
                <div
                  key={customer.id}
                  className="rounded-2xl border border-slate-100 bg-slate-50 p-6"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-bold uppercase tracking-wide text-slate-500">
                        {formatDate(customer.createdAt, locale)}
                      </p>
                      <h3 className="mt-2 text-3xl font-bold">
                        {customer.fullName === "Unknown customer" ? t("Unknown customer") : customer.fullName}
                      </h3>
                    </div>

                    <span className="rounded-full bg-emerald-100 px-4 py-2 text-sm font-bold text-emerald-700">
                      {t(customer.status)}
                    </span>
                  </div>

                  <div className="mt-5 space-y-2 text-lg text-slate-600">
                    <p>{customer.email}</p>
                    {customer.phone && <p>{customer.phone}</p>}
                    <p>{t("Source:")} {t(customer.source)}</p>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-3">
                    {customer.source === "Registration" && <Link href={`/admin/agreements?customer=${encodeURIComponent(customer.id)}&status=all`} className="rounded-2xl border border-[#0F172A] px-5 py-3 text-sm font-bold text-[#0F172A]">{agreementCopy(locale).queue}</Link>}
                    <a
                      href={`mailto:${customer.email}`}
                      className="rounded-2xl bg-[#0F172A] px-5 py-3 text-sm font-bold text-white"
                    >{t("Send email")}</a>

                    {customer.phone && (
                      <a
                        href={`tel:${customer.phone.replace(/\s+/g, "")}`}
                        className="rounded-2xl border border-[#0F172A] px-5 py-3 text-sm font-bold text-[#0F172A]"
                      >{t("Call")}</a>
                    )}
                  </div>
                  {customer.source === "Registration" && (
                    <WalletCreditForm userId={customer.id} operationId={crypto.randomUUID()} locale={locale} />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div id="requests" className="admin-panel">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-4xl font-bold">{t("All customer requests")}</h2>
              <p className="mt-3 text-lg text-slate-600">{t("Overview of prospects and property projects.")}</p>
            </div>

            <Link
              href="/dashboard"
              className="rounded-2xl border border-[#0F172A] px-6 py-3 text-base font-bold text-[#0F172A]"
            >{t("Back to dashboard")}</Link>
          </div>

          {error && (
            <div className="mt-8 rounded-2xl bg-red-50 p-5 text-red-700">{t("Error loading customer requests.")}</div>
          )}

          {!error && (!requests || requests.length === 0) && (
            <div className="admin-empty">
              <p className="text-lg text-slate-600">{t("There are currently no customer requests.")}</p>
            </div>
          )}

          {!error && requests && requests.length > 0 && (
            <div className="mt-8 space-y-5">
              {(requests as AdminRequestItem[]).map((request) => {
                const property = getProperty(request);
                const listing = property?.slug ? getExternalPropertyBySlug(property.slug) : undefined;
                const map = listing ? getPropertyMapLinks(listing, locale) : null;

                return (
                  <div
                    key={request.id}
                    className="rounded-2xl border border-slate-100 bg-slate-50 p-6"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-bold uppercase tracking-wide text-slate-500">
                          {formatDate(request.created_at, locale)}
                        </p>

                        <h3 className="mt-2 text-3xl font-bold">
                          {getCustomerName(request) === "Unknown customer" ? t("Unknown customer") : getCustomerName(request)}
                        </h3>

                        <p className="mt-2 text-lg text-slate-600">
                          {request.email || t("No email")}{" "}
                          {request.phone ? `- ${request.phone}` : ""}
                        </p>
                      </div>

                      <form
                        action={updateRequestStatus}
                        className="flex items-center gap-3"
                      >
                        <input
                          type="hidden"
                          name="request_id"
                          value={request.id}
                        />

                        <select
                          name="status"
                          defaultValue={request.status || "new"}
                          className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 outline-none"
                        >
                          <option value="new">{t("New")}</option>
                          <option value="contacted">{t("Contacted")}</option>
                          <option value="closed">{t("Closed")}</option>
                        </select>

                        <button
                          type="submit"
                          className="rounded-2xl bg-[#0F172A] px-5 py-3 text-sm font-bold text-white"
                        >{t("Save")}</button>
                      </form>
                    </div>

                    <div className="mt-6 rounded-2xl bg-white p-5">
                      <p className="text-sm font-bold text-slate-500">{t("Property project")}</p>

                      <h4 className="mt-2 text-2xl font-bold">
                        {translations.get(property?.slug || "")?.title || listing?.title || property?.title || t("Property project")}
                      </h4>

                      <p className="mt-2 text-lg text-slate-600">
                        {listing?.address || property?.city || t("Location not provided")} -{" "}
                        {formatPrice(listing?.price || property?.price || null, locale)}
                      </p>
                      {map && <a href={map.mapUrl} target="_blank" rel="noopener noreferrer" className="mt-2 block font-bold text-sky-700">{t("Open map")}</a>}

                      {property?.slug && (
                        <Link
                          href={`/properties/${property.slug}`}
                          className="mt-4 inline-block rounded-2xl bg-[#0F172A] px-6 py-3 text-base font-bold text-white"
                        >{t("Open project")}</Link>
                      )}
                    </div>

                    {request.message && (
                      <div className="mt-5 rounded-2xl bg-white p-5">
                        <p className="text-sm font-bold text-slate-500">{t("Message")}</p>

                        <p className="mt-2 text-lg leading-relaxed text-slate-700">
                          {request.message}
                        </p>
                      </div>
                    )}
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

function AdminCard({
  icon: Icon,
  title,
  description,
  value,
}: {
  icon: typeof Activity;
  title: string;
  description: string;
  value: string;
}) {
  return (
    <div className="admin-metric">
      <div className="text-5xl font-bold">{value}</div><Icon className="absolute right-6 top-6 text-sky-600" size={24} />
      <h2 className="mt-6 text-3xl font-bold">{title}</h2>
      <p className="mt-3 text-lg leading-relaxed text-slate-600">
        {description}
      </p>
    </div>
  );
}
