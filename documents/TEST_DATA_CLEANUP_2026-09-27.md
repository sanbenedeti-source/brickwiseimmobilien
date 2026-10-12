# Pastrimi i të dhënave test — 27 shtator 2026

Pronari konfirmoi shprehimisht se të gjitha kërkesat dhe të dhënat financiare ekzistuese ishin teste dhe autorizoi pastrimin e pagesave, wallet-it dhe kuotave test.

| Të dhënat | Para | Pas |
| --- | ---: | ---: |
| Kërkesa | 3 | 0 |
| Pagesa | 3 | 0 |
| Transaksione wallet | 5 | 0 |
| Llogari wallet | 3 | 0 |
| Saldo totale wallet (CAD) | 7,000 | 0 |
| Pozicione në portofol | 2 | 0 |
| Kuota test në portofol | 14 | 0 |
| Kuota të bllokuara Edmonton | 14 | 0 |

U ruajtën 4 llogaritë e hyrjes, katalogu i pronave, parametrat e pronave të tjera dhe historiku i auditimit. Ndarja fillestare e kuotave të Sal Rei nuk ishte pjesë e blerjeve test dhe nuk u ndryshua.

Kopja lokale e rikthimit dhe mjetet e ekzekutimit gjenden në `project-backups/request-cleanup-2026-09-27/`. Kjo dosje përjashtohet nga publikimi në Vercel. Kopja përmban të dhëna private dhe nuk duhet publikuar.

Pastrimi u provua fillimisht me rollback. Transaksioni përfundimtar kontrolloi gjurmët e të dhënave dhe skemës, bllokoi tabelat përkatëse dhe verifikoi rezultatet përpara commit. Mbrojtja kundër ndryshimit të transaksioneve wallet mbeti aktive. Në audit u shtua ngjarja `maintenance.confirmed_test_data_cleanup`.

Publikimi në prodhim përfundoi me statusin READY: `dpl_9LcPmoMcSKrZQHUsVE59QDbcHWDv`.

Pas publikimit u verifikuan sërish të gjitha vlerat zero në databazë. Faqja kryesore, kontakti dhe `/api/properties` në https://www.brickwise-immo.de kthyen HTTP 200. API publike konfirmoi për Edmonton: 2,650 kuota gjithsej, 0 të bllokuara dhe 2,650 të disponueshme.

## Pastrimi shtesë i klientëve të regjistruar

Me kërkesën pasuese të pronarit për të fshirë edhe “Registered customers”, u fshinë përfundimisht 3 llogaritë e klientëve test përmes Supabase Auth Admin API. U ruajt vetëm llogaria me rolin e besuar `app_metadata.role = admin`. Verifikimi konfirmoi 0 klientë, 1 administrator dhe asnjë sesion apo identitet të mbetur për klientët e fshirë. Kërkesat, pagesat, wallet-et, transaksionet, portofolat dhe tabelat e kontakteve mbetën bosh.

Në panelin kryesor dhe zgjedhësin e klientëve për pagesa, administratorët përjashtohen tani nga lista e klientëve të regjistruar. Kjo lejon numërimin zero pa hequr aksesin administrativ. Kaluan lint dhe 20 testet ekzistuese të lokalizimit/panelit.

Fotografia private e metadata-ve të klientëve ndodhet në `project-backups/request-cleanup-2026-09-27/customers-before.json`. Nuk përmban fjalëkalime dhe nuk është kopje e plotë për rikthimin e autentikimit.

Korrigjimi u publikua me sukses në prodhim: `dpl_2ja4ar8n4nkEjXn83hjAL1teEKFH`, status READY. Build dhe TypeScript kaluan. Kontrolli HTTP i faqes publike dhe rrugëve të administratorit përfundoi pa gabime serveri; paneli kërkon autentikim.
