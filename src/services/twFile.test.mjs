/**
 * Round-trip and robustness tests for the .tw container.
 *
 * The .tw file is the source of truth for a project, so the bar here is higher
 * than "it parses": PDF bytes must come back byte-identical, a damaged or
 * foreign file must fail with a message worth showing an engineer, and the
 * file must stay recoverable by hand as a plain zip.
 *
 * Run: node src/services/twFile.test.mjs
 */

import { PDFDocument, StandardFonts } from 'pdf-lib';
import { strToU8, unzipSync, zipSync } from 'fflate';
import {
  TW_VERSION, TwFileError, decodeTw, encodeTw, peekTw, twFilename,
} from './twFile.js';

let failures = 0;
const check = (cond, msg) => {
  console.log(cond ? `  ok   ${msg}` : `  FAIL ${msg}`);
  if (!cond) failures += 1;
};
const throwsTw = (fn, expect, msg) => {
  try {
    fn();
    check(false, `${msg} (expected a TwFileError, nothing was thrown)`);
  } catch (e) {
    const good = e instanceof TwFileError && e.message.includes(expect);
    check(good, good ? `${msg} → "${e.message}"` : `${msg} — got: ${e.name}: ${e.message}`);
  }
};

// A real PDF, so the test exercises actual bytes rather than a toy buffer
const realPdf = async (text) => {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  doc.addPage([595, 842]).drawText(text, { x: 40, y: 780, size: 18, font });
  return (await doc.save()).buffer;
};

const project = {
  name: 'KYLIEZ',
  coverPage: true,
  cover: {
    projectName: 'KYLIEZ',
    reportReference: 'P26023_KYLIEZ_DRPT_01',
    revision: 'rev01',
    projectTitle: 'CADANGAN PEMBANGUNAN\ni. LOBI\nii. TASKA',
    revisions: [{ no: '00', preparer: 'YMN', preparerDate: '6/3/26', checker: 'YAP', checkerDate: '6/3/26' }],
  },
  calculations: [
    { id: 'c1', type: 'calculation', name: 'Tower T1', calculator: 'shoring-tower', data: { k: 'v' }, pdfId: 'pdf_a' },
    {
      id: 'd1', type: 'drawing', name: 'Level 2 Plan', pdfId: 'pdf_b',
      markups: [{ id: 'm1', page: 2, rect: { x: 0.1, y: 0.2, w: 0.3, h: 0.15 }, tag: '1', calcId: 'c1' }],
    },
    { id: 'p1', type: 'pdf', name: 'Method statement', pdfId: 'pdf_c' },
  ],
};

console.log('\n== Round trip ==');
const pdfA = await realPdf('REPORT A');
const pdfB = await realPdf('DRAWING B');
const pdfC = await realPdf('DOC C');
const file = encodeTw(project, new Map([['pdf_a', pdfA], ['pdf_b', pdfB], ['pdf_c', pdfC]]));
const rawTotal = pdfA.byteLength + pdfB.byteLength + pdfC.byteLength;
console.log(`  .tw: ${file.byteLength.toLocaleString()} bytes wrapping ${rawTotal.toLocaleString()} bytes of PDF`);

const back = decodeTw(file);
check(JSON.stringify(back.project) === JSON.stringify(project), 'project survives byte-for-byte identical');
check(back.project.cover.projectTitle.includes('\n'), 'cover line breaks survive');
check(back.project.calculations[1].markups[0].rect.x === 0.1, 'markup coordinates survive exactly');
check(back.pdfs.size === 3, 'all three PDFs come back');
check(back.version === TW_VERSION, `version recorded (v${back.version})`);

const same = (a, b) => {
  const x = new Uint8Array(a); const y = new Uint8Array(b);
  return x.length === y.length && x.every((v, i) => v === y[i]);
};
check(same(back.pdfs.get('pdf_a'), pdfA), 'report PDF is byte-identical after the round trip');
check(same(back.pdfs.get('pdf_b'), pdfB), 'drawing PDF is byte-identical after the round trip');
check(same(back.pdfs.get('pdf_c'), pdfC), 'document PDF is byte-identical after the round trip');

console.log('\n== The unpacked PDF still opens ==');
const reopened = await PDFDocument.load(back.pdfs.get('pdf_b'));
check(reopened.getPageCount() === 1, 'pdf-lib can reopen the unpacked drawing');

console.log('\n== Escape hatch: rename to .zip and recover by hand ==');
const asZip = unzipSync(file);
check(!!asZip['manifest.json'], 'a plain zip reader sees manifest.json');
const pdfEntries = Object.keys(asZip).filter((n) => n.startsWith('pdfs/'));
check(pdfEntries.length === 3, `PDFs are visible as files: ${pdfEntries.join(', ')}`);
check(new TextDecoder().decode(asZip['pdfs/pdf_b.pdf'].subarray(0, 5)) === '%PDF-', 'a recovered entry is a real PDF an engineer could just open');
check(same(asZip['pdfs/pdf_b.pdf'].slice().buffer, pdfB), 'the hand-recovered drawing is byte-identical to the original');

console.log('\n== Peek (drawing a card without inflating PDFs) ==');
const peek = peekTw(file);
check(peek.project.name === 'KYLIEZ', 'peek reads the project name');
check(peek.calculationCount === 1, 'peek counts calculations');
check(peek.drawingCount === 1, 'peek counts drawings');
check(peek.documentCount === 1, 'peek counts documents');

console.log('\n== Empty project ==');
const empty = decodeTw(encodeTw({ name: 'Empty', calculations: [] }, new Map()));
check(empty.pdfs.size === 0 && empty.project.name === 'Empty', 'a project with no PDFs round-trips');

console.log('\n== Ids that would break a filename ==');
const odd = decodeTw(encodeTw({ name: 'x' }, new Map([['pdf/../weird id', pdfA]])));
check(same(odd.pdfs.get('pdf/../weird id'), pdfA), 'an id with slashes and spaces survives the zip entry name');

console.log('\n== Bad input is rejected with a human message ==');
throwsTw(() => decodeTw(new Uint8Array(4)), 'not a TempWorks project', 'a tiny file');
throwsTw(() => decodeTw(new TextEncoder().encode('%PDF-1.4 this is a pdf not a project')), 'not a TempWorks project', 'a PDF handed to the wrong reader');
throwsTw(() => decodeTw(file.slice(0, Math.floor(file.byteLength / 2))), 'damaged', 'a truncated file (copied mid-save)');
throwsTw(
  () => decodeTw(zipSync({ 'notes.txt': strToU8('just a zip of something else') })),
  'does not contain a TempWorks project',
  'an unrelated zip',
);
throwsTw(
  () => decodeTw(zipSync({ 'manifest.json': strToU8('{not json') })),
  'damaged',
  'a corrupted manifest',
);
throwsTw(
  () => decodeTw(zipSync({ 'manifest.json': strToU8(JSON.stringify({ app: 'tempworks', kind: 'project', version: TW_VERSION + 5, project: {} })) })),
  'newer version',
  'a file from a newer app version',
);

console.log('\n== Filenames ==');
check(twFilename('P26023 KYLIEZ') === 'P26023 KYLIEZ.tw', 'keeps spaces: "P26023 KYLIEZ.tw"');
check(twFilename('Level 2 / Slab: rev01') === 'Level 2 - Slab- rev01.tw', `strips Windows-illegal chars → ${twFilename('Level 2 / Slab: rev01')}`);
check(twFilename('') === 'project.tw', 'empty name falls back to project.tw');
check(twFilename('...hidden') === 'hidden.tw', 'leading dots cannot hide the file');
check(twFilename('a'.repeat(200)).length <= 83, 'over-long names are truncated');
check(twFilename('TowerT1') === 'TowerT1.tw', 'control characters are stripped');

console.log(failures ? `\n${failures} FAILED` : '\nAll .tw codec checks passed.');
process.exitCode = failures ? 1 : 0;
