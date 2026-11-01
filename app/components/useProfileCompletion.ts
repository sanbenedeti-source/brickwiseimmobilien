"use client";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { readProfileFields } from "../lib/profile-fields";
import type { ClientAgreementData } from "./ClientAgreement";
import type { Locale } from "../lib/i18n";

/** The profile is complete when the client has a first and last name and has signed the agreement.
 * Re-read whenever the profile dialog or the agreement reports a change. */
export function useProfileCompletion(locale: Locale) {
  const [state, setState] = useState({ known: false, complete: false });
  const request = useRef(0);
  useEffect(() => {
    let controller: AbortController | undefined;
    async function load() {
      controller?.abort();
      controller = new AbortController();
      const signal = controller.signal;
      const current = ++request.current;
      try {
        const [auth, response] = await Promise.all([
          createClient().auth.getUser(),
          fetch(`/api/client-agreements?lang=${locale}`, { cache: "no-store", signal }),
        ]);
        if (auth.error || !auth.data.user || !response.ok) throw new Error("Profile unavailable");
        const agreement: ClientAgreementData = await response.json();
        const accepted = Boolean(agreement.acceptance?.id && (agreement.acceptance.status === "pending" || agreement.acceptance.status === "approved"));
        const fields = readProfileFields(auth.data.user.user_metadata);
        const named = Boolean(fields.first_name.trim() && fields.last_name.trim());
        if (!signal.aborted && current === request.current) setState({ known: true, complete: accepted && named });
      } catch {
        if (!signal.aborted && current === request.current) setState({ known: true, complete: false });
      }
    }
    void load();
    const updated = () => { void load(); };
    window.addEventListener("brickwise:agreement-updated", updated);
    window.addEventListener("brickwise:profile-updated", updated);
    return () => {
      controller?.abort();
      window.removeEventListener("brickwise:agreement-updated", updated);
      window.removeEventListener("brickwise:profile-updated", updated);
    };
  }, [locale]);
  return state;
}
