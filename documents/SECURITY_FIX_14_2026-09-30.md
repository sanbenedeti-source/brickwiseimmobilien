# Pika 14 — Veprime administrative dhe auditim atomik

## Ndryshimi
- `admin_write_audited` është RPC vetëm për service_role. Kontrollon administratorin kundrejt auth.users/app_metadata dhe kufizon tabelat sipas veprimit. Identifikuesit e kolonave verifikohen kundrejt katalogut; vlerat përdorin parametra SQL.
- Krijimi/përditësimi i pagesave, llogarive të kompanisë, kuotave, statusit të fitimit, statusit të kërkesave dhe krijimi i pronave përdorin të njëjtin transaksion me regjistrin e auditimit.
- Prona, pesë përkthimet dhe publikimi i saj janë një transaksion. Dështimi nuk lë as draft të pjesshëm.
- Importi i pronave përdor një RPC për të gjithë serinë (1–200 prona); ruajtja dhe auditimi përfundojnë së bashku. Importi me API key përdor identitet shërbimi `property-import-api`, jo një administrator të sajuar. Sesioni admin përdor ID-në e autentifikuar. API key dhe service key nuk regjistrohen.
- Kreditimi auditohet nga trigger mbi futjen e transaksionit wallet. Dështimi i auditimit kthen mbrapsht bilancin, transaksionin dhe pagesën. Retry me të njëjtin operation key nuk krijon audit të dytë.
- Aprovimi/refuzimi i depozitës auditohet nga trigger në të njëjtin transaksion. Rimbursimi e kishte auditimin atomik nga hapi 5.
- U hoq rruga e vjetër që vetëm printonte gabimin e auditimit pas një shkrimi të suksesshëm. Veprimet e dështuara nuk krijojnë hyrje suksesi. Nuk u sajuan hyrje historike për veprimet e vjetra.

## Migrimet
`SUPABASE_ATOMIC_ADMIN_AUDIT.sql` regjistrohet si 014_atomic_admin_audit.
`SUPABASE_DEPOSIT_REVIEW_AUDIT.sql` regjistrohet si 014b_deposit_review_audit.
Të dy runner-at kanë check/apply/verify, checksum dhe krahasim fingerprint-esh. Migrimet janë additive dhe nuk ndryshojnë rreshtat ekzistues.

## Verifikimi
- 44 teste financiare, 20 lokalizimi dhe 15 sigurie/importi kaluan; build/lint kaluan.
- SQL me fixture dhe ROLLBACK: dështim i detyruar i auditimit për kreditim, import me disa prona, pronë/përkthime dhe ndryshim pagese. Kontrollohen mosndryshimi i gjendjes, retry, identiteti i administratorit, kufizimi i tabelave dhe ndalimi i RPC për anon/authenticated.
- SQL për depozita: dështimi i auditimit gjatë aprovimit dhe refuzimit ruan statusin pending dhe nuk lë kredi/pagesa; refuzimi i suksesshëm ka audit. Testet ekzistuese të aprovimit/rimbursimit kaluan me trigger-at e rinj.
- Fingerprint-et e pronave, përkthimeve, llogarive të kompanisë, kërkesave, pagesave, depozitave, kuotave, wallet-it, auditit dhe përdoruesve mbetën të pandryshuara jashtë fixture-ve të kthyera mbrapsht.
- Testet HTTP të importit përdorin mocks; nuk u dërgua import apo kreditim real në production.

## Publikimi dhe kontrollet live
- Vercel production: `dpl_2TV5Y4LaGUk9HzBvQ9aVfWs4KxHV`, status READY.
- https://www.brickwise-immo.de/ përgjigjet HTTP 200.
- Pa sesion, `/admin/audit` ridrejton te `/admin`; `/admin/payments/requests` dhe `/admin/properties` ridrejtojnë te `/sign-in` (HTTP 307).
- POST pa autorizim te `/api/properties/import` refuzohet me HTTP 401. Nuk u dërgua import real.
