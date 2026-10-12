import CompanyPaymentDirectory from "../funding/CompanyPaymentDirectory";
import { getCompanyPaymentMethods } from "../lib/company-payment-store";
import { getAdminText } from "../lib/admin-copy";
import { localizedPayment, localizedStatus } from "../properties/property-ui-copy";
import { getPropertyTranslations, localizeProperty } from "../lib/property-localization";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/auth";
import ClientPortalSidebar from "@/app/components/ClientPortalSidebar";
import { externalProperties, isPropertyOpenForInvestment } from "@/app/lib/external-properties";
import { localeHtmlLang, type Locale } from "@/app/lib/i18n";
import { getCurrentLocale } from "@/app/lib/server-locale";
import PropertyInvestmentCard, { DashboardCardCopy } from "./PropertyInvestmentCard";
import IncomeExperience, { IncomePosition } from "./IncomeExperience";
import DailyIncome from "./DailyIncome";
import WalletOverview from "./WalletOverview";
import { dailyIncomeCopy } from "./daily-income-copy";
import type { IncomePurchase } from "./daily-income-model";
import { profitCopy } from "./profit-copy";
import { getPropertyProjection, getPropertyShareSupply, getPropertyReturnBreakdown } from "../lib/property-financials";
import { formatRecordedMoney } from "./recorded-money";

// Capture one server timestamp alongside the request's data for stable hydration.
async function getIncomeSnapshotTime() { return Date.now(); }

type RequestItem = {
  id: string;
  status: string | null;
  created_at: string | null;
  message: string | null;
};

type PaymentRequestItem = {
  id: string;
  title: string | null;
  amount: number | null;
  currency: string | null;
  method: string | null;
  crypto_asset: string | null;
  crypto_network: string | null;
  status: string | null;
  payment_link: string | null;
  instructions: string | null;
  created_at: string | null;
};

type DashboardCopy = {
  panel: string;
  properties: string;
  income: string;
  requests: string;
  account: string;
  agent: string;
  signOut: string;
  welcome: string;
  intro: string;
  daily: string;
  weekly: string;
  monthly: string;
  requestedCapital: string;
  projected: string;
  propertiesTitle: string;
  propertiesText: string;
  requestsTitle: string;
  requestsText: string;
  noRequests: string;
  interestsTitle: string;
  interestsText: string;
  noInterests: string;
  interest: string;
  message: string;
  paymentTitle: string;
  noPayments: string;
  pendingAgent: string;
  sent: string;
  requestError: string;
  invalidRequest: string;
  memberSince: string;
  activeAccount: string;
  walletBalance: string;
  ownedShares: string;
  purchaseSuccess: string;
  insufficientFunds: string;
  card: DashboardCardCopy;
};

const en: DashboardCopy = {
  panel: "Client panel",
  properties: "Properties",
  income: "Income",
  requests: "My requests",
  account: "Account",
  agent: "Contact agent",
  signOut: "Sign out",
  welcome: "Property shares in one simple panel",
  intro: "Choose a property, model the number of shares and send a bank transfer or crypto request to the Brickwise agent.",
  daily: "Projected daily",
  weekly: "Projected weekly",
  monthly: "Projected monthly",
  requestedCapital: "Requested capital",
  projected: "Based on active purchase requests",
  propertiesTitle: "Available properties",
  propertiesText: "Annual targets include rental income, vacation points and appreciation. Monthly values equal the annual target divided by 12. The agent confirms availability and payment instructions before any transfer.",
  requestsTitle: "Purchase requests",
  requestsText: "Your selected shares and preferred payment method appear here while the agent reviews the request.",
  noRequests: "You have not sent a share purchase request yet.",
  interestsTitle: "Property interests",
  interestsText: "Properties you asked about appear here together with the current follow-up status.",
  noInterests: "You have not asked about a property yet.",
  interest: "Property inquiry",
  message: "Message",
  paymentTitle: "Payment instructions",
  noPayments: "No verified bank or crypto payment instructions have been issued yet.",
  pendingAgent: "Agent review",
  sent: "Your purchase request was sent. An agent will contact you with the next steps.",
  requestError: "The request could not be saved. Please contact the agent directly.",
  invalidRequest: "Choose a valid number of available shares and a payment method.",
  memberSince: "Member since",
  activeAccount: "Active client account",
  walletBalance: "Wallet balance",
  ownedShares: "Owned shares",
  purchaseSuccess: "Shares purchased successfully from your wallet balance.",
  insufficientFunds: "Your wallet balance is not sufficient for this purchase.",
  card: {
    available: "Available shares",
    targetReturn: "Target total return",
    perShare: "Price / share",
    shares: "Number of shares",
    daily: "Daily",
    weekly: "Weekly",
    monthly: "Monthly",
    annual: "Annual",
    amount: "Amount",
    payment: "Preferred payment method",
    bank: "Bank transfer",
    crypto: "Crypto",
    agentNote: "Bank and crypto requests go to an agent. Wallet purchases debit your EUR balance immediately.",
    request: "Request purchase",
    details: "Contact agent",
    buyWithWallet: "Buy with wallet",
    availableWallet: "Available wallet",
    maximumWithWallet: "Maximum shares with wallet",
  },
};

const de: DashboardCopy = {
  ...en,
  panel: "Kundenbereich",
  properties: "Immobilien",
  income: "Erträge",
  requests: "Meine Anfragen",
  account: "Konto",
  agent: "Agent kontaktieren",
  signOut: "Abmelden",
  welcome: "Immobilienanteile in einem einfachen Panel",
  intro: "Wählen Sie eine Immobilie, modellieren Sie die Anteile und senden Sie eine Bank- oder Crypto-Anfrage an den Brickwise Agenten.",
  daily: "Täglich prognostiziert",
  weekly: "Wöchentlich prognostiziert",
  monthly: "Monatlich prognostiziert",
  requestedCapital: "Angefragtes Kapital",
  projected: "Basierend auf aktiven Kaufanfragen",
  propertiesTitle: "Verfügbare Immobilien",
  propertiesText: "Die Jahresziele umfassen Mieteinnahmen, Urlaubspunkte und Wertsteigerung. Monatswerte entsprechen dem Jahresziel geteilt durch 12. Der Agent bestätigt Verfügbarkeit und Zahlungsanweisungen vor jeder Überweisung.",
  requestsTitle: "Kaufanfragen",
  requestsText: "Ihre Anteile und bevorzugte Zahlungsart erscheinen hier, während der Agent die Anfrage prüft.",
  noRequests: "Sie haben noch keine Anteilskaufanfrage gesendet.",
  interestsTitle: "Immobilieninteressen",
  interestsText: "Immobilien, zu denen Sie Informationen angefragt haben, erscheinen hier mit dem aktuellen Status.",
  noInterests: "Sie haben noch keine Immobilie angefragt.",
  interest: "Immobilienanfrage",
  message: "Nachricht",
  paymentTitle: "Zahlungsanweisungen",
  noPayments: "Es wurden noch keine verifizierten Bank- oder Crypto-Anweisungen erstellt.",
  pendingAgent: "Prüfung durch das Team",
  sent: "Ihre Kaufanfrage wurde gesendet. Ein Agent kontaktiert Sie mit den nächsten Schritten.",
  requestError: "Die Anfrage konnte nicht gespeichert werden. Kontaktieren Sie den Agenten direkt.",
  invalidRequest: "Wählen Sie eine gültige Anzahl verfügbarer Anteile und eine Zahlungsart.",
  memberSince: "Mitglied seit",
  activeAccount: "Aktives Kundenkonto",
  walletBalance: "Wallet-Guthaben",
  ownedShares: "Eigene Anteile",
  purchaseSuccess: "Die Anteile wurden erfolgreich mit Ihrem Wallet-Guthaben gekauft.",
  insufficientFunds: "Ihr Wallet-Guthaben reicht für diesen Kauf nicht aus.",
  card: {
    ...en.card,
    available: "Verfügbare Anteile",
    targetReturn: "Angestrebte Gesamtrendite",
    perShare: "Preis / Anteil",
    shares: "Anzahl der Anteile",
    daily: "Täglich",
    weekly: "Wöchentlich",
    monthly: "Monatlich",
    annual: "Jährlich",
    amount: "Betrag",
    crypto: "Krypto",
    payment: "Bevorzugte Zahlungsart",
    bank: "Banküberweisung",
    agentNote: "Bank- und Kryptoanfragen gehen an einen Berater. Wallet-Käufe belasten sofort Ihr EUR-Guthaben.",
    request: "Kauf anfragen",
    details: "Agent kontaktieren",
    buyWithWallet: "Mit Wallet kaufen",
    availableWallet: "Verfügbares Wallet-Guthaben",
    maximumWithWallet: "Maximale Anteile mit Wallet",
  },
};


const fr: DashboardCopy = { ...en, panel: "Espace client", properties: "Biens", income: "Revenus", requests: "Mes demandes", account: "Compte", agent: "Contacter un conseiller", signOut: "Déconnexion", welcome: "Vos parts immobilières dans un espace simple", intro: "Choisissez un bien, simulez le nombre de parts et envoyez une demande bancaire ou crypto au conseiller Brickwise.", daily: "Projection quotidienne", weekly: "Projection hebdomadaire", monthly: "Projection mensuelle", requestedCapital: "Capital demandé", projected: "Selon les demandes d'achat actives", propertiesTitle: "Biens disponibles", propertiesText: "Les objectifs annuels comprennent le loyer, les points vacances et la plus-value. Les montants mensuels correspondent aux objectifs annuels divisés par 12. Le conseiller confirme la disponibilité et les instructions avant tout transfert.", requestsTitle: "Demandes d'achat", requestsText: "Vos parts et le mode de paiement choisi apparaissent ici pendant la vérification.", noRequests: "Vous n'avez encore envoyé aucune demande d'achat.", interestsTitle: "Biens suivis", interestsText: "Les biens sur lesquels vous avez demandé des informations apparaissent ici avec leur statut.", noInterests: "Vous n'avez encore demande aucune information.", interest: "Demande immobilière", message: "Message", paymentTitle: "Instructions de paiement", noPayments: "Aucune instruction bancaire ou crypto vérifiée n'a encore été émise.", pendingAgent: "Vérification du conseiller", sent: "Votre demande a été envoyée. Un conseiller vous contactera.", requestError: "La demande n'a pas pu être enregistrée.", invalidRequest: "Choisissez un nombre valide de parts et un mode de paiement.", memberSince: "Membre depuis", activeAccount: "Compte client actif", card: { ...en.card, available: "Parts disponibles", targetReturn: "Rendement total cible", perShare: "Prix / part", shares: "Nombre de parts", daily: "Jour", weekly: "Semaine", monthly: "Mois", annual: "Année", amount: "Montant", payment: "Mode de paiement préféré", bank: "Virement bancaire", agentNote: "Les demandes bancaires et crypto passent au conseiller. Les achats par portefeuille débitent immédiatement votre solde en EUR.", request: "Demander l'achat", details: "Contacter un conseiller" } };
const es: DashboardCopy = { ...en, panel: "Panel del cliente", properties: "Propiedades", income: "Ingresos", requests: "Mis solicitudes", account: "Cuenta", agent: "Contactar asesor", signOut: "Cerrar sesión", welcome: "Participaciones inmobiliarias en un panel sencillo", intro: "Elige una propiedad, simula las participaciones y envía una solicitud bancaria o cripto al asesor.", daily: "Proyección diaria", weekly: "Proyección semanal", monthly: "Proyección mensual", requestedCapital: "Capital solicitado", projected: "Según solicitudes activas", propertiesTitle: "Propiedades disponibles", propertiesText: "Los objetivos anuales incluyen alquiler, puntos de vacaciones y revalorización. Los importes mensuales equivalen al objetivo anual dividido entre 12. El asesor confirma disponibilidad e instrucciones antes de cualquier transferencia.", requestsTitle: "Solicitudes de compra", requestsText: "Tus participaciones y método de pago aparecen aquí durante la revisión.", noRequests: "Aún no has enviado una solicitud de compra.", interestsTitle: "Propiedades de interés", interestsText: "Las propiedades consultadas aparecen aquí con su estado.", noInterests: "Aún no has consultado ninguna propiedad.", interest: "Consulta inmobiliaria", message: "Mensaje", paymentTitle: "Instrucciones de pago", noPayments: "Aún no hay instrucciones bancarias o cripto verificadas.", pendingAgent: "Revisión del asesor", sent: "Tu solicitud se ha enviado. Un asesor te contactará.", requestError: "No se pudo guardar la solicitud.", invalidRequest: "Elige un número válido de participaciones y un método de pago.", memberSince: "Miembro desde", activeAccount: "Cuenta activa", card: { ...en.card, available: "Participaciones disponibles", targetReturn: "Rentabilidad total objetivo", perShare: "Precio / participación", shares: "Número de participaciones", daily: "Diario", weekly: "Semanal", monthly: "Mensual", annual: "Anual", amount: "Importe", payment: "Método de pago preferido", bank: "Transferencia bancaria", crypto: "Cripto", agentNote: "Las solicitudes bancarias y cripto pasan al asesor. Las compras con cartera descuentan el saldo en EUR inmediatamente.", request: "Solicitar compra", details: "Contactar asesor" } };
const it: DashboardCopy = { ...en, panel: "Area cliente", properties: "Immobili", income: "Reddito", requests: "Le mie richieste", account: "Account", agent: "Contatta un consulente", signOut: "Esci", welcome: "Quote immobiliari in una dashboard semplice", intro: "Scegli un immobile, simula le quote e invia una richiesta bancaria o crypto al consulente.", daily: "Proiezione giornaliera", weekly: "Proiezione settimanale", monthly: "Proiezione mensile", requestedCapital: "Capitale richiesto", projected: "In base alle richieste attive", propertiesTitle: "Immobili disponibili", propertiesText: "Gli obiettivi annuali comprendono affitto, punti vacanza e rivalutazione. I valori mensili equivalgono agli obiettivi annuali divisi per 12. Il consulente conferma disponibilità e istruzioni prima di ogni trasferimento.", requestsTitle: "Richieste di acquisto", requestsText: "Le quote e il metodo di pagamento appaiono qui durante la verifica.", noRequests: "Non hai ancora inviato richieste di acquisto.", interestsTitle: "Immobili di interesse", interestsText: "Gli immobili su cui hai chiesto informazioni appaiono qui con lo stato.", noInterests: "Non hai ancora richiesto informazioni.", interest: "Richiesta immobiliare", message: "Messaggio", paymentTitle: "Istruzioni di pagamento", noPayments: "Non sono ancora disponibili istruzioni bancarie o crypto verificate.", pendingAgent: "Verifica del consulente", sent: "La richiesta è stata inviata. Un consulente ti contatterà.", requestError: "Non è stato possibile salvare la richiesta.", invalidRequest: "Scegli un numero valido di quote e un metodo di pagamento.", memberSince: "Membro dal", activeAccount: "Account cliente attivo", card: { ...en.card, available: "Quote disponibili", targetReturn: "Rendimento totale obiettivo", perShare: "Prezzo / quota", shares: "Numero di quote", daily: "Giornaliero", weekly: "Settimanale", monthly: "Mensile", annual: "Annuale", amount: "Importo", payment: "Metodo di pagamento preferito", bank: "Bonifico bancario", crypto: "Cripto", agentNote: "Le richieste bancarie e crypto passano al consulente. Gli acquisti con wallet addebitano subito il saldo in EUR.", request: "Richiedi acquisto", details: "Contatta consulente" } };
Object.assign(fr, { walletBalance: "Solde du portefeuille", ownedShares: "Parts détenues", purchaseSuccess: "Parts achetées avec succès avec le solde de votre portefeuille.", insufficientFunds: "Le solde de votre portefeuille est insuffisant pour cet achat." });
Object.assign(fr.card, { buyWithWallet: "Acheter avec le portefeuille", availableWallet: "Solde disponible", maximumWithWallet: "Parts maximales avec le portefeuille" });
Object.assign(es, { walletBalance: "Saldo de la cartera", ownedShares: "Participaciones propias", purchaseSuccess: "Participaciones compradas correctamente con el saldo de tu cartera.", insufficientFunds: "El saldo de tu cartera no es suficiente para esta compra." });
Object.assign(es.card, { buyWithWallet: "Comprar con la cartera", availableWallet: "Saldo disponible", maximumWithWallet: "Participaciones máximas con la cartera" });
Object.assign(it, { walletBalance: "Saldo wallet", ownedShares: "Quote possedute", purchaseSuccess: "Quote acquistate con successo con il saldo del wallet.", insufficientFunds: "Il saldo del wallet non è sufficiente per questo acquisto." });
Object.assign(it.card, { buyWithWallet: "Acquista con il wallet", availableWallet: "Saldo disponibile", maximumWithWallet: "Quote massime con il wallet" });

const copies: Record<Locale, DashboardCopy> = { en, de, fr, es, it };

function formatDate(value: string | null, locale: Locale) {
  if (!value) return "-";
  return new Intl.DateTimeFormat(localeHtmlLang[locale], { dateStyle: "medium" }).format(new Date(value));
}

function messageValue(message: string | null, label: string) {
  if (!message) return null;
  return message.match(new RegExp(`^${label}:\\s*(.+)$`, "mi"))?.[1]?.trim() || null;
}


export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ request?: string; section?: string }>;
}) {
  const locale = await getCurrentLocale();
  const translations = await getPropertyTranslations(locale);
  const copy = copies[locale];
  const params = await searchParams;
  const section = ["marketplace", "assets", "account", "income", "wallet", "orders"].includes(params.section || "") ? params.section : "income";
  const supabase = await createClient();
  const user = await getCurrentUser();

  if (!user?.email) redirect("/sign-in");

  const [{ data: requestData }, { data: paymentData }, { data: walletAccount, error: walletError }, { data: holdingsData, error: holdingsError }] = await Promise.all([
    supabase
      .from("property_requests")
      .select("id,status,created_at,message")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("payment_requests")
      .select("id,title,amount,currency,method,crypto_asset,crypto_network,status,payment_link,instructions,created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    supabase.from("wallet_accounts").select("balance,currency").eq("user_id", user.id).maybeSingle(),
    supabase.from("property_holdings").select("property_slug,shares,invested_amount,currency,first_purchased_at").eq("user_id", user.id),
  ]);

  const incomePurchases: IncomePurchase[] = [];
  let incomeHistoryAvailable = !holdingsError;
  if ((section === "income" || section === "wallet") && incomeHistoryAvailable) {
    // Read every purchase: additional shares begin earning only on their own date.
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await supabase.from("wallet_transactions")
        .select("property_slug,shares,amount,currency,created_at")
        .eq("user_id", user.id).eq("type", "purchase").eq("direction", "debit")
        .order("created_at").order("id").range(offset, offset + 499);
      if (error) { incomeHistoryAvailable = false; break; }
      incomePurchases.push(...(data || []).map(p => ({
        property_slug: p.property_slug, shares: Number(p.shares), amount: Number(p.amount),
        currency: p.currency, created_at: p.created_at,
      })));
      if (!data || data.length < 500) break;
    }
  }

  const requests = (requestData || []) as RequestItem[];
  const payments = (paymentData || []) as PaymentRequestItem[];
  const { data: shareSettings } = await supabase.from("property_share_settings").select("property_slug,total_shares,blocked_shares");
  const sharesBySlug = new Map((shareSettings || []).map((item) => [item.property_slug, { total: Number(item.total_shares), blocked: Number(item.blocked_shares) }]));
  const purchaseRequests = requests.filter((request) => request.message?.includes("Share purchase request"));
  const propertyInterests = requests.filter((request) => !request.message?.includes("Share purchase request"));
  const walletBalance = Math.max(0, Number(walletAccount?.balance || 0));
  const walletCurrency = walletAccount?.currency || "EUR";
  const incomePositions: IncomePosition[] = (holdingsData || []).flatMap((holding) => {
    const property = externalProperties.find((item) => item.slug === holding.property_slug);
    if (!property) return [];
    const profitSetting = sharesBySlug.get(property.slug);
    const { total: totalShares, available: availableShares } = getPropertyShareSupply(property, {
      total_shares: profitSetting?.total, blocked_shares: profitSetting?.blocked,
    });
    const projection = getPropertyProjection(property, Number(holding.shares || 0));
    return [{
      slug: property.slug,
      title: localizeProperty(property, translations).title,
      city: property.city,
      imageUrl: property.image_url,
      shares: Number(holding.shares || 0),
      recordedInvestment: { amount: Number(holding.invested_amount || 0), currency: holding.currency || "EUR" },
      sharePrice: property.sharePrice,
      annualRate: projection.annualRate,
      totalShares,
      monthlyRent: property.monthlyRent,
      monthlyExpenses: property.monthlyExpenses,
      availableShares,
    }];
  });

  const dailyPositions = incomePositions.map(position => ({
    slug: position.slug, title: position.title, shares: position.shares,
    rentalRate: getPropertyReturnBreakdown(externalProperties.find(p => p.slug === position.slug)!)?.rental ?? 0,
  }));
  const overviewHistoryAvailable = incomeHistoryAvailable && incomePositions.length === (holdingsData || []).length;
  const baseWalletBalance = walletError || (walletAccount && walletAccount.currency !== "EUR")
    ? null : walletAccount ? Number(walletAccount.balance) : 0;

  const fullName = String(user.user_metadata?.full_name || user.email.split("@")[0]);
  const initials = fullName.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
  const notice = params.request === "sent"
    ? { tone: "success", text: copy.sent }
    : params.request === "error"
      ? { tone: "error", text: copy.requestError }
      : params.request === "purchased"
        ? { tone: "success", text: copy.purchaseSuccess }
      : params.request === "insufficient"
        ? { tone: "error", text: copy.insufficientFunds }
      : params.request === "invalid"
        ? { tone: "error", text: copy.invalidRequest }
        : null;
  const paymentDirectory = section === "wallet" ? await getCompanyPaymentMethods() : { methods: [], error: false };
  const paymentText = getAdminText(locale);
  const incomeAsOf = await getIncomeSnapshotTime();
  const sectionTitle = section === "assets" ? copy.ownedShares : section === "account" ? copy.account : section === "income" ? copy.income : section === "wallet" ? copy.walletBalance : section === "orders" ? copy.requestsTitle : copy.propertiesTitle;
  const sectionDescription = section === "marketplace" ? copy.propertiesText : section === "orders" ? copy.requestsText : section === "wallet" ? copy.paymentTitle : section === "income" ? dailyIncomeCopy[locale].intro : section === "assets" ? profitCopy[locale].summary : copy.activeAccount;

  return (
    <main className="investor-shell min-h-screen bg-[#f7f8fa] text-[#17233f]">
      <ClientPortalSidebar active={section as "marketplace" | "assets" | "account" | "income" | "wallet" | "orders"} email={user.email} fullName={fullName} locale={locale} />
      <div className="pt-16 lg:ml-[282px] lg:pt-0">
        <header className="border-b border-[#e1e5ea] bg-white px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto flex max-w-[1440px] flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-bold text-[#2f9bdb]">{copy.panel}</p><h1 className="mt-1 text-3xl font-bold">{sectionTitle}</h1></div><p className="max-w-xl text-sm leading-6 text-[#687486]">{sectionDescription}</p></div>
        </header>

        <div className="mx-auto max-w-[1440px] px-4 py-7 sm:px-6 lg:px-8">
          {notice && <div className={`mb-6 border-l-4 p-4 font-bold ${notice.tone === "success" ? "border-emerald-500 bg-emerald-50 text-emerald-800" : "border-red-500 bg-red-50 text-red-800"}`}>{notice.text}</div>}

          {section === "marketplace" && <section className="scroll-mt-20">
            <div className="grid gap-5 md:grid-cols-2 2xl:grid-cols-3">
              {externalProperties.filter(isPropertyOpenForInvestment).map((property) => <PropertyInvestmentCard locale={locale} key={property.id} property={localizeProperty(property, translations)} copy={copy.card} shareAvailability={sharesBySlug.get(property.slug)} walletBalance={baseWalletBalance} />)}
            </div>
          </section>}

          {section === "assets" && <IncomeExperience positions={incomePositions} locale={locale} walletBalance={walletBalance} walletCurrency={walletCurrency} />}
          {(section === "income" || section === "wallet") && <WalletOverview baseBalance={baseWalletBalance} positions={dailyPositions} purchases={incomePurchases} historyAvailable={overviewHistoryAvailable} asOf={incomeAsOf} locale={locale} />}
          {section === "income" && <DailyIncome positions={dailyPositions} purchases={incomePurchases} locale={locale} asOf={incomeAsOf} historyAvailable={incomeHistoryAvailable} />}

          {section === "orders" && <section className="scroll-mt-20 py-2">
            <h2 className="text-3xl font-bold">{copy.interestsTitle}</h2>
            <p className="mt-3 max-w-3xl leading-7 text-[#687486]">{copy.interestsText}</p>
            {propertyInterests.length === 0 ? <EmptyState text={copy.noInterests} /> : <div className="mt-6 grid gap-4 lg:grid-cols-2">{propertyInterests.map((request) => { const topic = messageValue(request.message, "Thema") || messageValue(request.message, "Topic"); const body = request.message?.replace(/^Thema:\s*.*?(?:\r?\n){2}/i, "").trim(); return <article key={request.id} className="border border-[#dfe5eb] bg-white p-5"><div className="flex items-start justify-between gap-4"><div><p className="text-sm text-[#758095]">{formatDate(request.created_at, locale)}</p><h3 className="mt-1 text-xl font-bold">{topic || copy.interest}</h3></div><RequestStatus status={request.status} fallback={copy.pendingAgent} locale={locale} /></div>{body && <div className="mt-5 bg-[#f4f6f8] p-4"><p className="text-xs font-bold uppercase tracking-wide text-[#758095]">{copy.message}</p><p className="mt-2 whitespace-pre-line leading-6 text-[#35435a]">{body}</p></div>}</article>; })}</div>}

            <h2 className="mt-10 text-3xl font-bold">{copy.requestsTitle}</h2>
            <p className="mt-3 max-w-3xl leading-7 text-[#687486]">{copy.requestsText}</p>
            {purchaseRequests.length === 0 ? <EmptyState text={copy.noRequests} /> : <div className="mt-6 grid gap-4 lg:grid-cols-2">{purchaseRequests.map((request) => <PurchaseRequestCard key={request.id} request={request} copy={copy} locale={locale} />)}</div>}

          </section>}

          {section === "wallet" && <section className="py-2">
            <p className="mt-6 text-sm">{paymentText("Payment reference")}: <strong>{`BW-GL-${user.id.slice(0,8).toUpperCase()}`}</strong></p>
            <div className="mt-8">{paymentDirectory.error ? <p role="alert">{paymentText("Payment details could not be loaded. Please try again.")}</p> : <CompanyPaymentDirectory methods={paymentDirectory.methods} locale={locale} />}</div>
            <h2 className="mt-10 text-2xl font-bold">{paymentText("Payment history")}</h2>
            {payments.length === 0 ? <EmptyState text={paymentText("No payments recorded yet.")} /> : <div className="mt-5 grid gap-4 lg:grid-cols-2">{payments.map((payment) => { const card = <div className="border border-[#dfe5eb] bg-white p-5"><div className="flex justify-between gap-4"><div><h3 className="text-xl font-bold">{payment.title || copy.paymentTitle}</h3><p className="mt-1 text-sm text-[#758095]">{formatDate(payment.created_at, locale)} · {localizedPayment(payment.method, locale)}{payment.method === "crypto" && <> / {payment.crypto_asset} / {payment.crypto_network}</>}</p></div><div className="text-right"><p className="font-bold text-[#2f9bdb]">{formatRecordedMoney(Number(payment.amount || 0), payment.currency || "EUR", localeHtmlLang[locale])}</p><p className="text-xs text-[#758095]">{localizedStatus(payment.status, locale)}</p></div></div>{payment.instructions && <p className="mt-4 whitespace-pre-line bg-[#f4f6f8] p-4 text-sm leading-6">{payment.instructions}</p>}</div>; return payment.payment_link ? <a key={payment.id} href={payment.payment_link} target="_blank" rel="noreferrer">{card}</a> : <div key={payment.id}>{card}</div>; })}</div>}
          </section>}

          {section === "account" && <section className="scroll-mt-20 py-2">
            <div className="flex max-w-4xl flex-col gap-5 bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-4"><span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#17233f] text-lg font-bold text-white">{initials}</span><div><h2 className="text-xl font-bold">{fullName}</h2><p className="mt-1 text-sm text-[#758095]">{user.email}</p></div></div><div className="text-sm sm:text-right"><p className="font-bold text-emerald-700">{copy.activeAccount}</p><p className="mt-1 text-[#758095]">{copy.memberSince} {formatDate(user.created_at, locale)}</p></div></div>
          </section>}
        </div>
      </div>
    </main>
  );
}

function PurchaseRequestCard({ request, copy, locale }: { request: RequestItem; copy: DashboardCopy; locale: Locale }) {
  return <div className="border border-[#dfe5eb] bg-white p-5"><div className="flex items-start justify-between gap-4"><div><p className="text-sm text-[#758095]">{formatDate(request.created_at, locale)}</p><h3 className="mt-1 text-xl font-bold">{messageValue(request.message, "Property") || copy.properties}</h3></div><RequestStatus status={request.status} fallback={copy.pendingAgent} locale={locale} /></div><div className="mt-5 grid grid-cols-2 gap-3 text-sm"><RequestValue label={copy.card.shares} value={messageValue(request.message, "Shares") || "-"} /><RequestValue label={copy.card.amount} value={messageValue(request.message, "Total amount") || "-"} /><RequestValue label={copy.card.payment} value={localizedPayment(messageValue(request.message, "Payment method"), locale)} /><RequestValue label={copy.monthly} value={messageValue(request.message, "Modelled monthly return") || messageValue(request.message, "Projected monthly income") || "-"} /></div></div>;
}



function EmptyState({ text }: { text: string }) {
  return <div className="mt-5 border border-dashed border-[#cbd4de] bg-white p-6 text-[#687486]">{text}</div>;
}

function RequestValue({ label, value }: { label: string; value: string }) {
  return <div className="bg-[#f4f6f8] p-3"><p className="text-xs text-[#758095]">{label}</p><p className="mt-1 font-bold">{value}</p></div>;
}

function RequestStatus({ status, fallback, locale }: { status: string | null; fallback: string; locale: Locale }) {
  const normalized = status?.toLowerCase() || "new";
  const resolved = normalized === "new" ? fallback : localizedStatus(status, locale, fallback);
  const tone = ["completed", "approved", "verified", "paid"].includes(normalized)
    ? "bg-emerald-50 text-emerald-700"
    : ["cancelled", "rejected", "failed"].includes(normalized)
      ? "bg-red-50 text-red-700"
      : "bg-[#edf6fb] text-[#237faf]";
  return <span className={`px-3 py-1 text-xs font-bold ${tone}`}>{resolved}</span>;
}
