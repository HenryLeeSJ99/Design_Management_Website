import {
  deleteStorageFile, downloadManifestObject, downloadPdfObject, downloadProjectFile,
  downloadVersionObject, listPdfObjectIds, listVersionObjects, removePdfObjects,
  removeSplitObjects, removeVersionObjects, uploadManifestObject, uploadPdfObject,
  uploadProjectFile, uploadVersionObject,
} from './supabaseStorage';
import {
  deleteProjectRecord, fetchProject, fetchProjects, fetchTrashedProjects,
  updateProjectRecord, updateProjectRecordIf,
} from './supabaseDb';
import { decodeTw, encodeTw, twManifestBytes, TwFileError } from './twFile';
import { PROJECT_STATUSES } from './projectStatus';
import { serialiseSubmissions } from './projectTimeline';

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

// --- Split layout (manifest + one object per PDF) ---
// The live project is stored as {id}/manifest.json plus {id}/pdfs/{pdfId}.pdf,
// so an ordinary save uploads the few-KB manifest instead of every PDF.
// {id}.tw remains the read fallback for projects saved before the split, and
// the on-disk EXPORT format — see supabaseStorage.js for the layout rationale.

/**
 * The split layout for one project: { project, pdfIds }, or null when the
 * project predates the split (caller falls back to the legacy blob).
 */
export async function readSplitProject(projectId) {
  const bytes = await downloadManifestObject(projectId);
  if (!bytes) return null;
  let manifest;
  try {
    manifest = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new TwFileError('The project manifest in the cloud is damaged.');
  }
  if (manifest?.app !== 'tempworks' || !manifest.project) {
    throw new TwFileError('The cloud manifest is not a TempWorks project.');
  }
  const pdfIds = await listPdfObjectIds(projectId);
  return { project: manifest.project, pdfIds };
}

export async function downloadSplitPdf(projectId, pdfId) {
  try {
    return await downloadPdfObject(projectId, pdfId);
  } catch {
    throw new TwFileError(`A PDF in this project could not be downloaded.`);
  }
}

export async function uploadSplitManifest(projectId, project) {
  try {
    await uploadManifestObject(projectId, twManifestBytes(project));
  } catch (e) {
    throw new TwFileError(`The project could not be saved to cloud: ${e.message}`);
  }
}

export async function uploadSplitPdf(projectId, pdfId, bytes) {
  try {
    await uploadPdfObject(projectId, pdfId, bytes);
  } catch (e) {
    throw new TwFileError(`A PDF could not be uploaded: ${e.message}`);
  }
}

export const removeSplitPdfs = (projectId, pdfIds) => removePdfObjects(projectId, pdfIds);

/**
 * Claim the right to save: bump the project's metadata ONLY IF nobody else
 * has saved since `expectedRev` (the last_modified_at we loaded). Returns the
 * fresh record on success, null when someone else got there first — in which
 * case the caller must NOT touch the stored objects.
 */
export async function claimProjectSave(projectId, meta, expectedRev) {
  try {
    return await updateProjectRecordIf(projectId, meta, expectedRev);
  } catch (e) {
    throw new TwFileError(`The save could not be recorded: ${e.message}`);
  }
}

/**
 * The current CLOUD contents assembled as one .tw — split layout if present,
 * legacy blob otherwise, null when nothing is stored yet. Used where the
 * cloud state (not the local working copy) is what must be preserved:
 * pre-restore snapshots, and keeping the other person's work when a save
 * conflict is resolved with "keep mine".
 */
export async function assembleCloudTw(projectId) {
  const split = await readSplitProject(projectId).catch(() => null);
  if (!split) {
    return await downloadProjectFile(projectId).catch(() => null);
  }
  const pdfs = new Map();
  for (const id of split.pdfIds) {
    const bytes = await downloadPdfObject(projectId, id).catch(() => null);
    if (bytes) pdfs.set(id, bytes);
  }
  return encodeTw(split.project, pdfs);
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

/** One project's record, or null when it isn't visible to this user. */
export async function readProject(projectId) {
  try {
    return await fetchProject(projectId);
  } catch (e) {
    throw new TwFileError(`Could not read the project: ${e.message}`);
  }
}

/**
 * Save a project's submission dates (per-zone target + milestone due/done).
 *
 * Only ever writes the timeline column, so it cannot collide with a designer
 * saving the .tw contents at the same moment — that save writes `zones`,
 * `name` and the counts, and the two never touch the same column. Which also
 * means the manager-only trigger on `timeline` never sees a designer's save.
 */
export async function saveSubmissions(projectId, submissions) {
  try {
    await updateProjectRecord(projectId, { timeline: serialiseSubmissions(submissions) });
    return projectId;
  } catch (e) {
    throw new TwFileError(`Could not save the submission dates: ${e.message}`);
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
    await updateProjectRecord(projectId, { status: 'active' });
  } catch {
    throw new TwFileError('Could not restore project.');
  }
}

export async function deleteFromTrash(projectId) {
  // Split objects first (manifest + PDFs), then the legacy blob + record,
  // then history. Each best-effort where the layout may simply not exist.
  await removeSplitObjects(projectId).catch(() => {});
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
 * How many versions to keep, given how big one version is.
 *
 * Every snapshot is a FULL copy of the .tw, so history multiplies storage by
 * the keep-count plus one. Twelve copies of a 300 KB project is nothing;
 * twelve copies of a 40 MB project is half a gigabyte of bucket for one job —
 * on Supabase's 1 GB free tier, two heavy projects would blow the quota on
 * history alone. Fewer, older-spaced restore points on a huge file protect
 * against the same disasters at a fraction of the storage.
 */
export function versionKeepCount(bytesPerVersion) {
  if (bytesPerVersion > 25 * 1024 * 1024) return 4;
  if (bytesPerVersion > 10 * 1024 * 1024) return 8;
  return KEEP_VERSIONS;
}

/**
 * Keep the project's current cloud contents as a version, then prune older
 * ones. Throttled: a save fires seconds after every keystroke, and a version
 * per keystroke would bury the useful ones. Best-effort — must never block a
 * save.
 */
/**
 * Store the given .tw bytes as a version, throttled and pruned. The caller
 * supplies the bytes, so the common case — the session snapshotting the copy
 * it already holds in memory — costs no download at all. `force` skips the
 * throttle for moments that must be captured (pre-restore, conflict rescue).
 */
export async function snapshotVersionBytes(projectId, bytes, { force = false } = {}) {
  try {
    const existing = await listVersions(projectId);
    if (!force && existing.length && Date.now() - existing[0].savedAt < SNAPSHOT_EVERY_MS) return null;

    await uploadVersionObject(projectId, bytes);

    const after = await listVersions(projectId);
    const stale = after.slice(versionKeepCount(bytes.byteLength)).map((v) => v.filename);
    if (stale.length) await removeVersionObjects(projectId, stale).catch(() => {});
    return true;
  } catch {
    return null; // history is a safety net, not a precondition for saving
  }
}

/** Snapshot the current CLOUD contents (split-aware). Downloads, so use only
 *  where the cloud state is the thing being protected. */
export async function snapshotVersion(projectId, { force = false } = {}) {
  try {
    if (!force) {
      // Check the throttle BEFORE paying for the download.
      const existing = await listVersions(projectId);
      if (existing.length && Date.now() - existing[0].savedAt < SNAPSHOT_EVERY_MS) return null;
    }
    const bytes = await assembleCloudTw(projectId);
    if (!bytes) return null; // nothing live yet to snapshot (e.g. a brand-new project)
    return await snapshotVersionBytes(projectId, new Uint8Array(bytes), { force: true });
  } catch {
    return null;
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
/**
 * Explode a .tw's contents into the split cloud layout: manifest, every PDF,
 * and metadata, removing any PDF objects the .tw does not contain. Used by
 * restore (versions are stored as whole .tw files) and by the legacy→split
 * migration path.
 */
export async function writeSplitFromTw(projectId, twBytes) {
  const { project, pdfs } = decodeTw(twBytes);
  await uploadSplitManifest(projectId, project);
  for (const [pdfId, bytes] of pdfs) {
    await uploadSplitPdf(projectId, pdfId, bytes);
  }
  const existing = await listPdfObjectIds(projectId).catch(() => []);
  const stale = existing.filter((id) => !pdfs.has(id));
  if (stale.length) await removePdfObjects(projectId, stale).catch(() => {});
  await updateProjectRecord(projectId, {
    name: project.name,
    calculation_count: project.calculations?.length || 0,
    drawing_count: project.calculations?.filter((c) => c.type === 'drawing').length || 0,
    file_size: twBytes.byteLength,
    zones: (project.zones || []).map(({ id, name, order }) => ({ id, name, order })),
  });
  return project;
}

export async function restoreVersion(projectId, versionFilename) {
  // Read the target version into memory BEFORE snapshotting the current
  // state: the snapshot writes into the same versions/ prefix, so if the two
  // ever landed on the same name a read-after-write would risk losing the
  // very version being restored.
  const bytes = await downloadVersionObject(projectId, versionFilename);
  // force: restoring is exactly the moment the state being replaced must be
  // captured, however recently the last snapshot happened.
  await snapshotVersion(projectId, { force: true });
  await writeSplitFromTw(projectId, new Uint8Array(bytes));
  // The restored state is now the split layout; a legacy blob would shadow
  // nothing (split wins on open), but remove it so storage is not doubled.
  await deleteStorageFile(projectId).catch(() => {});
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
