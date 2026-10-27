import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { Locale } from "./i18n";

export type SignatureEvidence = {
  acceptanceId: string;
  signerName: string;
  email: string;
  signedAt: Date;
  ip: string | null;
  userAgent: string | null;
  version: string;
  locale: Locale;
  documentSha256: string;
  consentText: string;
  signaturePng: Uint8Array;
};

const labels: Record<Locale, {
  title: string; document: string; reference: string; documentLabel: string; version: string; originalHash: string;
  signer: string; email: string; signedAt: string; ip: string; device: string; consent: string; signature: string;
  stamp: string; ref: string; integrity: string; unknown: string;
}> = {
  en: { title: "Electronic signature page", document: "Client Cooperation Agreement", reference: "Agreement reference", documentLabel: "Document", version: "Version and language", originalHash: "SHA-256 of the unsigned document", signer: "Signer", email: "Verified email address", signedAt: "Signed on (UTC)", ip: "IP address", device: "Device", consent: "Declaration of consent", signature: "Signature", stamp: "Signed electronically by", ref: "Ref.", integrity: "This page is an integral part of the agreement. The checksum of this signed PDF is stored in the Brickwise system and can be verified at any time. Simple electronic signature recorded in the Brickwise client portal.", unknown: "Not available" },
  de: { title: "Elektronische Signaturseite", document: "Kundenkooperationsvertrag", reference: "Vertragsreferenz", documentLabel: "Dokument", version: "Version und Sprache", originalHash: "SHA-256 des nicht unterzeichneten Dokuments", signer: "Unterzeichner", email: "Verifizierte E-Mail-Adresse", signedAt: "Unterzeichnet am (UTC)", ip: "IP-Adresse", device: "Gerät", consent: "Einwilligungserklärung", signature: "Unterschrift", stamp: "Elektronisch unterzeichnet von", ref: "Ref.", integrity: "Diese Seite ist Bestandteil des Vertrags. Die Prüfsumme dieses unterzeichneten PDF ist im Brickwise-System gespeichert und kann jederzeit überprüft werden. Einfache elektronische Signatur, erfasst im Brickwise-Kundenportal.", unknown: "Nicht verfügbar" },
  fr: { title: "Page de signature électronique", document: "Contrat de coopération client", reference: "Référence du contrat", documentLabel: "Document", version: "Version et langue", originalHash: "SHA-256 du document non signé", signer: "Signataire", email: "Adresse e-mail vérifiée", signedAt: "Signé le (UTC)", ip: "Adresse IP", device: "Appareil", consent: "Déclaration de consentement", signature: "Signature", stamp: "Signé électroniquement par", ref: "Réf.", integrity: "Cette page fait partie intégrante du contrat. L’empreinte de ce PDF signé est enregistrée dans le système Brickwise et peut être vérifiée à tout moment. Signature électronique simple enregistrée sur le portail client Brickwise.", unknown: "Non disponible" },
  es: { title: "Página de firma electrónica", document: "Contrato de cooperación con el cliente", reference: "Referencia del contrato", documentLabel: "Documento", version: "Versión e idioma", originalHash: "SHA-256 del documento sin firmar", signer: "Firmante", email: "Correo electrónico verificado", signedAt: "Firmado el (UTC)", ip: "Dirección IP", device: "Dispositivo", consent: "Declaración de consentimiento", signature: "Firma", stamp: "Firmado electrónicamente por", ref: "Ref.", integrity: "Esta página forma parte integrante del contrato. La suma de verificación de este PDF firmado se guarda en el sistema de Brickwise y puede comprobarse en cualquier momento. Firma electrónica simple registrada en el portal de clientes de Brickwise.", unknown: "No disponible" },
  it: { title: "Pagina di firma elettronica", document: "Contratto di cooperazione con il cliente", reference: "Riferimento del contratto", documentLabel: "Documento", version: "Versione e lingua", originalHash: "SHA-256 del documento non firmato", signer: "Firmatario", email: "Indirizzo e-mail verificato", signedAt: "Firmato il (UTC)", ip: "Indirizzo IP", device: "Dispositivo", consent: "Dichiarazione di consenso", signature: "Firma", stamp: "Firmato elettronicamente da", ref: "Rif.", integrity: "Questa pagina costituisce parte integrante del contratto. L’impronta di questo PDF firmato è registrata nel sistema Brickwise e può essere verificata in qualsiasi momento. Firma elettronica semplice registrata nel portale clienti Brickwise.", unknown: "Non disponibile" },
};

const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** Accepts only a reasonably sized PNG data URL from the signature pad; anything else is rejected. */
export function parseSignaturePng(value: unknown): Uint8Array | null {
  const prefix = "data:image/png;base64,";
  if (typeof value !== "string" || !value.startsWith(prefix) || value.length > 280_000) return null;
  const base64 = value.slice(prefix.length);
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) return null;
  const bytes = Uint8Array.from(Buffer.from(base64, "base64"));
  // A blank canvas compresses to a few hundred bytes; a drawn signature is larger.
  if (bytes.length < 600 || bytes.length > 200_000 || PNG_MAGIC.some((byte, index) => bytes[index] !== byte)) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const width = view.getUint32(16), height = view.getUint32(20);
  if (width < 120 || width > 2400 || height < 60 || height > 1200) return null;
  return bytes;
}

// The standard PDF fonts cover Windows-1252 only; other letters are shown without
// diacritics (the exact name is stored in the database and in the signature image).
const winAnsiExtras = new Set("€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ");
const fallbacks: Record<string, string> = { "ł": "l", "Ł": "L", "đ": "d", "Đ": "D", "ı": "i", "ħ": "h", "Ħ": "H", "ŧ": "t", "Ŧ": "T" };
export function pdfSafeText(value: string) {
  return Array.from(value.replace(/[\u0000-\u001f\u007f]/g, " ")).map((character) => {
    const code = character.codePointAt(0)!;
    if ((code >= 0x20 && code <= 0x7e) || (code >= 0xa0 && code <= 0xff) || winAnsiExtras.has(character)) return character;
    if (fallbacks[character]) return fallbacks[character];
    const stripped = character.normalize("NFD").replace(/[̀-ͯ]/g, "");
    return stripped && Array.from(stripped).every((part) => part.codePointAt(0)! <= 0xff) ? stripped : "?";
  }).join("");
}

function wrap(text: string, font: PDFFont, size: number, width: number) {
  const lines: string[] = [];
  for (const paragraph of pdfSafeText(text).split("\n")) {
    let line = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= width) { line = candidate; continue; }
      if (line) lines.push(line);
      // Break tokens longer than the line (hashes, user agents) by character.
      let rest = word;
      while (font.widthOfTextAtSize(rest, size) > width) {
        let cut = rest.length;
        while (cut > 1 && font.widthOfTextAtSize(rest.slice(0, cut), size) > width) cut--;
        lines.push(rest.slice(0, cut));
        rest = rest.slice(cut);
      }
      line = rest;
    }
    lines.push(line);
  }
  return lines;
}

export function formatUtc(date: Date) {
  return date.toISOString().replace("T", " ").replace(/\.\d{3}Z$/, " UTC");
}

const ink = rgb(0.078, 0.129, 0.239), muted = rgb(0.357, 0.4, 0.471), brand = rgb(0.086, 0.404, 0.659), line = rgb(0.835, 0.867, 0.91);

/** Returns the archived agreement with an evidence page appended and every page stamped. */
export async function buildSignedAgreementPdf(original: Uint8Array, evidence: SignatureEvidence) {
  const copy = labels[evidence.locale];
  const pdf = await PDFDocument.load(original, { updateMetadata: false });
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const signedAt = formatUtc(evidence.signedAt);
  const stamp = pdfSafeText(`${copy.stamp} ${evidence.signerName} · ${signedAt} · ${copy.ref} ${evidence.acceptanceId}`);

  for (const page of pdf.getPages()) {
    const { width } = page.getSize();
    const size = 6.5;
    page.drawText(stamp, { x: (width - regular.widthOfTextAtSize(stamp, size)) / 2, y: 14, size, font: regular, color: muted });
  }

  const page: PDFPage = pdf.addPage([595.28, 841.89]);
  const left = 48, right = 595.28 - 48, contentWidth = right - left;
  let y = 841.89 - 56;
  page.drawText("BRICKWISE", { x: left, y, size: 15, font: bold, color: ink });
  page.drawText("FRACTIONAL REAL ESTATE", { x: left, y: y - 11, size: 6, font: bold, color: brand });
  y -= 24;
  page.drawLine({ start: { x: left, y }, end: { x: right, y }, thickness: 1.6, color: brand });
  y -= 30;
  page.drawText(pdfSafeText(copy.title), { x: left, y, size: 17, font: bold, color: ink });
  y -= 16;
  page.drawText(pdfSafeText(copy.document), { x: left, y, size: 10, font: regular, color: muted });
  y -= 22;

  const rows: [string, string][] = [
    [copy.reference, evidence.acceptanceId],
    [copy.documentLabel, copy.document],
    [copy.version, `${evidence.version} · ${evidence.locale.toUpperCase()}`],
    [copy.originalHash, evidence.documentSha256],
    [copy.signer, evidence.signerName],
    [copy.email, evidence.email],
    [copy.signedAt, signedAt],
    [copy.ip, evidence.ip || copy.unknown],
    [copy.device, evidence.userAgent || copy.unknown],
  ];
  const labelWidth = 150, valueWidth = contentWidth - labelWidth - 16, size = 8.6, leading = 11.4;
  for (const [label, value] of rows) {
    const labelLines = wrap(label, bold, size, labelWidth - 10);
    const valueLines = wrap(value, regular, size, valueWidth);
    const height = Math.max(labelLines.length, valueLines.length) * leading + 9;
    page.drawRectangle({ x: left, y: y - height, width: labelWidth, height, color: rgb(0.957, 0.969, 0.984), borderColor: line, borderWidth: 0.6 });
    page.drawRectangle({ x: left + labelWidth, y: y - height, width: contentWidth - labelWidth, height, borderColor: line, borderWidth: 0.6 });
    labelLines.forEach((text, index) => page.drawText(text, { x: left + 7, y: y - 13 - index * leading, size, font: bold, color: ink }));
    valueLines.forEach((text, index) => page.drawText(text, { x: left + labelWidth + 8, y: y - 13 - index * leading, size, font: regular, color: ink }));
    y -= height;
  }

  y -= 22;
  page.drawText(pdfSafeText(copy.consent), { x: left, y, size: 10, font: bold, color: ink });
  y -= 6;
  const consentLines = wrap(evidence.consentText, regular, 9, contentWidth - 20);
  const consentHeight = consentLines.length * 12.5 + 14;
  page.drawRectangle({ x: left, y: y - consentHeight, width: contentWidth, height: consentHeight, color: rgb(0.969, 0.976, 0.984) });
  page.drawRectangle({ x: left, y: y - consentHeight, width: 2.5, height: consentHeight, color: brand });
  consentLines.forEach((text, index) => page.drawText(text, { x: left + 12, y: y - 16 - index * 12.5, size: 9, font: regular, color: ink }));
  y -= consentHeight + 26;

  page.drawText(pdfSafeText(copy.signature), { x: left, y, size: 10, font: bold, color: ink });
  y -= 8;
  const boxWidth = 300, boxHeight = 120;
  page.drawRectangle({ x: left, y: y - boxHeight, width: boxWidth, height: boxHeight, borderColor: line, borderWidth: 0.8 });
  const image = await pdf.embedPng(evidence.signaturePng);
  const scale = Math.min((boxWidth - 24) / image.width, (boxHeight - 20) / image.height);
  page.drawImage(image, { x: left + (boxWidth - image.width * scale) / 2, y: y - boxHeight + (boxHeight - image.height * scale) / 2, width: image.width * scale, height: image.height * scale });
  page.drawText(pdfSafeText(evidence.signerName), { x: left, y: y - boxHeight - 14, size: 9, font: bold, color: ink });
  page.drawText(signedAt, { x: left, y: y - boxHeight - 26, size: 8.5, font: regular, color: muted });

  const integrityLines = wrap(copy.integrity, regular, 7.6, contentWidth);
  integrityLines.forEach((text, index) => page.drawText(text, { x: left, y: 64 - index * 10, size: 7.6, font: regular, color: muted }));

  pdf.setTitle(pdfSafeText(`${copy.document} — ${evidence.signerName}`));
  pdf.setSubject(pdfSafeText(copy.title));
  pdf.setKeywords([evidence.acceptanceId, evidence.version, evidence.documentSha256]);
  pdf.setProducer("Brickwise client portal");
  pdf.setCreator("Brickwise client portal");
  pdf.setCreationDate(evidence.signedAt);
  pdf.setModificationDate(evidence.signedAt);
  return pdf.save();
}
