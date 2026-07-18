import { supabase } from './supabaseClient';

/**
 * Fetch all visible projects for the current user.
 *
 * RLS in Postgres decides visibility. As of the 2026-07-18 policy change,
 * EVERY signed-in role — designers included — reads all projects; assignment
 * is a future filter, not a permission. (The original designer policy keyed
 * on assigned_to, which nothing ever wrote, so designers saw zero projects
 * and could save none. This comment used to describe that broken intent as
 * if it worked.)
 */
export async function fetchProjects() {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .order('last_modified_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch projects: ${error.message}`);
  }
  return data || [];
}

/**
 * One project by id, or null if it isn't visible to this user.
 *
 * Uses maybeSingle() rather than single(): RLS returning no row is a normal
 * outcome (a designer looking at a project not assigned to them), not an
 * error worth throwing over — the caller renders "not found" either way.
 */
export async function fetchProject(projectId) {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch project: ${error.message}`);
  }
  return data;
}

/**
 * Create a new project record.
 * RLS enforces that only Managers/Admins can do this.
 */
export async function createProjectRecord(projectData) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Must be logged in to create a project.");

  const newProject = {
    name: projectData.name,
    file_path: `${projectData.id}.tw`,
    created_by: user.id,
    last_modified_at: new Date().toISOString(),
    updater_email: user.email,
    cover_image: projectData.cover_image || null,
    // Set explicitly rather than left to the column default: there is no
    // draft phase in this app's lifecycle, a project is working/active the
    // moment it exists. See src/services/projectStatus.js.
    status: 'active',
    ...projectData.metadata // calculation_count, drawing_count, file_size
  };

  const { data, error } = await supabase
    .from('projects')
    .insert([newProject])
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create project record: ${error.message}`);
  }
  return data;
}

/**
 * Update project metadata.
 */
export async function updateProjectRecord(projectId, updates) {
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from('projects')
    .update({ 
      ...updates, 
      last_modified_at: new Date().toISOString(),
      updater_email: user?.email || null 
    })
    .eq('id', projectId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update project record: ${error.message}`);
  }
  return data;
}

/**
 * Update a project's metadata ONLY IF nobody else has saved since we last
 * read it. Returns the updated row, or null when the row has moved on —
 * i.e. another person (or another tab) saved after `expectedLastModified`
 * was read.
 *
 * This is the whole concurrency story: saves are last-write-wins on a whole
 * blob, so without this check two people editing the same project silently
 * destroy each other's work. The .eq on last_modified_at makes the claim
 * atomic in Postgres; the blob upload happens only after the claim succeeds.
 *
 * `expectedLastModified` must be the RAW string previously returned by
 * PostgREST, never round-tripped through a JS Date — Postgres keeps
 * microseconds and `new Date()` truncates to milliseconds, which would make
 * every comparison miss.
 */
export async function updateProjectRecordIf(projectId, updates, expectedLastModified) {
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from('projects')
    .update({
      ...updates,
      last_modified_at: new Date().toISOString(),
      updater_email: user?.email || null,
    })
    .eq('id', projectId)
    .eq('last_modified_at', expectedLastModified)
    .select();

  if (error) {
    throw new Error(`Failed to update project record: ${error.message}`);
  }
  return data?.length ? data[0] : null;
}

/**
 * Delete a project record.
 */
export async function deleteProjectRecord(projectId) {
  const { error } = await supabase
    .from('projects')
    .delete()
    .eq('id', projectId);

  if (error) {
    throw new Error(`Failed to delete project record: ${error.message}`);
  }
}

/**
 * Every project currently in the trash.
 *
 * There is no dedicated trashed_at column, so last_modified_at doubles as the
 * trash timestamp — nothing else touches a record while status='trashed', so
 * it only ever moves when the project was trashed. Good enough without a
 * migration; a dedicated column would be more explicit if one is ever added.
 */
export async function fetchTrashedProjects() {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('status', 'trashed');

  if (error) {
    throw new Error(`Failed to fetch trashed projects: ${error.message}`);
  }
  return data || [];
}
