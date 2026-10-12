**Korrigjimi 1 — politikat e kërkesave të klientëve, 27 shtator 2026**

Statusi: **publikuar dhe verifikuar live më 27 shtator 2026**. API e përshtatur u publikua në Vercel dhe më pas u aplikuan politikat e reja në databazën e prodhimit. Provat paraprake SQL u zhbënë me ROLLBACK; migrimi përfundimtar u krye me COMMIT. Checksum-i dhe numri i kërkesave ekzistuese mbetën të pandryshuara.

Problemi ishte bashkëjetesa e politikës së vjetër publike `WITH CHECK (true)` me kontrollet e reja. Ekzistonin edhe privilegje administratori të lidhura me një email fiks.

- Migrimi zëvendëson të gjitha politikat vetëm mbi `public.property_requests`, në një transaksion.
- Vizitorët mund të dërgojnë kërkesa pa pronar dhe vetëm me status `new`.
- Klientët e autentifikuar mund të dërgojnë vetëm kërkesa të reja me ID-në e tyre.
- Klientët lexojnë kërkesat e veta. Përputhja e email-it mbetet vetëm për kërkesat pa pronar dhe kërkon email sesioni jo bosh.
- Administratori autorizohet nga `app_metadata.role`, në përputhje me aplikacionin. Mund të lexojë kërkesat dhe të ndryshojë vetëm kolonën `status`, në `new`, `contacted` ose `closed`.
- Roli publik/klient nuk ka të drejta fshirjeje apo TRUNCATE dhe nuk mund të caktojë ID apo datë krijimi.
- Validimet e INSERT kufizojnë emrin, email-in, telefonin dhe mesazhin. Rregullat nuk rishkruajnë të dhënat historike.
- Privilegjet e `service_role` dhe funksionet monetare të besuara ruhen; ato mund të regjistrojnë porosi `completed`.
- API e kontaktit merr `user_id` nga sesioni i verifikuar, duke injoruar identitetin/statusin e dërguar nga klienti.

Skedarët: `SUPABASE_PROPERTY_REQUESTS_RLS.sql`, `app/interface/contact-request/route.ts`, testi përkatës `route.test.mjs`, `scripts/tests/property-requests-rls.sql`, `scripts/secure-property-requests.mjs` dhe komandat e testimit në `package.json`.

**Verifikimi i kryer**

| Kontrolli | Rezultati |
|---|---|
| Build / TypeScript | Kaloi |
| ESLint | Kaloi |
| Teste financiare | 33 kaluan |
| Teste lokalizimi | 20 kaluan |
| Teste të reja të API-së | 7 kaluan |
| Prova SQL me role reale | 46 pohime kaluan |
| Riekzekutimi i migrimit | U aplikua dy herë brenda transaksionit të provës |
| ROLLBACK | Politikat/lejet dhe checksum-i i kërkesave ekzistuese u përputhën para/pas |
| Aplikimi përfundimtar | Kaloi kontrolli i 6 politikave dhe privilegjeve; kërkesat ekzistuese të pandryshuara |
| Kontrolli live HTTP | Home/contact/sign-in 200; dashboard/admin payments 307 te sign-in |
| API contact live pa shkrime | Fushat e munguara 400; honeypot 200 pa regjistrim |
| Leximi anonim direkt në Supabase | U bllokua me HTTP 401 |

Testet SQL përdorin vetëm përdorues dhe kërkesa sintetike brenda të njëjtit transaksion, pa thirrur shërbimin e regjistrimit, pa dërguar email dhe pa bërë pagesa. Kontrollohet mungesa e trigger-ave të personalizuar para krijimit të fixtures. Asnjë e dhënë provë nuk ruhet pas ROLLBACK.

**Rendi i publikimit**

1. Publiko aplikacionin në projektin ekzistues Vercel, që API e klientit të autentifikuar të dërgojë user_id.
2. Ekzekuto `npm run test:security:database` për një kontroll të freskët.
3. Ekzekuto `node scripts/secure-property-requests.mjs apply`. Kjo komandë kërkon që i njëjti migrim/test dhe të njëjtat politika aktuale të kenë kaluar kontrollin gjatë orës së fundit.
4. Ekzekuto `node scripts/secure-property-requests.mjs verify` dhe kontrollo faqen live.

Runner-i ruan konfigurimin e mëparshëm të politikave/lejeve në `.next/property-requests-security-before.json`, pa përmbajtjen e kërkesave të klientëve. Dosja `.next` përjashtohet nga publikimi dhe versionimi. Migrimi mund të riekzekutohet pa ndryshuar rreshtat ekzistues.

Kufij të këtij korrigjimi: ndryshimi i rolit në JWT ndjek rifreskimin/skadimin e token-it. Rasti i fshirjes së një llogarie me `ON DELETE SET NULL`, procesi i marrjes së pronësisë sipas email-it dhe politikat e pagesave mbeten pjesë e gjetjeve të tjera. Përditësimi i Next.js, wallet-i, refund-et dhe audit log nuk përfshihen në këtë ndryshim.

Publikimi Vercel: `dpl_8S5Vv6W15FDoFonpAaSkfxY2x6oJ`, statusi `READY`, target `production`.

- Faqja e verifikuar: https://www.brickwise-immo.de.
- Deployment: https://brickwiseimmobilen-j2361ain4-ismarts-projects-fe72132b.vercel.app.
- API e Vercel konfirmoi se domenet `brickwise-immo.de` dhe `www.brickwise-immo.de` lidhen me këtë publikim.

Pas publikimit u plotësua vetëm dokumentacioni lokal i këtij korrigjimi; nuk ndryshoi kodi i aplikacionit të verifikuar.
