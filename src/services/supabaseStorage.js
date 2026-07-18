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

// --- Split project layout ---
// A project's live contents are stored as SEPARATE objects:
//
//   {projectId}/manifest.json          the project JSON (KBs, changes constantly)
//   {projectId}/pdfs/{pdfId}.pdf       one object per PDF (MBs, changes rarely)
//
// This exists because the single-blob layout made every autosave re-upload
// every PDF: a 20 MB project uploaded 20 MB after each pause in typing, when
// what actually changed was a few KB of manifest. PDFs are ~95% of the bytes
// and are immutable once attached (a replaced report gets a NEW pdfId), so an
// ordinary save now uploads only the manifest. The legacy {projectId}.tw blob
// is still read as a fallback and migrated to this layout on first save.

const splitManifestPath = (projectId) => `${projectId}/manifest.json`;
const splitPdfPath = (projectId, pdfId) => `${projectId}/pdfs/${encodeURIComponent(pdfId)}.pdf`;

/** Upload/overwrite the manifest object. */
export async function uploadManifestObject(projectId, bytes) {
  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(splitManifestPath(projectId), bytes, { upsert: true, contentType: 'application/json' });
  if (error) throw new Error(`Failed to upload the project manifest: ${error.message}`);
}

/** The manifest bytes, or null when this project has no split layout yet. */
export async function downloadManifestObject(projectId) {
  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .download(splitManifestPath(projectId));
  if (error) return null; // not found ⇒ legacy single-blob project
  return data.arrayBuffer();
}

/** Upload one PDF object. Immutable in practice, but upsert for idempotent retries. */
export async function uploadPdfObject(projectId, pdfId, bytes) {
  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(splitPdfPath(projectId, pdfId), bytes, { upsert: true, contentType: 'application/pdf' });
  if (error) throw new Error(`Failed to upload a PDF: ${error.message}`);
}

export async function downloadPdfObject(projectId, pdfId) {
  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .download(splitPdfPath(projectId, pdfId));
  if (error) throw new Error(`Failed to download a PDF: ${error.message}`);
  return data.arrayBuffer();
}

/** pdfIds currently stored for a project (decoded back from object names). */
export async function listPdfObjectIds(projectId) {
  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .list(`${projectId}/pdfs`);
  if (error) throw new Error(`Failed to list the project's PDFs: ${error.message}`);
  return (data || [])
    .filter((o) => o.name.endsWith('.pdf'))
    .map((o) => decodeURIComponent(o.name.slice(0, -4)));
}

export async function removePdfObjects(projectId, pdfIds) {
  if (!pdfIds.length) return;
  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .remove(pdfIds.map((id) => splitPdfPath(projectId, id)));
  if (error) throw new Error(`Failed to remove old PDFs: ${error.message}`);
}

/** Delete the whole split tree — manifest and every PDF. For permanent deletion. */
export async function removeSplitObjects(projectId) {
  const pdfIds = await listPdfObjectIds(projectId).catch(() => []);
  const paths = [splitManifestPath(projectId), ...pdfIds.map((id) => splitPdfPath(projectId, id))];
  const { error } = await supabase.storage.from(BUCKET_NAME).remove(paths);
  if (error) throw new Error(`Failed to remove the project's files: ${error.message}`);
}

// --- Version history ---
// Snapshots live in the same bucket as the project's own .tw blob, under
// versions/{projectId}/, so no second bucket or DB table is needed.

const versionsPrefix = (projectId) => `versions/${projectId}`;
// Sortable, path-safe, and readable: 2026-07-16T01-23-45-678.tw
const versionStamp = () => `${new Date().toISOString().replace(/[:.]/g, '-').replace(/Z$/, '')}.tw`;

/** Copy the current bytes of a project into its version history. */
export async function uploadVersionObject(projectId, bytes) {
  const path = `${versionsPrefix(projectId)}/${versionStamp()}`;
  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(path, bytes, { upsert: false, contentType: 'application/zip' });

  if (error) {
    throw new Error(`Failed to save a version: ${error.message}`);
  }
  return path;
}

/** Every version object stored for a project — raw Storage list entries. */
export async function listVersionObjects(projectId) {
  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .list(versionsPrefix(projectId), { sortBy: { column: 'created_at', order: 'desc' } });

  if (error) {
    throw new Error(`Failed to list versions: ${error.message}`);
  }
  return data || [];
}

/** Download one version's bytes by its object name (as returned by list). */
export async function downloadVersionObject(projectId, versionFilename) {
  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .download(`${versionsPrefix(projectId)}/${versionFilename}`);

  if (error) {
    throw new Error(`Failed to download that version: ${error.message}`);
  }
  return data.arrayBuffer();
}

/**
 * Remove version objects for a project. With no filenames, removes every
 * version — used when a project is permanently deleted, so its history does
 * not linger as an orphan nothing will ever list again.
 */
export async function removeVersionObjects(projectId, filenames) {
  const names = filenames || (await listVersionObjects(projectId)).map((o) => o.name);
  if (!names.length) return;
  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .remove(names.map((n) => `${versionsPrefix(projectId)}/${n}`));

  if (error) {
    throw new Error(`Failed to remove old versions: ${error.message}`);
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
