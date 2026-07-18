/**
 * projectFiles.js against a fake in-memory Supabase, exercising the actual
 * exported functions rather than re-deriving their logic by hand.
 *
 * No real Supabase project is reachable from here (and even with one,
 * authenticating would need a password this agent will not type), so
 * ./supabaseStorage and ./supabaseDb are mocked with a tiny in-memory
 * stand-in that mirrors their real shape (a projects table, a blob store keyed
 * by path). The functions under test are the real, unmodified module — only
 * the network boundary is faked.
 *
 * Run: node --experimental-test-module-mocks --test src/services/projectFiles.test.mjs
 */

import { test, mock } from 'node:test';
import assert from 'node:assert/strict';

// --- Fake backend ---
const db = new Map(); // id -> record
const blobs = new Map(); // path -> Uint8Array
const versionMeta = new Map(); // path -> {created_at}

// Monotonic: two writes in the same millisecond must still get DIFFERENT
// timestamps, or the optimistic-concurrency tests can't tell "nobody saved"
// from "someone saved so fast the clock didn't move".
let clock = Date.now();
const nowIso = () => new Date(clock++).toISOString();

// The real project_status enum, confirmed 2026-07-17 by probing the live
// database with the anon key (no schema access available). draft /
// pending_approval / approved are a prior workflow's leftovers — Postgres
// cannot drop an enum value, so they still exist even though nothing writes
// them anymore. A previous version of this mock accepted ANY string here,
// which is exactly how a commit that wrote 'active'/'completed' before that
// value existed in the real enum passed every test and would still have
// failed in production — see chat history. This mock now rejects what
// Postgres would reject, the same way it does.
const REAL_PROJECT_STATUS_ENUM = new Set([
  'draft', 'pending_approval', 'approved', 'trashed', 'active', 'completed', 'archive',
]);

mock.module('./supabaseDb', {
  namedExports: {
    fetchProjects: async () => [...db.values()],
    // Mirrors the real maybeSingle(): a row the caller cannot see is null,
    // not an error.
    fetchProject: async (id) => db.get(id) || null,
    fetchTrashedProjects: async () => [...db.values()].filter((r) => r.status === 'trashed'),
    createProjectRecord: async (p) => {
      const record = { id: p.id, name: p.name, status: 'active', last_modified_at: nowIso(), file_size: 0 };
      db.set(p.id, record);
      return record;
    },
    // Mirrors the real function's shape: it operates on a record that already
    // has an id (set at creation), it does not invent one.
    updateProjectRecord: async (id, updates) => {
      if ('status' in updates && !REAL_PROJECT_STATUS_ENUM.has(updates.status)) {
        throw new Error(`invalid input value for enum project_status: "${updates.status}"`);
      }
      const record = { ...db.get(id), id, ...updates, last_modified_at: nowIso() };
      db.set(id, record);
      return record;
    },
    // The conditional claim: same shape as Postgres — zero rows on a rev
    // mismatch is null, not an error.
    updateProjectRecordIf: async (id, updates, expected) => {
      const current = db.get(id);
      if (!current || current.last_modified_at !== expected) return null;
      const record = { ...current, id, ...updates, last_modified_at: nowIso() };
      db.set(id, record);
      return record;
    },
    deleteProjectRecord: async (id) => { db.delete(id); },
  },
});

/** Seed a project the way createProjectRecord would, id included. */
const seedProject = (id, content) => {
  db.set(id, { id, name: id, status: 'active', last_modified_at: nowIso(), file_size: 0 });
  return pf.writeProjectFile(id, bytesOf(content));
};

/** Push every existing version's timestamp back, so the next snapshot call is
 *  not silently skipped by the "too soon since the last one" throttle. */
const bypassThrottle = () => {
  for (const [path] of versionMeta) versionMeta.set(path, { created_at: new Date(Date.now() - 3600000).toISOString() });
};

mock.module('./supabaseStorage', {
  namedExports: {
    uploadProjectFile: async (id, bytes) => { blobs.set(`${id}.tw`, bytes); },
    downloadProjectFile: async (id) => {
      const b = blobs.get(`${id}.tw`);
      if (!b) throw new Error('not found');
      return b;
    },
    deleteStorageFile: async (id) => { blobs.delete(`${id}.tw`); },
    uploadCoverImage: async () => 'https://example.com/cover.png',
    uploadVersionObject: async (id, bytes) => {
      const path = `versions/${id}/${Date.now()}-${Math.random().toString(36).slice(2)}.tw`;
      blobs.set(path, bytes);
      versionMeta.set(path, { created_at: nowIso() });
      return path;
    },
    listVersionObjects: async (id) => {
      const prefix = `versions/${id}/`;
      return [...blobs.keys()]
        .filter((p) => p.startsWith(prefix))
        .map((p) => ({ name: p.slice(prefix.length), created_at: versionMeta.get(p)?.created_at, metadata: { size: blobs.get(p).byteLength } }));
    },
    downloadVersionObject: async (id, name) => {
      const b = blobs.get(`versions/${id}/${name}`);
      if (!b) throw new Error('version not found');
      return b;
    },
    // --- split layout, same one-map store keyed by path ---
    uploadManifestObject: async (id, bytes) => { blobs.set(`${id}/manifest.json`, bytes); },
    downloadManifestObject: async (id) => blobs.get(`${id}/manifest.json`) || null,
    uploadPdfObject: async (id, pdfId, bytes) => { blobs.set(`${id}/pdfs/${encodeURIComponent(pdfId)}.pdf`, bytes); },
    downloadPdfObject: async (id, pdfId) => {
      const b = blobs.get(`${id}/pdfs/${encodeURIComponent(pdfId)}.pdf`);
      if (!b) throw new Error('pdf not found');
      return b;
    },
    listPdfObjectIds: async (id) => {
      const prefix = `${id}/pdfs/`;
      return [...blobs.keys()]
        .filter((p) => p.startsWith(prefix) && p.endsWith('.pdf'))
        .map((p) => decodeURIComponent(p.slice(prefix.length, -4)));
    },
    removePdfObjects: async (id, pdfIds) => {
      pdfIds.forEach((pdfId) => blobs.delete(`${id}/pdfs/${encodeURIComponent(pdfId)}.pdf`));
    },
    removeSplitObjects: async (id) => {
      [...blobs.keys()].filter((p) => p.startsWith(`${id}/`)).forEach((p) => blobs.delete(p));
    },
    removeVersionObjects: async (id, names) => {
      const prefix = `versions/${id}/`;
      const targets = names ? names.map((n) => `${prefix}${n}`) : [...blobs.keys()].filter((p) => p.startsWith(prefix));
      targets.forEach((p) => { blobs.delete(p); versionMeta.delete(p); });
    },
  },
});

// Import AFTER the mocks are registered, so projectFiles.js resolves to them
const pf = await import('./projectFiles.js');

const bytesOf = (text) => new TextEncoder().encode(text);
const textOf = (bytes) => new TextDecoder().decode(bytes);

// Helper: force a record's last_modified_at into the past, bypassing the
// "updateProjectRecord always stamps now()" behaviour, to simulate age.
const backdate = (id, daysAgo) => {
  const record = db.get(id);
  db.set(id, { ...record, last_modified_at: new Date(Date.now() - daysAgo * 86400000).toISOString() });
};

test('trash: listing computes days left correctly', async () => {
  db.clear(); blobs.clear();
  await seedProject('p1', 'v1');
  db.set('p1', { ...db.get('p1'), status: 'trashed' });
  backdate('p1', 10);

  const trash = await pf.listTrash();
  assert.equal(trash.length, 1);
  assert.equal(trash[0].daysLeft, 20, `expected 20 days left, got ${trash[0].daysLeft}`);
});

test('purge: sweeps only what is past 30 days, leaves the rest', async () => {
  db.clear(); blobs.clear();
  await seedProject('old', 'old');
  await seedProject('young', 'young');
  db.set('old', { ...db.get('old'), status: 'trashed' });
  db.set('young', { ...db.get('young'), status: 'trashed' });
  backdate('old', 31);
  backdate('young', 5);

  const purged = await pf.purgeExpiredTrash();
  assert.equal(purged, 1, 'exactly the 31-day-old project is purged');
  assert.equal(db.has('old'), false, 'the old project record is gone');
  assert.equal(blobs.has('old.tw'), false, "the old project's blob is gone too");
  assert.equal(db.has('young'), true, 'the young trashed project survives');
});

test('purge: one bad record does not stop the rest from being swept', async () => {
  db.clear(); blobs.clear();
  await seedProject('bad', 'bad');
  await seedProject('good', 'good');
  db.set('bad', { ...db.get('bad'), status: 'trashed' });
  db.set('good', { ...db.get('good'), status: 'trashed' });
  backdate('bad', 40);
  backdate('good', 40);
  // Make deleting "bad" fail once, to prove the loop keeps going
  const realDelete = blobs.delete.bind(blobs);
  blobs.delete = (key) => { if (key === 'bad.tw') throw new Error('simulated failure'); return realDelete(key); };

  const purged = await pf.purgeExpiredTrash();
  blobs.delete = realDelete;
  assert.equal(purged, 1, 'the good record still got purged despite the bad one failing');
  assert.equal(db.has('bad'), true, 'the bad record is left for the next sweep to retry');
  assert.equal(db.has('good'), false, 'the good record was still purged');
});

test('version history: throttles a snapshot taken moments after the last', async () => {
  db.clear(); blobs.clear(); versionMeta.clear();
  await pf.writeProjectFile('v', bytesOf('content A'));
  const first = await pf.snapshotVersion('v');
  assert.equal(first, true, 'the first snapshot is taken');
  const second = await pf.snapshotVersion('v');
  assert.equal(second, null, 'a snapshot moments later is throttled, not stacked');

  const versions = await pf.listVersions('v');
  assert.equal(versions.length, 1, 'only one version exists after the throttled call');
});

test('version history: prunes beyond the retention cap', async () => {
  db.clear(); blobs.clear(); versionMeta.clear();
  await pf.writeProjectFile('v', bytesOf('content'));
  // Seed 14 already-old versions directly (bypassing the throttle) so pruning
  // has something to prune
  for (let i = 0; i < 14; i += 1) {
    const path = `versions/v/seed-${i}.tw`;
    blobs.set(path, bytesOf(`seed ${i}`));
    versionMeta.set(path, { created_at: new Date(Date.now() - (20 - i) * 60000).toISOString() });
  }
  assert.equal((await pf.listVersions('v')).length, 14);

  bypassThrottle();
  await pf.snapshotVersion('v');

  const after = await pf.listVersions('v');
  assert.equal(after.length, 12, `expected the cap of 12, got ${after.length}`);
});

test('restore: brings back the selected version even with another in between', async () => {
  db.clear(); blobs.clear(); versionMeta.clear();
  // Versions are whole .tw files and restore now DECODES them to explode into
  // the split layout — so the fixtures must be real zips, not stand-in text.
  const { encodeTw, decodeTw } = await import('./twFile.js');
  const twOf = (name) => encodeTw({ name, coverPage: false, cover: {}, zones: [], calculations: [] },
    new Map([['pdfA', bytesOf(`pdf-of-${name}`)]]));
  const nameOfTw = (bytes) => decodeTw(bytes.buffer ? bytes.buffer.slice(0) : bytes).project.name;

  db.set('v', { id: 'v', name: 'v', status: 'active', last_modified_at: nowIso(), file_size: 0 });
  await pf.writeProjectFile('v', twOf('version 1'));
  await pf.snapshotVersion('v'); // snapshot of "version 1"
  bypassThrottle();

  await pf.writeProjectFile('v', twOf('version 2 - the mistake'));
  await pf.snapshotVersion('v'); // snapshot of "version 2"
  bypassThrottle(); // otherwise restoreVersion's own snapshot below gets throttled
  await pf.writeProjectFile('v', twOf('version 3 - current'));

  const versions = await pf.listVersions('v');
  const versionOne = versions.find((ver) => nameOfTw(blobs.get(`versions/v/${ver.filename}`)) === 'version 1');
  assert.ok(versionOne, 'the first version is findable in history');

  await pf.restoreVersion('v', versionOne.filename);

  // Restore writes the SPLIT layout now, and retires the legacy blob.
  const split = await pf.readSplitProject('v');
  assert.equal(split.project.name, 'version 1', 'restoring brings back exactly the selected version');
  assert.deepEqual(split.pdfIds, ['pdfA'], 'its PDFs came along');
  assert.equal(blobs.has('v.tw'), false, 'the legacy blob is gone — storage is not doubled');
  assert.equal(db.get('v').name, 'version 1', 'metadata follows the restored contents');

  const afterRestore = await pf.listVersions('v');
  assert.ok(afterRestore.some((ver) => nameOfTw(blobs.get(`versions/v/${ver.filename}`)) === 'version 3 - current'),
    'restoring snapshots what was live first, so that is recoverable too');
});

// --- Split layout + optimistic concurrency ---

test('split: readSplitProject is null for a legacy project, round-trips for a split one', async () => {
  db.clear(); blobs.clear(); versionMeta.clear();
  await pf.writeProjectFile('legacy', bytesOf('old-blob'));
  assert.equal(await pf.readSplitProject('legacy'), null, 'legacy blob does not masquerade as split');

  await pf.uploadSplitManifest('s1', { name: 'Split One', coverPage: false, cover: {}, zones: [], calculations: [] });
  await pf.uploadSplitPdf('s1', 'pdf 1', bytesOf('%PDF-1'));
  const split = await pf.readSplitProject('s1');
  assert.equal(split.project.name, 'Split One');
  assert.deepEqual(split.pdfIds, ['pdf 1'], 'pdfIds decode back through the URI encoding');
});

test('split: assembleCloudTw builds one .tw from the pieces, and falls back to the legacy blob', async () => {
  db.clear(); blobs.clear(); versionMeta.clear();
  const { decodeTw } = await import('./twFile.js');

  await pf.uploadSplitManifest('s2', { name: 'Assembled', coverPage: false, cover: {}, zones: [], calculations: [] });
  await pf.uploadSplitPdf('s2', 'p1', bytesOf('%PDF-x'));
  const tw = await pf.assembleCloudTw('s2');
  const decoded = decodeTw(tw.buffer ? tw.buffer.slice(0) : tw);
  assert.equal(decoded.project.name, 'Assembled');
  assert.equal(textOf(decoded.pdfs.get('p1')), '%PDF-x');

  await pf.writeProjectFile('leg', bytesOf('raw-legacy-bytes'));
  assert.equal(textOf(await pf.assembleCloudTw('leg')), 'raw-legacy-bytes', 'legacy fallback returns the blob untouched');

  assert.equal(await pf.assembleCloudTw('nothing-there'), null, 'no layout at all is null, not a throw');
});

test('concurrency: claimProjectSave succeeds on the seen rev, refuses after someone else saves', async () => {
  db.clear(); blobs.clear();
  db.set('c1', { id: 'c1', name: 'Job', status: 'active', last_modified_at: nowIso(), file_size: 0 });
  const seenRev = db.get('c1').last_modified_at;

  const first = await pf.claimProjectSave('c1', { name: 'Job', file_size: 10 }, seenRev);
  assert.ok(first, 'the claim on the rev we loaded succeeds');
  assert.notEqual(first.last_modified_at, seenRev, 'and moves the rev forward');

  // A second client saves with the OLD rev — must be refused, not merged.
  const second = await pf.claimProjectSave('c1', { name: 'Job CLOBBERED' }, seenRev);
  assert.equal(second, null, 'a stale rev cannot claim the save');
  assert.equal(db.get('c1').name, 'Job', 'and nothing was written');
});

test('split: writeSplitFromTw explodes a zip and removes PDFs the zip does not contain', async () => {
  db.clear(); blobs.clear();
  const { encodeTw } = await import('./twFile.js');
  db.set('x1', { id: 'x1', name: 'x1', status: 'active', last_modified_at: nowIso(), file_size: 0 });

  // Pre-existing split object that the incoming .tw does NOT reference.
  await pf.uploadSplitPdf('x1', 'orphan', bytesOf('old'));

  const tw = encodeTw(
    { name: 'Exploded', coverPage: false, cover: {}, zones: [{ id: 'z1', name: 'L2', order: 0 }], calculations: [] },
    new Map([['keep', bytesOf('%PDF-keep')]]),
  );
  await pf.writeSplitFromTw('x1', tw);

  const split = await pf.readSplitProject('x1');
  assert.equal(split.project.name, 'Exploded');
  assert.deepEqual(split.pdfIds, ['keep'], 'the orphan PDF was removed, the referenced one kept');
  assert.equal(db.get('x1').name, 'Exploded');
  assert.deepEqual(db.get('x1').zones, [{ id: 'z1', name: 'L2', order: 0 }], 'zones column follows');
});

test('versions: snapshotVersionBytes throttles, force overrides, and big files keep fewer', async () => {
  db.clear(); blobs.clear(); versionMeta.clear();

  assert.equal(await pf.snapshotVersionBytes('vb', bytesOf('a')), true, 'first snapshot lands');
  assert.equal(await pf.snapshotVersionBytes('vb', bytesOf('b')), null, 'a second moments later is throttled');
  assert.equal(await pf.snapshotVersionBytes('vb', bytesOf('c'), { force: true }), true, 'force bypasses the throttle');

  // Size-aware pruning: seed 10 versions, then snapshot a >25 MB payload —
  // the keep-count drops to 4.
  db.clear(); blobs.clear(); versionMeta.clear();
  for (let i = 0; i < 10; i += 1) {
    const path = `versions/big/seed-${i}.tw`;
    blobs.set(path, bytesOf(`seed ${i}`));
    versionMeta.set(path, { created_at: new Date(Date.now() - (20 - i) * 60000).toISOString() });
  }
  const huge = new Uint8Array(26 * 1024 * 1024);
  await pf.snapshotVersionBytes('big', huge, { force: true });
  assert.equal((await pf.listVersions('big')).length, 4, 'a 26 MB project keeps 4 versions, not 12');
});

test('delete from trash also removes its version history (no orphans)', async () => {
  db.clear(); blobs.clear(); versionMeta.clear();
  await pf.writeProjectFile('v', bytesOf('content'));
  await pf.snapshotVersion('v');
  assert.equal((await pf.listVersions('v')).length, 1);

  await pf.deleteFromTrash('v');
  assert.equal((await pf.listVersions('v')).length, 0, 'no orphaned version objects remain after permanent deletion');
});

// --- Project status ---
// Vocabulary confirmed with the user 2026-07-17: active / completed /
// archive, no draft phase — a project is active from creation. The database
// enum keeps legacy draft/pending_approval/approved values (Postgres cannot
// drop them), which is exactly why REAL_PROJECT_STATUS_ENUM above lists all
// seven: these tests must fail the same way production would if the app
// ever wrote a status outside the real enum.

test('status: moves a project through the lifecycle', async () => {
  db.clear(); blobs.clear();
  await seedProject('s1', 'content');
  assert.equal(db.get('s1').status, 'active', 'starts active — no draft phase');

  await pf.setProjectStatus('s1', 'completed');
  assert.equal(db.get('s1').status, 'completed');

  await pf.setProjectStatus('s1', 'archive');
  assert.equal(db.get('s1').status, 'archive');
});

test('status: refuses to bin a project through the status setter', async () => {
  db.clear(); blobs.clear();
  await seedProject('s2', 'content');

  await assert.rejects(
    () => pf.setProjectStatus('s2', 'trashed'),
    /not a project status that can be set here/,
    'trashing has to go through trashProject(), which starts the 30-day purge clock',
  );
  assert.equal(db.get('s2').status, 'active', 'the project was left exactly as it was');
});

test('status: refuses a value that is not a real status at all', async () => {
  db.clear(); blobs.clear();
  await seedProject('s3', 'content');

  await assert.rejects(() => pf.setProjectStatus('s3', 'banana'), /not a project status/);
  assert.equal(db.get('s3').status, 'active');
});

test('status: refuses the old draft/completed vocabulary — proves the enum-mismatch bug cannot silently reappear', async () => {
  db.clear(); blobs.clear();
  await seedProject('s4', 'content');

  // 'draft' IS a real (legacy) enum value, but PROJECT_STATUSES no longer
  // offers it — setProjectStatus must still reject it as "not settable here",
  // the same way it already rejects 'trashed'.
  await assert.rejects(() => pf.setProjectStatus('s4', 'draft'), /not a project status that can be set here/);
});

test('status: only manager-level roles may change it', async () => {
  const { canChangeProjectStatus } = await import('./projectStatus.js');

  for (const role of ['admin', 'manager', 'team_leader']) {
    assert.equal(canChangeProjectStatus(role), true, `${role} may change status`);
  }
  for (const role of ['designer', 'sales', null, undefined, '', 'Admin']) {
    assert.equal(canChangeProjectStatus(role), false, `${JSON.stringify(role)} may not change status`);
  }
});

test('status: trashed is not offered as a pickable status', async () => {
  const { PROJECT_STATUSES } = await import('./projectStatus.js');
  assert.deepEqual(PROJECT_STATUSES, ['active', 'completed', 'archive']);
  assert.equal(PROJECT_STATUSES.includes('trashed'), false);
  assert.equal(PROJECT_STATUSES.includes('draft'), false);
});

test('status: every pickable status is a real enum value (would not 22P02 in production)', async () => {
  const { PROJECT_STATUSES } = await import('./projectStatus.js');
  for (const s of PROJECT_STATUSES) {
    assert.ok(REAL_PROJECT_STATUS_ENUM.has(s), `"${s}" must exist in the live project_status enum`);
  }
});

// --- Reading one project / saving its timeline ---

test('readProject: returns the record, and null for one that is not visible', async () => {
  db.clear(); blobs.clear();
  await seedProject('r1', 'content');

  const found = await pf.readProject('r1');
  assert.equal(found.id, 'r1');

  // RLS hiding a row surfaces as null, not a throw — the page renders
  // "not found" rather than an error banner.
  assert.equal(await pf.readProject('does-not-exist'), null);
});

const ZONES = [{ id: 'z1', name: 'Level 2', order: 0 }, { id: 'z2', name: 'Roof', order: 1 }];

test('saveSubmissions: writes only the timeline column, leaving the rest of the row alone', async () => {
  db.clear(); blobs.clear();
  await seedProject('t1', 'content');
  // A row as a designer's save leaves it: their zones, their counts, their size.
  db.set('t1', { ...db.get('t1'), name: 'Keep me', status: 'active', file_size: 4242, zones: ZONES });

  const { readSubmissions, setMilestoneDone, setSubmissionTarget } = await import('./projectTimeline.js');
  let subs = readSubmissions(db.get('t1'));
  subs = setSubmissionTarget(subs, 'z1', '2026-08-30');
  subs = setMilestoneDone(subs, 'z1', 'design_start', true);

  await pf.saveSubmissions('t1', subs);

  const row = db.get('t1');
  assert.equal(row.name, 'Keep me', 'name untouched');
  assert.equal(row.status, 'active', 'status untouched');
  assert.equal(row.file_size, 4242, "the designer's file_size is not clobbered by a manager's date edit");
  assert.deepEqual(row.zones, ZONES, 'and neither are their zones — that column belongs to the designer');
  assert.equal(row.timeline.submissions.z1.targetDate, '2026-08-30');
  assert.ok(row.timeline.submissions.z1.milestones.find((m) => m.key === 'design_start').doneAt);
});

test('saveSubmissions: round-trips through the store back into usable submissions', async () => {
  db.clear(); blobs.clear();
  await seedProject('t2', 'content');
  db.set('t2', { ...db.get('t2'), zones: ZONES });

  const { readSubmissions, setMilestoneDue, projectProgress } = await import('./projectTimeline.js');
  const subs = setMilestoneDue(readSubmissions(db.get('t2')), 'z2', 'issued', '2026-08-01');
  await pf.saveSubmissions('t2', subs);

  const back = readSubmissions(await pf.readProject('t2'));
  assert.equal(back.length, 2, 'one submission per zone');
  assert.equal(back.find((s) => s.zoneId === 'z2').milestones.find((m) => m.key === 'issued').due, '2026-08-01');
  assert.deepEqual(projectProgress(back), { done: 0, total: 2, pct: 0 });
});

test('saveSubmissions: dates survive a designer renaming the zone underneath them', async () => {
  // The reason names live in `zones` and dates in `timeline`: a rename is a
  // designer's write, and the timeline trigger forbids designers from touching
  // that column. Keyed by id, so the join still lands.
  db.clear(); blobs.clear();
  await seedProject('t3', 'content');
  db.set('t3', { ...db.get('t3'), zones: ZONES });

  const { readSubmissions, setSubmissionTarget } = await import('./projectTimeline.js');
  await pf.saveSubmissions('t3', setSubmissionTarget(readSubmissions(db.get('t3')), 'z1', '2026-08-30'));

  // The designer renames the zone and saves — writing `zones`, never `timeline`.
  db.set('t3', { ...db.get('t3'), zones: [{ id: 'z1', name: 'Level 2 — REV B', order: 0 }, ZONES[1]] });

  const back = readSubmissions(await pf.readProject('t3'));
  const renamed = back.find((s) => s.zoneId === 'z1');
  assert.equal(renamed.zoneName, 'Level 2 — REV B', 'the new name shows through');
  assert.equal(renamed.targetDate, '2026-08-30', 'and its date is still attached');
});
