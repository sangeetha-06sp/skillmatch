alter table public.users enable row level security;
alter table public.skills enable row level security;
alter table public.exchange_requests enable row level security;
alter table public.sessions enable row level security;
alter table public.wallets enable row level security;
alter table public.wallet_transactions enable row level security;
alter table public.notifications enable row level security;
alter table public.waitlists enable row level security;
alter table public.disputes enable row level security;

revoke all on public.users, public.skills, public.exchange_requests, public.sessions, public.wallets,
  public.wallet_transactions, public.notifications, public.waitlists, public.disputes
from anon, authenticated;

grant select on public.skills to anon, authenticated;
grant insert, update, delete on public.skills to authenticated;
grant select on public.exchange_requests, public.sessions, public.wallets,
  public.wallet_transactions, public.notifications, public.disputes to authenticated;
grant update (read_at) on public.notifications to authenticated;
grant insert (email, name, interests) on public.waitlists to anon, authenticated;
grant all on public.users, public.skills, public.exchange_requests, public.sessions, public.wallets,
  public.wallet_transactions, public.notifications, public.waitlists, public.disputes to service_role;

drop policy if exists "Public can read active skill listings" on public.skills;
create policy "Public can read active skill listings"
  on public.skills for select to anon, authenticated using (active = true);
drop policy if exists "Owners manage their listings" on public.skills;
create policy "Owners manage their listings"
  on public.skills for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "Users read their own profile" on public.users;
create policy "Users read their own profile"
  on public.users for select to authenticated using (id = auth.uid());
drop policy if exists "Users update their own profile" on public.users;
create policy "Users update their own profile"
  on public.users for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "Participants read exchange requests" on public.exchange_requests;
create policy "Participants read exchange requests"
  on public.exchange_requests for select to authenticated
  using (requester_id = auth.uid() or recipient_id = auth.uid());
drop policy if exists "Requesters create their own requests" on public.exchange_requests;
create policy "Requesters create their own requests"
  on public.exchange_requests for insert to authenticated with check (requester_id = auth.uid());
drop policy if exists "Participants update exchange requests" on public.exchange_requests;
create policy "Participants update exchange requests"
  on public.exchange_requests for update to authenticated
  using (requester_id = auth.uid() or recipient_id = auth.uid())
  with check (requester_id = auth.uid() or recipient_id = auth.uid());

drop policy if exists "Participants read sessions" on public.sessions;
create policy "Participants read sessions"
  on public.sessions for select to authenticated using (auth.uid() = any(participants));
drop policy if exists "Participants create sessions" on public.sessions;
create policy "Participants create sessions"
  on public.sessions for insert to authenticated with check (auth.uid() = any(participants));

drop policy if exists "Users read their own wallet" on public.wallets;
create policy "Users read their own wallet"
  on public.wallets for select to authenticated using (user_id = auth.uid());
drop policy if exists "Users read their own wallet transactions" on public.wallet_transactions;
create policy "Users read their own wallet transactions"
  on public.wallet_transactions for select to authenticated using (user_id = auth.uid());

drop policy if exists "Users read their own notifications" on public.notifications;
create policy "Users read their own notifications"
  on public.notifications for select to authenticated using (user_id = auth.uid());
drop policy if exists "Users update their own notifications" on public.notifications;
create policy "Users update their own notifications"
  on public.notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "Anyone can join the waitlist" on public.waitlists;
create policy "Anyone can join the waitlist"
  on public.waitlists for insert to anon, authenticated with check (true);

drop policy if exists "Dispute participants can read disputes" on public.disputes;
create policy "Dispute participants can read disputes"
  on public.disputes for select to authenticated using (
    opened_by = auth.uid()
    or exists (
      select 1 from public.sessions
      where sessions.id = disputes.session_id and auth.uid() = any(sessions.participants)
    )
  );
drop policy if exists "Participants can open disputes" on public.disputes;
create policy "Participants can open disputes"
  on public.disputes for insert to authenticated with check (
    opened_by = auth.uid()
    and exists (
      select 1 from public.sessions
      where sessions.id = disputes.session_id and auth.uid() = any(sessions.participants)
    )
  );

revoke all on function public.confirm_session_completion(uuid, uuid) from public, anon, authenticated;
revoke all on function public.schedule_exchange_session(uuid, uuid, timestamptz, integer, text, text, text) from public, anon, authenticated;
revoke all on function public.cancel_scheduled_session(uuid, uuid) from public, anon, authenticated;
revoke all on function public.open_session_dispute(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.admin_platform_stats() from public, anon, authenticated;
revoke all on function public.skillbridge_schema_health_check() from public, anon, authenticated;
grant execute on function public.confirm_session_completion(uuid, uuid) to service_role;
grant execute on function public.schedule_exchange_session(uuid, uuid, timestamptz, integer, text, text, text) to service_role;
grant execute on function public.cancel_scheduled_session(uuid, uuid) to service_role;
grant execute on function public.open_session_dispute(uuid, uuid, text) to service_role;
grant execute on function public.admin_platform_stats() to service_role;
grant execute on function public.skillbridge_schema_health_check() to service_role;
