/**
 * pdfCompile.js
 * Compiles the project into a single PDF:
 *   [auto-generated cover page (optional)] + every item in dashboard order.
 *
 * Calculation items contribute their attached report PDF (a placeholder page
 * is inserted when none is attached); 'pdf' items contribute the uploaded
 * file. The cover page carries the project name, basic stats and a table of
 * contents with page numbers.
 */

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { getPdf } from './pdfStore';
import { itemType, CALCULATORS } from './projectStore';

// A4 portrait, points
const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 56;

const INK = rgb(0.12, 0.16, 0.23); // slate-800
const MUTED = rgb(0.45, 0.51, 0.59); // slate-500
const ACCENT = rgb(0.15, 0.39, 0.92); // blue-600
const LINE = rgb(0.8, 0.84, 0.89); // slate-300

// Contents rows that fit: first cover page (below the header block) vs
// continuation pages (full height)
const TOC_ROWS_FIRST = 24;
const TOC_ROWS_NEXT = 38;

const itemLabel = (item) =>
  itemType(item) === 'pdf'
    ? 'PDF document'
    : CALCULATORS[item.calculator]?.title || item.calculator;

function coverPageCount(itemCount) {
  if (itemCount <= TOC_ROWS_FIRST) return 1;
  return 1 + Math.ceil((itemCount - TOC_ROWS_FIRST) / TOC_ROWS_NEXT);
}

const truncate = (text, max) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

export async function compileProjectPdf(project) {
  const items = project.calculations;
  const warnings = [];

  // Load every item's PDF up front so page counts are known for the TOC
  const loaded = [];
  for (const item of items) {
    let doc = null;
    if (item.pdfId) {
      const bytes = await getPdf(item.pdfId);
      if (bytes) {
        try {
          doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
        } catch {
          warnings.push(`"${item.name}": the stored file could not be read as a PDF — placeholder page inserted.`);
        }
      } else {
        warnings.push(`"${item.name}": its PDF was not found on this device — placeholder page inserted.`);
      }
    } else if (itemType(item) === 'calculation') {
      warnings.push(`"${item.name}": no report PDF attached — placeholder page inserted.`);
    }
    loaded.push({ item, doc });
  }

  const out = await PDFDocument.create();
  const font = await out.embedFont(StandardFonts.Helvetica);
  const bold = await out.embedFont(StandardFonts.HelveticaBold);

  const withCover = !!project.coverPage;
  const coverPages = withCover ? coverPageCount(items.length) : 0;

  // Assign start pages for the TOC
  let nextPage = coverPages + 1;
  const toc = loaded.map(({ item, doc }) => {
    const pageCount = doc ? doc.getPageCount() : 1;
    const entry = { item, startPage: nextPage };
    nextPage += pageCount;
    return entry;
  });

  if (withCover) {
    drawCover(out, { font, bold, project, toc, warnings });
  }

  // Body: copy each item's pages (or draw a placeholder page)
  for (const { item, doc } of loaded) {
    if (doc) {
      const pages = await out.copyPages(doc, doc.getPageIndices());
      pages.forEach((p) => out.addPage(p));
    } else {
      drawPlaceholder(out, { font, bold, item });
    }
  }

  const bytes = await out.save();
  return { bytes, warnings };
}

function drawCover(out, { font, bold, project, toc }) {
  const calcs = project.calculations.filter((c) => itemType(c) === 'calculation');
  const docs = project.calculations.filter((c) => itemType(c) === 'pdf');
  const attached = calcs.filter((c) => c.pdfId);

  let page = out.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - 110;

  // Header block
  page.drawText('TEMPWORKS', { x: MARGIN, y: PAGE_H - 64, size: 10, font: bold, color: ACCENT });
  page.drawText('Temporary Works Design Toolkit', {
    x: MARGIN + 72, y: PAGE_H - 64, size: 10, font, color: MUTED,
  });
  page.drawLine({
    start: { x: MARGIN, y: PAGE_H - 74 }, end: { x: PAGE_W - MARGIN, y: PAGE_H - 74 },
    thickness: 1, color: LINE,
  });

  page.drawText(truncate(project.name, 38), { x: MARGIN, y, size: 28, font: bold, color: INK });
  y -= 22;
  page.drawText('Design Calculation Package', { x: MARGIN, y, size: 13, font, color: MUTED });
  y -= 34;

  // Stats
  const statLines = [
    `Calculations: ${calcs.length}   ·   Report PDFs attached: ${attached.length} of ${calcs.length}   ·   Additional documents: ${docs.length}`,
    `Compiled: ${new Date().toLocaleString('en-GB', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`,
  ];
  statLines.forEach((line) => {
    page.drawText(line, { x: MARGIN, y, size: 10, font, color: MUTED });
    y -= 16;
  });
  y -= 18;

  // Contents
  page.drawText('CONTENTS', { x: MARGIN, y, size: 11, font: bold, color: INK });
  y -= 8;
  page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_W - MARGIN, y }, thickness: 1, color: LINE });
  y -= 20;

  toc.forEach((entry, index) => {
    if (y < MARGIN + 20) {
      page = out.addPage([PAGE_W, PAGE_H]);
      y = PAGE_H - MARGIN - 10;
    }
    const pageNoText = String(entry.startPage);
    page.drawText(`${index + 1}.`, { x: MARGIN, y, size: 10.5, font: bold, color: MUTED });
    page.drawText(truncate(entry.item.name, 58), { x: MARGIN + 24, y, size: 10.5, font: bold, color: INK });
    page.drawText(itemLabel(entry.item), { x: MARGIN + 24, y: y - 12, size: 8.5, font, color: MUTED });
    page.drawText(pageNoText, {
      x: PAGE_W - MARGIN - font.widthOfTextAtSize(pageNoText, 10.5), y, size: 10.5, font, color: INK,
    });
    y -= 30;
  });
}

function drawPlaceholder(out, { font, bold, item }) {
  const page = out.addPage([PAGE_W, PAGE_H]);
  const centerY = PAGE_H / 2;
  page.drawText(truncate(item.name, 48), {
    x: MARGIN, y: centerY + 30, size: 18, font: bold, color: INK,
  });
  page.drawText(itemLabel(item), { x: MARGIN, y: centerY + 8, size: 11, font, color: ACCENT });
  page.drawText('No report PDF is attached to this calculation.', {
    x: MARGIN, y: centerY - 24, size: 11, font, color: MUTED,
  });
  page.drawText('Open the calculation, run it, then use "Attach Report to Project" in its Report tab.', {
    x: MARGIN, y: centerY - 40, size: 9.5, font, color: MUTED,
  });
}
