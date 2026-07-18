import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AlertTriangle, Check, CloudOff, FolderOpen, Loader2, RotateCw } from 'lucide-react';
import { getOpenFilename, onSaveState, resolveConflict, saveNow } from '../services/projectSession';
import { getProject, onProjectChange } from '../services/projectStore';
import styles from './ProjectContextBar.module.css';

/**
 * Which project am I in, and is my work safe?
 *
 * Two problems this exists to solve. Neither was visible before:
 *
 *  1. Every working surface was project-blind. Only /projects and
 *     /projects/:id ever read getOpenFilename(), so the workbook and all the
 *     calculators had no idea which project was open — a calculator's "Save to
 *     project" could not say WHICH project, and an unsaved local draft looked
 *     identical to a real cloud project.
 *  2. projectSession has emitted dirty/saving/saved/error all along, and
 *     nothing ever subscribed. In an app that autosaves to the cloud, a failed
 *     save was completely silent.
 *
 * Shown only where work actually happens. On /projects it would be noise, and
 * for a visitor just trying a calculator with nothing to lose it stays hidden
 * entirely rather than nagging about a project they never asked for.
 */

const WORK_ROUTES = ['/dashboard', '/calculators', '/drawing'];

const formatAgo = (ts) => {
  if (!ts) return '';
  const secs = Math.round((Date.now() - ts) / 1000);
  if (secs < 45) return 'just now';
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  return `${hours} hour${hours === 1 ? '' : 's'} ago`;
};

export default function ProjectContextBar() {
  const location = useLocation();
  const [openFilename, setOpenFilename] = useState(getOpenFilename);
  const [project, setProject] = useState(getProject);
  const [state, setState] = useState('idle'); // idle | dirty | saving | saved | error
  const [savedAt, setSavedAt] = useState(null);
  const [error, setError] = useState('');
  const [conflict, setConflict] = useState(false);
  const [, setTick] = useState(0);

  // The project name can change (rename), and which file is open changes on
  // open/close — both without this component re-mounting.
  useEffect(() => onProjectChange(() => {
    setProject(getProject());
    setOpenFilename(getOpenFilename());
  }), []);

  // The whole point: give the save signal somewhere to land.
  useEffect(() => onSaveState((next, detail) => {
    setState(next);
    if (next === 'saved') { setSavedAt(detail?.at || Date.now()); setError(''); setConflict(false); }
    if (next === 'error') {
      setError(detail?.message || 'The project could not be saved.');
      setConflict(!!detail?.conflict);
    }
  }), []);

  // localStorage quota exhaustion comes from projectStore, not the save loop —
  // an edit that could not even reach the working copy. Same slot in the UI:
  // it is still "your work is not safe".
  useEffect(() => {
    const onFull = (e) => { setState('error'); setError(e.detail?.message || 'This project is too large for local storage.'); };
    window.addEventListener('tempworks:storage-full', onFull);
    return () => window.removeEventListener('tempworks:storage-full', onFull);
  }, []);

  // Route changes can open/close a project without any project change firing.
  useEffect(() => { setOpenFilename(getOpenFilename()); }, [location.pathname]);

  // "Saved 3 min ago" has to keep counting on its own.
  useEffect(() => {
    if (state !== 'saved') return undefined;
    const id = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(id);
  }, [state]);

  const handleRetry = useCallback(async () => {
    try {
      await saveNow();
    } catch { /* the failure re-emits through onSaveState; nothing to add here */ }
  }, []);

  if (!WORK_ROUTES.some((r) => location.pathname.startsWith(r))) return null;

  const hasLocalWork = project.calculations.length > 0 || project.zones.length > 0;

  // Nothing open and nothing to lose — e.g. a visitor trying a calculator.
  // Saying "not saved to any project" here would be nagging, not informing.
  if (!openFilename && !hasLocalWork) return null;

  if (!openFilename) {
    return (
      <div className={`${styles.bar} ${styles.barWarn}`}>
        <span className={styles.left}>
          <CloudOff size={15} />
          <span className={styles.name}>Not saved to any project</span>
          <span className={styles.hint}>This work lives only in this browser</span>
        </span>
        <Link to="/projects" className={styles.action}>Save to a project</Link>
      </div>
    );
  }

  return (
    <div className={`${styles.bar} ${state === 'error' ? styles.barError : ''}`}>
      <span className={styles.left}>
        <FolderOpen size={15} />
        <Link to={`/projects/${openFilename}`} className={styles.name} title="Open project overview">
          {project.name}
        </Link>
      </span>

      <span className={styles.status}>
        {state === 'saving' && (
          <><Loader2 size={13} className={styles.spin} /> Saving…</>
        )}
        {state === 'dirty' && (
          <><span className={styles.dot} /> Unsaved changes</>
        )}
        {state === 'saved' && (
          <><Check size={13} className={styles.ok} /> Saved {formatAgo(savedAt)}</>
        )}
        {state === 'error' && conflict && (
          <>
            <AlertTriangle size={13} />
            <span title={error}>Someone else saved this project</span>
            {/* Two explicit outcomes, no default. "Keep mine" first rescues
                their version into history, so neither choice destroys work
                irrecoverably. */}
            <button type="button" className={styles.retry} onClick={() => resolveConflict('keepMine').catch(() => {})}>
              Keep mine
            </button>
            <button type="button" className={styles.retry} onClick={() => resolveConflict('takeTheirs').then(() => window.location.reload()).catch(() => {})}>
              Take theirs
            </button>
          </>
        )}
        {state === 'error' && !conflict && (
          <>
            <AlertTriangle size={13} />
            <span title={error}>Save failed</span>
            <button type="button" className={styles.retry} onClick={handleRetry}>
              <RotateCw size={12} /> Retry
            </button>
          </>
        )}
        {state === 'idle' && <span className={styles.hint}>Autosaves as you work</span>}
      </span>
    </div>
  );
}
