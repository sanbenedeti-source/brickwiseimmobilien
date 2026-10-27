/** Normalisation shared by the public agent check and the admin agent register. */
export const agentLanguages = ["en", "de", "fr", "es", "it"] as const;
export type AgentLanguage = (typeof agentLanguages)[number];
export type AgentLookupKind = "code" | "email" | "phone";

const codeAlphabet = "[A-HJ-NP-Z2-9]";

/** "bw abc234", "BWABC234" and "BW-ABC234" all become "BW-ABC234". */
export function normalizeAgentCode(value: string) {
  const compact = value.toUpperCase().replace(/[\s-]/g, "");
  const match = new RegExp(`^BW(${codeAlphabet}{6})$`).exec(compact);
  return match ? `BW-${match[1]}` : null;
}

export function normalizeAgentEmail(value: string) {
  const email = value.trim().toLowerCase();
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

/** International format only (E.164): "+49 1521 228-9889" and "0049 1521 2289889" become "+4915212289889". */
export function normalizeAgentPhone(value: string) {
  const compact = value.trim().replace(/[\s().\-/]/g, "").replace(/^00/, "+");
  return /^\+[1-9]\d{6,14}$/.test(compact) ? compact : null;
}

export function normalizeLookup(kind: unknown, value: unknown): { kind: AgentLookupKind; value: string } | null {
  if (typeof value !== "string" || value.length > 254) return null;
  const normalized = kind === "code" ? normalizeAgentCode(value) : kind === "email" ? normalizeAgentEmail(value) : kind === "phone" ? normalizeAgentPhone(value) : null;
  return normalized ? { kind: kind as AgentLookupKind, value: normalized } : null;
}
