"use client";
import { getAdminText } from "@/app/lib/admin-copy";
import { localeHtmlLang, type Locale } from "@/app/lib/i18n";

import { useState } from "react";

const sampleImport = {
  properties: [
    {
      title: "Toronto Downtown Condo",
      slug: "toronto-downtown-condo",
      description: "Licensed listing imported from an approved source.",
      price: 720000,
      currency: "EUR",
      city: "Toronto",
      address: "Downtown Toronto, ON",
      property_type: "Condominium",
      bedrooms: 2,
      bathrooms: 2,
      area: 75,
      rooms: 3,
      image_url: "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2",
      status: "active",
    },
  ],
};

export default function ImportPropertiesForm({ locale }: { locale: Locale }) {
  const t = getAdminText(locale);
  const [jsonValue, setJsonValue] = useState(JSON.stringify(sampleImport, null, 2));
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function importProperties() {
    setMessage("");
    setIsSubmitting(true);

    try {
      const parsed = JSON.parse(jsonValue);
      const response = await fetch("/api/properties/import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(parsed),
      });
      const result = await response.json();

      if (!response.ok) {
        setMessage([result.error || t("Import failed. Check the required property fields and EUR prices."), ...(Array.isArray(result.details) ? result.details : [result.details || ""])].join(" "));
        return;
      }

      setMessage(t("Properties imported: {count}. Open the properties page to view.").replace("{count}", Number(result.savedCount).toLocaleString(localeHtmlLang[locale])));
    } catch (error) {
      setMessage(t(error instanceof SyntaxError ? "Invalid JSON." : "Import failed. Check the required property fields and EUR prices."));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="mb-12 rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
      <h2 className="mb-2 text-3xl font-bold text-gray-900">{t("Import properties from API JSON")}</h2>

      <p className="mb-6 text-base text-gray-600">{t("Paste licensed property data from CREA, Repliers, or another approved provider. Prices must be in EUR; convert foreign-currency prices before importing. Imported active properties appear on the public properties page.")}</p>
      <p className="mb-6 rounded-xl bg-sky-50 p-4 text-sm text-sky-900">{t("Imported text keeps its source language. Review and supply translations in all five languages before publishing multilingual content.")}</p>

      <textarea
        aria-label={t("Import properties from API JSON")}
        value={jsonValue}
        onChange={(event) => setJsonValue(event.target.value)}
        rows={14}
        className="w-full resize-y rounded-xl border border-gray-300 bg-white px-4 py-3 font-mono text-sm text-gray-900 outline-none focus:border-[#0b1020]"
      />

      <div className="mt-5 flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={importProperties}
          disabled={isSubmitting}
          className="rounded-xl bg-[#0b1020] px-6 py-3 text-base font-bold text-white transition hover:bg-[#111827] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {t(isSubmitting ? "Importing..." : "Import JSON")}
        </button>

        {message && <p className="text-base font-semibold text-gray-700">{message}</p>}
      </div>
    </section>
  );
}
