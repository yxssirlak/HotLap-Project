-- Run in the Supabase SQL Editor to enable track-test sprint recording and posted leaderboards.
create table if not exists public.sprint_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  username text not null,
  vehicle text not null,
  car_model text not null,
  distance_meters numeric(8, 2) not null check (distance_meters in (402.34, 804.67, 1609.34)),
  elapsed_seconds numeric(9, 3) not null check (elapsed_seconds > 0),
  top_speed_kmh numeric(8, 2) not null check (top_speed_kmh >= 0),
  average_speed_kmh numeric(8, 2) not null check (average_speed_kmh >= 0),
  peak_g numeric(7, 3) not null check (peak_g >= 0),
  peak_braking_g numeric(7, 3) not null check (peak_braking_g >= 0),
  peak_lateral_g numeric(7, 3) not null check (peak_lateral_g >= 0),
  weather_label text,
  temperature_c numeric(5, 2),
  elevation_gain_m numeric(8, 1) not null default 0 check (elevation_gain_m >= 0),
  start_elevation_m numeric(8, 1),
  finish_elevation_m numeric(8, 1),
  is_posted boolean not null default true,
  created_at timestamptz not null default now()
);

-- Remove venue dependencies if the earlier venue-based setup was already applied.
drop policy if exists "Users can post their own sprint runs" on public.sprint_runs;
alter table public.sprint_runs drop column if exists venue_id;
drop table if exists public.sprint_venues;

create index if not exists sprint_runs_leaderboard_idx
  on public.sprint_runs (distance_meters, elapsed_seconds, top_speed_kmh desc, created_at);
create index if not exists sprint_runs_user_idx
  on public.sprint_runs (user_id, created_at desc);

alter table public.sprint_runs enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'sprint_runs'
      and policyname = 'Authenticated users can read posted sprint runs'
  ) then
    create policy "Authenticated users can read posted sprint runs"
      on public.sprint_runs for select
      to authenticated
      using (is_posted);
  end if;

  create policy "Users can post their own sprint runs"
    on public.sprint_runs for insert
    to authenticated
    with check (
      user_id = (select auth.uid())
      and is_posted
    );
end
$$;
