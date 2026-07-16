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

// --- Trash --------------------------------------------------------------
// Deleting a project is the most destructive thing the app can do, and a
// confirm() is thin protection for a file holding every drawing on a job. A
// delete moves the .tw into a trash folder instead; it is only really gone
// after TRASH_DAYS, or when the engineer says so.

const TRASH_DIR = '.tw-trash';
export const TRASH_DAYS = 30;

const subdir = async (name, handle, { create = false } = {}) => {
  const dir = handle || (await getFolder());
  if (!dir) throw new TwFileError('No projects folder is open.');
  try {
    return await dir.getDirectoryHandle(name, { create });
  } catch (e) {
    if (e?.name === 'NotFoundError') return null;
    throw e;
  }
};

const daysSince = (ts) => (Date.now() - ts) / 86400000;

/** Move a project into the trash. Returns the name it took there. */
export async function trashProject(filename, handle) {
  const dir = handle || (await getFolder());
  if (!dir) throw new TwFileError('No projects folder is open.');

  const bytes = await readProjectFile(filename, dir);
  const trash = await dir.getDirectoryHandle(TRASH_DIR, { create: true });

  // The write time in the trash is the deletion time — that is what the
  // 30-day sweep measures, so no separate index can drift out of sync.
  const target = await uniqueFilename(filename.replace(/\.tw$/i, ''), trash);
  await writeProjectFile(target, new Uint8Array(bytes), trash);
  await dir.removeEntry(filename);
  return target;
}

/** Everything in the trash, newest first, with how long each has left. */
export async function listTrash(handle) {
  const trash = await subdir(TRASH_DIR, handle);
  if (!trash) return [];

  const items = [];
  for await (const entry of trash.values()) {
    if (entry.kind !== 'file' || !entry.name.toLowerCase().endsWith(TW_EXTENSION)) continue;
    const file = await entry.getFile();
    let name = entry.name.replace(/\.tw$/i, '');
    try {
      name = peekTw(await file.arrayBuffer()).project?.name || name;
    } catch { /* unreadable — the filename is still worth showing */ }
    items.push({
      filename: entry.name,
      name,
      size: file.size,
      deletedAt: file.lastModified,
      daysLeft: Math.max(0, Math.ceil(TRASH_DAYS - daysSince(file.lastModified))),
    });
  }
  return items.sort((a, b) => b.deletedAt - a.deletedAt);
}

/** Put a trashed project back in the projects folder. */
export async function restoreFromTrash(filename, handle) {
  const dir = handle || (await getFolder());
  if (!dir) throw new TwFileError('No projects folder is open.');
  const trash = await subdir(TRASH_DIR, dir);
  if (!trash) throw new TwFileError('There is no trash folder.');

  const bytes = await readProjectFile(filename, trash);
  // Never clobber a live project that has taken the name back since
  const target = await uniqueFilename(filename.replace(/\.tw$/i, ''), dir);
  await writeProjectFile(target, new Uint8Array(bytes), dir);
  await trash.removeEntry(filename);
  return target;
}

export async function deleteFromTrash(filename, handle) {
  const trash = await subdir(TRASH_DIR, handle);
  if (!trash) return;
  await trash.removeEntry(filename);
}

/**
 * Delete trashed projects past their retention. Returns how many went.
 *
 * Called when the Projects page lists the folder, so the sweep happens as a
 * side effect of looking rather than needing a scheduler.
 */
export async function purgeExpiredTrash(handle) {
  const trash = await subdir(TRASH_DIR, handle);
  if (!trash) return 0;

  const expired = [];
  for await (const entry of trash.values()) {
    if (entry.kind !== 'file' || !entry.name.toLowerCase().endsWith(TW_EXTENSION)) continue;
    const file = await entry.getFile();
    if (daysSince(file.lastModified) >= TRASH_DAYS) expired.push(entry.name);
  }
  for (const name of expired) {
    await trash.removeEntry(name).catch(() => {});
  }
  return expired.length;
}

// --- Version history ----------------------------------------------------
// Undo only reaches back as far as the tab has been open. History is the part
// that survives closing the app: each version is the file exactly as it stood
// before a later save overwrote it.

const HISTORY_DIR = '.tw-history';
const SNAPSHOT_EVERY_MS = 5 * 60 * 1000;
const KEEP_VERSIONS = 12;

/** ".tw-history/<project base>/" — one folder per project. */
const historyFolderFor = async (filename, handle, { create = false } = {}) => {
  const root = await subdir(HISTORY_DIR, handle, { create });
  if (!root) return null;
  const base = filename.replace(/\.tw$/i, '');
  try {
    return await root.getDirectoryHandle(base, { create });
  } catch (e) {
    if (e?.name === 'NotFoundError') return null;
    throw e;
  }
};

// Sortable, filename-safe, readable, and unique to the millisecond:
// 2026-07-16T01-23-45-678.tw. Second precision was not enough — two snapshots
// in the same second collided, and one silently overwrote the other.
const stampName = (ts) => `${new Date(ts).toISOString().replace(/[:.]/g, '-').replace(/Z$/, '')}${TW_EXTENSION}`;

/**
 * Keep the current contents of a project file as a version, then prune.
 *
 * Throttled: autosave fires seconds after every keystroke, and a version per
 * keystroke would bury the useful ones and fill the disk with 5 MB files. A
 * snapshot is taken only if the newest one is older than SNAPSHOT_EVERY_MS,
 * which makes history a trail of sessions rather than of characters typed.
 *
 * Best-effort by design — a failure here must never block the save itself.
 */
export async function snapshotVersion(filename, handle, { force = false } = {}) {
  try {
    const dir = handle || (await getFolder());
    if (!dir || !(await fileExists(filename, dir))) return null;

    const existing = await listVersions(filename, dir);
    if (!force && existing.length && Date.now() - existing[0].savedAt < SNAPSHOT_EVERY_MS) {
      return null;
    }

    const bytes = await readProjectFile(filename, dir);
    const folder = await historyFolderFor(filename, dir, { create: true });
    await writeProjectFile(stampName(Date.now()), new Uint8Array(bytes), folder);

    // Prune oldest beyond the cap
    const after = await listVersions(filename, dir);
    for (const old of after.slice(KEEP_VERSIONS)) {
      await folder.removeEntry(old.filename).catch(() => {});
    }
    return true;
  } catch {
    return null; // history is a safety net, not a precondition for saving
  }
}

/** Versions of a project, newest first. */
export async function listVersions(filename, handle) {
  const folder = await historyFolderFor(filename, handle).catch(() => null);
  if (!folder) return [];
  const versions = [];
  for await (const entry of folder.values()) {
    if (entry.kind !== 'file' || !entry.name.toLowerCase().endsWith(TW_EXTENSION)) continue;
    const file = await entry.getFile();
    versions.push({ filename: entry.name, size: file.size, savedAt: file.lastModified });
  }
  return versions.sort((a, b) => b.savedAt - a.savedAt);
}

/**
 * Put a version back as the live project.
 *
 * The current file is snapshotted first, so restoring is itself reversible —
 * picking the wrong version must not be the thing that loses the work.
 */
export async function restoreVersion(filename, versionFilename, handle) {
  const dir = handle || (await getFolder());
  if (!dir) throw new TwFileError('No projects folder is open.');
  const folder = await historyFolderFor(filename, dir);
  if (!folder) throw new TwFileError('This project has no version history.');

  // Read the target version into memory BEFORE snapshotting the current file.
  // The snapshot writes into the same history folder, so reading first means a
  // name clash can never cost us the version we are about to restore.
  const bytes = await readProjectFile(versionFilename, folder);
  await snapshotVersion(filename, dir, { force: true });
  await writeProjectFile(filename, new Uint8Array(bytes), dir);
  return filename;
}
