"use client";
import { useEffect, useRef } from "react";
import { trackConversion } from "../lib/marketing";

export default function MetaPixelEvent({ name }: { name: "Lead" | "CompleteRegistration" }) {
  const sent = useRef(false);
  useEffect(() => {
    const key = `brickwise-marketing-conversion-${name}`;
    const send = () => {
      if (sent.current) return;
      try { if (window.sessionStorage.getItem(key) === "sent") return; } catch { /* Use in-memory deduplication. */ }
      if (!trackConversion(name)) return;
      sent.current = true;
      try { window.sessionStorage.setItem(key, "sent"); } catch { /* Storage may be disabled. */ }
    };
    window.addEventListener("brickwise-marketing-ready", send);
    send();
    return () => window.removeEventListener("brickwise-marketing-ready", send);
  }, [name]);
  return null;
}
