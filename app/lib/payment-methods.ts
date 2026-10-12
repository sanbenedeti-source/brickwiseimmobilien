/** Customer-facing payment methods. Wallet credits are internal ledger operations. */
export function parsePaymentMethodFields(form: FormData) {
  const method = String(form.get("method") || "bank_transfer");
  if (method === "bank_transfer") return { method, crypto_asset: null, crypto_network: null };
  if (method !== "crypto") return null;
  const asset = String(form.get("crypto_asset") || "").trim().toUpperCase();
  const network = String(form.get("crypto_network") || "").trim();
  if (!/^[A-Z0-9][A-Z0-9._-]{0,29}$/.test(asset) || !/^[\p{L}\p{N}][\p{L}\p{N} .()/_-]{0,59}$/u.test(network)) return null;
  if (!String(form.get("instructions") || "").trim() && !String(form.get("payment_link") || "").trim()) return null;
  return { method, crypto_asset: asset, crypto_network: network };
}
