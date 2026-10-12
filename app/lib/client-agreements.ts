import type { SupabaseClient } from "@supabase/supabase-js";
import type { Locale } from "./i18n";
import manifest from "./agreement-manifest.json";

export const agreementVersion = manifest.version;
export const acceptanceColumns = "id,user_id,signer_name,email,version,locale,document_path,document_sha256,consent_text,is_draft,accepted_at,status,reviewed_by,reviewed_at,review_note";
export type AgreementAcceptance = {
  id: string; user_id: string; signer_name: string; email: string; version: string;
  locale: Locale; document_path: string; document_sha256: string; consent_text: string;
  is_draft: boolean; accepted_at: string; status: "pending" | "approved" | "rejected";
  reviewed_by: string | null; reviewed_at: string | null; review_note: string | null;
};

export async function loadClientAgreement(client: SupabaseClient, userId: string, locale: Locale, emailConfirmed: boolean) {
  const [documentResult, acceptanceResult] = await Promise.all([
    client.from("client_agreement_versions").select("version,locale,document_path,document_sha256,consent_text,is_draft")
      .eq("version", agreementVersion).eq("locale", locale).eq("active", true).maybeSingle(),
    client.from("client_agreement_acceptances").select(acceptanceColumns)
      .eq("user_id", userId).eq("version", agreementVersion).maybeSingle(),
  ]);
  const document = documentResult.data;
  const expected = manifest.documents.find(item => item.locale === locale);
  if (documentResult.error || acceptanceResult.error || !document || !expected
    || document.document_sha256 !== expected.sha256 || document.document_path !== expected.path
    || document.consent_text !== expected.consentText || document.is_draft !== expected.isDraft) {
    throw new Error("Agreement unavailable");
  }
  return {
    document: { version: document.version, locale: document.locale, path: document.document_path,
      sha256: document.document_sha256, consentText: document.consent_text, isDraft: document.is_draft },
    acceptance: acceptanceResult.data as AgreementAcceptance | null,
    emailConfirmed,
  };
}
