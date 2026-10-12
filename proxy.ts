import { NextRequest, NextResponse } from "next/server";
import { updateSession } from "./lib/supabase/proxy";
import {
  localeCookieName,
  localePreferenceCookieName,
  normalizeLocale,
  resolveLocale,
} from "./app/lib/i18n";

const oneYear = 60 * 60 * 24 * 365;

export async function proxy(request: NextRequest) {
  const localeQuery = request.nextUrl.searchParams.get("lang");
  const manualLocale = request.cookies.get(localePreferenceCookieName)?.value === "1";
  const locale = resolveLocale({
    query: localeQuery,
    cookie: request.cookies.get(localeCookieName)?.value,
    manualPreference: manualLocale,
    country:
      request.headers.get("x-vercel-ip-country") ||
      request.headers.get("cf-ipcountry"),
    acceptLanguage: request.headers.get("accept-language"),
  });

  // Forward the resolved language to Server Components on the first request,
  // including visitors whose language is selected from browser preferences.
  request.cookies.set(localeCookieName, locale);
  const sessionResponse = await updateSession(request);

  const response = localeQuery && !normalizeLocale(localeQuery)
    ? responseWithSessionCookies(
        NextResponse.redirect(removeLanguageParam(request.nextUrl)),
        sessionResponse,
      )
    : sessionResponse;

  response.cookies.set(localeCookieName, locale, {
    maxAge: oneYear,
    path: "/",
    sameSite: "lax",
  });

  // A language selected by the visitor remains stable. Without a manual
  // selection, every request follows the country header and then the browser.
  if (normalizeLocale(localeQuery)) {
    response.cookies.set(localePreferenceCookieName, "1", {
      maxAge: oneYear,
      path: "/",
      sameSite: "lax",
    });
  }

  response.headers.set("x-brickwise-locale", locale);

  return response;
}

function responseWithSessionCookies(
  response: NextResponse,
  sessionResponse: NextResponse,
) {
  sessionResponse.cookies.getAll().forEach((cookie) => {
    response.cookies.set(cookie);
  });

  for (const header of ["cache-control", "expires", "pragma"]) {
    const value = sessionResponse.headers.get(header);
    if (value) response.headers.set(header, value);
  }

  return response;
}

function removeLanguageParam(url: URL) {
  const nextUrl = new URL(url);
  nextUrl.searchParams.delete("lang");
  return nextUrl;
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|apple-icon.png|icon.png|icon.svg|.*\\..*).*)",
  ],
};
