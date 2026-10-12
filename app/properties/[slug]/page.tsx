import { rentalModelCopy } from "../../lib/rental-model-copy";
import { salReiModelCopy } from "../../lib/sal-rei-model-copy";
import { cache } from "react";
import { randomUUID } from "node:crypto";
import { publicMetadata } from "../../lib/seo";
import { formatPropertyPercent, localizedStatus, propertyUiCopy } from "../property-ui-copy";
import { createTranslator } from "../../lib/translate";
import { formatMinimumInvestment, MINIMUM_INVESTMENT_EUR, minimumInvestmentShares } from "../../lib/investment-policy";
import { formatPropertyMoney, getPropertyProjection, getPropertyCurrency, getPropertyReturnBreakdown, getPropertyShareSupply } from "../../lib/property-financials";
import { targetReturnCopy } from "../../lib/target-return-copy";
import { getPropertyTranslations, localizeProperty } from "../../lib/property-localization";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/auth";
import {
  getExternalPropertyBySlug,
  hiddenManualPropertySlugs,
} from "@/app/lib/external-properties";
import InvestmentCalculator from "./InvestmentCalculator";
import type { InvestmentCalculatorCopy } from "./InvestmentCalculator";
import PropertyGallery from "./PropertyGallery";
import PropertyLocation from "./PropertyLocation";
import PropertyConstructionBadge from "../../components/PropertyConstructionBadge";
import PortalPropertyGallery from "./PortalPropertyGallery";
import ClientPortalSidebar from "@/app/components/ClientPortalSidebar";
import Link from "next/link";
import { Bath, BedDouble, Info } from "lucide-react";
import { notFound } from "next/navigation";
import { localeHtmlLang, type Locale } from "@/app/lib/i18n";
import { getCurrentLocale } from "@/app/lib/server-locale";
import { createSharePurchaseRequest } from "@/app/dashboard/actions";

type PageProps = {
  params: Promise<{
    slug: string;
  }>;
};

type DetailCopy = {
  onRequest: string;
  property: string;
  available: string;
  backToProperties: string;
  locationMissing: string;
  forSale: string;
  estimatePayment: string;
  beds: string;
  baths: string;
  size: string;
  aboutHome: string;
  highlights: string;
  homeFacts: string;
  interior: string;
  exterior: string;
  location: string;
  city: string;
  community: string;
  province: string;
  expectedMonthlyRent: string;
  incomePerShare: string;
  monthly: string;
  grossYield: string;
  summary: string;
  estimatedMortgagePayment: string;
  mortgageEstimateNote: string;
  grossMonthlyRent: string;
  grossAnnualRent: string;
  accessFrom: string;
  payout: string;
  area: string;
  bedroomsRooms: string;
  bathrooms: string;
  propertyType: string;
  status: string;
  askAbout: string;
  mortgageOptions: string;
  mortgageAccessNotes: string;
  reviewHome: string;
  reviewHomeText: string;
  estimatePaymentStep: string;
  estimatePaymentText: string;
  contactTeam: string;
  contactTeamText: string;
  rentalParticipationTitle: string;
  chooseAmount: string;
  chooseAmountText: string;
  rentModelled: string;
  rentModelledText: string;
  reviewPayout: string;
  reviewPayoutText: string;
  modelNote: string;
  fallbackHighlights: string[];
  calculator: InvestmentCalculatorCopy;
};

const detailCopy: Record<string, DetailCopy> = {
  en: {
    onRequest: "On request",
    property: "Property",
    available: "Available",
    backToProperties: "Back to properties",
    locationMissing: "Location not provided",
    forSale: "for sale",
    estimatePayment: "Estimate payment",
    beds: "Beds",
    baths: "Baths",
    size: "Size",
    aboutHome: "About this home",
    highlights: "Highlights",
    homeFacts: "Home facts",
    interior: "Interior",
    exterior: "Exterior and lot",
    location: "Location",
    city: "City",
    community: "Community",
    province: "Province",
    expectedMonthlyRent: "Expected monthly rent",
    incomePerShare: "Income per share",
    monthly: "monthly",
    grossYield: "Target Total Return",
    summary: "Property summary",
    estimatedMortgagePayment: "Estimated mortgage payment",
    mortgageEstimateNote: "Monthly principal and interest estimate with 20% down at 5.35%.",
    grossMonthlyRent: "Gross monthly rent",
    grossAnnualRent: "Gross annual rent",
    accessFrom: "Access from",
    payout: "Payout",
    area: "Area",
    bedroomsRooms: "Bedrooms / rooms",
    bathrooms: "Bathrooms",
    propertyType: "Property type",
    status: "Status",
    askAbout: "Ask about this property",
    mortgageOptions: "Mortgage options",
    mortgageAccessNotes: "Mortgage and access notes",
    reviewHome: "Review the home",
    reviewHomeText: "Look through the gallery, facts, description and location details before requesting more information.",
    estimatePaymentStep: "Estimate payment",
    estimatePaymentText: "Use mortgage tools to model down payment, rates, closing costs and monthly payment range.",
    contactTeam: "Contact the team",
    contactTeamText: "Ask about availability, listing details, financing assumptions and next steps.",
    rentalParticipationTitle: "How rental participation works",
    chooseAmount: "Choose amount",
    chooseAmountText: "Select a modelled participation amount, for example from {minimum}.",
    rentModelled: "Rent is modelled",
    rentModelledText: "Expected gross rent is allocated proportionally in the calculator.",
    reviewPayout: "Review payout",
    reviewPayoutText: "Payout can be shown as a monthly or annual model depending on the project.",
    modelNote:
      "Note: all values are gross model calculations and are not guaranteed. Costs, taxes, vacancy, financing, and market changes can reduce actual results.",
    fallbackHighlights: [
      "Cross-border property opportunity",
      "Structured project information",
      "Property value and access assumptions",
      "Risk notes and contact workflow",
    ],
    calculator: {
      dashboardActive: "Dashboard active",
      signInRequired: "Sign in required",
      title: "Share and monthly income calculator",
      text: "Choose how many shares to buy and review your modelled net monthly and annual profit after property operating costs.",
      propertyValue: "Property value",
      grossYield: "Target Total Return",
      minimum: "Minimum",
      sharePrice: "Share price",
      accessAmount: "Your access amount",
      choosePayoutModel: "Choose payout model",
      monthly: "Monthly",
      annual: "Annual",
      amountAria: "Access amount for",
      enterAmount: "Enter amount manually",
      modelledShares: "Modelled shares",
      monthlyGrossIncome: "Monthly gross income",
      annualGrossIncome: "Annual gross income",
      propertyExposure: "Property exposure",
      fundingAfter: "Funding after your request",
      requestAmount: "Request this amount",
      signInToRequest: "Sign in to request",
      prepareFunding: "Prepare funding",
      note: "This calculation is a gross model and not investment advice. Costs, taxes, vacancy, financing, and market changes can reduce actual results.",
      onRequest: "On request",
    },
  },
  de: {
    onRequest: "Auf Anfrage",
    property: "Immobilie",
    available: "Verfügbar",
    backToProperties: "Zurück zu Immobilien",
    locationMissing: "Standort nicht angegeben",
    forSale: "zum Verkauf",
    estimatePayment: "Rate schätzen",
    beds: "Zimmer",
    baths: "Bäder",
    size: "Größe",
    aboutHome: "Über diese Immobilie",
    highlights: "Highlights",
    homeFacts: "Immobiliendaten",
    interior: "Innenbereich",
    exterior: "Außenbereich und Grundstück",
    location: "Lage",
    city: "Stadt",
    community: "Umfeld",
    province: "Region",
    expectedMonthlyRent: "Erwartete Monatsmiete",
    incomePerShare: "Einkommen pro Anteil",
    monthly: "monatlich",
    grossYield: "Angestrebte Gesamtrendite",
    summary: "Immobilienübersicht",
    estimatedMortgagePayment: "Geschätzte Finanzierungsrate",
    mortgageEstimateNote: "Monatliche Zins- und Tilgungsschätzung mit 20% Eigenkapital bei 5,35%.",
    grossMonthlyRent: "Brutto-Monatsmiete",
    grossAnnualRent: "Brutto-Jahresmiete",
    accessFrom: "Zugang ab",
    payout: "Auszahlung",
    area: "Fläche",
    bedroomsRooms: "Zimmer / Räume",
    bathrooms: "Bäder",
    propertyType: "Immobilientyp",
    status: "Status",
    askAbout: "Zu dieser Immobilie anfragen",
    mortgageOptions: "Finanzierungsoptionen",
    mortgageAccessNotes: "Finanzierungs- und Zugangshinweise",
    reviewHome: "Immobilie prüfen",
    reviewHomeText: "Prüfen Sie Galerie, Daten, Beschreibung und Lage, bevor Sie weitere Informationen anfordern.",
    estimatePaymentStep: "Rate schätzen",
    estimatePaymentText: "Nutzen Sie die Finanzierungstools für Eigenkapital, Zinsen, Abschlusskosten und Monatsrate.",
    contactTeam: "Team kontaktieren",
    contactTeamText: "Fragen Sie Verfügbarkeit, Immobiliendetails, Finanzierungsannahmen und nächste Schritte an.",
    rentalParticipationTitle: "So funktioniert Mietbeteiligung",
    chooseAmount: "Betrag wählen",
    chooseAmountText: "Wählen Sie einen modellierten Beteiligungsbetrag, zum Beispiel ab {minimum}.",
    rentModelled: "Miete wird modelliert",
    rentModelledText: "Erwartete Bruttomiete wird im Rechner proportional zugeordnet.",
    reviewPayout: "Auszahlung prüfen",
    reviewPayoutText: "Die Auszahlung kann je nach Projekt monatlich oder jährlich dargestellt werden.",
    modelNote:
      "Hinweis: Alle Werte sind Bruttomodellrechnungen und nicht garantiert. Kosten, Steuern, Leerstand, Finanzierung und Marktveränderungen können Ergebnisse reduzieren.",
    fallbackHighlights: [
      "Internationale Immobilienchance",
      "Strukturierte Projektinformationen",
      "Immobilienwert und Zugangannahmen",
      "Risikohinweise und Kontaktprozess",
    ],
    calculator: {
      dashboardActive: "Dashboard aktiv",
      signInRequired: "Anmeldung erforderlich",
      title: "Anteil- und Monatseinkommensrechner",
      text: "Wählen Sie die Anzahl der Anteile und prüfen Sie den modellierten monatlichen und jährlichen Nettogewinn nach Betriebskosten.",
      propertyValue: "Immobilienwert",
      grossYield: "Angestrebte Gesamtrendite",
      minimum: "Minimum",
      sharePrice: "Anteilspreis",
      accessAmount: "Ihr Zugangsbetrag",
      choosePayoutModel: "Auszahlungsmodell wählen",
      monthly: "Monatlich",
      annual: "Jährlich",
      amountAria: "Zugangsbetrag für",
      enterAmount: "Betrag manuell eingeben",
      modelledShares: "Modellierte Anteile",
      monthlyGrossIncome: "Monatliches Bruttoeinkommen",
      annualGrossIncome: "Jährliches Bruttoeinkommen",
      propertyExposure: "Immobilienbeteiligung",
      fundingAfter: "Finanzierung nach Ihrer Anfrage",
      requestAmount: "Diesen Betrag anfragen",
      signInToRequest: "Anmelden zum Anfragen",
      prepareFunding: "Finanzierung vorbereiten",
      note: "Diese Berechnung ist ein Bruttomodell und keine Anlageberatung. Kosten, Steuern, Leerstand, Finanzierung und Marktveränderungen können Ergebnisse reduzieren.",
      onRequest: "Auf Anfrage",
    },
  },
  fr: {} as DetailCopy,
  es: {} as DetailCopy,
  it: {} as DetailCopy,
  sq: {
    onRequest: "Me kerkese",
    property: "Prone",
    available: "E disponueshme",
    backToProperties: "Kthehu te pronat",
    locationMissing: "Lokacioni mungon",
    forSale: "ne shitje",
    estimatePayment: "Vlereso pagesen",
    beds: "Dhoma",
    baths: "Banjo",
    size: "Madhesia",
    aboutHome: "Rreth kesaj prone",
    highlights: "Pikat kryesore",
    homeFacts: "Te dhenat e prones",
    interior: "Brenda",
    exterior: "Jashte dhe trualli",
    location: "Lokacioni",
    city: "Qyteti",
    community: "Zona",
    province: "Rajoni",
    expectedMonthlyRent: "Qiraja mujore e pritur",
    incomePerShare: "Te ardhura per pjese",
    monthly: "mujore",
    grossYield: "Kthimi total i synuar",
    summary: "Permbledhje prone",
    estimatedMortgagePayment: "Pagesa e vleresuar e kredise",
    mortgageEstimateNote: "Vleresim mujor principal dhe interes me 20% parapagese ne 5.35%.",
    grossMonthlyRent: "Qira mujore bruto",
    grossAnnualRent: "Qira vjetore bruto",
    accessFrom: "Akses nga",
    payout: "Pagesa",
    area: "Siperfaqe",
    bedroomsRooms: "Dhoma / ambiente",
    bathrooms: "Banjo",
    propertyType: "Tipi i prones",
    status: "Statusi",
    askAbout: "Pyet per kete prone",
    mortgageOptions: "Opsione financimi",
    mortgageAccessNotes: "Shenime financimi dhe aksesi",
    reviewHome: "Shiko pronen",
    reviewHomeText: "Shiko galerine, faktet, pershkrimin dhe lokacionin para se te kerkosh me shume informacion.",
    estimatePaymentStep: "Vlereso pagesen",
    estimatePaymentText: "Perdor mjetet e financimit per parapagese, norma, kosto dhe pagese mujore.",
    contactTeam: "Kontakto ekipin",
    contactTeamText: "Pyet per disponueshmeri, detaje listing-u, supozime financimi dhe hapat tjere.",
    rentalParticipationTitle: "Si funksionon pjesemarrja ne qira",
    chooseAmount: "Zgjidh shumen",
    chooseAmountText: "Zgjidh nje shume te modeluar pjesemarrjeje, per shembull nga {minimum}.",
    rentModelled: "Qiraja modelohet",
    rentModelledText: "Qiraja bruto e pritur ndahet proporcionalisht ne kalkulator.",
    reviewPayout: "Shiko pagesen",
    reviewPayoutText: "Pagesa mund te shfaqet mujore ose vjetore sipas projektit.",
    modelNote:
      "Shenim: te gjitha vlerat jane llogaritje bruto te modeluara dhe nuk garantohen. Kostot, taksat, vakanca, financimi dhe ndryshimet e tregut mund te ulin rezultatet.",
    fallbackHighlights: [
      "Mundesi prone nderkombetare",
      "Informacion i strukturuar projekti",
      "Vlera prone dhe supozime aksesi",
      "Shenime rreziku dhe rrjedhe kontakti",
    ],
    calculator: {
      dashboardActive: "Paneli aktiv",
      signInRequired: "Kerkohet hyrje",
      title: "Kalkulatori i shares dhe fitimit mujor",
      text: "Zgjidh sa shares do te blesh dhe shiko fitimin neto mujor dhe vjetor pas shpenzimeve te prones.",
      propertyValue: "Vlera e prones",
      grossYield: "Kthimi total i synuar",
      minimum: "Minimumi",
      sharePrice: "Cmimi i pjeses",
      accessAmount: "Shuma jote e aksesit",
      choosePayoutModel: "Zgjidh modelin e pageses",
      monthly: "Mujore",
      annual: "Vjetore",
      amountAria: "Shuma e aksesit per",
      enterAmount: "Vendos shumen manualisht",
      modelledShares: "Pjese te modeluara",
      monthlyGrossIncome: "Te ardhura mujore bruto",
      annualGrossIncome: "Te ardhura vjetore bruto",
      propertyExposure: "Ekspozimi ne prone",
      fundingAfter: "Financimi pas kerkeses tende",
      requestAmount: "Kerko kete shume",
      signInToRequest: "Hyr per te kerkuar",
      prepareFunding: "Pergatit financimin",
      note: "Kjo llogaritje eshte model bruto dhe nuk eshte keshille investimi. Kostot, taksat, vakanca, financimi dhe ndryshimet e tregut mund te ulin rezultatet.",
      onRequest: "Me kerkese",
    },
  },
};

detailCopy.fr = { ...detailCopy.en, onRequest:"Sur demande",property:"Bien",available:"Disponible",backToProperties:"Retour aux biens",locationMissing:"Emplacement non indiqué",forSale:"à vendre",estimatePayment:"Estimer le paiement",beds:"Chambres",baths:"Salles de bain",size:"Surface",aboutHome:"À propos de ce bien",highlights:"Points forts",homeFacts:"Caractéristiques",interior:"Intérieur",exterior:"Extérieur et terrain",location:"Emplacement",city:"Ville",community:"Quartier",province:"Province",expectedMonthlyRent:"Loyer mensuel estimé",incomePerShare:"Revenu par part",monthly:"mensuel",grossYield:"Rendement total cible",summary:"Résumé du bien",estimatedMortgagePayment:"Paiement hypothécaire estimé",mortgageEstimateNote:"Estimation mensuelle du capital et des intérêts avec 20 % d'apport à 5,35 %.",grossMonthlyRent:"Loyer mensuel brut",grossAnnualRent:"Loyer annuel brut",accessFrom:"Investissement minimum",payout:"Versement",area:"Surface",bedroomsRooms:"Chambres / pièces",bathrooms:"Salles de bain",propertyType:"Type de bien",status:"Statut",askAbout:"Poser une question sur ce bien",mortgageOptions:"Options hypothécaires",mortgageAccessNotes:"Notes sur le financement et l'accès",reviewHome:"Examiner le bien",reviewHomeText:"Consultez la galerie, les caractéristiques, la description et l'emplacement avant votre demande.",estimatePaymentStep:"Estimer le paiement",estimatePaymentText:"Utilisez les outils pour modéliser l'apport, le taux, les frais et la mensualité.",contactTeam:"Contacter l'équipe",contactTeamText:"Demandez la disponibilité, les détails, les hypothèses de financement et les prochaines étapes.",rentalParticipationTitle:"Fonctionnement de la participation locative",chooseAmount:"Choisir le montant",chooseAmountText:"Sélectionnez un montant de participation modélisé, par exemple dès {minimum}.",rentModelled:"Loyer modélisé",rentModelledText:"Le loyer brut estimé est attribué proportionnellement dans le calculateur.",reviewPayout:"Examiner le versement",reviewPayoutText:"Le versement peut être affiché mensuellement ou annuellement selon le projet.",modelNote:"Toutes les valeurs sont des modèles bruts non garantis. Les coûts, taxes, vacances, financements et variations du marché peuvent réduire les résultats.",fallbackHighlights:["Opportunité immobilière internationale","Informations de projet structurées","Valeur du bien et hypothèses d'accès","Risques et processus de contact"],calculator:{...detailCopy.en.calculator,dashboardActive:"Tableau de bord actif",signInRequired:"Connexion requise",title:"Calculateur de parts et de revenu mensuel",text:"Choisissez le nombre de parts et consultez le bénéfice mensuel et annuel modélisé après les coûts.",propertyValue:"Valeur du bien",grossYield:"Rendement total cible",minimum:"Minimum",sharePrice:"Prix par part",accessAmount:"Votre montant d'accès",choosePayoutModel:"Choisir le modèle de versement",monthly:"Mensuel",annual:"Annuel",amountAria:"Montant d'accès pour",enterAmount:"Saisir le montant",modelledShares:"Parts modélisées",monthlyGrossIncome:"Revenu brut mensuel",annualGrossIncome:"Revenu brut annuel",propertyExposure:"Exposition immobilière",fundingAfter:"Financement après votre demande",requestAmount:"Demander ce montant",signInToRequest:"Se connecter pour demander",prepareFunding:"Préparer le financement",note:"Ce calcul est un modèle brut et non un conseil en investissement.",onRequest:"Sur demande"}};
detailCopy.es = { ...detailCopy.en, onRequest:"Bajo solicitud",property:"Propiedad",available:"Disponible",backToProperties:"Volver a propiedades",locationMissing:"Ubicación no indicada",forSale:"en venta",estimatePayment:"Estimar pago",beds:"Dormitorios",baths:"Baños",size:"Superficie",aboutHome:"Sobre esta propiedad",highlights:"Puntos destacados",homeFacts:"Características",interior:"Interior",exterior:"Exterior y terreno",location:"Ubicación",city:"Ciudad",community:"Zona",province:"Provincia",expectedMonthlyRent:"Alquiler mensual estimado",incomePerShare:"Ingreso por participación",monthly:"mensual",grossYield:"Rentabilidad total objetivo",summary:"Resumen de la propiedad",estimatedMortgagePayment:"Pago hipotecario estimado",mortgageEstimateNote:"Estimación mensual de capital e intereses con 20 % de entrada al 5,35 %.",grossMonthlyRent:"Alquiler bruto mensual",grossAnnualRent:"Alquiler bruto anual",accessFrom:"Inversión mínima",payout:"Pago",area:"Superficie",bedroomsRooms:"Dormitorios / habitaciones",bathrooms:"Baños",propertyType:"Tipo de propiedad",status:"Estado",askAbout:"Preguntar por esta propiedad",mortgageOptions:"Opciones hipotecarias",mortgageAccessNotes:"Notas de financiación y acceso",reviewHome:"Revisar la propiedad",reviewHomeText:"Consulta la galería, características, descripción y ubicación antes de solicitar información.",estimatePaymentStep:"Estimar pago",estimatePaymentText:"Utiliza las herramientas para calcular la entrada, los tipos, los costes y la cuota mensual.",contactTeam:"Contactar al equipo",contactTeamText:"Pregunta por disponibilidad, detalles, supuestos financieros y siguientes pasos.",rentalParticipationTitle:"Cómo funciona la participación de alquiler",chooseAmount:"Elegir importe",chooseAmountText:"Selecciona un importe modelizado, por ejemplo desde {minimum}.",rentModelled:"Alquiler modelado",rentModelledText:"El alquiler bruto estimado se asigna proporcionalmente en la calculadora.",reviewPayout:"Revisar pago",reviewPayoutText:"El pago puede mostrarse mensual o anual según el proyecto.",modelNote:"Todos los valores son modelos brutos no garantizados. Costes, impuestos, vacancia, financiación y mercado pueden reducir los resultados.",fallbackHighlights:["Oportunidad inmobiliaria internacional","Información estructurada del proyecto","Valor y condiciones de acceso","Riesgos y proceso de contacto"],calculator:{...detailCopy.en.calculator,dashboardActive:"Panel activo",signInRequired:"Inicio de sesión necesario",title:"Calculadora de participaciones e ingresos",text:"Elige participaciones y revisa el beneficio mensual y anual modelado tras los costes.",propertyValue:"Valor de la propiedad",grossYield:"Rentabilidad total objetivo",minimum:"Mínimo",sharePrice:"Precio por participación",accessAmount:"Tu importe de acceso",choosePayoutModel:"Elegir modelo de pago",monthly:"Mensual",annual:"Anual",amountAria:"Importe de acceso para",enterAmount:"Introducir importe",modelledShares:"Participaciones modeladas",monthlyGrossIncome:"Ingreso bruto mensual",annualGrossIncome:"Ingreso bruto anual",propertyExposure:"Exposición inmobiliaria",fundingAfter:"Financiación tras tu solicitud",requestAmount:"Solicitar este importe",signInToRequest:"Inicia sesión para solicitar",prepareFunding:"Preparar financiación",note:"Este cálculo es un modelo bruto y no asesoramiento de inversión.",onRequest:"Bajo solicitud"}};
detailCopy.it = { ...detailCopy.en, onRequest:"Su richiesta",property:"Immobile",available:"Disponibile",backToProperties:"Torna agli immobili",locationMissing:"Posizione non indicata",forSale:"in vendita",estimatePayment:"Stima pagamento",beds:"Camere",baths:"Bagni",size:"Superficie",aboutHome:"Informazioni sull'immobile",highlights:"Punti principali",homeFacts:"Caratteristiche",interior:"Interni",exterior:"Esterno e terreno",location:"Posizione",city:"Città",community:"Zona",province:"Provincia",expectedMonthlyRent:"Affitto mensile previsto",incomePerShare:"Reddito per quota",monthly:"mensile",grossYield:"Rendimento totale obiettivo",summary:"Riepilogo immobile",estimatedMortgagePayment:"Pagamento ipotecario stimato",mortgageEstimateNote:"Stima mensile di capitale e interessi con anticipo del 20% al 5,35%.",grossMonthlyRent:"Affitto lordo mensile",grossAnnualRent:"Affitto lordo annuale",accessFrom:"Accesso da",payout:"Pagamento",area:"Superficie",bedroomsRooms:"Camere / locali",bathrooms:"Bagni",propertyType:"Tipo di immobile",status:"Stato",askAbout:"Chiedi informazioni",mortgageOptions:"Opzioni mutuo",mortgageAccessNotes:"Note su finanziamento e accesso",reviewHome:"Esamina l'immobile",reviewHomeText:"Consulta galleria, caratteristiche, descrizione e posizione prima della richiesta.",estimatePaymentStep:"Stima il pagamento",estimatePaymentText:"Usa gli strumenti per modellare anticipo, tassi, costi e rata mensile.",contactTeam:"Contatta il team",contactTeamText:"Chiedi disponibilità, dettagli, ipotesi finanziarie e prossimi passi.",rentalParticipationTitle:"Come funziona la partecipazione locativa",chooseAmount:"Scegli l'importo",chooseAmountText:"Seleziona un importo modellato, ad esempio da {minimum}.",rentModelled:"Affitto modellato",rentModelledText:"L'affitto lordo previsto viene assegnato proporzionalmente nel calcolatore.",reviewPayout:"Esamina il pagamento",reviewPayoutText:"Il pagamento può essere mensile o annuale in base al progetto.",modelNote:"Tutti i valori sono modelli lordi non garantiti. Costi, tasse, sfitto, finanziamento e mercato possono ridurre i risultati.",fallbackHighlights:["Opportunità immobiliare internazionale","Informazioni strutturate sul progetto","Valore e ipotesi di accesso","Rischi e processo di contatto"],calculator:{...detailCopy.en.calculator,dashboardActive:"Dashboard attiva",signInRequired:"Accesso richiesto",title:"Calcolatore quote e reddito mensile",text:"Scegli le quote e consulta il profitto mensile e annuale modellato dopo i costi.",propertyValue:"Valore immobile",grossYield:"Rendimento totale obiettivo",minimum:"Minimo",sharePrice:"Prezzo per quota",accessAmount:"Il tuo importo",choosePayoutModel:"Scegli il modello di pagamento",monthly:"Mensile",annual:"Annuale",amountAria:"Importo di accesso per",enterAmount:"Inserisci importo",modelledShares:"Quote modellate",monthlyGrossIncome:"Reddito lordo mensile",annualGrossIncome:"Reddito lordo annuale",propertyExposure:"Esposizione immobiliare",fundingAfter:"Finanziamento dopo la richiesta",requestAmount:"Richiedi questo importo",signInToRequest:"Accedi per richiedere",prepareFunding:"Prepara finanziamento",note:"Questo calcolo è un modello lordo e non una consulenza in materia di investimenti.",onRequest:"Su richiesta"}};

const propertyLabels: Record<Locale, Record<string, string>> = {
  en: { totalShares:"Total shares", soldBlocked:"Sold / blocked", availableShares:"Available shares", projectedReturn:"Projected annual return", projectedDaily:"Projected daily / share", projectedWeekly:"Projected weekly / share", projectedMonthly:"Projected monthly / share", projectedAnnual:"Projected annual / share", active:"Active", paused:"Paused", infoAvailable:"Property information is available from the Brickwise agent.", reservation:"Share reservation", reserveText:"Log in or create a client account to choose and reserve shares.", reserveLogin:"Log in to reserve shares", rental:"Rental", currentReturn:"Current return", buy:"Buy", sell:"Sell", details:"Details", financial:"Financial", orderBook:"Order book", updates:"Updates", documents:"Documents", transfers:"Transfers", balance:"Balance", reserveDetails:"Reserve details", orders:"Orders", occupancy:"Occupancy status", incomeOverview:"Income overview", rentalIncome:"Rental income", noDescription:"No description available.", address:"Address", layout:"Layout", propertyStyle:"Property style" },
  de: { totalShares:"Anteile gesamt", soldBlocked:"Verkauft / blockiert", availableShares:"Verfügbare Anteile", projectedReturn:"Prognostizierte Jahresrendite", projectedDaily:"Prognose täglich / Anteil", projectedWeekly:"Prognose wöchentlich / Anteil", projectedMonthly:"Prognose monatlich / Anteil", projectedAnnual:"Prognose jährlich / Anteil", active:"Aktiv", paused:"Pausiert", infoAvailable:"Immobilieninformationen sind beim Brickwise Team verfügbar.", reservation:"Anteile reservieren", reserveText:"Melden Sie sich an oder erstellen Sie ein Konto, um Anteile zu reservieren.", reserveLogin:"Anmelden und Anteile reservieren", rental:"Mietertrag", currentReturn:"Aktuelle Rendite", buy:"Kaufen", sell:"Verkaufen", details:"Details", financial:"Finanzen", orderBook:"Orderbuch", updates:"Updates", documents:"Dokumente", transfers:"Transfers", balance:"Saldo", reserveDetails:"Reservedetails", orders:"Aufträge", occupancy:"Belegungsstatus", incomeOverview:"Ertragsübersicht", rentalIncome:"Mietertrag", noDescription:"Keine Beschreibung verfügbar.", address:"Adresse", layout:"Grundriss", propertyStyle:"Immobilienstil" },
  fr: { totalShares:"Parts totales", soldBlocked:"Vendues / bloquées", availableShares:"Parts disponibles", projectedReturn:"Rendement annuel projeté", projectedDaily:"Projection quotidienne / part", projectedWeekly:"Projection hebdomadaire / part", projectedMonthly:"Projection mensuelle / part", projectedAnnual:"Projection annuelle / part", active:"Actif", paused:"En pause", infoAvailable:"Les informations sont disponibles auprès de l'équipe Brickwise.", reservation:"Réservation de parts", reserveText:"Connectez-vous ou créez un compte pour choisir et réserver des parts.", reserveLogin:"Se connecter pour réserver", rental:"Revenu locatif", currentReturn:"Rendement actuel", buy:"Acheter", sell:"Vendre", details:"Détails", financial:"Finances", orderBook:"Carnet d'ordres", updates:"Actualités", documents:"Documents", transfers:"Transferts", balance:"Solde", reserveDetails:"Détails de réserve", orders:"Ordres", occupancy:"Statut d'occupation", incomeOverview:"Aperçu des revenus", rentalIncome:"Revenu locatif", noDescription:"Aucune description disponible.", address:"Adresse", layout:"Agencement", propertyStyle:"Style du bien" },
  es: { totalShares:"Participaciones totales", soldBlocked:"Vendidas / bloqueadas", availableShares:"Participaciones disponibles", projectedReturn:"Rendimiento anual proyectado", projectedDaily:"Proyección diaria / participación", projectedWeekly:"Proyección semanal / participación", projectedMonthly:"Proyección mensual / participación", projectedAnnual:"Proyección anual / participación", active:"Activo", paused:"En pausa", infoAvailable:"La información está disponible a través del equipo Brickwise.", reservation:"Reserva de participaciones", reserveText:"Inicia sesión o crea una cuenta para elegir y reservar participaciones.", reserveLogin:"Iniciar sesión para reservar", rental:"Alquiler", currentReturn:"Rentabilidad actual", buy:"Comprar", sell:"Vender", details:"Detalles", financial:"Finanzas", orderBook:"Libro de órdenes", updates:"Novedades", documents:"Documentos", transfers:"Transferencias", balance:"Saldo", reserveDetails:"Detalles de reserva", orders:"Órdenes", occupancy:"Estado de ocupación", incomeOverview:"Resumen de ingresos", rentalIncome:"Ingresos por alquiler", noDescription:"Sin descripción disponible.", address:"Dirección", layout:"Distribución", propertyStyle:"Estilo de propiedad" },
  it: { totalShares:"Quote totali", soldBlocked:"Vendute / bloccate", availableShares:"Quote disponibili", projectedReturn:"Rendimento annuo previsto", projectedDaily:"Proiezione giornaliera / quota", projectedWeekly:"Proiezione settimanale / quota", projectedMonthly:"Proiezione mensile / quota", projectedAnnual:"Proiezione annuale / quota", active:"Attivo", paused:"In pausa", infoAvailable:"Le informazioni sono disponibili presso il team Brickwise.", reservation:"Prenotazione quote", reserveText:"Accedi o crea un account per scegliere e prenotare le quote.", reserveLogin:"Accedi per prenotare", rental:"Affitto", currentReturn:"Rendimento attuale", buy:"Acquista", sell:"Vendi", details:"Dettagli", financial:"Finanze", orderBook:"Libro ordini", updates:"Aggiornamenti", documents:"Documenti", transfers:"Trasferimenti", balance:"Saldo", reserveDetails:"Dettagli riserva", orders:"Ordini", occupancy:"Stato di occupazione", incomeOverview:"Panoramica reddito", rentalIncome:"Reddito locativo", noDescription:"Nessuna descrizione disponibile.", address:"Indirizzo", layout:"Disposizione", propertyStyle:"Stile immobile" },
};


const getSeoProperty = cache(async (slug: string) => {
  if (hiddenManualPropertySlugs.includes(slug)) notFound();
  const external = getExternalPropertyBySlug(slug);
  if (external) return external;
  const supabase = await createClient();
  const { data, error } = await supabase.from("properties").select("*").eq("slug", slug).in("status", ["active", "available"]).single();
  if (error || !data) notFound();
  return data;
});
export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;
  const locale = await getCurrentLocale();
  const property = localizeProperty(await getSeoProperty(slug), await getPropertyTranslations(locale));
  return publicMetadata('/properties/' + encodeURIComponent(slug), locale, { title: property.title, description: property.description || property.title, image: property.image_url });
}

export default async function PropertyDetailPage({ params }: PageProps) {
  const locale = await getCurrentLocale();
  const t = createTranslator(locale);
  const copy = detailCopy[locale];
  const ui = propertyUiCopy[locale];
  const formatPortalPercent = (value: number) => formatPropertyPercent(value, locale);
  const labels = propertyLabels[locale];
  const { slug } = await params;
  if (hiddenManualPropertySlugs.includes(slug)) {
    notFound();
  }

  const externalProperty = getExternalPropertyBySlug(slug);
  const supabase = await createClient();

  const baseProperty = await getSeoProperty(slug);

  const property = localizeProperty(baseProperty, await getPropertyTranslations(locale));
  const currency = getPropertyCurrency(property);
  function formatMoney(value: number | null | undefined, text: DetailCopy, digits = 0) {
    return value == null || !Number.isFinite(value) ? text.onRequest : formatPropertyMoney(value, currency, locale, digits);
  }
  function formatPortalMoney(value: number | null | undefined, digits = 0) {
    return value == null || !Number.isFinite(value) ? copy.onRequest : formatPropertyMoney(value, currency, locale, digits);
  }

  const user = await getCurrentUser();
  const isAuthenticated = Boolean(user);
  const walletResult = user ? await supabase
    .from("wallet_accounts")
    .select("balance,currency")
    .eq("user_id", user.id)
    .maybeSingle() : null;
  const rawWalletBalance = walletResult?.data?.balance;
  const parsedWalletBalance = typeof rawWalletBalance === "number" || (typeof rawWalletBalance === "string" && rawWalletBalance.trim() !== "")
    ? Number(rawWalletBalance)
    : Number.NaN;
  const walletBalance = !walletResult || walletResult.error ? null
    : !walletResult.data ? 0
    : walletResult.data.currency === "EUR" && Number.isFinite(parsedWalletBalance) && parsedWalletBalance >= 0 ? parsedWalletBalance
    : null;
  const { data: shareSetting } = await supabase
    .from("property_share_settings")
    .select("total_shares,blocked_shares,projected_annual_return,profit_active")
    .eq("property_slug", slug)
    .maybeSingle();

  const propertyValue =
    typeof property.price === "number" && Number.isFinite(property.price)
      ? property.price
      : null;
  const monthlyRent =
    "monthlyRent" in property &&
    typeof property.monthlyRent === "number" &&
    Number.isFinite(property.monthlyRent)
      ? property.monthlyRent
      : null;
  const monthlyExpenses =
    "monthlyExpenses" in property &&
    typeof property.monthlyExpenses === "number" &&
    Number.isFinite(property.monthlyExpenses)
      ? property.monthlyExpenses
      : 0;
  const minInvestment = MINIMUM_INVESTMENT_EUR;
  const sharePrice =
    "sharePrice" in property &&
    typeof property.sharePrice === "number" &&
    Number.isFinite(property.sharePrice)
      ? property.sharePrice
      : 1000;
  const { total: totalShares, blocked: blockedShares, available: availableShares } = getPropertyShareSupply(property, shareSetting);
  const fundedPercent = blockedShares / totalShares * 100;
  const returnBreakdown = getPropertyReturnBreakdown(property);
  const projection = getPropertyProjection(property);
  const targetReturn = projection.annualRate;
  const hasTargetReturn = property.targetTotalReturn !== undefined || Boolean(returnBreakdown);
  const returnText = targetReturnCopy[locale];
  const rentalModel = externalProperty?.rentalModel;
  const rentalText = rentalModelCopy[locale];
  const netMonthlyRent = Math.max(0, (monthlyRent ?? 0) - monthlyExpenses);
  const targetReturnLabel = returnText.targetTotalReturn;
  const financialSummary = (
    <div className="grid gap-4 xl:grid-cols-3">
      <PortalMetricCard primary title={copy.calculator.sharePrice} value={formatPortalMoney(sharePrice)} rows={[
        [copy.calculator.propertyValue, formatPortalMoney(propertyValue)],
        [labels.availableShares, availableShares.toLocaleString(localeHtmlLang[locale])],
        [labels.soldBlocked, blockedShares.toLocaleString(localeHtmlLang[locale])],
        [labels.totalShares, totalShares.toLocaleString(localeHtmlLang[locale])],
      ]} />
      <PortalMetricCard title={targetReturnLabel} value={formatPortalPercent(targetReturn)} rows={returnBreakdown ? [
        [rentalModel ? rentalText.rental : returnText.rental, formatPortalPercent(returnBreakdown.rental)],
        [returnText.vacationPoint, formatPortalPercent(returnBreakdown.vacationPoint)],
        [returnText.appreciation, formatPortalPercent(returnBreakdown.appreciation)],
      ] : [[returnText.annualPerShare, formatPortalMoney(projection.annualPerShare, 2)]]} />
      {rentalModel ? <PortalMetricCard title={rentalText.monthlyShare} value={formatPortalMoney(netMonthlyRent / totalShares, 2)} rows={[
        [rentalText.annualShare, formatPortalMoney(netMonthlyRent * 12 / totalShares, 2)],
        [rentalText.monthlyProperty, formatPortalMoney(netMonthlyRent, 2)],
        [rentalText.annualProperty, formatPortalMoney(netMonthlyRent * 12, 2)],
      ]} /> : <PortalMetricCard title={returnText.monthlyPerShare} value={formatPortalMoney(projection.monthlyPerShare, 2)} rows={[
        [returnText.annualPerShare, formatPortalMoney(projection.annualPerShare, 2)],
        [returnText.propertyMonthly, formatPortalMoney(projection.propertyMonthly, 2)],
        [returnText.propertyAnnual, formatPortalMoney(projection.propertyAnnual, 2)],
      ]} />}
      <p className="text-sm leading-6 text-[#687486] xl:col-span-3">{rentalModel ? rentalText.note : returnBreakdown ? returnText.modelNote : returnText.configuredTargetNote}</p>
      {property.slug === "sal-rei-boa-vista-b1-residences-ap1" && <p className="text-sm leading-6 text-[#687486] xl:col-span-3">{salReiModelCopy[locale]}</p>}
    </div>
  );
  const galleryImages: string[] =
    "image_urls" in property && Array.isArray(property.image_urls)
      ? property.image_urls.filter(Boolean)
      : property.image_url
        ? [property.image_url]
        : [];
  const isWahiEdmonton =
    property.slug === "edmonton-windsor-park-8712-120-st";
  const displayArea = isWahiEdmonton
    ? `${(2502).toLocaleString(localeHtmlLang[locale])} ${ui.squareFeet} (${ui.aboveGrade})`
    : property.area
      ? `${Number(property.area).toLocaleString(localeHtmlLang[locale])} m²`
      : "-";
  const displayRooms = property.bedrooms
    ? `${property.bedrooms} ${ui.beds}`
    : property.rooms
      ? `${property.rooms} ${ui.rooms}`
      : "-";
  const displayBathrooms = property.bathrooms
    ? `${property.bathrooms} ${ui.baths}`
    : "-";
  const locationSection = (
    <PropertyLocation property={baseProperty} title={property.title} address={property.address || property.city || copy.locationMissing} heading={copy.location} locale={locale} />
  );
  const constructionBadge = externalProperty?.constructionStatus ? (
    <div className="mt-3"><PropertyConstructionBadge status={externalProperty.constructionStatus} locale={locale} /></div>
  ) : null;
  if (!isAuthenticated) {
    return (
      <main className="min-h-screen bg-[#f4f6f8] text-[#17233f]">
        <section className="border-b border-[#dfe5eb] bg-white px-5 pb-8 pt-28 sm:px-6 md:pt-32">
          <div className="mx-auto max-w-6xl">
            <Link href="/properties" className="text-sm font-bold text-[#2f9bdb]">{copy.backToProperties}</Link>
            <h1 className="mt-6 text-4xl font-bold leading-tight md:text-6xl">{property.title}</h1>
            {constructionBadge}
            <p className="mt-3 text-lg text-[#687486]">{property.address || property.city || copy.locationMissing}</p>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-8 sm:px-6 md:py-12">
          {hasTargetReturn && <div className="mb-6">{financialSummary}</div>}
          <PropertyGallery images={galleryImages} title={property.title} locale={locale} />

          {!hasTargetReturn && <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <PublicFact label={labels.totalShares} value={totalShares?.toLocaleString(localeHtmlLang[locale]) || copy.onRequest} />
            <PublicFact label={labels.soldBlocked} value={blockedShares?.toLocaleString(localeHtmlLang[locale]) || "0"} />
            <PublicFact label={labels.availableShares} value={availableShares?.toLocaleString(localeHtmlLang[locale]) || copy.onRequest} accent />
            <PublicFact label={copy.calculator.sharePrice} value={formatMoney(sharePrice, copy)} />
          </div>}

          <div className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_0.6fr]">
            <article className="bg-white p-6 shadow-sm md:p-8">
              <h2 className="text-2xl font-bold">{copy.aboutHome}</h2>
              <p className="mt-4 leading-7 text-[#536077]">{property.description || labels.infoAvailable}</p>
              <div className="mt-7 grid gap-3 sm:grid-cols-2">
                <PublicDetail label={copy.location} value={property.address || property.city || "-"} />
                <PublicDetail label={copy.propertyType} value={property.property_type || copy.property} />
                <PublicDetail label={copy.bedroomsRooms} value={displayRooms} />
                <PublicDetail label={copy.bathrooms} value={displayBathrooms} />
                <PublicDetail label={copy.area} value={displayArea} />
                <PublicDetail label={copy.calculator.propertyValue} value={formatMoney(propertyValue, copy)} />
              </div>
            </article>

            <aside className="h-fit bg-[#17233f] p-6 text-white shadow-sm md:p-8">
              <p className="text-sm font-bold uppercase tracking-wide text-[#7dd3fc]">{labels.reservation}</p>
              <h2 className="mt-3 text-3xl font-bold">{availableShares?.toLocaleString(localeHtmlLang[locale]) || "0"} {copy.available}</h2>
              <p className="mt-4 leading-7 text-white/70">{labels.reserveText}</p>
              {hasTargetReturn && <p className="mt-4 font-bold">{copy.calculator.minimum}: {formatMinimumInvestment(locale)}{minInvestment !== null && <> / {minimumInvestmentShares(sharePrice, minInvestment)} {t("Shares")}</>}</p>}
              <Link href={`/sign-in?next=${encodeURIComponent(`/properties/${property.slug}`)}`} className="mt-7 block bg-[#2f9bdb] px-5 py-4 text-center font-bold text-white hover:bg-white hover:text-[#17233f]">{labels.reserveLogin}</Link>
              <Link href="/join" className="mt-3 block border border-white/30 px-5 py-4 text-center font-bold text-white hover:bg-white/10">{t("Create client account")}</Link>
            </aside>
          </div>
          {locationSection}
          {hasTargetReturn && <InvestmentCalculator rentalModel={rentalModel} annualYield={targetReturn} targetTotalReturn={targetReturn} availableShares={availableShares} copy={copy.calculator} fundedPercent={fundedPercent} isAuthenticated={false} minInvestment={minInvestment} locale={locale} currency={currency} returnBreakdown={returnBreakdown} totalShares={totalShares} monthlyRent={monthlyRent} monthlyExpenses={monthlyExpenses} propertySlug={property.slug} propertyTitle={property.title} propertyValue={propertyValue} sharePrice={sharePrice} />}
        </section>
      </main>
    );
  }

  if (isAuthenticated) {
    const claimEmail = user?.email || ui.client;
    const userMetadata = user?.user_metadata && typeof user.user_metadata === "object"
      ? user.user_metadata as Record<string, unknown>
      : {};
    const fullName = typeof userMetadata.full_name === "string" && userMetadata.full_name.trim()
      ? userMetadata.full_name
      : claimEmail.split("@")[0];

    return (
      <main className="min-h-screen bg-white text-[#17233f]">
        <ClientPortalSidebar active="property" email={claimEmail} fullName={fullName} locale={locale} />
        <div className="pt-16 lg:ml-[282px] lg:pt-0">
          <section className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8">
            {financialSummary}

            <div className="mt-6">
              <h1 className="text-xl font-bold text-[#17233f]">{property.title}</h1>
              {constructionBadge}
              <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[#596579]"><span className="inline-flex items-center gap-1"><BedDouble size={17} />{displayRooms}</span><span className="inline-flex items-center gap-1"><Bath size={17} />{displayBathrooms}</span><span>{displayArea}</span></p>
            </div>

            <div className="mt-4"><PortalPropertyGallery images={galleryImages} title={property.title} locale={locale} /></div>
            <p className="mt-4 text-[#7a8494]">{property.address || property.city || copy.locationMissing}</p>

            <div className="mt-5 grid gap-5 border-b border-[#e2e6eb] pb-7 xl:grid-cols-[1fr_auto] xl:items-end">
              <div className="text-left xl:text-right">
                <div className="flex gap-3 xl:justify-end"><a href="#buy-shares" className="inline-flex min-h-12 items-center bg-[#2f9bdb] px-8 font-bold text-white hover:bg-[#17233f]">{labels.buy}</a><Link href={`/contact?projekt=${encodeURIComponent(property.slug)}`} className="inline-flex min-h-12 items-center bg-[#f59a9f] px-8 font-bold text-white hover:bg-[#d97980]">{labels.sell}</Link></div>
                <p className="mt-4 font-bold text-[#7a8494]">{targetReturnLabel} <span className="text-[#168bd3]">{formatPortalPercent(targetReturn)}</span></p>
              </div>
            </div>

            <nav className="flex gap-6 overflow-x-auto border-b border-[#e2e6eb] py-5 text-sm font-bold text-[#9aa1ab]">
              <a href="#details" className="text-[#168bd3]">{t("Details")}</a><a href="#buy-shares">{t("Financial")}</a><a href="#buy-shares">{t("Order book")}</a><a href="#details">{t("Updates")}</a><a href="#details">{t("Documents")}</a><a href="#details">{t("Transfers")}</a><a href="#buy-shares">{t("Balance")}</a><a href="#details">{t("Reserve details")}</a><Link href="/dashboard#requests">{t("Orders")}</Link>
            </nav>

            {locationSection}
            <section id="details" className="scroll-mt-8 py-8">
              <h2 className="text-2xl font-bold">{copy.status}</h2>
              <p className="mt-4 text-[#7a8494]"><strong>{t("Status:")}</strong> {property.status === "active" ? copy.available : localizedStatus(property.status, locale, copy.onRequest)}</p>
              <h2 className="mt-8 text-3xl font-bold">{copy.aboutHome}</h2>
              <p className="mt-5 max-w-6xl text-lg leading-8 text-[#3d4b61]">{property.description || t("Property information is available from the Brickwise agent.")}</p>
              <div className="mt-8 grid gap-4 md:grid-cols-3"><PortalInfo title={copy.location} text={`${property.city || "-"}, ${property.address || "-"}`} /><PortalInfo title={copy.homeFacts} text={`${displayRooms}, ${displayBathrooms}, ${displayArea}`} /><PortalInfo title={copy.status} text={property.status === "active" ? copy.available : localizedStatus(property.status, locale, copy.onRequest)} /></div>
            </section>

            <div id="buy-shares" className="scroll-mt-8 border-t border-[#e2e6eb] pb-12 pt-2"><InvestmentCalculator rentalModel={rentalModel} annualYield={targetReturn} targetTotalReturn={hasTargetReturn ? targetReturn : undefined} availableShares={availableShares} copy={copy.calculator} fundedPercent={fundedPercent} isAuthenticated minInvestment={minInvestment} locale={locale} currency={currency} returnBreakdown={returnBreakdown} totalShares={totalShares} monthlyRent={monthlyRent} monthlyExpenses={monthlyExpenses} propertySlug={property.slug} propertyTitle={property.title} propertyValue={propertyValue} sharePrice={sharePrice} walletBalance={walletBalance} purchaseRequestId={randomUUID()} purchaseAction={createSharePurchaseRequest} /></div>
          </section>
        </div>
      </main>
    );
  }

  return null;
}

function PublicFact({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return <div className={`border p-5 ${accent ? "border-[#2f9bdb] bg-[#eaf6fd]" : "border-[#dfe5eb] bg-white"}`}><p className="text-sm font-bold text-[#687486]">{label}</p><p className={`mt-2 text-2xl font-bold ${accent ? "text-[#168bd3]" : "text-[#17233f]"}`}>{value}</p></div>;
}

function PublicDetail({ label, value }: { label: string; value: string }) {
  return <div className="border-b border-[#e4e8ed] py-3"><p className="text-xs font-bold uppercase tracking-wide text-[#7a8494]">{label}</p><p className="mt-1 font-bold text-[#17233f]">{value}</p></div>;
}

function PortalMetricCard({ title, value, rows, primary = false }: { title: string; value: string; rows: string[][]; primary?: boolean }) {
  return <div className={`rounded-xl border p-5 shadow-[0_5px_16px_rgba(23,35,63,0.1)] ${primary ? "border-[#168bd3] bg-[#2f9bdb] text-white" : "border-[#e1e5ea] bg-white"}`}><div className="flex items-center justify-between gap-4"><p className={`flex items-center gap-2 text-xl font-bold ${primary ? "text-white" : "text-[#168bd3]"}`}><Info size={17} />{title}</p><p className={`text-xl font-bold ${primary ? "text-white" : "text-[#168bd3]"}`}>{value}</p></div><div className="mt-4 grid gap-1.5 text-sm">{rows.map(([label, rowValue]) => <div key={label} className="flex items-center justify-between gap-4"><span className={primary ? "text-white/90" : "text-[#17233f]"}>{label}</span><span className={primary ? "font-bold text-white" : "text-[#168bd3]"}>{rowValue}</span></div>)}</div></div>;
}


function PortalInfo({ title, text }: { title: string; text: string }) {
  return <div className="bg-[#f5f7f9] p-5"><h3 className="font-bold">{title}</h3><p className="mt-2 leading-6 text-[#687486]">{text}</p></div>;
}

