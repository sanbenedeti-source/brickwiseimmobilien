create or replace function public.audit_deposit_review() returns trigger
language plpgsql security definer set search_path=public as $$
declare actor_email text;
begin
 if new.status in ('verified','rejected') and new.status is distinct from old.status then
  select email into actor_email from auth.users where id=new.reviewed_by and raw_app_meta_data->>'role'='admin';
  if not found then raise exception 'Trusted deposit reviewer required'; end if;
  insert into admin_audit_logs(actor_id,actor_email,action,target_type,target_id,status,details)
  values(new.reviewed_by,actor_email,'deposit.review','deposit_submission',new.id::text,'success',jsonb_build_object('decision',new.status,'credited_eur',new.credited_eur,'transaction_id',new.transaction_id));
 end if;
 return new;
end $$;
drop trigger if exists deposit_review_audit on public.deposit_submissions;
create trigger deposit_review_audit after update on public.deposit_submissions for each row execute function public.audit_deposit_review();
