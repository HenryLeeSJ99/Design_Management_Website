/**
 * twFile.js
 * Reads and writes the .tw project file — one self-contained TempWorks project,
 * PDFs and all.
 *
 * A .tw file is the source of truth for a project. Everything the browser holds
 * (localStorage project state, the IndexedDB pdf cache) is a working copy of a
 * .tw sitting in the engineer's own folder, so a project survives clearing site
 * data, moving machine, or the app going away entirely.
 *
 * A .tw is a ZIP:
 *
 *   manifest.json      the project — cover, calculations, drawings, markups
 *   pdfs/<pdfId>.pdf   one entry per attached PDF, stored uncompressed
 *
 * ZIP rather than a bespoke container so the format has a floor: if this app
 * ever fails to open a file, an engineer can rename it .zip and pull their
 * drawings out by hand. That escape hatch is worth more than the few KB the
 * container costs.
 *
 * PDFs are already compressed, so they are stored at level 0 — recompressing
 * them burns CPU on every autosave to save almost nothing. The manifest is
 * small and text, so it does get compressed.
 */

import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';

export const TW_VERSION = 1;
export const TW_EXTENSION = '.tw';

const MANIFEST = 'manifest.json';
const PDF_DIR = 'pdfs/';

/** Thrown for anything that isn't a readable .tw file. Message is user-facing. */
export class TwFileError extends Error {
  constructor(message) {
    super(message);
    this.name = 'TwFileError';
  }
}

const asBytes = (blob) => {
  if (blob instanceof Uint8Array) return blob;
  if (blob instanceof ArrayBuffer) return new Uint8Array(blob);
  if (ArrayBuffer.isView(blob)) return new Uint8Array(blob.buffer, blob.byteOffset, blob.byteLength);
  throw new TwFileError('A PDF could not be read as bytes.');
};

/** pdfId -> zip entry name. Kept reversible so decode can recover the id. */
const entryName = (pdfId) => `${PDF_DIR}${encodeURIComponent(pdfId)}.pdf`;
const pdfIdFromEntry = (name) => decodeURIComponent(name.slice(PDF_DIR.length, -4));

/**
 * Pack a project and its PDFs into one .tw file.
 *
 * @param {object} project  the stored project (name, cover, calculations, ...)
 * @param {Map<string, ArrayBuffer|Uint8Array>} pdfs  pdfId -> bytes
 * @returns {Uint8Array} the complete file
 */
export function encodeTw(project, pdfs) {
  const entries = [...(pdfs instanceof Map ? pdfs : new Map(Object.entries(pdfs || {})))];

  const files = {
    [MANIFEST]: strToU8(JSON.stringify({
      app: 'tempworks',
      kind: 'project',
      version: TW_VERSION,
      savedAt: Date.now(),
      project,
    }, null, 2)),
  };
  for (const [id, raw] of entries) {
    // level 0: a PDF is already deflated; recompressing costs time for ~nothing
    files[entryName(id)] = [asBytes(raw), { level: 0 }];
  }

  return zipSync(files, { level: 6 });
}

/** Pull the entries out of a .tw, turning any zip failure into a TwFileError. */
function readEntries(data, filter) {
  const bytes = asBytes(data);
  if (bytes.byteLength < 4 || bytes[0] !== 0x50 || bytes[1] !== 0x4b) {
    // No "PK" signature — not a zip, so not one of ours
    throw new TwFileError('This is not a TempWorks project file.');
  }
  try {
    return unzipSync(bytes, filter ? { filter } : undefined);
  } catch {
    throw new TwFileError('This project file is damaged and could not be read.');
  }
}

/** Validate and parse manifest.json out of an unzipped entry set. */
function readManifest(entries) {
  if (!entries[MANIFEST]) {
    throw new TwFileError('This file does not contain a TempWorks project.');
  }
  let manifest;
  try {
    manifest = JSON.parse(strFromU8(entries[MANIFEST]));
  } catch {
    throw new TwFileError('This project file is damaged and could not be read.');
  }
  if (manifest?.app !== 'tempworks' || manifest?.kind !== 'project' || !manifest.project) {
    throw new TwFileError('This file does not contain a TempWorks project.');
  }
  if (manifest.version > TW_VERSION) {
    throw new TwFileError(
      `This project was saved by a newer version of TempWorks (file v${manifest.version}, this app reads v${TW_VERSION}). Update the app to open it.`,
    );
  }
  return manifest;
}

/**
 * Unpack a .tw file.
 *
 * Every failure is reported as a TwFileError with a message worth showing the
 * engineer — a truncated or foreign file must never surface as a raw error from
 * somewhere inside the zip reader.
 *
 * @param {ArrayBuffer|Uint8Array} data
 * @returns {{project: object, pdfs: Map<string, ArrayBuffer>, savedAt: number, version: number}}
 */
export function decodeTw(data) {
  const entries = readEntries(data);
  const manifest = readManifest(entries);

  const pdfs = new Map();
  for (const [name, bytes] of Object.entries(entries)) {
    if (name.startsWith(PDF_DIR) && name.endsWith('.pdf')) {
      // .slice() so each PDF owns its buffer, independent of the zip's
      pdfs.set(pdfIdFromEntry(name), bytes.slice().buffer);
    }
  }

  return {
    project: manifest.project,
    pdfs,
    savedAt: manifest.savedAt || 0,
    version: manifest.version,
  };
}

/**
 * Read just the manifest — enough to draw a project card without inflating the
 * PDFs, which is what keeps a folder of projects cheap to list.
 */
export function peekTw(data) {
  const entries = readEntries(data, (f) => f.name === MANIFEST);
  const manifest = readManifest(entries);
  const project = manifest.project || {};
  const items = Array.isArray(project.calculations) ? project.calculations : [];
  return {
    project,
    savedAt: manifest.savedAt || 0,
    version: manifest.version,
    calculationCount: items.filter((c) => (c.type || 'calculation') === 'calculation').length,
    drawingCount: items.filter((c) => c.type === 'drawing').length,
    documentCount: items.filter((c) => c.type === 'pdf').length,
  };
}

/**
 * Turn a project name into a safe .tw filename. Spaces are kept — these land in
 * the engineer's own folder, and "P26023 KYLIEZ.tw" reads better than a slug.
 */
export const twFilename = (name) => {
  // Control codes are dropped by code point rather than by a regex escape:
  // literal control bytes in a source regex are invisible and trip linters.
  const printable = [...String(name ?? '')]
    .filter((ch) => ch.codePointAt(0) >= 0x20)
    .join('');
  const safe = printable
    .replace(/[<>:"/\\|?*]/g, '-') // characters Windows forbids in a filename
    .replace(/\s+/g, ' ')
    .replace(/^\.+/, '') // a leading dot would hide the file
    .trim()
    .slice(0, 80)
    .trim() || 'project';
  return `${safe}${TW_EXTENSION}`;
};
