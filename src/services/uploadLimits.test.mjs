/**
 * uploadLimits.js — the PDF size gate the drawing/PDF upload path relies on.
 * A 35 MB scan nearly hung a browser tab; this proves the boundary.
 *
 * Run: node --test src/services/uploadLimits.test.mjs
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { MAX_PDF_BYTES, assertPdfSize } from './uploadLimits.js';

const file = (size, name = 'd.pdf') => ({ size, name });

test('accepts a file at or under the ceiling without touching its bytes', () => {
  // Only .size is read — assertPdfSize must never call .arrayBuffer(), so a
  // stub with no such method proves the check is size-only.
  assert.doesNotThrow(() => assertPdfSize(file(0)));
  assert.doesNotThrow(() => assertPdfSize(file(5 * 1024 * 1024)));
  assert.doesNotThrow(() => assertPdfSize(file(MAX_PDF_BYTES)), 'exactly at the cap is allowed');
});

test('rejects a file over the ceiling, naming the file and both sizes', () => {
  assert.throws(
    () => assertPdfSize(file(30 * 1024 * 1024, 'huge-scan.pdf')),
    (e) => e.message.includes('huge-scan.pdf') && e.message.includes('30 MB') && e.message.includes('25 MB'),
    'the message names the file and tells the user the limit and how to fix it',
  );
});

test('the 35 MB drawing from the incident is refused', () => {
  assert.throws(() => assertPdfSize(file(35 * 1024 * 1024, 'plan.pdf')), /35 MB/);
});

test('the ceiling stays under Supabase’s 50 MB per-file cap', () => {
  assert.ok(MAX_PDF_BYTES < 50 * 1024 * 1024,
    'so an over-limit file fails here with a clear message, not at the server with an opaque one');
});
