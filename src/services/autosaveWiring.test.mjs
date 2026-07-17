/**
 * Guards the autosave wiring in App.jsx.
 *
 * THE BUG THIS EXISTS TO PREVENT:
 * projectSession.js registers `onProjectChange(() => touch())` as a
 * module-level side effect. It therefore only exists on routes whose chunk
 * imports it. For a while that was Projects.jsx and ProjectOverview.jsx alone,
 * so a designer landing straight on /dashboard or a calculator — by refresh,
 * bookmark, new tab, or the app's own "Clear Cache & Reload" — got NO autosave
 * at all. Work went to localStorage and never reached Supabase. Everything
 * looked normal: the dashboard rendered, undo worked, the project was "there".
 * Only the cloud never heard about it. Confirmed by A/B in a real browser:
 * 0 uploads without the import, 1 with.
 *
 * `import './services/projectSession'` in App.jsx has no named binding, so it
 * reads exactly like a stray import an "unused imports" cleanup would delete.
 * This test is here so that deletion fails loudly and points at the reason.
 *
 * Run: node --test src/services/autosaveWiring.test.mjs
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const read = (p) => readFileSync(path.join(HERE, p), 'utf8');

test('App.jsx imports projectSession, so autosave is registered on every route', () => {
  const app = read('../App.jsx');
  const imports = /import\s+['"]\.\/services\/projectSession['"]/.test(app)
    || /import\s+[^;]*from\s+['"]\.\/services\/projectSession['"]/.test(app);

  assert.ok(imports,
    'App.jsx must import ./services/projectSession. Without it, autosave is only '
    + 'registered on routes that happen to import projectSession themselves, and a '
    + 'designer landing directly on /dashboard writes to localStorage while nothing '
    + 'reaches the cloud. See the header of this file.');
});

test('projectSession still registers autosave on load — the side effect App.jsx depends on', () => {
  const session = read('./projectSession.js');
  assert.match(session, /onProjectChange\(\s*\(\)\s*=>\s*touch\(\)\s*\)/,
    'projectSession.js must register onProjectChange(() => touch()) at module level. '
    + 'If this moved to an explicit init function, App.jsx has to call it — a bare '
    + 'side-effect import would silently stop wiring autosave up.');
});
