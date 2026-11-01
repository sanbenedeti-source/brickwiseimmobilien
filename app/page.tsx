import HowItWorksVideo from "./components/HowItWorksVideo";
import Image from "next/image";
import { createTranslator } from "./lib/translate";
import { getPropertyTranslations, localizeProperty } from "./lib/property-localization";
import { formatMinimumInvestment } from "./lib/investment-policy";
import { formatPropertyMoney, getPropertyProjection, getPropertyReturnBreakdown, getPropertyShareSupply } from "./lib/property-financials";
import { createClient } from "@/lib/supabase/server";
import { targetReturnCopy, rentalYieldLabel } from "./lib/target-return-copy";
import PropertyConstructionBadge from "./components/PropertyConstructionBadge";
import PropertyTierBadge from "./components/PropertyTierBadge";
import { cookies } from "next/headers";
import { formatPropertyPercent } from "./properties/property-ui-copy";
import Link from "next/link";
import {
  ArrowRight,
  Bath,
  BedDouble,
  BookOpenCheck,
  Building2,
  Check,
  CircleDollarSign,
  Globe2,
  HousePlus,
  Laptop,
  LockKeyhole,
  MapPin,
  Maximize2,
  PieChart,
  Plane,
  Rocket,
  Search,
  ShieldCheck,
  TrendingUp,
  UserPlus,
  WalletCards,
  Wrench,
  Zap,
} from "lucide-react";
import { getListedProperties } from "./lib/property-registry";
import {
  defaultLocale,
  Locale,
  localeCookieName,
  normalizeLocale,
} from "./lib/i18n";

type HomeCopy = {
  heroTop: string;
  heroBottom: string;
  heroAmount: string;
  heroText: string;
  free: string;
  how: string;
  trusted: string;
  propertiesKicker: string;
  propertiesTitle: string;
  primary: string;
  available: string;
  yield: string;
  viewProperties: string;
  easyTitle: string;
  easyPoints: string[];
  benefitCards: { title: string; text: string }[];
  investTitle: string;
  steps: { title: string; text: string }[];
  simpleTitle: string;
  simpleItems: { title: string; text: string }[];
  apartTitle: string;
  features: { title: string; text: string }[];
  ctaTitle: string;
  ctaText: string;
  ctaButton: string;
};

const en: HomeCopy = {
  heroTop: "Invest in real estate",
  heroBottom: "from as little as",
  heroAmount: "{minimum}",
  heroText: "Build a property portfolio with transparent project data, rental assumptions, and professional support.",
  free: "Create your account",
  how: "See how Brickwise works",
  trusted: "Selected income-focused properties",
  propertiesKicker: "Start with the marketplace",
  propertiesTitle: "Explore investment opportunities",
  primary: "Primary",
  available: "Available shares",
  yield: "Net rental yield",
  viewProperties: "View all properties",
  easyTitle: "Brickwise makes property investing easier",
  easyPoints: ["Start from {minimum}", "Property information in one place", "Complete the process online"],
  benefitCards: [
    { title: "Fractional access", text: "Build exposure to real estate without purchasing an entire property." },
    { title: "Clear investment data", text: "Review property value, rent assumptions, yield, and project documents." },
    { title: "Income potential", text: "Compare income-focused opportunities across selected urban markets." },
    { title: "Professional support", text: "Follow a guided investor workflow from interest to documentation." },
  ],
  investTitle: "How to invest",
  steps: [
    { title: "Create an account", text: "Register securely and confirm your investor profile." },
    { title: "Browse properties", text: "Compare locations, values, rental assumptions, and risks." },
    { title: "Request access", text: "Choose an opportunity and submit your interest online." },
    { title: "Track progress", text: "Follow requests, payment instructions, and updates in your dashboard." },
  ],
  simpleTitle: "Real estate investing, simplified",
  simpleItems: [
    { title: "Lower entry point", text: "Start from {minimum} instead of financing an entire property." },
    { title: "Build gradually", text: "Add opportunities over time and compare different markets." },
    { title: "Invest with context", text: "Review the numbers, project structure, and risk notes first." },
    { title: "Less administration", text: "Use one digital workflow for requests, documents, and updates." },
  ],
  apartTitle: "What sets Brickwise apart",
  features: [
    { title: "Fractional participation", text: "Access selected real estate through smaller participation amounts." },
    { title: "Rental assumptions", text: "See the income model used for each listed opportunity." },
    { title: "Property value context", text: "Compare price, location, and rental yield." },
    { title: "Cross-border markets", text: "Explore selected opportunities in Canada and Cape Verde." },
    { title: "Clear entry amounts", text: "Know the minimum participation before requesting access." },
    { title: "Portfolio dashboard", text: "Keep property requests and payment instructions organized." },
    { title: "Digital workflow", text: "Move from discovery to investor readiness online." },
    { title: "Guided process", text: "Get practical support through each next step." },
    { title: "Secure account", text: "Use verified authentication and protected account access." },
  ],
  ctaTitle: "Ready to start your property portfolio?",
  ctaText: "Create your investor account and explore the current marketplace.",
  ctaButton: "Get started",
};

const de: HomeCopy = {
  ...en,
  heroTop: "In Immobilien investieren",
  heroBottom: "bereits ab",
  heroText: "Bauen Sie ein Immobilienportfolio mit klaren Projektdaten, Mietannahmen und professioneller Unterstützung auf.",
  free: "Konto erstellen",
  how: "So funktioniert Brickwise",
  trusted: "Ausgewählte ertragsorientierte Immobilien",
  propertiesKicker: "Zum Marktplatz",
  propertiesTitle: "Investitionschancen entdecken",
  primary: "Neu im Angebot",
  available: "Verfügbare Anteile",
  yield: "Nettomietrendite",
  viewProperties: "Alle Immobilien",
  easyTitle: "Brickwise macht Immobilien­investitionen einfacher",
  easyPoints: ["Ab {minimum} starten", "Immobilieninformationen an einem Ort", "Den gesamten Prozess online abschließen"],
  benefitCards: [
    { title: "Anteiliger Zugang", text: "Beteiligen Sie sich an Immobilien, ohne eine ganze Immobilie zu kaufen." },
    { title: "Klare Investitionsdaten", text: "Prüfen Sie Immobilienwert, Mietannahmen, Rendite und Projektdokumente." },
    { title: "Ertragspotenzial", text: "Vergleichen Sie ertragsorientierte Immobilien in ausgewählten Stadtmärkten." },
    { title: "Professionelle Unterstützung", text: "Folgen Sie einem geführten Anlegerprozess vom Interesse bis zur Dokumentation." },
  ],
  investTitle: "So investieren Sie",
  steps: [
    { title: "Konto erstellen", text: "Registrieren Sie sich sicher und bestätigen Sie Ihr Anlegerprofil." },
    { title: "Immobilien durchsuchen", text: "Vergleichen Sie Standorte, Werte, Mietannahmen und Risiken." },
    { title: "Zugang anfragen", text: "Wählen Sie eine Immobilie und bekunden Sie Ihr Interesse online." },
    { title: "Fortschritt verfolgen", text: "Verfolgen Sie Anfragen, Zahlungsanweisungen und Updates im Dashboard." },
  ],
  simpleTitle: "Immobilien­investitionen, vereinfacht",
  simpleItems: [
    { title: "Niedriger Einstieg", text: "Starten Sie ab {minimum}, statt eine ganze Immobilie zu finanzieren." },
    { title: "Schrittweise aufbauen", text: "Fügen Sie mit der Zeit Chancen hinzu und vergleichen Sie verschiedene Märkte." },
    { title: "Mit Kontext investieren", text: "Prüfen Sie zuerst Zahlen, Projektstruktur und Risikohinweise." },
    { title: "Weniger Verwaltung", text: "Nutzen Sie einen digitalen Ablauf für Anfragen, Dokumente und Updates." },
  ],
  apartTitle: "Was Brickwise unterscheidet",
  features: [
    { title: "Anteilige Beteiligung", text: "Zugang zu ausgewählten Immobilien mit kleineren Beteiligungsbeträgen." },
    { title: "Mietannahmen", text: "Sehen Sie das Ertragsmodell jeder angebotenen Immobilie." },
    { title: "Immobilienwert im Kontext", text: "Vergleichen Sie Preis, Standort und Mietrendite." },
    { title: "Grenzüberschreitende Märkte", text: "Entdecken Sie ausgewählte Chancen in Kanada und Kap Verde." },
    { title: "Klare Einstiegsbeträge", text: "Sie kennen die Mindestbeteiligung schon vor Ihrer Anfrage." },
    { title: "Portfolio-Dashboard", text: "Organisieren Sie Immobilienanfragen und Zahlungsanweisungen." },
    { title: "Digitaler Ablauf", text: "Vom ersten Interesse bis zur Investition – komplett online." },
    { title: "Geführter Prozess", text: "Erhalten Sie praktische Unterstützung bei jedem nächsten Schritt." },
    { title: "Sicheres Konto", text: "Nutzen Sie verifizierte Authentifizierung und geschützten Kontozugang." },
  ],
  ctaTitle: "Bereit für Ihr Immobilienportfolio?",
  ctaText: "Erstellen Sie Ihr Anlegerkonto und entdecken Sie den aktuellen Marktplatz.",
  ctaButton: "Jetzt starten",
};

const fr: HomeCopy = {
  heroTop: "Investissez dans l’immobilier",
  heroBottom: "à partir de seulement",
  heroAmount: "{minimum}",
  heroText: "Construisez un portefeuille immobilier avec des données de projet transparentes, des hypothèses locatives et un accompagnement professionnel.",
  free: "Créer votre compte", how: "Découvrir le fonctionnement de Brickwise", trusted: "Biens sélectionnés axés sur le revenu",
  propertiesKicker: "Commencez par nos biens", propertiesTitle: "Explorez les opportunités d’investissement", primary: "Nouvelle offre", available: "Parts disponibles", yield: "Rendement locatif net", viewProperties: "Voir tous les biens",
  easyTitle: "Brickwise simplifie l’investissement immobilier",
  easyPoints: ["Commencez dès {minimum}", "Toutes les informations au même endroit", "Réalisez le processus en ligne"],
  benefitCards: [
    { title: "Accès fractionné", text: "Exposez votre portefeuille à l’immobilier sans acheter un bien entier." },
    { title: "Données claires", text: "Consultez la valeur, les hypothèses locatives, le rendement et les documents du projet." },
    { title: "Potentiel de revenu", text: "Comparez des opportunités axées sur le revenu dans des marchés urbains sélectionnés." },
    { title: "Accompagnement professionnel", text: "Suivez un parcours guidé, de votre intérêt jusqu’à la documentation." },
  ],
  investTitle: "Comment investir",
  steps: [
    { title: "Créer un compte", text: "Inscrivez-vous en toute sécurité et confirmez votre profil investisseur." },
    { title: "Parcourir les biens", text: "Comparez les emplacements, valeurs, hypothèses locatives et risques." },
    { title: "Demander l’accès", text: "Choisissez une opportunité et envoyez votre demande en ligne." },
    { title: "Suivre l’avancement", text: "Suivez vos demandes, instructions de paiement et mises à jour dans votre espace." },
  ],
  simpleTitle: "L’investissement immobilier simplifié",
  simpleItems: [
    { title: "Ticket d’entrée réduit", text: "Commencez dès {minimum} au lieu de financer un bien entier." },
    { title: "Construisez progressivement", text: "Ajoutez des opportunités dans le temps et comparez plusieurs marchés." },
    { title: "Investissez en connaissance de cause", text: "Examinez d’abord les chiffres, la structure du projet et les risques." },
    { title: "Moins d’administration", text: "Utilisez un parcours numérique unique pour demandes, documents et mises à jour." },
  ],
  apartTitle: "Ce qui distingue Brickwise",
  features: [
    { title: "Participation fractionnée", text: "Accédez à des biens sélectionnés avec des montants plus accessibles." },
    { title: "Hypothèses locatives", text: "Consultez le modèle de revenu de chaque opportunité." },
    { title: "Valeur du bien en contexte", text: "Comparez prix, emplacement et rendement locatif." },
    { title: "Marchés internationaux", text: "Explorez des opportunités au Canada et au Cap-Vert." },
    { title: "Montants d’entrée clairs", text: "Connaissez la participation minimale avant votre demande." },
    { title: "Tableau de bord", text: "Organisez demandes immobilières et instructions de paiement." },
    { title: "Parcours numérique", text: "Passez en ligne de la découverte à la préparation de l’investissement." },
    { title: "Processus guidé", text: "Bénéficiez d’un soutien pratique à chaque étape." },
    { title: "Compte sécurisé", text: "Utilisez une authentification vérifiée et un accès protégé." },
  ],
  ctaTitle: "Prêt à construire votre portefeuille immobilier ?", ctaText: "Créez votre compte investisseur et découvrez les biens disponibles.", ctaButton: "Commencer",
};

const es: HomeCopy = {
  ...fr,
  heroTop: "Invierte en bienes inmuebles", heroBottom: "desde tan solo", heroText: "Crea una cartera inmobiliaria con datos transparentes, estimaciones de alquiler y apoyo profesional.",
  free: "Crea tu cuenta", how: "Descubre cómo funciona Brickwise", trusted: "Propiedades seleccionadas centradas en ingresos",
  propertiesKicker: "Empieza por nuestros inmuebles", propertiesTitle: "Explora oportunidades de inversión", primary: "Nueva oferta", available: "Participaciones disponibles", yield: "Rentabilidad neta del alquiler", viewProperties: "Ver todas las propiedades",
  easyTitle: "Brickwise facilita la inversión inmobiliaria", easyPoints: ["Empieza desde {minimum}", "Toda la información en un solo lugar", "Completa el proceso en línea"],
  benefitCards: [
    { title: "Acceso fraccionado", text: "Obtén exposición inmobiliaria sin comprar una propiedad completa." }, { title: "Datos claros", text: "Revisa el valor, las estimaciones de alquiler, la rentabilidad y los documentos." }, { title: "Potencial de ingresos", text: "Compara oportunidades centradas en ingresos en mercados urbanos seleccionados." }, { title: "Apoyo profesional", text: "Sigue un proceso guiado desde el interés hasta la documentación." },
  ],
  investTitle: "Cómo invertir", steps: [{ title: "Crea una cuenta", text: "Regístrate de forma segura y confirma tu perfil inversor." }, { title: "Explora propiedades", text: "Compara ubicaciones, valores, alquileres estimados y riesgos." }, { title: "Solicita acceso", text: "Elige una oportunidad y envía tu interés en línea." }, { title: "Sigue el progreso", text: "Consulta solicitudes, instrucciones de pago y novedades en tu panel." }],
  simpleTitle: "Inversión inmobiliaria simplificada", simpleItems: [{ title: "Entrada más baja", text: "Empieza desde {minimum} en vez de financiar una propiedad completa." }, { title: "Construye gradualmente", text: "Añade oportunidades con el tiempo y compara distintos mercados." }, { title: "Invierte con contexto", text: "Revisa primero las cifras, la estructura y los riesgos." }, { title: "Menos administración", text: "Usa un único proceso digital para solicitudes, documentos y novedades." }],
  apartTitle: "Lo que diferencia a Brickwise", features: [{ title: "Participación fraccionada", text: "Accede a inmuebles seleccionados con importes menores." }, { title: "Estimaciones de alquiler", text: "Consulta el modelo de ingresos de cada oportunidad." }, { title: "Valor en contexto", text: "Compara precio, ubicación y rentabilidad del alquiler." }, { title: "Mercados internacionales", text: "Explora oportunidades en Canadá y Cabo Verde." }, { title: "Importes claros", text: "Conoce la participación mínima antes de solicitar acceso." }, { title: "Panel de cartera", text: "Organiza solicitudes e instrucciones de pago." }, { title: "Proceso digital", text: "Avanza en línea desde el descubrimiento hasta estar listo para invertir." }, { title: "Proceso guiado", text: "Recibe apoyo práctico en cada paso." }, { title: "Cuenta segura", text: "Usa autenticación verificada y acceso protegido." }],
  ctaTitle: "¿Listo para crear tu cartera inmobiliaria?", ctaText: "Crea tu cuenta de inversor y descubre los inmuebles disponibles.", ctaButton: "Empezar",
};

const it: HomeCopy = {
  ...fr,
  heroTop: "Investi nel settore immobiliare", heroBottom: "a partire da", heroAmount: "{minimum}", heroText: "Costruisci un portafoglio immobiliare con dati trasparenti, ipotesi di affitto e supporto professionale.",
  free: "Crea il tuo account", how: "Scopri come funziona Brickwise", trusted: "Immobili selezionati orientati al reddito",
  propertiesKicker: "Inizia dai nostri immobili", propertiesTitle: "Esplora le opportunità di investimento", primary: "Nuova offerta", available: "Quote disponibili", yield: "Rendimento netto da affitto", viewProperties: "Vedi tutti gli immobili",
  easyTitle: "Brickwise semplifica l'investimento immobiliare", easyPoints: ["Inizia da {minimum}", "Informazioni immobiliari in un unico posto", "Completa il processo online"],
  benefitCards: [{ title: "Accesso frazionato", text: "Ottieni esposizione immobiliare senza acquistare un intero immobile." }, { title: "Dati chiari", text: "Esamina valore, ipotesi di affitto, rendimento e documenti del progetto." }, { title: "Potenziale di reddito", text: "Confronta opportunità orientate al reddito nei mercati urbani selezionati." }, { title: "Supporto professionale", text: "Segui un percorso guidato dall'interesse alla documentazione." }],
  investTitle: "Come investire", steps: [{ title: "Crea un account", text: "Registrati in sicurezza e conferma il tuo profilo investitore." }, { title: "Esplora gli immobili", text: "Confronta località, valori, ipotesi di affitto e rischi." }, { title: "Richiedi l'accesso", text: "Scegli un'opportunità e invia il tuo interesse online." }, { title: "Segui i progressi", text: "Controlla richieste, istruzioni di pagamento e aggiornamenti nel dashboard." }],
  simpleTitle: "Investimento immobiliare semplificato", simpleItems: [{ title: "Ingresso più accessibile", text: "Inizia da {minimum} invece di finanziare un intero immobile." }, { title: "Cresci gradualmente", text: "Aggiungi opportunità nel tempo e confronta diversi mercati." }, { title: "Investi con contesto", text: "Esamina prima numeri, struttura del progetto e rischi." }, { title: "Meno amministrazione", text: "Usa un unico processo digitale per richieste, documenti e aggiornamenti." }],
  apartTitle: "Cosa distingue Brickwise", features: [{ title: "Partecipazione frazionata", text: "Accedi a immobili selezionati con importi più contenuti." }, { title: "Ipotesi di affitto", text: "Consulta il modello di reddito di ogni opportunità." }, { title: "Valore nel contesto", text: "Confronta prezzo, posizione e rendimento da affitto." }, { title: "Mercati internazionali", text: "Esplora opportunità in Canada e a Capo Verde." }, { title: "Importi chiari", text: "Conosci la partecipazione minima prima della richiesta." }, { title: "Dashboard del portafoglio", text: "Organizza richieste e istruzioni di pagamento." }, { title: "Processo digitale", text: "Passa online dalla scoperta alla preparazione dell'investimento." }, { title: "Percorso guidato", text: "Ricevi supporto pratico in ogni fase." }, { title: "Account sicuro", text: "Usa autenticazione verificata e accesso protetto." }],
  ctaTitle: "Pronto a creare il tuo portafoglio immobiliare?", ctaText: "Crea il tuo account investitore e scopri gli immobili disponibili.", ctaButton: "Inizia ora",
};

const copy: Record<Locale, HomeCopy> = { en, de, fr, es, it };

const benefitIcons = [PieChart, Zap, TrendingUp, HousePlus];
const stepIcons = [UserPlus, Search, ShieldCheck, Rocket];
const featureIcons = [WalletCards, CircleDollarSign, TrendingUp, Plane, Globe2, Building2, Laptop, Wrench, LockKeyhole];

async function getCurrentLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  return normalizeLocale(cookieStore.get(localeCookieName)?.value) || defaultLocale;
}

export default async function Home() {
  const locale = await getCurrentLocale();
  const returnText = targetReturnCopy[locale];
  const t = createTranslator(locale);
  const supabase = await createClient();
  const [translations, { data: shareSettingsData }, listed] = await Promise.all([
    getPropertyTranslations(locale),
    supabase.from("property_share_settings").select("property_slug,total_shares,blocked_shares"),
    getListedProperties(),
  ]);
  const shareSettings = new Map((shareSettingsData || []).map((setting) => [setting.property_slug, setting]));
  const minimum = formatMinimumInvestment(locale);
  const source = copy[locale];
  const text = {
    ...source,
    heroAmount: minimum,
    easyPoints: source.easyPoints.map((value) => value.replaceAll("{minimum}", minimum)),
    simpleItems: source.simpleItems.map((item) => ({ ...item, text: item.text.replaceAll("{minimum}", minimum) })),
  };
  const featured = listed.slice(0, 3).map((property) => localizeProperty(property, translations));

  return (
    <main className="bg-white text-ink">
      <section className="bg-canvas px-5 pb-0 pt-32 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-[1320px] text-center">
          <h1 className="mx-auto max-w-5xl text-[clamp(2.7rem,5.5vw,5.4rem)] font-semibold leading-[1.05] text-black">
            {text.heroTop}<br />{text.heroBottom} <span className="text-brand">{text.heroAmount}</span>
          </h1>
          <p className="mx-auto mt-7 max-w-3xl text-lg leading-8 text-muted">{text.heroText}</p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-4">
            <Link href="/join" className="inline-flex min-h-12 items-center rounded-lg bg-brand px-7 font-semibold text-white shadow-sm transition hover:bg-brand-strong">{text.free}<ArrowRight className="ml-2" size={19} /></Link>
            <Link href="#how-it-works" className="inline-flex min-h-12 items-center border-b border-ink/30 px-2 font-semibold text-ink"><BookOpenCheck className="mr-2 text-brand" size={19} />{text.how}</Link>
          </div>

          <div className="relative mx-auto mt-14 max-w-5xl translate-y-14">
            <div className="absolute -left-2 -top-8 z-10 hidden rounded-lg bg-white px-6 py-4 text-left shadow-lg sm:block">
              <p className="text-xs uppercase text-muted">{t("Brickwise selection")}</p>
              <p className="mt-1 font-semibold">{text.trusted}</p>
            </div>
            <div className="relative aspect-[16/8] overflow-hidden rounded-lg shadow-xl"><Image src="/insight-1.jpg" alt="" fill sizes="(max-width: 1024px) 100vw, 1024px" loading="eager" fetchPriority="high" className="object-cover" /></div>
            <div className="absolute -bottom-6 right-4 rounded-lg bg-white px-5 py-4 text-left shadow-lg sm:right-8">
              <p className="text-2xl font-semibold text-brand">{t("2 markets")}</p>
              <p className="text-sm text-muted">{t("Canada + Cape Verde")}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white px-5 pb-20 pt-28 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-[1320px] text-center">
          <p className="text-sm font-semibold text-brand">{text.propertiesKicker}</p>
          <h2 className="mt-2 text-3xl font-semibold md:text-5xl">{text.propertiesTitle}</h2>
        </div>
      </section>

      <section className="border-y border-line bg-canvas px-5 py-16 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-[1320px]">
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {featured.map((property) => {
              const shares = getPropertyShareSupply(property, shareSettings.get(property.slug)).available;
              const projection = getPropertyProjection(property);
              return (
                <Link href={`/properties/${property.slug}`} key={property.id} className="group overflow-hidden rounded-xl border border-line bg-white p-2 shadow-sm transition hover:shadow-md">
                  <div className="relative aspect-[16/9] overflow-hidden rounded-md bg-line">
                    <Image src={property.image_url} alt={property.title} fill sizes="(max-width: 767px) 100vw, (max-width: 1023px) 50vw, 440px" unoptimized={!property.image_url.startsWith("/")} className="object-cover transition duration-500 group-hover:scale-[1.03]" />
                    <span className="absolute left-3 top-3 rounded-full bg-white/95 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-ink shadow-sm">{text.primary}</span>
                  </div>
                  <div className="p-3">
                    <div className="flex items-center justify-center gap-5 py-2 text-xs text-muted"><span className="flex items-center gap-1"><BedDouble size={16} />{property.bedrooms}</span><span className="flex items-center gap-1"><Bath size={16} />{property.bathrooms}</span><span className="flex items-center gap-1"><Maximize2 size={15} />{property.area} m²</span></div>
                    <h3 className="truncate text-lg font-semibold">{property.title}</h3>
                    {(property.constructionStatus || (property.investmentTier && property.investmentTier !== "standard")) && <div className="mt-2 flex flex-wrap gap-2"><PropertyConstructionBadge status={property.constructionStatus} locale={locale} /><PropertyTierBadge tier={property.investmentTier} locale={locale} /></div>}
                    <p className="mt-2 flex items-center gap-1 truncate text-sm text-muted"><MapPin size={15} />{property.city}, {property.address.split(",").at(-1)}</p>
                    <div className="mt-5 grid gap-2 text-sm"><div className="flex justify-between gap-4"><span>{text.available}</span><strong className="whitespace-nowrap text-brand">{shares.toLocaleString(locale)}</strong></div><div className="flex justify-between gap-4"><span>{rentalYieldLabel(locale, property.costsStated)}</span><strong className="whitespace-nowrap text-brand">{formatPropertyPercent(projection.annualRate, locale)}</strong></div><div className="flex justify-between gap-4"><span>{returnText.monthlyPerShare}</span><strong className="whitespace-nowrap text-brand">{formatPropertyMoney(projection.monthlyPerShare, projection.currency, locale, 2)}</strong></div><div className="flex justify-between gap-4"><span>{returnText.annualPerShare}</span><strong className="whitespace-nowrap text-brand">{formatPropertyMoney(projection.annualPerShare, projection.currency, locale, 2)}</strong></div></div>
                  </div>
                </Link>
              );
            })}
          </div>
          {/* The same target disclaimer applies to every card, so it is shown once under the grid. */}
          {featured.some((property) => property.targetTotalReturn !== undefined || getPropertyReturnBreakdown(property)) && <p className="mx-auto mt-6 max-w-4xl text-center text-xs leading-5 text-muted">{featured.some((property) => getPropertyReturnBreakdown(property)) ? returnText.modelNote : returnText.configuredTargetNote}{featured.some((property) => property.costsStated === false) && ` ${returnText.costsMissingNote}`}</p>}
          <div className="mt-8 text-center"><Link href="/properties" className="inline-flex min-h-12 items-center rounded-lg bg-brand px-7 font-semibold text-white transition hover:bg-brand-strong">{text.viewProperties}<ArrowRight className="ml-2" size={18} /></Link></div>
        </div>
      </section>

      <section id="how-it-works" className="scroll-mt-24 px-5 py-20 sm:px-8 lg:px-12 lg:py-28">
        <div className="mx-auto mb-16 max-w-[1320px]"><HowItWorksVideo locale={locale} /></div>
        <div className="mx-auto grid max-w-[1320px] gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
          <div>
            <h2 className="max-w-xl text-3xl font-semibold leading-tight sm:text-4xl md:text-5xl">{text.easyTitle}</h2>
            <div className="mt-7 grid gap-3">{text.easyPoints.map((point) => <p key={point} className="flex items-center gap-3 text-lg text-muted"><Check className="text-[#15a777]" size={21} />{point}</p>)}</div>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            {text.benefitCards.map((card, index) => { const Icon = benefitIcons[index]; return <article key={card.title} className={`rounded-lg p-6 ${["bg-brand-soft", "bg-[#fff6e7]", "bg-[#eef2ff]", "bg-[#fff0f2]"][index]}`}><Icon className="text-brand" size={28} /><h3 className="mt-5 text-2xl font-semibold">{card.title}</h3><p className="mt-3 leading-7 text-muted">{card.text}</p></article>; })}
          </div>
        </div>
      </section>

      <section className="border-y border-line bg-canvas px-5 py-20 sm:px-8 lg:px-12 lg:py-24">
        <div className="mx-auto max-w-[1320px]">
          <h2 className="text-center text-4xl font-semibold md:text-5xl">{text.investTitle}</h2>
          <div className="mt-14 grid gap-10 md:grid-cols-4">
            {text.steps.map((step, index) => { const Icon = stepIcons[index]; return <div key={step.title} className="text-center"><span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand-soft text-brand"><Icon size={29} /></span><p className="mt-6 text-xs font-semibold text-muted">0{index + 1}</p><h3 className="mt-2 text-xl font-semibold">{step.title}</h3><p className="mt-3 leading-7 text-muted">{step.text}</p></div>; })}
          </div>
        </div>
      </section>

      <section className="px-5 py-20 sm:px-8 lg:px-12 lg:py-28">
        <div className="mx-auto grid max-w-[1200px] gap-12 lg:grid-cols-2 lg:items-center">
          <div className="relative min-h-[500px] overflow-hidden rounded-lg"><Image src="/insight-3.jpg" alt="" fill sizes="(max-width: 1023px) 100vw, 50vw" className="object-cover" /></div>
          <div>
            <h2 className="text-4xl font-semibold md:text-5xl">{text.simpleTitle}</h2>
            <div className="mt-8 grid gap-7">{text.simpleItems.map((item, index) => <div key={item.title} className="grid grid-cols-[2.5rem_1fr] gap-4"><span className="pt-1 text-sm text-brand">0{index + 1}</span><div><h3 className="text-xl font-semibold">{item.title}</h3><p className="mt-2 leading-7 text-muted">{item.text}</p></div></div>)}</div>
          </div>
        </div>
      </section>

      <section className="bg-canvas px-5 py-20 sm:px-8 lg:px-12 lg:py-24">
        <div className="mx-auto max-w-[1320px]">
          <h2 className="text-center text-4xl font-semibold md:text-5xl">{text.apartTitle}</h2>
          <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {text.features.map((feature, index) => { const Icon = featureIcons[index]; return <article key={feature.title} className="rounded-lg bg-white p-7"><Icon className="text-brand" size={30} /><h3 className="mt-8 text-xl font-semibold">{feature.title}</h3><p className="mt-3 leading-7 text-muted">{feature.text}</p></article>; })}
          </div>
        </div>
      </section>

      <section className="bg-brand px-5 py-20 text-white sm:px-8 lg:px-12">
        <div className="mx-auto flex max-w-[1120px] flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div><h2 className="max-w-3xl text-4xl font-semibold leading-tight md:text-6xl">{text.ctaTitle}</h2><p className="mt-5 max-w-2xl text-lg text-white/85">{text.ctaText}</p></div>
          <Link href="/join" className="inline-flex min-h-14 w-fit shrink-0 items-center rounded-lg bg-white px-8 font-semibold text-ink transition hover:bg-brand-soft">{text.ctaButton}<ArrowRight className="ml-2" size={19} /></Link>
        </div>
      </section>
    </main>
  );
}

export async function generateMetadata() {
  const { publicMetadata } = await import("./lib/seo");
  const { getCurrentLocale } = await import("./lib/server-locale");
  return publicMetadata("/", await getCurrentLocale());
}
