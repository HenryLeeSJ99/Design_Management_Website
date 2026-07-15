/**
 * Pins rectToUserSpace against pdf.js's own PageViewport.
 *
 * pdf.js is the thing that decides where a markup visually sits, so it is the
 * authority here: for every rotation, take the rect's display-space corners,
 * run them through pdf.js's convertToPdfPoint, and require our mapping to
 * produce the same user-space box. Checking our maths against our own
 * reasoning would prove nothing — this checks it against the renderer.
 *
 * Run: node src/services/markupGeometry.test.mjs
 */

import { PDFDocument, degrees } from 'pdf-lib';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { rectToUserSpace } from './markupGeometry.js';

let failures = 0;
const approx = (a, b, tol = 1e-6) => Math.abs(a - b) < tol;

const check = (name, got, want) => {
  const ok = ['x', 'y', 'width', 'height'].every((k) => approx(got[k], want[k], 1e-6));
  const fmt = (o) => `x=${o.x.toFixed(2)} y=${o.y.toFixed(2)} w=${o.width.toFixed(2)} h=${o.height.toFixed(2)}`;
  if (ok) {
    console.log(`  ok   ${name}\n         ${fmt(got)}`);
  } else {
    failures += 1;
    console.log(`  FAIL ${name}\n         ours:   ${fmt(got)}\n         pdf.js: ${fmt(want)}`);
  }
};

// Portrait page; deliberately non-square so a swapped axis cannot pass by luck
const W = 595;
const H = 842;

// Deliberately asymmetric rect: every component distinct
const rect = { x: 0.10, y: 0.20, w: 0.30, h: 0.25 };

/** A real one-page PDF at the given /Rotate, parsed back by pdf.js. */
async function viewportFor(rotation) {
  const doc = await PDFDocument.create();
  const page = doc.addPage([W, H]);
  page.setRotation(degrees(rotation));
  const bytes = await doc.save();
  const parsed = await getDocument({ data: bytes, isEvalSupported: false }).promise;
  return (await parsed.getPage(1)).getViewport({ scale: 1 });
}

for (const rotation of [0, 90, 180, 270]) {
  const viewport = await viewportFor(rotation);

  // The rect as the engineer saw it, in display pixels
  const left = rect.x * viewport.width;
  const top = rect.y * viewport.height;
  const right = (rect.x + rect.w) * viewport.width;
  const bottom = (rect.y + rect.h) * viewport.height;

  // pdf.js's own answer for where those corners live in user space
  const c1 = viewport.convertToPdfPoint(left, top);
  const c2 = viewport.convertToPdfPoint(right, bottom);
  const expected = {
    x: Math.min(c1[0], c2[0]),
    y: Math.min(c1[1], c2[1]),
    width: Math.abs(c2[0] - c1[0]),
    height: Math.abs(c2[1] - c1[1]),
  };

  check(`rotation ${rotation}° (display ${viewport.width}x${viewport.height})`,
    rectToUserSpace(rect, { width: W, height: H }, rotation), expected);
}

// A rect touching the edges must stay inside the page under every rotation
for (const rotation of [0, 90, 180, 270]) {
  const full = rectToUserSpace({ x: 0, y: 0, w: 1, h: 1 }, { width: W, height: H }, rotation);
  const ok = approx(full.x, 0) && approx(full.y, 0) && approx(full.width, W) && approx(full.height, H);
  if (!ok) { failures += 1; console.log(`  FAIL full-page rect at ${rotation}°:`, full); }
  else console.log(`  ok   full-page rect fills the sheet exactly at ${rotation}°`);
}

console.log(failures ? `\n${failures} FAILED` : '\nAll geometry checks passed.');
process.exitCode = failures ? 1 : 0;
