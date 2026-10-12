import type { Locale } from "./i18n";

type WalletPurchaseCopy = {
  requestReview: string;
  buyWallet: string;
  instantNote: string;
  balanceMethod: string;
  availableBalance: string;
  balanceAfterPurchase: string;
  buyNow: string;
  buying: string;
  insufficientBalance: string;
  balanceUnavailable: string;
  invalidQuantity: string;
};

export const walletPurchaseCopy: Record<Locale, WalletPurchaseCopy> = {
  en: {
    requestReview: "Request review",
    buyWallet: "Buy now from wallet",
    instantNote: "Wallet purchases complete immediately. Agent review applies only to bank or crypto requests.",
    balanceMethod: "Balance (credits)",
    availableBalance: "Available balance",
    balanceAfterPurchase: "Balance after purchase",
    buyNow: "Buy now",
    buying: "Purchasing…",
    insufficientBalance: "Your balance is not enough for this purchase. Add funds or choose another payment method.",
    balanceUnavailable: "Your balance is currently unavailable. Refresh the page to try again.",
    invalidQuantity: "Enter a whole number of shares between {min} and {max}.",
  },
  de: {
    requestReview: "Prüfung anfragen",
    buyWallet: "Jetzt mit Guthaben kaufen",
    instantNote: "Wallet-Käufe werden sofort abgeschlossen. Nur Bank- oder Krypto-Anfragen werden vom Berater geprüft.",
    balanceMethod: "Guthaben",
    availableBalance: "Verfügbares Guthaben",
    balanceAfterPurchase: "Guthaben nach dem Kauf",
    buyNow: "Jetzt kaufen",
    buying: "Kauf wird bearbeitet…",
    insufficientBalance: "Ihr Guthaben reicht für diesen Kauf nicht aus. Laden Sie Guthaben auf oder wählen Sie eine andere Zahlungsmethode.",
    balanceUnavailable: "Ihr Guthaben ist derzeit nicht verfügbar. Laden Sie die Seite neu, um es erneut zu versuchen.",
    invalidQuantity: "Geben Sie eine ganze Anzahl an Anteilen zwischen {min} und {max} ein.",
  },
  fr: {
    requestReview: "Demander une vérification",
    buyWallet: "Acheter avec le portefeuille",
    instantNote: "Les achats avec le portefeuille sont immédiats. Seules les demandes bancaires ou crypto passent par un conseiller.",
    balanceMethod: "Solde (crédits)",
    availableBalance: "Solde disponible",
    balanceAfterPurchase: "Solde après l’achat",
    buyNow: "Acheter maintenant",
    buying: "Achat en cours…",
    insufficientBalance: "Votre solde est insuffisant pour cet achat. Ajoutez des fonds ou choisissez un autre moyen de paiement.",
    balanceUnavailable: "Votre solde est actuellement indisponible. Actualisez la page pour réessayer.",
    invalidQuantity: "Saisissez un nombre entier de parts compris entre {min} et {max}.",
  },
  es: {
    requestReview: "Solicitar revisión",
    buyWallet: "Comprar con el saldo",
    instantNote: "Las compras con saldo se completan al instante. Solo las solicitudes bancarias o cripto requieren revisión.",
    balanceMethod: "Saldo (créditos)",
    availableBalance: "Saldo disponible",
    balanceAfterPurchase: "Saldo después de la compra",
    buyNow: "Comprar ahora",
    buying: "Compra en curso…",
    insufficientBalance: "Tu saldo no es suficiente para esta compra. Añade fondos o elige otro método de pago.",
    balanceUnavailable: "Tu saldo no está disponible en este momento. Actualiza la página para volver a intentarlo.",
    invalidQuantity: "Introduce un número entero de participaciones entre {min} y {max}.",
  },
  it: {
    requestReview: "Richiedi verifica",
    buyWallet: "Acquista con il saldo",
    instantNote: "Gli acquisti con il saldo sono immediati. Solo le richieste bancarie o crypto richiedono verifica.",
    balanceMethod: "Saldo (crediti)",
    availableBalance: "Saldo disponibile",
    balanceAfterPurchase: "Saldo dopo l’acquisto",
    buyNow: "Acquista ora",
    buying: "Acquisto in corso…",
    insufficientBalance: "Il tuo saldo non è sufficiente per questo acquisto. Aggiungi fondi o scegli un altro metodo di pagamento.",
    balanceUnavailable: "Il tuo saldo non è al momento disponibile. Aggiorna la pagina per riprovare.",
    invalidQuantity: "Inserisci un numero intero di quote compreso tra {min} e {max}.",
  },
};
