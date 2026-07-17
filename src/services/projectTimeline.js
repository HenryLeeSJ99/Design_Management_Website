/**
 * A project's timeline: where a design job has got to, and when it is due.
 *
 * Stored in projects.timeline, which is already a json column — no migration
 * needed. Shape:
 *
 *   {
 *     "targetDate": "2026-08-30",
 *     "milestones": [
 *       { "key": "design_start", "due": "2026-07-20", "doneAt": "2026-07-18T09:12:00Z" }
 *     ]
 *   }
 *
 * MILESTONES ARE A FIXED TEMPLATE, NOT FREE-FORM PER PROJECT.
 * That is the load-bearing decision here. Fixed keys are what make
 * "which jobs are slipping?" and "what is stuck at internal check?"
 * answerable across the whole portfolio, and what lets one progress bar mean
 * the same thing on every row. Per-project milestones would look more
 * flexible and quietly destroy every cross-project question the portfolio
 * exists to answer.
 *
 * Consequently MILESTONES below is the source of truth for which milestones
 * exist and their order; the stored json only ever supplies `due` and
 * `doneAt`. An unknown key in stored data is ignored rather than shown, so
 * changing this template can never strand a project on milestones that are
 * no longer part of the process.
 */

export const MILESTONES = [
  { key: 'design_start', label: 'Design start' },
  { key: 'design_complete', label: 'Design complete' },
  { key: 'internal_check', label: 'Internal check' },
  { key: 'issued', label: 'Issued to client' },
  { key: 'client_approved', label: 'Client approved' },
];

export const MILESTONE_COUNT = MILESTONES.length;

const EMPTY = { targetDate: null, milestones: [] };

/**
 * The timeline for a project, normalised: always every milestone in template
 * order, whatever the stored json happens to contain (null, {}, a partial
 * list, or keys from an older template).
 */
export function readTimeline(project) {
  const raw = project?.timeline;
  const stored = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : EMPTY;
  const byKey = new Map(
    (Array.isArray(stored.milestones) ? stored.milestones : [])
      .filter((m) => m && typeof m.key === 'string')
      .map((m) => [m.key, m]),
  );

  return {
    targetDate: typeof stored.targetDate === 'string' ? stored.targetDate : null,
    milestones: MILESTONES.map(({ key, label }) => {
      const m = byKey.get(key) || {};
      return {
        key,
        label,
        due: typeof m.due === 'string' ? m.due : null,
        doneAt: typeof m.doneAt === 'string' ? m.doneAt : null,
      };
    }),
  };
}

/**
 * Back to the shape stored in the json column. Only key/due/doneAt are kept —
 * `label` comes from the template at read time, so renaming a milestone never
 * requires touching stored data.
 */
export function serialiseTimeline(timeline) {
  return {
    targetDate: timeline.targetDate || null,
    milestones: timeline.milestones.map(({ key, due, doneAt }) => ({
      key,
      due: due || null,
      doneAt: doneAt || null,
    })),
  };
}

/** Mark a milestone done (or not). Returns a new timeline; does not mutate. */
export function setMilestoneDone(timeline, key, done, now = new Date()) {
  return {
    ...timeline,
    milestones: timeline.milestones.map((m) =>
      m.key === key ? { ...m, doneAt: done ? now.toISOString() : null } : m),
  };
}

/** Set a milestone's due date (YYYY-MM-DD, or null to clear). */
export function setMilestoneDue(timeline, key, due) {
  return {
    ...timeline,
    milestones: timeline.milestones.map((m) => (m.key === key ? { ...m, due: due || null } : m)),
  };
}

export function setTargetDate(timeline, targetDate) {
  return { ...timeline, targetDate: targetDate || null };
}

/** How far along: {done, total, pct}. pct is 0–100, rounded. */
export function timelineProgress(timeline) {
  const done = timeline.milestones.filter((m) => m.doneAt).length;
  const total = timeline.milestones.length;
  return { done, total, pct: total ? Math.round((done / total) * 100) : 0 };
}

/**
 * The milestone the job is waiting on — the first not-yet-done one in
 * template order, or null once everything is done.
 *
 * Deliberately "first not done" rather than "the one after the last done":
 * milestones can be ticked out of order, and if design_start is somehow still
 * open the honest answer is that the job is waiting on design_start, not on
 * whatever happens to be furthest along.
 */
export function currentMilestone(timeline) {
  return timeline.milestones.find((m) => !m.doneAt) || null;
}

const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };

/**
 * Is this job late? True when a milestone's due date has passed without it
 * being done, or the target date has passed with work outstanding.
 *
 * Compared by day, not by instant: a milestone due today is not late at 09:00
 * and late at 17:00, it is simply due today.
 */
export function isSlipping(timeline, now = new Date()) {
  const today = startOfDay(now);
  const overdueMilestone = timeline.milestones.some(
    (m) => !m.doneAt && m.due && startOfDay(m.due) < today,
  );
  if (overdueMilestone) return true;
  const { done, total } = timelineProgress(timeline);
  return Boolean(timeline.targetDate && startOfDay(timeline.targetDate) < today && done < total);
}

/**
 * Whether to FLAG a project as behind schedule, given its status.
 *
 * Only a live project can be behind. A completed or archived job with a past
 * target — or milestones nobody ever ticked — is history, not a problem, and
 * painting it red would train everyone to ignore the colour on the jobs that
 * do need chasing. isSlipping() above stays purely about the dates; this is
 * the question the UI actually wants to ask.
 */
export function projectIsSlipping(project, now = new Date()) {
  if ((project?.status || 'active') !== 'active') return false;
  return isSlipping(readTimeline(project), now);
}

/**
 * Days until the target date. Negative when it has passed, null when no
 * target is set. Whole days, counted by calendar day.
 */
export function daysToTarget(timeline, now = new Date()) {
  if (!timeline.targetDate) return null;
  return Math.round((startOfDay(timeline.targetDate) - startOfDay(now)) / 86400000);
}

/**
 * Who may edit a project's timeline: the same manager-level roles that may
 * change its status. Sales reads it and cannot write — that is the whole
 * point of the role existing here.
 *
 * As with canChangeProjectStatus(), this is the UI gate only. The database
 * is the real boundary — see supabase/migrations/ for the trigger.
 */
export function canEditTimeline(role) {
  return role === 'admin' || role === 'manager' || role === 'team_leader';
}
