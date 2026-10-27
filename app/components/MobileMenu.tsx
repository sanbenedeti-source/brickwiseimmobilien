"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { usePathname } from "next/navigation";

/** A <details> menu that closes after navigation instead of staying open on the next page. */
export default function MobileMenu({ className, children }: { className: string; children: ReactNode }) {
  const menu = useRef<HTMLDetailsElement>(null);
  const pathname = usePathname();
  useEffect(() => { menu.current?.removeAttribute("open"); }, [pathname]);
  useEffect(() => {
    const close = (event: KeyboardEvent | PointerEvent) => {
      const details = menu.current;
      if (!details?.open) return;
      if (event instanceof KeyboardEvent) {
        if (event.key !== "Escape") return;
        details.removeAttribute("open");
        details.querySelector("summary")?.focus();
      } else if (!details.contains(event.target as Node)) {
        details.removeAttribute("open");
      }
    };
    document.addEventListener("keydown", close);
    document.addEventListener("pointerdown", close);
    return () => {
      document.removeEventListener("keydown", close);
      document.removeEventListener("pointerdown", close);
    };
  }, []);
  return <details ref={menu} className={className} onClick={(event) => {
    if ((event.target as HTMLElement).closest("a")) menu.current?.removeAttribute("open");
  }}>{children}</details>;
}
