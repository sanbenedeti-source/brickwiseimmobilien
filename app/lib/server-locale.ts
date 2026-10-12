import { cookies } from "next/headers";
import { defaultLocale, localeCookieName, normalizeLocale, type Locale } from "./i18n";

/** The proxy forwards the resolved visitor language through this request cookie. */
export async function getCurrentLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  return normalizeLocale(cookieStore.get(localeCookieName)?.value) || defaultLocale;
}
