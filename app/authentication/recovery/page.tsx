"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useLocale } from "../../components/LocaleProvider";
import { createTranslator } from "../../lib/translate";

export default function RecoveryPage() {
  const t = createTranslator(useLocale());
  useEffect(() => {
    async function recoverSession() {
      const query = new URLSearchParams(window.location.search);
      const fragment = new URLSearchParams(window.location.hash.slice(1));
      const nextValue = query.get("next");
      const next = nextValue === "/update-password?portal=admin" || nextValue === "/update-password?portal=client"
        ? nextValue
        : "/update-password?portal=client";
      const accessToken = fragment.get("access_token");
      const refreshToken = fragment.get("refresh_token");
      const portal = next.includes("portal=admin") ? "admin" : "client";

      if (!accessToken || !refreshToken) {
        window.location.replace(`/forgot-password?error=invalid-link&portal=${portal}`);
        return;
      }

      const { error } = await createClient().auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      window.location.replace(error ? `/forgot-password?error=invalid-link&portal=${portal}` : next);
    }

    void recoverSession();
  }, []);

  return <main className="flex min-h-screen items-center justify-center bg-canvas"><span className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-brand" aria-label={t("Loading")} /></main>;
}
