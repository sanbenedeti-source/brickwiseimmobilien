-- Migration 025: property profit payouts to one client (2026-10-26).
-- A verified (two-factor) admin credits a client's wallet with the profit of a property the client
-- holds; the amount depends on the property's actual income. The payout is a real ledger credit
-- (reference_type 'profit_payout'), shown to the client as property profit, refundable through the
-- existing refund tool, notified to the client and written to the audit log. A repeated request with
-- the same client key returns the first payout instead of paying twice.

create or replace function public.pay_client_profit(p_user_id uuid, p_property_slug text, p_amount numeric, p_note text, p_client_key uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare existing public.wallet_transactions%rowtype; held integer; tx uuid; actor_email text; customer_email text; customer_name text;
  clean_note text := nullif(btrim(coalesce(p_note, '')), ''); v_key text := 'profit:' || coalesce(p_client_key::text, '');
begin
  if not public.is_verified_admin() then raise exception 'PROFIT_ADMIN_REQUIRED'; end if;
  if p_user_id is null or p_client_key is null or p_property_slug is null then raise exception 'PROFIT_INVALID'; end if;
  if p_amount is null or p_amount <= 0 or p_amount > 1000000 or p_amount <> round(p_amount, 2) then raise exception 'PROFIT_AMOUNT_INVALID'; end if;
  if clean_note is not null and (char_length(clean_note) > 300 or clean_note ~ '[[:cntrl:]]') then raise exception 'PROFIT_NOTE_INVALID'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_key, 0));
  select * into existing from public.wallet_transactions where idempotency_key = v_key;
  if found then
    if existing.user_id <> p_user_id or existing.amount <> p_amount or existing.property_slug is distinct from p_property_slug then raise exception 'PROFIT_KEY_REUSED'; end if;
    return existing.id;
  end if;
  select email, raw_user_meta_data->>'full_name' into customer_email, customer_name from auth.users
    where id = p_user_id and coalesce(raw_app_meta_data->>'role', '') <> 'admin';
  if not found then raise exception 'PROFIT_CLIENT_INVALID'; end if;
  select shares into held from public.property_holdings where user_id = p_user_id and property_slug = p_property_slug;
  if not found or held is null or held <= 0 then raise exception 'PROFIT_NO_HOLDING'; end if;

  insert into public.wallet_accounts(user_id, currency, balance) values (p_user_id, 'EUR', 0) on conflict (user_id) do nothing;
  perform 1 from public.wallet_accounts where user_id = p_user_id for update;
  insert into public.wallet_transactions(user_id, type, direction, amount, currency, property_slug, shares, reference_type, idempotency_key, created_by, metadata)
  values (p_user_id, 'credit', 'credit', p_amount, 'EUR', p_property_slug, held, 'profit_payout', v_key, auth.uid(), jsonb_build_object('note', clean_note))
  returning id into tx;
  update public.wallet_accounts set balance = balance + p_amount, updated_at = now() where user_id = p_user_id;
  insert into public.payment_requests(user_id, customer_name, customer_email, title, amount, currency, method, status, instructions, admin_note, created_by, verified_by, verified_at, credit_transaction_id)
  values (p_user_id, nullif(customer_name, ''), lower(customer_email), '[Wallet credit] Property profit', p_amount, 'EUR', 'wallet_credit', 'verified',
    'Property profit credited to your wallet.', clean_note, auth.uid(), auth.uid(), now(), tx);
  -- The notification reuses the earnings kind; the interface shows it as property profit.
  perform public.notify_client(p_user_id, 'distribution_credited', jsonb_build_object('source', 'profit', 'amount', p_amount,
    'propertySlug', p_property_slug, 'note', clean_note, 'transactionId', tx));
  select email into actor_email from auth.users where id = auth.uid();
  insert into public.admin_audit_logs(actor_id, actor_email, action, target_type, target_id, status, details)
  values (auth.uid(), actor_email, 'profit.pay', 'user', p_user_id::text, 'success',
    jsonb_build_object('propertySlug', p_property_slug, 'amount', p_amount, 'shares', held, 'note', clean_note, 'transactionId', tx));
  return tx;
end;
$$;

revoke all on function public.pay_client_profit(uuid, text, numeric, text, uuid) from public, anon, authenticated, service_role;
grant execute on function public.pay_client_profit(uuid, text, numeric, text, uuid) to authenticated;

notify pgrst, 'reload schema';
