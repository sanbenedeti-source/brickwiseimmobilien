"use client";

import Image from "next/image";
import { Images } from "lucide-react";
import { useState } from "react";
import type { Locale } from "../../lib/i18n";
import { propertyGalleryCopy } from "../property-ui-copy";

export default function PortalPropertyGallery({ images, title, locale }: { images: string[]; title: string; locale: Locale }) {
  const safeImages = images.length ? images : ["https://images.unsplash.com/photo-1600607687939-ce8a6c25118c"];
  const [active, setActive] = useState(0);
  const secondary = safeImages.filter((_, index) => index !== active).slice(0, 2);
  const copy = propertyGalleryCopy[locale];

  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(0,3.2fr)_minmax(220px,1fr)]">
      <button type="button" aria-label={`${copy.next}: ${title}`} onClick={() => setActive((active + 1) % safeImages.length)} className="relative min-h-[320px] overflow-hidden bg-line text-left sm:min-h-[440px]">
        <Image src={safeImages[active]} alt={`${title} – ${copy.photo} ${active + 1}`} fill sizes="(max-width: 1023px) 100vw, 900px" loading="eager" fetchPriority="high" unoptimized={!safeImages[active].startsWith("/")} className="object-cover" />
        <span className="absolute bottom-4 left-4 rounded-full bg-brand px-4 py-2 text-sm font-bold text-white">{copy.primary}</span>
      </button>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
        {(secondary.length ? secondary : safeImages.slice(0, 1)).map((image, index) => {
          const imageIndex = safeImages.indexOf(image);
          return <button type="button" key={`${image}-${index}`} aria-label={`${copy.photo} ${imageIndex + 1}: ${title}`} onClick={() => setActive(imageIndex)} className="relative min-h-36 overflow-hidden bg-canvas"><Image src={image} alt="" fill sizes="(max-width: 1023px) 50vw, 300px" loading="lazy" unoptimized={!image.startsWith("/")} className="object-cover" />{index === 1 && safeImages.length > 3 && <span className="absolute inset-0 flex items-center justify-center bg-white/70"><span className="inline-flex items-center gap-2 rounded-full bg-black px-4 py-2 text-sm font-bold text-white"><Images size={16} />{safeImages.length - 3} {copy.more}</span></span>}</button>;
        })}
      </div>
      <span className="sr-only">{copy.gallery}: {title}</span>
    </div>
  );
}
