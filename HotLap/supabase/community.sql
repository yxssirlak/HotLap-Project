-- Community sharing, crew destinations, comments, likes, and in-app notifications.
-- Run once in the Supabase SQL Editor.

create table if not exists public.crews (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 2 and 48),
  owner_id uuid not null references auth.users (id) on delete cascade,
  invite_code text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.crew_members (
  crew_id uuid not null references public.crews (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (crew_id, user_id)
);

create table if not exists public.community_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  author_username text not null,
  author_name text not null,
  author_avatar_url text,
  activity_type text not null check (activity_type in ('drive', 'sprint')),
  caption text not null default '' check (length(caption) <= 1000),
  vehicle text not null default 'Unspecified vehicle',
  duration_seconds integer not null check (duration_seconds >= 0),
  distance_meters numeric(12, 2) not null check (distance_meters >= 0),
  average_speed_kmh numeric(8, 2) not null default 0 check (average_speed_kmh >= 0),
  top_speed_kmh numeric(8, 2) check (top_speed_kmh is null or top_speed_kmh >= 0),
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  track jsonb not null default '[]'::jsonb check (jsonb_typeof(track) = 'array'),
  start_latitude double precision,
  start_longitude double precision,
  audience text not null check (audience in ('followers', 'local', 'crew')),
  crew_id uuid references public.crews (id) on delete cascade,
  like_count integer not null default 0 check (like_count >= 0),
  comment_count integer not null default 0 check (comment_count >= 0),
  created_at timestamptz not null default now(),
  constraint community_post_audience_target_check check (
    (audience = 'crew' and crew_id is not null)
    or (audience <> 'crew' and crew_id is null)
  ),
  constraint community_post_local_location_check check (
    audience <> 'local'
    or (start_latitude is not null and start_longitude is not null
      and start_latitude between -90 and 90 and start_longitude between -180 and 180)
  )
);

create table if not exists public.community_post_likes (
  post_id uuid not null references public.community_posts (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table if not exists public.community_post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  author_username text not null,
  author_name text not null,
  author_avatar_url text,
  body text not null check (length(trim(body)) between 1 and 1000),
  created_at timestamptz not null default now()
);

create table if not exists public.community_notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references auth.users (id) on delete cascade,
  actor_id uuid not null references auth.users (id) on delete cascade,
  actor_name text not null,
  actor_avatar_url text,
  post_id uuid not null references public.community_posts (id) on delete cascade,
  comment_id uuid references public.community_post_comments (id) on delete cascade,
  notification_type text not null check (notification_type in ('like', 'comment')),
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists community_posts_feed_idx
  on public.community_posts (audience, created_at desc);
create index if not exists community_posts_author_idx
  on public.community_posts (user_id, created_at desc);
create index if not exists community_posts_crew_idx
  on public.community_posts (crew_id, created_at desc)
  where crew_id is not null;
create index if not exists community_comments_post_idx
  on public.community_post_comments (post_id, created_at);
create index if not exists community_notifications_recipient_idx
  on public.community_notifications (recipient_id, created_at desc);

alter table public.crews enable row level security;
alter table public.crew_members enable row level security;
alter table public.community_posts enable row level security;
alter table public.community_post_likes enable row level security;
alter table public.community_post_comments enable row level security;
alter table public.community_notifications enable row level security;

create or replace function public.is_community_crew_member(target_crew_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.crew_members
    where crew_id = target_crew_id and user_id = auth.uid()
  )
$$;

drop policy if exists "Crew members can read their crews" on public.crews;
create policy "Crew members can read their crews" on public.crews
  for select to authenticated using (
    public.is_community_crew_member(id)
  );

drop policy if exists "Members can read crew membership" on public.crew_members;
create policy "Members can read crew membership" on public.crew_members
  for select to authenticated using (
    public.is_community_crew_member(crew_id)
  );

drop policy if exists "Authors and permitted audiences can read posts" on public.community_posts;
create policy "Authors and permitted audiences can read posts" on public.community_posts
  for select to authenticated using (
    user_id = (select auth.uid())
    or (
      audience = 'followers'
      and exists (
        select 1 from public.crew_connections f
        where f.follower_id = (select auth.uid()) and f.following_id = community_posts.user_id
      )
    )
    or (
      audience = 'crew'
      and public.is_community_crew_member(crew_id)
    )
  );

drop policy if exists "Users can publish their own community posts" on public.community_posts;
create policy "Users can publish their own community posts" on public.community_posts
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and (
      (audience = 'followers' and crew_id is null)
      or (audience = 'local' and crew_id is null
        and start_latitude between -90 and 90 and start_longitude between -180 and 180)
      or (audience = 'crew' and public.is_community_crew_member(crew_id))
    )
  );

drop policy if exists "Authors can delete their own community posts" on public.community_posts;
create policy "Authors can delete their own community posts" on public.community_posts
  for delete to authenticated using (user_id = (select auth.uid()));

drop policy if exists "Users can read their own community likes" on public.community_post_likes;
create policy "Users can read their own community likes" on public.community_post_likes
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists "Users can read comments on visible posts" on public.community_post_comments;
create policy "Users can read comments on visible posts" on public.community_post_comments
  for select to authenticated using (
    exists (
      select 1 from public.community_posts p
      where p.id = community_post_comments.post_id
    )
  );

drop policy if exists "Users can read their own community notifications" on public.community_notifications;
create policy "Users can read their own community notifications" on public.community_notifications
  for select to authenticated using (recipient_id = (select auth.uid()));

drop policy if exists "Users can mark their own notifications read" on public.community_notifications;
create policy "Users can mark their own notifications read" on public.community_notifications
  for update to authenticated using (recipient_id = (select auth.uid()))
  with check (recipient_id = (select auth.uid()));

create or replace function public.create_community_crew(crew_name text)
returns public.crews
language plpgsql
security definer
set search_path = public
as $$
declare
  new_crew public.crews;
begin
  if auth.uid() is null then raise exception 'Sign in to create a crew.'; end if;
  if length(trim(crew_name)) not between 2 and 48 then
    raise exception 'Crew names must be 2 to 48 characters long.';
  end if;

  insert into public.crews (name, owner_id, invite_code)
  values (trim(crew_name), auth.uid(), upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)))
  returning * into new_crew;

  insert into public.crew_members (crew_id, user_id, role)
  values (new_crew.id, auth.uid(), 'owner');

  return new_crew;
end
$$;

create or replace function public.join_community_crew(requested_invite_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_crew_id uuid;
begin
  if auth.uid() is null then raise exception 'Sign in to join a crew.'; end if;

  select id into target_crew_id
  from public.crews
  where crews.invite_code = upper(trim(requested_invite_code));

  if target_crew_id is null then raise exception 'That crew invite code was not found.'; end if;

  insert into public.crew_members (crew_id, user_id)
  values (target_crew_id, auth.uid())
  on conflict (crew_id, user_id) do nothing;

  return target_crew_id;
end
$$;

create or replace function public.community_post_is_visible(
  target_post_id uuid,
  viewer_latitude double precision default null,
  viewer_longitude double precision default null
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.community_posts p
    where p.id = target_post_id
      and (
        p.user_id = auth.uid()
        or (
          p.audience = 'followers'
          and exists (
            select 1 from public.crew_connections f
            where f.follower_id = auth.uid() and f.following_id = p.user_id
          )
        )
        or (
          p.audience = 'crew'
          and exists (
            select 1 from public.crew_members m
            where m.crew_id = p.crew_id and m.user_id = auth.uid()
          )
        )
        or (
          p.audience = 'local'
          and viewer_latitude between -90 and 90
          and viewer_longitude between -180 and 180
          and 6371000 * 2 * asin(sqrt(least(1.0, greatest(0.0,
            sin(radians(viewer_latitude - p.start_latitude) / 2)^2
            + cos(radians(p.start_latitude)) * cos(radians(viewer_latitude))
            * sin(radians(viewer_longitude - p.start_longitude) / 2)^2
          )))) <= 50000
        )
      )
  )
$$;

create or replace function public.get_local_community_posts(
  viewer_latitude double precision,
  viewer_longitude double precision
)
returns setof public.community_posts
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Sign in to view Local Discover.'; end if;
  if viewer_latitude not between -90 and 90 or viewer_longitude not between -180 and 180 then
    raise exception 'A valid location is required for Local Discover.';
  end if;

  return query
    select p.*
    from public.community_posts p
    where p.audience = 'local'
      and 6371000 * 2 * asin(sqrt(least(1.0, greatest(0.0,
        sin(radians(viewer_latitude - p.start_latitude) / 2)^2
        + cos(radians(p.start_latitude)) * cos(radians(viewer_latitude))
        * sin(radians(viewer_longitude - p.start_longitude) / 2)^2
      )))) <= 50000
    order by p.created_at desc
    limit 50;
end
$$;

create or replace function public.toggle_community_post_like(
  target_post_id uuid,
  viewer_latitude double precision default null,
  viewer_longitude double precision default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Sign in to like a post.'; end if;
  if not public.community_post_is_visible(target_post_id, viewer_latitude, viewer_longitude) then
    raise exception 'This post is not available to you.';
  end if;

  delete from public.community_post_likes
  where post_id = target_post_id and user_id = auth.uid();
  if found then return false; end if;

  insert into public.community_post_likes (post_id, user_id)
  values (target_post_id, auth.uid());
  return true;
end
$$;

create or replace function public.add_community_post_comment(
  target_post_id uuid,
  comment_body text,
  viewer_latitude double precision default null,
  viewer_longitude double precision default null
)
returns public.community_post_comments
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_profile public.profiles;
  new_comment public.community_post_comments;
begin
  if auth.uid() is null then raise exception 'Sign in to comment.'; end if;
  if not public.community_post_is_visible(target_post_id, viewer_latitude, viewer_longitude) then
    raise exception 'This post is not available to you.';
  end if;
  if length(trim(comment_body)) not between 1 and 1000 then
    raise exception 'Comments must be 1 to 1000 characters long.';
  end if;

  select * into actor_profile from public.profiles where id = auth.uid();
  insert into public.community_post_comments (
    post_id, user_id, author_username, author_name, author_avatar_url, body
  ) values (
    target_post_id,
    auth.uid(),
    coalesce(actor_profile.username, 'driver'),
    coalesce(actor_profile.full_name, actor_profile.username, 'Driver'),
    actor_profile.avatar_url,
    trim(comment_body)
  ) returning * into new_comment;

  return new_comment;
end
$$;

create or replace function public.get_community_post_comments(
  target_post_id uuid,
  viewer_latitude double precision default null,
  viewer_longitude double precision default null
)
returns setof public.community_post_comments
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Sign in to view comments.'; end if;
  if not public.community_post_is_visible(target_post_id, viewer_latitude, viewer_longitude) then
    raise exception 'This post is not available to you.';
  end if;

  return query
    select c.* from public.community_post_comments c
    where c.post_id = target_post_id
    order by c.created_at asc
    limit 200;
end
$$;

create or replace function public.update_community_post_counts()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_table_name = 'community_post_likes' then
    update public.community_posts
    set like_count = greatest(0, like_count + case when tg_op = 'INSERT' then 1 else -1 end)
    where id = coalesce(new.post_id, old.post_id);
  else
    update public.community_posts
    set comment_count = greatest(0, comment_count + case when tg_op = 'INSERT' then 1 else -1 end)
    where id = coalesce(new.post_id, old.post_id);
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end
$$;

drop trigger if exists community_like_counts on public.community_post_likes;
create trigger community_like_counts
after insert or delete on public.community_post_likes
for each row execute function public.update_community_post_counts();

drop trigger if exists community_comment_counts on public.community_post_comments;
create trigger community_comment_counts
after insert or delete on public.community_post_comments
for each row execute function public.update_community_post_counts();

create or replace function public.notify_community_post_engagement()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_post public.community_posts;
  actor_profile public.profiles;
begin
  select * into target_post from public.community_posts where id = new.post_id;
  if target_post.user_id = new.user_id then return new; end if;

  select * into actor_profile from public.profiles where id = new.user_id;
  insert into public.community_notifications (
    recipient_id, actor_id, actor_name, actor_avatar_url, post_id, comment_id, notification_type
  ) values (
    target_post.user_id,
    new.user_id,
    coalesce(actor_profile.full_name, actor_profile.username, 'A driver'),
    actor_profile.avatar_url,
    new.post_id,
    case when tg_table_name = 'community_post_comments' then new.id else null end,
    case when tg_table_name = 'community_post_comments' then 'comment' else 'like' end
  );
  return new;
end
$$;

drop trigger if exists community_like_notifications on public.community_post_likes;
create trigger community_like_notifications
after insert on public.community_post_likes
for each row execute function public.notify_community_post_engagement();

drop trigger if exists community_comment_notifications on public.community_post_comments;
create trigger community_comment_notifications
after insert on public.community_post_comments
for each row execute function public.notify_community_post_engagement();

grant select on public.crews, public.crew_members, public.community_posts,
  public.community_post_likes, public.community_post_comments,
  public.community_notifications to authenticated;
grant insert, delete on public.community_posts to authenticated;
grant update (read_at) on public.community_notifications to authenticated;

grant execute on function public.create_community_crew(text) to authenticated;
grant execute on function public.join_community_crew(text) to authenticated;
grant execute on function public.is_community_crew_member(uuid) to authenticated;
grant execute on function public.community_post_is_visible(uuid, double precision, double precision) to authenticated;
grant execute on function public.get_local_community_posts(double precision, double precision) to authenticated;
grant execute on function public.toggle_community_post_like(uuid, double precision, double precision) to authenticated;
grant execute on function public.add_community_post_comment(uuid, text, double precision, double precision) to authenticated;
grant execute on function public.get_community_post_comments(uuid, double precision, double precision) to authenticated;
