# Audit i shifrave të pronave — 24 shtator 2026

## Modeli i konfirmuar

- Çmimet, vlerat, kuotat dhe qiratë e katalogut ruajnë shifrat numerike dhe caktohen në **EUR**, sipas kërkesës së pronarit. Nuk është aplikuar kurs CAD/EUR.
- Objektivat 28–36% janë **vjetore**. Vacation points mbeten 9,50%; komponenti i qirasë llogaritet nga qiraja bruto reale e modelit; Appreciation është pjesa e mbetur e objektivit.
- Shuma e investimit = numri i kuotave × çmimi i kuotës.
- Kthimi vjetor i modeluar = shuma × objektivi vjetor / 100.
- Kthimi mujor i modeluar = kthimi vjetor / 12.
- Formulat përdoren për të gjithë pronën, një kuotë dhe sasinë e përzgjedhur. Llogaritjet ruajnë saktësinë; vetëm paraqitja monetare rrumbullakohet në dy shifra dhjetore.

Këto janë modele të konfiguruara, jo para të kredituara në llogari. Qiraja bruto/neto, komponentët jo monetarë dhe pagesat e regjistruara kanë emërtimet e tyre.

## Mospërputhjet e gjetura dhe zgjidhjet

| Gjetja | Zgjidhja |
|---|---|
| Gjashtë prona shfaqeshin në CAD, ndërsa minimumi ishte në EUR. | Të shtatë pronat kanë monedhë EUR të qartë; minimumi është €2.000, pa varësi nga kursi i këmbimit. |
| Lista përdorte qiranë bruto për kuotë; detajet/dashboard qiranë neto; parashikime të tjera përdornin 9%. | Një funksion i përbashkët llogarit objektivin vjetor dhe mujor. Qiratë mbeten të etiketuara veçmas. |
| Etiketat thoshin se objektivi nuk kishte periudhë. | Periudha vjetore dhe formula vjetor ÷ 12 shfaqen në pesë gjuhët. |
| Faqja kryesore tregonte një kuotë më pak për Toronto, Vancouver, Calgary, Ottawa dhe Montreal. | Numrat lexojnë të njëjtin funksion dhe cilësimet e rezervimeve; disponueshme = gjithsej − bllokuara. |
| Përqindja e financimit përdorte vlerë të pavarur nga kuotat. | Financimi llogaritet nga kuotat e bllokuara / kuotat totale. |
| Të ardhurat për kuotë humbnin centët në formatim. | Të ardhurat shfaqen me dy shifra dhjetore. |
| Përqindjet e rrumbullakosura të qirasë prodhonin diferenca nga qiraja mujore × 12. | Komponenti i qirasë ruan saktësinë e plotë; Appreciation është diferenca e saktë. |
| Të dhënat e vjetra të Appreciation nuk përputheshin me komponentët e rinj. | Të dy lexojnë të njëjtin model të përllogaritur. |
| Administrimi/importi/llogaritësit e kredisë kishin CAD ose formate të ndryshme numrash. | Vlerat e pronave janë EUR; importi validon formatet EUR dhe refuzon monedha të tjera. |
| Shuma e pagesave në monedha të ndryshme mund të paraqitej si EUR. | Pagesat historike ruhen/shfaqen sipas monedhës së regjistruar dhe nuk bashkohen si një shumë EUR. |

## Katalogu dhe objektivat

| Prona | Vlera EUR | Kuota | EUR/kuotë | Objektivi vjetor | Vjetor/kuotë EUR | Mujor/kuotë EUR |
|---|---:|---:|---:|---:|---:|---:|
| Sal Rei | 116.100,00 | 1.161 | 100,00 | 34,76% | 34,76 | 2,90 |
| Edmonton | 2.650.000,00 | 2.650 | 1.000,00 | 28,00% | 280,00 | 23,33 |
| Toronto | 735.000,00 | 2.940 | 250,00 | 30,00% | 75,00 | 6,25 |
| Vancouver | 895.000,00 | 1.790 | 500,00 | 29,00% | 145,00 | 12,08 |
| Calgary | 428.000,00 | 4.280 | 100,00 | 36,00% | 36,00 | 3,00 |
| Ottawa | 690.000,00 | 2.760 | 250,00 | 34,00% | 85,00 | 7,08 |
| Montreal | 815.000,00 | 1.630 | 500,00 | 32,00% | 160,00 | 13,33 |

| Investim €2.000 | Kthimi vjetor EUR | Ekuivalenti mujor EUR |
|---|---:|---:|
| Sal Rei | 695,20 | 57,93 |
| Edmonton | 560,00 | 46,67 |
| Toronto | 600,00 | 50,00 |
| Vancouver | 580,00 | 48,33 |
| Calgary | 720,00 | 60,00 |
| Ottawa | 680,00 | 56,67 |
| Montreal | 640,00 | 53,33 |

Një shumë mujore e rrumbullakosur për paraqitje mund të japë disa centë diferencë kur shumëzohet me 12. Modeli përdor shumën vjetore të parrumbullakosur, jo shifrën mujore të paraqitur.

## Pagesat dhe bilancet historike

Regjistrat ekzistues të wallet-it janë në CAD dhe nuk u riemërtuan në EUR. Vlera e një prone të ripërcaktuar në EUR nuk ndryshon monedhën e një pagese të vjetër. Parashikimi EUR i kuotave ekzistuese përdor numrin e kuotave × çmimin aktual EUR; kostoja historike ruhet veçmas në monedhën origjinale.

Kërkesat e reja të investimit janë në EUR dhe kalojnë për shqyrtim pagesash. Një kërkesë EUR nuk debitohet si CAD nga wallet-i. Parametri historik 8–10% në bazën e të dhënave nuk përdoret si objektivi vjetor 28–36% i katalogut. Asnjë migrim monetar apo rishkrim i transaksioneve historike nuk është kryer nga ky audit.

## Verifikimi

Kontrollet mbulojnë të shtatë pronat: barazimin vlerë = kuota × çmim, minimumin €2.000, komponentët, përllogaritjen vjetore/mujore, rezervimet, kërkesat e pagesës, kalkulatorët, formatet EUR dhe ruajtjen e monedhës historike.

- `npm run test:financial`: 31 teste kaluan, 0 dështime.
- `npm run lint`: 0 gabime; 5 paralajmërime ekzistuese për variabla të papërdorura.
- `npm run build`: përpilimi, TypeScript dhe gjenerimi i faqeve përfunduan me sukses.
- `npm run audit:financial -- http://127.0.0.1:3005`: kaloi kontrolli HTTP i API-së, listës, faqes kryesore, të shtatë faqeve të detajeve/kalkulatorëve/kontaktit, faqeve të kredisë dhe shpjegimeve të modelit.

Faqet private dhe veprimet e tyre u verifikuan me teste të llogaritjeve, paraqitjes dhe kërkesave të simuluara; auditimi nuk kreu pagesa reale apo hyrje si klient.

### Publikimi dhe kontrolli live

- Vercel production: `dpl_GuVcfWBQHWSoUu4ZycMSQ1HgYFio`, statusi `READY`.
- Domeni i verifikuar: https://www.brickwise-immo.de.
- `node scripts/audit-property-financials.mjs https://www.brickwise-immo.de`: **PASS** për të shtatë pronat, EUR, objektivat vjetore/mujore, kalkulatorët, kontaktin, kuotat, faqen kryesore, listën, kredinë dhe udhëzuesit.
- Publikimi: https://brickwiseimmobilen-dnvt5nzw2-ismarts-projects-fe72132b.vercel.app.

Rezultati live u regjistrua në këtë raport lokal pas publikimit; nuk pati ndryshime të kodit pas verifikimit.
