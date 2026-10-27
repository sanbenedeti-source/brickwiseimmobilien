/** Pure helpers for client money features: IBAN checks, KYC file types and the wallet ledger. */

export function normalizeIban(value: string) {
  return value.replace(/\s+/g, "").toUpperCase();
}

/** ISO 13616 check: country code, check digits and the mod-97 remainder of 1. */
export function isValidIban(value: string) {
  const iban = normalizeIban(value);
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban)) return false;
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  let remainder = 0;
  for (const character of rearranged) {
    const digits = /\d/.test(character) ? character : String(character.charCodeAt(0) - 55);
    for (const digit of digits) remainder = (remainder * 10 + Number(digit)) % 97;
  }
  return remainder === 1;
}

export function maskIban(value: string) {
  const iban = normalizeIban(value);
  return iban.length > 8 ? `${iban.slice(0, 4)} •••• ${iban.slice(-4)}` : iban;
}

export type KycFileType = { extension: "pdf" | "jpg" | "png"; mime: "application/pdf" | "image/jpeg" | "image/png" };

/** Identifies a document by its magic bytes, never by the client-supplied name or type. */
export function detectKycFile(bytes: Uint8Array): KycFileType | null {
  if (bytes.length >= 5 && String.fromCharCode(...bytes.subarray(0, 5)) === "%PDF-") return { extension: "pdf", mime: "application/pdf" };
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { extension: "jpg", mime: "image/jpeg" };
  if (bytes.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((byte, index) => bytes[index] === byte)) return { extension: "png", mime: "image/png" };
  return null;
}
export const KYC_MAX_BYTES = 10 * 1024 * 1024;
export const KYC_MIN_BYTES = 1024;

export type LedgerRow = {
  id: string; type: string; direction: "credit" | "debit"; amount: number; property_slug: string | null; shares: number | null;
  reference_type: string | null; idempotency_key: string; created_at: string;
};
export type LedgerKind = "deposit" | "walletCredit" | "purchase" | "distribution" | "profit" | "withdrawal" | "withdrawalReturned" | "refund" | "adjustment";

export function ledgerKind(row: Pick<LedgerRow, "type" | "reference_type" | "idempotency_key">): LedgerKind {
  if (row.type === "purchase") return "purchase";
  if (row.reference_type === "distribution") return "distribution";
  if (row.reference_type === "profit_payout") return "profit";
  if (row.reference_type === "withdrawal") return "withdrawal";
  if (row.reference_type === "withdrawal_reversal") return "withdrawalReturned";
  if (row.type === "credit") return row.idempotency_key.startsWith("deposit:") ? "deposit" : "walletCredit";
  if (row.type === "refund") return "refund";
  return "adjustment";
}

export type StatementRange = "30" | "90" | "year" | "all";
export function rangeStart(range: StatementRange, now = new Date()) {
  if (range === "all") return null;
  if (range === "year") return new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  return new Date(now.getTime() - Number(range) * 86_400_000);
}

/** Running balance over the whole ledger (oldest first), then the requested window. */
export function buildStatement(rows: LedgerRow[], range: StatementRange, direction: "all" | "credit" | "debit", now = new Date()) {
  const ordered = [...rows].sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));
  let cents = 0;
  const withBalance = ordered.map((row) => {
    cents += Math.round(row.amount * 100) * (row.direction === "credit" ? 1 : -1);
    return { ...row, kind: ledgerKind(row), balance: cents / 100 };
  });
  const start = rangeStart(range, now);
  const inRange = withBalance.filter((row) => !start || Date.parse(row.created_at) >= start.getTime());
  const before = start ? withBalance.filter((row) => Date.parse(row.created_at) < start.getTime()) : [];
  const opening = before.length ? before[before.length - 1].balance : 0;
  const closing = inRange.length ? inRange[inRange.length - 1].balance : opening;
  return {
    opening, closing, start,
    rows: inRange.filter((row) => direction === "all" || row.direction === direction).reverse(),
  };
}

export function csvCell(value: string | number | null) {
  const text = value === null ? "" : String(value);
  // Neutralise spreadsheet formulas and quote every cell.
  const safe = /^[=+\-@\t\r]/.test(text) && typeof value === "string" ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}
