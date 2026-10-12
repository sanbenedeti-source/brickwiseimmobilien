import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdminUser } from "@/app/lib/admin";
import { getCurrentLocale } from "@/app/lib/server-locale";
import { agreementCopy } from "@/app/lib/agreement-copy";
import { acceptanceColumns, type AgreementAcceptance } from "@/app/lib/client-agreements";
import ReviewForm from "./ReviewForm";

export default async function AgreementsPage({ searchParams }: { searchParams: Promise<{ page?: string; customer?: string; status?: string }> }) {
  const client = await createClient();
  const { data: { user }, error: authError } = await client.auth.getUser();
  if (authError || !user) redirect("/admin");
  if (!isAdminUser(user)) redirect("/dashboard");
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
  return <main className="admin-workspace">
    <section className="admin-hero"><h1>{copy.queue}</h1><p>{copy.reviewIntro}</p></section>
    <section className="admin-content-section space-y-5">
      <nav className="flex flex-wrap gap-4" aria-label={copy.queue}>
        <Link href={href(1, false)} aria-current={!showAll ? "page" : undefined} className="rounded-lg border border-slate-300 bg-white px-4 py-3 font-semibold">{copy.pending}</Link>
        <Link href={href(1, true)} aria-current={showAll ? "page" : undefined} className="rounded-lg border border-slate-300 bg-white px-4 py-3 font-semibold">{copy.all}</Link>
      </nav>
      {error ? <p role="alert">{copy.unavailable}</p> : !rows.length ? <p>{copy.empty}</p> : rows.map(row => <article key={row.id} className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-xl font-bold">{row.signer_name}</h2><p className="mt-2 break-all text-sm text-slate-600">{row.email}</p></div><strong className="rounded-full bg-slate-100 px-3 py-2 text-sm">{copy[row.status]}</strong></div>
        <p className="mt-4 text-sm">{copy.acceptedAt}: {new Date(row.accepted_at).toLocaleString(locale)}</p>
        <p className="mt-2 break-all text-sm text-slate-500">{copy.version}: {row.version} · {row.locale.toUpperCase()}</p>
        {row.is_draft && <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{copy.draftNotice}</p>}
        <blockquote className="mt-4 border-l-2 border-sky-300 pl-4 text-sm leading-6">{row.consent_text}</blockquote>
        <div className="mt-4 flex flex-wrap gap-4"><a href={row.document_path} target="_blank" rel="noreferrer" className="font-bold text-sky-700 underline">{copy.document}</a><a href={`/api/client-agreements/${row.id}/receipt`} target="_blank" rel="noreferrer" className="font-bold text-sky-700 underline">{copy.receipt}</a></div>
        {row.status === "pending" ? <ReviewForm id={row.id} locale={locale} /> : <div className="mt-4 border-t border-slate-200 pt-4"><p className="whitespace-pre-wrap break-words text-sm">{row.review_note}</p>{row.reviewed_at && <p className="mt-2 text-xs text-slate-500">{copy.decisionAt}: {new Date(row.reviewed_at).toLocaleString(locale)}</p>}</div>}
      </article>)}
      {!error && <nav className="flex gap-5" aria-label={copy.queue}>{page > 1 && <Link href={href(page - 1)} className="font-bold text-sky-700">{copy.previous}</Link>}{(count || 0) > page * 50 && <Link href={href(page + 1)} className="font-bold text-sky-700">{copy.next}</Link>}</nav>}
    </section>
  </main>;
}
