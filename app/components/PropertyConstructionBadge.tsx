import { CircleCheck } from "lucide-react";
import type { ListingProperty } from "../lib/external-properties";
import type { Locale } from "../lib/i18n";

const labels: Record<Locale, Record<NonNullable<ListingProperty["constructionStatus"]>, string>> = {
  en: { completed: "Construction completed", under_construction: "Under construction", upcoming: "Upcoming" },
  de: { completed: "Bau abgeschlossen", under_construction: "Im Bau", upcoming: "Demnächst" },
  fr: { completed: "Construction achevée", under_construction: "En construction", upcoming: "Bientôt disponible" },
  es: { completed: "Construcción terminada", under_construction: "En construcción", upcoming: "Próximamente" },
  it: { completed: "Costruzione completata", under_construction: "In costruzione", upcoming: "In arrivo" },
};

export default function PropertyConstructionBadge({ status, locale }: {
  status?: ListingProperty["constructionStatus"];
  locale: Locale;
}) {
  if (!status) return null;

  return (
    <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold ${status === "completed" ? "bg-emerald-50 text-emerald-800" : status === "upcoming" ? "bg-sky-50 text-sky-800" : "bg-amber-50 text-amber-800"}`}>
      {status === "completed" && <CircleCheck size={16} aria-hidden="true" />}
      {labels[locale][status]}
    </span>
  );
}
