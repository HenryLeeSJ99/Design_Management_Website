-- Make zones visible to the database.
--
-- WHY:
-- A project's zones ("Level 2", "Levels 3-20 (Typical)", "Roof") have only
-- ever existed inside the .tw zip in Storage. Postgres could not see them, so
-- "which submissions are due this week?" was unanswerable without downloading
-- and unzipping every project file. That is the sole reason the timeline was
-- built at project level: it was the only level the database knew about.
--
-- Each zone is one submission, so per-zone dates need per-zone identity up
-- here. This column is a copy, refreshed from the .tw on every save. The .tw
-- stays the source of truth and stays hand-recoverable as a zip.
--
-- WHY A SEPARATE COLUMN AND NOT INSIDE `timeline`:
-- 20260718_timeline_rbac.sql gates `timeline` to admin/manager/team_leader. A
-- designer's ordinary save has to write zone names — they author them — so
-- putting zones in `timeline` would make every designer save raise 42501 and
-- fail. Splitting them keeps ownership honest: designers own `zones`,
-- managers own `timeline`. Nothing gates this column, deliberately.
--
-- Shape: [{ "id": "z1", "name": "Level 2", "order": 0 }, ...]
--
-- Safe to re-run.

alter table public.projects
  add column if not exists zones jsonb not null default '[]'::jsonb;

comment on column public.projects.zones is
  'Denormalised copy of the zones inside the .tw, refreshed on every save. Source of truth is the .tw in Storage. Designer-owned and deliberately ungated — the per-zone DATES live in timeline, which the RBAC trigger restricts to managers. Keyed to timeline.submissions by zone id.';
