# Audit finding 2 - dependency security update

Completed and deployed on 2026-09-27.

Next.js and eslint-config-next: 16.2.6 -> 16.3.6. PostCSS override: 8.5.14 -> 8.5.28. Sharp resolved to 0.35.4. Compatible transitive dependencies refreshed using npm audit fix without --force. Exact resolutions are stored in package-lock.json. Backups and machine-readable audit reports are in project-backups/security-fix-02.

Before: {"info":0,"low":1,"moderate":1,"high":6,"critical":1,"total":9}
After: {"info":0,"low":0,"moderate":0,"high":0,"critical":0,"total":0}
Production-only npm audit: zero known vulnerabilities. This is the current registry advisory result, not proof of complete application security.

Verification: Next production build, TypeScript, lint (zero warnings), 36 financial tests, 20 localization tests and 11 security tests passed. Three new lint warnings were explicitly scoped with reasons: PDF navigation, language-cookie reload, and auth-shell reload after registration. Navigation behavior was preserved.

Production deployment: dpl_AoqQN2pxM3p4esRHT5abFSWAdg7Q, READY, https://www.brickwise-immo.de.
Live checks: sign-in/join HTTP 200; funding and admin deposit verification redirect unauthenticated users to sign-in; optimized hero image HTTP 200 WebP. Live financial audit passed all seven EUR properties, calculators, share availability and related public pages. No customer writes, payments, emails or account creation were used in verification.

Official advisory checked: https://github.com/vercel/next.js/security/advisories/GHSA-m99w-x7hq-7vfj

Next open audit item: finding 3, stable operation identity for the legacy creditCustomerWallet action. The new deposit flow already has its own idempotent approval, but does not close that legacy finding.
