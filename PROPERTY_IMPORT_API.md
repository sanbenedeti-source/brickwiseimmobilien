# Property Import API

## Public property feed

```http
GET /api/properties
```

Optional query parameters:

- `status=active|available|draft|all`
- `city=Toronto`
- `includeExternal=false`

## Import licensed properties

```http
POST /api/properties/import
Content-Type: application/json
```

The request must be sent by a signed-in admin session, or by a server with:

- `PROPERTY_IMPORT_API_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

When using server-to-server import, send:

```http
x-api-key: YOUR_PROPERTY_IMPORT_API_KEY
```

Example body:

```json
{
  "properties": [
    {
      "title": "Toronto Downtown Condo",
      "slug": "toronto-downtown-condo",
      "description": "Licensed listing imported from an approved source.",
      "price": 720000,
      "currency": "EUR",
      "city": "Toronto",
      "address": "Downtown Toronto, ON",
      "property_type": "Condominium",
      "bedrooms": 2,
      "bathrooms": 2,
      "area": 75,
      "rooms": 3,
      "image_url": "https://licensed-source.example/photo.jpg",
      "status": "active"
    }
  ]
}
```

The importer also accepts `imageUrl` or `photos: [{ "url": "..." }]`.
Only use image URLs you are licensed to display, or images uploaded to your own storage.

All property prices are denominated in EUR. An omitted currency means EUR;
an explicit currency other than EUR is rejected. The importer does not perform
currency conversion. Supported price inputs include `720000`, `"720,000.50"`,
`"720.000,50 €"`, and `"720 000,50 EUR"`. Malformed amounts or more than two
decimal places are rejected. Currency metadata does not require a new database column.

The public feed includes canonical share counts and a `financials` object.
`annual` and `monthly` are modelled amounts for one share; `propertyAnnual` and
`propertyMonthly` apply to the full property. The target period is annual and
every monthly target is its annual amount divided by 12.

The feed supports `lang=en|de|fr|es|it` and the site's language cookies or
`Accept-Language` header. Property titles, descriptions and property types are
localized, with `Content-Language` indicating the selected language. Field names
and status codes remain stable. Import and document-upload errors follow the same
language preference.

Each property with an address has a `map` object containing `query`, `mapUrl`,
`embedUrl`, `precision` (`area` or `point`), and an optional `streetViewUrl`.
Recorded street addresses include their city; neighborhood-only records remain
area maps. Existing supplied coordinates and panoramas are preserved.
The `city` and `status` filters apply to both database and catalogue properties.

Imports retain source text; translations for all five site languages must be
reviewed before multilingual publication. The manual admin creation form saves
all required translations before publishing a new listing.
