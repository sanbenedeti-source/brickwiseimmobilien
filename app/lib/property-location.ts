import type { PropertyMapLocation } from "./external-properties";
import type { Locale } from "./i18n";

type LocatedProperty = {
  address?: string | null;
  city?: string | null;
  mapLocation?: PropertyMapLocation;
};

/** Preserve supplied map points; otherwise search the recorded address or area. */
export function getPropertyMapLinks(property: LocatedProperty, locale: Locale = "en") {
  const location = property.mapLocation;
  const point = location && "latitude" in location
    && Number.isFinite(location.latitude) && Math.abs(location.latitude) <= 90
    && Number.isFinite(location.longitude) && Math.abs(location.longitude) <= 180;
  const address = property.address?.trim();
  const city = property.city?.trim();
  const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const addressHasCity = address && city && normalize(address).includes(normalize(city));
  const addressQuery = address && city && !addressHasCity ? `${address}, ${city}` : address || city;
  const query = point
    ? `${location.latitude},${location.longitude}`
    : (location && "query" in location ? location.query.trim() : "")
      || addressQuery;
  if (!query) return null;
  const precision = location?.precision ?? (point ? "point" : "area");
  const encoded = encodeURIComponent(query);
  return {
    query,
    precision,
    mapUrl: `https://www.google.com/maps/search/?api=1&query=${encoded}`,
    embedUrl: `https://www.google.com/maps?q=${encoded}&z=${precision === "point" ? 18 : 15}&output=embed&hl=${locale}`,
    streetViewUrl: location?.streetViewUrl,
  };
}
