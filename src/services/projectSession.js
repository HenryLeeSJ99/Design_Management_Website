/**
 * projectSession.js
 * Binds the open .tw file to the app's working copy.
 *
 * The .tw on disk is the source of truth. Rather than rewrite every caller to
 * read from a file, opening a project hydrates the existing working copy —
 * localStorage for the project, IndexedDB for the PDFs — so the dashboard,
 * calculators, drawing viewer and compiler keep working unchanged. Edits then
 * flow back to the file: touch() marks the session dirty and a debounced save
 * writes the whole project out again.
 *
 * The bridge is deliberate. It keeps a large, already-verified surface intact
 * while moving the durable copy out of the browser and into a folder the
 * engineer owns and backs up.
 */

import { PROJECT_STORAGE_KEY, coverHasContent, getProject, onProjectChange } from './projectStore';
import { clearAllPdfs, deletePdf, getPdf, listPdfIds, putPdf } from './pdfStore';
import { readProjectFile, snapshotVersion, writeProjectFile } from './projectFiles';
import { decodeTw, encodeTw, twFilename } from './twFile';
import { clearUndo } from './undo';

// Which file the working copy came from. Kept out of the project itself so the
// same project copied to another name doesn't drag its old filename along.
const OPEN_FILE_KEY = 'tempworks_open_file';
const SAVE_DEBOUNCE_MS = 900;

let saveTimer = null;
let savingPromise = null;
let pendingAfterSave = false;
const listeners = new Set();

/** Filename of the currently open project, or null when nothing is open. */
export const getOpenFilename = () => {
  try {
    return localStorage.getItem(OPEN_FILE_KEY) || null;
  } catch {
    return null;
  }
};

const setOpenFilename = (filename) => {
  try {
    if (filename) localStorage.setItem(OPEN_FILE_KEY, filename);
    else localStorage.removeItem(OPEN_FILE_KEY);
  } catch { /* storage unavailable — the session just won't be remembered */ }
};

/** Subscribe to save-state changes: 'dirty' | 'saving' | 'saved' | 'error'. */
export function onSaveState(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
const emit = (state, detail) => listeners.forEach((l) => l(state, detail));

/** Every pdfId the project references, across calculations, drawings and docs. */
const referencedPdfIds = (project) => {
  const ids = new Set();
  for (const item of project.calculations || []) {
    if (item.pdfId) ids.add(item.pdfId);
  }
  return ids;
};

/**
 * Collect the project and its PDFs and write them to the open .tw.
 *
 * Only PDFs the project still references are written, so deleting an item
 * drops its bytes from the file rather than growing it forever.
 */
export async function saveNow() {
  const filename = getOpenFilename();
  if (!filename) return null;

  const project = getProject();
  const pdfs = new Map();
  for (const id of referencedPdfIds(project)) {
    const bytes = await getPdf(id);
    // A missing blob is not fatal: the item keeps its metadata and the file
    // simply carries no bytes for it, exactly as the working copy stands
    if (bytes) pdfs.set(id, bytes);
  }

  emit('saving');
  try {
    // Keep what is on the cloud before overwriting it. Throttled inside, so
    // this is a trail of sessions rather than one version per keystroke, and
    // it never throws — history must not be able to block a save.
    await snapshotVersion(filename);
    await writeProjectFile(filename, encodeTw(project, pdfs), {
      name: project.name,
      calculation_count: project.calculations?.length || 0,
      drawing_count: project.calculations?.filter((c) => c.type === 'drawing').length || 0,
      // Zones only exist inside the .tw, so the database cannot see them —
      // which is why per-zone submission dates had nowhere to hang. Copy them
      // up on every save. Deliberately NOT into `timeline`: that column is
      // gated to managers by a trigger, and this write happens on a designer's
      // ordinary save, which would then be refused. See
      // supabase/migrations/20260718_zones_column.sql.
      zones: (project.zones || []).map(({ id, name, order }) => ({ id, name, order })),
    });
    emit('saved', { at: Date.now() });

    // Sweep PDF blobs no live item references. Deleting an item no longer
    // deletes its bytes (so undo can bring it back), which leaves orphans in
    // the cache; they were just excluded from the file above, so dropping them
    // here loses nothing. Best-effort — a failed sweep never fails the save.
    sweepOrphanPdfs(project).catch(() => {});
    return filename;
  } catch (e) {
    emit('error', { message: e?.message || 'The project could not be saved.' });
    throw e;
  }
}

/** Drop cached PDF blobs that no item in the project points at. */
async function sweepOrphanPdfs(project) {
  const referenced = referencedPdfIds(project);
  const cached = await listPdfIds();
  await Promise.all(
    cached
      .filter((id) => !referenced.has(id))
      .map((id) => deletePdf(id).catch(() => {})),
  );
}

/**
 * Mark the working copy changed and schedule a save.
 *
 * Debounced because a save rewrites the whole file including its PDFs, and
 * typing in the cover editor fires on every keystroke. Saves never overlap: if
 * one is in flight, the next is queued so the last write always reflects the
 * final state.
 */
export function touch() {
  if (!getOpenFilename()) return;
  emit('dirty');
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    if (savingPromise) {
      pendingAfterSave = true;
      return;
    }
    savingPromise = saveNow()
      .catch(() => { /* already reported through emit('error') */ })
      .finally(() => {
        savingPromise = null;
        if (pendingAfterSave) {
          pendingAfterSave = false;
          touch();
        }
      });
  }, SAVE_DEBOUNCE_MS);
}

/** Write immediately if a save is pending — for closing or switching projects. */
export async function flush() {
  clearTimeout(saveTimer);
  if (savingPromise) await savingPromise.catch(() => {});
  if (getOpenFilename()) await saveNow().catch(() => {});
}

/**
 * Thrown by openProject/createProject when proceeding would silently destroy
 * a local draft that has never been saved anywhere. Callers must resolve the
 * draft (save it to the cloud, export it, or explicitly discard it) and retry
 * with { force: true }.
 */
export class UnsavedDraftError extends Error {
  constructor() {
    super('There is unsaved local work that has not been saved to a project or exported.');
    this.name = 'UnsavedDraftError';
  }
}

/**
 * True when the working copy holds real content that (a) came from a
 * calculator's "Save to project" or the cover editor rather than an opened
 * project, and (b) has never been pushed to a cloud project or exported.
 *
 * saveCalculation() writes straight into the local working copy with no idea
 * whether a cloud project is open — that is exactly how a draft with real
 * work in it can exist while getOpenFilename() is still null.
 */
export function hasUnsavedLocalDraft() {
  if (getOpenFilename()) return false; // already bound to a cloud project — every edit is already saved there
  const project = getProject();
  return project.calculations.length > 0 || project.zones.length > 0 || coverHasContent(project.cover);
}

/**
 * Load a .tw into the working copy, replacing whatever was open.
 *
 * The PDF cache is cleared first: it belongs to the previous project, and
 * leaving its blobs behind would let a stale drawing resolve against a new
 * project's id and silently show the wrong sheet.
 *
 * Refuses with UnsavedDraftError if that would silently discard a local
 * draft — pass { force: true } once the caller has resolved it.
 */
export async function openProject(filename, { force = false } = {}) {
  if (!force && hasUnsavedLocalDraft()) throw new UnsavedDraftError();

  const bytes = await readProjectFile(filename);
  const { project, pdfs } = decodeTw(bytes); // throws TwFileError on a bad file

  await clearAllPdfs();
  for (const [id, blob] of pdfs) {
    await putPdf(id, blob);
  }
  localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(project));
  setOpenFilename(filename);
  clearUndo(); // the previous project's undo history is meaningless here
  emit('saved', { at: Date.now() });
  return project;
}

/**
 * The guts of creating a cloud project record + its blob, shared by
 * createProject() (a blank project) and promoteLocalDraftToCloud() (the
 * current working copy's real content) so the two never drift apart.
 */
async function createProjectFromData(name, project, pdfs, coverImageFile) {
  const { createProjectRecord } = await import('./supabaseDb');
  const { uploadCoverImage } = await import('./supabaseStorage');

  // We need an ID for the project before we can upload the cover image to that ID
  const newId = crypto.randomUUID();
  let coverImageUrl = null;

  if (coverImageFile) {
    coverImageUrl = await uploadCoverImage(newId, coverImageFile);
  }

  const record = await createProjectRecord({
    id: newId,
    name,
    cover_image: coverImageUrl,
    metadata: {
      calculation_count: project.calculations.length,
      drawing_count: project.calculations.filter((c) => c.type === 'drawing').length,
      file_size: 0,
    },
  });

  // The database ID becomes the storage filename/id
  await writeProjectFile(record.id, encodeTw(project, pdfs));
  await clearAllPdfs();
  for (const [id, blob] of pdfs) {
    await putPdf(id, blob);
  }
  localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(project));
  setOpenFilename(record.id);
  clearUndo(); // the previous project's undo history is meaningless here
  emit('saved', { at: Date.now() });
  return project;
}

/**
 * Create a new, blank .tw and open it.
 *
 * Refuses with UnsavedDraftError if that would silently discard a local
 * draft — pass { force: true } once the caller has resolved it.
 */
export async function createProject(filename, name, coverImageFile = null, { force = false } = {}) {
  if (!force && hasUnsavedLocalDraft()) throw new UnsavedDraftError();
  return createProjectFromData(name, { name, coverPage: false, zones: [], calculations: [] }, new Map(), coverImageFile);
}

/**
 * Push the current local draft to the cloud as a brand-new project, carrying
 * over its real calculations, drawings, cover and PDFs — never a blank one.
 * This is the "save my unsaved work" half of the draft guard.
 */
export async function promoteLocalDraftToCloud(name, coverImageFile = null) {
  const project = getProject();
  const pdfs = new Map();
  for (const id of referencedPdfIds(project)) {
    const bytes = await getPdf(id);
    if (bytes) pdfs.set(id, bytes);
  }
  return createProjectFromData(name, { ...project, name }, pdfs, coverImageFile);
}

/**
 * Download the current local draft as a .tw file — the export half of the
 * draft guard, for anyone who would rather keep it as a file than push it to
 * the cloud right now.
 */
export async function exportLocalDraftAsTw() {
  const project = getProject();
  const pdfs = new Map();
  for (const id of referencedPdfIds(project)) {
    const bytes = await getPdf(id);
    if (bytes) pdfs.set(id, bytes);
  }
  const bytes = encodeTw(project, pdfs);
  const blob = new Blob([bytes], { type: 'application/zip' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = twFilename(project.name);
  a.click();
  URL.revokeObjectURL(url);
}

/** Flush pending work and detach from the file, leaving the working copy be. */
export async function closeProject() {
  await flush();
  setOpenFilename(null);
  clearUndo();
}

/** Point the session at a different file (after a rename) without reloading. */
export const rebindTo = (filename) => setOpenFilename(filename);

// Every change the app makes to the project flows back to the file. Registered
// once, when this module first loads.
onProjectChange(() => touch());

// A pending debounce would be lost if the tab closed first. This cannot await,
// so it is a best-effort flush rather than a guarantee — the debounce is short
// enough that the window is small, and the file keeps its previous good
// contents regardless.
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => {
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveNow().catch(() => {});
    }
  });
}
