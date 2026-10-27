"use client";
import { useState } from "react";
import { Check, Copy } from "lucide-react";
export default function CopyPaymentValue({ value, label, copiedLabel, failedLabel }: { value: string; label: string; copiedLabel: string; failedLabel: string }) {
  const [status, setStatus] = useState("");
  async function copy() {
    try { await navigator.clipboard.writeText(value); setStatus(copiedLabel); }
    catch { setStatus(failedLabel); }
  }
  return <div className="mt-3"><button type="button" onClick={copy} className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-line bg-white px-3 text-sm font-semibold text-ink hover:bg-canvas">{status === copiedLabel ? <Check size={15} className="text-emerald-600" aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}{label}</button><span role="status" className="ml-3 text-xs text-muted">{status}</span></div>;
}
