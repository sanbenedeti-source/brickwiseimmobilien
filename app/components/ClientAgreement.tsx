"use client";

import { Download, ExternalLink, FileCheck2, FileText, RefreshCw } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { agreementCopy, type AgreementCopy } from "../lib/agreement-copy";
import type { Locale } from "../lib/i18n";
import SignaturePad from "./SignaturePad";

export type ClientAgreementData = {
  document: {
    version: string;
    locale: Locale;
    path: string;
    sha256: string;
    consentText: string;
    isDraft: boolean;
    requiresSignature?: boolean;
  };
  acceptance: {
    id: string;
    version: string;
    signer_name: string;
    accepted_at: string;
    status: "pending" | "approved" | "rejected";
    review_note: string | null;
    locale: Locale;
    document_path: string;
    document_sha256: string;
    is_draft: boolean;
    signed_pdf_sha256?: string | null;
  } | null;
  emailConfirmed: boolean;
};

class AgreementRequestError extends Error {}

function responseError(status: number, copy: AgreementCopy, saving = false) {
  if (status === 401) return copy.signInError;
  if (status === 403) return copy.forbiddenError;
  if (status === 409) return copy.changedError;
  if (status === 400 || status === 422) return copy.invalidError;
  if (status === 429) return copy.rateLimitError;
  return saving ? copy.saveError : copy.loadError;
}

const linkStyle = "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-brand hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600";
const buttonStyle = "inline-flex items-center justify-center gap-2 rounded-lg border border-line px-3 py-2 text-sm font-semibold text-ink hover:bg-canvas focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-wait disabled:opacity-50";

type ClientAgreementProps = {
  locale: Locale;
  signerName: string;
  canSign: boolean;
  beforeSign: () => Promise<void>;
  onCompletionChange?: (complete: boolean) => void;
  onSigningChange?: (signing: boolean) => void;
  disabled?: boolean;
};

// A locale change must load the corresponding document before another explicit click.
export default function ClientAgreement(props: ClientAgreementProps) {
  return <AgreementPanel key={props.locale} {...props} />;
}

function AgreementPanel({ locale, signerName, canSign, beforeSign, onCompletionChange, onSigningChange, disabled = false }: ClientAgreementProps) {
  const copy = agreementCopy(locale);
  const id = useId();
  const [data, setData] = useState<ClientAgreementData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState("");
  const [needsRefresh, setNeedsRefresh] = useState(false);
  const [signature, setSignature] = useState<string | null>(null);
  const submissionInFlight = useRef(false);
  const completionCallback = useRef(onCompletionChange);
  useEffect(() => { completionCallback.current = onCompletionChange; }, [onCompletionChange]);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch(`/api/client-agreements?lang=${locale}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) throw new AgreementRequestError(responseError(response.status, copy));
        const payload: ClientAgreementData = await response.json();
        if (!payload.document?.version || !payload.document?.consentText) throw new AgreementRequestError(copy.loadError);
        if (!controller.signal.aborted) {
          setData(payload);
          setNeedsRefresh(false);
          completionCallback.current?.(payload.acceptance?.status === "pending" || payload.acceptance?.status === "approved");
        }
      } catch (cause) {
        if (!controller.signal.aborted) {
          setError(cause instanceof AgreementRequestError ? cause.message : copy.loadError);
          setNeedsRefresh(true);
          completionCallback.current?.(false);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [attempt, locale, copy]);

  useEffect(() => {
    function updated(event: Event) {
      if ((event as CustomEvent<string>).detail === id) return;
      setLoading(true);
      setError("");
      setAttempt(value => value + 1);
    }
    window.addEventListener("brickwise:agreement-updated", updated);
    return () => window.removeEventListener("brickwise:agreement-updated", updated);
  }, [id]);

  function refresh() {
    setLoading(true);
    setError("");
    setAttempt(value => value + 1);
  }

  const acceptance = data?.acceptance;
  const canAccept = !acceptance;
  const documentPath = acceptance?.document_path || data?.document.path || `/documents/brickwise-cooperation-agreement-${locale}.pdf`;
  const documentIsDraft = acceptance?.is_draft ?? data?.document.isDraft ?? true;
  const complete = acceptance?.status === "pending" || acceptance?.status === "approved";
  const status = loading ? copy.loading : needsRefresh ? copy.unavailable : complete ? copy.signed : acceptance ? copy.rejected : copy.required;
  const statusColor = complete && !needsRefresh
    ? "bg-emerald-50 text-emerald-800"
    : acceptance?.status === "rejected" || needsRefresh
      ? "bg-amber-50 text-amber-900"
      : "bg-blue-50 text-brand";
  const needsSignature = Boolean(data?.document.requiresSignature);
  const canSubmit = Boolean(data && canAccept && data.emailConfirmed && canSign && (!needsSignature || signature) && signerName.trim().length >= 2 && signerName.trim().length <= 120 && !/[\u0000-\u001f\u007f]/.test(signerName) && !loading && !saving && !needsRefresh && !disabled);

  async function acceptDocument() {
    if (!canSubmit || !data || submissionInFlight.current) return;
    submissionInFlight.current = true;
    setSaving(true);
    onSigningChange?.(true);
    setError("");
    let submittingAcceptance = false;
    try {
      // Persist these profile fields first. A failed save must never record consent.
      await beforeSign();
      submittingAcceptance = true;
      const response = await fetch("/api/client-agreements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version: data.document.version, locale, signerName: signerName.trim(), consent: true, ...(needsSignature ? { signature } : {}) }),
      });
      if (!response.ok) throw new AgreementRequestError(responseError(response.status, copy, true));
      const payload: ClientAgreementData = await response.json();
      if (!payload.acceptance?.id || !payload.document?.version) throw new AgreementRequestError(copy.saveError);
      setData(payload);
      completionCallback.current?.(payload.acceptance.status === "pending" || payload.acceptance.status === "approved");
      window.dispatchEvent(new CustomEvent("brickwise:agreement-updated", { detail: id }));
    } catch (cause) {
      // Profile-save failures are shown by the profile form and remain retryable.
      if (submittingAcceptance) {
        setError(cause instanceof AgreementRequestError ? cause.message : copy.saveError);
        setNeedsRefresh(true);
      }
    } finally {
      submissionInFlight.current = false;
      setSaving(false);
      onSigningChange?.(false);
    }
  }

  return (
    <section aria-labelledby={`${id}-title`} aria-busy={loading || saving} className="min-w-0 border-t border-line pt-5 text-ink">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand" aria-hidden="true">
            {complete ? <FileCheck2 size={21} /> : <FileText size={21} />}
          </span>
          <h3 id={`${id}-title`} className="text-base font-semibold sm:text-lg">{copy.title}</h3>
        </div>
        <span role="status" className={`max-w-full rounded-full px-3 py-1 text-xs font-semibold ${statusColor}`}>{status}</span>
      </div>

      <div className="-ml-3 mt-3 flex flex-wrap items-center gap-x-1 gap-y-2">
        <a href={documentPath} target="_blank" rel="noopener noreferrer" className={linkStyle}>
          <ExternalLink size={16} aria-hidden="true" /> {copy.document}<span className="sr-only"> ({copy.newTab})</span>
        </a>
        {acceptance?.signed_pdf_sha256 && <a href={`/api/client-agreements/${encodeURIComponent(acceptance.id)}/signed`} className={linkStyle}>
          <Download size={16} aria-hidden="true" /> {copy.signedPdf}
        </a>}
        {acceptance && <a href={`/api/client-agreements/${encodeURIComponent(acceptance.id)}/receipt`} target="_blank" rel="noopener noreferrer" className={linkStyle}>
          <FileCheck2 size={16} aria-hidden="true" /> {copy.receipt}<span className="sr-only"> ({copy.newTab})</span>
        </a>}
      </div>

      {documentIsDraft && <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-950">{copy.draftNotice}</p>}

      {error && <div role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-3 text-sm leading-6 text-red-900">
        <p>{error}</p>
        <button type="button" onClick={refresh} disabled={loading || saving} className={`${buttonStyle} mt-2 bg-white`}><RefreshCw size={15} aria-hidden="true" />{copy.retry}</button>
      </div>}

      <div className="mt-4 space-y-3">
        {acceptance && <div className="space-y-2 rounded-xl bg-canvas p-4 text-sm">
          <p><span className="text-muted">{copy.acceptedBy}: </span><span className="break-words font-medium">{acceptance.signer_name}</span></p>
          <p><span className="text-muted">{copy.acceptedAt}: </span><time dateTime={acceptance.accepted_at}>{new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(acceptance.accepted_at))}</time></p>
          {acceptance.status === "rejected" && <p>{copy.rejectedDescription}</p>}
          {acceptance.review_note && <p className="whitespace-pre-wrap break-words"><span className="font-semibold">{copy.reviewNote}: </span>{acceptance.review_note}</p>}
        </div>}

        {data && canAccept && <div className="space-y-3">
          {!data.emailConfirmed && <p role="status" className="rounded-lg bg-blue-50 p-3 text-sm leading-6 text-brand-strong">{copy.emailRequired}</p>}
          <p className="text-sm"><span className="text-muted">{copy.signerName}: </span><span className="break-words font-semibold">{signerName.trim() || "—"}</span></p>
          {!canSign && <p role="status" className="text-sm text-muted">{copy.nameRequired}</p>}
          {needsSignature && <SignaturePad label={copy.signatureLabel} help={copy.signatureHelp} clearLabel={copy.clearSignature} typedLabel={copy.typedSignature} name={signerName} disabled={!data.emailConfirmed || saving || disabled} onChange={setSignature} />}
          {needsSignature && canSign && !signature && <p role="status" className="text-sm text-muted">{copy.signatureRequired}</p>}
          <p id={`${id}-consent`} className="text-sm leading-6 text-muted">{data.document.consentText}</p>
          <button type="button" onClick={() => void acceptDocument()} disabled={!canSubmit} aria-describedby={`${id}-consent`} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-brand px-5 py-3 text-sm font-semibold text-white hover:bg-brand-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-45 sm:w-auto">
            <FileCheck2 size={17} aria-hidden="true" />{saving ? copy.accepting : copy.accept}
          </button>
        </div>}

        {data && !data.emailConfirmed && !error && <button type="button" onClick={refresh} disabled={loading || saving} className={buttonStyle}><RefreshCw size={15} aria-hidden="true" className={loading ? "animate-spin" : ""} />{copy.refresh}</button>}
      </div>
    </section>
  );
}
