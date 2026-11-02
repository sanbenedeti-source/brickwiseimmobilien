import type { InvestmentLabels } from "./InvestmentForms";

/** Labels of the investment forms, shared by the customer page and the sale requests page. */
export function investmentLabels(t: (text: string) => string): InvestmentLabels {
  return {
    property: t("Property"),
    shares: t("Shares"),
    pricePerShare: t("Price per share (EUR)"),
    total: t("Total"),
    payment: t("Payment"),
    fromWallet: t("From the client's wallet"),
    outsideWallet: t("Paid outside the wallet (bank transfer)"),
    note: t("Reason (visible to the client)"),
    notePlaceholder: t("e.g. Bank transfer received on 12 November"),
    confirm: t("I have checked the details. This changes the client's holdings and wallet immediately."),
    addSubmit: t("Add shares"),
    buyBackSubmit: t("Buy back shares"),
    adjustSubmit: t("Save correction"),
    direction: t("Direction"),
    addToWallet: t("Add to wallet"),
    subtractFromWallet: t("Subtract from wallet"),
    amount: t("Amount (EUR)"),
    saved: t("Saved. The client sees it in their portfolio and statement."),
    error: t("The action could not be completed. Please try again."),
    invalid: t("Check the shares, price and reason, then try again."),
    funds: t("The client's wallet balance is too low."),
    sharesError: t("Not enough shares for this action."),
    next: t("New action"),
    available: t("available"),
    held: t("held"),
  };
}
