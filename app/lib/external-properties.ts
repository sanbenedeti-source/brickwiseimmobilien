import { MINIMUM_INVESTMENT_EUR } from "./investment-policy";
import type { PropertyReturnBreakdown } from "./property-financials";
export type PropertyMapLocation = ({
  latitude: number;
  longitude: number;
} | {
  query: string;
}) & {
  streetViewUrl?: string;
  precision?: "area" | "point";
};

export type ListingProperty = {
  id: string;
  title: string;
  slug: string;
  description: string;
  price: number;
  city: string;
  address: string;
  mapLocation?: PropertyMapLocation;
  property_type: string;
  bedrooms: number;
  bathrooms: number;
  area: number;
  rooms: number;
  image_url: string;
  image_urls?: string[];
  status: string;
  constructionStatus?: "completed" | "under_construction";
  investmentOpen?: boolean;
  created_at: string;
  sourceName: string;
  sourceUrl: string;
  rentalModel?: "illustrative-eur-nightly";
  monthlyRent: number;
  monthlyExpenses: number;
  annualRent: number;
  annualYield: number;
  targetTotalReturn?: number;
  targetReturnBreakdown?: PropertyReturnBreakdown;
  appreciationYield: number;
  vacationPointYield?: number;
  currentReturn?: number;
  sharePrice: number;
  currency: "EUR";
  totalShares?: number;
  blockedShares?: number;
  minInvestmentEur: number;
  fundedPercent: number;
  payoutModel: string;
};

export const hiddenManualPropertyIds = [
  "dc39b9e4-8a96-4bc3-b71a-e404099433ad",
  "8671134e-8663-4d6f-a74d-9c05e51cfbe9",
];

export const hiddenManualPropertySlugs = [
  "moderne-wohnung-in-munchen-1779530402549",
  "apartament-modern-berlin",
];

const propertyCatalogue: ListingProperty[] = [
  {
    id: "external-sal-rei-boa-vista-b1-residences-ap1",
    title: "Sal Rei Boa Vista B1 Residences Ap1",
    slug: "sal-rei-boa-vista-b1-residences-ap1",
    description:
      "A completed one-bedroom coastal apartment in Estoril, Sal Rei, Boa Vista, Cape Verde, designed for short-term holiday rentals. The 54 sqm apartment sleeps up to four guests, with a queen-size bedroom, sofa bed, fitted kitchen and walk-in shower. Listed amenities include a swimming pool, gym, air conditioning, laundry, Wi-Fi and security. The property is approximately ten minutes from Aristides Pereira International Airport. Figures are modelled estimates: the rental model assumes EUR 200 per day and 20 occupied days per month, giving EUR 4,000 monthly and EUR 48,000 annual gross rent before operating costs. The modelled annual target is 26%: 19% target rental return, 2.5% vacation-point benefits and 4.5% appreciation. The target rental return is separate from the rental-income estimate above. Availability, operating costs and returns must be independently confirmed before any commitment.",
    price: 265366,
    city: "Sal Rei",
    address: "Estoril, Sal Rei, Boa Vista, Cape Verde 5110",
    mapLocation: { query: "Estoril, Sal Rei, Boa Vista, Cape Verde 5110", precision: "area" },
    property_type: "Coastal apartment",
    bedrooms: 1,
    bathrooms: 1,
    area: 54,
    rooms: 2,
    image_url: "/properties/sal-rei-b1/bdf3d010-2461-4233-bb4d-f7298b4671fa.jpeg",
    image_urls: [
      "/properties/sal-rei-b1/bdf3d010-2461-4233-bb4d-f7298b4671fa.jpeg",
      "/properties/sal-rei-b1/15ec4daa-497e-499e-a4a6-b840594064ac.jpeg",
      "/properties/sal-rei-b1/48c19527-69e2-439e-a6fd-8e2e721a0e8f.jpeg",
      "/properties/sal-rei-b1/5852fd94-8ee9-4ca9-9409-b801694ea95e.jpeg",
      "/properties/sal-rei-b1/cdf26364-5c6a-4989-95b0-0d401df16b12.jpeg",
      "/properties/sal-rei-b1/ad606c0f-36ff-49bb-8510-79894ec2ce06.jpeg",
      "/properties/sal-rei-b1/9f8d61c2-3da8-4eda-9430-9673ca74825c.jpeg",
      "/properties/sal-rei-b1/113ad1f2-d40c-45a3-8b00-99e5e7fc6934.jpeg",
      "/properties/sal-rei-b1/0e31acf0-c36b-44a7-9dcd-e18580862ab2.jpeg",
      "/properties/sal-rei-b1/9b70c94f-972c-4901-a59f-6322c432f32a.jpeg",
      "/properties/sal-rei-b1/6d73dc98-92c6-4132-bcd1-3d09a5ed1546.jpeg",
      "/properties/sal-rei-b1/21e7fa89-f7b2-4d33-b4fb-84d68472cd62.jpeg",
      "/properties/sal-rei-b1/17204cd4-2dc0-4930-bc7a-4e65297c2eb8.jpeg",
      "/properties/sal-rei-b1/34379be2-3088-4b6b-aa77-85c5016ae614.jpeg",
      "/properties/sal-rei-b1/829115e2-30f0-4179-b8ba-7487424a5566.jpeg",
      "/properties/sal-rei-b1/aab78037-f901-417b-8126-4bbfc9798db8.jpeg",
      "/properties/sal-rei-b1/c199ea5f-317d-42a3-aa4f-5e3d1eff045c.jpeg",
      "/properties/sal-rei-b1/4112dfcf-7019-4245-a43c-2df740ffb7e6.jpeg",
    ],
    status: "active",
    constructionStatus: "completed",
    investmentOpen: true,
    created_at: "2026-08-07T00:00:00.000Z",
    sourceName: "Carré property information supplied by the listing owner",
    sourceUrl: "https://carre.ai/marketplace/propdetails/e8fb8060-f9d9-4a74-9129-0be107cf3922",
    monthlyRent: 200 * 20,
    monthlyExpenses: 0,
    annualRent: 200 * 20 * 12,
    annualYield: 48000 / 265366 * 100,
    vacationPointYield: 2.5,
    targetTotalReturn: 26,
    targetReturnBreakdown: { rental: 19, vacationPoint: 2.5, appreciation: 4.5 },
    appreciationYield: 4.5,
    sharePrice: 250,
    currency: "EUR",
    totalShares: 1061,
    blockedShares: 31,
    minInvestmentEur: MINIMUM_INVESTMENT_EUR,
    fundedPercent: 31 / 1061 * 100,
    payoutModel: "Modelled gross rent at EUR 200 per day for 20 days per month, plus 9.5% non-cash vacation points; operating costs not yet provided",
  },
  {
    id: "external-edmonton-windsor-park-8712-120-st",
    title: "8712 120 ST Windsor Park",
    slug: "edmonton-windsor-park-8712-120-st",
    description:
      "A rare offering in Windsor Park, a one of a kind urban infill combines thoughtful design, exceptional location and versatile living space. Steps to River Valley, school, park and all conveniences including UofA campus and hospital. 6 minute drive to Royal Glenora, Victoria Park and downtown amenities. Approximately 4200 sf of total living space and impressive 1000 sf rooftop patio, with 2500 sf above grade main residence plus fully finished basement and garage suite. Thoughtfully designed with an open concept layout, enhanced by abundant natural light and a seamless sense of flow. 4 bedrooms, 3 living areas, open-to-above dining and convertible flex spaces. Chef's kitchen with ample storage and upgraded appliances and fixtures. NanaWall folding glass doors open completely to heated patio, backyard and sports court. Upper level features an oversized primary bedroom complete with 5 piece ensuite, dressing room and private balcony. 2 additional bedrooms and laundry room. Lower level highlights dual rec spaces, bedroom with murphy bed and hobby station. Extensive list of features to be appreciated in person.",
    price: 1008000,
    city: "Edmonton",
    address: "8712 120 ST, Edmonton, AB T6G1X3",
    mapLocation: {
      latitude: 53.5237672,
      longitude: -113.538638,
      precision: "point",
      streetViewUrl: "https://www.google.com/maps/@53.5237672,-113.538638,3a,75y,244.57h,90t/data=!3m7!1e1!3m5!1sVgqS_XqThYzEV5RXufdK7A!2e0!6shttps:%2F%2Fstreetviewpixels-pa.clients6.google.com%2Fv1%2Fthumbnail%3Fcb_client%3Dmaps_sv.tactile%26w%3D900%26h%3D600%26pitch%3D0%26panoid%3DVgqS_XqThYzEV5RXufdK7A%26yaw%3D244.57127!7i16384!8i8192",
    },
    property_type: "Detached",
    bedrooms: 4,
    bathrooms: 5,
    area: 232,
    rooms: 8,
    image_url:
      "https://cdn.wahi.com/listings/images/crea/IMG-E4495028-29934965_1-1200.webp",
    image_urls: [
      "https://cdn.wahi.com/listings/images/crea/IMG-E4495028-29934965_1-1200.webp",
      "https://cdn.wahi.com/listings/images/crea/IMG-E4495028-29934965_2-1200.webp",
      "https://cdn.wahi.com/listings/images/crea/IMG-E4495028-29934965_3-1200.webp",
      "https://cdn.wahi.com/listings/images/crea/IMG-E4495028-29934965_4-1200.webp",
      "https://cdn.wahi.com/listings/images/crea/IMG-E4495028-29934965_5-1200.webp",
      "https://cdn.wahi.com/listings/images/crea/IMG-E4495028-29934965_6-1200.webp",
      "https://cdn.wahi.com/listings/images/crea/IMG-E4495028-29934965_7-1200.webp",
    ],
    status: "active",
    constructionStatus: "completed",
    created_at: "2026-06-22T00:00:00.000Z",
    sourceName: "Wahi / CREA listing E4495028",
    sourceUrl:
      "https://wahi.com/ca/en/real-estate/ab/edmonton/windsor-park/8712-120-st-edmonton-t6g1x3-alberta-canada",
    rentalModel: "illustrative-eur-nightly",
    monthlyRent: 660 * 20,
    monthlyExpenses: 660 * 20 * 0.30,
    annualRent: 660 * 20 * 12,
    annualYield: 660 * 20 * 12 / 1008000 * 100,
    appreciationYield: 4.75,
    targetTotalReturn: 26.25,
    targetReturnBreakdown: { rental: 19, vacationPoint: 2.5, appreciation: 4.75 },
    sharePrice: 1000,
    currency: "EUR",
    totalShares: 1008,
    minInvestmentEur: MINIMUM_INVESTMENT_EUR,
    fundedPercent: 0,
    payoutModel: "Illustrative 26.25% annual target: 19% target rental return, 4.75% assumed appreciation and 2.5% non-cash vacation points",
  },
  {
    id: "external-toronto-midtown-condo",
    title: "Toronto Midtown Condo",
    slug: "toronto-midtown-condo",
    description:
      "Fractional rental participation model for a two-bedroom condominium near transit, employment hubs, and established rental demand. Investors review the property value, expected gross rent, payout model, and risk notes before requesting access.",
    price: 735000,
    city: "Toronto",
    address: "Yonge-Eglinton, Toronto, ON",
    mapLocation: { query: "Yonge-Eglinton, Toronto, ON", precision: "area" },
    property_type: "Condominium",
    bedrooms: 2,
    bathrooms: 2,
    area: 78,
    rooms: 3,
    image_url: "/property-1.jpg",
    status: "active",
    created_at: "2026-05-25T00:00:00.000Z",
    sourceName: "Fractional Investing Real Estate pipeline",
    sourceUrl: "#",
    monthlyRent: 3100,
    monthlyExpenses: 950,
    annualRent: 37200,
    annualYield: 5.06,
    targetTotalReturn: 27,
    targetReturnBreakdown: { rental: 19, vacationPoint: 2.5, appreciation: 5.5 },
    appreciationYield: 5.5,
    sharePrice: 250,
    currency: "EUR",
    totalShares: 2940,
    minInvestmentEur: MINIMUM_INVESTMENT_EUR,
    fundedPercent: 64,
    payoutModel: "Monthly or annual",
  },
  {
    id: "external-vancouver-kitsilano-suite",
    title: "Vancouver Kitsilano Suite",
    slug: "vancouver-kitsilano-suite",
    description:
      "Modelled rental access for a compact urban suite in a high-demand Vancouver neighbourhood. The project focuses on resilient rental demand, clear assumptions, and transparent investor communication.",
    price: 895000,
    city: "Vancouver",
    address: "Kitsilano, Vancouver, BC",
    mapLocation: { query: "Kitsilano, Vancouver, BC", precision: "area" },
    property_type: "Condominium",
    bedrooms: 2,
    bathrooms: 1,
    area: 72,
    rooms: 3,
    image_url: "/small-real-estate.jpg",
    status: "active",
    created_at: "2026-05-25T00:00:00.000Z",
    sourceName: "Fractional Investing Real Estate pipeline",
    sourceUrl: "#",
    monthlyRent: 3450,
    monthlyExpenses: 1200,
    annualRent: 41400,
    annualYield: 4.63,
    targetTotalReturn: 27.5,
    targetReturnBreakdown: { rental: 19, vacationPoint: 2.5, appreciation: 6 },
    appreciationYield: 6,
    sharePrice: 500,
    currency: "EUR",
    totalShares: 1790,
    minInvestmentEur: MINIMUM_INVESTMENT_EUR,
    fundedPercent: 38,
    payoutModel: "Monthly or annual",
  },
  {
    id: "external-calgary-beltline-rental",
    title: "Calgary Beltline Rental",
    slug: "calgary-beltline-rental",
    description:
      "Income-focused rental project in Calgary's Beltline with a lower entry property value and strong urban tenant base. The model shows expected gross rent distribution by participation amount.",
    price: 428000,
    city: "Calgary",
    address: "Beltline, Calgary, AB",
    mapLocation: { query: "Beltline, Calgary, AB", precision: "area" },
    property_type: "Apartment",
    bedrooms: 2,
    bathrooms: 2,
    area: 84,
    rooms: 3,
    image_url: "/property-2.jpg",
    status: "active",
    created_at: "2026-05-25T00:00:00.000Z",
    sourceName: "Fractional Investing Real Estate pipeline",
    sourceUrl: "#",
    monthlyRent: 2050,
    monthlyExpenses: 650,
    annualRent: 24600,
    annualYield: 5.75,
    targetTotalReturn: 28,
    targetReturnBreakdown: { rental: 19, vacationPoint: 2.5, appreciation: 6.5 },
    appreciationYield: 6.5,
    sharePrice: 100,
    currency: "EUR",
    totalShares: 4280,
    minInvestmentEur: MINIMUM_INVESTMENT_EUR,
    fundedPercent: 51,
    payoutModel: "Monthly or annual",
  },
  {
    id: "external-ottawa-centretown-duplex",
    title: "Ottawa Centretown Duplex",
    slug: "ottawa-centretown-duplex",
    description:
      "Two-unit residential income property in central Ottawa with modelled annual rent and a simple participation structure for investors comparing cash-flow assumptions.",
    price: 690000,
    city: "Ottawa",
    address: "Centretown, Ottawa, ON",
    mapLocation: { query: "Centretown, Ottawa, ON", precision: "area" },
    property_type: "Duplex",
    bedrooms: 4,
    bathrooms: 2,
    area: 154,
    rooms: 6,
    image_url: "/hero-real-estate.jpg",
    status: "active",
    created_at: "2026-05-25T00:00:00.000Z",
    sourceName: "Fractional Investing Real Estate pipeline",
    sourceUrl: "#",
    monthlyRent: 3300,
    monthlyExpenses: 1050,
    annualRent: 39600,
    annualYield: 5.74,
    targetTotalReturn: 27.25,
    targetReturnBreakdown: { rental: 19, vacationPoint: 2.5, appreciation: 5.75 },
    appreciationYield: 5.75,
    sharePrice: 250,
    currency: "EUR",
    totalShares: 2760,
    minInvestmentEur: MINIMUM_INVESTMENT_EUR,
    fundedPercent: 46,
    payoutModel: "Monthly or annual",
  },
  {
    id: "external-montreal-plateau-triplex",
    title: "Montreal Plateau Triplex",
    slug: "montreal-plateau-triplex",
    description:
      "Modelled participation in a small multi-unit property in Montreal with a focus on diversified rent streams, occupancy assumptions, and clear project-level risk notes.",
    price: 815000,
    city: "Montreal",
    address: "Le Plateau-Mont-Royal, Montreal, QC",
    mapLocation: { query: "Le Plateau-Mont-Royal, Montreal, QC", precision: "area" },
    property_type: "Triplex",
    bedrooms: 5,
    bathrooms: 3,
    area: 188,
    rooms: 8,
    image_url: "/property-3.jpg",
    status: "active",
    created_at: "2026-05-25T00:00:00.000Z",
    sourceName: "Fractional Investing Real Estate pipeline",
    sourceUrl: "#",
    monthlyRent: 3850,
    monthlyExpenses: 1200,
    annualRent: 46200,
    annualYield: 5.67,
    targetTotalReturn: 26.75,
    targetReturnBreakdown: { rental: 19, vacationPoint: 2.5, appreciation: 5.25 },
    appreciationYield: 5.25,
    sharePrice: 500,
    currency: "EUR",
    totalShares: 1630,
    minInvestmentEur: MINIMUM_INVESTMENT_EUR,
    fundedPercent: 59,
    payoutModel: "Monthly or annual",
  },
];

// Rental inputs describe the property's rental scenario. The annual target is
// a separate model, with explicitly configured rental and non-cash components.
// EUR denomination retains the catalogue's numerical prices by owner request.
export const externalProperties: ListingProperty[] = propertyCatalogue.map((property) => {
  const annualRent = property.monthlyRent * 12;
  const annualYield = property.price > 0 ? annualRent / property.price * 100 : 0;
  return { ...property, annualRent, annualYield };
});

export function getExternalPropertyBySlug(slug: string) {
  return externalProperties.find((property) => property.slug === slug);
}

export function isPropertyOpenForInvestment(property: Pick<ListingProperty, "status" | "investmentOpen">) {
  return property.investmentOpen ?? property.status === "active";
}
