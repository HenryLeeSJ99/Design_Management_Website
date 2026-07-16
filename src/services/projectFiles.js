/**
 * projectFiles.js
 * The engineer's projects folder — a real folder on their disk holding .tw files.
 *
 * This is what makes a .tw the source of truth rather than a download: the app
 * asks once for a folder, keeps the handle, and from then on reads and writes
 * project files in place. Browser storage becomes a working copy of what is on
 * disk, so clearing site data or moving machine no longer loses a drawing.
 *
 * Only Chromium browsers implement the File System Access API. Everywhere else
 * `isFolderSupported()` is false and the app falls back to opening and saving
 * .tw files through the normal download/upload path — same format, more steps.
 */

import { TwFileError, TW_EXTENSION, peekTw, twFilename } from './twFile';

// Deliberately its own database, not pdfStore's 'tempworks-files'. Sharing one
// would mean bumping that database's version from two different modules, and
// whichever opened at the lower version would fail with a VersionError.
const HANDLE_DB = 'tempworks-handles';
const HANDLE_STORE = 'handles';
const HANDLE_KEY = 'projects-dir';

/** Can this browser hold a folder open across visits? */
export const isFolderSupported = () =>
  typeof window !== 'undefined' && 'showDirectoryPicker' in window;

// --- Persisting the folder handle -------------------------------------------
// A FileSystemDirectoryHandle is structured-cloneable, so IndexedDB can store
// it and the app can reconnect to the same folder on the next visit without
// asking again. localStorage cannot — it is strings only.

function openHandleDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(HANDLE_DB, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(HANDLE_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Could not open local storage.'));
  });
}

function handleTx(mode, operation) {
  return openHandleDb().then(
    (db) => new Promise((resolve, reject) => {
      const tx = db.transaction(HANDLE_STORE, mode);
      const request = operation(tx.objectStore(HANDLE_STORE));
      tx.oncomplete = () => { db.close(); resolve(request?.result); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    }),
  );
}

const rememberHandle = (handle) => handleTx('readwrite', (s) => s.put(handle, HANDLE_KEY));
const recallHandle = () => handleTx('readonly', (s) => s.get(HANDLE_KEY));
export const forgetFolder = () => handleTx('readwrite', (s) => s.delete(HANDLE_KEY));

/**
 * The folder handle if we already have permission, else null.
 *
 * Permission can lapse between visits, and re-requesting it needs a user
 * gesture — so this only ever *queries*. A caller reacting to a click should
 * use pickFolder() or ensurePermission() instead.
 */
export async function getFolder({ prompt = false } = {}) {
  if (!isFolderSupported()) return null;
  let handle;
  try {
    handle = await recallHandle();
  } catch {
    return null;
  }
  if (!handle) return null;

  const opts = { mode: 'readwrite' };
  if ((await handle.queryPermission(opts)) === 'granted') return handle;
  if (!prompt) return null;
  // Needs a user gesture; throws otherwise, which is not an error worth showing
  try {
    if ((await handle.requestPermission(opts)) === 'granted') return handle;
  } catch { /* no gesture — treat as not granted */ }
  return null;
}

/** True when a folder is remembered but its permission needs re-granting. */
export async function needsPermission() {
  if (!isFolderSupported()) return false;
  const handle = await recallHandle().catch(() => null);
  if (!handle) return false;
  return (await handle.queryPermission({ mode: 'readwrite' })) !== 'granted';
}

/** Ask the engineer to nominate a projects folder. Must be called from a click. */
export async function pickFolder() {
  if (!isFolderSupported()) {
    throw new TwFileError('This browser cannot open a folder. Use Chrome or Edge, or import and export .tw files instead.');
  }
  let handle;
  try {
    handle = await window.showDirectoryPicker({ id: 'tempworks-projects', mode: 'readwrite' });
  } catch (e) {
    if (e?.name === 'AbortError') return null; // the engineer cancelled — not an error
    throw new TwFileError('The folder could not be opened.');
  }
  if ((await handle.requestPermission({ mode: 'readwrite' })) !== 'granted') {
    throw new TwFileError('TempWorks needs permission to read and write that folder.');
  }
  await rememberHandle(handle);
  return handle;
}

/** Re-grant permission on a remembered folder. Must be called from a click. */
export async function ensurePermission() {
  const handle = await getFolder({ prompt: true });
  if (!handle) throw new TwFileError('TempWorks needs permission to read that folder again.');
  return handle;
}

// --- Reading and writing project files --------------------------------------

/**
 * Every .tw in the folder, summarised for a project card.
 *
 * Reads each file's manifest only, never its PDFs. A file that fails to parse
 * is reported rather than skipped or thrown — one bad project must not hide the
 * others, and silence would be worse than a broken card.
 */
export async function listProjects(handle) {
  const dir = handle || (await getFolder());
  if (!dir) return [];

  const projects = [];
  for await (const entry of dir.values()) {
    if (entry.kind !== 'file' || !entry.name.toLowerCase().endsWith(TW_EXTENSION)) continue;
    try {
      const file = await entry.getFile();
      const info = peekTw(await file.arrayBuffer());
      projects.push({
        filename: entry.name,
        name: info.project?.name || entry.name.replace(/\.tw$/i, ''),
        cover: info.project?.cover || null,
        calculationCount: info.calculationCount,
        drawingCount: info.drawingCount,
        documentCount: info.documentCount,
        size: file.size,
        modifiedAt: file.lastModified,
        savedAt: info.savedAt,
        error: null,
      });
    } catch (e) {
      projects.push({
        filename: entry.name,
        name: entry.name.replace(/\.tw$/i, ''),
        error: e instanceof TwFileError ? e.message : 'This project file could not be read.',
        size: 0,
        modifiedAt: 0,
      });
    }
  }
  return projects.sort((a, b) => (b.modifiedAt || 0) - (a.modifiedAt || 0));
}

/** Raw bytes of one project file. */
export async function readProjectFile(filename, handle) {
  const dir = handle || (await getFolder());
  if (!dir) throw new TwFileError('No projects folder is open.');
  try {
    const entry = await dir.getFileHandle(filename);
    return await (await entry.getFile()).arrayBuffer();
  } catch (e) {
    if (e?.name === 'NotFoundError') throw new TwFileError(`"${filename}" is no longer in the projects folder.`);
    throw e;
  }
}

/**
 * Write bytes to a project file, creating it if needed.
 *
 * createWritable() stages the write and swaps it in on close(), so a crash
 * mid-write leaves the previous version intact rather than a half file.
 */
export async function writeProjectFile(filename, bytes, handle) {
  const dir = handle || (await getFolder());
  if (!dir) throw new TwFileError('No projects folder is open.');
  const entry = await dir.getFileHandle(filename, { create: true });
  const writable = await entry.createWritable();
  try {
    await writable.write(bytes);
  } finally {
    await writable.close();
  }
  return filename;
}

export async function deleteProjectFile(filename, handle) {
  const dir = handle || (await getFolder());
  if (!dir) throw new TwFileError('No projects folder is open.');
  await dir.removeEntry(filename);
}

/** True if the folder already holds this filename. */
export async function fileExists(filename, handle) {
  const dir = handle || (await getFolder());
  if (!dir) return false;
  try {
    await dir.getFileHandle(filename);
    return true;
  } catch {
    return false;
  }
}

/**
 * A filename for `name` that no existing file is using: "KYLIEZ.tw",
 * "KYLIEZ (2).tw", ... so creating or duplicating a project can never
 * silently overwrite one already in the folder.
 */
export async function uniqueFilename(name, handle) {
  const base = twFilename(name).slice(0, -TW_EXTENSION.length);
  let candidate = `${base}${TW_EXTENSION}`;
  let n = 2;
  while (await fileExists(candidate, handle)) {
    candidate = `${base} (${n})${TW_EXTENSION}`;
    n += 1;
  }
  return candidate;
}
