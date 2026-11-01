-- Run once in the Supabase SQL editor. No service-role key is needed by this app.
create table if not exists public.projects (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(name) between 1 and 100),
  payload jsonb not null check (octet_length(payload::text) < 2200000),
  updated_at timestamptz not null default now()
);
create index if not exists projects_owner_updated on public.projects (user_id, updated_at desc);
alter table public.projects enable row level security;
create policy "Owners can read their projects" on public.projects for select to authenticated using ((select auth.uid()) = user_id);
create policy "Owners can create their projects" on public.projects for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Owners can update their projects" on public.projects for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Owners can delete their projects" on public.projects for delete to authenticated using ((select auth.uid()) = user_id);
grant select, insert, update, delete on public.projects to authenticated;
revoke all on public.projects from anon;

create table if not exists public.generation_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  count integer not null check (count between 1 and 10),
  primary key (user_id, day)
);
alter table public.generation_usage enable row level security;
create policy "Owners can view their AI usage" on public.generation_usage for select to authenticated using ((select auth.uid()) = user_id);
grant select on public.generation_usage to authenticated;
revoke insert, update, delete on public.generation_usage from authenticated, anon;

create or replace function public.consume_generation_quota()
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  current_user_id uuid := auth.uid();
  updated_count integer;
begin
  if current_user_id is null then
    return false;
  end if;
  insert into public.generation_usage(user_id, day, count)
  values(current_user_id, (now() at time zone 'utc')::date, 1)
  on conflict (user_id, day) do update
    set count = public.generation_usage.count + 1
    where public.generation_usage.count < 10
  returning count into updated_count;
  return updated_count is not null;
end;
$$;
revoke all on function public.consume_generation_quota() from public, anon;
grant execute on function public.consume_generation_quota() to authenticated;
