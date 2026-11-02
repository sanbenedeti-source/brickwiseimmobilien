-- Migration 033: admin management of client investments (2026-11-02).
-- admin_add_shares: give a client shares, paid from their wallet or recorded as paid outside the wallet.
-- admin_buy_back_shares: take shares back, credit the wallet, release the shares; can close a sale request.
-- admin_adjust_wallet: correct a wallet up or down with a reason.
-- Each runs in one transaction, is idempotent per client key, verified-admin (aal2) only, and audited.
-- A sale request can no longer be marked completed without the buy-back that moves shares and money.

create or replace function public.admin_add_shares(p_user_id uuid, p_property_slug text, p_shares integer, p_price_per_share numeric, p_payment text, p_note text, p_client_key uuid)
 returns uuid
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare existing public.wallet_transactions%rowtype; v_key text := 'admin-shares:' || coalesce(p_client_key::text, '');
  clean_note text := nullif(btrim(coalesce(p_note, '')), ''); v_amount numeric(14,2); v_balance numeric(14,2);
  v_total integer; v_blocked integer; tx uuid; payment_tx uuid; actor_email text;
begin
  if not public.is_verified_admin() then raise exception 'INVEST_ADMIN_REQUIRED'; end if;
  if p_user_id is null or p_client_key is null or p_property_slug is null or p_shares is null or p_shares < 1 or p_shares > 1000000
    or p_price_per_share is null or p_price_per_share <= 0 or p_price_per_share > 100000000 or p_price_per_share <> round(p_price_per_share, 2)
    or p_payment is null or p_payment not in ('wallet', 'external') then raise exception 'INVEST_INVALID'; end if;
  if clean_note is null or char_length(clean_note) not between 3 and 300 or clean_note ~ '[[:cntrl:]]' then raise exception 'INVEST_NOTE_INVALID'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_key, 0));
  select * into existing from public.wallet_transactions where idempotency_key = v_key;
  if found then
    if existing.user_id <> p_user_id or existing.property_slug is distinct from p_property_slug or existing.shares is distinct from p_shares then raise exception 'INVEST_KEY_REUSED'; end if;
    return existing.id;
  end if;
  perform 1 from auth.users where id = p_user_id and coalesce(raw_app_meta_data->>'role', '') <> 'admin';
  if not found then raise exception 'INVEST_CLIENT_INVALID'; end if;

  v_amount := round(p_shares * p_price_per_share, 2);
  -- Same lock order as the client purchase: wallet, share availability, holding.
  insert into public.wallet_accounts(user_id, currency, balance) values (p_user_id, 'EUR', 0) on conflict (user_id) do nothing;
  select balance into v_balance from public.wallet_accounts where user_id = p_user_id for update;
  select total_shares, blocked_shares into v_total, v_blocked from public.property_share_settings where property_slug = p_property_slug for update;
  if v_total is null or v_total - v_blocked < p_shares then raise exception 'INVEST_INSUFFICIENT_SHARES'; end if;
  if p_payment = 'wallet' and v_balance < v_amount then raise exception 'INVEST_INSUFFICIENT_FUNDS'; end if;

  -- Paid outside the wallet: the payment and the purchase both appear in the statement and net to zero.
  if p_payment = 'external' then
    insert into public.wallet_transactions(user_id, type, direction, amount, currency, property_slug, shares, reference_type, idempotency_key, created_by, metadata)
    values (p_user_id, 'credit', 'credit', v_amount, 'EUR', p_property_slug, p_shares, 'external_payment', v_key || ':payment', auth.uid(), jsonb_build_object('note', clean_note))
    returning id into payment_tx;
  end if;
  insert into public.wallet_transactions(user_id, type, direction, amount, currency, property_slug, shares, reference_type, reference_id, idempotency_key, created_by, metadata)
  values (p_user_id, 'purchase', 'debit', v_amount, 'EUR', p_property_slug, p_shares, 'admin_purchase', payment_tx::text, v_key, auth.uid(),
    jsonb_build_object('note', clean_note, 'payment', p_payment, 'pricePerShare', p_price_per_share))
  returning id into tx;
  if p_payment = 'wallet' then
    update public.wallet_accounts set balance = balance - v_amount, updated_at = now() where user_id = p_user_id;
  end if;
  update public.property_share_settings set blocked_shares = blocked_shares + p_shares, updated_at = now() where property_slug = p_property_slug;
  insert into public.property_holdings(user_id, property_slug, shares, invested_amount, currency) values (p_user_id, p_property_slug, p_shares, v_amount, 'EUR')
  on conflict (user_id, property_slug) do update set shares = public.property_holdings.shares + excluded.shares,
    invested_amount = public.property_holdings.invested_amount + excluded.invested_amount, updated_at = now();

  select email into actor_email from auth.users where id = auth.uid();
  insert into public.admin_audit_logs(actor_id, actor_email, action, target_type, target_id, status, details)
  values (auth.uid(), actor_email, 'investment.add_shares', 'user', p_user_id::text, 'success',
    jsonb_build_object('propertySlug', p_property_slug, 'shares', p_shares, 'pricePerShare', p_price_per_share, 'amount', v_amount, 'payment', p_payment, 'note', clean_note, 'transactionId', tx));
  return tx;
end;
$function$;

create or replace function public.admin_buy_back_shares(p_user_id uuid, p_property_slug text, p_shares integer, p_price_per_share numeric, p_note text, p_client_key uuid, p_sale_request_id uuid default null)
 returns uuid
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare existing public.wallet_transactions%rowtype; request public.share_sale_requests%rowtype; v_key text := 'admin-buyback:' || coalesce(p_client_key::text, '');
  clean_note text := nullif(btrim(coalesce(p_note, '')), ''); held integer; invested numeric(14,2); v_amount numeric(14,2); v_cost numeric(14,2);
  tx uuid; actor_email text; previous_guard text;
begin
  if not public.is_verified_admin() then raise exception 'BUYBACK_ADMIN_REQUIRED'; end if;
  if p_user_id is null or p_client_key is null or p_property_slug is null or p_shares is null or p_shares < 1 or p_shares > 1000000
    or p_price_per_share is null or p_price_per_share <= 0 or p_price_per_share > 100000000 or p_price_per_share <> round(p_price_per_share, 2) then raise exception 'BUYBACK_INVALID'; end if;
  if clean_note is null or char_length(clean_note) not between 3 and 300 or clean_note ~ '[[:cntrl:]]' then raise exception 'BUYBACK_NOTE_INVALID'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_key, 0));
  select * into existing from public.wallet_transactions where idempotency_key = v_key;
  if found then
    if existing.user_id <> p_user_id or existing.property_slug is distinct from p_property_slug or existing.shares is distinct from p_shares then raise exception 'BUYBACK_KEY_REUSED'; end if;
    return existing.id;
  end if;
  perform 1 from auth.users where id = p_user_id and coalesce(raw_app_meta_data->>'role', '') <> 'admin';
  if not found then raise exception 'BUYBACK_CLIENT_INVALID'; end if;
  if p_sale_request_id is not null then
    select * into request from public.share_sale_requests where id = p_sale_request_id for update;
    if not found or request.user_id <> p_user_id or request.property_slug <> p_property_slug or request.status not in ('pending', 'in_review') or p_shares > request.shares then
      raise exception 'BUYBACK_REQUEST_INVALID';
    end if;
  end if;

  v_amount := round(p_shares * p_price_per_share, 2);
  insert into public.wallet_accounts(user_id, currency, balance) values (p_user_id, 'EUR', 0) on conflict (user_id) do nothing;
  perform 1 from public.wallet_accounts where user_id = p_user_id for update;
  perform 1 from public.property_share_settings where property_slug = p_property_slug for update;
  if not found then raise exception 'BUYBACK_INVALID'; end if;
  select shares, invested_amount into held, invested from public.property_holdings where user_id = p_user_id and property_slug = p_property_slug for update;
  if not found or held < p_shares then raise exception 'BUYBACK_INSUFFICIENT_SHARES'; end if;

  -- The invested amount shrinks in proportion to the shares that leave the holding.
  v_cost := case when p_shares = held then invested else round(invested * p_shares / held, 2) end;
  if p_shares = held then
    delete from public.property_holdings where user_id = p_user_id and property_slug = p_property_slug;
  else
    update public.property_holdings set shares = shares - p_shares, invested_amount = invested_amount - v_cost, updated_at = now()
      where user_id = p_user_id and property_slug = p_property_slug;
  end if;
  -- Releasing reserved shares is allowed only inside this guarded section.
  previous_guard := current_setting('brickwise.share_settings_edit', true);
  perform set_config('brickwise.share_settings_edit', p_property_slug, true);
  update public.property_share_settings set blocked_shares = blocked_shares - p_shares, updated_at = now() where property_slug = p_property_slug;
  perform set_config('brickwise.share_settings_edit', coalesce(previous_guard, ''), true);

  insert into public.wallet_transactions(user_id, type, direction, amount, currency, property_slug, shares, reference_type, reference_id, idempotency_key, created_by, metadata)
  values (p_user_id, 'credit', 'credit', v_amount, 'EUR', p_property_slug, p_shares, 'share_buyback', p_sale_request_id::text, v_key, auth.uid(),
    jsonb_build_object('note', clean_note, 'pricePerShare', p_price_per_share, 'costBasis', v_cost))
  returning id into tx;
  update public.wallet_accounts set balance = balance + v_amount, updated_at = now() where user_id = p_user_id;

  if p_sale_request_id is not null then
    update public.share_sale_requests set status = 'completed', admin_note = clean_note, updated_by = auth.uid(), updated_at = now() where id = request.id;
    perform public.notify_client(p_user_id, 'sale_request_updated', jsonb_build_object('requestId', request.id, 'propertySlug', p_property_slug,
      'shares', p_shares, 'status', 'completed', 'note', clean_note, 'amount', v_amount));
  end if;
  select email into actor_email from auth.users where id = auth.uid();
  insert into public.admin_audit_logs(actor_id, actor_email, action, target_type, target_id, status, details)
  values (auth.uid(), actor_email, 'investment.buy_back', 'user', p_user_id::text, 'success',
    jsonb_build_object('propertySlug', p_property_slug, 'shares', p_shares, 'pricePerShare', p_price_per_share, 'amount', v_amount, 'costBasis', v_cost,
      'saleRequestId', p_sale_request_id, 'note', clean_note, 'transactionId', tx));
  return tx;
end;
$function$;

create or replace function public.admin_adjust_wallet(p_user_id uuid, p_amount numeric, p_direction text, p_note text, p_client_key uuid)
 returns uuid
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare existing public.wallet_transactions%rowtype; v_key text := 'admin-adjust:' || coalesce(p_client_key::text, '');
  clean_note text := nullif(btrim(coalesce(p_note, '')), ''); v_balance numeric(14,2); tx uuid; actor_email text;
begin
  if not public.is_verified_admin() then raise exception 'ADJUST_ADMIN_REQUIRED'; end if;
  if p_user_id is null or p_client_key is null or p_direction is null or p_direction not in ('credit', 'debit')
    or p_amount is null or p_amount <= 0 or p_amount > 1000000 or p_amount <> round(p_amount, 2) then raise exception 'ADJUST_INVALID'; end if;
  if clean_note is null or char_length(clean_note) not between 3 and 300 or clean_note ~ '[[:cntrl:]]' then raise exception 'ADJUST_NOTE_INVALID'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_key, 0));
  select * into existing from public.wallet_transactions where idempotency_key = v_key;
  if found then
    if existing.user_id <> p_user_id or existing.amount <> p_amount or existing.direction <> p_direction then raise exception 'ADJUST_KEY_REUSED'; end if;
    return existing.id;
  end if;
  perform 1 from auth.users where id = p_user_id and coalesce(raw_app_meta_data->>'role', '') <> 'admin';
  if not found then raise exception 'ADJUST_CLIENT_INVALID'; end if;
  insert into public.wallet_accounts(user_id, currency, balance) values (p_user_id, 'EUR', 0) on conflict (user_id) do nothing;
  select balance into v_balance from public.wallet_accounts where user_id = p_user_id for update;
  if p_direction = 'debit' and v_balance < p_amount then raise exception 'ADJUST_INSUFFICIENT_FUNDS'; end if;
  insert into public.wallet_transactions(user_id, type, direction, amount, currency, reference_type, idempotency_key, created_by, metadata)
  values (p_user_id, 'adjustment', p_direction, p_amount, 'EUR', 'admin_adjustment', v_key, auth.uid(), jsonb_build_object('note', clean_note))
  returning id into tx;
  update public.wallet_accounts set balance = balance + case when p_direction = 'credit' then p_amount else -p_amount end, updated_at = now() where user_id = p_user_id;
  select email into actor_email from auth.users where id = auth.uid();
  insert into public.admin_audit_logs(actor_id, actor_email, action, target_type, target_id, status, details)
  values (auth.uid(), actor_email, 'wallet.adjust', 'user', p_user_id::text, 'success',
    jsonb_build_object('direction', p_direction, 'amount', p_amount, 'note', clean_note, 'transactionId', tx));
  return tx;
end;
$function$;

-- Completing a sale must move shares and money, so it goes through admin_buy_back_shares.
create or replace function public.update_share_sale_request(p_id uuid, p_status text, p_note text)
 returns uuid
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare request public.share_sale_requests%rowtype; actor_email text;
  clean_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if not public.is_verified_admin() then raise exception 'SALE_ADMIN_REQUIRED'; end if;
  if p_status is null or p_status not in ('in_review', 'completed', 'cancelled') then raise exception 'SALE_STATUS_INVALID'; end if;
  if p_status = 'completed' then raise exception 'SALE_USE_BUYBACK'; end if;
  if clean_note is null or char_length(clean_note) not between 3 and 1000 then raise exception 'SALE_NOTE_INVALID'; end if;
  select * into request from public.share_sale_requests where id = p_id for update;
  if not found then raise exception 'SALE_NOT_FOUND'; end if;
  if request.status = p_status then return request.id; end if;
  if request.status in ('completed', 'cancelled') or (request.status = 'in_review' and p_status = 'in_review') then
    raise exception 'SALE_ALREADY_CLOSED';
  end if;
  update public.share_sale_requests set status = p_status, admin_note = clean_note, updated_by = auth.uid(), updated_at = now()
    where id = request.id;
  select email into actor_email from auth.users where id = auth.uid();
  insert into public.admin_audit_logs(actor_id, actor_email, action, target_type, target_id, status, details)
  values (auth.uid(), actor_email, 'share_sale.update', 'share_sale_request', request.id::text, 'success',
    jsonb_build_object('status', p_status, 'userId', request.user_id, 'propertySlug', request.property_slug, 'shares', request.shares, 'note', clean_note));
  perform public.notify_client(request.user_id, 'sale_request_updated', jsonb_build_object('requestId', request.id,
    'propertySlug', request.property_slug, 'shares', request.shares, 'status', p_status, 'note', clean_note));
  return request.id;
end;
$function$;

revoke all on function public.admin_add_shares(uuid, text, integer, numeric, text, text, uuid) from public, anon, authenticated, service_role;
revoke all on function public.admin_buy_back_shares(uuid, text, integer, numeric, text, uuid, uuid) from public, anon, authenticated, service_role;
revoke all on function public.admin_adjust_wallet(uuid, numeric, text, text, uuid) from public, anon, authenticated, service_role;
grant execute on function public.admin_add_shares(uuid, text, integer, numeric, text, text, uuid) to authenticated;
grant execute on function public.admin_buy_back_shares(uuid, text, integer, numeric, text, uuid, uuid) to authenticated;
grant execute on function public.admin_adjust_wallet(uuid, numeric, text, text, uuid) to authenticated;

notify pgrst, 'reload schema';
