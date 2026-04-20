-- Band Scheduler schema
-- Run once in Supabase SQL Editor after creating the project.

create extension if not exists pgcrypto;

-- ------------- tables -------------

create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  password_hash text not null,
  start_date date not null,
  end_date date not null,
  slot_start_hour int not null default 18,
  slot_end_hour int not null default 22,
  exclude_holidays boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists participants (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  nickname text not null,
  instruments text[] not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists participants_event_idx on participants(event_id);

create table if not exists availability (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references participants(id) on delete cascade,
  date date not null,
  status text not null check (status in ('yes','maybe','no')),
  unique (participant_id, date)
);

create table if not exists songs (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  picked_by text not null,
  title text not null,
  artist text,
  youtube_url text,
  source text not null default 'pick',
  created_at timestamptz not null default now()
);
create index if not exists songs_event_idx on songs(event_id);

create table if not exists song_votes (
  id uuid primary key default gen_random_uuid(),
  song_id uuid not null references songs(id) on delete cascade,
  voter text not null,
  created_at timestamptz not null default now(),
  unique (song_id, voter)
);

-- ------------- RLS -------------

alter table events enable row level security;
alter table participants enable row level security;
alter table availability enable row level security;
alter table songs enable row level security;
alter table song_votes enable row level security;

-- Helper: current event_id from JWT claim (set by our edge functions)
create or replace function public.event_id_claim() returns uuid
language sql stable as $$
  select nullif(auth.jwt() ->> 'event_id', '')::uuid
$$;

-- events: SELECT only for matching claim. Writes only through service role
-- (edge functions). Password hash is in this table, so only allow SELECT of
-- safe columns via client; we don't expose password_hash in any client query.
drop policy if exists events_select on events;
create policy events_select on events for select
  using (id = public.event_id_claim());

-- participants
drop policy if exists participants_select on participants;
drop policy if exists participants_insert on participants;
drop policy if exists participants_update on participants;
drop policy if exists participants_delete on participants;
create policy participants_select on participants for select
  using (event_id = public.event_id_claim());
create policy participants_insert on participants for insert
  with check (event_id = public.event_id_claim());
create policy participants_update on participants for update
  using (event_id = public.event_id_claim())
  with check (event_id = public.event_id_claim());
create policy participants_delete on participants for delete
  using (event_id = public.event_id_claim());

-- availability
drop policy if exists availability_select on availability;
drop policy if exists availability_insert on availability;
drop policy if exists availability_update on availability;
drop policy if exists availability_delete on availability;
create policy availability_select on availability for select
  using (exists (
    select 1 from participants p
    where p.id = availability.participant_id
      and p.event_id = public.event_id_claim()
  ));
create policy availability_insert on availability for insert
  with check (exists (
    select 1 from participants p
    where p.id = availability.participant_id
      and p.event_id = public.event_id_claim()
  ));
create policy availability_update on availability for update
  using (exists (
    select 1 from participants p
    where p.id = availability.participant_id
      and p.event_id = public.event_id_claim()
  ));
create policy availability_delete on availability for delete
  using (exists (
    select 1 from participants p
    where p.id = availability.participant_id
      and p.event_id = public.event_id_claim()
  ));

-- songs
drop policy if exists songs_select on songs;
drop policy if exists songs_insert on songs;
drop policy if exists songs_delete on songs;
create policy songs_select on songs for select
  using (event_id = public.event_id_claim());
create policy songs_insert on songs for insert
  with check (event_id = public.event_id_claim());
create policy songs_delete on songs for delete
  using (event_id = public.event_id_claim());

-- song_votes
drop policy if exists song_votes_select on song_votes;
drop policy if exists song_votes_insert on song_votes;
drop policy if exists song_votes_delete on song_votes;
create policy song_votes_select on song_votes for select
  using (exists (
    select 1 from songs s
    where s.id = song_votes.song_id
      and s.event_id = public.event_id_claim()
  ));
create policy song_votes_insert on song_votes for insert
  with check (exists (
    select 1 from songs s
    where s.id = song_votes.song_id
      and s.event_id = public.event_id_claim()
  ));
create policy song_votes_delete on song_votes for delete
  using (exists (
    select 1 from songs s
    where s.id = song_votes.song_id
      and s.event_id = public.event_id_claim()
  ));
