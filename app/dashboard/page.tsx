import CompanyPaymentDirectory from "../funding/CompanyPaymentDirectory";
import { getCompanyPaymentMethods } from "../lib/company-payment-store";
import { getAdminText } from "../lib/admin-copy";
import { localizedPayment, localizedStatus, propertyUiCopy } from "../properties/property-ui-copy";
import { getPropertyTranslations, localizeProperty } from "../lib/property-localization";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/auth";
import { isAdminUser } from "@/app/lib/admin";
import ClientPortalSidebar, { type ClientPortalActiveItem } from "@/app/components/ClientPortalSidebar";
import OnboardingBanner from "@/app/components/OnboardingBanner";
import { portalNavCopy } from "@/app/lib/portal-nav-copy";
import { isPropertyOpenForInvestment } from "@/app/lib/external-properties";
import { getAllProperties } from "@/app/lib/property-registry";
import { localeHtmlLang, type Locale } from "@/app/lib/i18n";
import { getCurrentLocale } from "@/app/lib/server-locale";
import PropertyInvestmentCard, { DashboardCardCopy } from "./PropertyInvestmentCard";
import IncomeExperience, { IncomePosition } from "./IncomeExperience";
import DailyIncome from "./DailyIncome";
import WalletOverview from "./WalletOverview";
import { dailyIncomeCopy } from "./daily-income-copy";
import type { IncomePurchase } from "./daily-income-model";
import { getPropertyProjection, getPropertyShareSupply, getPropertyTargetReturn } from "../lib/property-financials";
import { formatRecordedMoney } from "./recorded-money";
import Link from "next/link";
import { ArrowRight, BadgeCheck, Download, FileCheck2, FileSpreadsheet, FileText, KeyRound, Mail, MessageCircle, ShieldCheck, UserRound } from "lucide-react";
import { agentCopy } from "@/app/lib/agent-copy";
import { company } from "@/app/lib/company";
import PortalActionButton from "@/app/components/PortalActionButton";
import CopyPaymentValue from "../funding/CopyPaymentValue";
import { PortalCard, cellClass, headCellClass, numberCellClass, primaryButtonClass, secondaryButtonClass, tableClass } from "./portal-ui";
import { agreementVersion, loadClientAgreement } from "@/app/lib/client-agreements";
import { portalCopy, type PortalCopy } from "@/app/lib/portal-copy";
import NotificationBell from "./NotificationBell";
import KycForm from "./KycForm";
import OnboardingChecklist, { type OnboardingStep } from "./OnboardingChecklist";
import WithdrawForm from "./WithdrawForm";
import SaleRequestForm from "./SaleRequestForm";
import { randomUUID } from "node:crypto";
import { buildStatement, maskIban, type StatementRange } from "@/app/lib/client-finance";
import { loadLedger } from "@/app/lib/statement-data";
import { agreementCopy } from "@/app/lib/agreement-copy";
import { readProfileFields } from "@/app/lib/profile-fields";

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
  profileTitle: string;
  editProfile: string;
  phone: string;
  country: string;
  notProvided: string;
  securityTitle: string;
  securityText: string;
  changePassword: string;
  deposit: string;
  explore: string;
  depositTitle: string;
  walletIntro: string;
  depositHowTo: string;
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
  propertiesText: "Yields shown are projected net rental yields (rent minus stated costs), not guaranteed. Monthly values equal the annual figure divided by 12. Wallet purchases complete immediately; bank and crypto requests are reviewed by our team first.",
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
  profileTitle: "Personal details",
  editProfile: "Edit profile",
  phone: "Phone",
  country: "Country",
  notProvided: "Not provided",
  securityTitle: "Security",
  securityText: "Change your password regularly and never share your login details.",
  changePassword: "Change password",
  deposit: "Deposit",
  explore: "Explore properties",
  depositTitle: "How to deposit",
  walletIntro: "Your balance, deposit instructions and payment history.",
  depositHowTo: "Transfer only to the verified company accounts below and always include your personal payment reference. Your wallet is credited after our team confirms receipt.",
  card: {
    available: "Available shares",
    targetReturn: "Net rental yield",
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
  agent: "Berater kontaktieren",
  signOut: "Abmelden",
  welcome: "Immobilienanteile in einem einfachen Panel",
  intro: "Wählen Sie eine Immobilie, modellieren Sie die Anteile und senden Sie eine Bank- oder Krypto-Anfrage an Ihren Brickwise-Berater.",
  daily: "Täglich prognostiziert",
  weekly: "Wöchentlich prognostiziert",
  monthly: "Monatlich prognostiziert",
  requestedCapital: "Angefragtes Kapital",
  projected: "Basierend auf aktiven Kaufanfragen",
  propertiesTitle: "Verfügbare Immobilien",
  propertiesText: "Angezeigte Renditen sind prognostizierte Nettomietrenditen (Miete abzüglich ausgewiesener Kosten) und nicht garantiert. Monatswerte entsprechen dem Jahreswert geteilt durch 12. Wallet-Käufe werden sofort ausgeführt; Bank- und Kryptoanfragen prüft zuerst unser Team.",
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
    targetReturn: "Nettomietrendite",
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
    details: "Berater kontaktieren",
    buyWithWallet: "Mit Wallet kaufen",
    availableWallet: "Verfügbares Wallet-Guthaben",
    maximumWithWallet: "Maximale Anteile mit Wallet",
  },
};


const fr: DashboardCopy = { ...en, panel: "Espace client", properties: "Biens", income: "Revenus", requests: "Mes demandes", account: "Compte", agent: "Contacter un conseiller", signOut: "Déconnexion", welcome: "Vos parts immobilières dans un espace simple", intro: "Choisissez un bien, simulez le nombre de parts et envoyez une demande bancaire ou crypto au conseiller Brickwise.", daily: "Projection quotidienne", weekly: "Projection hebdomadaire", monthly: "Projection mensuelle", requestedCapital: "Capital demandé", projected: "Selon les demandes d’achat actives", propertiesTitle: "Biens disponibles", propertiesText: "Les rendements affichés sont des rendements locatifs nets projetés (loyer moins coûts indiqués), non garantis. Les montants mensuels correspondent au montant annuel divisé par 12. Les achats par portefeuille sont immédiats ; les demandes bancaires et crypto sont d’abord vérifiées par notre équipe.", requestsTitle: "Demandes d’achat", requestsText: "Vos parts et le mode de paiement choisi apparaissent ici pendant la vérification.", noRequests: "Vous n’avez encore envoyé aucune demande d’achat.", interestsTitle: "Biens suivis", interestsText: "Les biens sur lesquels vous avez demandé des informations apparaissent ici avec leur statut.", noInterests: "Vous n’avez encore demandé aucune information.", interest: "Demande immobilière", message: "Message", paymentTitle: "Instructions de paiement", noPayments: "Aucune instruction bancaire ou crypto vérifiée n’a encore été émise.", pendingAgent: "Vérification du conseiller", sent: "Votre demande a été envoyée. Un conseiller vous contactera.", requestError: "La demande n’a pas pu être enregistrée.", invalidRequest: "Choisissez un nombre valide de parts et un mode de paiement.", memberSince: "Membre depuis", activeAccount: "Compte client actif", card: { ...en.card, available: "Parts disponibles", targetReturn: "Rendement locatif net", perShare: "Prix / part", shares: "Nombre de parts", daily: "Jour", weekly: "Semaine", monthly: "Mois", annual: "Année", amount: "Montant", payment: "Mode de paiement préféré", bank: "Virement bancaire", agentNote: "Les demandes bancaires et crypto passent au conseiller. Les achats par portefeuille débitent immédiatement votre solde en EUR.", request: "Demander l’achat", details: "Contacter un conseiller" } };
const es: DashboardCopy = { ...en, panel: "Panel del cliente", properties: "Propiedades", income: "Ingresos", requests: "Mis solicitudes", account: "Cuenta", agent: "Contactar asesor", signOut: "Cerrar sesión", welcome: "Participaciones inmobiliarias en un panel sencillo", intro: "Elige una propiedad, simula las participaciones y envía una solicitud bancaria o cripto al asesor.", daily: "Proyección diaria", weekly: "Proyección semanal", monthly: "Proyección mensual", requestedCapital: "Capital solicitado", projected: "Según solicitudes activas", propertiesTitle: "Propiedades disponibles", propertiesText: "Las rentabilidades mostradas son rentabilidades netas de alquiler proyectadas (alquiler menos costes indicados), no garantizadas. Los importes mensuales equivalen al importe anual dividido entre 12. Las compras con cartera se completan al instante; las solicitudes bancarias y cripto las revisa primero nuestro equipo.", requestsTitle: "Solicitudes de compra", requestsText: "Tus participaciones y método de pago aparecen aquí durante la revisión.", noRequests: "Aún no has enviado una solicitud de compra.", interestsTitle: "Propiedades de interés", interestsText: "Las propiedades consultadas aparecen aquí con su estado.", noInterests: "Aún no has consultado ninguna propiedad.", interest: "Consulta inmobiliaria", message: "Mensaje", paymentTitle: "Instrucciones de pago", noPayments: "Aún no hay instrucciones bancarias o cripto verificadas.", pendingAgent: "Revisión del asesor", sent: "Tu solicitud se ha enviado. Un asesor te contactará.", requestError: "No se pudo guardar la solicitud.", invalidRequest: "Elige un número válido de participaciones y un método de pago.", memberSince: "Miembro desde", activeAccount: "Cuenta activa", card: { ...en.card, available: "Participaciones disponibles", targetReturn: "Rentabilidad neta del alquiler", perShare: "Precio / participación", shares: "Número de participaciones", daily: "Diario", weekly: "Semanal", monthly: "Mensual", annual: "Anual", amount: "Importe", payment: "Método de pago preferido", bank: "Transferencia bancaria", crypto: "Cripto", agentNote: "Las solicitudes bancarias y cripto pasan al asesor. Las compras con cartera descuentan el saldo en EUR inmediatamente.", request: "Solicitar compra", details: "Contactar asesor" } };
const it: DashboardCopy = { ...en, panel: "Area cliente", properties: "Immobili", income: "Reddito", requests: "Le mie richieste", account: "Account", agent: "Contatta un consulente", signOut: "Esci", welcome: "Quote immobiliari in una dashboard semplice", intro: "Scegli un immobile, simula le quote e invia una richiesta bancaria o crypto al consulente.", daily: "Proiezione giornaliera", weekly: "Proiezione settimanale", monthly: "Proiezione mensile", requestedCapital: "Capitale richiesto", projected: "In base alle richieste attive", propertiesTitle: "Immobili disponibili", propertiesText: "I rendimenti mostrati sono rendimenti netti da affitto previsti (affitto meno costi indicati), non garantiti. Gli importi mensili equivalgono all’importo annuale diviso per 12. Gli acquisti con wallet sono immediati; le richieste bancarie e crypto vengono prima verificate dal nostro team.", requestsTitle: "Richieste di acquisto", requestsText: "Le quote e il metodo di pagamento appaiono qui durante la verifica.", noRequests: "Non hai ancora inviato richieste di acquisto.", interestsTitle: "Immobili di interesse", interestsText: "Gli immobili su cui hai chiesto informazioni appaiono qui con lo stato.", noInterests: "Non hai ancora richiesto informazioni.", interest: "Richiesta immobiliare", message: "Messaggio", paymentTitle: "Istruzioni di pagamento", noPayments: "Non sono ancora disponibili istruzioni bancarie o crypto verificate.", pendingAgent: "Verifica del consulente", sent: "La richiesta è stata inviata. Un consulente ti contatterà.", requestError: "Non è stato possibile salvare la richiesta.", invalidRequest: "Scegli un numero valido di quote e un metodo di pagamento.", memberSince: "Membro dal", activeAccount: "Account cliente attivo", card: { ...en.card, available: "Quote disponibili", targetReturn: "Rendimento netto da affitto", perShare: "Prezzo / quota", shares: "Numero di quote", daily: "Giornaliero", weekly: "Settimanale", monthly: "Mensile", annual: "Annuale", amount: "Importo", payment: "Metodo di pagamento preferito", bank: "Bonifico bancario", crypto: "Cripto", agentNote: "Le richieste bancarie e crypto passano al consulente. Gli acquisti con wallet addebitano subito il saldo in EUR.", request: "Richiedi acquisto", details: "Contatta consulente" } };
Object.assign(fr, { walletBalance: "Solde du portefeuille", ownedShares: "Parts détenues", purchaseSuccess: "Parts achetées avec succès avec le solde de votre portefeuille.", insufficientFunds: "Le solde de votre portefeuille est insuffisant pour cet achat." });
Object.assign(fr.card, { buyWithWallet: "Acheter avec le portefeuille", availableWallet: "Solde disponible", maximumWithWallet: "Parts maximales avec le portefeuille" });
Object.assign(es, { walletBalance: "Saldo del monedero", ownedShares: "Tus participaciones", purchaseSuccess: "Participaciones compradas correctamente con el saldo de tu monedero.", insufficientFunds: "El saldo de tu monedero no es suficiente para esta compra." });
Object.assign(es.card, { buyWithWallet: "Comprar con la cartera", availableWallet: "Saldo disponible", maximumWithWallet: "Participaciones máximas con la cartera" });
Object.assign(it, { walletBalance: "Saldo wallet", ownedShares: "Quote possedute", purchaseSuccess: "Quote acquistate con successo con il saldo del wallet.", insufficientFunds: "Il saldo del wallet non è sufficiente per questo acquisto." });
Object.assign(it.card, { buyWithWallet: "Acquista con il wallet", availableWallet: "Saldo disponibile", maximumWithWallet: "Quote massime con il wallet" });

Object.assign(en, { profileTitle: "Personal details", editProfile: "Edit profile", phone: "Phone", country: "Country", notProvided: "Not provided", securityTitle: "Security", securityText: "Change your password regularly and never share your login details.", changePassword: "Change password", deposit: "Deposit", explore: "Explore properties" });
Object.assign(de, { walletIntro: "Ihr Guthaben, Einzahlungsanweisungen und Zahlungsverlauf.", depositTitle: "So zahlen Sie ein", depositHowTo: "Überweisen Sie nur auf die unten aufgeführten verifizierten Firmenkonten und geben Sie immer Ihre persönliche Zahlungsreferenz an. Ihr Wallet wird gutgeschrieben, sobald unser Team den Eingang bestätigt hat.", profileTitle: "Persönliche Angaben", editProfile: "Profil bearbeiten", phone: "Telefon", country: "Land", notProvided: "Nicht angegeben", securityTitle: "Sicherheit", securityText: "Ändern Sie Ihr Passwort regelmäßig und geben Sie Ihre Zugangsdaten niemals weiter.", changePassword: "Passwort ändern", deposit: "Einzahlen", explore: "Immobilien entdecken" });
Object.assign(fr, { walletIntro: "Votre solde, les instructions de dépôt et l’historique des paiements.", depositTitle: "Comment déposer des fonds", depositHowTo: "Effectuez vos virements uniquement vers les comptes vérifiés de la société ci-dessous et indiquez toujours votre référence de paiement personnelle. Votre portefeuille est crédité dès que notre équipe a confirmé la réception.", profileTitle: "Informations personnelles", editProfile: "Modifier le profil", phone: "Téléphone", country: "Pays", notProvided: "Non renseigné", securityTitle: "Sécurité", securityText: "Changez régulièrement votre mot de passe et ne communiquez jamais vos identifiants.", changePassword: "Changer le mot de passe", deposit: "Déposer", explore: "Découvrir les biens" });
Object.assign(es, { walletIntro: "Tu saldo, las instrucciones de depósito y el historial de pagos.", depositTitle: "Cómo depositar", depositHowTo: "Transfiere solo a las cuentas verificadas de la empresa que aparecen abajo e indica siempre tu referencia de pago personal. Tu monedero se abona cuando nuestro equipo confirma la recepción.", profileTitle: "Datos personales", editProfile: "Editar perfil", phone: "Teléfono", country: "País", notProvided: "No indicado", securityTitle: "Seguridad", securityText: "Cambia tu contraseña con regularidad y nunca compartas tus datos de acceso.", changePassword: "Cambiar contraseña", deposit: "Depositar", explore: "Explorar propiedades" });
Object.assign(it, { walletIntro: "Il tuo saldo, le istruzioni di versamento e lo storico dei pagamenti.", depositTitle: "Come versare fondi", depositHowTo: "Effettua i bonifici solo sui conti aziendali verificati qui sotto e indica sempre il tuo riferimento di pagamento personale. Il wallet viene accreditato dopo che il nostro team ha confermato la ricezione.", profileTitle: "Dati personali", editProfile: "Modifica profilo", phone: "Telefono", country: "Paese", notProvided: "Non indicato", securityTitle: "Sicurezza", securityText: "Cambia regolarmente la password e non condividere mai i tuoi dati di accesso.", changePassword: "Cambia password", deposit: "Deposita", explore: "Scopri gli immobili" });

const copies: Record<Locale, DashboardCopy> = { en, de, fr, es, it };

function formatDate(value: string | null, locale: Locale) {
  if (!value) return "-";
  return new Intl.DateTimeFormat(localeHtmlLang[locale], { dateStyle: "medium" }).format(new Date(value));
}

/** Calendar dates (YYYY-MM-DD) are shown as stored, without a time-zone shift. */
function formatDay(value: string, locale: Locale) {
  return new Intl.DateTimeFormat(localeHtmlLang[locale], { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
}

type DistributionInfo = { property_slug: string; period_start: string; period_end: string; created_at: string };
type PayoutRow = { amount: number | string; shares: number | string; property_distributions: DistributionInfo | DistributionInfo[] | null };
type EarningRow = { key: string; kind: "distribution" | "profit"; property_slug: string; period: string; amount: number; shares: number; created_at: string };
type SaleRequestItem = { id: string; property_slug: string; shares: number; status: string; admin_note: string | null; created_at: string };
type PropertyUpdateItem = { id: string; property_slug: string; title: string; body: string; created_at: string };

function messageValue(message: string | null, label: string) {
  if (!message) return null;
  return message.match(new RegExp(`^${label}:\\s*(.+)$`, "mi"))?.[1]?.trim() || null;
}


export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ request?: string; section?: string; range?: string; dir?: string }>;
}) {
  const locale = await getCurrentLocale();
  // Catalogue listings and properties added in the admin panel.
  const [translations, catalog] = await Promise.all([getPropertyTranslations(locale), getAllProperties()]);
  const copy = copies[locale];
  const params = await searchParams;
  // Properties is the home of the panel; the former Income page is now part of Portfolio.
  const requestedSection = params.section === "income" ? "assets" : params.section;
  const section = ["marketplace", "assets", "account", "wallet", "orders", "statement", "documents"].includes(requestedSection || "") ? requestedSection : "marketplace";
  const supabase = await createClient();
  const user = await getCurrentUser();

  if (!user?.email) redirect("/sign-in");
  if (isAdminUser(user)) redirect("/admin");

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
  if ((section === "assets" || section === "wallet") && incomeHistoryAvailable) {
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
  const { data: shareSettings } = await supabase.from("property_share_settings").select("property_slug,total_shares,blocked_shares,profit_active,profit_start_date");
  const sharesBySlug = new Map((shareSettings || []).map((item) => [item.property_slug, { total: Number(item.total_shares), blocked: Number(item.blocked_shares) }]));
  // Admin profit settings: accrual starts at the activation date and stops while paused.
  const accrualBySlug = new Map((shareSettings || []).map((item) => [item.property_slug, {
    paused: item.profit_active === false,
    accrualStart: item.profit_start_date ? Date.parse(`${item.profit_start_date}T00:00:00Z`) : null,
  }]));
  const purchaseRequests = requests.filter((request) => request.message?.includes("Share purchase request"));
  const propertyInterests = requests.filter((request) => !request.message?.includes("Share purchase request"));
  const walletCurrency = walletAccount?.currency || "EUR";
  const incomePositions: IncomePosition[] = (holdingsData || []).flatMap((holding) => {
    const property = catalog.find((item) => item.slug === holding.property_slug);
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
    rentalRate: getPropertyTargetReturn(catalog.find(p => p.slug === position.slug)!),
    paused: accrualBySlug.get(position.slug)?.paused ?? false,
    accrualStart: accrualBySlug.get(position.slug)?.accrualStart ?? null,
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
  // Only the document and acceptance are shown here; signing itself runs in the profile dialog.
  const agreement = section === "account"
    ? await loadClientAgreement(supabase, user.id, locale, false).catch(() => null)
    : null;
  // RLS returns the assigned agent only while that agent is active.
  const { data: agentRow } = section === "account"
    ? await supabase.from("client_agents").select("agents(code,full_name,title,email,phone,languages)").eq("user_id", user.id).maybeSingle()
    : { data: null };
  const agentEmbed = (agentRow as { agents?: AssignedAgent | AssignedAgent[] | null } | null)?.agents;
  const assignedAgent = Array.isArray(agentEmbed) ? agentEmbed[0] ?? null : agentEmbed ?? null;
  const profile = readProfileFields(user.user_metadata);
  const text = portalCopy[locale];
  const propertyTitles = Object.fromEntries(catalog.map((property) => [property.slug, localizeProperty(property, translations).title]));
  const { data: kycLatest } = section === "assets" || section === "account" || section === "wallet" || section === "documents"
    ? await supabase.from("client_kyc_submissions").select("id,status,created_at,review_note").eq("user_id", user.id).order("created_at", { ascending: false }).limit(1).maybeSingle()
    : { data: null };
  const { data: withdrawalRows } = section === "wallet"
    ? await supabase.from("withdrawal_requests").select("id,amount,iban,status,review_note,created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(50)
    : { data: null };
  const [{ data: payoutData }, { data: profitData }] = section === "assets" ? await Promise.all([
    supabase.from("distribution_payouts").select("amount,shares,property_distributions(property_slug,period_start,period_end,created_at)").eq("user_id", user.id).limit(200),
    supabase.from("wallet_transactions").select("id,amount,shares,property_slug,metadata,created_at").eq("user_id", user.id).eq("reference_type", "profit_payout").order("created_at", { ascending: false }).limit(200),
  ]) : [{ data: null }, { data: null }];
  // Earnings actually paid: rental distributions and property profit payouts.
  const earnings: EarningRow[] = [
    ...((payoutData || []) as unknown as PayoutRow[]).flatMap((row) => {
      const distribution = Array.isArray(row.property_distributions) ? row.property_distributions[0] : row.property_distributions;
      return distribution ? [{ key: `d:${distribution.property_slug}:${distribution.period_start}`, kind: "distribution" as const, property_slug: distribution.property_slug,
        period: `${formatDay(distribution.period_start, locale)} – ${formatDay(distribution.period_end, locale)}`, amount: Number(row.amount), shares: Number(row.shares), created_at: distribution.created_at }] : [];
    }),
    ...((profitData || []) as { id: string; amount: number; shares: number | null; property_slug: string | null; metadata: { note?: string | null } | null; created_at: string }[]).map((row) => ({
      key: `p:${row.id}`, kind: "profit" as const, property_slug: row.property_slug || "", period: row.metadata?.note || "—",
      amount: Number(row.amount), shares: Number(row.shares || 0), created_at: row.created_at })),
  ].sort((a, b) => b.created_at.localeCompare(a.created_at));
  const distributedTotal = earnings.reduce((sum, row) => sum + row.amount, 0);
  const [{ data: saleData }, { data: updateData }] = section === "assets" ? await Promise.all([
    supabase.from("share_sale_requests").select("id,property_slug,shares,status,admin_note,created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(50),
    // RLS returns only updates for properties this client holds.
    supabase.from("property_updates").select("id,property_slug,title,body,created_at").order("created_at", { ascending: false }).limit(20),
  ]) : [{ data: null }, { data: null }];
  const saleRequests = (saleData || []) as SaleRequestItem[];
  const propertyUpdates = (updateData || []) as PropertyUpdateItem[];
  const range = (["30", "90", "year", "all"].includes(params.range || "") ? params.range : "90") as StatementRange;
  const direction = (["credit", "debit"].includes(params.dir || "") ? params.dir : "all") as "all" | "credit" | "debit";
  const ledger = section === "statement" || section === "documents" ? await loadLedger(supabase, user.id) : null;
  const statement = section === "statement" && ledger ? buildStatement(ledger, range, direction) : null;
  const documentAcceptance = section === "documents"
    ? (await supabase.from("client_agreement_acceptances").select("id,status,accepted_at,signed_pdf_sha256").eq("user_id", user.id).order("accepted_at", { ascending: false }).limit(1).maybeSingle()).data
    : null;
  let onboarding: OnboardingStep[] = [];
  if (section === "assets") {
    const [{ data: acceptanceRow }, { count: verifiedDeposits }] = await Promise.all([
      supabase.from("client_agreement_acceptances").select("status").eq("user_id", user.id).eq("version", agreementVersion).maybeSingle(),
      supabase.from("deposit_submissions").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("status", "verified"),
    ]);
    const stepAction = "shrink-0 text-xs font-semibold text-brand hover:underline";
    const openProfile = <PortalActionButton action="profile" className={stepAction}>{text.start}</PortalActionButton>;
    onboarding = [
      { key: "profile", label: text.stepProfile, status: profile.first_name.trim() && profile.last_name.trim() ? "done" : "todo", action: openProfile },
      { key: "agreement", label: text.stepAgreement, status: acceptanceRow?.status === "pending" || acceptanceRow?.status === "approved" ? "done" : "todo", action: openProfile },
      { key: "identity", label: text.stepIdentity, status: kycLatest?.status === "approved" ? "done" : kycLatest?.status === "pending" ? "review" : "todo", action: <Link href="/dashboard/account#identity" className={stepAction}>{text.start}</Link> },
      { key: "deposit", label: text.stepDeposit, status: (verifiedDeposits || 0) > 0 || (baseWalletBalance || 0) > 0 ? "done" : "todo", action: <PortalActionButton action="deposit" className={stepAction}>{text.start}</PortalActionButton> },
      { key: "purchase", label: text.stepPurchase, status: (holdingsData || []).length > 0 ? "done" : "todo", action: <Link href="/dashboard/marketplace" className={stepAction}>{text.start}</Link> },
    ];
  }
  const paymentText = getAdminText(locale);
  const paymentReference = `BW-GL-${user.id.slice(0, 8).toUpperCase()}`;
  const incomeAsOf = await getIncomeSnapshotTime();
  const nav = portalNavCopy[locale];
  const sectionTitle = section === "assets" ? nav.portfolio : section === "account" ? copy.account : section === "income" ? copy.income : section === "wallet" ? copy.walletBalance : section === "orders" ? copy.requests : section === "statement" ? text.statementTitle : section === "documents" ? text.documentsTitle : copy.propertiesTitle;
  const sectionDescription = section === "marketplace" ? copy.propertiesText : section === "orders" ? copy.requestsText : section === "wallet" ? copy.walletIntro : section === "assets" ? dailyIncomeCopy[locale].intro : section === "statement" ? text.statementIntro : section === "documents" ? text.documentsIntro : copy.activeAccount;

  return (
    <main className="investor-shell min-h-screen bg-canvas text-ink">
      <ClientPortalSidebar active={section as ClientPortalActiveItem} email={user.email} fullName={fullName} locale={locale} />
      <div className="pt-16 lg:ml-[282px] lg:pt-0">
        <OnboardingBanner locale={locale} />
        <header className="border-b border-line bg-white px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto flex max-w-[1440px] flex-wrap items-end justify-between gap-4">
            <div className="max-w-3xl"><p className="text-xs font-bold uppercase tracking-wider text-brand">{copy.panel}</p><h1 className="mt-1 text-[28px] font-bold leading-tight">{sectionTitle}</h1><p className="mt-1.5 text-sm leading-6 text-muted">{sectionDescription}</p></div>
            <div className="flex flex-wrap items-center gap-2">
              <NotificationBell locale={locale} propertyTitles={propertyTitles} />
              <PortalActionButton action="deposit" className={secondaryButton}>{copy.deposit}</PortalActionButton>
              {section !== "marketplace" && <Link href="/dashboard/marketplace" className={primaryButton}>{copy.explore}<ArrowRight size={16} aria-hidden="true" /></Link>}
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-[1440px] px-4 py-7 sm:px-6 lg:px-8">
          {notice && <div role={notice.tone === "success" ? "status" : "alert"} className={`mb-6 rounded-xl border px-4 py-3 text-sm font-semibold ${notice.tone === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-800"}`}>{notice.text}</div>}

          {section === "marketplace" && <section className="scroll-mt-20">
            <div className="grid gap-5 md:grid-cols-2 2xl:grid-cols-3">
              {catalog.filter(isPropertyOpenForInvestment).map((property) => <PropertyInvestmentCard locale={locale} key={property.id} property={localizeProperty(property, translations)} copy={copy.card} shareAvailability={sharesBySlug.get(property.slug)} walletBalance={baseWalletBalance} />)}
            </div>
          </section>}

          {section === "wallet" && <WalletOverview baseBalance={baseWalletBalance} positions={dailyPositions} purchases={incomePurchases} historyAvailable={overviewHistoryAvailable} asOf={incomeAsOf} locale={locale} />}
          {section === "assets" && onboarding.some((step) => step.status !== "done") && <OnboardingChecklist steps={onboarding} text={text} />}
          {section === "assets" && <DailyIncome positions={dailyPositions} purchases={incomePurchases} locale={locale} asOf={incomeAsOf} historyAvailable={incomeHistoryAvailable} walletBalance={baseWalletBalance} />}
          {section === "assets" && <div className="mt-6"><IncomeExperience positions={incomePositions} locale={locale} walletBalance={baseWalletBalance} walletCurrency={walletCurrency} /></div>}
          {section === "assets" && <PortalCard className="mt-6" title={text.distributionsTitle} description={text.distributionsIntro}
            action={earnings.length > 0 ? <p className="text-right text-sm text-muted">{text.totalReceived}<span className="block text-lg font-semibold tabular-nums text-ink">{formatRecordedMoney(distributedTotal, "EUR", localeHtmlLang[locale])}</span></p> : undefined}>
            {!earnings.length ? <EmptyState text={text.noDistributions} /> : <div className="overflow-x-auto"><table className={`${tableClass} min-w-[640px]`}>
              <thead><tr><th scope="col" className={headCellClass}>{text.date}</th><th scope="col" className={headCellClass}>{text.property}</th><th scope="col" className={headCellClass}>{text.period}</th><th scope="col" className={`${headCellClass} text-right`}>{text.sharesCount}</th><th scope="col" className={`${headCellClass} text-right`}>{text.received}</th></tr></thead>
              <tbody>{earnings.map((row) => <tr key={row.key}>
                <td className={`${cellClass} whitespace-nowrap text-muted`}>{formatDate(row.created_at, locale)}</td>
                <td className={cellClass}><p className="font-semibold">{propertyTitles[row.property_slug] || row.property_slug}</p><p className="text-xs text-muted">{text.transactionType[row.kind]}</p></td>
                <td className={`${cellClass} max-w-xs`}>{row.period}</td>
                <td className={numberCellClass}>{row.shares.toLocaleString(localeHtmlLang[locale])}</td>
                <td className={`${numberCellClass} font-semibold text-emerald-700`}>+{formatRecordedMoney(row.amount, "EUR", localeHtmlLang[locale])}</td>
              </tr>)}</tbody>
            </table></div>}
          </PortalCard>}
          {section === "assets" && <div className="mt-6 grid gap-6 xl:grid-cols-2">
            {incomePositions.length > 0 && <PortalCard id="sell" title={text.saleTitle} description={text.saleIntro}>
              <div className="px-5 py-5"><SaleRequestForm locale={locale} holdings={incomePositions.map((position) => ({ slug: position.slug, title: position.title, shares: position.shares }))} requestKey={randomUUID()} /></div>
            </PortalCard>}
            {(incomePositions.length > 0 || saleRequests.length > 0) && <PortalCard title={text.saleRequestsTitle}>
              {!saleRequests.length ? <EmptyState text={text.noSaleRequests} /> : <ul className="divide-y divide-line">{saleRequests.map((request) => <li key={request.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 px-5 py-4">
                <div className="min-w-0"><p className="font-semibold">{propertyTitles[request.property_slug] || request.property_slug}</p><p className="mt-0.5 text-xs text-muted">{formatDate(request.created_at, locale)} · {request.shares.toLocaleString(localeHtmlLang[locale])} {text.shares}</p>
                  {request.admin_note && <p className="mt-2 text-xs leading-5 text-muted"><strong className="text-ink">{text.teamNote}:</strong> {request.admin_note}</p>}</div>
                <span className={`inline-flex shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${request.status === "completed" ? "bg-emerald-50 text-emerald-700" : request.status === "cancelled" ? "bg-canvas text-muted" : request.status === "in_review" ? "bg-brand-soft text-brand" : "bg-amber-50 text-amber-800"}`}>{text.saleStatus[request.status as keyof typeof text.saleStatus] || request.status}</span>
              </li>)}</ul>}
            </PortalCard>}
            {incomePositions.length > 0 && <PortalCard className="xl:col-span-2" title={text.updatesTitle} description={text.updatesIntro}>
              {!propertyUpdates.length ? <EmptyState text={text.noUpdates} /> : <ul className="divide-y divide-line">{propertyUpdates.map((update) => <li key={update.id} className="px-5 py-4">
                <p className="text-xs text-muted">{formatDate(update.created_at, locale)} · {propertyTitles[update.property_slug] || update.property_slug}</p>
                <p className="mt-1 font-semibold">{update.title}</p>
                <p className="mt-1 max-w-3xl whitespace-pre-line text-sm leading-6 text-muted">{update.body}</p>
              </li>)}</ul>}
            </PortalCard>}
          </div>}

          {section === "orders" && <section className="grid gap-6">
            <PortalCard title={copy.requestsTitle}>
              {purchaseRequests.length === 0 ? <EmptyState text={copy.noRequests} /> : <ul className="divide-y divide-line">{purchaseRequests.map((request) => <PurchaseRequestRow key={request.id} request={request} copy={copy} locale={locale} />)}</ul>}
            </PortalCard>
            <PortalCard title={copy.interestsTitle} description={copy.interestsText}>
              {propertyInterests.length === 0 ? <EmptyState text={copy.noInterests} /> : <ul className="divide-y divide-line">{propertyInterests.map((request) => { const topic = messageValue(request.message, "Thema") || messageValue(request.message, "Topic"); const body = request.message?.replace(/^Thema:\s*.*?(?:\r?\n){2}/i, "").trim(); return <li key={request.id} className="px-5 py-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold">{topic || copy.interest}</p><p className="mt-0.5 text-xs text-muted">{formatDate(request.created_at, locale)}</p></div><RequestStatus status={request.status} fallback={copy.pendingAgent} locale={locale} /></div>{body && <p className="mt-2 whitespace-pre-line rounded-lg bg-canvas px-3 py-2 text-sm leading-6 text-ink-soft">{body}</p>}</li>; })}</ul>}
            </PortalCard>
          </section>}

          {section === "wallet" && <div className="space-y-6">
            <div className="flex flex-wrap gap-2">
              <PortalActionButton action="deposit" className={primaryButton}>{nav.deposit}</PortalActionButton>
              <a href="#withdraw" className={secondaryButton}>{nav.withdraw}</a>
              <Link href="/dashboard/statement" className={secondaryButton}>{nav.statement}</Link>
            </div>
            <PortalCard title={copy.depositTitle} description={copy.depositHowTo} action={<PortalActionButton action="deposit" className={primaryButton}>{copy.deposit}</PortalActionButton>}>
              <div className="flex flex-wrap items-end gap-x-6 gap-y-2 px-5 py-4">
                <div><p className="text-xs font-medium text-muted">{paymentText("Payment reference")}</p><p className="mt-0.5 font-mono text-xl font-semibold tracking-wider text-ink">{paymentReference}</p></div>
                <CopyPaymentValue value={paymentReference} label={paymentText("Copy details")} copiedLabel={paymentText("Copied")} failedLabel={paymentText("Please select and copy the details.")} />
              </div>
            </PortalCard>
            <PortalCard id="withdraw" title={text.withdrawTitle} description={text.withdrawIntro}>
              <div className="px-5 py-5">
                {kycLatest?.status === "approved" ? <WithdrawForm locale={locale} balance={baseWalletBalance} holder={fullName} requestKey={randomUUID()} />
                  : <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"><p>{text.withdrawKycRequired}</p><Link href="/dashboard/account#identity" className="font-semibold text-brand hover:underline">{text.stepIdentity}</Link></div>}
              </div>
              {(withdrawalRows || []).length > 0 && <div className="overflow-x-auto border-t border-line"><table className={`${tableClass} min-w-[620px]`}>
                <thead><tr><th scope="col" className={headCellClass}>{text.date}</th><th scope="col" className={headCellClass}>{text.iban}</th><th scope="col" className={`${headCellClass} text-right`}>{paymentText("Amount")}</th><th scope="col" className={`${headCellClass} text-right`}>{paymentText("Status")}</th></tr></thead>
                <tbody>{(withdrawalRows || []).map((row) => <tr key={row.id}>
                  <td className={`${cellClass} whitespace-nowrap text-muted`}>{formatDate(row.created_at, locale)}</td>
                  <td className={`${cellClass} font-mono text-xs`}>{maskIban(row.iban)}{row.status === "rejected" && row.review_note && <p className="mt-1 font-sans text-xs text-muted">{row.review_note}</p>}</td>
                  <td className={`${numberCellClass} font-semibold`}>{formatRecordedMoney(Number(row.amount), "EUR", localeHtmlLang[locale])}</td>
                  <td className={`${cellClass} text-right`}><span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${row.status === "paid" ? "bg-emerald-50 text-emerald-700" : row.status === "rejected" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-800"}`}>{text.withdrawalStatus[row.status as keyof typeof text.withdrawalStatus] || row.status}</span></td>
                </tr>)}</tbody>
              </table></div>}
            </PortalCard>
            {paymentDirectory.error ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{paymentText("Payment details could not be loaded. Please try again.")}</p> : <CompanyPaymentDirectory methods={paymentDirectory.methods} locale={locale} />}
            <PortalCard title={paymentText("Payment history")}>
              {payments.length === 0 ? <EmptyState text={paymentText("No payments recorded yet.")} /> : <div className="overflow-x-auto"><table className={`${tableClass} min-w-[720px]`}>
                <thead><tr><th scope="col" className={headCellClass}>{paymentText("Date")}</th><th scope="col" className={headCellClass}>{paymentText("Payment")}</th><th scope="col" className={headCellClass}>{paymentText("Method")}</th><th scope="col" className={`${headCellClass} text-right`}>{paymentText("Amount")}</th><th scope="col" className={`${headCellClass} text-right`}>{paymentText("Status")}</th></tr></thead>
                <tbody>{payments.map((payment) => {
                  const walletCredit = payment.method === "wallet_credit" || Boolean(payment.title?.startsWith("[Wallet credit]"));
                  const detail = walletCredit ? propertyUiCopy[locale].walletCreditNote : payment.instructions;
                  return <tr key={payment.id}>
                    <td className={`${cellClass} whitespace-nowrap text-muted`}>{formatDate(payment.created_at, locale)}</td>
                    <td className={`${cellClass} max-w-md`}><p className="font-semibold">{walletCredit ? localizedPayment("wallet_credit", locale) : payment.title || copy.paymentTitle}</p>{detail && <p className="mt-0.5 whitespace-pre-line text-xs leading-5 text-muted">{detail}</p>}{payment.payment_link && <a href={payment.payment_link} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs font-semibold text-brand hover:underline">{paymentText("Payment link")}</a>}</td>
                    <td className={`${cellClass} whitespace-nowrap`}>{localizedPayment(payment.method, locale)}{payment.method === "crypto" && <p className="text-xs text-muted">{payment.crypto_asset} · {payment.crypto_network}</p>}</td>
                    <td className={`${numberCellClass} font-semibold`}>{formatRecordedMoney(Number(payment.amount || 0), payment.currency || "EUR", localeHtmlLang[locale])}</td>
                    <td className={`${cellClass} text-right`}><RequestStatus status={payment.status} fallback={localizedStatus(payment.status, locale)} locale={locale} /></td>
                  </tr>;
                })}</tbody>
              </table></div>}
            </PortalCard>
          </div>}

          {section === "statement" && <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <nav className="flex flex-wrap gap-2" aria-label={text.statementPeriod}>
                <div className="inline-flex rounded-lg border border-line bg-white p-1">{([["30", text.last30], ["90", text.last90], ["year", text.thisYear], ["all", text.allTime]] as const).map(([value, label]) => <Link key={value} href={`/dashboard/statement?range=${value}&dir=${direction}`} aria-current={range === value ? "page" : undefined} className={`rounded-md px-3 py-1.5 text-sm font-semibold ${range === value ? "bg-brand-soft text-brand" : "text-muted hover:text-ink"}`}>{label}</Link>)}</div>
                <div className="inline-flex rounded-lg border border-line bg-white p-1">{([["all", text.all], ["credit", text.credits], ["debit", text.debits]] as const).map(([value, label]) => <Link key={value} href={`/dashboard/statement?range=${range}&dir=${value}`} aria-current={direction === value ? "page" : undefined} className={`rounded-md px-3 py-1.5 text-sm font-semibold ${direction === value ? "bg-brand-soft text-brand" : "text-muted hover:text-ink"}`}>{label}</Link>)}</div>
              </nav>
              <div className="flex flex-wrap gap-2"><a href={`/api/statements?format=csv&range=${range}&dir=${direction}`} className={secondaryButton}><FileSpreadsheet size={16} aria-hidden="true" />{text.exportCsv}</a><a href={`/api/statements?format=pdf&range=${range}&dir=${direction}`} className={primaryButton}><Download size={16} aria-hidden="true" />{text.exportPdf}</a></div>
            </div>
            {!statement ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{copy.requestError}</p> : <>
              <dl className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
                {[[text.openingBalance, statement.opening], [text.totalCredits, statement.rows.filter((row) => row.direction === "credit").reduce((sum, row) => sum + row.amount, 0)], [text.totalDebits, statement.rows.filter((row) => row.direction === "debit").reduce((sum, row) => sum + row.amount, 0)], [text.closingBalance, statement.closing]].map(([label, value]) => <div key={String(label)} className="rounded-xl border border-line bg-white p-4 sm:p-5"><dt className="text-[13px] font-medium text-muted">{label}</dt><dd className="mt-2 text-[21px] font-semibold tracking-tight sm:text-[24px]">{formatRecordedMoney(Number(value), "EUR", localeHtmlLang[locale])}</dd></div>)}
              </dl>
              <PortalCard title={text.statementTitle}>
                {!statement.rows.length ? <EmptyState text={text.noTransactions} /> : <div className="overflow-x-auto"><table className={`${tableClass} min-w-[820px]`}>
                  <thead><tr><th scope="col" className={headCellClass}>{text.date}</th><th scope="col" className={headCellClass}>{text.description}</th><th scope="col" className={headCellClass}>{text.property}</th><th scope="col" className={`${headCellClass} text-right`}>{text.credit}</th><th scope="col" className={`${headCellClass} text-right`}>{text.debit}</th><th scope="col" className={`${headCellClass} text-right`}>{text.balance}</th></tr></thead>
                  <tbody>{statement.rows.map((row) => <tr key={row.id}>
                    <td className={`${cellClass} whitespace-nowrap text-muted`}>{formatDate(row.created_at, locale)}</td>
                    <td className={cellClass}><p className="font-semibold">{text.transactionType[row.kind]}</p>{row.shares ? <p className="text-xs text-muted">{row.shares} {text.shares}</p> : null}{row.kind === "purchase" && <a href={`/api/statements/purchase/${row.id}`} className="mt-0.5 inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline"><Download size={12} aria-hidden="true" />{text.purchaseConfirmation}</a>}</td>
                    <td className={cellClass}>{row.property_slug ? propertyTitles[row.property_slug] || row.property_slug : "—"}</td>
                    <td className={`${numberCellClass} text-emerald-700`}>{row.direction === "credit" ? `+${formatRecordedMoney(row.amount, "EUR", localeHtmlLang[locale])}` : ""}</td>
                    <td className={numberCellClass}>{row.direction === "debit" ? `−${formatRecordedMoney(row.amount, "EUR", localeHtmlLang[locale])}` : ""}</td>
                    <td className={`${numberCellClass} font-semibold`}>{formatRecordedMoney(row.balance, "EUR", localeHtmlLang[locale])}</td>
                  </tr>)}</tbody>
                </table></div>}
              </PortalCard>
            </>}
          </div>}

          {section === "documents" && <div className="grid max-w-6xl gap-5 lg:grid-cols-2">
            <PortalCard title={text.agreementDocument}>
              <ul className="divide-y divide-line">
                <DocumentRow label={text.agreementDocument} href={documentAcceptance?.signed_pdf_sha256 ? `/api/client-agreements/${documentAcceptance.id}/signed` : null} action={text.download} missing={text.notAvailable} />
                <DocumentRow label={text.agreementReceipt} href={documentAcceptance ? `/api/client-agreements/${documentAcceptance.id}/receipt` : null} action={text.view} missing={text.notAvailable} />
              </ul>
            </PortalCard>
            <PortalCard title={text.statementSection}>
              <ul className="divide-y divide-line">
                <DocumentRow label={`${text.statementCurrentYear.replace("{year}", String(new Date().getUTCFullYear()))} (PDF)`} href="/api/statements?format=pdf&range=year" action={text.download} missing={text.notAvailable} />
                <DocumentRow label={`${text.statementCurrentYear.replace("{year}", String(new Date().getUTCFullYear()))} (CSV)`} href="/api/statements?format=csv&range=year" action={text.download} missing={text.notAvailable} />
                <DocumentRow label={text.openStatement} href="/dashboard/statement" action={text.view} missing={text.notAvailable} internal />
              </ul>
            </PortalCard>
            <PortalCard title={text.purchases} className="lg:col-span-2">
              {!(ledger || []).some((row) => row.type === "purchase") ? <EmptyState text={text.noPurchases} /> : <ul className="divide-y divide-line">{(ledger || []).filter((row) => row.type === "purchase").reverse().map((row) => <DocumentRow key={row.id} label={`${formatDate(row.created_at, locale)} · ${row.property_slug ? propertyTitles[row.property_slug] || row.property_slug : ""} · ${row.shares} ${text.shares}`} href={`/api/statements/purchase/${row.id}`} action={text.purchaseConfirmation} missing={text.notAvailable} />)}</ul>}
            </PortalCard>
            <PortalCard title={text.identityDocuments} action={<KycStatus status={kycLatest?.status} text={text} />}>
              <div className="px-5 py-4 text-sm text-muted">{kycLatest?.status === "approved" ? text.kycApproved : kycLatest?.status === "pending" ? text.kycPending : <Link href="/dashboard/account#identity" className="font-semibold text-brand hover:underline">{text.stepIdentity}</Link>}</div>
            </PortalCard>
          </div>}

          {section === "account" && <section className="grid max-w-6xl gap-5 lg:grid-cols-2">
            <PortalCard title={copy.profileTitle} action={<PortalActionButton action="profile" className={secondaryButton}><UserRound size={15} aria-hidden="true" />{copy.editProfile}</PortalActionButton>}>
              <div className="flex items-center gap-4 px-5 pt-5"><span className="flex h-14 w-14 items-center justify-center rounded-full bg-ink text-lg font-bold text-white">{initials}</span><div className="min-w-0"><p className="truncate text-lg font-bold">{fullName}</p><p className="truncate text-sm text-muted">{user.email}</p></div></div>
              <dl className="grid gap-x-6 gap-y-3 px-5 py-5 text-sm sm:grid-cols-2">
                <Fact label={copy.phone} value={profile.phone || copy.notProvided} />
                <Fact label={copy.country} value={profile.country || copy.notProvided} />
                <Fact label={copy.memberSince} value={formatDate(user.created_at, locale)} />
              </dl>
            </PortalCard>
            <AgreementPanel agreement={agreement} locale={locale} />
            <AgentPanel agent={assignedAgent} locale={locale} />
            <PortalCard id="identity" title={text.kycTitle} description={text.kycIntro} action={<KycStatus status={kycLatest?.status} text={text} />}>
              <div className="px-5 py-5">
                {kycLatest?.status === "approved" ? <p className="flex items-center gap-2 text-sm font-semibold text-emerald-700"><ShieldCheck size={18} aria-hidden="true" />{text.kycApproved}</p>
                  : kycLatest?.status === "pending" ? <p className="text-sm leading-6 text-muted">{text.kycPending} {text.submittedOn} {formatDate(kycLatest.created_at, locale)}.</p>
                  : <>{kycLatest?.status === "rejected" && <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-950"><p>{text.kycRejected}</p>{kycLatest.review_note && <p className="mt-1 text-xs"><strong>{text.reviewNote}:</strong> {kycLatest.review_note}</p>}</div>}<KycForm locale={locale} /></>}
              </div>
            </PortalCard>
            <PortalCard title={nav.moreTitle}>
              <ul className="divide-y divide-line">
                {([["/dashboard/documents", nav.documents], ["/dashboard/statement", nav.statement], ["/insights", nav.learn], ["/risk", nav.risk], ["/verify-agent", nav.verifyAgent], ["/about", nav.about]] as const).map(([href, label]) => <li key={href}>
                  <Link href={href} className="flex items-center justify-between gap-3 px-5 py-3.5 text-sm font-semibold text-ink hover:bg-canvas hover:text-brand">{label}<ArrowRight size={15} aria-hidden="true" className="text-muted" /></Link>
                </li>)}
              </ul>
            </PortalCard>
            <PortalCard title={copy.securityTitle}>
              <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-5"><p className="flex max-w-md items-start gap-3 text-sm leading-6 text-muted"><KeyRound size={18} className="mt-0.5 shrink-0 text-brand" aria-hidden="true" />{copy.securityText}</p><Link href="/update-password" className={secondaryButton}>{copy.changePassword}</Link></div>
            </PortalCard>
          </section>}
        </div>
      </div>
    </main>
  );
}

const primaryButton = primaryButtonClass;
const secondaryButton = secondaryButtonClass;

function KycStatus({ status, text }: { status: string | null | undefined; text: PortalCopy }) {
  const [label, tone] = status === "approved" ? [text.kycStatusApproved, "bg-emerald-50 text-emerald-700"] : status === "pending" ? [text.kycStatusPending, "bg-amber-50 text-amber-800"] : status === "rejected" ? [text.kycStatusRejected, "bg-red-50 text-red-700"] : [text.kycNotStarted, "bg-canvas text-muted"];
  return <span className={`rounded-full px-3 py-1 text-xs font-semibold ${tone}`}>{label}</span>;
}

function DocumentRow({ label, href, action, missing, internal = false }: { label: string; href: string | null; action: string; missing: string; internal?: boolean }) {
  return <li className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
    <span className="flex min-w-0 items-center gap-3 text-sm font-medium"><FileText size={17} className="shrink-0 text-muted" aria-hidden="true" /><span className="min-w-0 break-words">{label}</span></span>
    {!href ? <span className="text-xs text-muted">{missing}</span> : internal ? <Link href={href} className="text-sm font-semibold text-brand hover:underline">{action}</Link> : <a href={href} className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand hover:underline"><Download size={14} aria-hidden="true" />{action}</a>}
  </li>;
}

function Fact({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</dt><dd className="mt-0.5 font-medium">{value}</dd></div>;
}

function AgreementPanel({ agreement, locale }: { agreement: Awaited<ReturnType<typeof loadClientAgreement>> | null; locale: Locale }) {
  const text = agreementCopy(locale);
  const acceptance = agreement?.acceptance;
  const signed = acceptance?.status === "pending" || acceptance?.status === "approved";
  const status = !agreement ? text.unavailable : signed ? text.signed : acceptance ? text.rejected : text.required;
  const tone = signed ? "bg-emerald-50 text-emerald-700" : acceptance || !agreement ? "bg-amber-50 text-amber-800" : "bg-blue-50 text-brand";
  const link = "inline-flex min-h-9 items-center gap-2 rounded-lg border border-line bg-white px-3 text-sm font-semibold text-ink hover:bg-canvas";
  return <PortalCard title={text.title} action={<span className={`rounded-full px-3 py-1 text-xs font-semibold ${tone}`}>{status}</span>}>
    <div className="px-5 py-5 text-sm">
      {acceptance ? <p className="text-muted">{text.acceptedAt}: <span className="font-medium text-ink">{new Intl.DateTimeFormat(localeHtmlLang[locale], { dateStyle: "medium", timeStyle: "short" }).format(new Date(acceptance.accepted_at))}</span> · {acceptance.signer_name}</p>
        : <p className="leading-6 text-muted">{text.introduction}</p>}
      {acceptance?.status === "rejected" && <p className="mt-2 leading-6">{text.rejectedDescription}</p>}
      <div className="mt-4 flex flex-wrap gap-2">
        {acceptance?.signed_pdf_sha256 && <a href={`/api/client-agreements/${acceptance.id}/signed`} className={primaryButton}><Download size={15} aria-hidden="true" />{text.signedPdf}</a>}
        {acceptance && <a href={`/api/client-agreements/${acceptance.id}/receipt`} target="_blank" rel="noopener noreferrer" className={link}><FileCheck2 size={15} aria-hidden="true" />{text.receipt}</a>}
        {agreement && <a href={acceptance?.document_path || agreement.document.path} target="_blank" rel="noopener noreferrer" className={link}><FileText size={15} aria-hidden="true" />{text.document}</a>}
        {agreement && !acceptance && <PortalActionButton action="profile" className={primaryButton}>{text.accept}<ArrowRight size={15} aria-hidden="true" /></PortalActionButton>}
      </div>
    </div>
  </PortalCard>;
}

type AssignedAgent = { code: string; full_name: string; title: string; email: string | null; phone: string | null; languages: string[] };

function AgentPanel({ agent, locale }: { agent: AssignedAgent | null; locale: Locale }) {
  const text = agentCopy[locale];
  const initials = agent?.full_name.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
  return <PortalCard title={text.yourAgent} description={text.yourAgentIntro} action={<Link href={agent ? `/verify-agent?code=${agent.code}` : "/verify-agent"} className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand hover:underline"><BadgeCheck size={15} aria-hidden="true" />{text.verifyLink}</Link>}>
    <div className="grid gap-4 px-5 py-5 text-sm">
      {agent ? <>
        <div className="flex items-center gap-4"><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-soft text-base font-bold text-brand">{initials}</span>
          <div className="min-w-0"><p className="truncate text-base font-bold">{agent.full_name}</p><p className="text-muted">{agent.title === "Brickwise agent" ? text.defaultTitle : agent.title} · <span className="font-mono text-xs font-semibold text-ink">{agent.code}</span></p></div></div>
        <div className="grid gap-1.5">
          {agent.email && <a href={`mailto:${agent.email}`} className="inline-flex items-center gap-2 break-all font-medium hover:text-brand"><Mail size={15} className="shrink-0 text-muted" aria-hidden="true" />{agent.email}</a>}
          {agent.phone && <a href={`https://wa.me/${agent.phone.replace(/^\+/, "")}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 font-medium hover:text-brand"><MessageCircle size={15} className="shrink-0 text-muted" aria-hidden="true" />WhatsApp {agent.phone}</a>}
          {agent.languages.length > 0 && <p className="text-muted">{text.languagesLabel}: {agent.languages.map((language) => text.languageNames[language as keyof typeof text.languageNames] || language).join(", ")}</p>}
        </div>
      </> : <p className="leading-6 text-muted">{text.noAgent} <a href={`mailto:${company.email}`} className="font-semibold text-brand hover:underline">{company.email}</a></p>}
      <p className="flex items-start gap-2 rounded-lg bg-canvas px-3 py-2.5 text-xs leading-5 text-muted"><ShieldCheck size={15} className="mt-0.5 shrink-0 text-emerald-600" aria-hidden="true" />{text.safety}</p>
    </div>
  </PortalCard>;
}

function PurchaseRequestRow({ request, copy, locale }: { request: RequestItem; copy: DashboardCopy; locale: Locale }) {
  return <li className="grid gap-3 px-5 py-4 sm:grid-cols-[minmax(0,1.6fr)_repeat(3,minmax(0,1fr))_auto] sm:items-center">
    <div><p className="font-semibold">{messageValue(request.message, "Property") || copy.properties}</p><p className="mt-0.5 text-xs text-muted">{formatDate(request.created_at, locale)}</p></div>
    <RequestValue label={copy.card.shares} value={messageValue(request.message, "Shares") || "-"} />
    <RequestValue label={copy.card.amount} value={messageValue(request.message, "Total amount") || "-"} />
    <RequestValue label={copy.card.payment} value={localizedPayment(messageValue(request.message, "Payment method"), locale)} />
    <div className="sm:justify-self-end"><RequestStatus status={request.status} fallback={copy.pendingAgent} locale={locale} /></div>
  </li>;
}

function EmptyState({ text }: { text: string }) {
  return <p className="px-5 py-8 text-center text-sm text-muted">{text}</p>;
}

function RequestValue({ label, value }: { label: string; value: string }) {
  return <div><p className="text-xs text-muted">{label}</p><p className="mt-0.5 text-sm font-semibold">{value}</p></div>;
}

function RequestStatus({ status, fallback, locale }: { status: string | null; fallback: string; locale: Locale }) {
  const normalized = status?.toLowerCase() || "new";
  const resolved = normalized === "new" ? fallback : localizedStatus(status, locale, fallback);
  const tone = ["completed", "approved", "verified", "paid"].includes(normalized)
    ? "bg-emerald-50 text-emerald-700"
    : ["cancelled", "rejected", "failed"].includes(normalized)
      ? "bg-red-50 text-red-700"
      : "bg-brand-soft text-brand";
  return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${tone}`}>{resolved}</span>;
}
