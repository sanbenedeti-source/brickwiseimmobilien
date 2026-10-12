export type CompanyPaymentMethod = {
  id: string; kind: "bank" | "crypto"; bank_slot: number | null; label: string; active: boolean;
  bank_name: string | null; beneficiary: string | null; account_number: string | null; bic: string | null;
  bank_address: string | null; crypto_asset: string | null; crypto_network: string | null; wallet_address: string | null;
  instructions: string | null; currency: "EUR";
};

export function parseCompanyPaymentMethod(form: FormData): Omit<CompanyPaymentMethod, "id"> | null {
  const text = (key: string) => String(form.get(key) || "").trim();
  const kind = text("kind");
  const label = text("label");
  const instructions = text("instructions");
  if (!label || label.length > 100 || instructions.length > 2000) return null;
  const common = { label, active: form.get("active") === "on", currency: "EUR" as const, instructions: instructions || null };
  if (kind === "bank") {
    const slot = Number(text("bank_slot"));
    const bank_name = text("bank_name"), beneficiary = text("beneficiary"), account_number = text("account_number");
    const bic = text("bic").toUpperCase(), bank_address = text("bank_address");
    if (![1,2].includes(slot) || !bank_name || bank_name.length > 150 || !beneficiary || beneficiary.length > 150 || !account_number || account_number.length > 80 || bic.length > 30 || bank_address.length > 300) return null;
    return { ...common, kind, bank_slot: slot, bank_name, beneficiary, account_number, bic: bic || null, bank_address: bank_address || null, crypto_asset: null, crypto_network: null, wallet_address: null };
  }
  if (kind === "crypto") {
    const crypto_asset = text("crypto_asset").toUpperCase(), crypto_network = text("crypto_network"), wallet_address = text("wallet_address");
    if (!/^[A-Z0-9][A-Z0-9._-]{0,29}$/.test(crypto_asset) || !crypto_network || crypto_network.length > 60 || !wallet_address || wallet_address.length > 200 || /\s/.test(wallet_address)) return null;
    return { ...common, kind, bank_slot: null, bank_name: null, beneficiary: null, account_number: null, bic: null, bank_address: null, crypto_asset, crypto_network, wallet_address };
  }
  return null;
}
