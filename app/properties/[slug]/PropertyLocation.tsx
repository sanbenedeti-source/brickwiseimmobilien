import { ExternalLink, MapPin } from "lucide-react";
import type { Locale } from "../../lib/i18n";
import { getPropertyMapLinks } from "../../lib/property-location";
import { propertyUiCopy } from "../property-ui-copy";

const mapLabels: Record<Locale, string> = {
  en: "Open in Google Maps",
  de: "In Google Maps öffnen",
  fr: "Ouvrir dans Google Maps",
  es: "Abrir en Google Maps",
  it: "Apri in Google Maps",
};

type Props = {
  property: Parameters<typeof getPropertyMapLinks>[0];
  title: string;
  address: string;
  heading: string;
  locale: Locale;
};

const areaNotes: Record<Locale, string> = {
  en: "The map shows the listed area. Contact the team to confirm the exact building.",
  de: "Die Karte zeigt das angegebene Gebiet. Das genaue Gebäude bestätigt Ihnen unser Team.",
  fr: "La carte indique le secteur annoncé. Contactez l’équipe pour confirmer le bâtiment exact.",
  es: "El mapa muestra la zona indicada. Contacta con el equipo para confirmar el edificio exacto.",
  it: "La mappa mostra la zona indicata. Contatta il team per confermare l’edificio esatto.",
};

export default function PropertyLocation({ property, title, address, heading, locale }: Props) {
  const location = getPropertyMapLinks(property, locale);
  if (!location) return null;
  const { mapUrl, embedUrl } = location;

  return (
    <section id="location" aria-labelledby="property-location-heading" className="my-8 scroll-mt-24 overflow-hidden rounded-xl border border-[#dfe5eb] bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-5 p-6">
        <div>
          <h2 id="property-location-heading" className="flex items-center gap-2 text-2xl font-bold text-[#17233f]"><MapPin size={23} aria-hidden="true" />{heading}</h2>
          <p className="mt-2 text-[#687486]">{address}</p>
          {location.precision === "area" && <p className="mt-2 max-w-xl text-sm text-[#687486]">{areaNotes[locale]}</p>}
        </div>
        <div className="flex flex-wrap gap-3">
          <a href={mapUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[#2f9bdb] px-4 py-3 text-sm font-bold text-white hover:bg-[#17233f]">{mapLabels[locale]}<ExternalLink size={16} aria-hidden="true" /></a>
          {location.streetViewUrl && <a href={location.streetViewUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[#dfe5eb] px-4 py-3 text-sm font-bold text-[#17233f] hover:bg-[#f4f6f8]">{propertyUiCopy[locale].streetView}<ExternalLink size={16} aria-hidden="true" /></a>}
        </div>
      </div>
      <iframe
        title={`${heading}: ${title} — ${address}`}
        src={embedUrl}
        className="h-80 w-full border-0 sm:h-96"
        loading="lazy"
        referrerPolicy="strict-origin-when-cross-origin"
        allowFullScreen
      />
    </section>
  );
}
