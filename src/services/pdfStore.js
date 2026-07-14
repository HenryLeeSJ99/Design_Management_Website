/**
 * pdfStore.js
 * IndexedDB storage for PDF files attached to the project (calculation
 * report PDFs and user-added documents). localStorage is far too small for
 * PDFs, so only lightweight metadata lives in the project store — the bytes
 * live here, keyed by a generated id.
 */

const DB_NAME = 'tempworks-files';
const STORE = 'pdfs';

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Could not open local file storage.'));
  });
}

function run(mode, operation) {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const request = operation(tx.objectStore(STORE));
        tx.oncomplete = () => { db.close(); resolve(request.result); };
        tx.onerror = () => { db.close(); reject(tx.error); };
      }),
  );
}

export const generatePdfId = () =>
  `pdf_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

/** Store PDF bytes (ArrayBuffer) under the given id. */
export const putPdf = (id, bytes) => run('readwrite', (store) => store.put(bytes, id));

/** Fetch PDF bytes (ArrayBuffer) or undefined if missing. */
export const getPdf = (id) => run('readonly', (store) => store.get(id));

export const deletePdf = (id) => run('readwrite', (store) => store.delete(id));
