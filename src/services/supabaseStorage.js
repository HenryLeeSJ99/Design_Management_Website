import { supabase } from './supabaseClient';

const BUCKET_NAME = 'tempworks-projects';

/**
 * Upload a project file (.tw) to Supabase Storage.
 * The file is saved under the project's UUID to prevent name collisions.
 */
export async function uploadProjectFile(projectId, fileBytes) {
  const path = `${projectId}.tw`;

  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(path, fileBytes, {
      upsert: true,
      contentType: 'application/zip',
    });

  if (error) {
    throw new Error(`Failed to upload project file: ${error.message}`);
  }
  return path;
}

/**
 * Download a project file from Supabase Storage.
 */
export async function downloadProjectFile(projectId) {
  const path = `${projectId}.tw`;

  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .download(path);

  if (error) {
    throw new Error(`Failed to download project file: ${error.message}`);
  }

  return await data.arrayBuffer();
}

/**
 * Delete a project file from Supabase Storage.
 */
export async function deleteStorageFile(projectId) {
  const path = `${projectId}.tw`;

  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .remove([path]);

  if (error) {
    throw new Error(`Failed to delete project file: ${error.message}`);
  }
}

/**
 * Upload a cover image for a project to Supabase Storage.
 * @param {string} projectId - The UUID of the project.
 * @param {File} file - The image file to upload.
 * @returns {string} The public URL of the uploaded image.
 */
export async function uploadCoverImage(projectId, file) {
  // Extract extension from file
  const ext = file.name.split('.').pop();
  const path = `covers/${projectId}.${ext}`;

  const { error } = await supabase.storage
    .from('project-covers')
    .upload(path, file, {
      upsert: true,
      contentType: file.type,
    });

  if (error) {
    throw new Error(`Failed to upload cover image: ${error.message}`);
  }

  // Get the public URL for the uploaded image
  const { data } = supabase.storage
    .from('project-covers')
    .getPublicUrl(path);

  return data.publicUrl;
}
