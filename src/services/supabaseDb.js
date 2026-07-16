import { supabase } from './supabaseClient';

/**
 * Fetch all visible projects for the current user.
 * RLS policies in Postgres handle filtering:
 * - Admin/Manager/Sales see all projects.
 * - Designers see only their assigned projects.
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
