-- Storage policies for the tempworks-projects bucket, covering EVERY path
-- the app writes — including the new split layout.
--
-- WHY: the storage split (commit 7804eba) added two new object path shapes:
--
--     {projectId}/manifest.json         every save
--     {projectId}/pdfs/{pdfId}.pdf      when a PDF is attached
--
-- alongside the existing {projectId}.tw and versions/{projectId}/*.tw.
-- The existing bucket policies were written before those paths existed and
-- cannot be read from the app side, so rather than guess whether they match,
-- this grants the app's full working set explicitly.
--
-- SAFE TO RUN REGARDLESS of what already exists: Postgres policies are
-- permissive — they OR together — so adding these can only allow the app's
-- own operations, never break an existing one. Only policies with these
-- exact names are dropped/recreated; whatever is already there is untouched.
--
-- WHO: every signed-in role can read; every role except sales can write.
-- Sales is read-only in the projects table (by policy) and never opens the
-- workbook — letting it write storage while the DB refuses it would be
-- incoherent. The real metadata boundary stays in the projects-table RLS
-- and triggers; these policies just let the file bytes follow.

-- Role check as SECURITY DEFINER, so it works even if user_roles' own RLS
-- only lets people read their own row (it reads exactly that row anyway).
create or replace function public.can_write_project_files()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = auth.uid()
      and role in ('admin', 'manager', 'team_leader', 'designer')
  );
$$;

comment on function public.can_write_project_files() is
  'True for every role that may save project files (everyone but sales). Used by the tempworks-projects storage policies.';

-- Read: any signed-in user, any path in the bucket (download + list).
drop policy if exists "tempworks read for signed-in" on storage.objects;
create policy "tempworks read for signed-in"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'tempworks-projects');

-- Upload of a new object. upsert:true from the client needs BOTH insert and
-- update, depending on whether the object already exists.
drop policy if exists "tempworks insert for design roles" on storage.objects;
create policy "tempworks insert for design roles"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'tempworks-projects' and public.can_write_project_files());

drop policy if exists "tempworks update for design roles" on storage.objects;
create policy "tempworks update for design roles"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'tempworks-projects' and public.can_write_project_files())
  with check (bucket_id = 'tempworks-projects' and public.can_write_project_files());

-- Delete: pruning old versions, removing detached PDFs, retiring a migrated
-- legacy blob, emptying the trash.
drop policy if exists "tempworks delete for design roles" on storage.objects;
create policy "tempworks delete for design roles"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'tempworks-projects' and public.can_write_project_files());
