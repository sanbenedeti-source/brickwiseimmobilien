# Pika 13 — Izolimi sipas ID-së së klientit

## Problemi dhe ndryshimi
Politika e leximit të payment_requests lejonte akses përmes email-it edhe për rreshta të lidhur me një përdorues tjetër. Property requests ishin pjesërisht të mbrojtura nga hapi 1, por ekspozonin ende regjistra të palidhur sipas email-it.

SUPABASE_CUSTOMER_OWNERSHIP.sql vendos user_id=auth.uid() për lexime klientësh në të dy tabelat. Email-i është informacion kontakti dhe nuk jep akses. Regjistrat e palidhur mbeten për administrimin; nuk bëhet lidhje automatike sipas email-it. Në kontrollin para migrimit, të dy tabelat kishin zero rreshta me user_id null.

Dashboard përdor filtra .eq(user_id,user.id), pa interpolim email-i në filtrin OR. Setup-et fillestare të pagesave/kërkesave u përditësuan me të njëjtin rregull. Admini i besuar ruan leximin e kërkesave dhe administrimi i pagesave vazhdon përmes service_role. Kufizimet e kolonave private dhe të shkrimit ruhen.

## Verifikimi
- check/apply/verify i scripts/secure-customer-ownership.mjs kaluan; migrimi regjistrohet si 013_customer_ownership me checksum.
- Fixture-t janë transaksionale dhe kthehen me ROLLBACK. U provuan: pronari i saktë; email i gabuar në rresht tjetër; ndryshim email-i; ripërdorim i email-it nga llogari tjetër; rresht pa pronar; user_metadata role=admin i falsifikuar; administratori i besuar; service_role dhe kolonat private të pagesave.
- Fingerprint-et e kërkesave, pagesave, rimbursimeve, depozitave, wallet-it, kuotave, auditit dhe ID-ve të përdoruesve mbetën të pandryshuara.
- Kontrolli i plotë property-requests RLS kaloi pas përditësimit të pritshmërisë për rreshtat e palidhur. Kontrolli i privatësisë së pagesave dhe testet e rimbursimeve/depozitave kaluan.
- Build dhe lint kaluan. Nuk u ndryshuan llogari reale dhe nuk u kryen veprime monetare.

Politikat e databazës janë zbatuar. Aplikacioni u publikua me deployment `dpl_92aoQPog8GnjMLdqMVJYa6r9sZP2`, READY, në domenin ekzistues.
