"use client";

import { useEffect, useRef, useState } from "react";
import { MapPin } from "lucide-react";

/** Google Maps is only contacted after the visitor asks for the map. */
export default function PropertyMapEmbed({ src, title, loadLabel, notice }: { src: string; title: string; loadLabel: string; notice: string }) {
  const [loaded, setLoaded] = useState(false);
  const frame = useRef<HTMLIFrameElement>(null);
  // The button disappears on click; keep keyboard focus on the map that replaced it.
  useEffect(() => { if (loaded) frame.current?.focus(); }, [loaded]);

  if (loaded) return (
    <iframe
      ref={frame}
      title={title}
      src={src}
      className="h-80 w-full border-0 sm:h-96"
      loading="lazy"
      referrerPolicy="strict-origin-when-cross-origin"
      allowFullScreen
    />
  );
  return (
    <div data-map-src={src} className="flex h-48 w-full flex-col items-center justify-center gap-3 border-t border-line bg-canvas bg-[radial-gradient(circle_at_1px_1px,#dfe5ec_1px,transparent_0)] bg-[length:18px_18px] px-6 text-center sm:h-56">
      <button type="button" onClick={() => setLoaded(true)} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-ink px-5 py-3 text-sm font-bold text-white hover:bg-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
        <MapPin size={18} aria-hidden="true" />{loadLabel}
      </button>
      <p className="max-w-sm text-sm text-muted">{notice}</p>
    </div>
  );
}
