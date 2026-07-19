/**
 * Upload ceilings, in one place so every entry point shares them and the
 * message stays consistent.
 *
 * The check is on file.size — cheap, and decided BEFORE any bytes are read, so
 * an oversized file never reaches memory. A 35 MB scan nearly hung the drawing
 * viewer (pdf.js renders to a full-size canvas) and bloated every cloud save;
 * this is the door it should have been stopped at.
 */

// A formwork drawing or report. Above this a PDF is almost always a
// full-resolution scan. Kept under Supabase's 50 MB per-file cap so an
// over-limit file is refused here with a clear message, not by the server
// with an opaque one.
export const MAX_PDF_BYTES = 25 * 1024 * 1024;

const formatMB = (bytes) => `${(bytes / (1024 * 1024)).toFixed(0)} MB`;

/** Throw a user-facing Error if the file is over the PDF ceiling. */
export function assertPdfSize(file) {
  if (file.size > MAX_PDF_BYTES) {
    throw new Error(
      `"${file.name}" is ${formatMB(file.size)}. The limit is ${formatMB(MAX_PDF_BYTES)} — `
      + 'a drawing this large is usually a full-resolution scan. Reduce or flatten it '
      + '(most PDF tools have a "compress" or "reduce file size" option) and try again.',
    );
  }
}
