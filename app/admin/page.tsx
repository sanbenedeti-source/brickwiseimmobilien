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
import { hasAdminSession } from "../lib/admin-session";
import { redirect } from "next/navigation";
import WalletCreditForm from "./payments/WalletCreditForm";
import AdminSignInForm from "./AdminSignInForm";
import { agreementCopy } from "@/app/lib/agreement-copy";
import { AdminCard, AdminEmpty, AdminPageHeader, AdminStat, StatusBadge } from "./ui";
import { getAdminAttention } from "./attention";

const adminSignInCopies = {
  en: { title: "Admin Panel", intro: "Sign in with an authorized administrator account.", clientSession: "A client session is active for", email: "Admin email", password: "Password", submitting: "Signing in...", submit: "Sign in to Admin Panel", forgot: "Forgot password?", back: "Back to website" },
  de: { title: "Admin-Panel", intro: "Melden Sie sich mit einem autorisierten Administratorkonto an.", clientSession: "Eine Kundensitzung ist aktiv für", email: "Admin-E-Mail", password: "Passwort", submitting: "Anmeldung...", submit: "Im Admin-Panel anmelden", forgot: "Passwort vergessen?", back: "Zur Website" },
  fr: { title: "Panneau Admin", intro: "Connectez-vous avec un compte administrateur autorisé.", clientSession: "Une session client est active pour", email: "E-mail administrateur", password: "Mot de passe", submitting: "Connexion...", submit: "Accéder au panneau admin", forgot: "Mot de passe oublié ?", back: "Retour au site" },
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
  if (!(await hasAdminSession(supabase, user))) redirect("/admin/security");
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
  const attention = await getAdminAttention(supabase);
  const requestStatusLabel = (status: string | null) => t(status === "contacted" ? "Contacted" : status === "closed" ? "Closed" : "New");

  return (
    <main className="admin-workspace">
      <AdminPageHeader
        eyebrow={t("Administration")}
        title={t("Overview")}
        description={t("Work waiting for you and the latest client activity.")}
        actions={<>
          <Link href="/admin/payments" className="admin-btn admin-btn-secondary">{t("Payment methods")}</Link>
          <Link href="/admin/properties" className="admin-btn">{t("Add property")}</Link>
        </>}
      />

      <section className="admin-stats" aria-label={t("Key figures")}>
        <AdminStat label={t("New requests")} value={attention.newRequests} hint={`${t("All requests")}: ${requestsCount || 0}`} href="#requests" linkLabel={t("View list")} attention={attention.newRequests > 0} />
        <AdminStat label={t("Deposits to verify")} value={attention.pendingDeposits} href="/admin/payments/deposits" linkLabel={t("Open queue")} attention={attention.pendingDeposits > 0} />
        <AdminStat label={t("Agreements to review")} value={attention.pendingAgreements} href="/admin/agreements" linkLabel={t("Open queue")} attention={attention.pendingAgreements > 0} />
        <AdminStat label={t("Registered customers")} value={customers.length} hint={authCustomers.enabled ? undefined : t("Auth list requires service role key")} href="#customers" linkLabel={t("View list")} />
      </section>

      <AdminCard id="requests" title={t("Client requests")} description={t("Purchase requests and enquiries, newest first.")} flush>
        {error ? <p role="alert" className="admin-empty-state">{t("Error loading customer requests.")}</p>
          : !requests?.length ? <AdminEmpty>{t("There are currently no customer requests.")}</AdminEmpty>
          : <table className="admin-table admin-table-stack">
            <thead><tr><th scope="col">{t("Date")}</th><th scope="col">{t("Client")}</th><th scope="col">{t("Property")}</th><th scope="col">{t("Message")}</th><th scope="col">{t("Status")}</th></tr></thead>
            <tbody>{(requests as AdminRequestItem[]).map((request) => {
              const property = getProperty(request);
              const listing = property?.slug ? getExternalPropertyBySlug(property.slug) : undefined;
              const map = listing ? getPropertyMapLinks(listing, locale) : null;
              const name = getCustomerName(request);
              const title = translations.get(property?.slug || "")?.title || listing?.title || property?.title;
              return <tr key={request.id}>
                <td data-label={t("Date")} className="whitespace-nowrap">{formatDate(request.created_at, locale)}</td>
                <td data-label={t("Client")}>
                  <p className="admin-cell-main">{name === "Unknown customer" ? t("Unknown customer") : name}</p>
                  <p className="admin-cell-sub">{request.email ? <a href={`mailto:${request.email}`} className="admin-link">{request.email}</a> : t("No email")}</p>
                  {request.phone && <p className="admin-cell-sub"><a href={`tel:${request.phone.replace(/\s+/g, "")}`}>{request.phone}</a></p>}
                </td>
                <td data-label={t("Property")}>{title ? <>
                  {property?.slug ? <Link href={`/properties/${property.slug}`} target="_blank" rel="noopener noreferrer" className="admin-cell-main hover:underline">{title}</Link> : <p className="admin-cell-main">{title}</p>}
                  <p className="admin-cell-sub">{listing?.city || property?.city || t("Location not provided")} · {formatPrice(listing?.price || property?.price || null, locale)}{map && <> · <a href={map.mapUrl} target="_blank" rel="noopener noreferrer" className="admin-link">{t("Open map")}</a></>}</p>
                </> : <span className="admin-cell-sub">—</span>}</td>
                <td data-label={t("Message")}>{request.message ? <details><summary className="admin-message">{request.message.split("\n")[0]}</summary><p className="admin-message-full">{request.message}</p></details> : <span className="admin-cell-sub">—</span>}</td>
                <td data-label={t("Status")}>
                  <div className="flex flex-col items-start gap-2">
                    <StatusBadge status={request.status} label={requestStatusLabel(request.status)} />
                    <form action={updateRequestStatus} className="admin-inline-form">
                      <input type="hidden" name="request_id" value={request.id} />
                      <select name="status" defaultValue={request.status || "new"} aria-label={t("Status")}>
                        <option value="new">{t("New")}</option>
                        <option value="contacted">{t("Contacted")}</option>
                        <option value="closed">{t("Closed")}</option>
                      </select>
                      <button type="submit" className="admin-btn admin-btn-secondary admin-btn-sm">{t("Save")}</button>
                    </form>
                  </div>
                </td>
              </tr>;
            })}</tbody>
          </table>}
      </AdminCard>

      <AdminCard id="customers" title={t("Customers")} description={t("Overview of customers captured through registration, contact, or rental participation requests.")} flush>
        {customers.length === 0 ? <AdminEmpty>{t("No customers yet. Once a customer sends a request, they will appear here.")}</AdminEmpty>
          : <table className="admin-table admin-table-stack">
            <thead><tr><th scope="col">{t("Customer")}</th><th scope="col">{t("Source")}</th><th scope="col">{t("Status")}</th><th scope="col">{t("Registered")}</th><th scope="col">{t("Actions")}</th></tr></thead>
            <tbody>{customers.map((customer) => <tr key={customer.id}>
              <td data-label={t("Customer")}>
                <p className="admin-cell-main">{customer.fullName === "Unknown customer" ? t("Unknown customer") : customer.fullName}</p>
                <p className="admin-cell-sub">{customer.email}{customer.phone ? ` · ${customer.phone}` : ""}</p>
              </td>
              <td data-label={t("Source")}>{t(customer.source)}</td>
              <td data-label={t("Status")}><StatusBadge status={customer.status} label={t(customer.status)} /></td>
              <td data-label={t("Registered")} className="whitespace-nowrap">{formatDate(customer.createdAt, locale)}</td>
              <td data-label={t("Actions")}>
                <div className="admin-actions">
                  <a href={`mailto:${customer.email}`} className="admin-btn admin-btn-secondary admin-btn-sm">{t("Send email")}</a>
                  {customer.phone && <a href={`tel:${customer.phone.replace(/\s+/g, "")}`} className="admin-btn admin-btn-secondary admin-btn-sm">{t("Call")}</a>}
                  {customer.source === "Registration" && <Link href={`/admin/customers/${encodeURIComponent(customer.id)}`} className="admin-btn admin-btn-sm">{t("View profile")}</Link>}
                  {customer.source === "Registration" && <Link href={`/admin/agreements?customer=${encodeURIComponent(customer.id)}&status=all`} className="admin-btn admin-btn-secondary admin-btn-sm">{agreementCopy(locale).queue}</Link>}
                </div>
                {customer.source === "Registration" && <details className="admin-popover mt-2">
                  <summary className="admin-link text-[12.5px]">{t("Credit wallet")}</summary>
                  <div><WalletCreditForm userId={customer.id} operationId={crypto.randomUUID()} locale={locale} /></div>
                </details>}
              </td>
            </tr>)}</tbody>
          </table>}
      </AdminCard>
    </main>
  );
}
