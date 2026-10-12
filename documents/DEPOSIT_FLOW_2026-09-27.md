# Deposit reporting and confirmation

Client /funding: select intended EUR amount and active company destination, view instructions, then submit bank transfer reference or crypto quantity and transaction hash. Confirmation checkbox states this does not credit funds. No automatic bank/blockchain verification or live crypto quote is implemented.

Admin /admin/payments/deposits: independently check receipt and conversion, enter actual credited EUR amount, a unique settlement reference, and a client-visible note. Confirmation calls review_deposit, locks the submission and credits through credit_wallet_atomic in the same database transaction. Rejection changes no balance. Reviewed rows are immutable to customer/admin table access; function guards prevent repeated credits. Crypto transaction references and approved settlement references have unique indexes. Company destination is checked against the displayed snapshot at submission.

Database: SUPABASE_DEPOSITS.sql; scripts/migrate-deposits.mjs check runs transaction-scoped fixtures and rolls everything back. apply requires checked SQL hash. Existing financial counts and wallet balance totals were unchanged. New table had zero rows after migration.

Validation: production build and lint passed; 36 financial, 20 localization, 11 security tests passed. Database integration covered ownership, direct-write denial, stale/forged destination, duplicate crypto transactions, pending without balance changes, atomic credit, repeated approval, duplicate settlement rollback and rejection. Desktop and 390px mobile initial panel inspected (no horizontal overflow).

Company banks must be configured and activated by admin before they are selectable. No destination or customer funds were created for testing in production.
