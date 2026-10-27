import { createClient } from "@/lib/supabase/server";
import { acceptanceColumns, type AgreementAcceptance } from "@/app/lib/client-agreements";
import { agreementCopy } from "@/app/lib/agreement-copy";
import { normalizeLocale } from "@/app/lib/i18n";

const noStore = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" };
function escape(value: string) { return value.replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]!)); }

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const client = await createClient();
    const { data: { user }, error: authError } = await client.auth.getUser();
    if (authError || !user) return new Response(null, { status: 401, headers: noStore });
    const { id } = await params;
    if (!/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(id)) return new Response(null, { status: 404, headers: noStore });
    // RLS permits this exact record only to its owner or a current trusted administrator.
    const { data, error } = await client.from("client_agreement_acceptances").select(acceptanceColumns).eq("id", id).maybeSingle();
    if (error) return new Response(null, { status: 503, headers: noStore });
    if (!data) return new Response(null, { status: 404, headers: noStore });
    const row = data as AgreementAcceptance;
    const locale = normalizeLocale(row.locale) || "en", copy = agreementCopy(locale);
    if (!/^\/documents\/agreements\/[a-zA-Z0-9-]+\/(en|de|fr|es|it)\.pdf$/.test(row.document_path)) return new Response(null, { status: 503, headers: noStore });
    const detail = (label: string, value: string) => `<dt>${escape(label)}</dt><dd>${escape(value)}</dd>`;
    const html = `<!doctype html><html lang="${locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escape(copy.receipt)} | Brickwise</title><style>body{max-width:800px;margin:40px auto;padding:0 24px;font:16px/1.6 system-ui,sans-serif;color:#17233f}h1{line-height:1.25}dt{font-weight:700;margin-top:14px}dd{margin:0;overflow-wrap:anywhere}blockquote{margin:24px 0;padding:16px;border-left:3px solid #2f9bdb;background:#f7f9fb}.notice{padding:16px;background:#fff7df}a{color:#126b9c}footer{margin-top:32px;border-top:1px solid #ddd;padding-top:16px;font-size:13px}@media print{body{margin:0;padding:0}.print-help{display:none}}</style></head><body><p><strong>BRICKWISE</strong></p><h1>${escape(copy.receipt)}</h1>${row.is_draft ? `<p class="notice">${escape(copy.draftNotice)}</p>` : ""}<dl>${detail(copy.reference, row.id)}${detail(copy.signerName, row.signer_name)}${detail(copy.email, row.email)}${detail(copy.acceptedAt, new Date(row.accepted_at).toISOString())}${detail(copy.version, `${row.version} (${row.locale.toUpperCase()})`)}${detail("SHA-256", row.document_sha256)}${detail(copy.profileStep, copy[row.status])}${row.reviewed_at ? detail(copy.decisionAt, new Date(row.reviewed_at).toISOString()) : ""}${row.review_note ? detail(copy.note, row.review_note) : ""}${row.signed_pdf_sha256 ? detail(`${copy.signedPdf} (SHA-256)`, row.signed_pdf_sha256) : ""}</dl><blockquote>${escape(row.consent_text)}</blockquote><p><a href="${escape(row.document_path)}">${escape(copy.document)}</a>${row.signed_pdf_sha256 ? ` · <a href="/api/client-agreements/${row.id}/signed">${escape(copy.signedPdf)}</a>` : ""}</p><p class="print-help">${escape(copy.receiptHelp)}</p><footer>${escape(copy.reviewIntro)}</footer></body></html>`;
    return new Response(html, { headers: { ...noStore, "Content-Type": "text/html; charset=utf-8", "Content-Disposition": `inline; filename="brickwise-acceptance-${id}.html"`, "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'" } });
  } catch { return new Response(null, { status: 503, headers: noStore }); }
}
