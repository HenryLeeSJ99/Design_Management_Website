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
import { clearAllPdfs, getPdf, putPdf } from './pdfStore';
import { readProjectFile, writeProjectFile } from './projectFiles';
import { decodeTw, encodeTw } from './twFile';

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
    await writeProjectFile(filename, encodeTw(project, pdfs));
    emit('saved', { at: Date.now() });
    return filename;
  } catch (e) {
    emit('error', { message: e?.message || 'The project could not be saved.' });
    throw e;
  }
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
  emit('saved', { at: Date.now() });
  return project;
}

/** Create a new .tw and open it. */
export async function createProject(filename, name) {
  const project = { name, coverPage: false, calculations: [] };
  await writeProjectFile(filename, encodeTw(project, new Map()));
  await clearAllPdfs();
  localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(project));
  setOpenFilename(filename);
  emit('saved', { at: Date.now() });
  return project;
}

/** Flush pending work and detach from the file, leaving the working copy be. */
export async function closeProject() {
  await flush();
  setOpenFilename(null);
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
