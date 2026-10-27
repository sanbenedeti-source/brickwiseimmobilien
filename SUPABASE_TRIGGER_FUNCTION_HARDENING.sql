-- Supabase security advisor fixes (2026-10-23). All five functions are trigger-only:
-- triggers fire regardless of EXECUTE grants, so API roles never need to call them directly.
revoke all on function public.audit_deposit_review() from public,anon,authenticated;
revoke all on function public.audit_wallet_credit() from public,anon,authenticated;
alter function public.prevent_refund_mutation() set search_path=public;
alter function public.prevent_wallet_transaction_mutation() set search_path=public;
alter function public.set_payment_requests_updated_at() set search_path=public;
revoke all on function public.prevent_refund_mutation() from public,anon,authenticated;
revoke all on function public.prevent_wallet_transaction_mutation() from public,anon,authenticated;
revoke all on function public.set_payment_requests_updated_at() from public,anon,authenticated;
