-- Migration 022: database-level two-factor check for every admin operation (2026-10-25).
-- Admin MFA is enforced in the app since 2026-10-24. These functions and policies still trusted the
-- admin role alone, so a stolen admin password (a session without the second factor) could call them
-- directly through the API. They now require public.is_verified_admin(): role admin AND aal2.

create or replace function public.is_client_agreement_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_verified_admin();
$$;

create or replace function public.review_client_agreement(p_id uuid, p_decision text, p_note text default null::text)
returns uuid language plpgsql security definer set search_path to '' as $function$
declare
  actor_id uuid := auth.uid();
  actor_email text;
  acceptance public.client_agreement_acceptances%rowtype;
  normalized_note text := nullif(regexp_replace(p_note, '^[[:space:]]+|[[:space:]]+$', '', 'g'), '');
begin
  if not public.is_verified_admin() then
    raise exception 'AGREEMENT_ADMIN_REQUIRED';
  end if;
  select email into actor_email from auth.users where id = actor_id;
  if p_decision is null or p_decision not in ('approved', 'rejected') then
    raise exception 'AGREEMENT_REVIEW_DECISION_INVALID';
  end if;
  if normalized_note is null or char_length(normalized_note) not between 3 and 1000 then
    raise exception 'AGREEMENT_REVIEW_NOTE_INVALID';
  end if;
  select * into acceptance from public.client_agreement_acceptances
    where id = p_id for update;
  if not found then
    raise exception 'AGREEMENT_ACCEPTANCE_NOT_FOUND';
  end if;
  if acceptance.status = p_decision then
    return acceptance.id;
  end if;
  if acceptance.status <> 'pending' then
    raise exception 'AGREEMENT_ALREADY_REVIEWED';
  end if;
  update public.client_agreement_acceptances
    set status = p_decision, reviewed_by = actor_id,
        reviewed_at = clock_timestamp(), review_note = normalized_note
    where id = acceptance.id;
  -- An audit insertion failure aborts the status update in the same transaction.
  insert into public.admin_audit_logs (
    actor_id, actor_email, action, target_type, target_id, status, details
  ) values (
    actor_id, actor_email, 'agreement.review', 'client_agreement_acceptance', acceptance.id::text,
    'success', jsonb_build_object('decision', p_decision, 'userId', acceptance.user_id,
      'version', acceptance.version, 'locale', acceptance.locale,
      'documentSha256', acceptance.document_sha256, 'isDraft', acceptance.is_draft,
      'note', normalized_note)
  );
  return acceptance.id;
end;
$function$;

create or replace function public.review_deposit(p_id uuid, p_approve boolean, p_eur numeric, p_settlement text, p_note text)
returns uuid language plpgsql security definer set search_path to 'public' as $function$
declare d deposit_submissions; tx uuid; customer_email text; customer_name text;
begin
 if auth.uid() is null or not public.is_verified_admin() then raise exception 'Admin required'; end if;
 if p_approve is null then raise exception 'Decision required'; end if;
 select * into d from deposit_submissions where id=p_id for update;
 if not found then raise exception 'Deposit not found'; end if;
 if d.status<>'pending' then return d.transaction_id; end if;
 if p_note is null or length(trim(p_note)) not between 3 and 1000 then raise exception 'Review note required'; end if;
 if p_approve then
  if p_eur is null or p_eur<=0 or p_eur>10000000 or p_eur<>round(p_eur,2) or p_eur::text in ('NaN','Infinity','-Infinity') or p_settlement is null or length(trim(p_settlement)) not between 4 and 200 then raise exception 'Confirmed amount and settlement reference required'; end if;
  select email,raw_user_meta_data->>'full_name' into customer_email,customer_name from auth.users where id=d.user_id;
  tx:=public.credit_wallet_atomic(d.user_id,p_eur,'EUR',auth.uid(),customer_email,customer_name,'deposit:'||d.id::text);
  update deposit_submissions set status='verified',credited_eur=p_eur,settlement_reference=trim(p_settlement),transaction_id=tx,review_note=trim(p_note),reviewed_by=auth.uid(),reviewed_at=now() where id=d.id;
 else
  update deposit_submissions set status='rejected',review_note=trim(p_note),reviewed_by=auth.uid(),reviewed_at=now() where id=d.id;
 end if;
 return tx;
end $function$;

create or replace function public.refund_payment_atomic(p_payment_id uuid, p_reference text, p_note text)
returns uuid language plpgsql security definer set search_path to 'public' as $function$
declare p payment_requests; c wallet_transactions; r payment_refunds; debit uuid; result uuid; available numeric; actor_email text;
begin
 if auth.uid() is null or not public.is_verified_admin() then raise exception 'Admin required'; end if;
 if p_reference is null or length(trim(p_reference)) not between 4 and 200 or p_note is null or length(trim(p_note)) not between 3 and 1000 then raise exception 'External refund reference and note required'; end if;
 select * into p from payment_requests where id=p_payment_id for update;
 if not found then raise exception 'Payment not found'; end if;
 select * into r from payment_refunds where payment_id=p.id;
 if found then
  if lower(r.external_reference)<>lower(trim(p_reference)) then raise exception 'Already refunded with another reference'; end if;
  return r.id;
 end if;
 if p.status not in ('paid','verified') or p.currency<>'EUR' then raise exception 'Only received EUR payments can be refunded'; end if;
 if p.method='wallet_credit' and p.credit_transaction_id is null then raise exception 'Original wallet credit is not linked'; end if;
 if p.credit_transaction_id is not null then
  select * into c from wallet_transactions where id=p.credit_transaction_id;
  if not found or c.user_id is distinct from p.user_id or c.amount<>p.amount or c.currency<>'EUR' or c.type<>'credit' or c.direction<>'credit' then raise exception 'Invalid original credit'; end if;
  select balance into available from wallet_accounts where user_id=p.user_id for update;
  if available is null or available<p.amount then raise exception 'insufficient_refund_balance'; end if;
  insert into wallet_transactions(user_id,type,direction,amount,currency,reference_type,reference_id,idempotency_key,created_by,metadata)
  values(p.user_id,'refund','debit',p.amount,'EUR','payment_refund',p.id::text,'refund:'||p.id::text,auth.uid(),jsonb_build_object('original_credit_id',c.id,'external_reference',trim(p_reference))) returning id into debit;
  update wallet_accounts set balance=balance-p.amount,updated_at=now() where user_id=p.user_id;
 end if;
 insert into payment_refunds(payment_id,user_id,amount,currency,credit_transaction_id,debit_transaction_id,external_reference,note,actor_id)
 values(p.id,p.user_id,p.amount,'EUR',p.credit_transaction_id,debit,trim(p_reference),trim(p_note),auth.uid()) returning id into result;
 update payment_requests set status='refunded' where id=p.id;
 update deposit_submissions set status='refunded' where transaction_id=p.credit_transaction_id and status='verified';
 select email into actor_email from auth.users where id=auth.uid();
 insert into admin_audit_logs(actor_id,actor_email,action,target_type,target_id,status,details)
 values(auth.uid(),actor_email,'payment.refund','payment_request',p.id::text,'success',jsonb_build_object('refund_id',result,'amount',p.amount,'currency','EUR','debit_transaction_id',debit,'external_reference',trim(p_reference)));
 return result;
end $function$;

-- Client data the admin pages read: only a verified (two-factor) admin session sees other clients' rows.
alter policy "Read own deposits or admin" on public.deposit_submissions
  using ((user_id = (select auth.uid())) or (select public.is_verified_admin()));
alter policy "Read own refunds or admin" on public.payment_refunds
  using ((user_id = (select auth.uid())) or (select public.is_verified_admin()));
alter policy "Role administrators read property requests" on public.property_requests
  using ((select public.is_verified_admin()));
alter policy "Role administrators update request status" on public.property_requests
  using ((select public.is_verified_admin()))
  with check ((select public.is_verified_admin()) and status = any (array['new'::text, 'contacted'::text, 'closed'::text]));
alter policy "Clients read active company payment methods" on public.company_payment_methods
  using (((select auth.uid()) is not null) and (active or (select public.is_verified_admin())));

notify pgrst, 'reload schema';
