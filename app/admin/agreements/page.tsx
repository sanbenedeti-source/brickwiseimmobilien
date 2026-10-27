import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdminUser } from "@/app/lib/admin";
import { hasAdminSession } from "@/app/lib/admin-session";
import { getCurrentLocale } from "@/app/lib/server-locale";
import { agreementCopy } from "@/app/lib/agreement-copy";
import { acceptanceColumns, type AgreementAcceptance } from "@/app/lib/client-agreements";
import ReviewForm from "./ReviewForm";
import { ChevronDown } from "lucide-react";
import { getAdminText } from "@/app/lib/admin-copy";
import { AdminAlert, AdminCard, AdminEmpty, AdminPageHeader, StatusBadge } from "../ui";

export default async function AgreementsPage({ searchParams }: { searchParams: Promise<{ page?: string; customer?: string; status?: string }> }) {
  const client = await createClient();
  const { data: { user }, error: authError } = await client.auth.getUser();
  if (authError || !user) redirect("/admin");
  if (!isAdminUser(user)) redirect("/dashboard");
  if (!(await hasAdminSession(client, user))) redirect("/admin/security");
  const locale = await getCurrentLocale(), copy = agreementCopy(locale), query = await searchParams;
  const parsedPage = Number(query.page || 1);
  const page = Number.isSafeInteger(parsedPage) && parsedPage > 0 && parsedPage <= 10000 ? parsedPage : 1;
  const customer = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(query.customer || "") ? query.customer : undefined;
  const showAll = query.status === "all";
  let request = client.from("client_agreement_acceptances").select(acceptanceColumns, { count: "exact" }).order("accepted_at", { ascending: false });
  if (customer) request = request.eq("user_id", customer);
  if (!showAll) request = request.eq("status", "pending");
  const { data, error, count } = await request.range((page - 1) * 50, page * 50 - 1);
  const rows = (data || []) as AgreementAcceptance[];
  const href = (nextPage: number, all = showAll) => `/admin/agreements?${new URLSearchParams({ page: String(nextPage), status: all ? "all" : "pending", ...(customer ? { customer } : {}) })}`;
  const t = getAdminText(locale);
  return <main className="admin-workspace">
    <AdminPageHeader eyebrow={t("Operations")} title={copy.queue} description={copy.reviewIntro} />
    <nav className="admin-segmented mb-5" aria-label={copy.queue}>
      <Link href={href(1, false)} aria-current={!showAll ? "page" : undefined}>{copy.pending}</Link>
      <Link href={href(1, true)} aria-current={showAll ? "page" : undefined}>{copy.all}</Link>
    </nav>
    {error ? <AdminAlert tone="danger">{copy.unavailable}</AdminAlert> : <AdminCard title={copy.queue} flush>
      {!rows.length ? <AdminEmpty>{copy.empty}</AdminEmpty> : <div className="admin-list admin-list-compact">
        <div className="admin-list-head" aria-hidden="true"><span>{t("Date")}</span><span>{t("Client")}</span><span>{copy.version}</span><span>{t("Status")}</span><span /></div>
        {rows.map(row => <details key={row.id} className="admin-list-row" open={row.status === "pending"}>
          <summary>
            <span className="admin-list-date">{new Date(row.accepted_at).toLocaleDateString(locale)}</span>
            <span className="admin-list-primary"><span className="admin-cell-main">{row.signer_name}</span><span className="admin-cell-sub">{row.email}</span></span>
            <span className="admin-list-secondary"><span className="admin-cell-main">{row.version}</span><span className="admin-cell-sub">{row.locale.toUpperCase()}</span></span>
            <span className="admin-list-status"><StatusBadge status={row.status} label={copy[row.status]} /></span>
            <ChevronDown size={16} aria-hidden="true" className="admin-disclosure-icon" />
          </summary>
          <div className="admin-list-detail">
            <dl className="admin-facts">
              <div><dt>{copy.acceptedAt}</dt><dd>{new Date(row.accepted_at).toLocaleString(locale)}</dd></div>
              {row.signer_ip && <div><dt>IP</dt><dd>{row.signer_ip}</dd></div>}
              <div className="admin-facts-wide"><dt>{copy.version}</dt><dd className="break-all">{row.version} · {row.locale.toUpperCase()} · SHA-256 {row.document_sha256}</dd></div>
            </dl>
            {row.is_draft && <p className="admin-alert admin-alert-warning !mb-0">{copy.draftNotice}</p>}
            <blockquote className="admin-quote">{row.consent_text}</blockquote>
            <div className="admin-actions">{row.signed_pdf_sha256 && <a href={`/api/client-agreements/${row.id}/signed?view=1`} target="_blank" rel="noreferrer" className="admin-btn admin-btn-sm">{copy.signedPdf}</a>}<a href={row.document_path} target="_blank" rel="noreferrer" className="admin-btn admin-btn-secondary admin-btn-sm">{copy.document}</a><a href={`/api/client-agreements/${row.id}/receipt`} target="_blank" rel="noreferrer" className="admin-btn admin-btn-secondary admin-btn-sm">{copy.receipt}</a></div>
            {row.status === "pending" ? <ReviewForm id={row.id} locale={locale} /> : <div className="admin-note"><p className="whitespace-pre-wrap break-words">{row.review_note}</p>{row.reviewed_at && <p className="mt-1 text-[12px] opacity-80">{copy.decisionAt}: {new Date(row.reviewed_at).toLocaleString(locale)}</p>}</div>}
          </div>
        </details>)}
      </div>}
    </AdminCard>}
    {!error && <nav className="flex gap-5" aria-label={copy.queue}>{page > 1 && <Link href={href(page - 1)} className="admin-link">{copy.previous}</Link>}{(count || 0) > page * 50 && <Link href={href(page + 1)} className="admin-link">{copy.next}</Link>}</nav>}
  </main>;
}
