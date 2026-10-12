**Korrigjimi i dy gjetjeve P1 — 2 tetor 2026**

Dy gjetjet e para të [auditit pas deployment-it](./AUDIT_PAS_DEPLOY_2026-10-02.md) janë korrigjuar dhe publikuar në [production](https://www.brickwise-immo.de). Vercel konfirmoi deployment-in `dpl_BEXiXxwfmBBCWSPYt6RmFbcxRTwh`, status `Ready`, target `production`, të lidhur me domenin publik. Dhjetë gjetjet e tjera të auditit mbeten të hapura.

**Blerja nga balanca ruan identitetin e kërkesës**

Formulari i vjetër në dashboard tani merr një UUID nga serveri dhe e ruan gjatë dërgimit, rifreskimeve të komponentit dhe riprovimit. Ai bllokon dërgimet e njëpasnjëshme menjëherë dhe çaktivizon kontrollet gjatë përpunimit. Server Action refuzon blerjen nga balanca nëse mungon identifikuesi; nuk krijon më një identifikues të ri për çdo thirrje. Kontrolli ekzistues në server/databazë njeh blerjen e përfunduar dhe nuk debiton përsëri.

Edhe kalkulatori në faqen e pronës tani ruan identifikuesin fillestar kur merr props të rifreskuara. Formularët e pagesave bankare/crypto dhe tekstet në pesë gjuhë mbeten funksionale.

Burime: [SharePurchaseForm](../app/dashboard/SharePurchaseForm.tsx), [formulari në dashboard](../app/dashboard/PropertyInvestmentCard.tsx), [Server Action](../app/dashboard/actions.ts), [kalkulatori](../app/properties/[slug]/InvestmentCalculator.tsx).

**Administratori nuk mund të mbishkruajë një blerje me formular të vjetruar**

Rreshti i disponibilitetit ka `availability_version`. Blerjet dhe ndryshimet e sasive e rrisin automatikisht këtë version. Formulari i adminit dërgon versionin që pa kur u hap. Operacioni i ri `update_share_settings_atomic` bllokon të njëjtin rresht që përdor blerja, kontrollon versionin dhe refuzon ruajtjen nëse ndërkohë sasitë kanë ndryshuar.

Pas refuzimit, faqja shfaq sasitë aktuale dhe një njoftim të përkthyer për rishikim. Operacioni nuk riprovon automatikisht vlerat e vjetra. Ai kontrollon gjithashtu që sasia e zënë të mbulojë aksionet e klientëve dhe rezervimin fillestar të pronës. Një ulje e qëllimshme e rezervimeve manuale lejohet vetëm me formular aktual dhe brenda këtij kufiri.

Trigger-i i databazës bllokon uljet përmes shtegut të vjetër të përgjithshëm, kështu që një formular i hapur përpara deployment-it nuk e anashkalon mbrojtjen. Ndryshimi i sasive dhe regjistrimi i auditit kryhen në një transaksion; dështimi i auditit e kthen ndryshimin. Cilësimet e fitimit ruhen dhe ndryshimi vetëm i tyre nuk shkakton konflikt sasish.

Burime: [migrimi SQL](../SUPABASE_SHARE_AVAILABILITY_GUARD.sql), [veprimi i adminit](../app/admin/properties/actions.ts), [formulari i adminit](../app/admin/properties/page.tsx), [mesazhet në pesë gjuhë](../app/lib/admin-copy.ts).

Migrimi `016_share_availability_guard` u testua dy herë brenda transaksionit të kthyer, u aplikua dhe u verifikua përsëri. Krahasimet konfirmuan se balancat, zotërimet, rezervimet ekzistuese, porositë dhe historia e auditit nuk u ndryshuan nga migrimi. Shtesa e skemës është kolona e versionit dhe funksionet/trigger-i mbrojtës.

| Kontrolli | Rezultati |
|---|---|
| Të gjitha testet e aplikacionit | 132/132 kaluan |
| Build lokal dhe Vercel | Kaluan përpilimi dhe TypeScript |
| ESLint | Kaloi |
| Formulari dashboard në Chrome | 6 grupe kaluan: dërgim i shpejtë i përsëritur, gjendja pending, UUID gjatë rifreskimit/riprovimit, metodat dhe gjuhët |
| Kalkulatori i pronës në Chrome | 12 grupe kaluan, përfshirë ruajtjen e UUID-së gjatë rifreskimit |
| Admini | 19 teste të veprimit/lokalizimit; 25 paraqitje mesazhesh në pesë gjuhë |
| Databaza | Formular i vjetruar, shteg i vjetër, kufijtë e zotërimeve/rezervimit fillestar, krijim konkurrues, dy renditjet blerje/admin dhe dështimi i auditit kaluan |
| Regresioni financiar SQL | Kreditim, blerje, balance/holdings/stok, riprovim, mungesë fondesh dhe audit atomik kaluan në skemën e aplikuar |
| PostgREST | RPC-ja e re është e disponueshme; anon refuzohet dhe thirrja service pa administrator të vlefshëm refuzohet përpara çdo shkrimi |
| Production | Deployment-i i ri `Ready`; 8 rrugë dhe 12 burime JavaScript të verifikuara; italishtja në faqen publike dhe mbrojtja e rrugëve private kaluan |

Testet e shfletuesit përdorën veprim blerjeje të simuluar. Testet SQL përdorën llogari/prona sintetike dhe `ROLLBACK`, me krahasime para/pas. Nuk u krye blerje ose ndryshim balance për klient real. Testet SQL provuan të dy renditjet e veprimeve; koordinimi i kërkesave paralele mbështetet te bllokimi i përbashkët i rreshtit, i rishikuar në kod, pa test ngarkese me klientë realë.

Provat ruhen te [security-fixes-01-02-2026-10-02](../project-backups/security-fixes-01-02-2026-10-02/): [gjendja finale](../project-backups/security-fixes-01-02-2026-10-02/status.json), [migrimi i verifikuar](../project-backups/security-fixes-01-02-2026-10-02/migration/verified.json), [dashboard-i](../project-backups/security-fixes-01-02-2026-10-02/dashboard-browser/report.json), [kalkulatori](../project-backups/security-fixes-01-02-2026-10-02/property-browser/results.json), [production](../project-backups/security-fixes-01-02-2026-10-02/production-verification.json) dhe [kontrata RPC](../project-backups/security-fixes-01-02-2026-10-02/rpc-contract.json).

Për verifikim të ardhshëm të skemës së instaluar përdoret `node scripts/migrate-share-availability.mjs verify`. Komanda `npm run test:security:share-availability` provon edhe riekzekutimin e migrimit, gjithmonë me kthim të transaksionit; nuk aplikon migrim të përhershëm.
