import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import {
  AlertTriangle, ArrowLeft, Calculator, CalendarDays, Check, Clock,
  FileCheck2, Map, PencilRuler,
} from 'lucide-react';
import { readProject, saveTimeline, setProjectStatus } from '../services/projectFiles';
import { canChangeProjectStatus, PROJECT_STATUSES, statusLabel } from '../services/projectStatus';
import {
  canEditTimeline, currentMilestone, daysToTarget, isSlipping, readTimeline,
  setMilestoneDone, setMilestoneDue, setTargetDate, timelineProgress,
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

/** "in 12 days" / "3 days ago" / "today" — the thing sales actually asks. */
const relativeDays = (n) => {
  if (n === null) return null;
  if (n === 0) return 'today';
  if (n > 0) return `in ${n} day${n === 1 ? '' : 's'}`;
  return `${-n} day${n === -1 ? '' : 's'} ago`;
};

export default function ProjectOverview() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { role } = useAuth();

  const [project, setProject] = useState(null);
  const [timeline, setTimeline] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');

  const mayEditTimeline = canEditTimeline(role);
  const mayEditStatus = canChangeProjectStatus(role);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const record = await readProject(projectId);
      if (!record) {
        setProject(null);
        return;
      }
      setProject(record);
      setTimeline(readTimeline(record));
    } catch (e) {
      setError(e?.message || 'This project could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { refresh(); }, [refresh]);

  /**
   * Apply a timeline change optimistically, then persist. On failure the
   * server copy is re-read rather than the local edit kept — a milestone that
   * looks ticked but was refused by the database is worse than a lost click.
   */
  const commitTimeline = async (next, label) => {
    const previous = timeline;
    setTimeline(next);
    setBusy(label);
    setError('');
    try {
      await saveTimeline(projectId, next);
    } catch (e) {
      setTimeline(previous);
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

  /**
   * Hand off to the design workbook. Opening a project swaps the local
   * working copy, so it can refuse when there is unsaved local work —
   * that guard lives on the Projects page, so send an unsaved user there
   * rather than silently destroying the draft or dead-ending here.
   */
  const handleOpenWorkbook = async () => {
    if (getOpenFilename() === projectId) {
      navigate('/dashboard');
      return;
    }
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

  const progress = timelineProgress(timeline);
  const current = currentMilestone(timeline);
  const slipping = isSlipping(timeline);
  const toTarget = daysToTarget(timeline);
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

      <div className={styles.columns}>
        {/* ── Timeline ── */}
        <section className={styles.card}>
          <div className={styles.cardHead}>
            <h2><CalendarDays size={17} /> Timeline</h2>
            {slipping && (
              <span className={styles.slipChip}><AlertTriangle size={13} /> Behind schedule</span>
            )}
          </div>

          <div className={styles.progressRow}>
            <div className={styles.progressTrack}>
              <div
                className={`${styles.progressFill} ${slipping ? styles.progressFillLate : ''}`}
                style={{ width: `${progress.pct}%` }}
              />
            </div>
            <span className={styles.progressText}>{progress.done} of {progress.total}</span>
          </div>

          <p className={styles.currentLine}>
            {current
              ? <>Waiting on <strong>{current.label}</strong></>
              : <>All milestones complete</>}
          </p>

          <ol className={styles.milestones}>
            {timeline.milestones.map((m) => {
              const done = !!m.doneAt;
              const late = !done && m.due && new Date(m.due) < new Date(new Date().toDateString());
              return (
                <li key={m.key} className={`${styles.milestone} ${done ? styles.milestoneDone : ''}`}>
                  <button
                    type="button"
                    className={`${styles.tick} ${done ? styles.tickDone : ''}`}
                    disabled={!mayEditTimeline || !!busy}
                    onClick={() => commitTimeline(setMilestoneDone(timeline, m.key, !done), m.key)}
                    aria-pressed={done}
                    aria-label={`${m.label} — mark ${done ? 'not done' : 'done'}`}
                    title={mayEditTimeline ? (done ? 'Mark not done' : 'Mark done') : 'Only a manager or team leader can change this'}
                  >
                    {done && <Check size={13} />}
                  </button>

                  <div className={styles.milestoneBody}>
                    <span className={styles.milestoneLabel}>{m.label}</span>
                    <span className={styles.milestoneMeta}>
                      {done
                        ? `Done ${formatDay(m.doneAt)}`
                        : m.due
                          ? <span className={late ? styles.lateText : ''}>Due {formatDay(m.due)}</span>
                          : 'No date set'}
                    </span>
                  </div>

                  {mayEditTimeline && (
                    <input
                      type="date"
                      className={styles.dateInput}
                      value={m.due || ''}
                      disabled={!!busy}
                      onChange={(e) => commitTimeline(setMilestoneDue(timeline, m.key, e.target.value), m.key)}
                      aria-label={`Due date for ${m.label}`}
                    />
                  )}
                </li>
              );
            })}
          </ol>

          <div className={styles.targetRow}>
            <span className={styles.targetLabel}><Clock size={14} /> Target date</span>
            {mayEditTimeline ? (
              <input
                type="date"
                className={styles.dateInput}
                value={timeline.targetDate || ''}
                disabled={!!busy}
                onChange={(e) => commitTimeline(setTargetDate(timeline, e.target.value), 'target')}
                aria-label="Project target date"
              />
            ) : (
              <span className={styles.targetValue}>{formatDay(timeline.targetDate)}</span>
            )}
            {toTarget !== null && (
              <span className={`${styles.targetRel} ${toTarget < 0 ? styles.lateText : ''}`}>
                {relativeDays(toTarget)}
              </span>
            )}
          </div>
        </section>

        {/* ── Contents ── */}
        <section className={styles.card}>
          <div className={styles.cardHead}>
            <h2><FileCheck2 size={17} /> Contents</h2>
          </div>
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
