import type { Locale } from "./i18n";

type AgentLedCopy = {
  talkToAgent: string;
  monthlyRent: string;
  propertyValue: string;
  viewProperty: string;
  note: string;
  requestMessage: string;
  steps: [string, string][];
};

/** Texts for premium and super premium properties, which are sold through an agent without published share terms. */
export const agentLedCopy: Record<Locale, AgentLedCopy> = {
  en: {
    talkToAgent: "Talk to an agent",
    monthlyRent: "Monthly rent",
    propertyValue: "Property value",
    viewProperty: "View property",
    note: "Investment terms for this property are discussed personally with a Brickwise agent.",
    requestMessage: "I would like to talk to a Brickwise agent about investing in “{title}”. Please contact me.",
    steps: [
      ["Contact an agent", "Send a request and a verified Brickwise agent contacts you personally."],
      ["Discuss the terms", "The agent explains the structure, amount and risks of investing in this property."],
      ["Sign and invest", "You sign the agreement and the investment appears in your client panel."],
    ],
  },
  de: {
    talkToAgent: "Mit einem Agenten sprechen",
    monthlyRent: "Monatliche Miete",
    propertyValue: "Immobilienwert",
    viewProperty: "Immobilie ansehen",
    note: "Die Investitionsbedingungen für diese Immobilie besprechen Sie persönlich mit einem Brickwise-Agenten.",
    requestMessage: "Ich möchte mit einem Brickwise-Agenten über eine Investition in „{title}“ sprechen. Bitte kontaktieren Sie mich.",
    steps: [
      ["Agenten kontaktieren", "Senden Sie eine Anfrage, und ein verifizierter Brickwise-Agent meldet sich persönlich bei Ihnen."],
      ["Bedingungen besprechen", "Der Agent erläutert Struktur, Betrag und Risiken einer Investition in diese Immobilie."],
      ["Unterschreiben und investieren", "Sie unterschreiben den Vertrag, und die Investition erscheint in Ihrem Kundenbereich."],
    ],
  },
  fr: {
    talkToAgent: "Parler à un agent",
    monthlyRent: "Loyer mensuel",
    propertyValue: "Valeur du bien",
    viewProperty: "Voir le bien",
    note: "Les conditions d’investissement de ce bien sont discutées personnellement avec un agent Brickwise.",
    requestMessage: "Je souhaite parler à un agent Brickwise d’un investissement dans « {title} ». Merci de me contacter.",
    steps: [
      ["Contacter un agent", "Envoyez une demande et un agent Brickwise vérifié vous contacte personnellement."],
      ["Discuter des conditions", "L’agent présente la structure, le montant et les risques d’un investissement dans ce bien."],
      ["Signer et investir", "Vous signez le contrat et l’investissement apparaît dans votre espace client."],
    ],
  },
  es: {
    talkToAgent: "Hablar con un agente",
    monthlyRent: "Alquiler mensual",
    propertyValue: "Valor del inmueble",
    viewProperty: "Ver el inmueble",
    note: "Las condiciones de inversión de este inmueble se tratan personalmente con un agente de Brickwise.",
    requestMessage: "Me gustaría hablar con un agente de Brickwise sobre invertir en «{title}». Por favor, pónganse en contacto conmigo.",
    steps: [
      ["Contactar con un agente", "Envía una solicitud y un agente verificado de Brickwise se pondrá en contacto contigo personalmente."],
      ["Hablar de las condiciones", "El agente explica la estructura, el importe y los riesgos de invertir en este inmueble."],
      ["Firmar e invertir", "Firmas el contrato y la inversión aparece en tu panel de cliente."],
    ],
  },
  it: {
    talkToAgent: "Parla con un agente",
    monthlyRent: "Affitto mensile",
    propertyValue: "Valore dell’immobile",
    viewProperty: "Vedi l’immobile",
    note: "Le condizioni di investimento di questo immobile vengono discusse personalmente con un agente Brickwise.",
    requestMessage: "Vorrei parlare con un agente Brickwise di un investimento in «{title}». Vi prego di contattarmi.",
    steps: [
      ["Contatta un agente", "Invia una richiesta e un agente Brickwise verificato ti contatterà personalmente."],
      ["Discuti le condizioni", "L’agente illustra struttura, importo e rischi di un investimento in questo immobile."],
      ["Firma e investi", "Firmi il contratto e l’investimento compare nella tua area clienti."],
    ],
  },
};
