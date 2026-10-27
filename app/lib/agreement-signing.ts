import { createHash, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import type { Locale } from "./i18n";
import { buildSignedAgreementPdf } from "./signed-agreement-pdf";

export const signedAgreementBucket = "client-agreements";
const archivedPath = /^\/documents\/agreements\/[a-zA-Z0-9-]+\/(en|de|fr|es|it)\.pdf$/;
const sha256 = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

// Signed PDFs live in a private bucket without storage policies, so only this
// service-role client can write or read them; every route checks access first.
function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Signing storage is not configured");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export function requestEvidence(request: Request) {
  const forwarded = request.headers.get("x-real-ip") || request.headers.get("x-forwarded-for")?.split(",")[0];
  const ip = forwarded?.trim() || "";
  return {
    ip: /^[0-9a-fA-F:.]{3,64}$/.test(ip) ? ip : null,
    userAgent: request.headers.get("user-agent")?.replace(/[\u0000-\u001f\u007f]/g, " ").slice(0, 300) || null,
  };
}

export type SignAgreementInput = {
  userId: string;
  email: string;
  signerName: string;
  locale: Locale;
  document: { version: string; path: string; sha256: string; consentText: string };
  signaturePng: Uint8Array;
  ip: string | null;
  userAgent: string | null;
};

/** Builds the signed PDF from the archived original, stores it and records the signature. Returns the acceptance id. */
export async function signAgreement(input: SignAgreementInput) {
  if (!archivedPath.test(input.document.path)) throw new Error("Unexpected agreement path");
  const original = new Uint8Array(await readFile(path.join(process.cwd(), "public", ...input.document.path.split("/").filter(Boolean))));
  if (sha256(original) !== input.document.sha256) throw new Error("Archived agreement does not match its checksum");

  const admin = serviceClient();
  const acceptanceId = randomUUID();
  const signedAt = new Date();
  const pdf = await buildSignedAgreementPdf(original, {
    acceptanceId, signerName: input.signerName, email: input.email, signedAt, ip: input.ip, userAgent: input.userAgent,
    version: input.document.version, locale: input.locale, documentSha256: input.document.sha256,
    consentText: input.document.consentText, signaturePng: input.signaturePng,
  });
  const objectPath = `${input.userId}/${acceptanceId}.pdf`;
  const bucket = admin.storage.from(signedAgreementBucket);
  const { error: uploadError } = await bucket.upload(objectPath, pdf, { contentType: "application/pdf", upsert: false });
  if (uploadError) throw new Error("Signed agreement could not be stored");

  const { data, error } = await admin.rpc("sign_client_agreement", {
    p_id: acceptanceId, p_user_id: input.userId, p_version: input.document.version, p_locale: input.locale,
    p_signer_name: input.signerName, p_consent: true, p_signed_at: signedAt.toISOString(),
    p_signature_sha256: sha256(input.signaturePng), p_signed_pdf_sha256: sha256(pdf),
    p_signer_ip: input.ip, p_user_agent: input.userAgent,
  });
  // A failed or concurrent duplicate signature leaves no orphaned document behind.
  if (error || data !== acceptanceId) await bucket.remove([objectPath]).catch(() => undefined);
  if (error || typeof data !== "string") throw new Error("Signature could not be recorded");
  return data;
}

/** Downloads a stored signed agreement and refuses it unless it still matches the recorded checksum. */
export async function readSignedAgreement(objectPath: string, expectedSha256: string) {
  if (!/^[\da-f-]{36}\/[\da-f-]{36}\.pdf$/i.test(objectPath)) throw new Error("Unexpected signed agreement path");
  const { data, error } = await serviceClient().storage.from(signedAgreementBucket).download(objectPath);
  if (error || !data) throw new Error("Signed agreement unavailable");
  const bytes = new Uint8Array(await data.arrayBuffer());
  if (sha256(bytes) !== expectedSha256) throw new Error("Signed agreement failed its integrity check");
  return bytes;
}
