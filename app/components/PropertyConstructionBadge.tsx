import { CircleCheck } from "lucide-react";
import type { ListingProperty } from "../lib/external-properties";
import type { Locale } from "../lib/i18n";

const labels: Record<Locale, Record<NonNullable<ListingProperty["constructionStatus"]>, string>> = {
  en: { completed: "Construction completed", under_construction: "Under construction" },
  de: { completed: "Bau abgeschlossen", under_construction: "Im Bau" },
  fr: { completed: "Construction achevée", under_construction: "En construction" },
  es: { completed: "Construcción terminada", under_construction: "En construcción" },
  it: { completed: "Costruzione completata", under_construction: "In costruzione" },
};

export default function PropertyConstructionBadge({ status, locale }: {
  status?: ListingProperty["constructionStatus"];
  locale: Locale;
}) {
  if (!status) return null;

  return (
    <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold ${status === "completed" ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"}`}>
      {status === "completed" && <CircleCheck size={16} aria-hidden="true" />}
      {labels[locale][status]}
    </span>
  );
}
