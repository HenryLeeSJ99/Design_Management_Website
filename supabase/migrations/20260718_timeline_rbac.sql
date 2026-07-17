-- Only an admin, manager or team leader may change a project's timeline.
--
-- THE GAP THIS CLOSES:
-- 20260717_project_status_rbac.sql guards the `status` column only. The
-- timeline (target date + milestone due/done state) has no database rule at
-- all, so canEditTimeline() in src/services/projectTimeline.js is a UI gate
-- with nothing behind it: a designer or salesperson could set milestone dates
-- by calling Supabase from the browser console. Everyone SEES the right thing;
-- not everyone is STOPPED from doing the wrong thing.
--
-- Low stakes on its own — dates are visible and reversible — but the
-- permissions the UI implies should be true, not aspirational.
--
-- Same reasoning as the status trigger: RLS UPDATE policies cannot reference
-- the OLD row, so "the timeline column did not change" is inexpressible as a
-- policy. A BEFORE UPDATE trigger is the only place this rule can live.
--
-- Reuses can_change_project_status() from 20260717_project_status_rbac.sql —
-- apply that migration first. The roles are deliberately the same set: whoever
-- may move a project through its lifecycle may also say when it is due.
--
-- Safe to re-run. Paste the whole file into the Supabase SQL editor.

create or replace function public.enforce_project_timeline_rbac()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Unchanged timeline: nothing to police. This is the common path — every
  -- ordinary .tw save rewrites file_size/last_modified_at and never touches
  -- the timeline, so a designer saving their work must sail straight through
  -- here. `is not distinct from` (not `=`) because the column is nullable and
  -- null = null would be null, not true, which would fail every save on a
  -- project whose timeline was never set.
  if new.timeline is not distinct from old.timeline then
    return new;
  end if;

  -- auth.uid() is null for service_role and for SQL run in the dashboard —
  -- deliberate admin action, not a user request through the app. Anonymous
  -- callers are also null here, but RLS already denies them UPDATE on
  -- projects; this trigger is not what stops anon.
  if auth.uid() is null then
    return new;
  end if;

  if not public.can_change_project_status() then
    -- 42501 = insufficient_privilege, which PostgREST turns into an HTTP 403
    -- carrying this message rather than a generic 500, so the Project
    -- Overview page can show a real reason.
    raise exception 'Only an admin, manager or team leader may change a project''s timeline.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_project_timeline_rbac on public.projects;

create trigger trg_enforce_project_timeline_rbac
  before update on public.projects
  for each row
  execute function public.enforce_project_timeline_rbac();
