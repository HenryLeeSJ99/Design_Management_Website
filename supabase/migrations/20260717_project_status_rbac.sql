-- Project status: active / completed / archive, changeable only by an
-- admin, manager or team leader.
--
-- Run the numbered steps below AS SEPARATE QUERIES in the Supabase SQL
-- editor, in order. Step 1 cannot be committed in the same transaction as
-- anything that uses the new enum values — Postgres refuses that — and the
-- SQL editor sends a pasted script as one transaction, so it has to be its
-- own paste-and-run.
--
-- VERIFIED against the live database on 2026-07-17 by probing through the
-- anon key (no schema access available — see the chat for the method):
--   * public.projects.status is enum project_status, currently containing
--     draft, pending_approval, approved, trashed — the remains of an
--     earlier approval workflow this app's UI no longer drives.
--   * public.user_roles has (user_id, role); role is enum user_role:
--     admin, manager, team_leader, designer, sales.
-- NOT verified (no secret key to introspect it): existing RLS policies on
-- projects. Nothing here alters or drops a policy — only adds a trigger —
-- so it cannot loosen anything already in place.


-- ═══════════════════════════════════════════════════════════════
-- STEP 1 — run alone, then wait for it to finish before Step 2+
-- ═══════════════════════════════════════════════════════════════
alter type project_status add value if not exists 'active';
alter type project_status add value if not exists 'completed';
alter type project_status add value if not exists 'archive';

-- The enum now holds: draft, pending_approval, approved, trashed, active,
-- completed, archive. Postgres cannot drop a value from an enum without
-- recreating the type and rewriting every dependent column — so draft /
-- pending_approval / approved stay in the type forever, just unused by the
-- app going forward. That's fine; see Step 4 for what to do with any
-- existing row still carrying one of them.


-- ═══════════════════════════════════════════════════════════════
-- STEP 2 — run after Step 1 has committed
-- ═══════════════════════════════════════════════════════════════

-- New projects should start 'active' rather than fall through to whatever
-- the column's old default was (createProjectRecord() in the app now also
-- sets it explicitly — this just keeps any other insert path, e.g. a
-- manual one in this SQL editor, from creating a project with no status).
alter table public.projects alter column status set default 'active';

-- Who is allowed to move a project's status.
create or replace function public.can_change_project_status()
returns boolean
language sql
stable
security definer            -- user_roles is itself behind RLS; read it as owner
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = auth.uid()
      and role in ('admin', 'manager', 'team_leader')
  );
$$;

comment on function public.can_change_project_status() is
  'True when the current user may move a project between active/completed/archive. Mirrors canChangeProjectStatus() in src/services/projectStatus.js — change both together.';

-- WHY A TRIGGER AND NOT AN RLS POLICY:
-- RLS UPDATE policies get USING (which rows may be touched) and WITH CHECK
-- (what the resulting row must satisfy). Neither can reference the OLD row,
-- so "the status column did not change" is inexpressible as a policy —
-- Postgres has no column-level RLS. A BEFORE UPDATE trigger can compare OLD
-- vs NEW, so that is the only place this rule can live. It is also
-- stronger: service_role bypasses RLS, but triggers still fire for it.
create or replace function public.enforce_project_status_rbac()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Unchanged status: nothing to police. This is the common path — every
  -- ordinary save writes file_size/last_modified_at and leaves status alone.
  if new.status is not distinct from old.status then
    return new;
  end if;

  -- Trashing and restoring are a separate, already-existing mechanism
  -- (trashProject() / restoreFromTrash() in projectFiles.js) with its own
  -- semantics — trashing is already gated to manager-level in the UI,
  -- restoring is deliberately open to any role today. This trigger is about
  -- the active/completed/archive lifecycle specifically, so a transition
  -- into or out of 'trashed' is exempt rather than newly restricted.
  if old.status = 'trashed' or new.status = 'trashed' then
    return new;
  end if;

  -- auth.uid() is null for service_role and for SQL run directly in the
  -- dashboard — i.e. deliberate admin action, not a user request through
  -- the app. Anonymous callers are also null here, but RLS must already
  -- deny them UPDATE on projects; this trigger is not what stops anon.
  if auth.uid() is null then
    return new;
  end if;

  if not public.can_change_project_status() then
    -- 42501 = insufficient_privilege, which PostgREST turns into an HTTP
    -- 403 with this message, rather than a generic 500.
    raise exception 'Only an admin, manager or team leader may change a project''s status.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_project_status_rbac on public.projects;

create trigger trg_enforce_project_status_rbac
  before update on public.projects
  for each row
  execute function public.enforce_project_status_rbac();


-- ═══════════════════════════════════════════════════════════════
-- STEP 3 — OPTIONAL. Existing rows on the legacy vocabulary.
-- Nothing above touches existing data — this is the only step that would.
-- Only run it if you want existing projects moved onto the new vocabulary;
-- decide first whether any of them being 'approved' or 'pending_approval'
-- today is meaningful information you'd lose. Uncomment to run.
-- ═══════════════════════════════════════════════════════════════
-- update public.projects
--    set status = 'active'
--  where status in ('draft', 'pending_approval', 'approved');
