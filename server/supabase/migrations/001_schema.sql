create extension if not exists pgcrypto;

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 80),
  email text not null unique check (char_length(email) <= 254),
  password_hash text not null,
  role text not null default 'user' check (role in ('user', 'admin')),
  bio text not null default '' check (char_length(bio) <= 1000),
  location text not null default '' check (char_length(location) <= 120),
  college text not null default '' check (char_length(college) <= 120),
  department text not null default '' check (char_length(department) <= 120),
  year text not null default '' check (char_length(year) <= 40),
  availability text not null default 'Flexible' check (availability in ('Flexible', 'Weekday evenings', 'Weekends')),
  interests text[] not null default '{}',
  skills_offered_text text[] not null default '{}',
  skills_wanted_text text[] not null default '{}',
  avatar_url text check (avatar_url is null or char_length(avatar_url) <= 500),
  rating_average numeric(3, 2) not null default 0 check (rating_average between 0 and 5),
  rating_count integer not null default 0 check (rating_count >= 0),
  token_version integer not null default 0 check (token_version >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists users_role_active_idx on public.users (role, is_active);
create index if not exists users_name_search_idx on public.users using gin (to_tsvector('simple', name));

create table if not exists public.skills (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.users(id) on delete cascade,
  title text not null check (char_length(title) between 3 and 100),
  description text not null check (char_length(description) between 10 and 2000),
  category text not null check (char_length(category) between 2 and 80),
  tags text[] not null default '{}',
  level text not null default 'intermediate' check (level in ('beginner', 'intermediate', 'advanced', 'expert')),
  type text not null default 'offer' check (type in ('offer', 'request')),
  mode text not null default 'either' check (mode in ('online', 'in-person', 'either')),
  location text not null default '' check (char_length(location) <= 120),
  availability text not null default 'Flexible' check (availability in ('Flexible', 'Weekday evenings', 'Weekends')),
  credits integer not null default 2 check (credits between 1 and 100),
  active boolean not null default true,
  search_document tsvector generated always as (
    to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(description, '') || ' ' || coalesce(category, '') || ' ' || array_to_string(tags, ' '))
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists skills_owner_idx on public.skills (owner_id);
create index if not exists skills_active_filters_idx on public.skills (active, type, category, level, mode, availability);
create index if not exists skills_created_at_idx on public.skills (created_at desc);
create index if not exists skills_search_idx on public.skills using gin (search_document);

create table if not exists public.exchange_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.users(id) on delete restrict,
  recipient_id uuid not null references public.users(id) on delete restrict,
  skill_id uuid not null references public.skills(id) on delete restrict,
  message text not null default '' check (char_length(message) <= 1000),
  payment_amount integer not null default 0 check (payment_amount between 0 and 100000),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected', 'cancelled', 'completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (requester_id <> recipient_id)
);

create index if not exists exchange_requests_requester_idx on public.exchange_requests (requester_id, created_at desc);
create index if not exists exchange_requests_recipient_idx on public.exchange_requests (recipient_id, created_at desc);
create index if not exists exchange_requests_skill_status_idx on public.exchange_requests (requester_id, skill_id, status);
create index if not exists exchange_requests_status_idx on public.exchange_requests (status, created_at desc);
create unique index if not exists exchange_requests_one_active_idx
  on public.exchange_requests (requester_id, skill_id) where status in ('pending', 'accepted');

create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique references public.exchange_requests(id) on delete restrict,
  participants uuid[] not null check (cardinality(participants) = 2),
  scheduled_at timestamptz not null,
  duration_minutes integer not null check (duration_minutes between 15 and 480),
  mode text not null default 'online' check (mode in ('online', 'in-person')),
  meeting_url text check (meeting_url is null or char_length(meeting_url) <= 500),
  notes text not null default '' check (char_length(notes) <= 2000),
  status text not null default 'scheduled' check (status in ('scheduled', 'in_progress', 'completed', 'disputed', 'cancelled')),
  confirmations uuid[] not null default '{}',
  payment_amount integer not null default 0 check (payment_amount between 0 and 100000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (cardinality(confirmations) <= 2),
  check (confirmations <@ participants)
);

create index if not exists sessions_participants_idx on public.sessions using gin (participants);
create index if not exists sessions_status_scheduled_idx on public.sessions (status, scheduled_at desc);

create table if not exists public.wallets (
  user_id uuid primary key references public.users(id) on delete restrict,
  balance integer not null default 0 check (balance >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete restrict,
  counterparty_id uuid references public.users(id) on delete restrict,
  amount integer not null check (amount > 0),
  direction text not null check (direction in ('credit', 'debit')),
  reason text not null check (reason in ('session_payment', 'seed', 'admin_adjustment', 'refund')),
  idempotency_key text not null,
  session_id uuid references public.sessions(id) on delete restrict,
  description text not null check (char_length(description) <= 200),
  created_at timestamptz not null default now(),
  unique (idempotency_key, direction)
);

create index if not exists wallet_transactions_user_idx on public.wallet_transactions (user_id, created_at desc);
create index if not exists wallet_transactions_session_idx on public.wallet_transactions (session_id);
create index if not exists wallet_transactions_reason_idx on public.wallet_transactions (reason, direction);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  type text not null check (char_length(type) <= 60),
  title text not null check (char_length(title) <= 120),
  message text not null check (char_length(message) <= 500),
  link text check (link is null or char_length(link) <= 300),
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_created_idx on public.notifications (user_id, created_at desc);
create index if not exists notifications_user_unread_idx on public.notifications (user_id) where read_at is null;

create table if not exists public.waitlists (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (char_length(email) <= 254),
  name text not null default '' check (char_length(name) <= 80),
  interests text[] not null default '{}',
  status text not null default 'pending' check (status in ('pending', 'invited', 'joined')),
  created_at timestamptz not null default now()
);

create index if not exists waitlists_status_created_idx on public.waitlists (status, created_at desc);

create table if not exists public.disputes (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null unique references public.sessions(id) on delete restrict,
  opened_by uuid not null references public.users(id) on delete restrict,
  reason text not null check (char_length(reason) between 10 and 2000),
  status text not null default 'open' check (status in ('open', 'under_review', 'resolved', 'dismissed')),
  resolution text check (resolution is null or char_length(resolution) <= 2000),
  resolved_by uuid references public.users(id) on delete restrict,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists disputes_status_created_idx on public.disputes (status, created_at desc);
create index if not exists disputes_opened_by_idx on public.disputes (opened_by, created_at desc);

create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array['users', 'skills', 'exchange_requests', 'sessions', 'wallets', 'disputes']
  loop
    execute format('drop trigger if exists touch_updated_at on public.%I', table_name);
    execute format('create trigger touch_updated_at before update on public.%I for each row execute function public.touch_updated_at()', table_name);
  end loop;
end;
$$;

create or replace function public.create_wallet_for_user()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into public.wallets (user_id) values (new.id) on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists create_wallet_for_user on public.users;
create trigger create_wallet_for_user after insert on public.users
for each row execute function public.create_wallet_for_user();

insert into public.wallets (user_id)
select id from public.users
on conflict (user_id) do nothing;
