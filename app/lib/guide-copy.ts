import type { Locale } from "./i18n";

type GuideCopy = { title: string; intro: string; items: [string, string][]; reviewTitle: string; review: string[]; start: string; startText: string; properties: string; policyTitle: string; policyIntro: string; policy: string; guidelines: [string, string][] };
export const guideCopy: Record<Locale, GuideCopy> = {
  "en": {
    "title": "Real estate investing",
    "intro": "Review property values in EUR and annual target returns, with a monthly equivalent calculated as the annual amount divided by 12.",
    "items": [
      [
        "Choose a property",
        "Compare property values, share prices, annual targets and separately identified rental assumptions."
      ],
      [
        "Calculate your amount",
        "Choose an investment from {minimum}. Annual target = investment × annual rate; monthly target = annual target ÷ 12."
      ],
      [
        "Send a request",
        "After signing in, submit a non-binding request and review the next steps with BRICKWISE."
      ],
      [
        "Prepare funding",
        "Funding instructions are handled after review and confirmation. Do not send funds before receiving verified instructions."
      ]
    ],
    "reviewTitle": "What to review",
    "review": [
      "Property value compared with expected annual rent",
      "Location, tenant demand, vacancy risk, and property condition",
      "Minimum amount, payout model, and cost assumptions",
      "Risk notes, tax questions, and your own liquidity needs"
    ],
    "start": "Start directly",
    "startText": "Open the current properties and test the calculator inside each property page.",
    "properties": "View properties",
    "policyTitle": "Investor Policy",
    "policyIntro": "Principles for transparent, traceable, and risk-aware use of the BRICKWISE platform.",
    "policy": "Policy",
    "guidelines": [
      [
        "Transparent project review",
        "Market, property value, rent assumptions, project data, and economic plausibility are reviewed before publication."
      ],
      [
        "Clear model calculations",
        "Annual target models combine the listed return components. Their monthly equivalent is annual ÷ 12. Rental operating income, non-cash benefits and actual payments are identified separately."
      ],
      [
        "Identity and communication",
        "Investors should register with accurate contact details so questions, documents, and funding references can be assigned correctly."
      ],
      [
        "Verified funding",
        "Funding instructions are provided only after review and confirmation. Users should not send funds to unverified accounts or wallets."
      ],
      [
        "Risk awareness",
        "Participation should only be considered where the investor understands the risks and can financially bear a potential loss."
      ]
    ]
  },
  "de": {
    "title": "In Immobilien investieren",
    "intro": "Vergleichen Sie Immobilienwerte in EUR und jährliche Renditeziele. Der monatliche Vergleichswert ist der Jahresbetrag geteilt durch 12.",
    "items": [
      [
        "Immobilie auswählen",
        "Vergleichen Sie Immobilienwerte, Anteilspreise, Jahresziele und gesondert ausgewiesene Mietannahmen."
      ],
      [
        "Betrag berechnen",
        "Wählen Sie eine Investition ab {minimum}. Jahresziel = Investition × Jahresrendite; Monatsziel = Jahresziel ÷ 12."
      ],
      [
        "Anfrage senden",
        "Melden Sie sich an, senden Sie eine unverbindliche Anfrage und besprechen Sie die nächsten Schritte mit BRICKWISE."
      ],
      [
        "Finanzierung vorbereiten",
        "Zahlungsanweisungen werden nach Prüfung und Bestätigung erteilt. Überweisen Sie erst nach Erhalt geprüfter Anweisungen."
      ]
    ],
    "reviewTitle": "Was Sie prüfen sollten",
    "review": [
      "Immobilienwert im Vergleich zur erwarteten Jahresmiete",
      "Standort, Mietnachfrage, Leerstandsrisiko und Zustand",
      "Mindestbetrag, Ausschüttungsmodell und Kostenannahmen",
      "Risikohinweise, Steuerfragen und eigener Liquiditätsbedarf"
    ],
    "start": "Direkt starten",
    "startText": "Öffnen Sie die aktuellen Immobilien und testen Sie den Rechner auf der jeweiligen Detailseite.",
    "properties": "Immobilien ansehen",
    "policyTitle": "Anlegerrichtlinie",
    "policyIntro": "Grundsätze für die transparente, nachvollziehbare und risikobewusste Nutzung der BRICKWISE-Plattform.",
    "policy": "Grundsatz",
    "guidelines": [
      [
        "Transparente Projektprüfung",
        "Markt, Immobilienwert, Mietannahmen, Projektdaten und wirtschaftliche Plausibilität werden vor der Veröffentlichung geprüft."
      ],
      [
        "Klare Modellrechnungen",
        "Jahresziele bestehen aus den angegebenen Renditebestandteilen. Der Monatswert ist Jahresbetrag ÷ 12. Mieterträge, nicht ausgezahlte Vorteile und tatsächliche Zahlungen werden getrennt ausgewiesen."
      ],
      [
        "Identität und Kommunikation",
        "Anleger sollten sich mit korrekten Kontaktdaten registrieren, damit Fragen, Dokumente und Zahlungsreferenzen richtig zugeordnet werden können."
      ],
      [
        "Geprüfte Finanzierung",
        "Zahlungsanweisungen werden erst nach Prüfung und Bestätigung bereitgestellt. Nutzer sollten kein Geld an ungeprüfte Konten oder Wallets senden."
      ],
      [
        "Risikobewusstsein",
        "Eine Beteiligung sollte nur erwogen werden, wenn der Anleger die Risiken versteht und einen möglichen Verlust finanziell tragen kann."
      ]
    ]
  },
  "fr": {
    "title": "Investir dans l'immobilier",
    "intro": "Comparez les valeurs immobilières en EUR et les objectifs annuels. L'équivalent mensuel est le montant annuel divisé par 12.",
    "items": [
      [
        "Choisir un bien",
        "Comparez les valeurs, prix par part, objectifs annuels et hypothèses locatives distinctes."
      ],
      [
        "Calculer votre montant",
        "Choisissez un investissement à partir de {minimum}. Objectif annuel = investissement × taux annuel ; objectif mensuel = objectif annuel ÷ 12."
      ],
      [
        "Envoyer une demande",
        "Après connexion, envoyez une demande sans engagement et examinez les prochaines étapes avec BRICKWISE."
      ],
      [
        "Préparer le financement",
        "Les instructions sont fournies après vérification et confirmation. N'envoyez aucun fonds avant de recevoir des instructions vérifiées."
      ]
    ],
    "reviewTitle": "Points à examiner",
    "review": [
      "Valeur du bien comparée au loyer annuel attendu",
      "Emplacement, demande locative, vacance et état du bien",
      "Montant minimal, modèle de versement et hypothèses de coûts",
      "Risques, questions fiscales et besoins personnels de liquidité"
    ],
    "start": "Commencer directement",
    "startText": "Ouvrez les biens disponibles et testez le calculateur sur chaque fiche.",
    "properties": "Voir les biens",
    "policyTitle": "Politique des investisseurs",
    "policyIntro": "Principes d'utilisation transparente, traçable et consciente des risques de la plateforme BRICKWISE.",
    "policy": "Principe",
    "guidelines": [
      [
        "Examen transparent des projets",
        "Marché, valeur immobilière, hypothèses locatives, données du projet et plausibilité économique sont examinés avant publication."
      ],
      [
        "Calculs modélisés clairs",
        "Les objectifs annuels combinent les composantes indiquées. L'équivalent mensuel est le montant annuel ÷ 12. Loyers, avantages non monétaires et paiements réels sont distingués."
      ],
      [
        "Identité et communication",
        "Les investisseurs doivent fournir des coordonnées exactes pour attribuer correctement questions, documents et références de financement."
      ],
      [
        "Financement vérifié",
        "Les instructions ne sont fournies qu'après vérification et confirmation. N'envoyez pas de fonds vers des comptes ou portefeuilles non vérifiés."
      ],
      [
        "Conscience des risques",
        "Une participation ne doit être envisagée que si l'investisseur comprend les risques et peut supporter financièrement une perte potentielle."
      ]
    ]
  },
  "es": {
    "title": "Inversión inmobiliaria",
    "intro": "Compara valores inmobiliarios en EUR y objetivos anuales. El equivalente mensual es el importe anual dividido entre 12.",
    "items": [
      [
        "Elegir una propiedad",
        "Compara valores, precios por participación, objetivos anuales e hipótesis de alquiler por separado."
      ],
      [
        "Calcular tu importe",
        "Elige una inversión desde {minimum}. Objetivo anual = inversión × tasa anual; objetivo mensual = objetivo anual ÷ 12."
      ],
      [
        "Enviar una solicitud",
        "Tras iniciar sesión, envía una solicitud no vinculante y revisa los próximos pasos con BRICKWISE."
      ],
      [
        "Preparar la financiación",
        "Las instrucciones se facilitan tras revisión y confirmación. No envíes fondos antes de recibir instrucciones verificadas."
      ]
    ],
    "reviewTitle": "Qué revisar",
    "review": [
      "Valor del inmueble frente al alquiler anual previsto",
      "Ubicación, demanda, riesgo de desocupación y estado del inmueble",
      "Importe mínimo, modelo de pago e hipótesis de costes",
      "Riesgos, cuestiones fiscales y tus necesidades de liquidez"
    ],
    "start": "Empieza directamente",
    "startText": "Abre las propiedades disponibles y prueba la calculadora de cada ficha.",
    "properties": "Ver propiedades",
    "policyTitle": "Política del inversor",
    "policyIntro": "Principios para utilizar BRICKWISE de forma transparente, trazable y consciente de los riesgos.",
    "policy": "Principio",
    "guidelines": [
      [
        "Revisión transparente",
        "El mercado, valor, hipótesis de alquiler, datos del proyecto y plausibilidad económica se revisan antes de publicar."
      ],
      [
        "Cálculos claros",
        "Los objetivos anuales combinan los componentes indicados. El equivalente mensual es el importe anual ÷ 12. Se distinguen alquileres, beneficios no monetarios y pagos reales."
      ],
      [
        "Identidad y comunicación",
        "Los inversores deben registrarse con datos de contacto correctos para asignar adecuadamente preguntas, documentos y referencias de financiación."
      ],
      [
        "Financiación verificada",
        "Las instrucciones se facilitan solo tras revisión y confirmación. No deben enviarse fondos a cuentas o monederos no verificados."
      ],
      [
        "Conocimiento del riesgo",
        "Solo debe considerarse participar si el inversor comprende los riesgos y puede asumir financieramente una posible pérdida."
      ]
    ]
  },
  "it": {
    "title": "Investimenti immobiliari",
    "intro": "Confronta valori immobiliari in EUR e obiettivi annui. L'equivalente mensile è l'importo annuo diviso per 12.",
    "items": [
      [
        "Scegli un immobile",
        "Confronta valori, prezzi per quota, obiettivi annui e ipotesi di affitto indicate separatamente."
      ],
      [
        "Calcola il tuo importo",
        "Scegli un investimento da {minimum}. Obiettivo annuo = investimento × tasso annuo; obiettivo mensile = obiettivo annuo ÷ 12."
      ],
      [
        "Invia una richiesta",
        "Dopo l'accesso, invia una richiesta non vincolante e valuta i prossimi passi con BRICKWISE."
      ],
      [
        "Prepara il finanziamento",
        "Le istruzioni vengono fornite dopo verifica e conferma. Non inviare fondi prima di ricevere istruzioni verificate."
      ]
    ],
    "reviewTitle": "Cosa esaminare",
    "review": [
      "Valore immobiliare rispetto al canone annuo previsto",
      "Posizione, domanda locativa, rischio di sfitto e condizioni",
      "Importo minimo, modello di pagamento e ipotesi di costo",
      "Rischi, questioni fiscali e proprie esigenze di liquidità"
    ],
    "start": "Inizia subito",
    "startText": "Apri gli immobili disponibili e prova il calcolatore in ogni scheda.",
    "properties": "Vedi immobili",
    "policyTitle": "Politica per gli investitori",
    "policyIntro": "Principi per un uso trasparente, tracciabile e consapevole dei rischi della piattaforma BRICKWISE.",
    "policy": "Principio",
    "guidelines": [
      [
        "Verifica trasparente",
        "Mercato, valore, ipotesi di affitto, dati di progetto e plausibilità economica vengono esaminati prima della pubblicazione."
      ],
      [
        "Calcoli chiari",
        "Gli obiettivi annui combinano le componenti indicate. L'equivalente mensile è l'importo annuo ÷ 12. Affitti, benefici non monetari e pagamenti effettivi sono distinti."
      ],
      [
        "Identità e comunicazione",
        "Gli investitori devono registrarsi con contatti corretti affinché domande, documenti e riferimenti di finanziamento siano assegnati correttamente."
      ],
      [
        "Finanziamento verificato",
        "Le istruzioni sono fornite solo dopo verifica e conferma. Non inviare fondi a conti o wallet non verificati."
      ],
      [
        "Consapevolezza dei rischi",
        "La partecipazione va considerata solo se l'investitore comprende i rischi e può sostenere finanziariamente una possibile perdita."
      ]
    ]
  }
};
