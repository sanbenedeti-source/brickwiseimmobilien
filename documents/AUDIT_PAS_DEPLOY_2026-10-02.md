**Audit i thelluar pas publikimit — Brickwise, 2 tetor 2026**

Përditësim më 2 tetor 2026: **gjetjet 1 dhe 2 u korrigjuan, u testuan dhe u publikuan në production**. [Raporti i korrigjimit dhe provat](./SECURITY_FIXES_01_02_2026-10-02.md). Mbeten të hapura 10 gjetje: 7 P2 dhe 3 P3. Përshkrimet më poshtë dokumentojnë gjendjen e auditit fillestar.

U identifikuan **12 gjetje: 2 me përparësi të lartë (P1), 7 të mesme (P2) dhe 3 të ulëta (P3)**. Dy problemet që duhen trajtuar të parat janë përsëritja e blerjes nga formulari i vjetër i dashboard-it dhe mbishkrimi i aksioneve të shitura nga një formular administratori i hapur më herët. Testet ekzistuese kalojnë, por nuk i mbulojnë këto dy skenarë.

Nëntë kontrollet financiare të të dhënave aktuale nuk gjetën mospërputhje. Kjo nuk përjashton një blerje të dyfishtë të padëshiruar: dy blerje mund të kenë secila regjistrim financiar të saktë. Nuk u konstatua komprometim në kontrollet e kryera; ky audit nuk është provë që çdo rrezik është përjashtuar.

U kontrolluan kodi në këtë workspace, databaza Supabase e projektit dhe [faqja në production](https://www.brickwise-immo.de). Vercel konfirmoi deployment-in `dpl_GwPox3bSVsvpwaBejTX4iqHRFR6A`, status **Ready**, target **production**, të lidhur me domenin publik. Dosja tjetër e hapur në Desktop nuk ishte burimi i këtij auditimi.

Ky audit shtoi vetëm raportin dhe artefaktet e kontrollit. Nuk u korrigjua kodi i aplikacionit dhe nuk u bë deployment i ri. Testet SQL përdorën të dhëna provë në transaksione të kthyera me `ROLLBACK`; krahasimet para/pas konfirmuan ruajtjen e të dhënave ekzistuese. Nuk u kryen blerje, kreditime, nënshkrime, regjistrime ose dërgime email-esh për klientë realë.

| Përparësia | Gjetjet | Çfarë kërkojnë |
|---|---:|---|
| P1 — e lartë | 2 | Korrigjim i rrjedhës financiare para zgjerimit të përdorimit |
| P2 — e mesme | 7 | Korrigjime në hyrje, administrim, mbrojtje nga abuzimi dhe aksesueshmëri |
| P3 — e ulët | 3 | Validim kërkesash, etiketa formularësh dhe mirëmbajtje kontrollesh |

**1. P1 — Formulari i vjetër i dashboard-it mund ta debitojë blerjen dy herë**

Formulari në `/dashboard/marketplace` nuk dërgon `purchase_request_id` dhe nuk bllokon dërgimin gjatë përpunimit. Server Action lejon mungesën e identifikuesit dhe krijon një UUID të ri për çdo thirrje. Databaza i njeh dy dërgimet si dy blerje të ndryshme.

Riprodhimi përdori Server Action real me autentifikim/databazë të simuluar: nga balanca **€6,000**, i njëjti formular për **€2,000** u dërgua dy herë dhe la **€2,000**, me dy debitime. Kontrolli krahasues me identifikuesin e qëndrueshëm të formularit të ri “Buy now” la **€4,000**, me një debit. Kushti është që balanca dhe aksionet të mjaftojnë për të dyja blerjet. Nuk u provua bilanc negativ ose shpenzim nga llogaria e një klienti tjetër.

Burime: [formulari i vjetër:84](C:/Users/User/Downloads/brickwiseimmobilien-main/brickwiseimmobilien-main/app/dashboard/PropertyInvestmentCard.tsx:84), [identifikuesi i ri në çdo thirrje:68](C:/Users/User/Downloads/brickwiseimmobilien-main/brickwiseimmobilien-main/app/dashboard/actions.ts:68). [Prova e izoluar](../project-backups/deep-audit-2026-10-02/financial/reproduction-results.json).

Korrigjimi: kërkohet identifikues i qëndrueshëm në **çdo** hyrje të blerjes nga balanca, ruajtje e tij gjatë riprovimit dhe bllokim i dërgimit në vazhdim. Testi duhet të mbulojë formularin e vjetër dhe faqen e pronës. Mbrojtja vetëm te butoni nuk mjafton.

**2. P1 — Ruajtja nga administratori mund t’i bëjë sërish të disponueshme aksionet e shitura**

Administratori hap formularin me 20 aksione të zëna. Pas një blerjeje, numri aktual bëhet 22. Nëse ruan formularin e vjetër, `updateShareSettings` mund ta kthejë `blocked_shares` në 20, megjithëse klientët zotërojnë 22. Veprimi kryen upsert pa kontroll të versionit ose të aksioneve të zotëruara.

U riprodhua si me veprimin real të aplikacionit në izolim, ashtu edhe me **SQL-në aktuale të production**, vetëm mbi klient, administrator dhe pronë provë. Me furnizim total 30, pas ruajtjes mbetën **22 aksione të zotëruara, por 20 të zëna**. Sistemi do të llogariste 10 të lira në vend të 8. Transaksioni u kthye dhe gjendja para/pas ishte e njëjtë. Katalogu live nuk ka trigger që e ndalon këtë mospërputhje.

Burime: [veprimi i administratorit:102](C:/Users/User/Downloads/brickwiseimmobilien-main/brickwiseimmobilien-main/app/admin/properties/actions.ts:102), [upsert në SQL:53](C:/Users/User/Downloads/brickwiseimmobilien-main/brickwiseimmobilien-main/SUPABASE_ATOMIC_ADMIN_AUDIT.sql:53). [Prova mbi databazën aktuale](../project-backups/deep-audit-2026-10-02/financial-live-rollback-reproductions.json).

Korrigjimi: rezervimet manuale duhen ndarë nga aksionet e blera, ose duhet një operacion atomik që kontrollon zotërimet dhe zbulon formularin e vjetruar. Kufiri duhet mbrojtur në databazë. Në të dhënat aktuale nuk u gjet pronë me aksione të zëna nën zotërimet e klientëve.

**3. P2 — Statusi i një blerjeje të përfunduar mund të kthehet në “new” nga admini**

Blerja nga balanca krijon kërkesë me status `completed`. Zgjedhësi i statusit në admin përmban vetëm `new`, `contacted`, `closed`; nuk mund ta paraqesë statusin real. Veprimi në server lejon ndryshimin sipas ID-së, pa dalluar blerjen e paguar nga kërkesa e kontaktit.

Në SQL-në aktuale, një porosi provë e përfunduar u ndryshua në `new`, ndërkohë që balanca dhe aksionet mbetën të pandryshuara. U krye `ROLLBACK`. Ky është problem i përputhjes së statusit administrativ me transaksionin financiar, jo rimbursim ose anulim i blerjes.

Burime: [zgjedhësi:395](C:/Users/User/Downloads/brickwiseimmobilien-main/brickwiseimmobilien-main/app/admin/page.tsx:395), [ndryshimi në server:30](C:/Users/User/Downloads/brickwiseimmobilien-main/brickwiseimmobilien-main/app/admin/action.ts:30). [Prova SQL](../project-backups/deep-audit-2026-10-02/financial-live-rollback-reproductions.json).

Korrigjimi: paraqit `completed` dhe blloko ndryshimet e zakonshme të statusit për blerjet e paguara, në formular dhe server/databazë. Anulimi financiar duhet të ketë rrjedhën e vet.

**4. P2 — Endpoint-i OTP nuk kontrollon origjinën dhe llojin e kërkesës**

`/authentication/verify-otp` lexon JSON pa kërkuar origjinën e faqes dhe pa kufizuar `Content-Type`. Handler-i real, në test të izoluar, pranoi origjinë tjetër dhe `text/plain`, pastaj arriti te verifikimi i suksesshëm OTP me Auth të simuluar. SDK-ja e instaluar ruan sesionin pas verifikimit të suksesshëm.

Kjo krijon rrezik të hyrjes së padëshiruar në llogarinë e një personi tjetër, nëse ky person ka kod të vlefshëm për llogarinë e vet. Aktiviteti pasues mund të lidhet me llogarinë e gabuar. **Nuk u demonstrua shfrytëzim i plotë në shfletues, zëvendësim cookie-je në production ose marrje e llogarisë së viktimës.** Prova konfirmon pranimin e kërkesës nga handler-i; kufiri Auth ishte i simuluar.

Burime: [handler-i OTP:9](C:/Users/User/Downloads/brickwiseimmobilien-main/brickwiseimmobilien-main/app/authentication/verify-otp/route.ts:9), [ruajtja e cookie-ve:16](C:/Users/User/Downloads/brickwiseimmobilien-main/brickwiseimmobilien-main/lib/supabase/server.ts:16), [rezultatet e izoluara](../project-backups/deep-audit-2026-10-02/auth/results.json).

Korrigjimi: verifiko origjinën dhe prano vetëm JSON përpara thirrjes Auth; lidhe kërkesën me rrjedhën e synuar të hyrjes. Endpoint-i i marrëveshjes tashmë ka kontrolle të ngjashme. Kjo përputhet me [udhëzimet OWASP për mbrojtjen nga CSRF në hyrje](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html).

**5. P2 — Shkrimi anonim direkt në databazë anashkalon mbrojtjen e kontaktit nga spam-i**

Formulari i kontaktit përdor një fushë kurth për robotët. Politikat aktuale lejojnë gjithashtu `anon` të shtojë drejtpërdrejt `property_requests`, me pronar bosh, status `new` dhe kufizime fushash. Ky shteg nuk kalon nga fusha kurth e formularit. U konfirmuan politikat live dhe mungesa e trigger-ave kufizues në këtë tabelë.

Pasojë e mundshme është mbushja e kërkesave me spam. Nuk u krye test ngarkese ose dërgim spam-i; konfigurimi i plotë i WAF-it dhe kufizimet e platformës nuk u audituan. Nuk u gjet akses anonim për leximin e kërkesave të klientëve.

Burime: [kontrolli i formularit:19](C:/Users/User/Downloads/brickwiseimmobilien-main/brickwiseimmobilien-main/app/interface/contact-request/route.ts:19), [politikat e insert-it:44](C:/Users/User/Downloads/brickwiseimmobilien-main/brickwiseimmobilien-main/SUPABASE_PROPERTY_REQUESTS_RLS.sql:44), [katalogu live](../project-backups/deep-audit-2026-10-02/database-catalog.json).

Korrigjimi: përdor një shteg të kontrolluar në server me kufizim frekuence dhe verifikim kundër automatizimit, duke hequr insert-in anonim direkt ose duke vendosur kontrolle ekuivalente në çdo shteg shkrimi. Vetëm një kufizim te formulari nuk e mbyll shtegun e databazës.

**6. P2 — Listat e klientëve në admin ndalen te 200 përdorues**

Faqja kryesore e adminit dhe zgjedhësi i klientëve për pagesa thërrasin `listUsers({page: 1, perPage: 200})`. Nuk ka faqe pasuese ose kërkim mbi të gjithë përdoruesit. Kur projekti kalon 200 llogari, klientët jashtë faqes së parë mund të mungojnë në zgjedhësit e kreditimit/pagesave dhe totalet bëhen të paplota. Kontaktet rezervë nuk garantojnë identitetin Auth të nevojshëm për kreditim.

Kjo është mangësi e konfirmuar në kod me prag të qartë; nuk pretendohet se production e ka kaluar këtë prag.

Burime: [lista në admin:111](C:/Users/User/Downloads/brickwiseimmobilien-main/brickwiseimmobilien-main/app/admin/page.tsx:111), [lista për pagesa:133](C:/Users/User/Downloads/brickwiseimmobilien-main/brickwiseimmobilien-main/app/admin/payments/requests/page.tsx:133).

Korrigjimi: pagination/kërkim në server me ID të qëndrueshme përdoruesi dhe tregim të qartë të rezultateve të pjesshme. Testi duhet të përfshijë klientin e 201-të.

**7. P2 — Regjistrimi zbulon nëse email-i ka llogari**

Handler-i dallon përgjigjen Auth për një adresë ekzistuese dhe kthen `alreadyRegistered: true` me HTTP 200, ndërsa për llogari të re kthen `false` me HTTP 201. Të dy degët u provuan në izolim. Kjo ekspozon anëtarësimin kur Auth kthen formën e përgjigjes që trajton kodi dhe mund të ndihmojë mashtrime të synuara. Nuk u provuan email-e realë dhe nuk u krijuan llogari; kufizimet e Supabase mund ta kufizojnë frekuencën.

Burimi: [përgjigjet e regjistrimit:125](C:/Users/User/Downloads/brickwiseimmobilien-main/brickwiseimmobilien-main/app/interface/register/route.ts:125). [Prova](../project-backups/deep-audit-2026-10-02/auth/results.json).

Korrigjimi: jep të njëjtin status dhe përgjigje të përgjithshme për të dy rastet, duke i mbajtur hollësitë e llogarisë jashtë përgjigjes publike.

**8. P2 — Disa shuma dhe butona kanë kontrast të pamjaftueshëm**

Kontrolli në shfletues gjeti kontrast **1.64:1** për shumën e verdhë €2,000 në faqen kryesore, **3.07:1** për disa tregues blu mbi të bardhë dhe **1.98:1** për tekstin e bardhë të WhatsApp-it mbi të gjelbër. Titulli i vogël i detajeve në komponentin Income kishte **4.02:1**, matur në fixture. Këto ngjyra e vështirësojnë leximin për përdorues me shikim të dobët.

Për tekstin normal, pragu WCAG AA është 4.5:1; për tekstin e madh 3:1. Logot kanë përjashtim dhe nuk u përfshinë si gjetje për vlerat financiare. [Burimi W3C](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html).

Burime: [shuma kryesore:286](C:/Users/User/Downloads/brickwiseimmobilien-main/brickwiseimmobilien-main/app/page.tsx:286), [treguesit:333](C:/Users/User/Downloads/brickwiseimmobilien-main/brickwiseimmobilien-main/app/page.tsx:333), [WhatsApp:396](C:/Users/User/Downloads/brickwiseimmobilien-main/brickwiseimmobilien-main/app/contact/page.tsx:396), [Income:63](C:/Users/User/Downloads/brickwiseimmobilien-main/brickwiseimmobilien-main/app/dashboard/IncomeExperience.tsx:63). [Matjet e shfletuesit](../project-backups/deep-audit-2026-10-02/frontend/production-browser-results.json).

Korrigjimi: errëso tekstet/ngjyrat përkatëse dhe verifiko kombinimet në gjendjen normale, hover dhe fokus. Raporti nuk i trajton automatikisht të gjitha sinjalizimet e animacioneve të përkohshme si defekte.

**9. P2 — Tabela e kësteve në ekran të ngushtë nuk ka fokus të qartë me tastierë**

Tabela e kalkulatorit ka gjerësi minimale 720 px brenda një mbështjellësi me scroll horizontal, pa `tabIndex` ose element të fokusueshëm brenda. Në kontrollin live me gjerësi 320 px u sinjalizua `scrollable-region-focusable`. Në shfletues që nuk i fokusojnë automatikisht këto zona, përdoruesi me tastierë nuk arrin lehtësisht kolonat jashtë ekranit.

Burimi: [kalkulatori:315](C:/Users/User/Downloads/brickwiseimmobilien-main/brickwiseimmobilien-main/app/mortgage-calculator/page.tsx:315). Korrigjimi: fokus me tastierë për zonën, emër i aksesueshëm dhe tregues i dukshëm fokusi. Nuk pretendohet testim me çdo shfletues ose lexues ekrani.

**10. P3 — Tre endpoint-e hedhin gabim të pakapur kur JSON është `null`**

Kontakti, verifikimi OTP dhe verifikimi i telefonit trajtojnë gabimin e sintaksës JSON, por jo vlerën e vlefshme `null`. Leximi/shpërbërja e fushave shkakton `TypeError`. Të tre rastet u riprodhuan me handler-at realë në izolim, përpara aksesit Auth/databazë. Pasoja është gabim serveri në vend të përgjigjes 400.

Burime: [kontakti:19](C:/Users/User/Downloads/brickwiseimmobilien-main/brickwiseimmobilien-main/app/interface/contact-request/route.ts:19), [OTP:9](C:/Users/User/Downloads/brickwiseimmobilien-main/brickwiseimmobilien-main/app/authentication/verify-otp/route.ts:9), [telefoni:8](C:/Users/User/Downloads/brickwiseimmobilien-main/brickwiseimmobilien-main/app/authentication/verify-phone/route.ts:8).

Korrigjimi: valido objekt jo-null dhe jo-array pas parsimit, pastaj valido fushat. [Provat](../project-backups/deep-audit-2026-10-02/auth/results.json).

**11. P3 — Etiketa e email-it për rikthim fjalëkalimi nuk lidhet me fushën**

Etiketa nuk ka `htmlFor`; fusha nuk ka `id`/`name`. Klikimi mbi etiketë nuk e fokuson fushën. Placeholder-i mund të shërbejë si emër rezervë, prandaj problemi nuk duhet përshkruar si fushë pa asnjë emër në çdo teknologji ndihmëse.

Burimi: [ForgotPasswordForm:73](C:/Users/User/Downloads/brickwiseimmobilien-main/brickwiseimmobilien-main/app/forgot-password/ForgotPasswordForm.tsx:73). Korrigjimi: ID/emër i qëndrueshëm dhe `htmlFor` përkatës. U verifikua në të dy madhësitë e ekranit.

**12. P3 — Auditi ekzistues i gjuhëve pret sjellje të vjetruar**

`scripts/audit-localization.mjs` pret që `?lang=it` dhe gjuhët e tjera të vlefshme të japin redirect 307/308 dhe parametri të hiqet. Proxy aktual, me qëllim, jep HTTP 200 dhe ruan URL-në e gjuhës me canonical përkatës. Kjo sjellje u konfirmua në production për të pesë gjuhët. Testi i vjetër do të japë dështim të rremë te ky pohim; nuk u ekzekutua i gjithë skripti i vjetër si provë e këtij auditi.

Burime: [pohimi i vjetër:110](C:/Users/User/Downloads/brickwiseimmobilien-main/brickwiseimmobilien-main/scripts/audit-localization.mjs:110), [proxy:30](C:/Users/User/Downloads/brickwiseimmobilien-main/brickwiseimmobilien-main/proxy.ts:30). Korrigjimi: përputh kontrollin me HTTP 200, ruajtjen e filtrit të qytetit, cookies të zgjedhjes manuale dhe canonical-in e gjuhës.

**Kontrollet që kaluan**

| Kontrolli | Rezultati dhe kufiri |
|---|---|
| Testet e aplikacionit | 121/121 kaluan; përfshihen financat, autorizimi, marrëveshjet, profili, gjuhët dhe marketingu |
| Build dhe lint | Kaluan përpilimi, TypeScript, gjenerimi i faqeve dhe ESLint |
| `npm audit --json` | 0 cenueshmëri të njohura të raportuara në varësitë e instaluara; nuk është provë sigurie e kodit të biznesit |
| Pronësia e klientit në DB | Izolim sipas UUID-së, ndërrim/ripërdorim email-i, rreshta pa pronar, refuzim i rolit admin të falsifikuar; fixture të kthyera |
| Privatësia e pagesave | Kolonat/shënimet private, wildcard dhe filtrimi i tyre të ndaluara për klientët; klienti tjetër dhe anon refuzohen |
| Auditimi administrativ dhe depozitat | Dështimi i regjistrimit të auditit kthen edhe ndryshimin përkatës; prova në skemën aktuale |
| Marrëveshjet | Hash-et e PDF-ve, versioni, pëlqimi i shprehur, RLS, snapshot-et e pandryshueshme, riprovimi dhe shqyrtimi atomik kaluan |
| Kreditimi dhe blerja nga balanca | EUR, debitimi, aksionet, stoku, porosia e përfunduar, refuzimi i mungesës së fondeve/stokut dhe i ID-së së përsëritur kaluan në SQL |
| Rimbursimet | Rimbursim i plotë, riprovim, histori e pandryshueshme, klient i paautorizuar, referencë e dyfishtë, mungesë fondesh, dështim auditi dhe lidhje me depozitën kaluan |
| Nëntë përputhje financiare live | 0 mospërputhje në balanca/ledger, valuta, aksione/kosto, kredi të lidhura, regjistrime auditi dhe statuse porosish në çastin e matjes |
| Katalogu i databazës | Të gjitha tabelat publike të kontrolluara kanë RLS; kreditimi, blerja dhe shkrimet e përgjithshme administrative janë vetëm për `service_role` |
| Faqet publike | 115 URL nga sitemap, 23 faqe × 5 gjuhë, kaluan HTTP 200, gjuhën HTML, canonical, hreflang dhe indexability |
| Shfletuesi desktop/mobile | 20 kombinime faqe/ekran, 1440 px dhe 320 px; pa gabime runtime, imazhe të dukshme të prishura, burime same-origin të dështuara ose dalje horizontale të faqes |
| Income në pesë gjuhë | 10 prova të komponentit real me të dhëna sintetike; titujt dhe formati italian `20.000,00 EUR` kaluan |
| Consent dhe modal | 11 pohime për bllokim marketingu para pëlqimit/pas refuzimit, tërheqjen e pëlqimit, fokusin, Tab/Shift+Tab/Escape dhe arritshmërinë në mobile |
| Kufijtë publikë | Wallet/admin ridrejtojnë vizitorët pa hyrje; API e marrëveshjes dhe dëftesa japin 401; `.env`, `.git/config`, `.vercel/project.json`, raportet dhe backups japin 404 |
| Headers dhe domeni | HTTPS/HSTS, CSP, nosniff, mbrojtje iframe, politika referuesi; faqet private noindex dhe përgjigjet e kontrolluara pa cache; domeni pa www ridrejton me 308 |

**Për çështjen e italishtes**

Zgjedhësi real i gjuhës në production kaloi ndërrimin EN/DE/FR/ES/IT, ruajti filtrin e qytetit dhe ruajti italishten gjatë navigimit. Komponenti real Income dha tekstin “Il tuo capitale. Le tue quote. Il tuo rendimento.” në provën me të dhëna sintetike. [Pamja e provës në italisht](../project-backups/deep-audit-2026-10-02/frontend/income-native-it-1440.png).

Screenshot-i i dërguar nga përdoruesi tregon shprehimisht “Translated to English”. Kjo është në përputhje me shpjegimin që përkthimi automatik i shfletuesit po mbulon gjuhën e aplikacionit; përdorimi i “Undo” e heq atë përkthim. Nuk u hap sesioni real i përdoruesit në Income, prandaj nuk pretendohet verifikim i pavarur i asaj llogarie në production.

**Gjendje të tjera dhe kufijtë e auditit**

Profili i përfunduar pas pranimit `pending`/`approved`, butoni i vetëm me emër/mbiemër dhe dokumentet e shënuara si draft janë sjellje të kërkuara. Nuk u trajtuan si defekte. U verifikua mekanizmi teknik i pëlqimit dhe ruajtjes së dëshmisë; nuk u vlerësua vlefshmëria juridike e dokumentit ose e modelit të investimit.

Konfigurimi live Auth ka konfirmim email-i aktiv, minimum fjalëkalimi 6, mbrojtje ndaj fjalëkalimeve të komprometuara joaktive dhe CAPTCHA joaktive. Formulari i regjistrimit kërkon 8 karaktere. Kjo mospërputhje dhe forcimi i politikës së hyrjes janë çështje për përmirësim, të ndara nga 12 gjetjet; nuk provojnë se ndonjë llogari përdor fjalëkalim të dobët. Nuk u ndryshuan konfigurimet.

U inspektuan mekanizmat e autorizimit të administratorit, parametrizimi i shkrimeve SQL, kufizimi i importeve, escapimi i dëftesës dhe destinacionet e callback-ut. Nuk u krye testim ngarkese, përmbytje kërkesash, transfer bankar/crypto, blerje e plotë me llogari reale, kontroll i çdo browser-i, audit i plotë i WAF-it, test rikthimi nga backup ose matje Lighthouse/Core Web Vitals. Mungesa e një problemi në këto rezultate nuk i mbulon këto fusha.

Përpara kodimit u lexua udhëzuesi i sigurisë së versionit Next të instaluar. Rishikimi përdori kodin aktual dhe katalogun live; nuk i rimori automatikisht si të hapura problemet e raporteve të shtatorit që tashmë kanë korrigjime. Udhëzimet `pages:write-page` u përdorën vetëm për raportin në dokumentacionin ekzistues të repository-t.

**Radha e propozuar e korrigjimit**

Gjetjet 1–2 tashmë janë mbyllur me teste për dërgim të përsëritur dhe formular të vjetruar. Vijon gjetja 3 për statusin e blerjes, pastaj hyrja OTP dhe kufijtë publikë të regjistrimit/kontaktit. Pagination, aksesueshmëria dhe tri gjetjet P3 mund të vijojnë si ndryshime të veçanta. Çdo korrigjim i aplikacionit duhet validuar dhe publikuar te projekti ekzistues Vercel sipas udhëzimit të pronarit. Dhjetë gjetjet e mbetura nuk janë korrigjuar nga kjo ndërhyrje.

Artefaktet e auditit ruhen te [deep-audit-2026-10-02](../project-backups/deep-audit-2026-10-02/), me [gjendjen e përmbledhur](../project-backups/deep-audit-2026-10-02/status.json), [verifikimet e databazës](../project-backups/deep-audit-2026-10-02/database-verification.json), [rimbursimet](../project-backups/deep-audit-2026-10-02/refund-database-verification.json), [HTTP/security headers](../project-backups/deep-audit-2026-10-02/production-security-http.json) dhe provat sipas fushave në `financial`, `auth`, `frontend`. Artefaktet e ruajtura nuk përmbajnë çelësa sekretë ose rreshta të klientëve realë.
