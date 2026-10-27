"use client";

/** Opens the consent dialog owned by MetaPixelConsent (always reachable from the footer). */
export const cookieSettingsEvent = "brickwise-cookie-settings";

export default function CookieSettingsButton({ label, className }: { label: string; className: string }) {
  return <button type="button" className={className} onClick={() => window.dispatchEvent(new Event(cookieSettingsEvent))}>{label}</button>;
}
