# Hapi 8 — SEO dhe indeksimi

## Ndryshimet
- Canonical i përbashkët `/` u hoq nga root layout. Faqet publike kanë metadata sipas rrugës dhe gjuhës; faqet e tjera trashëgojnë noindex/nofollow.
- Adresat me `?lang=en|de|fr|es|it` shërbejnë përmbajtjen përkatëse pa hequr parametrin me redirect. Zgjedhja eksplicite mbizotëron mbi cookie, vendndodhjen dhe gjuhën e shfletuesit. Cookie e preferencës vazhdon të ruhet.
- Canonical dhe Open Graph URL përdorin domenin production www dhe gjuhën eksplicite. Parametrat e filtrimit/marketingut nuk futen në canonical.
- Çdo faqe publike ka pesë hreflang dhe x-default në variantin anglisht.
- Pronat kanë titull, përshkrim dhe imazh nga përmbajtja e lokalizuar. Artikujt përdorin përmbajtjen dhe imazhin e tyre, me Open Graph article. Leximi i pronës ndahet ndërmjet metadata dhe faqes përmes React cache për kërkesën aktuale.
- Pronat e databazës kufizohen në active/available; pronat manuale të fshehura nuk ekspozohen në sitemap. Draftet nuk shërbehen nga faqja publike e detajeve.
- Sitemap ka aktualisht 115 adresa: 13 faqe të përgjithshme, 7 prona dhe 3 artikuj, secila në 5 gjuhë. Gjenerimi përdor klient anonim pa sesion; rifreskohet çdo orë dhe dështon në gabim databaze në vend që të publikojë një listë të paplotë.
- Robots.txt tregon sitemap-in. Rrugët private, autentikimi, API, interface dhe dokumentet kanë X-Robots-Tag noindex/nofollow. Faqet private nuk bllokohen nga robots.txt që robotët të mund të lexojnë direktivën noindex; autentikimi vazhdon të kontrollojë aksesin. API/interface/documents kanë edhe disallow.

## Verifikimi
- Build, lint dhe 20 teste lokalizimi kaluan.
- `node scripts/audit-seo.mjs http://localhost:3020` kontrolloi të 115 URL-të: HTTP 200, vetëm një canonical korrekt, gjuha HTML, hreflang dhe robots index/follow. Kërkesat kishin cookie italiane dhe gjuhë/vend gjerman për të provuar përparësinë e lang.
- U kontrolluan robots.txt, noindex në rrugët private, canonical pa filtra dhe një pronë inekzistente.
- Nuk pati ndryshim në të dhënat e klientëve apo financat.

## Publikimi
Deployment: dpl_AEdKUC8uZEtVYPHQxWxznvLdKzoJ, READY.
`node scripts/audit-seo.mjs https://www.brickwise-immo.de` kaloi të njëjtat kontrolle për të 115 adresat live, robots.txt, faqet private dhe canonical pa filtra.

Kjo rregullon sinjalet teknike të indeksimit; nuk garanton pozicionim ose indeksim të menjëhershëm nga motorët e kërkimit.
