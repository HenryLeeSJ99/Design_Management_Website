import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import {
  AlertTriangle, ArrowLeft, Calculator, CalendarDays, Check, ChevronDown, ChevronRight,
  Clock, Layers, Map, PencilRuler,
} from 'lucide-react';
import { readProject, saveSubmissions, setProjectStatus } from '../services/projectFiles';
import { canChangeProjectStatus, PROJECT_STATUSES, statusLabel } from '../services/projectStatus';
import {
  canEditTimeline, currentMilestone, daysToDate, nextSubmission, projectIsSlipping,
  projectProgress, projectTarget, readSubmissions, setMilestoneDone, setMilestoneDue,
  setSubmissionTarget, submissionComplete, submissionIsSlipping, submissionProgress,
} from '../services/projectTimeline';
import { openProject, getOpenFilename, UnsavedDraftError } from '../services/projectSession';
import { useAuth } from '../contexts/AuthContext';
import styles from './ProjectOverview.module.css';

const formatWhen = (ts) => (ts
  ? new Date(ts).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  : '—');

const formatDay = (d) => (d
  ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  : '—');

const relativeDays = (n) => {
  if (n === null) return null;
  if (n === 0) return 'today';
  return n > 0 ? `in ${n} day${n === 1 ? '' : 's'}` : `${-n} day${n === -1 ? '' : 's'} ago`;
};

/** One zone's submission: its own milestone rail, target and progress. */
function SubmissionCard({ submission, canEdit, busy, expanded, onToggle, onMilestone, onDue, onTarget }) {
  const progress = submissionProgress(submission);
  const current = currentMilestone(submission);
  const slipping = submissionIsSlipping(submission);
  const done = submissionComplete(submission);
  const toTarget = daysToDate(submission.targetDate);

  return (
    <section className={`${styles.submission} ${slipping ? styles.submissionLate : ''}`}>
      <button
        type="button"
        className={styles.subHeader}
        onClick={onToggle}
        aria-expanded={expanded}
      >
        {expanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
        <Layers size={14} className={styles.subIcon} />
        <span className={styles.subName}>{submission.zoneName}</span>

        <span className={styles.subProgress}>
          <span className={styles.miniTrack}>
            <span
              className={`${styles.miniFill} ${slipping ? styles.miniFillLate : ''}`}
              style={{ width: `${progress.pct}%` }}
            />
          </span>
          <span className={styles.subCount}>{progress.done}/{progress.total}</span>
        </span>

        <span className={styles.subState}>
          {done
            ? <span className={styles.doneText}>Approved</span>
            : <span className={slipping ? styles.lateText : ''}>{current?.label}</span>}
        </span>

        <span className={styles.subTarget}>
          {submission.targetDate ? (
            <>
              {slipping && <AlertTriangle size={12} className={styles.lateIcon} />}
              <span className={slipping ? styles.lateText : ''}>{formatDay(submission.targetDate)}</span>
            </>
          ) : <span className={styles.hint}>No date</span>}
        </span>
      </button>

      {expanded && (
        <div className={styles.subBody}>
          <ol className={styles.milestones}>
            {submission.milestones.map((m) => {
              const isDone = !!m.doneAt;
              const late = !isDone && m.due && new Date(m.due) < new Date(new Date().toDateString());
              return (
                <li key={m.key} className={`${styles.milestone} ${isDone ? styles.milestoneDone : ''}`}>
                  <button
                    type="button"
                    className={`${styles.tick} ${isDone ? styles.tickDone : ''}`}
                    disabled={!canEdit || !!busy}
                    onClick={() => onMilestone(m.key, !isDone)}
                    aria-pressed={isDone}
                    aria-label={`${submission.zoneName} — ${m.label} — mark ${isDone ? 'not done' : 'done'}`}
                    title={canEdit ? (isDone ? 'Mark not done' : 'Mark done') : 'Only a manager or team leader can change this'}
                  >
                    {isDone && <Check size={12} />}
                  </button>
                  <div className={styles.milestoneBody}>
                    <span className={styles.milestoneLabel}>{m.label}</span>
                    <span className={styles.milestoneMeta}>
                      {isDone
                        ? `Done ${formatDay(m.doneAt)}`
                        : m.due
                          ? <span className={late ? styles.lateText : ''}>Due {formatDay(m.due)}</span>
                          : 'No date set'}
                    </span>
                  </div>
                  {canEdit && (
                    <input
                      type="date"
                      className={styles.dateInput}
                      value={m.due || ''}
                      disabled={!!busy}
                      onChange={(e) => onDue(m.key, e.target.value)}
                      aria-label={`Due date for ${m.label} in ${submission.zoneName}`}
                    />
                  )}
                </li>
              );
            })}
          </ol>

          <div className={styles.targetRow}>
            <span className={styles.targetLabel}><Clock size={13} /> Submission target</span>
            {canEdit ? (
              <input
                type="date"
                className={styles.dateInput}
                value={submission.targetDate || ''}
                disabled={!!busy}
                onChange={(e) => onTarget(e.target.value)}
                aria-label={`Target date for ${submission.zoneName}`}
              />
            ) : (
              <span className={styles.targetValue}>{formatDay(submission.targetDate)}</span>
            )}
            {toTarget !== null && (
              <span className={`${styles.targetRel} ${toTarget < 0 && !done ? styles.lateText : ''}`}>
                {relativeDays(toTarget)}
              </span>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

export default function ProjectOverview() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { role } = useAuth();

  const [project, setProject] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [expanded, setExpanded] = useState(() => new Set());

  const mayEdit = canEditTimeline(role);
  const mayEditStatus = canChangeProjectStatus(role);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const record = await readProject(projectId);
      if (!record) { setProject(null); return; }
      setProject(record);
      setSubmissions(readSubmissions(record));
    } catch (e) {
      setError(e?.message || 'This project could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { refresh(); }, [refresh]);

  /**
   * Apply optimistically, then persist. On failure the server copy wins rather
   * than the local edit: a milestone that looks ticked but was refused by the
   * database is worse than a lost click.
   */
  const commit = async (next, label) => {
    const previous = submissions;
    setSubmissions(next);
    setBusy(label);
    setError('');
    try {
      await saveSubmissions(projectId, next);
    } catch (e) {
      setSubmissions(previous);
      setError(e?.message || 'That change could not be saved.');
    } finally {
      setBusy('');
    }
  };

  const handleStatusChange = async (status) => {
    setBusy('status');
    setError('');
    try {
      await setProjectStatus(projectId, status);
      await refresh();
    } catch (e) {
      setError(e?.message || 'The status could not be changed.');
    } finally {
      setBusy('');
    }
  };

  const handleOpenWorkbook = async () => {
    if (getOpenFilename() === projectId) { navigate('/dashboard'); return; }
    setBusy('open');
    setError('');
    try {
      await openProject(projectId, { force: false });
      navigate('/dashboard');
    } catch (e) {
      if (e instanceof UnsavedDraftError) {
        setError('There is unsaved local work. Open this project from the Projects list, which will offer to save or export it first.');
      } else {
        setError(e?.message || 'The design workbook could not be opened.');
      }
    } finally {
      setBusy('');
    }
  };

  const toggle = (zoneId) => setExpanded((prev) => {
    const next = new Set(prev);
    if (next.has(zoneId)) next.delete(zoneId); else next.add(zoneId);
    return next;
  });

  if (loading) {
    return <div className={styles.pageContainer}><p className={styles.muted}>Loading project…</p></div>;
  }

  if (!project) {
    return (
      <div className={styles.pageContainer}>
        <Link to="/projects" className={styles.backLink}><ArrowLeft size={16} /> Projects</Link>
        <div className={styles.emptyState}>
          <h2>Project not found</h2>
          <p>It may have been deleted, or you may not have access to it.</p>
        </div>
      </div>
    );
  }

  const progress = projectProgress(submissions);
  const target = projectTarget(submissions);
  const next = nextSubmission(submissions);
  const slipping = projectIsSlipping(project);
  const toTarget = daysToDate(target);
  // The project DATE being overdue is a narrower claim than the project
  // slipping: a submission can be late while the final date is still weeks off.
  const targetOverdue = toTarget !== null && toTarget < 0 && progress.done < progress.total;
  const status = project.status || 'active';

  return (
    <div className={styles.pageContainer}>
      <Link to="/projects" className={styles.backLink}><ArrowLeft size={16} /> Projects</Link>

      <header className={styles.pageHeader}>
        <div className={styles.titleBlock}>
          <h1>{project.name}</h1>
          <p className={styles.subtitle}>
            Last updated {formatWhen(project.last_modified_at)}
            {project.updater_email ? ` by ${project.updater_email}` : ''}
          </p>
        </div>
        <div className={styles.headerActions}>
          {mayEditStatus ? (
            <select
              className={`${styles.statusSelect} ${styles[`status_${status}`] || ''}`}
              value={status}
              disabled={!!busy}
              onChange={(e) => handleStatusChange(e.target.value)}
              aria-label="Project status"
            >
              {PROJECT_STATUSES.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
            </select>
          ) : (
            <span className={`${styles.badge} ${styles[`status_${status}`] || ''}`}>{statusLabel(status)}</span>
          )}
          <button type="button" className={styles.btnPrimary} onClick={handleOpenWorkbook} disabled={!!busy}>
            <PencilRuler size={16} /> {busy === 'open' ? 'Opening…' : 'Open design workbook'}
          </button>
        </div>
      </header>

      {error && <div className={styles.errorBanner}>{error}</div>}

      {/* ── Rolled up from the submissions below — never set by hand ── */}
      <div className={styles.summary}>
        <div className={styles.summaryMain}>
          <div className={styles.progressRow}>
            <div className={styles.progressTrack}>
              <div
                className={`${styles.progressFill} ${slipping ? styles.progressFillLate : ''}`}
                style={{ width: `${progress.pct}%` }}
              />
            </div>
            <span className={styles.progressText}>
              {progress.done} of {progress.total} submission{progress.total === 1 ? '' : 's'} approved
            </span>
            {slipping && <span className={styles.slipChip}><AlertTriangle size={13} /> Behind schedule</span>}
          </div>
          <p className={styles.currentLine}>
            {progress.total === 0
              ? <>No zones yet — add them in the design workbook and each becomes a submission</>
              : next
                ? <>Next up: <strong>{next.zoneName}</strong>{next.targetDate ? ` · due ${formatDay(next.targetDate)}` : ''}</>
                : <>Every submission approved</>}
          </p>
        </div>
        <div className={styles.summaryTarget}>
          <span className={styles.summaryTargetLabel}>Project due</span>
          {/* Red only when THIS date has passed with work outstanding. Tying it
              to `slipping` painted a target 44 days away red because some
              submission was overdue — implying the project date itself had
              passed. The "Behind schedule" chip already carries that. */}
          <span className={`${styles.summaryTargetValue} ${targetOverdue ? styles.lateText : ''}`}>
            {formatDay(target)}
          </span>
          {toTarget !== null && <span className={styles.hint}>{relativeDays(toTarget)}</span>}
        </div>
      </div>

      <div className={styles.columns}>
        <section className={styles.card}>
          <div className={styles.cardHead}>
            <h2><CalendarDays size={17} /> Submissions</h2>
            <span className={styles.hint}>One per zone</span>
          </div>

          {submissions.length === 0 ? (
            <p className={styles.zoneEmpty}>
              This project has no zones. Add them in the design workbook — each zone becomes a
              submission with its own milestones and target date.
            </p>
          ) : (
            submissions.map((s) => (
              <SubmissionCard
                key={s.zoneId}
                submission={s}
                canEdit={mayEdit}
                busy={busy}
                expanded={expanded.has(s.zoneId)}
                onToggle={() => toggle(s.zoneId)}
                onMilestone={(key, done) => commit(setMilestoneDone(submissions, s.zoneId, key, done), s.zoneId)}
                onDue={(key, due) => commit(setMilestoneDue(submissions, s.zoneId, key, due), s.zoneId)}
                onTarget={(d) => commit(setSubmissionTarget(submissions, s.zoneId, d), s.zoneId)}
              />
            ))
          )}
        </section>

        <section className={styles.card}>
          <div className={styles.cardHead}><h2><Calculator size={17} /> Contents</h2></div>
          <div className={styles.statGrid}>
            <div className={styles.stat}>
              <Calculator size={16} />
              <span className={styles.statValue}>{project.calculation_count ?? 0}</span>
              <span className={styles.statLabel}>calculations</span>
            </div>
            <div className={styles.stat}>
              <Map size={16} />
              <span className={styles.statValue}>{project.drawing_count ?? 0}</span>
              <span className={styles.statLabel}>drawings</span>
            </div>
          </div>
          <p className={styles.contentsHint}>
            The calculations, drawings and compiled report live in the design workbook.
          </p>
        </section>
      </div>
    </div>
  );
}
