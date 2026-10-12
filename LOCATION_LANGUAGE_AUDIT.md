# Hartat, gjuhët dhe paneli — 24 shtator 2026

## Hartat e pronave

Të shtatë pronat përdorin një funksion të përbashkët për lidhjet e Google Maps, hartën e integruar dhe gjuhën e hartës. Të dhënat e panelit, katalogut dhe API-së përputhen.

| Prona | Vendndodhja e përdorur |
|---|---|
| Sal Rei | Estoril, Sal Rei, Boa Vista, Cape Verde 5110 |
| Edmonton | Koordinatat dhe Street View të dërguara për 8712 120 ST Windsor Park |
| Toronto | Yonge-Eglinton, Toronto, ON |
| Vancouver | Kitsilano, Vancouver, BC |
| Calgary | Beltline, Calgary, AB |
| Ottawa | Centretown, Ottawa, ON |
| Montreal | Le Plateau-Mont-Royal, Montreal, QC |

Adresat që tregojnë lagje paraqiten si zona, me sqarim në gjuhën e zgjedhur. Nuk janë shpikur adresa ndërtesash. Për pronat e reja nga databaza, adresa bashkohet me qytetin kur ky mungon në adresë. Sal Rei dhe Edmonton mbajnë statusin e përfunduar të konfirmuar nga pronari; nuk janë caktuar statuse ndërtimi pa konfirmim për pesë pronat e tjera.

## Gjuhët

Gjuhët aktive janë anglisht, gjermanisht, frëngjisht, spanjisht dhe italisht. Zgjedhja manuale ruhet gjatë navigimit, përfshirë panelin dhe API-të që kthejnë mesazhe për përdoruesin.

- U plotësuan përkthimet e panelit, formularëve, gabimeve, statuseve, galerive, artikujve dhe teksteve në fund të faqes.
- Datat, përqindjet, numrat dhe paratë përdorin formatin e gjuhës së zgjedhur.
- U lokalizua faqja 404 dhe mesazhet për dokumentet/importin; gabimet teknike të ofruesit nuk shfaqen si mesazhe të papërkthyera.
- U verifikuan 35 përkthimet e pronave. Përshkrimi gjerman i Torontos u korrigjua në “dy dhoma gjumi”; ndryshimi u ruajt në databazë vetëm për atë përkthim.
- U hoq lista universale e pajisjeve që shfaqte pishinë, palestër dhe pajisje të tjera për çdo pronë pa të dhëna mbështetëse.

Emrat e pronave, adresat, të dhënat e klientëve dhe regjistrimet historike ruhen sipas burimit. Monedhat e pagesave historike dhe modeli financiar vjetor në EUR mbeten të dalluara.

## Paneli i administratorit

Navigimi, krijimi i pronës, importi, kërkesat, pagesat, fitimet dhe regjistri i veprimeve kanë përkthime në pesë gjuhët. Lista përfshin të shtatë pronat e katalogut me titujt e lokalizuar dhe lidhjet e hartave.

Krijimi manual kërkon adresë dhe përkthimet e detyrueshme; prona publikohet vetëm pasi të ruhen përkthimet. Importi ruan kontratën ekzistuese dhe shpjegon se tekstet në gjuhën burimore duhen përkthyer para publikimit shumëgjuhësh. Filtrat e qytetit/statusit në API zbatohen edhe mbi katalogun e pronave.

## Verifikimi

Kontrolli HTTP mbulon 34 faqe për secilën gjuhë, 35 paraqitje hartash, ndryshimin e gjuhës, API-të dhe kufizimin e hyrjes në faqet private. Pamjet private të administratorit dhe dashboard-it kontrollohen me të dhëna të simuluara. Nuk u kryen pagesa, dërgime email-esh apo krijime klientësh/pronash provë në prodhim.

- `npm run lint`: kaloi pa gabime dhe pa paralajmërime.
- `npm run build`: kaluan përpilimi, TypeScript dhe gjenerimi i faqeve.
- `npm run test:financial`: 33 teste kaluan.
- `npm run test:localization`: 20 teste kaluan, përfshirë pamjet e autentifikuara të panelit në pesë gjuhë, ruajtjen e përkthimeve para publikimit dhe formularët me shërbime të simuluara.
- Auditimi HTTP lokal: 170 faqe, 35 paraqitje hartash, 30 kontrolle mbrojtjeje të faqeve private, 17 kontrolle API dhe 5 ndërrime gjuhësh kaluan.
- Kontrolli i teksteve të gjata të përsëritura në anglisht: asnjë rast i mbetur; kontrolli i veçantë i etiketave të shkurtra u plotësua me rishikim.
- Auditimi financiar i të shtatë pronave kaloi në aplikacionin lokal.

## Publikimi dhe verifikimi live

- Vercel production: `dpl_9hyyXow8mQq7bQhs3XBgeyDv9jvi`, statusi `READY`.
- Domeni i verifikuar: https://www.brickwise-immo.de.
- `node scripts/audit-localization.mjs https://www.brickwise-immo.de`: **PASS** — 170 faqe, 35 harta, 30 kontrolle hyrjeje, 17 kontrolle API dhe 5 ndërrime gjuhësh; asnjë fjali e gjatë anglisht e mbetur në gjuhët e tjera nga kontrolli i krahasimit.
- `node scripts/audit-property-financials.mjs https://www.brickwise-immo.de`: **PASS** për të shtatë pronat dhe formulat vjetore/mujore në faqet publike.
- Publikimi: https://brickwiseimmobilen-1g8khvfvx-ismarts-projects-fe72132b.vercel.app.

Rezultatet u regjistruan në raportin lokal pas publikimit. Pas publikimit u plotësua vetëm raporti dhe u bë i qartë konfigurimi anglisht i skriptit financiar të kontrollit; kodi i aplikacionit të verifikuar live nuk ndryshoi.
