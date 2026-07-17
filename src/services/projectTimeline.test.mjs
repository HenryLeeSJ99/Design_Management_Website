/**
 * projectTimeline.js — per-zone submissions.
 *
 * The derivation logic managers and sales read dates off, so the edge cases
 * matter more than the happy path. Pure module, no Supabase, no mocking.
 *
 * Run: node --test src/services/projectTimeline.test.mjs
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  MILESTONES, canEditTimeline, currentMilestone, daysToDate, nextSubmission,
  projectIsSlipping, projectProgress, projectTarget, readSubmissions,
  serialiseSubmissions, setMilestoneDone, setMilestoneDue, setSubmissionTarget,
  submissionComplete, submissionIsSlipping, submissionProgress,
} from './projectTimeline.js';

const KEYS = MILESTONES.map((m) => m.key);
const day = (iso) => new Date(`${iso}T12:00:00Z`);

/** A project record as listProjects()/readProject() returns it. */
const proj = ({ zones = [], submissions = {}, status = 'active' } = {}) => ({
  status,
  zones,
  timeline: { submissions },
});

const ZONES = [
  { id: 'z2', name: 'Levels 3–20 (Typical)', order: 1 },
  { id: 'z1', name: 'Level 2', order: 0 },
  { id: 'z3', name: 'Roof', order: 2 },
];

const allDone = () => KEYS.map((key) => ({ key, due: null, doneAt: '2026-07-01T00:00:00Z' }));

// --- readSubmissions: joining zones to dates ---

test('readSubmissions: one submission per zone, in zone order', () => {
  const subs = readSubmissions(proj({ zones: ZONES }));
  assert.deepEqual(subs.map((s) => s.zoneName), ['Level 2', 'Levels 3–20 (Typical)', 'Roof'],
    'ordered by zone order, not the order they happen to sit in the array');
  assert.equal(subs.length, 3);
});

test('readSubmissions: a zone nobody has dated still gets a full submission', () => {
  // A manager must be able to set a date on a zone no one has touched.
  const subs = readSubmissions(proj({ zones: ZONES }));
  assert.deepEqual(subs[0].milestones.map((m) => m.key), KEYS);
  assert.equal(subs[0].targetDate, null);
  assert.ok(subs[0].milestones.every((m) => !m.due && !m.doneAt));
});

test('readSubmissions: names come from zones, never from stored dates', () => {
  // The whole reason names live in one column: a rename must not need a
  // timeline write, which a designer is not allowed to make.
  const subs = readSubmissions(proj({
    zones: [{ id: 'z1', name: 'Level 2 — REVISED', order: 0 }],
    submissions: { z1: { targetDate: '2026-07-20', milestones: [] } },
  }));
  assert.equal(subs[0].zoneName, 'Level 2 — REVISED');
  assert.equal(subs[0].targetDate, '2026-07-20', 'the dates still attach to the renamed zone');
});

test('readSubmissions: dates for a deleted zone are dropped, not stranded', () => {
  const subs = readSubmissions(proj({
    zones: [{ id: 'z1', name: 'Level 2', order: 0 }],
    submissions: {
      z1: { targetDate: '2026-07-20', milestones: [] },
      zGONE: { targetDate: '2026-01-01', milestones: [] },
    },
  }));
  assert.equal(subs.length, 1, 'the deleted zone does not reappear as a phantom submission');
  assert.equal(subs[0].zoneId, 'z1');
});

test('readSubmissions: survives junk in either column', () => {
  for (const zones of [null, undefined, 'nope', [null, 7, {}]]) {
    for (const timeline of [null, undefined, 'nope', 42, { submissions: 'nope' }]) {
      const subs = readSubmissions({ zones, timeline });
      assert.ok(Array.isArray(subs), `zones=${JSON.stringify(zones)} timeline=${JSON.stringify(timeline)}`);
    }
  }
  assert.deepEqual(readSubmissions({}), []);
});

test('readSubmissions: a milestone key from an older template is ignored', () => {
  const subs = readSubmissions(proj({
    zones: [{ id: 'z1', name: 'Level 2', order: 0 }],
    submissions: { z1: { milestones: [{ key: 'pending_approval', due: '2026-01-01' }, { key: 'issued', due: '2026-08-01' }] } },
  }));
  assert.deepEqual(subs[0].milestones.map((m) => m.key), KEYS, 'the retired key does not leak into the UI');
  assert.equal(subs[0].milestones.find((m) => m.key === 'issued').due, '2026-08-01');
});

// --- serialise ---

test('serialise: keyed by zone id, carries no zone name', () => {
  let subs = readSubmissions(proj({ zones: ZONES }));
  subs = setSubmissionTarget(subs, 'z1', '2026-07-20');
  subs = setMilestoneDue(subs, 'z1', 'issued', '2026-07-18');

  const raw = serialiseSubmissions(subs);
  assert.deepEqual(Object.keys(raw.submissions).sort(), ['z1', 'z2', 'z3']);
  assert.equal(raw.submissions.z1.targetDate, '2026-07-20');
  assert.ok(!('zoneName' in raw.submissions.z1), 'names belong to the zones column only');
  assert.deepEqual(Object.keys(raw.submissions.z1.milestones[0]).sort(), ['doneAt', 'due', 'key']);

  const back = readSubmissions({ zones: ZONES, timeline: raw });
  assert.equal(back[0].targetDate, '2026-07-20');
  assert.equal(back[0].milestones.find((m) => m.key === 'issued').due, '2026-07-18');
});

// --- editing ---

test('setMilestoneDone: touches only the named zone, and does not mutate', () => {
  const before = readSubmissions(proj({ zones: ZONES }));
  const after = setMilestoneDone(before, 'z2', 'design_start', true, day('2026-07-01'));

  assert.equal(before[1].milestones[0].doneAt, null, 'the original array is untouched');
  assert.ok(after[1].milestones[0].doneAt, 'the named zone is ticked');
  assert.equal(after[0].milestones[0].doneAt, null, 'a different zone is not');
  assert.equal(after[2].milestones[0].doneAt, null);
});

test('setMilestoneDone: unticking clears the timestamp', () => {
  let subs = readSubmissions(proj({ zones: ZONES }));
  subs = setMilestoneDone(subs, 'z1', 'issued', true);
  subs = setMilestoneDone(subs, 'z1', 'issued', false);
  assert.equal(subs[0].milestones.find((m) => m.key === 'issued').doneAt, null);
});

// --- one submission ---

test('currentMilestone: first not-done, even when a later one is ticked out of order', () => {
  let subs = readSubmissions(proj({ zones: [{ id: 'z1', name: 'Level 2', order: 0 }] }));
  assert.equal(currentMilestone(subs[0]).key, 'design_start');

  subs = setMilestoneDone(subs, 'z1', 'issued', true);
  assert.equal(currentMilestone(subs[0]).key, 'design_start',
    'an out-of-order tick does not skip the outstanding earlier milestone');
});

test('submissionProgress / complete', () => {
  let subs = readSubmissions(proj({ zones: [{ id: 'z1', name: 'Level 2', order: 0 }] }));
  assert.deepEqual(submissionProgress(subs[0]), { done: 0, total: 5, pct: 0 });
  assert.equal(submissionComplete(subs[0]), false);

  for (const k of KEYS) subs = setMilestoneDone(subs, 'z1', k, true);
  assert.deepEqual(submissionProgress(subs[0]), { done: 5, total: 5, pct: 100 });
  assert.equal(submissionComplete(subs[0]), true);
  assert.equal(currentMilestone(subs[0]), null);
});

test('submissionIsSlipping: overdue milestone, and due-today is not late', () => {
  let subs = readSubmissions(proj({ zones: [{ id: 'z1', name: 'Level 2', order: 0 }] }));
  subs = setMilestoneDue(subs, 'z1', 'internal_check', '2026-07-16');
  assert.equal(submissionIsSlipping(subs[0], day('2026-07-17')), true);
  assert.equal(submissionIsSlipping(subs[0], new Date('2026-07-16T23:30:00')), false,
    'due today is due today, not late at 23:30');

  subs = setMilestoneDone(subs, 'z1', 'internal_check', true);
  assert.equal(submissionIsSlipping(subs[0], day('2026-07-17')), false, 'done late is not still slipping');
});

// --- rolled up ---

test('projectTarget: the LATEST submission target, derived not stored', () => {
  const subs = readSubmissions(proj({
    zones: ZONES,
    submissions: {
      z1: { targetDate: '2026-07-20', milestones: [] },
      z2: { targetDate: '2026-08-12', milestones: [] },
      z3: { targetDate: '2026-08-30', milestones: [] },
    },
  }));
  assert.equal(projectTarget(subs), '2026-08-30');
});

test('projectTarget: null when no zone has a target', () => {
  assert.equal(projectTarget(readSubmissions(proj({ zones: ZONES }))), null);
  assert.equal(projectTarget([]), null);
});

test('projectTarget: ignores zones with no date rather than treating them as earliest', () => {
  const subs = readSubmissions(proj({
    zones: ZONES,
    submissions: { z2: { targetDate: '2026-08-12', milestones: [] } },
  }));
  assert.equal(projectTarget(subs), '2026-08-12');
});

test('projectProgress: counted in submissions, not milestones', () => {
  const subs = readSubmissions(proj({
    zones: ZONES,
    submissions: {
      z1: { milestones: allDone() },
      // z2 half-ticked — a partly-done submission is NOT a done submission
      z2: { milestones: [{ key: 'design_start', doneAt: '2026-07-01T00:00:00Z' }] },
    },
  }));
  assert.deepEqual(projectProgress(subs), { done: 1, total: 3, pct: 33 });
});

test('projectProgress: no zones is zero of zero, not a divide by zero', () => {
  assert.deepEqual(projectProgress([]), { done: 0, total: 0, pct: 0 });
});

test('nextSubmission: the earliest-due unfinished one', () => {
  const subs = readSubmissions(proj({
    zones: ZONES,
    submissions: {
      z1: { targetDate: '2026-07-20', milestones: allDone() }, // finished — skip it
      z2: { targetDate: '2026-08-12', milestones: [] },
      z3: { targetDate: '2026-08-30', milestones: [] },
    },
  }));
  assert.equal(nextSubmission(subs).zoneName, 'Levels 3–20 (Typical)',
    'the soonest OPEN submission, not the soonest overall');
});

test('nextSubmission: an undated open zone loses to a dated one', () => {
  const subs = readSubmissions(proj({
    zones: ZONES,
    submissions: { z3: { targetDate: '2026-08-30', milestones: [] } },
  }));
  assert.equal(nextSubmission(subs).zoneId, 'z3', 'a date nobody set is not a deadline');
});

test('nextSubmission: null once every submission is complete', () => {
  const subs = readSubmissions(proj({
    zones: ZONES,
    submissions: { z1: { milestones: allDone() }, z2: { milestones: allDone() }, z3: { milestones: allDone() } },
  }));
  assert.equal(nextSubmission(subs), null);
});

// --- flagging ---

const OVERDUE = { z1: { targetDate: '2026-07-10', milestones: [] } };

test('projectIsSlipping: active project with an overdue submission is flagged', () => {
  assert.equal(projectIsSlipping(proj({ zones: ZONES, submissions: OVERDUE }), day('2026-07-17')), true);
});

test('projectIsSlipping: archived and completed are never flagged', () => {
  // The bug this exists to prevent: an archived job with a long-past date
  // rendering red on the portfolio, training everyone to ignore the colour.
  for (const status of ['archive', 'completed']) {
    assert.equal(projectIsSlipping(proj({ zones: ZONES, submissions: OVERDUE, status }), day('2026-07-17')), false,
      `${status} must not be flagged`);
  }
});

test('projectIsSlipping: one late zone flags the project even when others are fine', () => {
  const p = proj({
    zones: ZONES,
    submissions: {
      z1: { targetDate: '2026-07-10', milestones: [] }, // late
      z2: { targetDate: '2026-12-01', milestones: [] }, // fine
    },
  });
  assert.equal(projectIsSlipping(p, day('2026-07-17')), true);
});

test('projectIsSlipping: a project with no dates at all is not flagged', () => {
  assert.equal(projectIsSlipping(proj({ zones: ZONES }), day('2026-07-17')), false);
});

// --- dates ---

test('daysToDate: whole calendar days either side, unaffected by time of day', () => {
  assert.equal(daysToDate(null), null);
  assert.equal(daysToDate('2026-07-30', day('2026-07-17')), 13);
  assert.equal(daysToDate('2026-07-30', day('2026-07-30')), 0, 'the day itself is 0, not 1');
  assert.equal(daysToDate('2026-07-30', day('2026-08-02')), -3);
  assert.equal(daysToDate('2026-07-30', new Date('2026-07-29T23:59:00')), 1);
  assert.equal(daysToDate('2026-07-30', new Date('2026-07-29T00:01:00')), 1);
});

// --- role gate ---

test('canEditTimeline: manager-level only — sales reads, never writes', () => {
  for (const role of ['admin', 'manager', 'team_leader']) {
    assert.equal(canEditTimeline(role), true, `${role} may edit`);
  }
  for (const role of ['sales', 'designer', null, undefined, '', 'Manager']) {
    assert.equal(canEditTimeline(role), false, `${JSON.stringify(role)} may not edit`);
  }
});

test('milestone template is the agreed five, in order', () => {
  assert.deepEqual(KEYS, ['design_start', 'design_complete', 'internal_check', 'issued', 'client_approved']);
});
