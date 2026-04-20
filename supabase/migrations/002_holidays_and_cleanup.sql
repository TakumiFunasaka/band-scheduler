-- Adds: exclude_holidays flag on events, 1-year cleanup cron.
-- Run in Supabase SQL Editor after the initial schema.sql.

alter table events
  add column if not exists exclude_holidays boolean not null default false;

-- ------------- 1-year cleanup -------------

create extension if not exists pg_cron with schema extensions;

-- Clean up events older than 1 year every day at 03:00 UTC (12:00 JST).
-- participants / availability / songs / song_votes are cascaded via FK.
select cron.schedule(
  'band_scheduler_cleanup',
  '0 3 * * *',
  $$delete from public.events where created_at < now() - interval '1 year'$$
);
