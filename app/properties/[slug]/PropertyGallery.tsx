"use client";

import { useState } from "react";
import type { Locale } from "../../lib/i18n";
import { propertyGalleryCopy } from "../property-ui-copy";

type PropertyGalleryProps = {
  images: string[];
  title: string;
  locale: Locale;
};

export default function PropertyGallery({ images, title, locale }: PropertyGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const copy = propertyGalleryCopy[locale];

  if (images.length === 0) {
    return (
      <div
        className="h-72 bg-cover bg-center md:h-[480px]"
        style={{
          backgroundImage:
            "url(https://images.unsplash.com/photo-1560448204-e02f11c3d0e2)",
        }}
      />
    );
  }

  function previousImage() {
    setActiveIndex((index) => (index === 0 ? images.length - 1 : index - 1));
  }

  function nextImage() {
    setActiveIndex((index) => (index === images.length - 1 ? 0 : index + 1));
  }

  return (
    <div>
      <div
        className="relative h-72 bg-cover bg-center md:h-[520px]"
        style={{ backgroundImage: `url(${images[activeIndex]})` }}
      >
        {images.length > 1 && (
          <>
            <button
              type="button"
              onClick={previousImage}
              className="absolute left-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-2xl font-bold text-[#0F172A] shadow-lg transition hover:bg-white"
              aria-label={copy.previous}
            >
              ‹
            </button>
            <button
              type="button"
              onClick={nextImage}
              className="absolute right-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-2xl font-bold text-[#0F172A] shadow-lg transition hover:bg-white"
              aria-label={copy.next}
            >
              ›
            </button>
            <div className="absolute bottom-3 right-3 rounded-full bg-[#0F172A]/85 px-4 py-2 text-sm font-bold text-white">
              {activeIndex + 1} / {images.length}
            </div>
          </>
        )}
      </div>

      {images.length > 1 && (
        <div className="flex gap-3 overflow-x-auto p-3 md:p-4">
          {images.map((imageUrl, index) => (
            <button
              key={imageUrl}
              type="button"
              onClick={() => setActiveIndex(index)}
              className={`h-20 w-28 shrink-0 overflow-hidden rounded-xl ring-2 transition md:h-24 md:w-36 ${
                activeIndex === index ? "ring-[#0F172A]" : "ring-transparent"
              }`}
              aria-label={`${copy.photo} ${index + 1}: ${title}`}
            >
              <span
                className="block h-full w-full bg-cover bg-center"
                style={{ backgroundImage: `url(${imageUrl})` }}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
