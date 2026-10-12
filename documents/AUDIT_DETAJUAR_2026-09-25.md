**Audit i detajuar i Brickwise — 25 shtator 2026**


Update 2026-09-27: finding 2 dependency remediation: Next.js/eslint-config-next 16.3.6, PostCSS 8.5.28, refreshed compatible transitive dependencies. Full and production npm audit report zero known vulnerabilities. See SECURITY_FIX_02_2026-09-27.md for validation and deployment status.

Current scope notes: finding 3 is now corrected for the older creditCustomerWallet action as well as the deposit flow; see SECURITY_FIX_03_2026-09-27.md. Newsletter form was removed during the footer redesign (finding 9); footer contrast and sign-in labels were corrected (partial finding 11). Homepage/catalogue images were optimized (partial finding 12); property galleries remain separate work. EUR migration resolved the prior CAD/EUR restriction. These changes do not close unrelated findings.

Përditësim më 27 shtator 2026: **gjetja 1 u korrigjua dhe u verifikua live**. Hollësitë dhe provat janë te [raporti i korrigjimit 1](C:/Users/User/Downloads/brickwiseimmobilien-main/brickwiseimmobilien-main/documents/SECURITY_FIX_01_2026-09-27.md). Teksti më poshtë ruan gjendjen e auditimit fillestar; gjetjet e tjera mbeten për t'u trajtuar.

U auditua projekti në `Downloads/brickwiseimmobilien-main/brickwiseimmobilien-main`, faqja https://www.brickwise-immo.de dhe katalogu i sigurisë/strukturës së databazës Supabase që përdor faqja live. Adresa publike Supabase e konfigurimit lokal u përputh me kodin JavaScript publik të faqes. Skedari .env i hapur në IDE në Desktop i përket një dosjeje tjetër dhe nuk ishte objekt i këtij auditimi.

Update 2026-09-27: finding 4 corrected for the maintained historical wallet migrations; versioned registry and rollback replay tests are documented in SECURITY_FIX_04_2026-09-27.md.

Update 2026-09-27: finding 5 corrected with a dedicated full-refund operation and ledger reconciliation; see SECURITY_FIX_05_2026-09-27.md.

**Vlerësimi:** projekti ndërtohet dhe kontrollet ekzistuese kalojnë, por ka probleme me përparësi të lartë në autorizimin e databazës, varësitë dhe integritetin e wallet-it. Kalimi i testeve nuk mjafton për ta konsideruar të verifikuar rrjedhën e plotë të pagesës/investimit.

Auditimi nuk ndryshoi kodin e aplikacionit, politikat SQL, llogaritë, pagesat apo të dhënat e klientëve. U shtua vetëm ky raport lokal dhe u krijuan artefakte kontrolli brenda .next. Nuk u krye publikim i ri. Nuk u dërguan email-e, nuk u krijuan klientë dhe nuk u kryen pagesa provë në prodhim.

| Kontrolli i ekzekutuar | Rezultati |
|---|---|
| `npm run lint` | Kaloi: 0 gabime, 0 paralajmërime |
| `npm run build` | Kaluan përpilimi, TypeScript dhe gjenerimi i faqeve |
| `npm run test:financial` | 33/33 teste |
| `npm run test:localization` | 20/20 teste |
| Audit financiar HTTP në faqen live | Kaloi për 7 prona, EUR, formulat vjetore/mujore dhe faqet publike përkatëse |
| Audit lokalizimi HTTP, lokalisht dhe live | Secili kaloi 170 kontrolle faqesh, 35 hartash, 30 hyrjeje, 17 API dhe 5 ndërrime gjuhësh |
| `npm audit` | 29 paketa të raportuara: 1 critical, 25 high, 2 moderate, 1 low |
| `npm audit --omit=dev` | 5 paketa: 1 critical, 3 high, 1 moderate |
| Katalogu real Supabase | U lexuan politikat, lejet, constraints dhe triggers; pa lexuar rreshtat e klientëve |
| Headers live | CSP, HSTS, nosniff dhe mbrojtja kundër iframe janë aktive |
| `/robots.txt`, `/sitemap.xml` live | Të dyja 404 |
| Gjendja Git | `.git` bosh; `git status` nuk e njeh dosjen si repository |

Numrat e npm audit numërojnë paketa të shënuara dhe mund të përfshijnë varësi indirekte; nuk janë numër sulmesh apo provë komprometimi. Testet financiare kontrollojnë saktësinë e modelit të konfiguruar, jo vërtetësinë ekonomike të kthimeve të reklamuara.

P1 = trajtim me përparësi të lartë; P2 = defekt i rëndësishëm; P3 = përmirësim. Kushtet e aktivizimit përshkruhen veçmas.

1. **P1 — Databaza live lejon krijimin publik të kërkesave pa kufizimin e synuar.**

   Në `property_requests` ekziston ende politika `Anyone can create property requests`, për rolet `anon` dhe `authenticated`, me `WITH CHECK (true)`. U konfirmua edhe leja reale INSERT për anon dhe aktivizimi i RLS. Politika më e re që kërkon `user_id IS NULL OR auth.uid() = user_id` bashkëjeton me të; politika lejuese e vjetër e bën kufizimin e ri joefektiv.

   Një klient i drejtpërdrejtë i Supabase mund të anashkalojë validimet e formularit dhe të dërgojë status, mesazh dhe lidhje përdoruesi të pakontrolluara nga ajo politikë, brenda kufijve të skemës/FK. Nuk ka constraint për statusin në këtë tabelë. Kjo nuk provon lexim publik të kërkesave: problemi i konfirmuar është integriteti i shkrimeve.

   Ekzistojnë edhe politika të vjetra SELECT/UPDATE që japin akses administratori mbi bazën e një email-i fiks. Aplikacioni kontrollon `app_metadata.role`; databaza dhe aplikacioni kanë kështu dy burime të ndryshme autorizimi. Heqja e rolit në aplikacion nuk i heq domosdoshmërisht privilegjet e asaj politike.

   Burimi lokal që nuk pastron politikat e vjetra: [SUPABASE_PROPERTY_REQUESTS_RLS.sql:28](C:/Users/User/Downloads/brickwiseimmobilien-main/brickwiseimmobilien-main/SUPABASE_PROPERTY_REQUESTS_RLS.sql:28). Kontrolli i rolit: [app/lib/admin.ts:1](C:/Users/User/Downloads/brickwiseimmobilien-main/brickwiseimmobilien-main/app/lib/admin.ts:1). Prova kryesore është katalogu live, jo vetëm ky skedar.

   **Ndreqja:** migrim i kontrolluar që heq politikat e vjetra lejuese; status fillestar i kufizuar dhe identitet i validuar në databazë; autorizim administratori i njëjtë në aplikacion dhe RLS. Teste negative si anon dhe klient i autentifikuar, në mjedis provë. Kontrolli vetëm në UI nuk e zgjidh.

2. **P1 — Next.js dhe disa varësi janë në versione me njoftime sigurie.**

   Versionet e instaluara përfshijnë Next.js 16.2.6, sharp 0.34.5 dhe PostCSS 8.5.14. Ky i fundit është fiksuar edhe me override. Burimi: [package.json:19](C:/Users/User/Downloads/brickwiseimmobilien-main/brickwiseimmobilien-main/package.json:19) dhe [package.json:34](C:/Users/User/Downloads/brickwiseimmobilien-main/brickwiseimmobilien-main/package.json:34).

   Njoftimi zyrtar për bllokim shërbimi në App Router me Server Actions përfshin versionin 16.2.6; projekti përdor të dyja. Rregullimi për atë njoftim është 16.2.11. [Njoftimi zyrtar Next.js](https://github.com/vercel/next.js/security/advisories/GHSA-m99w-x7hq-7vfj).

   Dy njoftime kritike të tjera përfshijnë versionet para 16.3.3: ekzekutim kodi në serverë Windows dhe në përpunimin e AVIF. I pari lidhet me hostim Windows dhe nuk provohet si i zbatueshëm mbi prodhimin Vercel; i dyti kërkon rrugën përkatëse të përpunimit të imazheve. Auditimi nuk provoi sulme dhe nuk konstatoi komprometim. [Njoftimi Windows](https://github.com/vercel/next.js/security/advisories/GHSA-p293-qw3h-jr36), [njoftimi AVIF](https://github.com/vercel/next.js/security/advisories/GHSA-2xp9-vwfh-vxw4).

   **Ndreqja:** përditësim i koordinuar i Next.js/eslint-config-next në version të mbështetur që përmban këto rregullime, të paktën 16.3.3 për njoftimet e cituara; rishikim i override PostCSS dhe varësive të prekura; pastaj build, teste dhe audit i ri. Nuk u ekzekutua `npm audit fix --force`.

3. **P1 — Përsëritja e të njëjtit kreditim mund të shtojë para dy herë.**

   [app/admin/payments/actions.ts:73](C:/Users/User/Downloads/brickwiseimmobilien-main/brickwiseimmobilien-main/app/admin/payments/actions.ts:73) krijon një UUID të ri brenda çdo ekzekutimi të kreditimit. Dy dërgime të të njëjtit formular marrin identifikues të ndryshëm; kufizimi unik në SQL nuk i njeh si të njëjtin operacion.

   Funksioni real u provua me autentifikim dhe databazë të simuluar: i njëjti FormData me shumën 100, i thirrur dy herë, prodhoi dy RPC me shuma 100 dhe identifikues të ndryshëm. Nuk u kreditua llogari reale.

   **Ndreqja:** identifikues i qëndrueshëm i operacionit/pagesës, i krijuar para dërgimit dhe i ripërdorur gjatë riprovimeve; RPC që njeh dublikatën dhe kthen rezultatin ekzistues. Çaktivizimi i butonit gjatë dërgimit ndihmon, por nuk zëvendëson kontrollin në server/databazë.

4. **P1, nëse riekzekutohet migrimi — Skripti mund të dyfishojë kredi dhe kuota historike.**

   RPC e kreditimit regjistron transaksionin dhe krijon një payment request me titull `[Wallet credit]...`. Seksioni i migrimit importon të njëjtën pagesë me identifikues tjetër `legacy-credit:...`. Unikësia mbi idempotency_key nuk e ndalon sepse identifikuesit ndryshojnë.

   Shembull logjik: kreditim CAD 100 → ledger 100 → riekzekutim i seksionit të importit → ledger 200. Importi i blerjeve mund të numërojë sërish kuota të regjistruara më parë. Burimet: [SUPABASE_WALLET_LEDGER.sql:76](C:/Users/User/Downloads/brickwiseimmobilien-main/brickwiseimmobilien-main/SUPABASE_WALLET_LEDGER.sql:76), [SUPABASE_WALLET_LEDGER.sql:153](C:/Users/User/Downloads/brickwiseimmobilien-main/brickwiseimmobilien-main/SUPABASE_WALLET_LEDGER.sql:153), [SUPABASE_WALLET_LEDGER.sql:178](C:/Users/User/Downloads/brickwiseimmobilien-main/brickwiseimmobilien-main/SUPABASE_WALLET_LEDGER.sql:178).

   Skripti shënohet si migrim vetëm një herë. Nuk ka provë që është riekzekutuar ose që bilancet reale janë dëmtuar.

   **Ndreqja:** migrime të versionuara, kufi historik i qartë dhe referencë burimi unike që lidh pagesën/kërkesën me transaksionin. Prova e riekzekutimit duhet bërë mbi kopje provë, me verifikim që bilancet/kuotat nuk ndryshojnë.

5. **P2 — Vendosja e statusit “refunded” nuk rakordon wallet-in.**

   [app/admin/payments/actions.ts:174](C:/Users/User/Downloads/brickwiseimmobilien-main/brickwiseimmobilien-main/app/admin/payments/actions.ts:174) ndryshon vetëm statusin dhe fushat shoqëruese të payment request. Nuk krijon kundërtransaksion dhe nuk ul bilancin e wallet-it. Katalogu live tregoi vetëm trigger-in e `updated_at` mbi payment_requests, jo një trigger rakordimi.

   Nëse kreditimi CAD 100 shënohet refunded, wallet-i vazhdon të tregojë CAD 100. Edhe nëse rimbursimi kryhet jashtë sistemit, këto dy regjistra mbeten të papërputhur. Blerja e pronave aktuale EUR nga wallet-i CAD është e çaktivizuar me qëllim.

   **Ndreqja:** veprim i veçantë dhe atomik rimbursimi, me referencën e transaksionit origjinal, kontroll bilanci, idempotencë dhe regjistër të pandryshueshëm. Mos e përdor statusin si zëvendësues të lëvizjes monetare.

6. **P2 — Shënimet e brendshme të pagesës janë të lexueshme nga klienti për pagesat e veta.**

   `admin_note`, `created_by` dhe `verified_by` ndodhen në të njëjtën tabelë me informacionin publik të pagesës. Politika RLS kufizon rreshtat, jo kolonat. Në databazën live u konfirmua SELECT mbi tabelën për rolin authenticated. Fshehja e kolonës në dashboard nuk pengon kërkesën direkte ndaj Supabase.

   Burimet: [SUPABASE_PAYMENT_REQUESTS_SETUP.sql:18](C:/Users/User/Downloads/brickwiseimmobilien-main/brickwiseimmobilien-main/SUPABASE_PAYMENT_REQUESTS_SETUP.sql:18), [SUPABASE_PAYMENT_REQUESTS_SETUP.sql:60](C:/Users/User/Downloads/brickwiseimmobilien-main/brickwiseimmobilien-main/SUPABASE_PAYMENT_REQUESTS_SETUP.sql:60). Nuk u lexuan shënime apo pagesa klientësh.

   **Ndreqja:** tabelë e veçantë për shënimet administrative, ose privilegje kolonash/API që ekspozon vetëm fushat e lejuara. Kjo duhet shoqëruar me heqjen e aksesit të drejtpërdrejtë që do ta anashkalonte kufizimin.

7. **P2 — Ruajtja e profilit mund të fshijë të dhëna të mëparshme.**

   Formulari nis datëlindjen, gjininë, telefonin dhe shtetin bosh, sepse merr vetëm emrin/email-in. Gjatë save i shkruan të katër fushat në user_metadata edhe kur janë bosh. Rihapja e profilit, ndryshimi vetëm i emrit dhe ruajtja mund të pastrojnë fushat e tjera.

   Burimi: [app/components/ClientPortalSidebar.tsx:235](C:/Users/User/Downloads/brickwiseimmobilien-main/brickwiseimmobilien-main/app/components/ClientPortalSidebar.tsx:235) dhe [app/components/ClientPortalSidebar.tsx:260](C:/Users/User/Downloads/brickwiseimmobilien-main/brickwiseimmobilien-main/app/components/ClientPortalSidebar.tsx:260).

   **Ndreqja:** ngarkim i vlerave ekzistuese dhe ruajtje vetëm e fushave të ndryshuara; test regresioni me profil paraprakisht të plotësuar.

8. **P2 — SEO e faqeve të veçanta drejtohet gabimisht te homepage.**

   Root layout vendos canonical `/`, titull dhe URL Open Graph të përgjithshme. Faqet publike të kontrolluara trashëgojnë të njëjtin canonical dhe titull. Kjo u verifikua në përgjigjet HTML; `/properties` live tregon homepage si canonical.

   Alternativat gjuhësore përdorin `?lang=`, por proxy e heq parametrin me redirect dhe ruan gjuhën në cookie. Kështu mungojnë adresa të qëndrueshme për indeksimin e secilës gjuhë. `/robots.txt` dhe `/sitemap.xml` kthejnë 404 live; kjo nuk nënkupton automatikisht që faqja nuk indeksohet.

   Burimet: [app/layout.tsx:41](C:/Users/User/Downloads/brickwiseimmobilien-main/brickwiseimmobilien-main/app/layout.tsx:41), [proxy.ts:32](C:/Users/User/Downloads/brickwiseimmobilien-main/brickwiseimmobilien-main/proxy.ts:32).

   **Ndreqja:** metadata dhe canonical specifik për çdo pronë/artikull/faqe; URL të qëndrueshme për gjuhët me hreflang përkatës; sitemap dhe rregulla të përshtatshme indeksimi për faqet private/teknike.

9. **P2 — Newsletter nuk krijon abonim dhe email-i futet në URL.**

   [app/components/Footer.tsx:68](C:/Users/User/Downloads/brickwiseimmobilien-main/brickwiseimmobilien-main/app/components/Footer.tsx:68) dërgon formularin te `/contact` me GET. Rezultati është `/contact?email=...&consent=on`. Faqja contact nuk i përdor këto vlera; kontrolli me adresë sintetike konfirmoi se fusha email mbetet bosh.

   Kur marketingu është pranuar, [app/components/MetaPixelConsent.tsx:74](C:/Users/User/Downloads/brickwiseimmobilien-main/brickwiseimmobilien-main/app/components/MetaPixelConsent.tsx:74) kalon `window.location.href` si page_location te Google, duke përfshirë parametrat. Kështu rruga e formularit fut të dhëna personale në URL dhe në argumentin e konfigurimit të analytics. Nuk u kap trafik real matjeje.

   **Ndreqja:** endpoint POST real për abonimin, validim dhe rezultat i qartë; heqje e të dhënave personale nga URL-të dhe parametrat që dërgohen te analytics.

10. **P2 — Google Ads ngarkohet para pranimit, ndryshe nga përshkrimi i privatësisë.**

    [app/layout.tsx:107](C:/Users/User/Downloads/brickwiseimmobilien-main/brickwiseimmobilien-main/app/layout.tsx:107) ngarkon dhe konfiguron Google Ads pa kusht. Gjendja fillestare e consent është denied, gjë që është mbrojtje reale për kategoritë e deklaruara, por nuk e ndalon ngarkimin e tag-ut. [app/privacy/page.tsx:177](C:/Users/User/Downloads/brickwiseimmobilien-main/brickwiseimmobilien-main/app/privacy/page.tsx:177) thotë se shërbimi mbetet i çaktivizuar deri në pranim.

    Google dokumenton dallimin midis basic mode dhe advanced mode: në të dytin tag-et mund të ngarkohen dhe të dërgojnë matje pa cookies edhe me consent denied. [Dokumentacioni zyrtar](https://developers.google.com/tag-platform/security/concepts/consent-mode).

    **Ndreqja:** për sjelljen që përshkruan teksti aktual, tag-u duhet ngarkuar pas pranimit. Sjellja e implementimit dhe teksti duhen përputhur. Kjo gjetje është mospërputhje teknike; nuk është vendim juridik për GDPR.

11. **P2 — Formularët dhe dialogët kanë probleme aksesueshmërie.**

    Disa labels janë elemente motra të inputs pa lidhje htmlFor/id. Shembuj: [app/contact/page.tsx:453](C:/Users/User/Downloads/brickwiseimmobilien-main/brickwiseimmobilien-main/app/contact/page.tsx:453), [app/sign-in/SignInForm.tsx:35](C:/Users/User/Downloads/brickwiseimmobilien-main/brickwiseimmobilien-main/app/sign-in/SignInForm.tsx:35), [app/join/JoinForm.tsx:68](C:/Users/User/Downloads/brickwiseimmobilien-main/brickwiseimmobilien-main/app/join/JoinForm.tsx:68). Kjo e vështirëson përdorimin me lexues ekrani dhe klikimin e label-it për fokus.

    Dialogu i kontaktit deklaron `aria-modal`, por nuk menaxhon hyrjen/kthimin e fokusit, lëvizjen e tij brenda dialogut ose Escape. Nuk ka kufi lartësie/scroll për viewport të vogël. Burimi: [app/components/FloatingLeadForm.tsx:40](C:/Users/User/Downloads/brickwiseimmobilien-main/brickwiseimmobilien-main/app/components/FloatingLeadForm.tsx:40).

    Nga ngjyrat e kodit, kontrasti white mbi footer `#79b2d3` është rreth 2.30:1; teksti i disclaimer mbi të është rreth 2.96:1. Burimi: [app/components/Footer.tsx:44](C:/Users/User/Downloads/brickwiseimmobilien-main/brickwiseimmobilien-main/app/components/Footer.tsx:44). Këto janë llogaritje ngjyrash, jo audit vizual i plotë.

    **Ndreqja:** labels të lidhura, dialog i ripërdorshëm me menaxhim fokusi/scroll dhe kontrast më i mirë. Verifikim real me tastierë, lexues ekrani dhe ekran celular.

12. **P2 — Imazhet publike janë të rënda dhe mungon shërbimi sipas madhësisë së ekranit.**

    Hero përdor si CSS background një JPEG prej 1,943,718 bytes. Një imazh i pronës është 5,031,350 bytes; galeria Sal Rei përfshin 18 origjinale me total rreth 4.99 MB. Miniaturat përdorin origjinalet. Burimet: [app/page.tsx:296](C:/Users/User/Downloads/brickwiseimmobilien-main/brickwiseimmobilien-main/app/page.tsx:296), [app/page.tsx:322](C:/Users/User/Downloads/brickwiseimmobilien-main/brickwiseimmobilien-main/app/page.tsx:322), [app/properties/[slug]/PropertyGallery.tsx:70](C:/Users/User/Downloads/brickwiseimmobilien-main/brickwiseimmobilien-main/app/properties/[slug]/PropertyGallery.tsx:70).

    Përdorimi i cookies/autentifikimit në root layout i bën faqet dinamike; build-i e konfirmoi. Homepage dhe katalogu live përgjigjen `private, no-cache, no-store`. Kjo është zgjedhje arkitekture me kosto performance, jo arsye për të cache-uar përgjigje private.

    **Ndreqja:** formate dhe dimensione të optimizuara, variante responsive dhe miniatura të vogla; lazy loading ku duhet. Rishikim i ndarjes së përmbajtjes publike nga personalizimi, duke ruajtur izolimin e sesioneve. Nuk u mat Lighthouse/LCP dhe nuk po jepet rezultat i sajuar performance.

13. **P2 — Përputhja sipas email-it mund t'i japë akses një llogarie tjetër.**

    Politikat e pagesave dhe kërkesave përdorin `user_id = auth.uid() OR email = email-i i sesionit`, edhe kur rreshti tashmë ka një user_id tjetër. Nëse një klient ndryshon adresën dhe adresa e mëparshme regjistrohet më vonë nga dikush tjetër, llogaria e re mund të përputhet me regjistrat historikë. E njëjta paqartësi krijohet kur një rresht ka user_id të saktë, por email të gabuar.

    Burimet: [SUPABASE_PAYMENT_REQUESTS_SETUP.sql:65](C:/Users/User/Downloads/brickwiseimmobilien-main/brickwiseimmobilien-main/SUPABASE_PAYMENT_REQUESTS_SETUP.sql:65), [SUPABASE_PROPERTY_REQUESTS_RLS.sql:21](C:/Users/User/Downloads/brickwiseimmobilien-main/brickwiseimmobilien-main/SUPABASE_PROPERTY_REQUESTS_RLS.sql:21). Logjika u konfirmua në politikat live; nuk u konstatua incident dhe nuk u provua me llogari reale.

    **Ndreqja:** user_id të jetë burimi vendimtar për rreshtat e lidhur. Përputhja me email të lejohet vetëm për regjistra ende të palidhur, përmes një procesi të kontrolluar verifikimi/lidhjeje.

14. **P2 — Veprimet administrative dhe regjistri i auditimit nuk ruhen atomikisht.**

    Kreditimi kryhet para regjistrimit të veprimit administrativ. Nëse shkrimi i audit log dështon, funksioni vetëm shkruan gabimin në console dhe operacioni monetar mbetet i përfunduar. Endpoint-i i importit të pronave gjithashtu nuk thërret regjistrimin e auditimit.

    Burimet: [app/lib/admin-audit.ts:26](C:/Users/User/Downloads/brickwiseimmobilien-main/brickwiseimmobilien-main/app/lib/admin-audit.ts:26), [app/admin/payments/actions.ts:66](C:/Users/User/Downloads/brickwiseimmobilien-main/brickwiseimmobilien-main/app/admin/payments/actions.ts:66), [app/api/properties/import/route.ts](C:/Users/User/Downloads/brickwiseimmobilien-main/brickwiseimmobilien-main/app/api/properties/import/route.ts).

    Ledger-i i wallet-it vazhdon të mbajë transaksionin; gjetja lidhet me plotësinë e regjistrit të administratorit. **Ndreqja:** regjistrim i ngjarjes brenda të njëjtit transaksion të databazës me mutacionin dhe mbulim i importit.

**Dy rrjedha biznesi që kërkojnë sqarim dhe plotësim**

- **Investimi EUR pas verifikimit të pagesës:** aplikacioni ruan kërkesën dhe statusin e pagesës, por nuk ka rrjedhë të dokumentuar që cakton kuotat EUR në holdings. Constraint real i `property_holdings.currency` lejon vetëm CAD, ndërsa katalogu aktual është EUR. Burimet: [app/dashboard/actions.ts:129](C:/Users/User/Downloads/brickwiseimmobilien-main/brickwiseimmobilien-main/app/dashboard/actions.ts:129), [app/admin/payments/actions.ts:174](C:/Users/User/Downloads/brickwiseimmobilien-main/brickwiseimmobilien-main/app/admin/payments/actions.ts:174), [SUPABASE_WALLET_LEDGER.sql:26](C:/Users/User/Downloads/brickwiseimmobilien-main/brickwiseimmobilien-main/SUPABASE_WALLET_LEDGER.sql:26). Duhet verifikuar nëse ekziston proces i jashtëm manual; nuk pretendohet që pagesat reale janë humbur. Nëse platforma synon përfundim automatik të investimit, duhet regjistrim atomik i pagesës, kuotave, rezervimit dhe monedhës.
- **Aktivizimi/pezullimi i fitimeve:** paneli thotë se data/statusi kontrollojnë akumulimin, por në kod nuk u gjet proces që i përdor për kreditim real. Burimi: [app/admin/profits/page.tsx:61](C:/Users/User/Downloads/brickwiseimmobilien-main/brickwiseimmobilien-main/app/admin/profits/page.tsx:61). Mund të ketë proces të jashtëm të paverifikuar. Objektivat e modeluara vjetore/mujore janë të dalluara siç duhet nga cash-i; problemi është premtimi i funksionit operacional pa rrjedhë të dokumentuar.

**Forcime dhe mangësi të tjera**

- Hyrja e administratorit kontrollon fjalëkalimin dhe rolin, por nuk kërkon nivel MFA/AAL2 në kod: [app/admin/sign-in-actions.ts:21](C:/Users/User/Downloads/brickwiseimmobilien-main/brickwiseimmobilien-main/app/admin/sign-in-actions.ts:21). Ky është forcim sigurie, jo provë bypass-i.
- Kërkimi në insights nuk ka handler/filtrim; lidhja `/#numbers` nuk ka seksion përkatës. Burimet: [app/insights/page.tsx:28](C:/Users/User/Downloads/brickwiseimmobilien-main/brickwiseimmobilien-main/app/insights/page.tsx:28), [app/components/Footer.tsx:22](C:/Users/User/Downloads/brickwiseimmobilien-main/brickwiseimmobilien-main/app/components/Footer.tsx:22).
- Kopja lokale nuk ka histori funksionale Git. Kjo kufizon krahasimin me një commit të caktuar dhe kontrollin e ndryshimeve. Nuk provohet që mungon repository në shërbime të tjera.
- Nuk u gjet rrjedhë e plotë testimi për pagesa/rimbursime, RLS reale me role të ndryshme dhe migrime SQL. Testet ekzistuese mbulojnë mirë formulat dhe lokalizimin, por nuk i zëvendësojnë këto prova.
- Identiteti/adresa e kompanisë shënohen pjesërisht si të dhëna të dhëna nga pronari në [app/lib/company.ts:1](C:/Users/User/Downloads/brickwiseimmobilien-main/brickwiseimmobilien-main/app/lib/company.ts:1). Pronësia e pasurive, vlefshmëria e kontratave, licencat, detyrimet juridike dhe realizueshmëria e kthimeve nuk u certifikuan nga ky audit teknik.

**Çfarë është verifikuar pozitivisht**

Formulat e shtatë pronave janë të qëndrueshme me modelin e konfiguruar; minimumi EUR 2,000 dhe kuotat e plota kontrollohen në server; shumat historike ruhajnë monedhën e tyre; wallet-i CAD nuk debitohet gabimisht për blerje EUR. Funksionet monetare SQL janë të ndaluara për anon/authenticated dhe lejohen për service_role, siç u konfirmua live. RLS e wallet-it/holdings kufizon leximin te pronari dhe trigger-i i pandryshueshmërisë së transaksioneve është aktiv. Kontrollet administrative në aplikacion përdorin rolin në app_metadata, jo një rol të ndryshueshëm nga klienti. Pesë gjuhët kaluan kontrollet e përcaktuara; Meta Pixel inicializohet pas pranimit.

**Renditja e rekomanduar e punës**

1. Politikat live RLS dhe përditësimi i varësive të cenueshme.
2. Identifikuesit e kreditimeve, migrimi, rakordimi i rimbursimeve dhe privatësia e shënimeve.
3. Përcaktimi/verifikimi i procesit EUR nga pagesa te kuotat dhe i fitimeve reale.
4. Ruajtja e profilit, newsletter dhe përputhja e consent/analytics.
5. SEO, imazhet, aksesueshmëria dhe testet e rrjedhave të plota.

Pas ndreqjeve duhen prova në mjedis testimi, publikim në projektin ekzistues Vercel dhe verifikim live. Në këtë audit u prodhua raporti; problemet e listuara nuk janë ndrequr.

**Kufijtë e provës:** nuk u krye sulm shterues, test ngarkese, pagesë reale, hyrje me llogari klienti/administratori, provë vizuale browser/axe/Lighthouse ose kontroll i plotë i proceseve të jashtme. Politikat/skema live u verifikuan me query vetëm leximi; skenarët e rrezikshëm nuk u ekzekutuan mbi të dhënat reale.
