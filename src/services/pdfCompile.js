/**
 * pdfCompile.js
 * Compiles the project into a single PDF:
 *   [PLYTEC title page + contents (optional)] + every item in dashboard order.
 *
 * Calculation items contribute their attached report PDF (a placeholder page
 * is inserted when none is attached); 'pdf' and 'drawing' items contribute the
 * uploaded file. The title page is drawn from the cover fields the engineer
 * typed on the dashboard; the contents page is derived from the item order.
 */

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { getPdf } from './pdfStore';
import { rectToUserSpace } from './markupGeometry';
import { getMarkups, groupItemsByZone, itemType, CALCULATORS } from './projectStore';

// A4 portrait, points
const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 56;
const TABLE_W = PAGE_W - MARGIN * 2;

const INK = rgb(0.12, 0.16, 0.23);
const MUTED = rgb(0.45, 0.51, 0.59);
const ACCENT = rgb(0.15, 0.39, 0.92);
const LINE = rgb(0.8, 0.84, 0.89);
const NAVY = rgb(0.12, 0.22, 0.37); // PLYTEC header/label block
const RULE = rgb(0.1, 0.1, 0.1); // table borders — near-black, as printed
const WHITE = rgb(1, 1, 1);
const MARKUP_LINKED = rgb(0.15, 0.39, 0.92);
const MARKUP_PLAIN = rgb(0.85, 0.47, 0.02);

const CONTENTS_ROWS = 22;

/**
 * The PLYTEC logo, if a PNG has been dropped in. import.meta.glob resolves at
 * build time and yields {} when the file is absent, so a missing logo degrades
 * to the drawn text block instead of breaking the build.
 */
const logoModules = import.meta.glob('../assets/plytec-logo.png', {
  eager: true,
  query: '?url',
  import: 'default',
});
const logoUrl = Object.values(logoModules)[0] || null;

const itemLabel = (item) => {
  const type = itemType(item);
  if (type === 'pdf') return 'PDF document';
  if (type === 'drawing') return 'Plan drawing';
  return CALCULATORS[item.calculator]?.title || item.calculator;
};

const contentsPageCount = (itemCount) =>
  (itemCount ? Math.ceil(itemCount / CONTENTS_ROWS) : 0);

/**
 * The standard PDF fonts encode WinAnsi (CP1252) and nothing else, and pdf-lib
 * throws on the first character it cannot encode — so one pasted arrow or CJK
 * character in a cover field would otherwise take down the whole compile.
 * Fold anything unencodable to '?' instead: a document with a '?' in it beats
 * no document at all. Newlines survive so wrapText can still split on them.
 */
// CP1252 fills 0x80-0x9F with characters Latin-1 leaves undefined; these are
// the only ones outside ASCII/Latin-1 that a standard font can encode.
const WIN_ANSI_SPECIALS = new Set([
  0x20AC, 0x201A, 0x0192, 0x201E, 0x2026, 0x2020, 0x2021, 0x02C6, 0x2030,
  0x0160, 0x2039, 0x0152, 0x017D, 0x2018, 0x2019, 0x201C, 0x201D, 0x2022,
  0x2013, 0x2014, 0x02DC, 0x2122, 0x0161, 0x203A, 0x0153, 0x017E, 0x0178,
]);

const isEncodable = (code) =>
  code === 0x0A // newline: wrapText splits on it before anything is drawn
  || (code >= 0x20 && code <= 0x7E) // ASCII
  || (code >= 0xA0 && code <= 0xFF) // Latin-1 supplement
  || WIN_ANSI_SPECIALS.has(code);

const winAnsi = (text) =>
  [...String(text ?? '')]
    .map((ch) => (isEncodable(ch.codePointAt(0)) ? ch : '?'))
    .join('');

const truncate = (text, max) => {
  const t = winAnsi(text);
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
};

/** Split text into lines that fit maxWidth, honouring existing line breaks. */
function wrapText(text, font, size, maxWidth) {
  const lines = [];
  for (const paragraph of winAnsi(text).split('\n')) {
    if (!paragraph.trim()) { lines.push(''); continue; }
    let line = '';
    for (const word of paragraph.split(/\s+/)) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
        line = candidate;
      } else {
        if (line) lines.push(line);
        line = word;
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}

const drawBox = (page, x, y, w, h, fill) =>
  page.drawRectangle({
    x, y, width: w, height: h, borderColor: RULE, borderWidth: 0.8, ...(fill ? { color: fill } : {}),
  });

/** Stamp a drawing's markups for one page onto the copied output page. */
function drawMarkupsOnPage(page, { markups, bold, startPageById }) {
  if (markups.length === 0) return;
  const size = page.getSize();
  const rotation = page.getRotation().angle || 0;

  for (const markup of markups) {
    const linked = markup.calcId ? startPageById.get(markup.calcId) : null;
    const color = linked ? MARKUP_LINKED : MARKUP_PLAIN;
    const box = rectToUserSpace(markup.rect, size, rotation);

    page.drawRectangle({
      ...box, borderColor: color, borderWidth: 1.5, color, opacity: 0.08, borderOpacity: 1,
    });

    // Caption: the tag, plus where to find the calculation it points at.
    // Separator is a middle dot, not an arrow — a standard font cannot encode
    // one, and truncate() folds anything else unencodable to '?'.
    const caption = [
      truncate(markup.tag, 12),
      linked ? `see p.${linked}` : '',
      markup.label ? truncate(markup.label, 34) : '',
    ].filter(Boolean).join(' · ');
    if (!caption) continue;

    const fontSize = 7.5;
    const textW = bold.widthOfTextAtSize(caption, fontSize);
    const padding = 3;
    const labelH = fontSize + padding * 2;
    // Sit above the box, unless that would run off the top of the sheet
    const above = box.y + box.height + 2;
    const labelY = above + labelH > size.height ? Math.max(0, box.y - labelH - 2) : above;

    page.drawRectangle({
      x: box.x, y: labelY, width: textW + padding * 2, height: labelH, color, opacity: 0.92,
    });
    page.drawText(caption, {
      x: box.x + padding, y: labelY + padding + 1, size: fontSize, font: bold, color: WHITE,
    });
  }
}

export async function compileProjectPdf(project) {
  const items = project.calculations;
  const warnings = [];

  // Load every item's PDF up front so page counts are known for the contents
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
  const fonts = {
    font: await out.embedFont(StandardFonts.Helvetica),
    bold: await out.embedFont(StandardFonts.HelveticaBold),
    italic: await out.embedFont(StandardFonts.HelveticaOblique),
    boldItalic: await out.embedFont(StandardFonts.HelveticaBoldOblique),
  };

  // Arrange the loaded items into a printable sequence: each zone's items
  // preceded by a divider page, unassigned items last. A project with no zones
  // produces one group and no dividers, exactly as before.
  const loadedById = new Map(loaded.map((entry) => [entry.item.id, entry]));
  const showDividers = project.zones.length > 0;
  const sequence = [];
  for (const { zone, items: groupItems } of groupItemsByZone(project)) {
    if (showDividers) sequence.push({ kind: 'divider', label: zone ? zone.name : 'Unassigned' });
    for (const item of groupItems) {
      sequence.push({ kind: 'item', ...loadedById.get(item.id) });
    }
  }

  const withCover = !!project.coverPage;
  // The contents lists both dividers and items, so its length drives its pages
  const coverPages = withCover ? 1 + contentsPageCount(sequence.length) : 0;

  // Assign start pages: a divider is one page, an item is its PDF's page count
  let nextPage = coverPages + 1;
  const toc = sequence.map((node) => {
    if (node.kind === 'divider') {
      const entry = { divider: true, label: node.label, startPage: nextPage };
      nextPage += 1;
      return entry;
    }
    const pageCount = node.doc ? node.doc.getPageCount() : 1;
    const entry = { item: node.item, startPage: nextPage };
    nextPage += pageCount;
    return entry;
  });

  if (withCover) {
    await drawTitlePage(out, { ...fonts, project });
    drawContents(out, { ...fonts, toc });
  }

  // Where each item ends up, so a markup can cite its calculation's page
  const startPageById = new Map(
    toc.filter((e) => e.item).map((entry) => [entry.item.id, entry.startPage]),
  );

  // Body: divider pages, then each item's pages (or a placeholder)
  for (const node of sequence) {
    if (node.kind === 'divider') {
      drawZoneDivider(out, { ...fonts, label: node.label });
      continue;
    }
    const { item, doc } = node;
    if (doc) {
      const pages = await out.copyPages(doc, doc.getPageIndices());
      const markups = itemType(item) === 'drawing' ? getMarkups(item) : [];
      pages.forEach((p, index) => {
        out.addPage(p);
        drawMarkupsOnPage(p, {
          markups: markups.filter((m) => m.page === index + 1),
          ...fonts,
          startPageById,
        });
      });
    } else {
      drawPlaceholder(out, { ...fonts, item });
    }
  }

  const bytes = await out.save();
  return { bytes, warnings };
}

/** A full-page section divider announcing a zone. */
function drawZoneDivider(out, { bold, label }) {
  const page = out.addPage([PAGE_W, PAGE_H]);
  const centerY = PAGE_H / 2;
  page.drawText('ZONE', { x: MARGIN, y: centerY + 26, size: 11, font: bold, color: ACCENT });
  // Wrap a long zone name rather than let it run off the page
  const lines = wrapText(label, bold, 26, PAGE_W - MARGIN * 2);
  let y = centerY - 6;
  for (const line of lines.slice(0, 3)) {
    page.drawText(line, { x: MARGIN, y, size: 26, font: bold, color: INK });
    y -= 32;
  }
  page.drawLine({
    start: { x: MARGIN, y: centerY + 18 }, end: { x: PAGE_W - MARGIN, y: centerY + 18 },
    thickness: 1.5, color: LINE,
  });
}

/**
 * Just the title page, for the on-screen preview — no contents, no items, so
 * it renders instantly without touching IndexedDB.
 */
export async function compileCoverPdf(project) {
  const out = await PDFDocument.create();
  const fonts = {
    font: await out.embedFont(StandardFonts.Helvetica),
    bold: await out.embedFont(StandardFonts.HelveticaBold),
    italic: await out.embedFont(StandardFonts.HelveticaOblique),
    boldItalic: await out.embedFont(StandardFonts.HelveticaBoldOblique),
  };
  await drawTitlePage(out, { ...fonts, project });
  return out.save();
}

// --- Title page ---

async function embedLogo(out) {
  if (!logoUrl) return null;
  try {
    const response = await fetch(logoUrl);
    return await out.embedPng(await response.arrayBuffer());
  } catch {
    return null; // fall back to the drawn text block
  }
}

async function drawTitlePage(out, { font, bold, italic, boldItalic, project }) {
  const cover = project.cover || {};
  const page = out.addPage([PAGE_W, PAGE_H]);
  const centerText = (text, y, textFont, size, color = INK) =>
    page.drawText(text, {
      x: (PAGE_W - textFont.widthOfTextAtSize(text, size)) / 2, y, size, font: textFont, color,
    });

  // Header line: template version (left), project ref + issue date (right).
  // Everything typed goes through truncate(), which also folds any character
  // a standard font cannot encode.
  if (cover.templateVersion) {
    page.drawText(truncate(cover.templateVersion, 12), { x: MARGIN, y: PAGE_H - 48, size: 8.5, font, color: INK });
  }
  if (cover.companyRef) {
    const refText = `PLYTEC Project Ref.    ${truncate(cover.companyRef, 24)}`;
    page.drawText(refText, {
      x: PAGE_W - MARGIN - font.widthOfTextAtSize(refText, 8.5), y: PAGE_H - 48, size: 8.5, font, color: INK,
    });
  }
  if (cover.issueDate) {
    const issued = truncate(cover.issueDate, 24);
    page.drawText(issued, {
      x: PAGE_W - MARGIN - font.widthOfTextAtSize(issued, 8.5), y: PAGE_H - 60, size: 8.5, font, color: INK,
    });
  }

  // Logo block
  const logoW = 320;
  const logoH = 62;
  const logoX = (PAGE_W - logoW) / 2;
  const logoY = PAGE_H - 172;
  const logo = await embedLogo(out);
  if (logo) {
    const scaled = logo.scaleToFit(logoW, logoH);
    page.drawImage(logo, {
      x: (PAGE_W - scaled.width) / 2,
      y: logoY + (logoH - scaled.height) / 2,
      width: scaled.width,
      height: scaled.height,
    });
  } else {
    page.drawRectangle({ x: logoX, y: logoY, width: logoW, height: logoH, color: NAVY });
    const nameSize = 26;
    const nameW = bold.widthOfTextAtSize('PLYTEC', nameSize);
    const wordSize = 24;
    const wordW = boldItalic.widthOfTextAtSize(' formwork', wordSize);
    const startX = (PAGE_W - (nameW + wordW)) / 2;
    page.drawText('PLYTEC', { x: startX, y: logoY + 20, size: nameSize, font: bold, color: WHITE });
    page.drawText(' formwork', { x: startX + nameW, y: logoY + 20, size: wordSize, font: boldItalic, color: WHITE });
  }

  // Company block
  let y = logoY - 14;
  const companyLines = [
    'PLYTEC FORMWORK SYSTEM INDUSTRIES SDN.BHD.',
    'Reg No.201201004139 (977664-U)',
    'No. 19, Jalan Meranti Permai 3, Meranti Permai Industrial Park',
    'Batu 15, Jalan Puchong, 47100 Puchong, Selangor Darul Ehsan, Malaysia.',
    'Tel : +603-8061 2888   Fax : +603-8061 4888',
  ];
  companyLines.forEach((line, index) => {
    centerText(line, y, index === 0 ? boldItalic : italic, index === 0 ? 8.5 : 8, INK);
    y -= 11;
  });

  // Title
  y -= 26;
  if (cover.title) {
    centerText(truncate(cover.title, 52), y, bold, 17);
    y -= 22;
  }
  if (cover.subtitle) {
    centerText(truncate(cover.subtitle, 52), y, bold, 17);
    y -= 22;
  }

  // --- Field table ---
  y -= 24;
  const labelW = 150;
  const rowH = 26;

  const fieldRow = (label, value, valueFont, valueSize = 11) => {
    const top = y - rowH;
    drawBox(page, MARGIN, top, labelW, rowH, NAVY);
    drawBox(page, MARGIN + labelW, top, TABLE_W - labelW, rowH);
    page.drawText(label, { x: MARGIN + 8, y: top + 9, size: 8.5, font: bold, color: WHITE });
    if (value) {
      page.drawText(truncate(value, 46), {
        x: MARGIN + labelW + 8, y: top + 8, size: valueSize, font: valueFont, color: INK,
      });
    }
    y = top;
  };

  fieldRow('PROJECT NAME:', cover.projectName, bold, 12);
  fieldRow('PROJECT REFERENCE :', cover.projectReference, bold, 12);

  // Report reference row carries a narrow revision cell on the right
  const revCellW = 62;
  const reportTop = y - rowH;
  drawBox(page, MARGIN, reportTop, labelW, rowH, NAVY);
  drawBox(page, MARGIN + labelW, reportTop, TABLE_W - labelW - revCellW, rowH);
  drawBox(page, PAGE_W - MARGIN - revCellW, reportTop, revCellW, rowH);
  page.drawText('REPORT REFERENCE :', { x: MARGIN + 8, y: reportTop + 9, size: 8.5, font: bold, color: WHITE });
  if (cover.reportReference) {
    page.drawText(truncate(cover.reportReference, 40), {
      x: MARGIN + labelW + 8, y: reportTop + 8, size: 10, font: italic, color: INK,
    });
  }
  if (cover.revision) {
    const revText = truncate(cover.revision, 8);
    page.drawText(revText, {
      x: PAGE_W - MARGIN - revCellW + (revCellW - boldItalic.widthOfTextAtSize(revText, 9)) / 2,
      y: reportTop + 9, size: 9, font: boldItalic, color: INK,
    });
  }
  y = reportTop;

  // --- Project title box ---
  // Stretches from the field table down to the revision table at the foot
  const revTableH = 88;
  const boxBottom = MARGIN + revTableH + 10;
  const boxTop = y;
  drawBox(page, MARGIN, boxBottom, TABLE_W, boxTop - boxBottom);

  let textY = boxTop - 16;
  page.drawText('Project Title:', { x: MARGIN + 8, y: textY, size: 9, font: bold, color: INK });
  textY -= 12;

  const bodyLines = wrapText(cover.projectTitle, italic, 8, TABLE_W - 16);
  for (const line of bodyLines) {
    if (textY < boxBottom + 8) break; // silently clip rather than overflow the box
    if (line) page.drawText(line, { x: MARGIN + 8, y: textY, size: 8, font: italic, color: INK });
    textY -= 10;
  }

  // --- Revision table + PE endorsement ---
  drawRevisionTable(page, { font, bold, italic, cover, height: revTableH });
}

function drawRevisionTable(page, { bold, italic, cover, height }) {
  const revisions = (cover.revisions || []).slice(0, 6);
  const cols = 6;
  const labelW = 62;
  const blockW = 300;
  const cellW = (blockW - labelW) / cols;
  const headH = 20;
  const rowH = (height - headH) / 2;
  const top = MARGIN + height;

  const cellText = (text, x, w, y, size, textFont, color = INK) => {
    if (!text) return;
    const clipped = truncate(String(text), 10);
    page.drawText(clipped, {
      x: x + (w - textFont.widthOfTextAtSize(clipped, size)) / 2, y, size, font: textFont, color,
    });
  };

  // Header row: "Revision" label + one column per revision
  drawBox(page, MARGIN, top - headH, labelW, headH, NAVY);
  page.drawText('Revision', { x: MARGIN + 6, y: top - headH + 6, size: 8, font: bold, color: WHITE });
  for (let i = 0; i < cols; i += 1) {
    const x = MARGIN + labelW + i * cellW;
    drawBox(page, x, top - headH, cellW, headH);
    cellText(revisions[i]?.no, x, cellW, top - headH + 6, 8, bold);
  }

  // Preparer / Checker rows
  const rows = [
    { label: 'Preparer /\nDate', name: 'preparer', date: 'preparerDate' },
    { label: 'Checker /\nDate', name: 'checker', date: 'checkerDate' },
  ];
  rows.forEach((row, rowIndex) => {
    const rowTop = top - headH - rowIndex * rowH;
    const rowBottom = rowTop - rowH;
    drawBox(page, MARGIN, rowBottom, labelW, rowH, NAVY);
    row.label.split('\n').forEach((line, i) => {
      page.drawText(line, { x: MARGIN + 6, y: rowTop - 12 - i * 9, size: 7.5, font: bold, color: WHITE });
    });
    for (let i = 0; i < cols; i += 1) {
      const x = MARGIN + labelW + i * cellW;
      drawBox(page, x, rowBottom, cellW, rowH);
      cellText(revisions[i]?.[row.name], x, cellW, rowTop - 14, 8, italic);
      cellText(revisions[i]?.[row.date], x, cellW, rowTop - 26, 7.5, italic);
    }
  });

  // PE endorsement box fills the rest of the width
  const peX = MARGIN + blockW + 8;
  const peW = PAGE_W - MARGIN - peX;
  drawBox(page, peX, MARGIN, peW, height);
  page.drawText('PE Endorsement:', { x: peX + 6, y: top - 12, size: 7.5, font: italic, color: INK });
  if (cover.peEndorsement) {
    wrapText(cover.peEndorsement, italic, 7.5, peW - 12)
      .slice(0, 5)
      .forEach((line, i) => {
        page.drawText(line, { x: peX + 6, y: top - 26 - i * 10, size: 7.5, font: italic, color: INK });
      });
  }
}

// --- Contents ---

function drawContents(out, { font, bold, toc }) {
  if (toc.length === 0) return;

  let page = null;
  let y = 0;
  const startPage = () => {
    page = out.addPage([PAGE_W, PAGE_H]);
    page.drawText('CONTENTS', { x: MARGIN, y: PAGE_H - MARGIN - 10, size: 11, font: bold, color: INK });
    page.drawLine({
      start: { x: MARGIN, y: PAGE_H - MARGIN - 20 }, end: { x: PAGE_W - MARGIN, y: PAGE_H - MARGIN - 20 },
      thickness: 1, color: LINE,
    });
    y = PAGE_H - MARGIN - 40;
  };

  let itemNo = 0;
  toc.forEach((entry, index) => {
    // Keep the drawn rows in step with contentsPageCount()
    if (index % CONTENTS_ROWS === 0) startPage();
    const pageNoText = String(entry.startPage);

    if (entry.divider) {
      // A zone heading: the zone name in the accent colour, its divider page number
      page.drawText(truncate(entry.label, 54), { x: MARGIN, y, size: 11, font: bold, color: ACCENT });
      page.drawText(pageNoText, {
        x: PAGE_W - MARGIN - font.widthOfTextAtSize(pageNoText, 10.5), y, size: 10.5, font, color: INK,
      });
      y -= 26;
      return;
    }

    itemNo += 1;
    // Items indent under their zone heading when zones are in play
    const indent = MARGIN + 24;
    page.drawText(`${itemNo}.`, { x: MARGIN + 10, y, size: 10.5, font: bold, color: MUTED });
    page.drawText(truncate(entry.item.name, 54), { x: indent, y, size: 10.5, font: bold, color: INK });
    page.drawText(itemLabel(entry.item), { x: indent, y: y - 12, size: 8.5, font, color: MUTED });
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
