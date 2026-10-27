"use client";

import type { ReactNode } from "react";
import { openDepositEvent, openProfileEvent } from "./portal-events";

export default function PortalActionButton({ action, className, children }: { action: "profile" | "deposit"; className?: string; children: ReactNode }) {
  return <button type="button" className={className} onClick={() => window.dispatchEvent(new Event(action === "deposit" ? openDepositEvent : openProfileEvent))}>{children}</button>;
}
