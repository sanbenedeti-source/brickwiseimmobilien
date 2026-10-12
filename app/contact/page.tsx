import { formatPropertyPercent, localizedPayment, propertyUiCopy } from "../properties/property-ui-copy";
import { createTranslator } from "../lib/translate";
import { minimumInvestmentShares, MINIMUM_INVESTMENT_EUR } from "../lib/investment-policy";
import { formatPropertyMoney, getPropertyCurrency, getPropertyProjection, getPropertyReturnBreakdown, getPropertyTargetReturn } from "../lib/property-financials";
import { investmentCopy } from "../lib/investment-copy";
import { targetReturnCopy } from "../lib/target-return-copy";
import { getPropertyTranslations } from "../lib/property-localization";
import { company } from "@/app/lib/company";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/auth";
import ClientPortalSidebar from "@/app/components/ClientPortalSidebar";
import { createContactRequest } from "./actions";
import { getExternalPropertyBySlug } from "../lib/external-properties";
import { type Locale } from "../lib/i18n";
import { getCurrentLocale } from "@/app/lib/server-locale";

type KontaktPageProps = {
  searchParams: Promise<{
    error?: string;
    auszahlung?: string;
    betrag?: string;
    projekt?: string;
    shares?: string;
    payment?: string;
  }>;
};

function formatMoney(value: number, currency: "EUR", locale: Locale) {
  return formatPropertyMoney(value, currency, locale, 2);
}

function getInvestmentAmount(value: string | undefined) {
  if (!value) return null;

  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

type ContactCopy = {
  backHome: string;
  title: string;
  intro: string;
  sendMessage: string;
  selectedProperty: string;
  locationMissing: string;
  requestedAmount: string;
  payout: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  topic: string;
  topics: string[];
  message: string;
  messagePlaceholder: string;
  defaultMessage: (title: string, amount: string, payout: string) => string;
  open: string;
  send: string;
  company: string;
  emailLabel: string;
  phoneLabel: string;
  whatsapp: string;
  hours: string;
  hoursValue: string;
  fastAccess: string;
  fastAccessText: string;
  createProfile: string;
};

const contactCopy: Record<string, ContactCopy> = {
  en: {
    backHome: "Back to home",
    title: "Contact BRICKWISE",
    intro:
      "Ask about cross-border property access, rental participation models, or project information. The team will respond with the next steps.",
    sendMessage: "Send a message",
    selectedProperty: "Selected property",
    locationMissing: "Location not provided",
    requestedAmount: "Requested amount",
    payout: "Payout",
    firstName: "First name",
    lastName: "Last name",
    email: "Email address",
    phone: "Phone number",
    topic: "Topic",
    topics: [
      "Rental share interest",
      "Property information",
      "Investment request",
      "Login / account",
      "General question",
    ],
    message: "Message",
    messagePlaceholder: "Your message...",
    defaultMessage: (title, amount, payout) =>
      `I am interested in rental participation for "${title}" and would like more information.\n\nRequested amount: ${amount}\nPreferred payout: ${payout}`,
    open: "open",
    send: "Send message",
    company: "Company",
    emailLabel: "Email",
    phoneLabel: "Phone",
    whatsapp: "Message on WhatsApp",
    hours: "Hours",
    hoursValue: "Monday to Friday\n09:00 - 18:00 Central European Time",
    fastAccess: "Fast property access",
    fastAccessText:
      "Create a profile to review project information and available cross-border property opportunities.",
    createProfile: "Create profile",
  },
  de: {
    backHome: "Zur Startseite",
    title: "Kontakt zu BRICKWISE",
    intro:
      "Fragen Sie internationale Immobilien, Mietbeteiligungsmodelle oder Projektinformationen an. Das Team meldet sich mit den nächsten Schritten.",
    sendMessage: "Nachricht senden",
    selectedProperty: "Ausgewählte Immobilie",
    locationMissing: "Standort nicht angegeben",
    requestedAmount: "Angefragter Betrag",
    payout: "Auszahlung",
    firstName: "Vorname",
    lastName: "Nachname",
    email: "E-Mail-Adresse",
    phone: "Telefonnummer",
    topic: "Thema",
    topics: [
      "Interesse an Mietbeteiligung",
      "Immobilieninformation",
      "Investitionsanfrage",
      "Login / Konto",
      "Allgemeine Frage",
    ],
    message: "Nachricht",
    messagePlaceholder: "Ihre Nachricht...",
    defaultMessage: (title, amount, payout) =>
      `Ich interessiere mich für eine Mietbeteiligung an "${title}" und möchte weitere Informationen.\n\nAngefragter Betrag: ${amount}\nBevorzugte Auszahlung: ${payout}`,
    open: "offen",
    send: "Nachricht senden",
    company: "Unternehmen",
    emailLabel: "E-Mail",
    phoneLabel: "Telefon",
    whatsapp: "WhatsApp Nachricht",
    hours: "Zeiten",
    hoursValue: "Montag bis Freitag\n09:00 - 18:00 Mitteleuropäische Zeit",
    fastAccess: "Schneller Immobilienzugang",
    fastAccessText:
      "Erstellen Sie ein Profil, um Projektinformationen und internationale Immobilienchancen zu prüfen.",
    createProfile: "Profil erstellen",
  },
  fr: { ...({} as ContactCopy), backHome: "Retour à l'accueil", title: "Contacter BRICKWISE", intro: "Posez vos questions sur l'accès immobilier international, les modèles de participation locative ou les projets. Notre équipe vous indiquera les prochaines étapes.", sendMessage: "Envoyer un message", selectedProperty: "Bien sélectionné", locationMissing: "Emplacement non indiqué", requestedAmount: "Montant demandé", payout: "Versement", firstName: "Prénom", lastName: "Nom", email: "Adresse e-mail", phone: "Téléphone", topic: "Sujet", topics: ["Intérêt pour une part locative", "Informations sur un bien", "Demande d'investissement", "Connexion / compte", "Question générale"], message: "Message", messagePlaceholder: "Votre message...", defaultMessage: (title, amount, payout) => `Je souhaite obtenir plus d'informations sur la participation locative de « ${title} ».\n\nMontant demande : ${amount}\nVersement préféré : ${payout}`, open: "ouvert", send: "Envoyer le message", company: "Entreprise", emailLabel: "E-mail", phoneLabel: "Téléphone", whatsapp: "Message WhatsApp", hours: "Horaires", hoursValue: "Du lundi au vendredi\n09:00 - 18:00, heure d'Europe centrale", fastAccess: "Accès rapide aux biens", fastAccessText: "Créez un profil pour consulter les projets et les opportunités immobilières internationales.", createProfile: "Créer un profil" },
  es: { ...({} as ContactCopy), backHome: "Volver al inicio", title: "Contacta con BRICKWISE", intro: "Pregunta sobre acceso inmobiliario internacional, modelos de participación en alquiler o información de proyectos. El equipo responderá con los siguientes pasos.", sendMessage: "Enviar un mensaje", selectedProperty: "Propiedad seleccionada", locationMissing: "Ubicación no indicada", requestedAmount: "Importe solicitado", payout: "Pago", firstName: "Nombre", lastName: "Apellidos", email: "Correo electrónico", phone: "Teléfono", topic: "Asunto", topics: ["Interés en participación de alquiler", "Información de propiedad", "Solicitud de inversión", "Acceso / cuenta", "Pregunta general"], message: "Mensaje", messagePlaceholder: "Tu mensaje...", defaultMessage: (title, amount, payout) => `Me interesa la participación de alquiler de «${title}» y deseo más información.\n\nImporte solicitado: ${amount}\nPago preferido: ${payout}`, open: "abierto", send: "Enviar mensaje", company: "Empresa", emailLabel: "Correo", phoneLabel: "Teléfono", whatsapp: "Mensaje por WhatsApp", hours: "Horario", hoursValue: "Lunes a viernes\n09:00 - 18:00, hora central europea", fastAccess: "Acceso rápido a propiedades", fastAccessText: "Crea un perfil para consultar proyectos y oportunidades inmobiliarias internacionales.", createProfile: "Crear perfil" },
  it: { ...({} as ContactCopy), backHome: "Torna alla home", title: "Contatta BRICKWISE", intro: "Chiedi informazioni sull'accesso immobiliare internazionale, sui modelli di partecipazione locativa o sui progetti. Il team risponderà con i prossimi passi.", sendMessage: "Invia un messaggio", selectedProperty: "Immobile selezionato", locationMissing: "Posizione non indicata", requestedAmount: "Importo richiesto", payout: "Pagamento", firstName: "Nome", lastName: "Cognome", email: "Indirizzo e-mail", phone: "Telefono", topic: "Argomento", topics: ["Interesse per quota locativa", "Informazioni immobile", "Richiesta di investimento", "Accesso / account", "Domanda generale"], message: "Messaggio", messagePlaceholder: "Il tuo messaggio...", defaultMessage: (title, amount, payout) => `Sono interessato alla partecipazione locativa di «${title}» e desidero maggiori informazioni.\n\nImporto richiesto: ${amount}\nPagamento preferito: ${payout}`, open: "aperto", send: "Invia messaggio", company: "Società", emailLabel: "E-mail", phoneLabel: "Telefono", whatsapp: "Messaggio WhatsApp", hours: "Orari", hoursValue: "Da lunedì a venerdì\n09:00 - 18:00, ora dell'Europa centrale", fastAccess: "Accesso rapido agli immobili", fastAccessText: "Crea un profilo per consultare progetti e opportunità immobiliari internazionali.", createProfile: "Crea profilo" },
  sq: {
    backHome: "Kthehu ne kryefaqe",
    title: "Kontakto BRICKWISE",
    intro:
      "Pyet per akses ne prona nderkombetare, modele pjesemarrjeje ne qira ose informacion projekti. Ekipi do te pergjigjet me hapat tjere.",
    sendMessage: "Dergo mesazh",
    selectedProperty: "Prona e zgjedhur",
    locationMissing: "Lokacioni mungon",
    requestedAmount: "Shuma e kerkuar",
    payout: "Pagesa",
    firstName: "Emri",
    lastName: "Mbiemri",
    email: "Email",
    phone: "Telefoni",
    topic: "Tema",
    topics: [
      "Interes per pjese qiraje",
      "Informacion prone",
      "Kerkese investimi",
      "Login / llogari",
      "Pyetje e pergjithshme",
    ],
    message: "Mesazhi",
    messagePlaceholder: "Mesazhi yt...",
    defaultMessage: (title, amount, payout) =>
      `Jam i/e interesuar per pjesemarrje ne qira per "${title}" dhe dua me shume informacion.\n\nShuma e kerkuar: ${amount}\nPagesa e preferuar: ${payout}`,
    open: "e hapur",
    send: "Dergo mesazhin",
    company: "Kompania",
    emailLabel: "Email",
    phoneLabel: "Telefon",
    whatsapp: "Mesazh ne WhatsApp",
    hours: "Orari",
    hoursValue: "E hene deri te premten\n09:00 - 18:00 Koha e Evropes Qendrore",
    fastAccess: "Akses i shpejte ne prona",
    fastAccessText:
      "Krijo profil per te pare informacion projektesh dhe mundesi pronash nderkombetare.",
    createProfile: "Krijo profil",
  },
};



export default async function KontaktPage({ searchParams }: KontaktPageProps) {
  const locale = await getCurrentLocale();
  const copy = contactCopy[locale];
  const ui = propertyUiCopy[locale];
  const t = createTranslator(locale);
  const { error: requestError, auszahlung, betrag, projekt, shares, payment } = await searchParams;
  const externalProperty = projekt ? getExternalPropertyBySlug(projekt) : null;
  const returnBreakdown = externalProperty ? getPropertyReturnBreakdown(externalProperty) : undefined;
  const hasTargetReturn = externalProperty?.targetTotalReturn !== undefined || Boolean(returnBreakdown);
  const returnCopy = targetReturnCopy[locale];
  const returnNote = returnBreakdown ? returnCopy.modelNote : returnCopy.configuredTargetNote;
  const currency = externalProperty ? getPropertyCurrency(externalProperty) : "EUR";
  const minimumShares = externalProperty ? minimumInvestmentShares(externalProperty.sharePrice, MINIMUM_INVESTMENT_EUR) : null;
  const requestedAmount = getInvestmentAmount(betrag);
  const payoutLabel = auszahlung === "annual" ? ui.annual : ui.monthly;
  const parsedShares = Number(shares);
  const shareQuantity = externalProperty && (requestedAmount !== null || shares) && minimumShares !== null
    ? Math.max(minimumShares, Number.isSafeInteger(parsedShares) && parsedShares > 0 ? parsedShares : Math.ceil((requestedAmount || 0) / externalProperty.sharePrice)) : null;
  const projection = externalProperty && shareQuantity ? getPropertyProjection(externalProperty, shareQuantity) : null;
  const investmentAmount = projection?.amount ?? null;
  const paymentLabel = localizedPayment(payment, locale, ui.bank);

  const supabase = await createClient();
  const user = await getCurrentUser();

  const { data: databaseProperty } = projekt && !externalProperty
    ? await supabase
        .from("properties")
        .select("id, title, city, slug, price")
        .eq("slug", projekt)
        .single()
    : { data: null };

  const baseProperty = externalProperty || databaseProperty;
  const translatedProperty = projekt ? (await getPropertyTranslations(locale)).get(projekt) : null;
  const property = baseProperty && translatedProperty ? { ...baseProperty, title: translatedProperty.title } : baseProperty;
  const fullName = String(user?.user_metadata?.full_name || "").trim();
  const portalName = fullName || user?.email?.split("@")[0] || ui.client;
  const [firstName = "", ...lastNameParts] = fullName.split(/\s+/).filter(Boolean);
  const lastName = lastNameParts.join(" ");
  const defaultMessage = property
    ? hasTargetReturn && externalProperty
      ? [
          `${copy.selectedProperty}: ${property.title}`,
          `${copy.requestedAmount}: ${investmentAmount ? formatMoney(investmentAmount, currency, locale) : copy.open}`,
          ...(shareQuantity ? [`${investmentCopy[locale].shares}: ${shareQuantity}`] : []),
          `${returnCopy.targetTotalReturn}: ${formatPropertyPercent(getPropertyTargetReturn(externalProperty), locale)}`,
          ...(projection ? [
            `${returnCopy.annualTarget}: ${formatMoney(projection.annual, currency, locale)}`,
            `${returnCopy.monthlyTarget}: ${formatMoney(projection.monthly, currency, locale)}`,
          ] : []),
          ...(returnBreakdown ? [
            `${returnCopy.rental}: ${formatPropertyPercent(returnBreakdown.rental, locale)}`,
            `${returnCopy.vacationPoint}: ${formatPropertyPercent(returnBreakdown.vacationPoint, locale)}`,
            `${returnCopy.appreciation}: ${formatPropertyPercent(returnBreakdown.appreciation, locale)}`,
          ] : []),
          "",
          returnNote,
          `${investmentCopy[locale].payment}: ${paymentLabel}`,
        ].join("\n")
      : `${copy.defaultMessage(property.title, investmentAmount ? formatMoney(investmentAmount, currency, locale) : copy.open, payoutLabel)}${shareQuantity ? `\n${investmentCopy[locale].shares}: ${shareQuantity}` : ""}\n${investmentCopy[locale].payment}: ${paymentLabel}`
    : "";

  return (
    <>
      {user?.email && (
        <ClientPortalSidebar active="contact" email={user.email} fullName={portalName} locale={locale} />
      )}
      <main className={`min-h-screen bg-[#f5f5f2] text-[#111111] ${user?.email ? "pt-16 lg:ml-[282px] lg:pt-0" : ""}`}>
      <section className="bg-[#0F172A] px-6 pb-20 pt-36 text-white">
        <div className="mx-auto max-w-7xl">
          <Link href="/" className="text-sm font-bold text-white/70">
            {copy.backHome}
          </Link>

          <h1 className="font-display mt-10 max-w-4xl text-6xl font-bold leading-none md:text-7xl">
            {copy.title}
          </h1>

          <p className="mt-8 max-w-3xl text-xl leading-relaxed text-white/75">
            {copy.intro}
          </p>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-10 px-6 py-20 md:grid-cols-[1fr_0.8fr]">
        <div className="rounded-[32px] bg-white p-8 shadow-xl">
          <h2 className="text-5xl font-bold">{copy.sendMessage}</h2>

          {property && (
            <div className="mt-8 rounded-2xl bg-emerald-50 p-5 text-emerald-900">
              <p className="text-sm font-bold uppercase tracking-wide">
                {copy.selectedProperty}
              </p>

              <h3 className="mt-2 text-2xl font-bold">{property.title}</h3>

              <p className="mt-1 text-lg">
                {property.city || copy.locationMissing}
                {property.price ? ` - ${formatMoney(Number(property.price), currency, locale)}` : ""}
              </p>

              {investmentAmount && (
                <p className="mt-3 text-lg font-bold">
                  {copy.requestedAmount}: {formatMoney(investmentAmount, currency, locale)}{!hasTargetReturn && <> - {copy.payout} {payoutLabel}</>}
                </p>
              )}
              {hasTargetReturn && externalProperty && <p className="mt-3 text-sm">{returnCopy.targetTotalReturn}: {formatPropertyPercent(getPropertyTargetReturn(externalProperty), locale)}. {returnNote}</p>}
              {projection && <div className="mt-3 grid gap-2 text-sm"><p>{returnCopy.annualTarget}: {formatMoney(projection.annual, currency, locale)}</p><p>{returnCopy.monthlyTarget}: {formatMoney(projection.monthly, currency, locale)}</p></div>}
              {returnBreakdown && <p className="mt-2 text-sm">{returnCopy.rental}: {formatPropertyPercent(returnBreakdown.rental, locale)} · {returnCopy.vacationPoint}: {formatPropertyPercent(returnBreakdown.vacationPoint, locale)} · {returnCopy.appreciation}: {formatPropertyPercent(returnBreakdown.appreciation, locale)}</p>}
            </div>
          )}

          {requestError && <p role="alert" className="mt-6 rounded-xl bg-red-50 p-4 text-red-700">{requestError === "investment" ? investmentCopy[locale].unavailable : t(requestError === "invalid" ? "Please check your input." : "Your request could not be saved. Please try again.")}</p>}
          <form action={createContactRequest} className="mt-10 grid gap-5">
            {externalProperty && shareQuantity !== null && <><input type="hidden" name="investment_slug" value={externalProperty.slug} /><input type="hidden" name="investment_shares" value={shareQuantity} /></>}
            <input type="hidden" name="property_id" value={databaseProperty?.id || ""} />
            <input
              type="text"
              name="company"
              tabIndex={-1}
              autoComplete="off"
              className="hidden"
              aria-hidden="true"
            />

            <div className="grid gap-5 md:grid-cols-2">
              <Field label={copy.firstName} name="first_name" placeholder="Alex" defaultValue={firstName} required />
              <Field label={copy.lastName} name="last_name" placeholder="Morgan" defaultValue={lastName} required />
            </div>

            <Field label={copy.email} name="email" type="email" placeholder="name@email.com" defaultValue={user?.email || ""} required />
            <Field label={copy.phone} name="phone" type="tel" placeholder="+49 30 123456" />

            <div>
              <label htmlFor="contact-topic" className="text-sm font-bold text-slate-600">{copy.topic}</label>
              <select
                id="contact-topic" name="topic"
                defaultValue={property ? copy.topics[0] : copy.topics[1]}
                className="mt-2 w-full rounded-2xl border border-slate-200 px-5 py-4 text-lg outline-none focus:border-[#0F172A]"
              >
                {copy.topics.map((topic) => (
                  <option key={topic}>{topic}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="contact-message" className="text-sm font-bold text-slate-600">{copy.message}</label>
              <textarea
                id="contact-message" name="message"
                required
                defaultValue={defaultMessage}
                placeholder={copy.messagePlaceholder}
                rows={6}
                className="mt-2 w-full resize-none rounded-2xl border border-slate-200 px-5 py-4 text-lg outline-none focus:border-[#0F172A]"
              />
            </div>

            <button
              type="submit"
              className="rounded-2xl bg-[#0F172A] py-4 text-lg font-bold text-white transition hover:bg-[#111827]"
            >
              {copy.send}
            </button>
          </form>
        </div>

        <div className="space-y-6">
          <div className="rounded-[32px] bg-white p-8 shadow-sm">
            <h2 className="text-4xl font-bold">BRICKWISE</h2>

            <div className="mt-8 space-y-5 text-lg text-slate-600">
              <p>
                <strong className="text-[#111111]">{copy.company}:</strong>
                <br />
                {company.legalName}
                <br />
                <a href={company.europeanMapUrl} target="_blank" rel="noreferrer" className="underline">
                  {company.europeanStreet}<br />{company.europeanLocality}
                </a>
              </p>

              <p>
                <strong className="text-[#111111]">{copy.emailLabel}:</strong>
                <br />
                <a href={`mailto:${company.email}`}>{company.email}</a>
              </p>

              <p>
                <strong className="text-[#111111]">{copy.phoneLabel}:</strong>
                <br />
                <a href={`tel:${company.phone}`}>{company.phoneDisplay}</a>
              </p>

              <p>
                <a
                  href={`https://wa.me/${company.phone.slice(1)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex rounded-2xl bg-[#25D366] px-6 py-3 font-bold text-white"
                >
                  {copy.whatsapp}
                </a>
              </p>

              <p>
                <strong className="text-[#111111]">{copy.hours}:</strong>
                <br />
                {copy.hoursValue.split("\n").map((line) => (
                  <span key={line}>
                    {line}
                    <br />
                  </span>
                ))}
              </p>
            </div>
          </div>

          <div className="rounded-[32px] bg-[#0F172A] p-8 text-white">
            <h3 className="text-4xl font-bold">{copy.fastAccess}</h3>

            <p className="mt-5 text-lg leading-relaxed text-white/75">
              {copy.fastAccessText}
            </p>

            <Link
              href="/join"
              className="mt-8 inline-block rounded-2xl bg-white px-8 py-4 text-lg font-bold text-[#0F172A]"
            >
              {copy.createProfile}
            </Link>
          </div>
        </div>
      </section>
      </main>
    </>
  );
}

function Field({
  label,
  name,
  placeholder,
  required = false,
  type = "text",
  defaultValue = "",
}: {
  label: string;
  name: string;
  placeholder: string;
  required?: boolean;
  type?: string;
  defaultValue?: string;
}) {
  return (
    <div>
      <label htmlFor={`contact-${name}`} className="text-sm font-bold text-slate-600">{label}</label>
      <input
        id={`contact-${name}`} name={name}
        type={type}
        required={required}
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="mt-2 w-full rounded-2xl border border-slate-200 px-5 py-4 text-lg outline-none focus:border-[#0F172A]"
      />
    </div>
  );
}
