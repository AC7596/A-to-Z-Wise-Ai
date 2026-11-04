-- Run in the intended Supabase project. Never expose the service role key.
create table public.member_subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  subscription_id text not null unique check (subscription_id ~ '^I-[A-Z0-9]{6,64}$'),
  payer_id text not null,
  created_at timestamptz not null default now()
);
alter table public.member_subscriptions enable row level security;
revoke all on public.member_subscriptions from anon, authenticated;
grant select, insert on public.member_subscriptions to service_role;

create table public.member_link_limits (
  user_id uuid primary key references auth.users(id) on delete cascade,
  hour_start timestamptz not null,
  attempts integer not null
);
alter table public.member_link_limits enable row level security;
revoke all on public.member_link_limits from anon, authenticated;
grant all on public.member_link_limits to service_role;
create function public.allow_member_link(account_id uuid) returns boolean
language plpgsql security invoker set search_path = '' as $$
declare n integer;
begin
  insert into public.member_link_limits(user_id,hour_start,attempts)
    values(account_id,date_trunc('hour',now()),1)
    on conflict(user_id) do update set
      attempts = case when public.member_link_limits.hour_start = date_trunc('hour',now())
        then public.member_link_limits.attempts + 1 else 1 end,
      hour_start = date_trunc('hour',now()) returning attempts into n;
  return n <= 10;
end $$;
revoke all on function public.allow_member_link(uuid) from public, anon, authenticated;
grant execute on function public.allow_member_link(uuid) to service_role;

create table public.home_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  profile jsonb not null check (jsonb_typeof(profile) = 'object' and octet_length(profile::text) <= 1000000),
  revision bigint not null default 1,
  updated_at timestamptz not null default now()
);
alter table public.home_profiles enable row level security;
revoke all on public.home_profiles from anon, authenticated;
grant select, insert, update, delete on public.home_profiles to authenticated;
create policy own_home_select on public.home_profiles for select to authenticated using ((select auth.uid()) = user_id);
create policy own_home_insert on public.home_profiles for insert to authenticated with check ((select auth.uid()) = user_id);
create policy own_home_update on public.home_profiles for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy own_home_delete on public.home_profiles for delete to authenticated using ((select auth.uid()) = user_id);

-- Compare-and-swap: refuse stale saves from another phone/browser.
create function public.save_home_profile(new_profile jsonb, expected_revision bigint, expected_user_id uuid)
returns setof public.home_profiles language plpgsql security invoker set search_path = '' as $$
begin
  if auth.uid() is null or expected_user_id is null or auth.uid() <> expected_user_id then raise exception 'Sign in required'; end if;
  if expected_revision = 0 then
    return query insert into public.home_profiles(user_id, profile)
      values (auth.uid(), new_profile) on conflict (user_id) do nothing returning *;
  else
    return query update public.home_profiles set profile = new_profile,
      revision = revision + 1, updated_at = now()
      where user_id = auth.uid() and revision = expected_revision returning *;
  end if;
end $$;
revoke all on function public.save_home_profile(jsonb,bigint,uuid) from public, anon;
grant execute on function public.save_home_profile(jsonb,bigint,uuid) to authenticated;
