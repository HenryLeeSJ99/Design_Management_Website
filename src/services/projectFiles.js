import {
  deleteStorageFile, downloadProjectFile, downloadVersionObject, listVersionObjects,
  removeVersionObjects, uploadProjectFile, uploadVersionObject,
} from './supabaseStorage';
import {
  deleteProjectRecord, fetchProjects, fetchTrashedProjects, updateProjectRecord,
} from './supabaseDb';
import { TwFileError } from './twFile';
import { PROJECT_STATUSES } from './projectStatus';

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
  } catch {
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

/**
 * Move a project along its lifecycle (draft → active → completed).
 *
 * Rejects 'trashed' outright: binning a project has to go through
 * trashProject() so the 30-day purge clock and the trash view stay the only
 * path in and out of the bin.
 *
 * The role check lives in the UI. This is not the security boundary — the
 * RLS policy on the projects table is.
 */
export async function setProjectStatus(projectId, status) {
  if (!PROJECT_STATUSES.includes(status)) {
    throw new TwFileError(`"${status}" is not a project status that can be set here.`);
  }
  try {
    await updateProjectRecord(projectId, { status });
    return projectId;
  } catch (e) {
    throw new TwFileError(`Could not change the project status: ${e.message}`);
  }
}

// --- Trash functionality ---
// Since we are moving to a fully database-driven model, trash can just be a status flag.
// For this migration, we'll keep the signatures intact but implement them as status updates.

export async function trashProject(projectId) {
  try {
    await updateProjectRecord(projectId, { status: 'trashed' });
    return projectId;
  } catch {
    throw new TwFileError('Could not trash project.');
  }
}

export async function listTrash() {
  const records = await fetchTrashedProjects();
  const now = Date.now();
  return records.map((r) => ({
    ...r,
    filename: r.id,
    name: r.name,
    size: r.file_size,
    // last_modified_at doubles as "trashed at" — see fetchTrashedProjects()
    deletedAt: new Date(r.last_modified_at).getTime(),
    daysLeft: Math.max(0, Math.ceil(TRASH_DAYS - (now - new Date(r.last_modified_at).getTime()) / 86400000)),
  }));
}

export async function restoreFromTrash(projectId) {
  try {
    await updateProjectRecord(projectId, { status: 'draft' });
  } catch {
    throw new TwFileError('Could not restore project.');
  }
}

export async function deleteFromTrash(projectId) {
  await deleteProjectFile(projectId);
  await removeVersionObjects(projectId).catch(() => {}); // no orphaned history left behind
}

/**
 * Permanently delete anything that has sat in the trash for TRASH_DAYS.
 * Best-effort per project: one failure must not stop the rest from being
 * swept. Meant to be called opportunistically whenever the trash is listed —
 * there is no background job here, just a check on the way in.
 */
export async function purgeExpiredTrash() {
  let purged = 0;
  let trashed;
  try {
    trashed = await fetchTrashedProjects();
  } catch {
    return 0; // a failed read must not block whoever called this to list projects
  }
  const now = Date.now();
  for (const record of trashed) {
    const ageDays = (now - new Date(record.last_modified_at).getTime()) / 86400000;
    if (ageDays < TRASH_DAYS) continue;
    try {
      await deleteFromTrash(record.id);
      purged += 1;
    } catch { /* leave it for the next sweep to retry */ }
  }
  return purged;
}

// --- Version history ---
// Kept as objects in Storage under versions/{projectId}/{timestamp}.tw rather
// than a database table — no schema change needed, and it mirrors exactly how
// the project's own .tw blob is stored.

const SNAPSHOT_EVERY_MS = 5 * 60 * 1000;
const KEEP_VERSIONS = 12;

/**
 * Keep the project's current cloud contents as a version, then prune older
 * ones. Throttled: a save fires seconds after every keystroke, and a version
 * per keystroke would bury the useful ones. Best-effort — must never block a
 * save.
 */
export async function snapshotVersion(projectId) {
  try {
    const existing = await listVersions(projectId);
    if (existing.length && Date.now() - existing[0].savedAt < SNAPSHOT_EVERY_MS) return null;

    const bytes = await downloadProjectFile(projectId).catch(() => null);
    if (!bytes) return null; // nothing live yet to snapshot (e.g. a brand-new project)
    await uploadVersionObject(projectId, bytes);

    const after = await listVersions(projectId);
    const stale = after.slice(KEEP_VERSIONS).map((v) => v.filename);
    if (stale.length) await removeVersionObjects(projectId, stale).catch(() => {});
    return true;
  } catch {
    return null; // history is a safety net, not a precondition for saving
  }
}

/** Versions of a project, newest first. */
export async function listVersions(projectId) {
  const objects = await listVersionObjects(projectId);
  return objects
    .map((o) => ({ filename: o.name, size: o.metadata?.size || 0, savedAt: new Date(o.created_at || o.updated_at).getTime() }))
    .sort((a, b) => b.savedAt - a.savedAt);
}

/**
 * Put a version back as the project's live contents. The current live file is
 * snapshotted first, so restoring is itself reversible.
 */
export async function restoreVersion(projectId, versionFilename) {
  // Read the target version into memory BEFORE snapshotting the current file:
  // the snapshot writes into the same versions/ prefix, so if the two ever
  // landed on the same name a read-after-write would risk losing the very
  // version being restored.
  const bytes = await downloadVersionObject(projectId, versionFilename);
  await snapshotVersion(projectId);
  await writeProjectFile(projectId, new Uint8Array(bytes));
  return projectId;
}

// --- Obsolete local-folder functions (mocked so any leftover caller does not
// crash; the File System Access flow is retired in favour of the cloud) ---

export const isFolderSupported = () => true;
export const needsPermission = async () => false;
export const getFolder = async () => true;
export const ensurePermission = async () => {};
export const pickFolder = async () => true;
export const uniqueFilename = async (name) => name; // DB handles IDs uniquely
