/**
 * Where a project's design work has got to, and when it is due.
 *
 * ONE ZONE IS ONE SUBMISSION. A project is not submitted once — each zone
 * ("Level 2", "Levels 3-20 (Typical)", "Roof") goes to the client as its own
 * package, on its own clock. Level 2 can be approved while the Roof has not
 * started, so a single project-level "waiting on Internal check" is a fiction.
 * Every milestone therefore hangs off a submission, never off the project.
 *
 * WHERE THE DATA LIVES — two columns, two owners:
 *
 *   projects.zones     [{ id, name, order }]  — copied up from the .tw on
 *                      every save. Designer-owned, ungated. The source of
 *                      truth for WHICH zones exist, their names and order.
 *
 *   projects.timeline  { submissions: { [zoneId]: { targetDate, milestones } } }
 *                      — manager-owned, gated by a Postgres trigger. Only
 *                      dates. Never names.
 *
 * They are joined on zone id at read time. That split is not tidiness: the
 * timeline trigger refuses writes from designers, so zone names — which
 * designers author and change — cannot live in `timeline` without breaking
 * every designer save. It also means a rename happens in exactly one place and
 * can never go stale up here.
 *
 * MILESTONES ARE A FIXED TEMPLATE, NOT FREE-FORM.
 * Fixed keys are what make "which submissions are slipping?" answerable across
 * the whole portfolio, and what let one progress bar mean the same thing
 * everywhere. Per-project milestones would look more flexible and quietly
 * destroy every cross-project question the portfolio exists to answer.
 * MILESTONES below is the source of truth for which milestones exist and their
 * order; stored json only ever supplies `due` and `doneAt`.
 */

export const MILESTONES = [
  { key: 'design_start', label: 'Design start' },
  { key: 'design_complete', label: 'Design complete' },
  { key: 'internal_check', label: 'Internal check' },
  { key: 'issued', label: 'Issued to client' },
  { key: 'client_approved', label: 'Client approved' },
];

export const MILESTONE_COUNT = MILESTONES.length;

const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);

/** The milestone list for one submission, normalised against the template. */
function readMilestones(stored) {
  const byKey = new Map(
    (Array.isArray(stored?.milestones) ? stored.milestones : [])
      .filter((m) => m && typeof m.key === 'string')
      .map((m) => [m.key, m]),
  );
  return MILESTONES.map(({ key, label }) => {
    const m = byKey.get(key) || {};
    return {
      key,
      label,
      due: typeof m.due === 'string' ? m.due : null,
      doneAt: typeof m.doneAt === 'string' ? m.doneAt : null,
    };
  });
}

/**
 * A project's submissions: one per zone, in zone order, each with the full
 * milestone template.
 *
 * The zone list drives this entirely. A zone with no stored dates yields an
 * empty submission rather than being absent — a manager must be able to set a
 * date on a zone nobody has touched yet. Dates whose zone no longer exists are
 * dropped, so deleting a zone in the workbook can never strand a submission
 * for something that isn't in the project any more.
 *
 * Accepts a project record from listProjects()/readProject() — i.e. with the
 * `zones` and `timeline` columns on it.
 */
export function readSubmissions(project) {
  const zones = Array.isArray(project?.zones) ? project.zones : [];
  const stored = isObj(project?.timeline) && isObj(project.timeline.submissions)
    ? project.timeline.submissions
    : {};

  return [...zones]
    .filter((z) => z && typeof z.id === 'string')
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((zone) => ({
      zoneId: zone.id,
      zoneName: zone.name || 'Untitled zone',
      targetDate: typeof stored[zone.id]?.targetDate === 'string' ? stored[zone.id].targetDate : null,
      milestones: readMilestones(stored[zone.id]),
    }));
}

/**
 * Back to the shape stored in the timeline column. Keyed by zone id, and
 * carrying no zone names — those belong to the zones column, so renaming a
 * zone never requires touching stored dates.
 */
export function serialiseSubmissions(submissions) {
  const out = {};
  for (const s of submissions) {
    out[s.zoneId] = {
      targetDate: s.targetDate || null,
      milestones: s.milestones.map(({ key, due, doneAt }) => ({
        key,
        due: due || null,
        doneAt: doneAt || null,
      })),
    };
  }
  return { submissions: out };
}

const mapZone = (submissions, zoneId, fn) =>
  submissions.map((s) => (s.zoneId === zoneId ? fn(s) : s));

/** Mark one submission's milestone done (or not). Returns a new array. */
export function setMilestoneDone(submissions, zoneId, key, done, now = new Date()) {
  return mapZone(submissions, zoneId, (s) => ({
    ...s,
    milestones: s.milestones.map((m) => (m.key === key
      ? { ...m, doneAt: done ? now.toISOString() : null }
      : m)),
  }));
}

/** Set one submission's milestone due date (YYYY-MM-DD, or null to clear). */
export function setMilestoneDue(submissions, zoneId, key, due) {
  return mapZone(submissions, zoneId, (s) => ({
    ...s,
    milestones: s.milestones.map((m) => (m.key === key ? { ...m, due: due || null } : m)),
  }));
}

/** Set one submission's target date. */
export function setSubmissionTarget(submissions, zoneId, targetDate) {
  return mapZone(submissions, zoneId, (s) => ({ ...s, targetDate: targetDate || null }));
}

// --- One submission ---

/** {done, total, pct} for a single submission. */
export function submissionProgress(submission) {
  const done = submission.milestones.filter((m) => m.doneAt).length;
  const total = submission.milestones.length;
  return { done, total, pct: total ? Math.round((done / total) * 100) : 0 };
}

export const submissionComplete = (submission) => submission.milestones.every((m) => m.doneAt);

/**
 * The milestone this submission is waiting on — the first not-yet-done one in
 * template order, or null once it is finished.
 *
 * Deliberately "first not done" rather than "the one after the last done":
 * milestones can be ticked out of order, and if design_start is somehow still
 * open the honest answer is that it is waiting on design_start.
 */
export const currentMilestone = (submission) =>
  submission.milestones.find((m) => !m.doneAt) || null;

/** Is this submission late, purely on its dates? */
export function submissionIsSlipping(submission, now = new Date()) {
  const today = startOfDay(now);
  if (submission.milestones.some((m) => !m.doneAt && m.due && startOfDay(m.due) < today)) return true;
  return Boolean(
    submission.targetDate
    && startOfDay(submission.targetDate) < today
    && !submissionComplete(submission),
  );
}

// --- Rolled up to the project ---

/**
 * The project's target date: the latest of its submissions'.
 *
 * Derived, never stored. There is no project deadline separate from "when the
 * last zone is due", so deriving it means the portfolio can never show a date
 * that contradicts the zones underneath it.
 */
export function projectTarget(submissions) {
  const dates = submissions.map((s) => s.targetDate).filter(Boolean);
  if (!dates.length) return null;
  return dates.reduce((latest, d) => (new Date(d) > new Date(latest) ? d : latest));
}

/**
 * Project progress counted in SUBMISSIONS, not milestones.
 *
 * "2 of 3 submissions approved" is the sentence a manager or salesperson
 * actually wants; "7 of 15 milestones" is arithmetic they then have to
 * translate. The per-milestone detail is one click away on the overview.
 */
export function projectProgress(submissions) {
  const total = submissions.length;
  const done = submissions.filter(submissionComplete).length;
  return { done, total, pct: total ? Math.round((done / total) * 100) : 0 };
}

/**
 * The submission that needs attention next: the earliest-due unfinished one.
 * Unfinished submissions with no date at all come after any that have one —
 * a date nobody set is not a deadline.
 */
export function nextSubmission(submissions) {
  const open = submissions.filter((s) => !submissionComplete(s));
  if (!open.length) return null;
  return open.reduce((best, s) => {
    if (!s.targetDate) return best;
    if (!best.targetDate) return s;
    return new Date(s.targetDate) < new Date(best.targetDate) ? s : best;
  });
}

/**
 * Whether to FLAG a project as behind schedule.
 *
 * Only a live project can be behind, and only if one of its submissions is.
 * A completed or archived job with a past date is history, not a problem, and
 * painting it red would train everyone to ignore the colour on the jobs that
 * do need chasing.
 */
export function projectIsSlipping(project, now = new Date()) {
  if ((project?.status || 'active') !== 'active') return false;
  return readSubmissions(project).some((s) => submissionIsSlipping(s, now));
}

/**
 * Days until a date. Negative once passed, null when unset. Whole calendar
 * days, so it does not change through the day.
 */
export function daysToDate(date, now = new Date()) {
  if (!date) return null;
  return Math.round((startOfDay(date) - startOfDay(now)) / 86400000);
}

/**
 * Who may edit submission dates.
 *
 * This is the UI gate only. The database is the real boundary:
 * supabase/migrations/20260718_timeline_rbac.sql refuses a timeline write from
 * anyone else. Keep the two role lists in step.
 */
export function canEditTimeline(role) {
  return role === 'admin' || role === 'manager' || role === 'team_leader';
}
