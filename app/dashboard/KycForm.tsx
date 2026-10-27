"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileUp, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Locale } from "../lib/i18n";
import { portalCopy } from "../lib/portal-copy";
import { KYC_MAX_BYTES, KYC_MIN_BYTES } from "../lib/client-finance";
import { fieldClass, primaryButtonClass } from "./portal-ui";

const extensionFor: Record<string, "pdf" | "jpg" | "png"> = { "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png" };

export default function KycForm({ locale }: { locale: Locale }) {
  const text = portalCopy[locale];
  const router = useRouter();
  const [state, setState] = useState<"idle" | "uploading" | "saved" | "error">("idle");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state === "uploading") return;
    const form = new FormData(event.currentTarget);
    const documentType = String(form.get("document_type") || "");
    const files = [form.get("identity"), form.get("address")];
    if (!files.every((file): file is File => file instanceof File && file.size >= KYC_MIN_BYTES && file.size <= KYC_MAX_BYTES && file.type in extensionFor)) { setState("error"); return; }
    const [identity, address] = files as File[];
    const payload = { documentType, identityExt: extensionFor[identity.type], addressExt: extensionFor[address.type] };
    setState("uploading");
    try {
      const call = (action: string, extra: Record<string, unknown> = {}) => fetch("/api/kyc", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, ...payload, ...extra }) });
      const start = await call("start");
      if (!start.ok) throw new Error("start");
      const { id, uploads } = await start.json() as { id: string; uploads: { path: string; token: string }[] };
      const bucket = createClient().storage.from("client-kyc");
      const results = await Promise.all([identity, address].map((file, index) => bucket.uploadToSignedUrl(uploads[index].path, uploads[index].token, file, { contentType: file.type })));
      if (results.some((result) => result.error)) throw new Error("upload");
      const complete = await call("complete", { id });
      if (!complete.ok) throw new Error("complete");
      setState("saved");
      router.refresh();
    } catch { setState("error"); }
  }

  if (state === "saved") return <p role="status" className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800"><ShieldCheck size={16} className="mt-0.5 shrink-0" aria-hidden="true" />{text.kycSaved}</p>;
  return <form onSubmit={submit} className="grid gap-4">
    <label className="text-xs font-semibold text-muted">{text.documentType}
      <select name="document_type" required defaultValue="passport" className={fieldClass}>
        <option value="passport">{text.passport}</option><option value="id_card">{text.idCard}</option><option value="driving_licence">{text.drivingLicence}</option>
      </select>
    </label>
    {(["identity", "address"] as const).map((name) => <label key={name} className="text-xs font-semibold text-muted">{name === "identity" ? text.identityFile : text.addressFile}
      <input name={name} type="file" required accept="application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png" className="mt-1.5 block w-full rounded-lg border border-dashed border-line-strong bg-white px-3 py-2.5 text-sm text-ink file:mr-3 file:rounded-md file:border-0 file:bg-brand-soft file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-brand" />
    </label>)}
    {state === "error" && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{text.kycError}</p>}
    <p className="text-xs leading-5 text-muted">{text.kycPrivacy}</p>
    <div><button disabled={state === "uploading"} className={`${primaryButtonClass} disabled:opacity-60`}><FileUp size={16} aria-hidden="true" />{state === "uploading" ? text.kycSubmitting : text.kycSubmit}</button></div>
  </form>;
}
