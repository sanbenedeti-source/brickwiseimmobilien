# Audit finding 4 - historical wallet migration replay

The earlier EUR cleanup already removed the unsafe legacy-credit/legacy-purchase import blocks from SUPABASE_WALLET_LEDGER.sql. No legacy import is reintroduced. The remaining risk was replaying old DDL and downgrading the current idempotent credit RPC or resetting share-supply configuration.

The three historical wallet scripts (ledger, EUR-only, payment methods) now have versioned wrappers. The live database has a restricted brickwise_schema_migrations registry, baselined only after checking existing EUR constraints, payment method fields and the corrected credit RPC. Applied versions with the expected SHA-256 checksum return without running their historical body. Missing registry, untracked initialized wallet, or changed checksum fail closed. Migration wrappers take a transaction-level advisory lock. Registry privileges exclude anonymous and authenticated clients.

scripts/wallet-migration-manifest.json records the three versions. scripts/secure-wallet-migrations.mjs validates the historical body hashes, checks replay inside rollback transactions, and requires a checked hash before applying the baseline. Command: npm run test:security:migrations. Do not modify historical bodies; make a new versioned migration. These retired scripts are not a fresh-install wizard; an untracked existing installation requires review before baselining. Archived SQL copies executed outside this workflow by a privileged database operator are not protected by these wrappers.

Validation: built real credit and two-share purchase fixtures inside a rolled-back transaction, then replayed all three scripts twice. Full-row fingerprints for wallets, transactions, payments, requests, holdings, share settings and deposits, plus current credit/purchase/deposit RPC definitions and user IDs, stayed identical. Negative tests proved missing registry/version and checksum mismatch rejection. No test users, money or shares persisted. Live baseline application preserved the same fingerprints.

Build, lint and 40 financial tests passed. Deployment dpl_7mWFfJvLWAv32njeZcFZjTizQruW is READY at https://www.brickwise-immo.de. Home/properties HTTP 200; funding/admin deposit verification redirect anonymous users to sign-in. Live registry has three reviewed versions; anon/authenticated cannot write it; the corrected credit RPC is preserved.

Next audit item: finding 5, refund reconciliation. Changing a payment label to refunded must not substitute for an actual ledger reversal.
