"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import type { Locale } from "../../lib/i18n";
import { propertyGalleryCopy } from "../property-ui-copy";

type PropertyGalleryProps = {
  images: string[];
  title: string;
  locale: Locale;
};

const fallbackImage = "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2";

/** Swipeable photo strip (native scroll snapping) with optimized, lazily loaded slides and thumbnails. */
export default function PropertyGallery({ images, title, locale }: PropertyGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const track = useRef<HTMLDivElement>(null);
  const copy = propertyGalleryCopy[locale];
  const photos = images.length ? images : [fallbackImage];

  function showImage(index: number) {
    const next = (index + photos.length) % photos.length;
    setActiveIndex(next);
    const slider = track.current;
    if (slider) slider.scrollTo({ left: next * slider.clientWidth, behavior: "smooth" });
  }

  function syncWithScroll() {
    const slider = track.current;
    if (!slider || !slider.clientWidth) return;
    const index = Math.round(slider.scrollLeft / slider.clientWidth);
    if (index !== activeIndex) setActiveIndex(index);
  }

  return (
    <div role="region" aria-roledescription="carousel" aria-label={`${copy.gallery}: ${title}`}>
      <div className="relative">
        <div ref={track} onScroll={syncWithScroll} className="flex h-72 snap-x snap-mandatory overflow-x-auto overscroll-x-contain bg-line [scrollbar-width:none] md:h-[520px] [&::-webkit-scrollbar]:hidden">
          {photos.map((imageUrl, index) => (
            <div key={`${imageUrl}-${index}`} className="relative h-full w-full shrink-0 snap-center" aria-hidden={index !== activeIndex}>
              <Image
                src={imageUrl}
                alt={`${title} – ${copy.photo} ${index + 1}`}
                fill
                sizes="(max-width: 1152px) 100vw, 1152px"
                loading={index === 0 ? "eager" : "lazy"}
                fetchPriority={index === 0 ? "high" : "auto"}
                unoptimized={!imageUrl.startsWith("/")}
                className="object-cover"
              />
            </div>
          ))}
        </div>
        {photos.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => showImage(activeIndex - 1)}
              className="absolute left-3 top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-2xl font-bold text-ink shadow-lg transition hover:bg-white sm:flex"
              aria-label={copy.previous}
            >
              ‹
            </button>
            <button
              type="button"
              onClick={() => showImage(activeIndex + 1)}
              className="absolute right-3 top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-2xl font-bold text-ink shadow-lg transition hover:bg-white sm:flex"
              aria-label={copy.next}
            >
              ›
            </button>
            <div aria-live="polite" className="absolute bottom-3 right-3 rounded-full bg-ink/85 px-4 py-2 text-sm font-bold text-white">
              {activeIndex + 1} / {photos.length}
            </div>
          </>
        )}
      </div>

      {photos.length > 1 && (
        <div className="flex gap-3 overflow-x-auto p-3 md:p-4">
          {photos.map((imageUrl, index) => (
            <button
              key={`${imageUrl}-${index}`}
              type="button"
              onClick={() => showImage(index)}
              aria-current={activeIndex === index}
              className={`relative h-20 w-28 shrink-0 overflow-hidden rounded-xl ring-2 transition md:h-24 md:w-36 ${
                activeIndex === index ? "ring-ink" : "ring-transparent"
              }`}
              aria-label={`${copy.photo} ${index + 1}: ${title}`}
            >
              <Image src={imageUrl} alt="" fill sizes="144px" loading="lazy" unoptimized={!imageUrl.startsWith("/")} className="object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
