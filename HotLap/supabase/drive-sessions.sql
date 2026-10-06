-- Run once in the Supabase SQL Editor to store private, user-owned HotLap drives.
create table if not exists public.drive_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  started_at timestamptz not null,
  duration_seconds integer not null check (duration_seconds >= 0),
  distance_meters numeric(12, 2) not null check (distance_meters >= 0),
  average_speed_kmh numeric(8, 2) not null check (average_speed_kmh >= 0),
  track jsonb not null default '[]'::jsonb check (jsonb_typeof(track) = 'array'),
  created_at timestamptz not null default now()
);

create index if not exists drive_sessions_user_created_idx
  on public.drive_sessions (user_id, created_at desc);

alter table public.drive_sessions enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'drive_sessions'
      and policyname = 'Users can read their own drives'
  ) then
    create policy "Users can read their own drives"
      on public.drive_sessions for select
      to authenticated
      using (user_id = (select auth.uid()));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'drive_sessions'
      and policyname = 'Users can save their own drives'
  ) then
    create policy "Users can save their own drives"
      on public.drive_sessions for insert
      to authenticated
      with check (user_id = (select auth.uid()));
  end if;
end
$$;
