import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  AlertTriangle, FolderOpen, History, Map, Plus, RefreshCw, Trash2, Undo2, LayoutTemplate,
  Calculator, Image as ImageIcon, X, LayoutGrid, List as ListIcon, Search,
} from 'lucide-react';
import {
  deleteFromTrash, listProjects, listVersions, purgeExpiredTrash,
  restoreFromTrash, restoreVersion, setProjectStatus, trashProject, TRASH_DAYS,
} from '../services/projectFiles';
import { canChangeProjectStatus, PROJECT_STATUSES, statusLabel } from '../services/projectStatus';
import {
  currentMilestone, daysToDate, nextSubmission, projectIsSlipping, projectProgress,
  projectTarget, readSubmissions,
} from '../services/projectTimeline';
import {
  closeProject, createProject, exportLocalDraftAsTw, getOpenFilename,
  openProject, promoteLocalDraftToCloud, UnsavedDraftError,
} from '../services/projectSession';
import { confirmDialog, promptDialog } from '../services/dialog';
import { getProject } from '../services/projectStore';
import { useAuth } from '../contexts/AuthContext';
import styles from './Projects.module.css';

const formatSize = (bytes) => {
  if (!bytes) return '—';
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
};

const formatWhen = (ts) => (ts
  ? new Date(ts).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  : '—');

const formatDay = (d) => (d
  ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
  : '—');

/** Compact age for a scan-heavy list — "3 days ago" beats a full timestamp. */
const formatAgo = (ts) => {
  if (!ts) return '—';
  const mins = Math.round((Date.now() - new Date(ts).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  if (days <= 30) return `${days} day${days === 1 ? '' : 's'} ago`;
  return new Date(ts).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

function CreateProjectModal({ onClose, onSubmit, busy }) {
  const [name, setName] = useState('New Project');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    if (selected) {
      setFile(selected);
      setPreview(URL.createObjectURL(selected));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSubmit(name.trim(), file);
  };

  return (
    <div className={styles.modalBackdrop}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <h2>Create New Project</h2>
          <button type="button" className={styles.btnIconGhost} onClick={onClose} disabled={busy}>
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className={styles.modalBody}>
          <div className={styles.formGroup}>
            <label>Project Name</label>
            <input 
              type="text" 
              value={name} 
              onChange={(e) => setName(e.target.value)} 
              disabled={busy} 
              required
              className={styles.textInput}
            />
          </div>
          
          <div className={styles.formGroup}>
            <label>Cover Image (Optional)</label>
            <input 
              type="file" 
              accept="image/*" 
              onChange={handleFileChange}
              ref={fileInputRef}
              style={{ display: 'none' }}
              disabled={busy}
            />
            
            {preview ? (
              <div className={styles.imagePreviewContainer}>
                <img src={preview} alt="Preview" className={styles.imagePreview} />
                <button type="button" className={styles.btnSecondary} onClick={() => { setFile(null); setPreview(null); }} disabled={busy}>
                  Remove Image
                </button>
              </div>
            ) : (
              <button type="button" className={styles.btnSecondary} onClick={() => fileInputRef.current.click()} disabled={busy}>
                <ImageIcon size={18} /> Upload Image
              </button>
            )}
          </div>

          <div className={styles.modalFooter}>
            <button type="button" className={styles.btnGhost} onClick={onClose} disabled={busy}>Cancel</button>
            <button type="submit" className={styles.btnPrimary} disabled={busy || !name.trim()}>
              {busy ? 'Creating...' : 'Create Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/**
 * Version history for one project, in a dialog. Each row is a snapshot taken
 * before a later save overwrote it; restoring one snapshots the current
 * cloud contents first, so it is itself reversible.
 */
function VersionHistoryModal({ project, onClose, onRestored }) {
  const [versions, setVersions] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');

  useEffect(() => {
    let cancelled = false;
    listVersions(project.filename)
      .then((v) => { if (!cancelled) setVersions(v); })
      .catch((e) => { if (!cancelled) { setError(e?.message || 'Version history could not be read.'); setVersions([]); } });
    return () => { cancelled = true; };
  }, [project.filename]);

  const handleRestore = async (version) => {
    setBusy(version.filename);
    setError('');
    try {
      await restoreVersion(project.filename, version.filename);
      await onRestored();
    } catch (e) {
      setError(e?.message || 'The version could not be restored.');
      setBusy('');
    }
  };

  return (
    <div className={styles.modalBackdrop} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2><History size={18} style={{ verticalAlign: 'text-bottom', marginRight: '6px' }} />{project.name}</h2>
          <button type="button" className={styles.btnIconGhost} onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <div className={styles.modalBody}>
          {error && <div className={styles.errorBanner}><p>{error}</p></div>}
          {versions === null && <p className={styles.muted}>Reading history…</p>}
          {versions?.length === 0 && !error && (
            <p className={styles.muted}>
              No earlier versions yet — one is kept each time the project is saved after a change.
            </p>
          )}
          {versions?.map((v, i) => (
            <div key={v.filename} className={styles.cardMeta} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid var(--border-color, #e2e8f0)' }}>
              <span>
                {formatWhen(v.savedAt)} · {formatSize(v.size)}
                {i === 0 && <strong style={{ marginLeft: '0.5rem' }}>most recent</strong>}
              </span>
              <button type="button" className={styles.btnSecondary} onClick={() => handleRestore(v)} disabled={!!busy}>
                <Undo2 size={14} /> {busy === v.filename ? 'Restoring…' : 'Restore'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Shown when opening or creating a project would silently wipe out local
 * work that was never saved to a cloud project or exported — a calculator's
 * "Save to project" writes into the local working copy with no idea whether
 * a cloud project is open, so this is the only place that can catch it before
 * openProject/createProject would otherwise destroy it outright.
 */
function DraftGuardModal({ draft, onSave, onExport, onDiscard, onClose, busy }) {
  const itemWord = draft.calculations === 1 ? 'calculation' : 'calculations';
  return (
    <div className={styles.modalBackdrop} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2>Unsaved local work</h2>
          <button type="button" className={styles.btnIconGhost} onClick={onClose} disabled={!!busy}>
            <X size={20} />
          </button>
        </div>
        <div className={styles.modalBody}>
          <p>
            {draft.calculations > 0 ? `${draft.calculations} ${itemWord}` : 'Some project details'} exist{draft.calculations === 1 ? 's' : ''} here
            that {draft.calculations === 1 ? "hasn't" : "haven't"} been saved to a cloud project or exported.
            Continuing without saving will lose {draft.calculations === 1 ? 'it' : 'them'}.
          </p>
        </div>
        <div className={styles.modalFooter} style={{ flexWrap: 'wrap', justifyContent: 'flex-end', gap: '0.5rem' }}>
          <button type="button" className={styles.btnGhost} onClick={onClose} disabled={!!busy}>Cancel</button>
          <button type="button" className={styles.btnSecondary} onClick={onDiscard} disabled={!!busy}>
            {busy === 'discard' ? 'Discarding…' : 'Discard it'}
          </button>
          <button type="button" className={styles.btnSecondary} onClick={onExport} disabled={!!busy}>
            {busy === 'export' ? 'Exporting…' : 'Export as file'}
          </button>
          <button type="button" className={styles.btnPrimary} onClick={onSave} disabled={!!busy}>
            {busy === 'save' ? 'Saving…' : 'Save as new project'}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * The status of one project. A <select> for whoever is allowed to change it,
 * a plain badge for everyone else — so the status is always visible, and only
 * the ability to move it is privileged.
 */
function StatusControl({ project, canEdit, busy, onChange }) {
  const status = project.status || 'active';
  if (!canEdit) {
    return <span className={`${styles.badge} ${styles[`status_${status}`] || ''}`}>{statusLabel(status)}</span>;
  }
  return (
    <select
      className={`${styles.statusSelect} ${styles[`status_${status}`] || ''}`}
      value={status}
      disabled={busy}
      onChange={(e) => onChange(project, e.target.value)}
      onClick={(e) => e.stopPropagation()}
      aria-label={`Status of ${project.name}`}
    >
      {PROJECT_STATUSES.map((s) => (
        <option key={s} value={s}>{statusLabel(s)}</option>
      ))}
    </select>
  );
}

/**
 * Progress / waiting-on / target for one row.
 *
 * A Fragment, not a wrapper element, so the three cells land as direct
 * children of the row's grid rather than collapsing into one column.
 */
function TimelineCells({ project }) {
  const submissions = readSubmissions(project);
  const { done, total, pct } = projectProgress(submissions);
  const next = nextSubmission(submissions);
  const slipping = projectIsSlipping(project);
  const target = projectTarget(submissions);
  const toTarget = daysToDate(target);

  // What the job is actually waiting on is a zone AND a milestone — "Internal
  // check" alone is meaningless when three zones are each at a different one.
  const waiting = next ? currentMilestone(next) : null;

  return (
    <>
      <span className={styles.listCell} data-label="Progress">
        <span className={styles.miniProgress} title={total ? `${done} of ${total} submissions approved` : 'No zones yet'}>
          <span className={styles.miniTrack}>
            <span
              className={`${styles.miniFill} ${slipping ? styles.miniFillLate : ''}`}
              style={{ width: `${pct}%` }}
            />
          </span>
          <span className={styles.miniCount}>{done}/{total}</span>
        </span>
      </span>

      <span
        className={styles.listCell}
        data-label="Waiting on"
        title={next ? `${next.zoneName} — waiting on ${waiting?.label}` : 'Every submission approved'}
      >
        {total === 0
          ? <span className={styles.hint}>No zones</span>
          : next
            ? <><strong className={styles.zoneChip}>{next.zoneName}</strong> {waiting?.label}</>
            : <span className={styles.doneText}>Complete</span>}
      </span>

      <span className={styles.listCell} data-label="Target">
        {target ? (
          <span className={styles.targetCell}>
            <span className={slipping ? styles.lateText : ''}>{formatDay(target)}</span>
            {slipping && <AlertTriangle size={12} className={styles.lateIcon} />}
            {/* Only count down to a target still ahead of us. `toTarget <= 7`
                alone also matches a target long past (e.g. -17), which on a
                finished project reads as a countdown to nothing. */}
            {toTarget !== null && !slipping && toTarget >= 0 && toTarget <= 7 && (
              <span className={styles.soonText}>{toTarget}d</span>
            )}
          </span>
        ) : '—'}
      </span>
    </>
  );
}

/**
 * The same submission signal as the list, laid out for a card: submissions
 * approved, the zone the job is waiting on, and the derived project target.
 *
 * A project with no zones, or with zones nobody has dated, renders nothing at
 * all rather than a row of em-dashes — plenty will look like that until the
 * timeline is actually used, and empty placeholders would make every card
 * noisier for no information.
 */
function CardTimeline({ project }) {
  const submissions = readSubmissions(project);
  if (!submissions.length) return null;

  const { done, total, pct } = projectProgress(submissions);
  const next = nextSubmission(submissions);
  const slipping = projectIsSlipping(project);
  const target = projectTarget(submissions);
  const waiting = next ? currentMilestone(next) : null;

  const hasAnyDates = target || submissions.some((s) => s.milestones.some((m) => m.due || m.doneAt));
  if (!hasAnyDates) return null;

  return (
    <div className={styles.cardTimeline}>
      <div className={styles.miniProgress}>
        <span className={styles.miniTrack}>
          <span
            className={`${styles.miniFill} ${slipping ? styles.miniFillLate : ''}`}
            style={{ width: `${pct}%` }}
          />
        </span>
        <span className={styles.miniCount}>{done}/{total}</span>
      </div>
      <p className={styles.cardTimelineMeta}>
        {next
          ? <><strong className={styles.zoneChip}>{next.zoneName}</strong> {waiting?.label}</>
          : <span className={styles.doneText}>Every submission approved</span>}
        {target && (
          <>
            {' · '}
            <span className={slipping ? styles.lateText : ''}>
              {slipping && <AlertTriangle size={11} className={styles.lateIcon} />}
              {formatDay(target)}
            </span>
          </>
        )}
      </p>
    </div>
  );
}

const VIEW_KEY = 'tempworks_projects_view';
const SORT_KEY = 'tempworks_projects_sort';

/**
 * Order the portfolio.
 *
 * 'target' exists because it is the question a manager or salesperson actually
 * opens this page with — what is due next — and the default order (most
 * recently touched, from the DB query) cannot answer it. A project with no
 * target sorts last rather than first: an unset date is not "due at the
 * beginning of time", and letting nulls head the list would bury the jobs that
 * genuinely are next.
 */
const SORTS = {
  modified: {
    label: 'Recently updated',
    compare: (a, b) => new Date(b.last_modified_at) - new Date(a.last_modified_at),
  },
  target: {
    label: 'Target date',
    compare: (a, b) => {
      const at = projectTarget(readSubmissions(a));
      const bt = projectTarget(readSubmissions(b));
      if (!at && !bt) return a.name.localeCompare(b.name);
      if (!at) return 1;
      if (!bt) return -1;
      return new Date(at) - new Date(bt);
    },
  },
  name: {
    label: 'Name (A–Z)',
    compare: (a, b) => a.name.localeCompare(b.name),
  },
};

export default function Projects() {
  const navigate = useNavigate();
  const { role } = useAuth();
  const [projects, setProjects] = useState([]);
  const [trash, setTrash] = useState([]);
  const [showTrash, setShowTrash] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  
  // For editing covers
  const coverInputRef = useRef(null);
  const [editingProjectId, setEditingProjectId] = useState(null);

  const openFilename = getOpenFilename();

  // Updated to include team_leader
  const isManagerLevel = role === 'admin' || role === 'manager' || role === 'team_leader';
  const isSales = role === 'sales';
  const canSetStatus = canChangeProjectStatus(role);

  // Card vs list is a per-person habit, so it outlives the page but not the
  // browser profile — localStorage rather than a Supabase preference.
  const [view, setView] = useState(() => localStorage.getItem(VIEW_KEY) || 'cards');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sort, setSort] = useState(() => {
    const saved = localStorage.getItem(SORT_KEY);
    return saved && SORTS[saved] ? saved : 'modified';
  });

  useEffect(() => { localStorage.setItem(VIEW_KEY, view); }, [view]);
  useEffect(() => { localStorage.setItem(SORT_KEY, sort); }, [sort]);

  const [historyFor, setHistoryFor] = useState(null); // the project whose versions are shown
  const [draftGuard, setDraftGuard] = useState(null); // { calculations, resume } while the guard dialog is up
  const [draftBusy, setDraftBusy] = useState('');

  const daysLeft = (project) => Math.max(
    0,
    Math.ceil(TRASH_DAYS - (Date.now() - new Date(project.last_modified_at).getTime()) / 86400000),
  );

  const refresh = useCallback(async () => {
    setError('');
    setLoading(true);
    try {
      // Sweeping expired trash here (rather than a background job) means it
      // happens exactly when someone is looking at the list — the only time
      // it's ever visible either way.
      await purgeExpiredTrash().catch(() => {});
      const allProjects = await listProjects();
      const live = allProjects.filter(p => p.status !== 'trashed');
      const binned = allProjects.filter(p => p.status === 'trashed');
      setProjects(live);
      setTrash(binned);
    } catch (e) {
      setError(e?.message || 'Projects could not be loaded from the cloud.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  /**
   * What the list actually shows: the trash ignores the search/filter/sort bar
   * (it has its own, much shorter, life), everything else is narrowed by the
   * name search and the status filter together, then ordered.
   */
  const visible = useMemo(() => {
    if (showTrash) return trash;
    const q = query.trim().toLowerCase();
    const filtered = projects.filter((p) => {
      if (statusFilter !== 'all' && (p.status || 'active') !== statusFilter) return false;
      if (!q) return true;
      return p.name?.toLowerCase().includes(q) || p.updater_email?.toLowerCase().includes(q);
    });
    // Copy before sorting: `projects` is state, and sort() mutates in place.
    return [...filtered].sort((SORTS[sort] || SORTS.modified).compare);
  }, [showTrash, trash, projects, query, statusFilter, sort]);

  const filtersApplied = !showTrash && (query.trim() !== '' || statusFilter !== 'all');

  const guard = async (label, fn) => {
    setBusy(label);
    setError('');
    try {
      await fn();
    } catch (e) {
      setError(e?.message || 'Something went wrong.');
    } finally {
      setBusy('');
    }
  };

  /**
   * Run a create/open action; if it refuses because it would silently
   * destroy an unsaved local draft, show the guard dialog instead of letting
   * the error just become an error banner. `attempt` takes {force}. `onDone`
   * runs after the action actually completes — whether that is immediately,
   * or later once the guard dialog resolves and retries with force:true —
   * so "close the modal and navigate to the dashboard" only ever happens once,
   * on whichever path the action really finished on.
   */
  const runWithDraftGuard = async (attempt, onDone) => {
    try {
      await attempt({ force: false });
      onDone();
    } catch (e) {
      if (!(e instanceof UnsavedDraftError)) throw e;
      setDraftGuard({
        calculations: getProject().calculations.length,
        resume: async () => { await attempt({ force: true }); onDone(); },
      });
    }
  };

  const handleCreateSubmit = async (name, coverImageFile) => {
    await guard('new', () => runWithDraftGuard(
      ({ force }) => createProject(null, name, coverImageFile, { force }),
      () => { setShowCreateModal(false); navigate('/dashboard'); },
    ));
  };

  const handleEditCoverClick = (projectId) => {
    setEditingProjectId(projectId);
    coverInputRef.current?.click();
  };

  const handleCoverSelect = async (e) => {
    const file = e.target.files[0];
    if (!file || !editingProjectId) return;
    
    await guard('editCover', async () => {
      const { uploadCoverImage } = await import('../services/supabaseStorage');
      const { updateProjectRecord } = await import('../services/supabaseDb');
      
      const coverUrl = await uploadCoverImage(editingProjectId, file);
      await updateProjectRecord(editingProjectId, { cover_image: coverUrl });
      await refresh();
    });
    
    setEditingProjectId(null);
    e.target.value = null; // reset input
  };

  const handleOpen = (project) => guard(project.filename, async () => {
    if (isSales) return;
    if (project.error) return;
    await runWithDraftGuard(
      ({ force }) => openProject(project.filename, { force }),
      () => navigate('/dashboard'),
    );
  });

  // --- Resolving the draft guard dialog ---

  const handleGuardSave = async () => {
    const name = await promptDialog({
      title: 'Save as new project',
      label: 'Project name',
      defaultValue: 'My Project',
      confirmLabel: 'Save',
    });
    if (!name) return; // cancelled — leave the guard dialog open to try again
    setDraftBusy('save');
    try {
      await promoteLocalDraftToCloud(name);
      await draftGuard.resume();
      setDraftGuard(null);
      await refresh();
    } catch (e) {
      setError(e?.message || 'Could not save the local draft.');
    } finally {
      setDraftBusy('');
    }
  };

  const handleGuardExport = async () => {
    setDraftBusy('export');
    try {
      await exportLocalDraftAsTw();
      await draftGuard.resume();
      setDraftGuard(null);
      await refresh();
    } catch (e) {
      setError(e?.message || 'Could not export the local draft.');
    } finally {
      setDraftBusy('');
    }
  };

  const handleGuardDiscard = async () => {
    const ok = await confirmDialog({
      title: 'Discard unsaved work',
      message: 'This cannot be undone. The local work will be lost for good.',
      confirmLabel: 'Discard',
      danger: true,
    });
    if (!ok) return;
    setDraftBusy('discard');
    try {
      await draftGuard.resume();
      setDraftGuard(null);
      await refresh();
    } catch (e) {
      setError(e?.message || 'Something went wrong.');
    } finally {
      setDraftBusy('');
    }
  };

  const handleStatusChange = (project, status) => guard(`status:${project.filename}`, async () => {
    await setProjectStatus(project.filename, status);
    await refresh();
  });

  const handleDelete = (project) => guard(project.filename, async () => {
    const ok = await confirmDialog({
      title: 'Move to trash',
      message: `"${project.name}" stays recoverable for ${TRASH_DAYS} days, then is deleted for good.`,
      confirmLabel: 'Move to trash',
      danger: true,
    });
    if (!ok) return;
    if (openFilename === project.filename) await closeProject();
    await trashProject(project.filename);
    await refresh();
  });

  const handleRestore = (item) => guard(`trash:${item.filename}`, async () => {
    await restoreFromTrash(item.filename);
    await refresh();
  });

  const handleDeleteForever = (item) => guard(`trash:${item.filename}`, async () => {
    const ok = await confirmDialog({
      title: 'Delete permanently',
      message: `This removes "${item.name}" and every PDF inside it. This cannot be undone.`,
      confirmLabel: 'Delete forever',
      danger: true,
    });
    if (!ok) return;
    await deleteFromTrash(item.filename);
    await refresh();
  });

  if (loading) {
    return <div className={styles.pageContainer}><p className={styles.muted}>Loading projects from cloud…</p></div>;
  }

  return (
    <div className={styles.pageContainer}>
      {showCreateModal && (
        <CreateProjectModal
          onClose={() => setShowCreateModal(false)}
          onSubmit={handleCreateSubmit}
          busy={!!busy}
        />
      )}

      {historyFor && (
        <VersionHistoryModal
          project={historyFor}
          onClose={() => setHistoryFor(null)}
          onRestored={async () => { setHistoryFor(null); await refresh(); }}
        />
      )}

      {draftGuard && (
        <DraftGuardModal
          draft={draftGuard}
          busy={draftBusy}
          onSave={handleGuardSave}
          onExport={handleGuardExport}
          onDiscard={handleGuardDiscard}
          onClose={() => setDraftGuard(null)}
        />
      )}

      <header className={styles.pageHeader}>
        <div className={styles.titleBlock}>
          <h1>{showTrash ? 'Trash' : 'Projects'}</h1>
          <button type="button" className={styles.btnIcon} onClick={refresh} title="Refresh projects" disabled={!!busy}>
            <RefreshCw size={18} className={busy === 'folder' ? styles.spin : ''} />
          </button>
        </div>
        <div className={styles.headerActions}>
          <button type="button" className={styles.btnGhost} onClick={() => setShowTrash(!showTrash)}>
            {showTrash ? <><FolderOpen size={18} /><span>Back to projects</span></> : <><Trash2 size={18} /><span>View trash</span></>}
          </button>
          
          {!showTrash && isManagerLevel && (
            <button type="button" className={styles.btnPrimary} onClick={() => setShowCreateModal(true)} disabled={!!busy}>
              <Plus size={18} /><span>New project</span>
            </button>
          )}
        </div>
      </header>

      {error && <div className={styles.errorBanner}><p>{error}</p></div>}

      {!showTrash && (
        <div className={styles.toolbar}>
          <div className={styles.searchWrap}>
            <Search size={16} className={styles.searchIcon} />
            <input
              type="search"
              className={styles.searchInput}
              placeholder="Search projects…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search projects by name"
            />
          </div>

          <select
            className={styles.filterSelect}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Filter by status"
          >
            <option value="all">All statuses</option>
            {PROJECT_STATUSES.map((s) => (
              <option key={s} value={s}>{statusLabel(s)}</option>
            ))}
          </select>

          <select
            className={styles.filterSelect}
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            aria-label="Sort projects"
          >
            {Object.entries(SORTS).map(([key, { label }]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>

          <span className={styles.resultCount}>
            {visible.length} of {projects.length}
          </span>

          <div className={styles.viewToggle} role="group" aria-label="View mode">
            <button
              type="button"
              className={`${styles.viewBtn} ${view === 'cards' ? styles.viewBtnActive : ''}`}
              onClick={() => setView('cards')}
              aria-pressed={view === 'cards'}
              title="Card view"
            >
              <LayoutGrid size={16} />
            </button>
            <button
              type="button"
              className={`${styles.viewBtn} ${view === 'list' ? styles.viewBtnActive : ''}`}
              onClick={() => setView('list')}
              aria-pressed={view === 'list'}
              title="List view"
            >
              <ListIcon size={16} />
            </button>
          </div>
        </div>
      )}

      <input
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        ref={coverInputRef}
        onChange={handleCoverSelect}
      />

      <div className={view === 'list' ? styles.list : styles.grid}>
        {view === 'list' && visible.length > 0 && (
          <div className={showTrash ? styles.listHeaderTrash : styles.listHeader}>
            <span>Name</span>
            <span>Status</span>
            {showTrash ? (
              <span>Expires</span>
            ) : (
              <>
                <span>Progress</span>
                <span>Waiting on</span>
                <span>Target</span>
              </>
            )}
            <span className={styles.listActionsHead}>Actions</span>
          </div>
        )}

        {visible.map((project) => (view === 'list' ? (
          <div key={project.filename} className={showTrash ? styles.listRowTrash : styles.listRow}>
            {showTrash ? (
              <span className={styles.listName} title={project.name}>{project.name}</span>
            ) : (
              <span className={styles.listNameCell}>
                <Link to={`/projects/${project.filename}`} className={styles.listNameLink} title={`${project.name} — open project overview`}>
                  {project.name}
                </Link>
                {/* The full timestamp and who touched it last are on the
                    project overview; the list only needs "is this stale". */}
                <span className={styles.listSubline} title={`Updated ${formatWhen(project.last_modified_at)}${project.updater_email ? ` by ${project.updater_email}` : ''}`}>
                  {formatAgo(project.last_modified_at)}
                  {isManagerLevel && project.updater_email ? ` · ${project.updater_email}` : ''}
                </span>
              </span>
            )}

            <span className={styles.listCell}>
              {showTrash
                ? <span className={styles.badge}>{statusLabel('trashed')}</span>
                : <StatusControl project={project} canEdit={canSetStatus} busy={!!busy} onChange={handleStatusChange} />}
            </span>

            {showTrash ? (
              <span className={styles.listCell}>
                {daysLeft(project)} day{daysLeft(project) === 1 ? '' : 's'}
              </span>
            ) : (
              <TimelineCells project={project} />
            )}

            <span className={styles.listActions}>
              {!showTrash ? (
                <>
                  {!isSales && (
                    <button type="button" className={styles.btnSecondary} onClick={() => handleOpen(project)} disabled={!!busy || !!project.error}>
                      {openFilename === project.filename ? 'Resume' : 'Open'}
                    </button>
                  )}
                  <button type="button" className={styles.btnIconGhost} onClick={() => setHistoryFor(project)} title="Version history" disabled={!!busy}>
                    <History size={18} />
                  </button>
                  {isManagerLevel && (
                    <button type="button" className={styles.btnIconGhost} onClick={() => handleDelete(project)} title="Move to trash" disabled={!!busy}>
                      <Trash2 size={18} />
                    </button>
                  )}
                </>
              ) : (
                <>
                  <button type="button" className={styles.btnSecondary} onClick={() => handleRestore(project)} disabled={!!busy}>
                    <Undo2 size={16} /> Restore
                  </button>
                  {isManagerLevel && (
                    <button type="button" className={styles.btnIconGhost} onClick={() => handleDeleteForever(project)} title="Delete forever" disabled={!!busy}>
                      <Trash2 size={18} />
                    </button>
                  )}
                </>
              )}
            </span>
          </div>
        ) : (
          <div key={project.filename} className={styles.card}>
            <div className={styles.cardCover}>
              {project.cover_image ? (
                <img src={project.cover_image} alt={`${project.name} cover`} />
              ) : (
                <div className={styles.cardCoverPlaceholder}>
                  <ImageIcon size={48} />
                </div>
              )}

              {/* isManagerLevel, not a hand-rolled admin||manager: this gate
                  had drifted and left a team leader able to trash a project
                  but not change its cover image. */}
              {!showTrash && isManagerLevel && (
                <button
                  type="button"
                  className={styles.editCoverBtn}
                  onClick={() => handleEditCoverClick(project.id)}
                  disabled={!!busy}
                >
                  <ImageIcon size={14} /> Edit Cover
                </button>
              )}
            </div>
            <div className={styles.cardContent}>
              <div className={styles.cardInfo}>
                {showTrash ? (
                  <h3 className={styles.cardName}>{project.name}</h3>
                ) : (
                  <h3 className={styles.cardName}>
                    <Link to={`/projects/${project.filename}`} className={styles.cardNameLink} title={`${project.name} — open project overview`}>
                      {project.name}
                    </Link>
                  </h3>
                )}
                <p className={styles.cardMeta}>
                  Modified {formatWhen(project.last_modified_at)} &middot; {formatSize(project.file_size)}
                </p>
                {isManagerLevel && project.updater_email && (
                  <p className={styles.cardMeta} style={{ marginTop: '-4px' }}>
                    By {project.updater_email}
                  </p>
                )}
                {showTrash && (
                  <p className={styles.cardMeta} style={{ marginTop: '-4px' }}>
                    {daysLeft(project)} day{daysLeft(project) === 1 ? '' : 's'} left before permanent deletion
                  </p>
                )}
                {!showTrash && (
                  <div className={styles.cardStatusRow}>
                    <StatusControl project={project} canEdit={canSetStatus} busy={!!busy} onChange={handleStatusChange} />
                  </div>
                )}
                {!showTrash && <CardTimeline project={project} />}
                <div className={styles.cardStats}>
                  {project.calculation_count > 0 && <span title="Calculations"><Calculator size={14} />{project.calculation_count}</span>}
                  {project.drawing_count > 0 && <span title="Drawings"><Map size={14} />{project.drawing_count}</span>}
                </div>
              </div>

              {!showTrash ? (
                <div className={styles.cardActions}>
                  {!isSales && (
                    <button type="button" className={styles.btnSecondary} onClick={() => handleOpen(project)} disabled={!!busy || !!project.error}>
                      {openFilename === project.filename ? 'Resume' : 'Open'}
                    </button>
                  )}
                  <button type="button" className={styles.btnIconGhost} onClick={() => setHistoryFor(project)} title="Version history" disabled={!!busy}>
                    <History size={18} />
                  </button>
                  {isManagerLevel && (
                    <button type="button" className={styles.btnIconGhost} onClick={() => handleDelete(project)} title="Move to trash" disabled={!!busy}>
                      <Trash2 size={18} />
                    </button>
                  )}
                </div>
              ) : (
                <div className={styles.cardActions}>
                  <button type="button" className={styles.btnSecondary} onClick={() => handleRestore(project)} disabled={!!busy}>
                    <Undo2 size={16} /> Restore
                  </button>
                  {isManagerLevel && (
                    <button type="button" className={styles.btnIconGhost} onClick={() => handleDeleteForever(project)} title="Delete forever" disabled={!!busy}>
                      <Trash2 size={18} />
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )))}

        {visible.length === 0 && filtersApplied && !error && (
          <div className={styles.emptyState}>
            <Search size={48} className={styles.emptyIcon} />
            <h2>No matching projects</h2>
            <p>Nothing matches that search and filter. Try a different name, or widen the status filter.</p>
            <button
              type="button"
              className={styles.btnSecondary}
              onClick={() => { setQuery(''); setStatusFilter('all'); }}
            >
              Clear search and filter
            </button>
          </div>
        )}

        {projects.length === 0 && !showTrash && !error && (
          <div className={styles.emptyState}>
            <LayoutTemplate size={48} className={styles.emptyIcon} />
            <h2>No projects yet</h2>
            <p>
              {isManagerLevel
                ? 'Create a new project to get started.'
                : 'You have no assigned projects yet.'}
            </p>
            {isManagerLevel && (
              <button type="button" className={styles.btnPrimary} onClick={() => setShowCreateModal(true)} disabled={!!busy}>
                <Plus size={18} /><span>New project</span>
              </button>
            )}
          </div>
        )}

        {trash.length === 0 && showTrash && !error && (
          <div className={styles.emptyState}>
            <Trash2 size={48} className={styles.emptyIcon} />
            <h2>Trash is empty</h2>
          </div>
        )}
      </div>
    </div>
  );
}
