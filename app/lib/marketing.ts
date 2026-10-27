import publicPages from "./seo-pages.json";

export const consentKey = "brickwise-marketing-consent";
export type Consent = "accepted" | "rejected" | null;
const adsId = "AW-18367220713";
const pixelId = "1019805693890427";
type Fbq = ((...args: unknown[]) => void) & { callMethod?: (...args: unknown[]) => void; queue?: unknown[][]; loaded?: boolean; version?: string };
declare global {
  interface Window {
    fbq?: Fbq; _fbq?: Fbq; dataLayer?: unknown[]; gtag?: (...args: unknown[]) => void;
  }
}
let initialized = false;
let lastPage = "";
const consentValues = (value: string) => ({ ad_storage: value, analytics_storage: value, ad_user_data: value, ad_personalization: value });

export function readConsent(): Consent {
  try { const value = window.localStorage.getItem(consentKey); return value === "accepted" || value === "rejected" ? value : null; }
  catch { return null; }
}

// Ad click identifiers and campaign tags: needed to attribute a lead to its ad.
const attributionKeys = new Set(["gclid", "gbraid", "wbraid", "fbclid", "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"]);

// Tags can inspect the document URL themselves. Do not load them on private
// pages or URLs/referrers containing arbitrary query values or fragments.
export function safeMarketingUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if (!/^https?:$/.test(url.protocol) || url.hash || url.username || url.password) return null;
    if (!(url.pathname in publicPages) && !["/join", "/thank-you"].includes(url.pathname) && !/^\/(properties|insights)\/[a-z0-9-]+$/.test(url.pathname)) return null;
    const attribution = new URLSearchParams();
    for (const [key, value] of url.searchParams) {
      if (key === "lang" && ["en", "de", "fr", "es", "it"].includes(value)) continue;
      if (url.pathname === "/thank-you" && key === "conversion" && value === "lead") continue;
      if (url.pathname === "/contact" && key === "projekt" && /^[a-z0-9-]{1,120}$/.test(value)) continue;
      if (attributionKeys.has(key) && /^[\w.~%-]{1,200}$/.test(value)) { attribution.append(key, value); continue; }
      return null;
    }
    const query = attribution.toString();
    return url.origin + url.pathname + (query ? `?${query}` : "");
  } catch { return null; }
}
function permitted() {
  return readConsent() === "accepted" && safeMarketingUrl(window.location.href) && (!document.referrer || safeMarketingUrl(document.referrer));
}
function script(src: string) {
  const element = document.createElement("script");
  element.async = true; element.src = src; element.referrerPolicy = "no-referrer";
  element.dataset.brickwiseMarketing = "true";
  document.head.appendChild(element);
}
export function trackPage() {
  if (!permitted()) return;
  const page = safeMarketingUrl(window.location.href)!;
  if (!initialized) {
    initialized = true;
    window.dataLayer ||= [];
    // eslint-disable-next-line prefer-rest-params -- gtag's documented queue uses an Arguments object, not an Array.
    window.gtag = function () { window.dataLayer!.push(arguments); };
    window.gtag("consent", "default", consentValues("denied"));
    window.gtag("set", { ads_data_redaction: true, url_passthrough: false });
    window.gtag("consent", "update", consentValues("granted"));
    window.gtag("js", new Date());
    window.gtag("config", adsId, { send_page_view: false, page_location: page, page_referrer: document.referrer ? safeMarketingUrl(document.referrer) || "" : "", page_title: "BRICKWISE" });
    const fbq: Fbq = function (...args: unknown[]) { if (fbq.callMethod) fbq.callMethod(...args); else (fbq.queue ||= []).push(args); };
    fbq.queue = []; fbq.loaded = true; fbq.version = "2.0";
    window.fbq = fbq; window._fbq = fbq;
    fbq("consent", "grant");
    fbq("set", "autoConfig", false, pixelId);
    fbq("init", pixelId);
    script(`https://www.googletagmanager.com/gtag/js?id=${adsId}`);
    script("https://connect.facebook.net/en_US/fbevents.js");
  }
  if (lastPage === page) return;
  lastPage = page;
  window.fbq?.("track", "PageView");
  window.gtag?.("event", "page_view", { send_to: adsId, page_location: page, page_referrer: document.referrer ? safeMarketingUrl(document.referrer) || "" : "", page_title: "BRICKWISE" });
  window.dispatchEvent(new Event("brickwise-marketing-ready"));
}
export function trackConversion(name: "Lead" | "CompleteRegistration") {
  if (!permitted() || !initialized) return false;
  window.fbq?.("track", name);
  if (name === "Lead") window.gtag?.("event", "conversion", { send_to: `${adsId}/0uIqCIPvxN0cEOmXlrZE`, page_location: safeMarketingUrl(window.location.href), page_referrer: "" });
  return true;
}
/** clearCookies: on consent withdrawal only; leaving a public page keeps ad attribution. */
export function stopMarketing(clearCookies = true) {
  if (window.fbq?.queue) window.fbq.queue.length = 0;
  if (window.dataLayer) window.dataLayer.length = 0;
  window.fbq?.("consent", "revoke");
  window.gtag?.("consent", "update", consentValues("denied"));
  // Remove accessible marketing cookies only; never clear authentication cookies.
  const names = !clearCookies ? [] : document.cookie.split(";").map(cookie => cookie.trim().split("=")[0]).filter(name => /^(_ga($|_)|_gid$|_gat|_gcl_|_fbp$|_fbc$)/.test(name));
  const host = window.location.hostname.split(".");
  for (const name of names) {
    document.cookie = `${name}=; Max-Age=0; Path=/`;
    for (let i = 0; i < host.length - 1; i++) document.cookie = `${name}=; Max-Age=0; Path=/; Domain=.${host.slice(i).join(".")}`;
  }
  if (initialized) window.location.reload(); // Unload third-party listeners and pending tasks.
}
export function chooseConsent(value: Exclude<Consent, null>) {
  try { window.localStorage.setItem(consentKey, value); } catch { /* Fail closed if storage is unavailable. */ }
  if (value === "rejected") stopMarketing();
}
export function checkMarketingRoute() {
  if (initialized && !permitted()) stopMarketing(false);
  else trackPage();
}
