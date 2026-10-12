# Pika 11: formularët dhe dialogët

## Ndryshimet
- Etiketat Contact (përfshirë topic/message) dhe Join lidhen me fushat përmes htmlFor/id. Join përdor useId për komponentët e ripërdorshëm. Sign in i kishte lidhjet; u verifikuan.
- Join njofton gabimet me role=alert dhe gjendjen e butonit të fjalëkalimit me aria-pressed.
- Komponenti Modal përdor dialog.showModal për të bërë përmbajtjen e sfondit inert, fokus fillestar, Escape, kthim fokusi dhe bllokim të scroll-it të sfondit. Tab/Shift+Tab qarkullojnë në kontrollet e dukshme/aktive.
- Dritaret FloatingLeadForm, ProfileModal dhe DepositModal përdorin këtë komponent; panelët kanë kufi lartësie dhe scroll në ekrane të vogla. Fusha e ngarkimit të PDF ka emër të aksesueshëm.
- Butonat kryesorë Join/Sign in përdorin emerald-700; butonat blu të formularit lundrues përdorin #09679f për kontrast më të mirë me tekstin e bardhë. Footer-i ishte përmirësuar gjatë hapave të mëparshëm.

## Verifikimi
- Build, lint dhe 20 teste lokalizimi kaluan.
- Chrome me Playwright: labels të Contact/Sign in/Join (përfshirë hapin e fjalëkalimit); klikimi i label fokuson email-in; fokus fillestar në dialog; Tab/Shift+Tab brenda dialogut; Escape; kthim te butoni hapës; scroll i sfondit bllokohet dhe rivendoset.
- Ekrani 320x480: butoni Send request është i arritshëm me scroll dhe nuk ka overflow horizontal.
- Testet nuk dërguan formularë dhe nuk krijuan klientë/kërkesa. Testi ndërveprues i dialogut u krye te formulari publik, që përdor të njëjtin komponent me profilin/depozitën. Nuk u përdor llogari reale klienti dhe nuk u krye test manual me lexues ekrani; kjo nuk është deklaratë për përputhshmëri të plotë WCAG.
- Komanda: vendos PLAYWRIGHT_MODULE te instalimi i Playwright dhe ekzekuto `node scripts/audit-accessibility-browser.mjs <base-url>`.

Publikimi fillimisht u bllokua nga `Not authorized`. Pronari përfundoi riautorizimin zyrtar të Vercel CLI dhe bllokuesi u zgjidh.

Deployment `dpl_5kE2C41JE5kYupaHHBBdVjEevomY` përfundoi READY dhe u publikua në domenin ekzistues.
`node scripts/audit-accessibility-browser.mjs https://www.brickwise-immo.de` kaloi: etiketat Contact/Sign in/Join, fokusi fillestar, Tab/Shift+Tab, Escape, kthimi i fokusit, bllokimi i scroll-it të sfondit dhe ekrani 320x480. Nuk u dërguan formularë testues.
