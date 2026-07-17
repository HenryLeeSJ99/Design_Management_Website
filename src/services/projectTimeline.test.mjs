/**
 * projectTimeline.js — the derivation logic managers and sales will read
 * dates off, so the edge cases matter more than the happy path.
 *
 * Pure module, no Supabase, so this needs no mocking — just the extensionless
 * import resolver.
 *
 * Run: node --experimental-loader <extResolver> --test src/services/projectTimeline.test.mjs
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  MILESTONES, canEditTimeline, currentMilestone, daysToTarget, isSlipping,
  projectIsSlipping, readTimeline, serialiseTimeline, setMilestoneDone,
  setMilestoneDue, setTargetDate, timelineProgress,
} from './projectTimeline.js';

const KEYS = MILESTONES.map((m) => m.key);
const day = (iso) => new Date(`${iso}T12:00:00Z`);

// --- readTimeline: normalising whatever the json column holds ---

test('readTimeline: a project with no timeline yet gets the full template', () => {
  const t = readTimeline({ timeline: null });
  assert.equal(t.targetDate, null);
  assert.deepEqual(t.milestones.map((m) => m.key), KEYS, 'every milestone present, in template order');
  assert.ok(t.milestones.every((m) => m.due === null && m.doneAt === null));
});

test('readTimeline: survives junk in the column without throwing', () => {
  for (const junk of [undefined, 'a string', 42, [], { milestones: 'not an array' }, { milestones: [null, 7] }]) {
    const t = readTimeline({ timeline: junk });
    assert.deepEqual(t.milestones.map((m) => m.key), KEYS, `junk ${JSON.stringify(junk)} still yields the template`);
  }
});

test('readTimeline: merges stored due/doneAt onto the template', () => {
  const t = readTimeline({
    timeline: {
      targetDate: '2026-08-30',
      milestones: [{ key: 'internal_check', due: '2026-08-10', doneAt: '2026-08-09T10:00:00Z' }],
    },
  });
  assert.equal(t.targetDate, '2026-08-30');
  const check = t.milestones.find((m) => m.key === 'internal_check');
  assert.equal(check.due, '2026-08-10');
  assert.equal(check.doneAt, '2026-08-09T10:00:00Z');
  // The others are still there, just empty
  assert.equal(t.milestones.length, KEYS.length);
  assert.equal(t.milestones.find((m) => m.key === 'issued').due, null);
});

test('readTimeline: a milestone key from an older template is ignored, not shown', () => {
  const t = readTimeline({
    timeline: { milestones: [{ key: 'pending_approval', due: '2026-01-01' }, { key: 'issued', due: '2026-08-01' }] },
  });
  assert.deepEqual(t.milestones.map((m) => m.key), KEYS, 'the retired key does not leak into the UI');
  assert.equal(t.milestones.find((m) => m.key === 'issued').due, '2026-08-01', 'the valid one still lands');
});

test('readTimeline: stored order does not override template order', () => {
  const t = readTimeline({
    timeline: { milestones: [{ key: 'client_approved' }, { key: 'design_start' }] },
  });
  assert.deepEqual(t.milestones.map((m) => m.key), KEYS);
});

// --- serialise ---

test('serialise: round-trips, and drops label so renaming never needs a data migration', () => {
  const t = setMilestoneDue(readTimeline({ timeline: null }), 'issued', '2026-08-01');
  const raw = serialiseTimeline(setTargetDate(t, '2026-08-30'));

  assert.equal(raw.targetDate, '2026-08-30');
  assert.ok(raw.milestones.every((m) => !('label' in m)), 'no label is persisted');
  assert.deepEqual(Object.keys(raw.milestones[0]).sort(), ['doneAt', 'due', 'key']);

  const back = readTimeline({ timeline: raw });
  assert.equal(back.milestones.find((m) => m.key === 'issued').due, '2026-08-01');
  assert.equal(back.targetDate, '2026-08-30');
});

// --- progress / current ---

test('progress: counts done milestones out of the template total', () => {
  let t = readTimeline({ timeline: null });
  assert.deepEqual(timelineProgress(t), { done: 0, total: 5, pct: 0 });

  t = setMilestoneDone(t, 'design_start', true);
  t = setMilestoneDone(t, 'design_complete', true);
  assert.deepEqual(timelineProgress(t), { done: 2, total: 5, pct: 40 });

  for (const k of KEYS) t = setMilestoneDone(t, k, true);
  assert.deepEqual(timelineProgress(t), { done: 5, total: 5, pct: 100 });
});

test('setMilestoneDone: unticking clears the timestamp, and nothing mutates in place', () => {
  const t0 = readTimeline({ timeline: null });
  const t1 = setMilestoneDone(t0, 'issued', true, day('2026-08-01'));
  assert.equal(t0.milestones.find((m) => m.key === 'issued').doneAt, null, 'original untouched');
  assert.ok(t1.milestones.find((m) => m.key === 'issued').doneAt);

  const t2 = setMilestoneDone(t1, 'issued', false);
  assert.equal(t2.milestones.find((m) => m.key === 'issued').doneAt, null);
});

test('current: the first not-done milestone, even when a later one is ticked out of order', () => {
  let t = readTimeline({ timeline: null });
  assert.equal(currentMilestone(t).key, 'design_start');

  // Tick a LATER one only. The job is still honestly waiting on design_start.
  t = setMilestoneDone(t, 'issued', true);
  assert.equal(currentMilestone(t).key, 'design_start',
    'out-of-order ticks do not skip the outstanding earlier milestone');

  t = setMilestoneDone(t, 'design_start', true);
  assert.equal(currentMilestone(t).key, 'design_complete');
});

test('current: null once everything is done', () => {
  let t = readTimeline({ timeline: null });
  for (const k of KEYS) t = setMilestoneDone(t, k, true);
  assert.equal(currentMilestone(t), null);
});

// --- slipping ---

test('slipping: a milestone past its due date and not done', () => {
  let t = readTimeline({ timeline: null });
  t = setMilestoneDue(t, 'design_complete', '2026-07-10');
  assert.equal(isSlipping(t, day('2026-07-17')), true, 'overdue and open');

  t = setMilestoneDone(t, 'design_complete', true);
  assert.equal(isSlipping(t, day('2026-07-17')), false, 'done late is not still slipping');
});

test('slipping: due today is not late', () => {
  const t = setMilestoneDue(readTimeline({ timeline: null }), 'issued', '2026-07-17');
  assert.equal(isSlipping(t, new Date('2026-07-17T09:00:00')), false, 'not late in the morning');
  assert.equal(isSlipping(t, new Date('2026-07-17T23:30:00')), false, 'still not late at night — due today means due today');
  assert.equal(isSlipping(t, new Date('2026-07-18T00:30:00')), true, 'late the next day');
});

test('slipping: target date passed with work outstanding', () => {
  let t = setTargetDate(readTimeline({ timeline: null }), '2026-07-10');
  assert.equal(isSlipping(t, day('2026-07-17')), true);

  for (const k of KEYS) t = setMilestoneDone(t, k, true);
  assert.equal(isSlipping(t, day('2026-07-17')), false, 'finished, so a past target date is just history');
});

test('slipping: no dates set at all is not slipping', () => {
  assert.equal(isSlipping(readTimeline({ timeline: null }), day('2026-07-17')), false);
});

// --- projectIsSlipping: the status-aware question the UI actually asks ---

// An overdue timeline: internal_check due a week ago and still open.
const OVERDUE = {
  targetDate: '2026-07-10',
  milestones: [{ key: 'internal_check', due: '2026-07-10', doneAt: null }],
};

test('projectIsSlipping: an active project with a passed date is flagged', () => {
  assert.equal(projectIsSlipping({ status: 'active', timeline: OVERDUE }, day('2026-07-17')), true);
});

test('projectIsSlipping: archived and completed projects are never flagged', () => {
  // The bug this exists to prevent: an archived job with a long-past target
  // rendering red on the portfolio, training everyone to ignore the colour.
  assert.equal(projectIsSlipping({ status: 'archive', timeline: OVERDUE }, day('2026-07-17')), false);
  assert.equal(projectIsSlipping({ status: 'completed', timeline: OVERDUE }, day('2026-07-17')), false);
});

test('projectIsSlipping: a project with no status defaults to active and can be flagged', () => {
  assert.equal(projectIsSlipping({ timeline: OVERDUE }, day('2026-07-17')), true);
  assert.equal(projectIsSlipping({ status: null, timeline: OVERDUE }, day('2026-07-17')), true);
});

test('projectIsSlipping: an active project with no dates is not flagged', () => {
  assert.equal(projectIsSlipping({ status: 'active', timeline: null }, day('2026-07-17')), false);
});

// --- daysToTarget ---

test('daysToTarget: counts whole calendar days either side, null when unset', () => {
  assert.equal(daysToTarget(readTimeline({ timeline: null })), null);

  const t = setTargetDate(readTimeline({ timeline: null }), '2026-07-30');
  assert.equal(daysToTarget(t, day('2026-07-17')), 13);
  assert.equal(daysToTarget(t, day('2026-07-30')), 0, 'target day itself is 0, not 1');
  assert.equal(daysToTarget(t, day('2026-08-02')), -3, 'negative once passed');
});

test('daysToTarget: unaffected by time of day', () => {
  const t = setTargetDate(readTimeline({ timeline: null }), '2026-07-30');
  assert.equal(daysToTarget(t, new Date('2026-07-29T23:59:00')), 1);
  assert.equal(daysToTarget(t, new Date('2026-07-29T00:01:00')), 1);
});

// --- role gate ---

test('canEditTimeline: manager-level only — sales reads, never writes', () => {
  for (const role of ['admin', 'manager', 'team_leader']) {
    assert.equal(canEditTimeline(role), true, `${role} may edit the timeline`);
  }
  for (const role of ['sales', 'designer', null, undefined, '', 'Manager']) {
    assert.equal(canEditTimeline(role), false, `${JSON.stringify(role)} may not edit the timeline`);
  }
});

test('milestone template is the agreed five, in order', () => {
  assert.deepEqual(KEYS, ['design_start', 'design_complete', 'internal_check', 'issued', 'client_approved']);
});
