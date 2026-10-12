import { formatMinimumInvestment } from "./investment-policy";
export type Property = {
  slug: string;
  title: string;
  city: string;
  country: string;
  address: string;
  type: string;
  image: string;
  gallery: string[];
  rate: string;
  term: string;
  minInvestment: string;
  projectVolume: string;
  financed: string;
  status: string;
  riskClass: string;
  description: string;
  highlights: string[];
  details: {
    label: string;
    value: string;
  }[];
};

export const properties: Property[] = [
  {
    slug: "toronto-midtown-condo",
    title: "Toronto Midtown Condo",
    city: "Toronto",
    country: "Canada",
    address: "Yonge-Eglinton, Toronto, ON",
    type: "Condominium",
    image: "/property-1.jpg",
    gallery: ["/property-1.jpg", "/hero-real-estate.jpg", "/small-real-estate.jpg"],
    rate: "30.00%",
    term: "Monthly or annual",
    minInvestment: formatMinimumInvestment("en"),
    projectVolume: "€735,000",
    financed: "64%",
    status: "Active",
    riskClass: "Medium",
    description:
      "Urban rental property model with clear value, rent, and payout assumptions for investors comparing Canadian income properties.",
    highlights: [
      "Established Toronto rental market",
      `Minimum participation from ${formatMinimumInvestment("en")}`,
      "Monthly or annual payout model",
      "Transparent project information",
    ],
    details: [
      { label: "Property type", value: "Condominium" },
      { label: "Location", value: "Toronto, ON" },
      { label: "Annual target total return", value: "30.00%" },
      { label: "Payout", value: "Monthly or annual" },
      { label: "Minimum", value: formatMinimumInvestment("en") },
      { label: "Property value", value: "€735,000" },
      { label: "Funded", value: "64%" },
      { label: "Status", value: "Active" },
    ],
  },
];

export function getPropertyBySlug(slug: string) {
  return properties.find((property) => property.slug === slug);
}
