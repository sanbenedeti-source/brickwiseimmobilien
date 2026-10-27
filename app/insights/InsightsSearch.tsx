"use client";

/** Filters the knowledge-centre cards rendered by the page (marked with data-insight-card). */
export default function InsightsSearch({ placeholder }: { placeholder: string }) {
  return <input type="search" placeholder={placeholder} aria-label={placeholder}
    className="min-h-14 min-w-0 flex-1 border-0 bg-transparent outline-none"
    onChange={(event) => {
      const query = event.target.value.trim().toLocaleLowerCase();
      document.querySelectorAll<HTMLElement>("[data-insight-card]").forEach((card) => {
        card.hidden = Boolean(query) && !card.textContent?.toLocaleLowerCase().includes(query);
      });
    }} />;
}
