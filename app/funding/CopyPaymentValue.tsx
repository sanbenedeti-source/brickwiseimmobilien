"use client";
import { useState } from "react";
import { Check, Copy } from "lucide-react";
export default function CopyPaymentValue({ value, label, copiedLabel, failedLabel }: { value: string; label: string; copiedLabel: string; failedLabel: string }) {
  const [status, setStatus] = useState("");
  async function copy() {
    try { await navigator.clipboard.writeText(value); setStatus(copiedLabel); }
    catch { setStatus(failedLabel); }
  }
  return <div><button type="button" onClick={copy} className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700">{status === copiedLabel ? <Check size={16} /> : <Copy size={16} />}{label}</button><span role="status" className="ml-3 text-xs text-slate-600">{status}</span></div>;
}
