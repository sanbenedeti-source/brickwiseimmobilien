# Lista e mënyrave të pagesës së kompanisë

`/admin/payments` tani menaxhon të dhënat e përbashkëta të kompanisë. Dy formularë të pavarur lejojnë plotësimin e bankës 1 dhe bankës 2. Secili ruan emrin e shfaqur, bankën, përfituesin, IBAN/numrin e llogarisë, BIC/SWIFT, adresën dhe udhëzimet. Bankat u lanë bosh sipas kërkesës së pronarit; nuk u shpikën të dhëna bankare.

Skeda Kripto përmban 6 destinacionet që më parë ishin të shkruara në kodin e faqes së financimit. Asetet, rrjetet dhe adresat u ruajtën identikisht. Admini mund të ndryshojë shënimet, adresat dhe dukshmërinë ose të shtojë një destinacion të ri. Forma e re fillon e papublikuar. Opsioni “Visible to clients” dhe ruajtja e formularit përcaktojnë publikimin.

Klientët e identifikuar shohin vetëm regjistrimet aktive nga e njëjta tabelë `company_payment_methods`, te `/funding` dhe wallet-i në dashboard. Zgjedhja Bankë/Kripto te Deposit çon drejtpërdrejt te grupi përkatës. Pamja përfshin referencën personale të pagesës, të dhënat e kompanisë dhe kopjimin e llogarisë/adresës. Shumat mbeten në EUR.

Sipas sqarimit pasues të pronarit, u ruajt edhe krijimi i kërkesave individuale për klientë specifikë. Ky veprim dhe historiku i kërkesave janë tani te `/admin/payments/requests`, me buton nga faqja kryesore e pagesave. Kreditimi administrativ i wallet-it vazhdon të funksionojë.

Siguria dhe validimi:

- Vetëm administratori i verifikuar mund të ruajë konfigurimin; nuk pranohet rol nga formulari.
- RLS lejon klientët të lexojnë vetëm regjistrimet aktive; administratori sheh edhe të fshehurat. Anonimët nuk kanë të drejtë leximi dhe klientët nuk kanë të drejta shkrimi.
- Veprimet regjistrohen në audit pa kopjuar të gjithë numrat bankarë në shënimet e auditit. Ndryshimet rifreskojnë pamjen admin dhe pamjet e klientit.
- Kufizimi i databazës lejon vetëm dy vende bankash. Regjistrimet aktive nuk janë pagesa apo transaksione financiare.
- Kaluan 36 teste financiare, 20 teste lokalizimi/paneli dhe 11 teste sigurie. Build, TypeScript dhe lint kaluan. Provat reale të RLS u ekzekutuan me rollback dhe pa lënë klientë apo pagesa test.
- U inspektuan pamje lokale të formularëve bankarë dhe listës kripto në Chrome headless, duke renderuar komponentët realë me të dhëna të simuluara në kufijtë e autentikimit/databazës.
- Pas migrimit: 6 adresa kripto aktive, 0 banka të regjistruara, 1 llogari administratori dhe 0 kërkesa, pagesa, wallet-e apo transaksione financiare test.

Migrimi: `SUPABASE_COMPANY_PAYMENT_METHODS.sql`. Mjeti: `scripts/migrate-payment-directory.mjs`. Kopja e adresave të mëparshme dhe rezultatet ruhen privatisht në `project-backups/payment-directory-2026-09-27/`. Pamjet lokale ndodhen në `.next/payment-directory-preview/`. Këto dosje përjashtohen nga Vercel.

Publikimi përfundoi me status READY: `dpl_BcbatXD2AuCYHVSpVkiKY9KN3qFt`. Verifikimi live konfirmoi faqen kryesore HTTP 200, ridrejtimin drejt identifikimit për dy faqet admin dhe dy skedat e financimit pa sesion, si dhe API-në e listës: leximi anonim HTTP 401 dhe leximi i autorizuar i shërbimit HTTP 200. Gjashtë adresat u krahasuan përsëri me kopjen fillestare dhe mbetën identike. Nuk u krijuan llogari apo transaksione për të testuar faqen e prodhimit.
