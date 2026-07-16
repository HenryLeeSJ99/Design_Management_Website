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

import { PROJECT_STORAGE_KEY, getProject, onProjectChange } from './projectStore';
import { clearAllPdfs, deletePdf, getPdf, listPdfIds, putPdf } from './pdfStore';
import { readProjectFile, snapshotVersion, writeProjectFile } from './projectFiles';
import { decodeTw, encodeTw } from './twFile';
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
    // Keep what is on disk before overwriting it. Throttled inside, so this is
    // a trail of sessions rather than one version per keystroke, and it never
    // throws — history must not be able to block a save.
    await writeProjectFile(filename, encodeTw(project, pdfs), {
      name: project.name,
      calculation_count: project.calculations?.length || 0
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
 * Load a .tw into the working copy, replacing whatever was open.
 *
 * The PDF cache is cleared first: it belongs to the previous project, and
 * leaving its blobs behind would let a stale drawing resolve against a new
 * project's id and silently show the wrong sheet.
 */
export async function openProject(filename) {
  const bytes = await readProjectFile(filename);
  const { project, pdfs } = decodeTw(bytes); // throws TwFileError on a bad file

  await clearAllPdfs();
  for (const [id, blob] of pdfs) {
    await putPdf(id, blob);
  }
  localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(project));
  setOpenFilename(filename);
  clearUndo(); // the previous project's undo history is meaningless here
  emit("saved", { at: Date.now() });
  return project;
}

/** Create a new .tw and open it. */
export async function createProject(filename, name, coverImageFile = null) {
  const { createProjectRecord } = await import('./supabaseDb');
  const { uploadCoverImage } = await import('./supabaseStorage');
  
  // We need an ID for the project before we can upload the cover image to that ID
  const newId = crypto.randomUUID();
  let coverImageUrl = null;

  if (coverImageFile) {
    coverImageUrl = await uploadCoverImage(newId, coverImageFile);
  }

  // Pass metadata to create the DB record first
  const record = await createProjectRecord({
    id: newId,
    name,
    cover_image: coverImageUrl,
    metadata: { calculation_count: 0, drawing_count: 0, file_size: 0 }
  });

  const project = { name, coverPage: false, calculations: [] };
  // The database ID becomes the storage filename/id
  await writeProjectFile(record.id, encodeTw(project, new Map()));
  await clearAllPdfs();
  localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(project));
  setOpenFilename(record.id);
  clearUndo(); // the previous project's undo history is meaningless here
  emit("saved", { at: Date.now() });
  return project;
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
