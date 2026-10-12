# Hapi 6 — Privatësia e shënimeve të pagesave

Data: 2026-09-27

## Problemi
RLS kufizonte rreshtat e pagesave, por roli authenticated kishte SELECT mbi të gjitha kolonat. Klienti mund të kërkonte admin_note për pagesën e vet edhe pse paneli nuk e shfaqte.

## Ndryshimi
- SUPABASE_PAYMENT_PRIVACY.sql heq privilegjet e përgjithshme të klientit dhe lejon vetëm kolonat e nevojshme për paraqitjen e pagesave.
- admin_note, created_by, verified_by dhe credit_transaction_id mbeten private. Kolonat e reja nuk bëhen automatikisht të lexueshme.
- Administrimi vazhdon përmes service_role në server, pas kontrollit të administratorit.
- RLS ekzistuese për pronësinë e pagesave ruhet. Çështja e veçantë e lidhjes përmes email-it mbetet për hapin e saj të auditit.
- Setup-i fillestar përfshin të njëjtat kufizime. Migrimi regjistrohet si 006_payment_privacy me SHA-256.

## Verifikimi
- npm run build dhe npm run lint kaluan.
- node scripts/secure-payment-privacy.mjs check / apply / verify kaluan.
- Teste SQL me role reale: klienti lexon pagesën e vet dhe projection-in e dashboard-it; kolonat private, wildcard, filtrimi mbi admin_note dhe shkrimet refuzohen; klient tjetër dhe anon nuk lexojnë fixture-n; service_role lexon dhe ndryshon shënimin.
- Fixture-t testuese u kthyen mbrapsht me ROLLBACK; fingerprint-et e pagesave, rimbursimeve, depozitave, wallet-it, kuotave, auditit dhe përdoruesve mbetën të njëjta.
- npm run test:security:refunds kaloi, përfshirë aprovimin e depozitës dhe rimbursimin atomik.
- REST production: anon 401 për id,admin_note; service_role 200. Asnjë përmbajtje private nuk u regjistrua në output.

## Publikimi
Vercel deployment: 7EitGZXEZ6aPojWuuozCcTgqTVsU.
Deployment READY. Production https://www.brickwise-immo.de: home HTTP 200; /dashboard and /admin/payments/requests HTTP 307 to authentication without a session.

