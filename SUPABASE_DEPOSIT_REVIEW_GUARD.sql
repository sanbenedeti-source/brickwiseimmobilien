-- Apply after SUPABASE_DEPOSITS.sql and SUPABASE_DEPOSIT_REVIEW_AUDIT.sql.
-- review_deposit credits the wallet and then updates the submission in the same
-- transaction, so raising here also rolls back the credit.
-- * No admin may verify their own deposit.
-- * Admin accounts are never credited (same rule as manual wallet credits).
create or replace function public.guard_deposit_review() returns trigger
language plpgsql security definer set search_path=public as $$
begin
 if tg_op='INSERT' or (new.status='verified' and new.status is distinct from old.status) then
  if exists(select 1 from auth.users where id=new.user_id and raw_app_meta_data->>'role'='admin') then
   raise exception 'Admin accounts cannot be credited';
  end if;
 end if;
 if tg_op='UPDATE' and new.status='verified' and new.status is distinct from old.status
  and (new.reviewed_by is null or new.reviewed_by=new.user_id) then
  raise exception 'Deposit cannot be verified by its owner';
 end if;
 return new;
end $$;
revoke all on function public.guard_deposit_review() from public,anon,authenticated;
create or replace trigger deposit_review_guard before insert or update on public.deposit_submissions
 for each row execute function public.guard_deposit_review();
