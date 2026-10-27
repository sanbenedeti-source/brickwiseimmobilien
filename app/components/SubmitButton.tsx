"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";

/** Submit button for server-action forms: disabled while the action runs, so a form cannot be sent twice. */
export default function SubmitButton({ className, children }: { className: string; children: ReactNode }) {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} aria-busy={pending} className={className}>{children}</button>;
}
