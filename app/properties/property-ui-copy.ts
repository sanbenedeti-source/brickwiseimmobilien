import { localeHtmlLang, type Locale } from "../lib/i18n";

export const propertyGalleryCopy = {
  en: { previous: "Previous property photo", next: "Next property photo", photo: "Property photo", gallery: "Property gallery", primary: "Primary", more: "more" },
  de: { previous: "Vorheriges Immobilienfoto", next: "Nächstes Immobilienfoto", photo: "Immobilienfoto", gallery: "Immobiliengalerie", primary: "Hauptansicht", more: "weitere" },
  fr: { previous: "Photo précédente du bien", next: "Photo suivante du bien", photo: "Photo du bien", gallery: "Galerie du bien", primary: "Vue principale", more: "autres" },
  es: { previous: "Foto anterior del inmueble", next: "Foto siguiente del inmueble", photo: "Foto del inmueble", gallery: "Galería del inmueble", primary: "Vista principal", more: "más" },
  it: { previous: "Foto precedente dell’immobile", next: "Foto successiva dell’immobile", photo: "Foto dell’immobile", gallery: "Galleria dell’immobile", primary: "Vista principale", more: "altre" },
} satisfies Record<Locale, Record<string, string>>;

export const propertyUiCopy = {
  en: { bed: "bedroom", bath: "bathroom", room: "room", walletCredit: "Wallet credit", walletCreditNote: "Credited to your wallet and available to invest.", beds: "bedrooms", rooms: "rooms", baths: "bathrooms", aboveGrade: "above grade", squareFeet: "sq ft", available: "Available", unavailable: "Unavailable", reserved: "Reserved", sold: "Sold", pending: "Pending", completed: "Completed", approved: "Approved", verified: "Verified", paid: "Paid", cancelled: "Cancelled", rejected: "Rejected", failed: "Failed", processing: "Processing", expired: "Expired", sent: "Sent", active: "Active", paused: "Paused", client: "Client", bank: "Bank transfer", crypto: "Crypto", wallet: "Wallet balance", funding: "Funding account", monthly: "Monthly", annual: "Annual", streetView: "Street View" },
  de: { bed: "Schlafzimmer", bath: "Badezimmer", room: "Zimmer", walletCredit: "Wallet-Gutschrift", walletCreditNote: "Ihrem Wallet gutgeschrieben und zum Investieren verfügbar.", beds: "Schlafzimmer", rooms: "Zimmer", baths: "Badezimmer", aboveGrade: "oberirdisch", squareFeet: "Quadratfuß", available: "Verfügbar", unavailable: "Nicht verfügbar", reserved: "Reserviert", sold: "Verkauft", pending: "Ausstehend", completed: "Abgeschlossen", approved: "Genehmigt", verified: "Verifiziert", paid: "Bezahlt", cancelled: "Storniert", rejected: "Abgelehnt", failed: "Fehlgeschlagen", processing: "In Bearbeitung", expired: "Abgelaufen", sent: "Gesendet", active: "Aktiv", paused: "Pausiert", client: "Kunde", bank: "Banküberweisung", crypto: "Krypto", wallet: "Wallet-Guthaben", funding: "Finanzierungskonto", monthly: "Monatlich", annual: "Jährlich", streetView: "Street View" },
  fr: { bed: "chambre", bath: "salle de bain", room: "pièce", walletCredit: "Crédit du portefeuille", walletCreditNote: "Crédité sur votre portefeuille et disponible pour investir.", beds: "chambres", rooms: "pièces", baths: "salles de bain", aboveGrade: "hors sol", squareFeet: "pi²", available: "Disponible", unavailable: "Indisponible", reserved: "Réservé", sold: "Vendu", pending: "En attente", completed: "Terminé", approved: "Approuvé", verified: "Vérifié", paid: "Payé", cancelled: "Annulé", rejected: "Refusé", failed: "Échoué", processing: "En cours", expired: "Expiré", sent: "Envoyé", active: "Actif", paused: "En pause", client: "Client", bank: "Virement bancaire", crypto: "Crypto", wallet: "Solde du portefeuille", funding: "Compte de financement", monthly: "Mensuel", annual: "Annuel", streetView: "Street View" },
  es: { bed: "dormitorio", bath: "baño", room: "habitación", walletCredit: "Abono en el monedero", walletCreditNote: "Abonado en tu monedero y disponible para invertir.", beds: "dormitorios", rooms: "habitaciones", baths: "baños", aboveGrade: "sobre rasante", squareFeet: "pies²", available: "Disponible", unavailable: "No disponible", reserved: "Reservado", sold: "Vendido", pending: "Pendiente", completed: "Completado", approved: "Aprobado", verified: "Verificado", paid: "Pagado", cancelled: "Cancelado", rejected: "Rechazado", failed: "Fallido", processing: "En proceso", expired: "Caducado", sent: "Enviado", active: "Activo", paused: "En pausa", client: "Cliente", bank: "Transferencia bancaria", crypto: "Cripto", wallet: "Saldo del monedero", funding: "Cuenta de financiación", monthly: "Mensual", annual: "Anual", streetView: "Street View" },
  it: { bed: "camera da letto", bath: "bagno", room: "locale", walletCredit: "Accredito sul wallet", walletCreditNote: "Accreditato sul tuo wallet e disponibile per investire.", beds: "camere da letto", rooms: "locali", baths: "bagni", aboveGrade: "fuori terra", squareFeet: "piedi²", available: "Disponibile", unavailable: "Non disponibile", reserved: "Prenotato", sold: "Venduto", pending: "In attesa", completed: "Completato", approved: "Approvato", verified: "Verificato", paid: "Pagato", cancelled: "Annullato", rejected: "Rifiutato", failed: "Non riuscito", processing: "In elaborazione", expired: "Scaduto", sent: "Inviato", active: "Attivo", paused: "In pausa", client: "Cliente", bank: "Bonifico bancario", crypto: "Cripto", wallet: "Saldo del wallet", funding: "Conto di finanziamento", monthly: "Mensile", annual: "Annuale", streetView: "Street View" },
} satisfies Record<Locale, Record<string, string>>;

export function formatPropertyPercent(value: number, locale: Locale, maximumFractionDigits = 2) {
  // Intl places the sign per locale: "26.25%" (en), "26,25 %" (de, fr, es), "26,25%" (it).
  return new Intl.NumberFormat(localeHtmlLang[locale], { style: "percent", minimumFractionDigits: 2, maximumFractionDigits }).format(value / 100);
}

/** "1 bedroom" / "2 bedrooms" with the locale's plural rules (French treats 0 and 1 as singular). */
export function countLabel(count: number, singular: string, plural: string, locale: Locale) {
  return `${count.toLocaleString(localeHtmlLang[locale])} ${new Intl.PluralRules(localeHtmlLang[locale]).select(count) === "one" ? singular : plural}`;
}

export function localizedStatus(value: string | null | undefined, locale: Locale, fallback = "—") {
  const status = value?.trim().toLowerCase().replaceAll(" ", "_");
  const key = status === "new" || status === "pending_agent" || status === "pending_payment" ? "pending" : status;
  const copy = propertyUiCopy[locale];
  return key && key in copy ? copy[key as keyof typeof copy] : fallback;
}

export function localizedPayment(value: string | null | undefined, locale: Locale, fallback = "—") {
  const method = value?.trim().toLowerCase();
  const copy = propertyUiCopy[locale];
  if (method === "bank_transfer" || method === "bank transfer" || method === "bank") return copy.bank;
  if (method === "crypto_usdc" || method === "crypto" || method === "crypto / usdc" || method === "cryptocurrency") return copy.crypto;
  if (method === "wallet_balance" || method === "wallet balance" || method === "wallet") return copy.wallet;
  if (method === "funding_account") return copy.funding;
  if (method === "wallet_credit") return copy.walletCredit;
  return fallback;
}
