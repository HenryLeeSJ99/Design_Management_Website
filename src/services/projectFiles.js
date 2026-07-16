import { deleteStorageFile, downloadProjectFile, uploadProjectFile } from './supabaseStorage';
import { fetchProjects, createProjectRecord, updateProjectRecord, deleteProjectRecord } from './supabaseDb';
import { TwFileError } from './twFile';

export const TRASH_DAYS = 30;

// The file extension remains part of the mental model, but now it refers to
// the object key in Supabase Storage.
export const TW_EXTENSION = '.tw';

/**
 * List all projects available to the current user.
 */
export async function listProjects() {
  try {
    const records = await fetchProjects();
    return records.map(r => ({
      ...r,
      id: r.id,
      filename: r.id, // the ID acts as the filename for the session
      name: r.name,
      size: r.file_size, // kept for backwards compatibility
      modifiedAt: new Date(r.last_modified_at).getTime(), // kept for backwards compatibility
      status: r.status,
      assignedTo: r.assigned_to,
      timeline: r.timeline,
    }));
  } catch (e) {
    console.error('listProjects error:', e);
    throw new TwFileError(`Could not read projects from cloud database: ${e.message}`);
  }
}

/** Raw bytes of one project file. */
export async function readProjectFile(projectId) {
  try {
    return await downloadProjectFile(projectId);
  } catch (e) {
    throw new TwFileError(`Project "${projectId}" could not be downloaded.`);
  }
}

/**
 * Write bytes to a project file.
 * The projectId matches the database record UUID.
 */
export async function writeProjectFile(projectId, bytes, projectMetadata = {}) {
  try {
    await uploadProjectFile(projectId, bytes);
    
    // We only update metadata if it's explicitly passed during a save
    if (Object.keys(projectMetadata).length > 0) {
      await updateProjectRecord(projectId, {
        file_size: bytes.byteLength,
        ...projectMetadata
      });
    }
    return projectId;
  } catch (e) {
    throw new TwFileError(`Project could not be saved to cloud: ${e.message}`);
  }
}

/**
 * Delete a project completely.
 */
export async function deleteProjectFile(projectId) {
  try {
    await deleteStorageFile(projectId);
    await deleteProjectRecord(projectId);
  } catch (e) {
    throw new TwFileError(`Failed to delete project: ${e.message}`);
  }
}

// --- Trash functionality ---
// Since we are moving to a fully database-driven model, trash can just be a status flag.
// For this migration, we'll keep the signatures intact but implement them as status updates.

export async function trashProject(projectId) {
  try {
    await updateProjectRecord(projectId, { status: 'trashed' });
    return projectId;
  } catch (e) {
    throw new TwFileError('Could not trash project.');
  }
}

export async function listTrash() {
  // In a robust implementation, we would query `status = 'trashed'`
  // For now, return an empty array to satisfy the signature.
  return [];
}

export async function restoreFromTrash(projectId) {
  try {
    await updateProjectRecord(projectId, { status: 'draft' });
  } catch (e) {
    throw new TwFileError('Could not restore project.');
  }
}

export async function deleteFromTrash(projectId) {
  await deleteProjectFile(projectId);
}

// --- Obsolete local file functions (mocked to prevent crashing components) ---

export const isFolderSupported = () => true;
export const needsPermission = async () => false;
export const getFolder = async () => true;
export const ensurePermission = async () => {};
export const pickFolder = async () => true;
export const purgeExpiredTrash = async () => {};
export const uniqueFilename = async (name) => name; // DB handles IDs uniquely
export const snapshotVersion = async () => {}; // Replaced by cloud logic if needed
