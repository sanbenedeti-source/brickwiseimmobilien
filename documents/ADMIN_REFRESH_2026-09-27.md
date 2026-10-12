# Paneli admin dhe mënyrat e pagesës — 27 shtator 2026

Paneli ka tipografi sans-serif të izoluar nga fonti serif i faqes publike, navigim me ikonë dhe faqe aktive, menu për ekranet e vogla, shirit të sipërm me gjuhën dhe lidhjen e faqes, karta statistikash dhe karta të veçanta për bankën dhe kripton. Stilet respektojnë fokusin e tastierës dhe preferencën për lëvizje të reduktuar. Statistikat përdorin të dhënat ekzistuese, pa shtuar numra apo grafikë demonstrues.

Stripe dhe Manual u hoqën nga mënyrat e pagesës. Validimi në server dhe kufizimi në databazë refuzojnë këto metoda. Kreditimi administrativ i wallet-it vazhdon të funksionojë në EUR, i identifikuar si `wallet_credit`; nuk është opsion i formularit të pagesave.

Metoda e kriptos quhet `crypto` dhe përmban `crypto_asset` dhe `crypto_network`. Ato janë të detyrueshme, së bashku me udhëzime ose një lidhje pagese. Pranohen simbole të tjera përveç USDC, për shembull BTC, ETH, SOL dhe USDT. Ky është konfigurim i udhëzimeve të pagesës, jo konvertim automatik apo verifikim automatik blockchain. Shuma monetare vazhdon të ruhet në EUR. Aseti dhe rrjeti shfaqen në panelin e administratorit dhe në udhëzimet e klientit.

Etiketat dhe tekstet u përditësuan në pesë gjuhët e projektit. Emri historik `crypto_usdc` njihet ende nga formatuesi i etiketave për lidhje/tekste të vjetra; formularët e rinj nuk e dërgojnë.

Validimi:

- 36 teste financiare, 20 teste lokalizimi/paneli dhe 7 teste sigurie kaluan.
- Lint, build dhe TypeScript kaluan.
- Migrimi `SUPABASE_PAYMENT_METHODS.sql` u provua dy herë në një transaksion me rollback. Provat SQL verifikuan refuzimin e Stripe/Manual, detyrimin për aset/rrjet, pagesa BTC/USDT dhe kreditimin e wallet-it në EUR. Asnjë rresht prove nuk mbeti.
- U inspektuan pamje lokale të renderuara nga komponentët realë, me kufijtë e autentikimit/databazës të simuluar, në Chrome headless. Desktopi u kontrollua në 1440 px. Në telefon, viewport-i, clientWidth dhe scrollWidth ishin 390 px dhe nuk kishte elemente që dilnin horizontalisht.
- Pamjet lokale ruhen në `.next/admin-preview/` dhe nuk publikohen. Të dhënat financiare të shembullit në këto pamje janë vetëm fixtures lokale.
- Pas migrimit kishte 1 llogari hyrjeje dhe 0 pagesa, wallet-e apo transaksione. Llogaria e administratorit u ruajt.

Skema para ndryshimit dhe rezultatet e migrimit ruhen privatisht në `project-backups/admin-refresh-2026-09-27/`. Mjeti i ekzekutimit është `node scripts/migrate-payment-methods.mjs check|apply|verify`.

Publikimi përfundoi me status READY: `dpl_CVF5cotBv3iEyZgyMVGTGoS8NGA1`. Në faqen e prodhimit u konfirmua HTTP 200 për faqen kryesore dhe hyrjen e administratorit, stilet e reja të panelit në CSS-në e publikuar dhe ridrejtimi i saktë drejt hyrjes për pagesat pa sesion. Verifikimi përfundimtar i databazës ruajti 1 përdorues dhe 0 të dhëna financiare. Kontrolli vizual i panelit të autentikuar u bë lokalisht me fixtures; nuk u përdor sesioni privat i administratorit në prodhim.
