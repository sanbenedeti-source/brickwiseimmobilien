# Kontrolli i regjistrimit dhe emailit — 2026-09-30

## Gjetjet dhe ndryshimet
- Join dërgonte te sign-in me registered=1, por sign-in e injoronte këtë parametër: mungonte udhëzimi për konfirmim. U shtua njoftimi dhe formulari i ridërgimit në pesë gjuhët e faqes.
- Linket e skaduara shfaqin udhëzim dhe mundësi ridërgimi. Ridërgimi ka gjendje ngarkimi, gabimi dhe pauzë 60 sekonda pas suksesit; kufizimi autoritativ i dërgimeve mbetet në Supabase.
- Regjistrimi dhe ridërgimi refuzojnë JSON null/array; ridërgimi kontrollon formatin e emailit.
- Template i konfirmimit përdorte ConfirmationURL me PKCE; tashmë dërgon TokenHash te callback server-side, që nuk varet nga cookie e shfletuesit ku nisi regjistrimi.
- Forgot password përdorte faqen recovery që lexon fragmentin, megjithëse klienti SSR përdor PKCE. Tashmë përdor callback që shkëmben code me sesion. U shtuan adresat e sakta për portalet admin/client në allow-list. Faqja e vjetër recovery u ruajt për përputhshmëri.
- Konfigurimi live: SMTP i vendosur, regjistrimi aktiv, konfirmimi email i detyrueshëm. U ndryshuan vetëm uri_allow_list dhe mailer_templates_confirmation_content; kopja e mëparshme ruhet në project-backups/auth-flow.

## Verifikimi
- 6 teste të route handlers me Auth të simuluar: input, redirect canonical, ridërgim, token hash pa PKCE, portalet e rikuperimit dhe linke të skaduara.
- Build dhe lint kaluan.
- Playwright në 390x844: njoftimi pas Join, emaili i paraplotësuar, ridërgimi i simuluar, cooldown, linku i skaduar dhe pa overflow horizontal.
- Nuk u krijuan klientë dhe nuk u dërguan email test te persona realë. Testet nuk provojnë dorëzimin SMTP/inbox ose një hyrje reale fund më fund.
- Rikuperimi PKCE vazhdon të kërkojë shfletuesin që nisi kërkesën; konfirmimi i ri me TokenHash nuk e ka këtë varësi.

Referenca: https://supabase.com/docs/guides/auth/auth-email-templates dhe https://supabase.com/docs/guides/auth/redirect-urls.

## Production
- Deploy dpl_E42h2VY56eMvTmNUux3Facd9WGSy: READY, https://www.brickwise-immo.de.
- Playwright kaloi edhe live me ridërgimin të interceptuar (pa email real).
- Join dhe forgot-password HTTP 200; callback pa token kthen 307 te invalid-link; update-password pa sesion kthen 307 te forgot-password.
- POST null te register dhe confirmation-email kthen 400, pa kontaktuar dërguesin e emailit.
