# Hapi 7: ruajtja e profilit

Formulari i profilit ngarkon tani të dhënat aktuale nga Supabase Auth kur hapet, përfshirë emrin, datëlindjen, gjininë, telefonin dhe shtetin. Formulari nuk shfaqet si i redaktueshëm para ngarkimit; dështimi shfaq mesazh në gjuhën e zgjedhur.

Ruajtja dërgon vetëm fushat e ndryshuara nga një listë e lejuar. Fushat e pandryshuara ose të munguara nuk mbishkruajnë metadata ekzistuese. Fshirja e qëllimshme e një fushe opsionale lejohet. Emri i plotë përditësohet kur ndryshon emri ose mbiemri. Vlera të vjetra të shtetit/gjinisë që nuk janë në listë ruhen si opsione ekzistuese.

Para shkrimit kontrollohet që sesioni i përket të njëjtit përdorues. Ruajtjet e dyfishta gjatë kërkesës bllokohen; gabimet e rrjetit rivendosin butonin dhe shfaqin mesazh. Nuk ka ndryshim të privilegjeve, roleve apo skemës së databazës.

Verifikimi:
- 4 teste regresioni: profil i plotësuar me ndryshim vetëm të emrit; fusha të pandryshuara/munguara dhe ndryshime të pavarura në sesion tjetër; fshirje e qëllimshme dhe refuzim i fushave jashtë listës; emra të ndarë dhe opsione të vjetra.
- 20 teste lokalizimi, build dhe lint kaluan.
- Testet përdorin të dhëna lokale; asnjë profil real nuk u ndryshua.
- Nuk u krye ruajtje manuale në një llogari klienti në production.

Publikimi: dpl_D1xFS4NhUva9EgyoBsY3ASZqjem8 (rezultati dhe kontrolli HTTP regjistrohen pas përfundimit).

Deployment READY. Production checks: homepage 200; /dashboard/account and /funding 307 to authentication without a session.
