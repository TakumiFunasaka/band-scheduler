-- Adds per-song comment threads.
-- Run in Supabase SQL Editor.

create table if not exists song_comments (
  id uuid primary key default gen_random_uuid(),
  song_id uuid not null references songs(id) on delete cascade,
  commenter text not null,
  body text not null,
  created_at timestamptz not null default now()
);
create index if not exists song_comments_song_idx on song_comments(song_id);

alter table song_comments enable row level security;

drop policy if exists song_comments_select on song_comments;
drop policy if exists song_comments_insert on song_comments;
drop policy if exists song_comments_delete on song_comments;

create policy song_comments_select on song_comments for select
  using (exists (
    select 1 from songs s
    where s.id = song_comments.song_id
      and s.event_id = public.event_id_claim()
  ));
create policy song_comments_insert on song_comments for insert
  with check (exists (
    select 1 from songs s
    where s.id = song_comments.song_id
      and s.event_id = public.event_id_claim()
  ));
create policy song_comments_delete on song_comments for delete
  using (exists (
    select 1 from songs s
    where s.id = song_comments.song_id
      and s.event_id = public.event_id_claim()
  ));
