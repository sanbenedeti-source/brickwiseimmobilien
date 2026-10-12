# Audit finding 3 - manual wallet credit retry protection

The manual admin credit form now receives a server-generated operation UUID before submission and preserves it in client state across retries and revalidation. It disables submission while pending and after success. A new credit requires an explicit new form load. The action requires a valid operation UUID, validates EUR cents and amount limits, authorizes the administrator, and obtains customer email/name from Supabase Auth rather than trusting hidden fields.

credit_wallet_atomic now locks the operation key for the duration of the database transaction. A matching prior credit returns its transaction ID without adding another ledger entry, wallet balance increment or payment request. Reuse with a different customer, amount, actor, currency or transaction type is rejected. New operation keys remain valid for genuinely separate credits. Existing service-role-only grants are preserved; the deposit review function continues to call the same RPC inside its own transaction.

Migration: SUPABASE_WALLET_CREDIT_IDEMPOTENCY.sql, applied with scripts/migrate-wallet-credit-idempotency.mjs after a checked SQL hash. Previous function definition and reports are in project-backups/security-fix-03. Counts of auth users, payments, deposits, wallets and transactions and total balances stayed unchanged.

Validation: 40 financial tests (including 4 new action regressions), 20 localization tests, 11 security tests, lint and production build passed. Database tests ran inside a rolled-back transaction and verified duplicate replay, different amount/customer/actor rejection, null key and NaN rejection, separate new credit, integration with deposit approval and RPC grants. No real wallet was credited. Concurrent separate sessions were not load-tested; serialization is enforced by a transaction-level advisory lock plus the existing unique ledger key.

Scope limits: a new form/new operation key is a separate operation, not a bank settlement deduplicator. Existing audit-log writes remain separate from monetary transactions (finding 14). Historical migration replay safety remains finding 4; apply this migration after older wallet/payment-method scripts to avoid restoring an old function definition.

Deployed READY: dpl_3WVfwGUh7mBjehqDHxsxhE8peGdh, https://www.brickwise-immo.de. Live home/admin sign-in page HTTP 200; funding/deposit-admin redirect anonymous users to sign-in. Read-only database verification confirms operation locking, duplicate-result return and denied authenticated direct RPC access.
