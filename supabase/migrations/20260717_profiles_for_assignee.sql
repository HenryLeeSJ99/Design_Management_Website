-- OPTIONAL / NOT YET NEEDED — read this before running it.
--
-- Unblocks showing WHO a project is assigned to.
--
-- THE PROBLEM (verified against the live database on 2026-07-17 by probing
-- through the anon key):
--   * projects.assigned_to is a uuid, and is currently unused by the app.
--   * public.user_roles contains ONLY (user_id, role). No email. No name.
--   * There is no profiles / users / team_members table in the public schema.
-- So a uuid in assigned_to cannot be turned into anything a human can read,
-- and there is nothing to populate an "assign to…" dropdown from. Real names
-- and emails live in auth.users, which PostgREST does not expose.
--
-- This adds the missing mapping. It is deliberately NOT part of the Project
-- Overview work that shipped — the timeline and status needed no migration,
-- so they went in first. Run this only when you want the assignee feature.
--
-- Run each STEP as a separate query in the Supabase SQL editor.


-- ═══════════════════════════════════════════════════════════════
-- STEP 1 — the profiles table, mirroring auth.users
-- ═══════════════════════════════════════════════════════════════
create table if not exists public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  email      text,
  full_name  text,
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Everyone signed in can read the directory: you cannot render "assigned to
-- Sam" or offer an assignee picker without it. It exposes colleagues' names
-- and emails to colleagues, which is what a staff directory is — but be
-- deliberate about that rather than surprised by it later.
drop policy if exists "profiles readable by authenticated" on public.profiles;
create policy "profiles readable by authenticated"
  on public.profiles for select
  to authenticated
  using (true);

-- A person may correct their own display name. Nobody may edit anyone else's.
drop policy if exists "profiles self-update" on public.profiles;
create policy "profiles self-update"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());


-- ═══════════════════════════════════════════════════════════════
-- STEP 2 — keep it in step with auth.users automatically
-- ═══════════════════════════════════════════════════════════════
create or replace function public.sync_profile_from_auth()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, updated_at)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    now()
  )
  on conflict (id) do update
    set email      = excluded.email,
        full_name  = coalesce(excluded.full_name, public.profiles.full_name),
        updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_sync_profile_from_auth on auth.users;
create trigger trg_sync_profile_from_auth
  after insert or update of email, raw_user_meta_data on auth.users
  for each row
  execute function public.sync_profile_from_auth();


-- ═══════════════════════════════════════════════════════════════
-- STEP 3 — backfill everyone who already has an account
-- (the trigger above only fires on future inserts/updates)
-- ═══════════════════════════════════════════════════════════════
insert into public.profiles (id, email, full_name, updated_at)
select
  u.id,
  u.email,
  coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name'),
  now()
from auth.users u
on conflict (id) do nothing;


-- ═══════════════════════════════════════════════════════════════
-- STEP 4 — only a manager/team leader/admin may reassign a project.
-- Same reasoning as the status trigger: RLS cannot see the OLD row, so
-- "assigned_to did not change" is inexpressible as a policy.
-- Reuses can_change_project_status() from 20260717_project_status_rbac.sql,
-- so that migration must be applied first.
-- ═══════════════════════════════════════════════════════════════
create or replace function public.enforce_project_assignee_rbac()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.assigned_to is not distinct from old.assigned_to then
    return new;
  end if;

  -- service_role / SQL editor — deliberate admin action, not a user request.
  if auth.uid() is null then
    return new;
  end if;

  if not public.can_change_project_status() then
    raise exception 'Only an admin, manager or team leader may reassign a project.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_project_assignee_rbac on public.projects;
create trigger trg_enforce_project_assignee_rbac
  before update on public.projects
  for each row
  execute function public.enforce_project_assignee_rbac();
