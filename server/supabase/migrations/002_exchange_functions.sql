create or replace function public.confirm_session_completion(p_session_id uuid, p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_session public.sessions%rowtype;
  v_exchange public.exchange_requests%rowtype;
  v_payer_balance integer;
  v_idempotency_key text;
  v_has_debit boolean;
  v_has_credit boolean;
begin
  select * into v_session
  from public.sessions
  where id = p_session_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Session not found';
  end if;
  if not (p_user_id = any(v_session.participants)) then
    raise exception using errcode = '42501', message = 'Only a session participant can confirm completion';
  end if;
  if v_session.status in ('disputed', 'cancelled') then
    raise exception using errcode = 'P0001', message = 'This session cannot be completed';
  end if;

  if v_session.status <> 'completed' then
    if not (p_user_id = any(v_session.confirmations)) then
      v_session.confirmations := array_append(v_session.confirmations, p_user_id);
    end if;

    if cardinality(v_session.confirmations) = 2 then
      select * into v_exchange
      from public.exchange_requests
      where id = v_session.request_id
      for update;

      if not found or v_exchange.status <> 'accepted' then
        raise exception using errcode = 'P0001', message = 'The exchange is no longer active';
      end if;

      v_idempotency_key := 'session:' || v_session.id::text;
      select exists(select 1 from public.wallet_transactions where idempotency_key = v_idempotency_key and direction = 'debit'),
             exists(select 1 from public.wallet_transactions where idempotency_key = v_idempotency_key and direction = 'credit')
      into v_has_debit, v_has_credit;

      if v_has_debit <> v_has_credit then
        raise exception using errcode = 'P0001', message = 'Wallet ledger is inconsistent for this session';
      end if;

      if v_session.payment_amount > 0 and not v_has_debit then
        perform user_id
        from public.wallets
        where user_id in (v_exchange.requester_id, v_exchange.recipient_id)
        order by user_id
        for update;

        select balance into v_payer_balance
        from public.wallets where user_id = v_exchange.requester_id;
        if v_payer_balance is null or v_payer_balance < v_session.payment_amount then
          raise exception using errcode = 'P0001', message = 'Insufficient wallet balance';
        end if;

        update public.wallets
        set balance = balance - v_session.payment_amount
        where user_id = v_exchange.requester_id;
        update public.wallets
        set balance = balance + v_session.payment_amount
        where user_id = v_exchange.recipient_id;

        insert into public.wallet_transactions
          (user_id, counterparty_id, amount, direction, reason, idempotency_key, session_id, description)
        values
          (v_exchange.requester_id, v_exchange.recipient_id, v_session.payment_amount, 'debit', 'session_payment', v_idempotency_key, v_session.id, 'Peer session payment'),
          (v_exchange.recipient_id, v_exchange.requester_id, v_session.payment_amount, 'credit', 'session_payment', v_idempotency_key, v_session.id, 'Peer session payment');
      elsif v_session.payment_amount = 0 and v_has_debit then
        raise exception using errcode = 'P0001', message = 'Unexpected wallet ledger entries for a zero-cost session';
      end if;

      v_session.status := 'completed';
      update public.exchange_requests set status = 'completed' where id = v_exchange.id;
    end if;

    update public.sessions
    set confirmations = v_session.confirmations, status = v_session.status
    where id = v_session.id
    returning * into v_session;
  end if;

  return to_jsonb(v_session);
end;
$$;

create or replace function public.schedule_exchange_session(
  p_request_id uuid,
  p_user_id uuid,
  p_scheduled_at timestamptz,
  p_duration_minutes integer,
  p_mode text,
  p_meeting_url text,
  p_notes text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_exchange public.exchange_requests%rowtype;
  v_session public.sessions%rowtype;
begin
  select * into v_exchange
  from public.exchange_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Exchange request not found';
  end if;
  if p_user_id not in (v_exchange.requester_id, v_exchange.recipient_id) then
    raise exception using errcode = '42501', message = 'Only an exchange participant can schedule this session';
  end if;
  if v_exchange.status <> 'accepted' then
    raise exception using errcode = 'P0001', message = 'An accepted exchange request is required';
  end if;
  if p_scheduled_at <= now() then
    raise exception using errcode = '22023', message = 'A session must be scheduled for a future time';
  end if;

  insert into public.sessions
    (request_id, participants, scheduled_at, duration_minutes, mode, meeting_url, notes, payment_amount)
  values
    (v_exchange.id, array[v_exchange.requester_id, v_exchange.recipient_id], p_scheduled_at, p_duration_minutes, p_mode, p_meeting_url, p_notes, v_exchange.payment_amount)
  returning * into v_session;

  return to_jsonb(v_session);
end;
$$;

create or replace function public.cancel_scheduled_session(p_session_id uuid, p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_session public.sessions%rowtype;
begin
  select * into v_session
  from public.sessions
  where id = p_session_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Session not found';
  end if;
  if not (p_user_id = any(v_session.participants)) then
    raise exception using errcode = '42501', message = 'Only a session participant can cancel this session';
  end if;
  if v_session.status <> 'scheduled' or cardinality(v_session.confirmations) <> 0 then
    raise exception using errcode = 'P0001', message = 'Only unconfirmed scheduled sessions can be cancelled';
  end if;

  update public.sessions set status = 'cancelled' where id = v_session.id returning * into v_session;
  update public.exchange_requests set status = 'cancelled' where id = v_session.request_id and status = 'accepted';
  return to_jsonb(v_session);
end;
$$;

create or replace function public.open_session_dispute(p_session_id uuid, p_user_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_session public.sessions%rowtype;
  v_dispute public.disputes%rowtype;
begin
  select * into v_session
  from public.sessions
  where id = p_session_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Session not found';
  end if;
  if not (p_user_id = any(v_session.participants)) then
    raise exception using errcode = '42501', message = 'Only a session participant can open a dispute';
  end if;
  if v_session.status in ('completed', 'cancelled') then
    raise exception using errcode = 'P0001', message = 'Completed or cancelled sessions cannot be disputed';
  end if;
  if char_length(trim(p_reason)) < 10 or char_length(p_reason) > 2000 then
    raise exception using errcode = '22023', message = 'Dispute reason must be between 10 and 2000 characters';
  end if;

  insert into public.disputes (session_id, opened_by, reason)
  values (v_session.id, p_user_id, trim(p_reason))
  returning * into v_dispute;
  update public.sessions set status = 'disputed' where id = v_session.id;
  return to_jsonb(v_dispute);
end;
$$;

create or replace function public.admin_platform_stats()
returns jsonb
language sql
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'users', (select count(*) from public.users),
    'activeSkills', (select count(*) from public.skills where active = true),
    'requests', (select count(*) from public.exchange_requests),
    'sessions', (select count(*) from public.sessions),
    'openDisputes', (select count(*) from public.disputes where status in ('open', 'under_review')),
    'pendingWaitlist', (select count(*) from public.waitlists where status = 'pending'),
    'transferredCredits', coalesce((select sum(amount) from public.wallet_transactions where direction = 'debit' and reason = 'session_payment'), 0)
  );
$$;

create or replace function public.skillbridge_schema_health_check()
returns boolean
language sql
security definer
set search_path = public, pg_temp
as $$
  select
    to_regclass('public.users') is not null
    and to_regclass('public.skills') is not null
    and to_regclass('public.exchange_requests') is not null
    and to_regclass('public.sessions') is not null
    and to_regclass('public.wallets') is not null
    and to_regclass('public.wallet_transactions') is not null
    and to_regclass('public.notifications') is not null
    and to_regclass('public.waitlists') is not null
    and to_regclass('public.disputes') is not null
    and to_regprocedure('public.confirm_session_completion(uuid,uuid)') is not null
    and to_regprocedure('public.schedule_exchange_session(uuid,uuid,timestamptz,integer,text,text,text)') is not null
    and to_regprocedure('public.cancel_scheduled_session(uuid,uuid)') is not null
    and to_regprocedure('public.open_session_dispute(uuid,uuid,text)') is not null
    and to_regprocedure('public.admin_platform_stats()') is not null
    and (
      select count(*) = 9
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname in ('users', 'skills', 'exchange_requests', 'sessions', 'wallets', 'wallet_transactions', 'notifications', 'waitlists', 'disputes')
        and c.relrowsecurity
    )
    and (
      select count(distinct tablename) = 9
      from pg_policies
      where schemaname = 'public'
        and tablename in ('users', 'skills', 'exchange_requests', 'sessions', 'wallets', 'wallet_transactions', 'notifications', 'waitlists', 'disputes')
    );
$$;
