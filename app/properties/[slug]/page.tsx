import { rentalModelCopy } from "../../lib/rental-model-copy";
import { salReiModelCopy } from "../../lib/sal-rei-model-copy";
import { cache } from "react";
import { randomUUID } from "node:crypto";
import { publicMetadata } from "../../lib/seo";
import { countLabel, formatPropertyPercent, propertyUiCopy } from "../property-ui-copy";
import { createTranslator } from "../../lib/translate";
import { formatMinimumInvestment, minimumInvestmentShares } from "../../lib/investment-policy";
import { formatPropertyMoney, getPropertyProjection, getPropertyCurrency, getPropertyReturnBreakdown, getPropertyShareSupply } from "../../lib/property-financials";
import { targetReturnCopy, rentalYieldLabel } from "../../lib/target-return-copy";
import { valueGrowthCopy } from "../../lib/value-growth-copy";
import { getPropertyTranslations, localizeProperty } from "../../lib/property-localization";
import { createClient } from "@/lib/supabase/server";
import { findCatalogueProperty, mapDatabaseProperty, type DatabasePropertyRow } from "@/app/lib/property-registry";
import { getCurrentUser } from "@/lib/supabase/auth";
import { isAdminUser } from "@/app/lib/admin";
import {
  getExternalPropertyBySlug,
  isPropertyOpenForInvestment,
  hiddenManualPropertySlugs,
} from "@/app/lib/external-properties";
import InvestmentCalculator from "./InvestmentCalculator";
import type { InvestmentCalculatorCopy } from "./InvestmentCalculator";
import PropertyGallery from "./PropertyGallery";
import PropertyLocation from "./PropertyLocation";
import PropertyOverview, { type OverviewFact } from "./PropertyOverview";
import { overviewCopy } from "./overview-copy";
import { listingBadgeCopy } from "../../lib/listing-badges";
import { portalNavCopy } from "../../lib/portal-nav-copy";
import type { ReactNode } from "react";
import PropertyConstructionBadge from "../../components/PropertyConstructionBadge";
import PropertyTierBadge from "../../components/PropertyTierBadge";
import { OccupancyBadge, StrategyBadge } from "../../components/PropertyListingBadges";
import PortalPropertyGallery from "./PortalPropertyGallery";
import ClientPortalSidebar from "@/app/components/ClientPortalSidebar";
import Link from "next/link";
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
    grossYield: "Net rental yield",
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
      grossYield: "Net rental yield",
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
      signInToRequest: "Create an account to request",
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
    grossYield: "Nettomietrendite",
    summary: "Immobilienübersicht",
    estimatedMortgagePayment: "Geschätzte Finanzierungsrate",
    mortgageEstimateNote: "Monatliche Zins- und Tilgungsschätzung mit 20% Eigenkapital bei 5,35%.",
    grossMonthlyRent: "Brutto-Monatsmiete",
    grossAnnualRent: "Brutto-Jahresmiete",
    accessFrom: "Zugang ab",
    payout: "Auszahlung",
    area: "Fläche",
    bedroomsRooms: "Zimmer",
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
      grossYield: "Nettomietrendite",
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
      signInToRequest: "Konto erstellen und anfragen",
      prepareFunding: "Finanzierung vorbereiten",
      note: "Diese Berechnung ist ein Bruttomodell und keine Anlageberatung. Kosten, Steuern, Leerstand, Finanzierung und Marktveränderungen können Ergebnisse reduzieren.",
      onRequest: "Auf Anfrage",
    },
  },
  fr: {} as DetailCopy,
  es: {} as DetailCopy,
  it: {} as DetailCopy,
};

detailCopy.fr = { ...detailCopy.en, onRequest:"Sur demande",property:"Bien",available:"Disponible",backToProperties:"Retour aux biens",locationMissing:"Emplacement non indiqué",forSale:"à vendre",estimatePayment:"Estimer le paiement",beds:"Chambres",baths:"Salles de bain",size:"Surface",aboutHome:"À propos de ce bien",highlights:"Points forts",homeFacts:"Caractéristiques",interior:"Intérieur",exterior:"Extérieur et terrain",location:"Emplacement",city:"Ville",community:"Quartier",province:"Province",expectedMonthlyRent:"Loyer mensuel estimé",incomePerShare:"Revenu par part",monthly:"mensuel",grossYield:"Rendement locatif net",summary:"Résumé du bien",estimatedMortgagePayment:"Paiement hypothécaire estimé",mortgageEstimateNote:"Estimation mensuelle du capital et des intérêts avec 20 % d’apport à 5,35 %.",grossMonthlyRent:"Loyer mensuel brut",grossAnnualRent:"Loyer annuel brut",accessFrom:"Investissement minimum",payout:"Versement",area:"Surface",bedroomsRooms:"Chambres / pièces",bathrooms:"Salles de bain",propertyType:"Type de bien",status:"Statut",askAbout:"Poser une question sur ce bien",mortgageOptions:"Options hypothécaires",mortgageAccessNotes:"Notes sur le financement et l’accès",reviewHome:"Examiner le bien",reviewHomeText:"Consultez la galerie, les caractéristiques, la description et l’emplacement avant votre demande.",estimatePaymentStep:"Estimer le paiement",estimatePaymentText:"Utilisez les outils pour modéliser l’apport, le taux, les frais et la mensualité.",contactTeam:"Contacter l’équipe",contactTeamText:"Demandez la disponibilité, les détails, les hypothèses de financement et les prochaines étapes.",rentalParticipationTitle:"Fonctionnement de la participation locative",chooseAmount:"Choisir le montant",chooseAmountText:"Sélectionnez un montant de participation modélisé, par exemple dès {minimum}.",rentModelled:"Loyer modélisé",rentModelledText:"Le loyer brut estimé est attribué proportionnellement dans le calculateur.",reviewPayout:"Examiner le versement",reviewPayoutText:"Le versement peut être affiché mensuellement ou annuellement selon le projet.",modelNote:"Toutes les valeurs sont des modèles bruts non garantis. Les coûts, taxes, vacances, financements et variations du marché peuvent réduire les résultats.",fallbackHighlights:["Opportunité immobilière internationale","Informations de projet structurées","Valeur du bien et hypothèses d’accès","Risques et processus de contact"],calculator:{...detailCopy.en.calculator,dashboardActive:"Tableau de bord actif",signInRequired:"Connexion requise",title:"Calculateur de parts et de revenu mensuel",text:"Choisissez le nombre de parts et consultez le bénéfice mensuel et annuel modélisé après les coûts.",propertyValue:"Valeur du bien",grossYield:"Rendement locatif net",minimum:"Minimum",sharePrice:"Prix par part",accessAmount:"Votre montant d’accès",choosePayoutModel:"Choisir le modèle de versement",monthly:"Mensuel",annual:"Annuel",amountAria:"Montant d’accès pour",enterAmount:"Saisir le montant",modelledShares:"Parts modélisées",monthlyGrossIncome:"Revenu brut mensuel",annualGrossIncome:"Revenu brut annuel",propertyExposure:"Exposition immobilière",fundingAfter:"Financement après votre demande",requestAmount:"Demander ce montant",signInToRequest:"Créer un compte pour demander",prepareFunding:"Préparer le financement",note:"Ce calcul est un modèle brut et non un conseil en investissement.",onRequest:"Sur demande"}};
detailCopy.es = { ...detailCopy.en, onRequest:"Bajo solicitud",property:"Propiedad",available:"Disponible",backToProperties:"Volver a propiedades",locationMissing:"Ubicación no indicada",forSale:"en venta",estimatePayment:"Estimar pago",beds:"Dormitorios",baths:"Baños",size:"Superficie",aboutHome:"Sobre esta propiedad",highlights:"Puntos destacados",homeFacts:"Características",interior:"Interior",exterior:"Exterior y terreno",location:"Ubicación",city:"Ciudad",community:"Zona",province:"Provincia",expectedMonthlyRent:"Alquiler mensual estimado",incomePerShare:"Ingreso por participación",monthly:"mensual",grossYield:"Rentabilidad neta del alquiler",summary:"Resumen de la propiedad",estimatedMortgagePayment:"Pago hipotecario estimado",mortgageEstimateNote:"Estimación mensual de capital e intereses con 20 % de entrada al 5,35 %.",grossMonthlyRent:"Alquiler bruto mensual",grossAnnualRent:"Alquiler bruto anual",accessFrom:"Inversión mínima",payout:"Pago",area:"Superficie",bedroomsRooms:"Dormitorios / habitaciones",bathrooms:"Baños",propertyType:"Tipo de propiedad",status:"Estado",askAbout:"Preguntar por esta propiedad",mortgageOptions:"Opciones hipotecarias",mortgageAccessNotes:"Notas de financiación y acceso",reviewHome:"Revisar la propiedad",reviewHomeText:"Consulta la galería, características, descripción y ubicación antes de solicitar información.",estimatePaymentStep:"Estimar pago",estimatePaymentText:"Utiliza las herramientas para calcular la entrada, los tipos, los costes y la cuota mensual.",contactTeam:"Contactar al equipo",contactTeamText:"Pregunta por disponibilidad, detalles, supuestos financieros y siguientes pasos.",rentalParticipationTitle:"Cómo funciona la participación de alquiler",chooseAmount:"Elegir importe",chooseAmountText:"Selecciona un importe modelizado, por ejemplo desde {minimum}.",rentModelled:"Alquiler modelado",rentModelledText:"El alquiler bruto estimado se asigna proporcionalmente en la calculadora.",reviewPayout:"Revisar pago",reviewPayoutText:"El pago puede mostrarse mensual o anual según el proyecto.",modelNote:"Todos los valores son modelos brutos no garantizados. Costes, impuestos, vacancia, financiación y mercado pueden reducir los resultados.",fallbackHighlights:["Oportunidad inmobiliaria internacional","Información estructurada del proyecto","Valor y condiciones de acceso","Riesgos y proceso de contacto"],calculator:{...detailCopy.en.calculator,dashboardActive:"Panel activo",signInRequired:"Inicio de sesión necesario",title:"Calculadora de participaciones e ingresos",text:"Elige participaciones y revisa el beneficio mensual y anual modelado tras los costes.",propertyValue:"Valor de la propiedad",grossYield:"Rentabilidad neta del alquiler",minimum:"Mínimo",sharePrice:"Precio por participación",accessAmount:"Tu importe de acceso",choosePayoutModel:"Elegir modelo de pago",monthly:"Mensual",annual:"Anual",amountAria:"Importe de acceso para",enterAmount:"Introducir importe",modelledShares:"Participaciones modeladas",monthlyGrossIncome:"Ingreso bruto mensual",annualGrossIncome:"Ingreso bruto anual",propertyExposure:"Exposición inmobiliaria",fundingAfter:"Financiación tras tu solicitud",requestAmount:"Solicitar este importe",signInToRequest:"Crea una cuenta para solicitar",prepareFunding:"Preparar financiación",note:"Este cálculo es un modelo bruto y no asesoramiento de inversión.",onRequest:"Bajo solicitud"}};
detailCopy.it = { ...detailCopy.en, onRequest:"Su richiesta",property:"Immobile",available:"Disponibile",backToProperties:"Torna agli immobili",locationMissing:"Posizione non indicata",forSale:"in vendita",estimatePayment:"Stima pagamento",beds:"Camere",baths:"Bagni",size:"Superficie",aboutHome:"Informazioni sull'immobile",highlights:"Punti principali",homeFacts:"Caratteristiche",interior:"Interni",exterior:"Esterno e terreno",location:"Posizione",city:"Città",community:"Zona",province:"Provincia",expectedMonthlyRent:"Affitto mensile previsto",incomePerShare:"Reddito per quota",monthly:"mensile",grossYield:"Rendimento netto da affitto",summary:"Riepilogo immobile",estimatedMortgagePayment:"Pagamento ipotecario stimato",mortgageEstimateNote:"Stima mensile di capitale e interessi con anticipo del 20% al 5,35%.",grossMonthlyRent:"Affitto lordo mensile",grossAnnualRent:"Affitto lordo annuale",accessFrom:"Accesso da",payout:"Pagamento",area:"Superficie",bedroomsRooms:"Camere / locali",bathrooms:"Bagni",propertyType:"Tipo di immobile",status:"Stato",askAbout:"Chiedi informazioni",mortgageOptions:"Opzioni mutuo",mortgageAccessNotes:"Note su finanziamento e accesso",reviewHome:"Esamina l'immobile",reviewHomeText:"Consulta galleria, caratteristiche, descrizione e posizione prima della richiesta.",estimatePaymentStep:"Stima il pagamento",estimatePaymentText:"Usa gli strumenti per modellare anticipo, tassi, costi e rata mensile.",contactTeam:"Contatta il team",contactTeamText:"Chiedi disponibilità, dettagli, ipotesi finanziarie e prossimi passi.",rentalParticipationTitle:"Come funziona la partecipazione locativa",chooseAmount:"Scegli l'importo",chooseAmountText:"Seleziona un importo modellato, ad esempio da {minimum}.",rentModelled:"Affitto modellato",rentModelledText:"L'affitto lordo previsto viene assegnato proporzionalmente nel calcolatore.",reviewPayout:"Esamina il pagamento",reviewPayoutText:"Il pagamento può essere mensile o annuale in base al progetto.",modelNote:"Tutti i valori sono modelli lordi non garantiti. Costi, tasse, sfitto, finanziamento e mercato possono ridurre i risultati.",fallbackHighlights:["Opportunità immobiliare internazionale","Informazioni strutturate sul progetto","Valore e ipotesi di accesso","Rischi e processo di contatto"],calculator:{...detailCopy.en.calculator,dashboardActive:"Dashboard attiva",signInRequired:"Accesso richiesto",title:"Calcolatore quote e reddito mensile",text:"Scegli le quote e consulta il profitto mensile e annuale modellato dopo i costi.",propertyValue:"Valore immobile",grossYield:"Rendimento netto da affitto",minimum:"Minimo",sharePrice:"Prezzo per quota",accessAmount:"Il tuo importo",choosePayoutModel:"Scegli il modello di pagamento",monthly:"Mensile",annual:"Annuale",amountAria:"Importo di accesso per",enterAmount:"Inserisci importo",modelledShares:"Quote modellate",monthlyGrossIncome:"Reddito lordo mensile",annualGrossIncome:"Reddito lordo annuale",propertyExposure:"Esposizione immobiliare",fundingAfter:"Finanziamento dopo la richiesta",requestAmount:"Richiedi questo importo",signInToRequest:"Crea un account per richiedere",prepareFunding:"Prepara finanziamento",note:"Questo calcolo è un modello lordo e non una consulenza in materia di investimenti.",onRequest:"Su richiesta"}};

const propertyLabels: Record<Locale, Record<string, string>> = {
  en: { totalShares:"Total shares", soldBlocked:"Sold / blocked", availableShares:"Available shares", projectedReturn:"Projected annual return", projectedDaily:"Projected daily / share", projectedWeekly:"Projected weekly / share", projectedMonthly:"Projected monthly / share", projectedAnnual:"Projected annual / share", active:"Active", paused:"Paused", infoAvailable:"Property information is available from the Brickwise agent.", reservation:"Share reservation", reserveText:"Log in or create a client account to choose and reserve shares.", reserveLogin:"Log in to reserve shares", rental:"Rental", currentReturn:"Current return", buy:"Buy", sell:"Sell", details:"Details", financial:"Financial", orderBook:"Order book", updates:"Updates", documents:"Documents", transfers:"Transfers", balance:"Balance", reserveDetails:"Reserve details", orders:"Orders", occupancy:"Occupancy status", incomeOverview:"Income overview", rentalIncome:"Rental income", noDescription:"No description available.", address:"Address", layout:"Layout", propertyStyle:"Property style" },
  de: { totalShares:"Anteile gesamt", soldBlocked:"Verkauft / blockiert", availableShares:"Verfügbare Anteile", projectedReturn:"Prognostizierte Jahresrendite", projectedDaily:"Prognose täglich / Anteil", projectedWeekly:"Prognose wöchentlich / Anteil", projectedMonthly:"Prognose monatlich / Anteil", projectedAnnual:"Prognose jährlich / Anteil", active:"Aktiv", paused:"Pausiert", infoAvailable:"Immobilieninformationen sind beim Brickwise Team verfügbar.", reservation:"Anteile reservieren", reserveText:"Melden Sie sich an oder erstellen Sie ein Konto, um Anteile zu reservieren.", reserveLogin:"Anmelden und Anteile reservieren", rental:"Mietertrag", currentReturn:"Aktuelle Rendite", buy:"Kaufen", sell:"Verkaufen", details:"Details", financial:"Finanzen", orderBook:"Orderbuch", updates:"Updates", documents:"Dokumente", transfers:"Transfers", balance:"Saldo", reserveDetails:"Reservedetails", orders:"Aufträge", occupancy:"Belegungsstatus", incomeOverview:"Ertragsübersicht", rentalIncome:"Mietertrag", noDescription:"Keine Beschreibung verfügbar.", address:"Adresse", layout:"Grundriss", propertyStyle:"Immobilienstil" },
  fr: { totalShares:"Parts totales", soldBlocked:"Vendues / bloquées", availableShares:"Parts disponibles", projectedReturn:"Rendement annuel projeté", projectedDaily:"Projection quotidienne / part", projectedWeekly:"Projection hebdomadaire / part", projectedMonthly:"Projection mensuelle / part", projectedAnnual:"Projection annuelle / part", active:"Actif", paused:"En pause", infoAvailable:"Les informations sont disponibles auprès de l’équipe Brickwise.", reservation:"Réservation de parts", reserveText:"Connectez-vous ou créez un compte pour choisir et réserver des parts.", reserveLogin:"Se connecter pour réserver", rental:"Revenu locatif", currentReturn:"Rendement actuel", buy:"Acheter", sell:"Vendre", details:"Détails", financial:"Finances", orderBook:"Carnet d’ordres", updates:"Actualités", documents:"Documents", transfers:"Transferts", balance:"Solde", reserveDetails:"Détails de réserve", orders:"Ordres", occupancy:"Statut d’occupation", incomeOverview:"Aperçu des revenus", rentalIncome:"Revenu locatif", noDescription:"Aucune description disponible.", address:"Adresse", layout:"Agencement", propertyStyle:"Style du bien" },
  es: { totalShares:"Participaciones totales", soldBlocked:"Vendidas / bloqueadas", availableShares:"Participaciones disponibles", projectedReturn:"Rendimiento anual proyectado", projectedDaily:"Proyección diaria / participación", projectedWeekly:"Proyección semanal / participación", projectedMonthly:"Proyección mensual / participación", projectedAnnual:"Proyección anual / participación", active:"Activo", paused:"En pausa", infoAvailable:"La información está disponible a través del equipo Brickwise.", reservation:"Reserva de participaciones", reserveText:"Inicia sesión o crea una cuenta para elegir y reservar participaciones.", reserveLogin:"Iniciar sesión para reservar", rental:"Alquiler", currentReturn:"Rentabilidad actual", buy:"Comprar", sell:"Vender", details:"Detalles", financial:"Finanzas", orderBook:"Libro de órdenes", updates:"Novedades", documents:"Documentos", transfers:"Transferencias", balance:"Saldo", reserveDetails:"Detalles de reserva", orders:"Órdenes", occupancy:"Estado de ocupación", incomeOverview:"Resumen de ingresos", rentalIncome:"Ingresos por alquiler", noDescription:"Sin descripción disponible.", address:"Dirección", layout:"Distribución", propertyStyle:"Estilo de propiedad" },
  it: { totalShares:"Quote totali", soldBlocked:"Vendute / bloccate", availableShares:"Quote disponibili", projectedReturn:"Rendimento annuo previsto", projectedDaily:"Proiezione giornaliera / quota", projectedWeekly:"Proiezione settimanale / quota", projectedMonthly:"Proiezione mensile / quota", projectedAnnual:"Proiezione annuale / quota", active:"Attivo", paused:"In pausa", infoAvailable:"Le informazioni sono disponibili presso il team Brickwise.", reservation:"Prenotazione quote", reserveText:"Accedi o crea un account per scegliere e prenotare le quote.", reserveLogin:"Accedi per prenotare", rental:"Affitto", currentReturn:"Rendimento attuale", buy:"Acquista", sell:"Vendi", details:"Dettagli", financial:"Finanze", orderBook:"Libro ordini", updates:"Aggiornamenti", documents:"Documenti", transfers:"Trasferimenti", balance:"Saldo", reserveDetails:"Dettagli riserva", orders:"Ordini", occupancy:"Stato di occupazione", incomeOverview:"Panoramica reddito", rentalIncome:"Reddito locativo", noDescription:"Nessuna descrizione disponibile.", address:"Indirizzo", layout:"Disposizione", propertyStyle:"Stile immobile" },
};


const getSeoProperty = cache(async (slug: string) => {
  if (hiddenManualPropertySlugs.includes(slug)) notFound();
  const external = await findCatalogueProperty(slug);
  if (external) return external;
  const supabase = await createClient();
  const { data, error } = await supabase.from("properties").select("*").eq("slug", slug).in("status", ["active", "available"]).maybeSingle();
  // A database outage must not tell crawlers the listing is gone (404); only a missing row does.
  if (error) throw new Error("Property could not be loaded");
  if (!data) notFound();
  // Admin-added properties use the same listing model as the catalogue (rent, costs, share price).
  return mapDatabaseProperty(data as DatabasePropertyRow);
});
export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;
  const locale = await getCurrentLocale();
  const property = localizeProperty(await getSeoProperty(slug), await getPropertyTranslations(locale));
  const metadata = publicMetadata('/properties/' + encodeURIComponent(slug), locale, { title: property.title, description: property.description || property.title, image: property.image_url });
  // Unlisted listings stay reachable for existing holders but are kept out of search engines.
  return getExternalPropertyBySlug(slug)?.listed === false ? { ...metadata, robots: { index: false, follow: false } } : metadata;
}

const stickyReserveCopy: Record<Locale, string> = {
  en: "Reserve shares",
  de: "Anteile reservieren",
  fr: "Réserver des parts",
  es: "Reservar participaciones",
  it: "Prenota quote",
};

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

  const externalProperty = await findCatalogueProperty(slug);
  const supabase = await createClient();

  const baseProperty = await getSeoProperty(slug);

  const property = localizeProperty(baseProperty, await getPropertyTranslations(locale));
  const currency = getPropertyCurrency(property);
  function formatPortalMoney(value: number | null | undefined, digits = 0) {
    return value == null || !Number.isFinite(value) ? copy.onRequest : formatPropertyMoney(value, currency, locale, digits);
  }

  const user = await getCurrentUser();
  // Administrators see the public page; the client view is only for clients.
  const isAuthenticated = Boolean(user) && !isAdminUser(user);
  const walletResult = user && isAuthenticated ? await supabase
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
  const openForInvestment = isPropertyOpenForInvestment(baseProperty);
  // null disables share selection in the calculator for listings closed to new investment.
  const tierMinimum = baseProperty.minInvestmentEur;
  const minInvestment = openForInvestment ? tierMinimum : null;
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
  const targetReturnLabel = rentalYieldLabel(locale, (externalProperty ?? baseProperty).costsStated);
  // Value growth is shown beside the rental yield; rent projections and payouts never include it.
  const valueGrowth = baseProperty.valueGrowthYield ?? 0;
  const growthText = valueGrowthCopy[locale];
  const galleryImages: string[] =
    "image_urls" in property && Array.isArray(property.image_urls)
      ? property.image_urls.filter(Boolean)
      : property.image_url
        ? [property.image_url]
        : [];
  const isWahiEdmonton =
    property.slug === "edmonton-windsor-park-8712-120-st";
  const displayArea = isWahiEdmonton
    ? `${(2502).toLocaleString(localeHtmlLang[locale])} ${ui.squareFeet} (≈ ${Math.round(2502 * 0.092903).toLocaleString(localeHtmlLang[locale])} m², ${ui.aboveGrade})`
    : property.area
      ? `${Number(property.area).toLocaleString(localeHtmlLang[locale])} m²`
      : "-";
  const displayRooms = property.bedrooms
    ? countLabel(Number(property.bedrooms), ui.bed, ui.beds, locale)
    : property.rooms
      ? countLabel(Number(property.rooms), ui.room, ui.rooms, locale)
      : "-";
  const displayBathrooms = property.bathrooms
    ? countLabel(Number(property.bathrooms), ui.bath, ui.baths, locale)
    : "-";
  const locationSection = (
    <PropertyLocation property={baseProperty} title={property.title} address={property.address || property.city || copy.locationMissing} heading={copy.location} locale={locale} />
  );
  const constructionStatus = (externalProperty ?? baseProperty).constructionStatus;
  const investmentTier = baseProperty.investmentTier;
  const { strategy, occupancyStatus } = baseProperty;
  const showOccupancy = Boolean(occupancyStatus) && (!constructionStatus || constructionStatus === "completed");
  const constructionBadge = constructionStatus || strategy || showOccupancy || (investmentTier && investmentTier !== "standard") ? (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      {showOccupancy ? <OccupancyBadge status={occupancyStatus} locale={locale} /> : <PropertyConstructionBadge status={constructionStatus} locale={locale} />}
      <PropertyTierBadge tier={investmentTier} locale={locale} />
      <StrategyBadge strategy={strategy} locale={locale} className="py-1.5 text-sm" />
    </div>
  ) : null;
  const overview = overviewCopy[locale];
  const badgeText = listingBadgeCopy[locale];
  const lang = localeHtmlLang[locale];
  const costsStated = (externalProperty ?? baseProperty).costsStated !== false;
  const yearlyReturn = targetReturn + valueGrowth;
  const facts: OverviewFact[] = [
    { kind: "location", title: property.city || property.address || copy.locationMissing, text: property.address || property.city || copy.locationMissing },
    ...(monthlyRent ? [{ kind: "rent" as const, title: overview.currentRent.replace("{amount}", formatPortalMoney(monthlyRent)),
      text: showOccupancy && occupancyStatus ? `${badgeText.occupancy[occupancyStatus]} · ${overview.rentShared}` : overview.rentShared }] : []),
    ...(hasTargetReturn ? [{ kind: "yield" as const, title: overview.yieldLine.replace("{rate}", formatPortalPercent(targetReturn)), text: costsStated ? overview.afterCosts : overview.beforeCosts }] : []),
    ...(valueGrowth > 0 ? [{ kind: "growth" as const, title: overview.growthLine.replace("{rate}", formatPortalPercent(valueGrowth)), text: overview.growthEstimate }] : []),
  ];
  const financials: { title: string; rows: [string, string][] }[] = [
    { title: overview.propertyColumn, rows: [
      [copy.calculator.propertyValue, formatPortalMoney(propertyValue)],
      [copy.calculator.sharePrice, formatPortalMoney(sharePrice)],
      [labels.totalShares, totalShares.toLocaleString(lang)],
      [labels.availableShares, availableShares.toLocaleString(lang)],
    ] },
    ...(hasTargetReturn && monthlyRent ? [{ title: overview.rentalColumn, rows: [
      [overview.grossRent, formatPortalMoney(monthlyRent * 12)],
      [overview.costs, formatPortalMoney(monthlyExpenses * 12)],
      [overview.netRent, formatPortalMoney(netMonthlyRent * 12)],
      [returnText.monthlyPerShare, formatPortalMoney(projection.monthlyPerShare, 2)],
    ] as [string, string][] }] : []),
  ];
  // A five-year figure only on a net yield: multiplying a before-costs yield would overstate it.
  const metrics: [string, string][] = hasTargetReturn ? [
    ...(costsStated ? [[badgeText.fiveYearReturn, formatPortalPercent(yearlyReturn * 5)] as [string, string]] : []),
    ...(valueGrowth > 0 ? [[badgeText.yearlyReturn, formatPortalPercent(yearlyReturn)] as [string, string]] : []),
    [targetReturnLabel, formatPortalPercent(targetReturn)],
  ] : [];
  const minimumText = `${formatMinimumInvestment(locale, tierMinimum)}${minInvestment !== null ? ` · ${minimumInvestmentShares(sharePrice, minInvestment)} ${t("Shares")}` : ""}`;
  const investCard = (cta: ReactNode, note?: string) => ({
    valueLabel: copy.calculator.propertyValue, value: formatPortalMoney(propertyValue), fundedPercent,
    fundedText: `${Math.round(fundedPercent).toLocaleString(lang)}% ${badgeText.funded}`,
    availableText: overview.available.replace("{amount}", formatPortalMoney(availableShares * sharePrice)),
    perSqm: propertyValue && Number(property.area) > 0 ? `${formatPortalMoney(propertyValue / Number(property.area))} / m²` : undefined,
    metrics, minimumLabel: copy.calculator.minimum, minimum: minimumText, cta, note,
  });
  const chips = [displayRooms, displayBathrooms, displayArea].filter((value) => value && value !== "-");
  const modelNote = rentalModel ? (returnBreakdown ? `${rentalText.note} ${returnText.modelNote}` : rentalText.note) : returnBreakdown ? returnText.modelNote : returnText.configuredTargetNote;
  const notes = <div className="mt-10 grid gap-2 text-xs leading-5 text-muted">
    {valueGrowth > 0 && <p>{growthText.note}</p>}
    {hasTargetReturn && <p>{modelNote}</p>}
    {property.slug === "sal-rei-boa-vista-b1-residences-ap1" && <p>{salReiModelCopy[locale]}</p>}
  </div>;
  const primaryCta = "rounded-xl bg-brand px-5 py-3.5 text-center font-bold text-white transition hover:bg-brand-strong";
  const secondaryCta = "rounded-xl border border-line px-5 py-3.5 text-center font-bold text-ink transition hover:bg-canvas";

  if (!isAuthenticated) {
    return (
      <main className="min-h-screen bg-canvas text-ink">
        <section className="px-5 pb-16 pt-24 sm:px-6 md:pt-28">
          <PropertyOverview locale={locale} back={{ href: "/properties", label: copy.backToProperties }}
            gallery={<PropertyGallery images={galleryImages} title={property.title} locale={locale} />}
            title={property.title} chips={chips} badges={constructionBadge} facts={facts} description={property.description || labels.infoAvailable}
            strategy={strategy} financials={financials} stickyTop="lg:top-28"
            card={investCard(<>
              <Link href={`/join?next=${encodeURIComponent(`/properties/${property.slug}`)}`} className={primaryCta}>{t("Create client account")}</Link>
              <Link href={`/sign-in?next=${encodeURIComponent(`/properties/${property.slug}`)}`} className={secondaryCta}>{labels.reserveLogin}</Link>
            </>, labels.reserveText)}>
            <div className="mt-10">{locationSection}</div>
            {hasTargetReturn && <div className="mt-10"><InvestmentCalculator rentalModel={rentalModel} annualYield={targetReturn} targetTotalReturn={targetReturn} availableShares={availableShares} copy={copy.calculator} fundedPercent={fundedPercent} isAuthenticated={false} minInvestment={minInvestment} locale={locale} currency={currency} returnBreakdown={returnBreakdown} valueGrowthRate={valueGrowth} totalShares={totalShares} monthlyRent={monthlyRent} monthlyExpenses={monthlyExpenses} propertySlug={property.slug} propertyTitle={property.title} propertyValue={propertyValue} sharePrice={sharePrice} /></div>}
            {notes}
          </PropertyOverview>
        </section>
        {/* Phones: the investment card sits below the story, so keep a way to reach it on screen. The right side stays free for the chat button. */}
        {openForInvestment && <div className="fixed inset-x-0 bottom-0 z-[75] flex items-center gap-3 border-t border-line bg-white/95 py-3 pl-4 pr-20 shadow-[0_-8px_24px_rgba(20,33,61,0.08)] backdrop-blur pb-[calc(0.75rem+env(safe-area-inset-bottom))] lg:hidden">
          <p className="min-w-0 flex-1 text-xs leading-5 text-muted"><span className="block truncate">{copy.calculator.minimum}</span><strong className="block truncate text-sm text-ink">{formatMinimumInvestment(locale, tierMinimum)}</strong></p>
          <a href="#reserve" className="inline-flex min-h-11 shrink-0 items-center rounded-lg bg-brand px-4 text-sm font-bold text-white hover:bg-brand-strong">{stickyReserveCopy[locale]}</a>
        </div>}
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
      <main className="min-h-screen bg-canvas text-ink">
        <ClientPortalSidebar active="property" email={claimEmail} fullName={fullName} locale={locale} />
        <div className="pt-16 lg:ml-[282px] lg:pt-0">
          <section className="px-4 py-6 sm:px-6 lg:px-8">
            <PropertyOverview locale={locale} back={{ href: "/dashboard/marketplace", label: portalNavCopy[locale].marketplace }}
              gallery={<PortalPropertyGallery images={galleryImages} title={property.title} locale={locale} />}
              title={property.title} chips={chips} badges={constructionBadge} facts={facts} description={property.description || t("Property information is available from the Brickwise agent.")}
              strategy={strategy} financials={financials} stickyTop="lg:top-6"
              card={investCard(<>
                {openForInvestment && <a href="#buy-shares" className={primaryCta}>{overview.investNow}</a>}
                <Link href={`/contact?projekt=${encodeURIComponent(property.slug)}`} className={secondaryCta}>{labels.sell}</Link>
              </>)}>
              <div className="mt-10">{locationSection}</div>
              <div id="buy-shares" className="mt-10 scroll-mt-8"><InvestmentCalculator rentalModel={rentalModel} annualYield={targetReturn} targetTotalReturn={hasTargetReturn ? targetReturn : undefined} availableShares={availableShares} copy={copy.calculator} fundedPercent={fundedPercent} isAuthenticated minInvestment={minInvestment} locale={locale} currency={currency} returnBreakdown={returnBreakdown} valueGrowthRate={valueGrowth} totalShares={totalShares} monthlyRent={monthlyRent} monthlyExpenses={monthlyExpenses} propertySlug={property.slug} propertyTitle={property.title} propertyValue={propertyValue} sharePrice={sharePrice} walletBalance={walletBalance} purchaseRequestId={randomUUID()} purchaseAction={createSharePurchaseRequest} /></div>
              {notes}
            </PropertyOverview>
          </section>
        </div>
      </main>
    );
  }

  return null;
}
