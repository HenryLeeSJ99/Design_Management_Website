/**
 * Projects.jsx
 * Every project in the engineer's projects folder, as cards.
 *
 * Each card is one .tw file on disk. This page is a view of a folder, not of
 * browser storage — so what is listed here is what is backed up, copied and
 * shared, and nothing is hiding in a database only this browser can see.
 */

import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle, Calculator, Copy, FolderOpen, FolderPlus, HardDrive, History,
  Layers, Map, Pencil, Plus, RefreshCw, RotateCcw, Trash2, Undo2,
} from 'lucide-react';
import {
  deleteProjectFile, ensurePermission, getFolder, isFolderSupported, listProjects,
  listTrash, needsPermission, pickFolder, purgeExpiredTrash, readProjectFile,
  restoreFromTrash, trashProject, uniqueFilename, writeProjectFile, TRASH_DAYS,
} from '../services/projectFiles';
import { closeProject, createProject, getOpenFilename, openProject } from '../services/projectSession';
import { TwFileError } from '../services/twFile';
import { confirmDialog, promptDialog } from '../services/dialog';
import styles from './Projects.module.css';

const formatSize = (bytes) => {
  if (!bytes) return '—';
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
};

const formatWhen = (ts) => (ts
  ? new Date(ts).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  : '—');

export default function Projects() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [trash, setTrash] = useState([]);
  const [showTrash, setShowTrash] = useState(false);
  const [folderName, setFolderName] = useState(null);
  const [state, setState] = useState('loading'); // loading | ready | no-folder | needs-permission | unsupported
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [historyFor, setHistoryFor] = useState(null); // a project whose versions are shown

  const openFilename = getOpenFilename();

  const refresh = useCallback(async () => {
    setError('');
    if (!isFolderSupported()) { setState('unsupported'); return; }
    if (await needsPermission()) { setState('needs-permission'); return; }
    const dir = await getFolder();
    if (!dir) { setState('no-folder'); return; }
    setFolderName(dir.name);
    try {
      // Looking at the folder is also when expired trash gets swept, so no
      // scheduler is needed
      await purgeExpiredTrash(dir).catch(() => {});
      const [live, binned] = await Promise.all([listProjects(dir), listTrash(dir)]);
      setProjects(live);
      setTrash(binned);
      setState('ready');
    } catch (e) {
      setError(e?.message || 'The projects folder could not be read.');
      setState('ready');
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const guard = async (label, fn) => {
    setBusy(label);
    setError('');
    try {
      await fn();
    } catch (e) {
      setError(e instanceof TwFileError ? e.message : (e?.message || 'Something went wrong.'));
    } finally {
      setBusy('');
    }
  };

  const handlePickFolder = () => guard('folder', async () => {
    if (await pickFolder()) await refresh();
  });

  const handleGrant = () => guard('folder', async () => {
    await ensurePermission();
    await refresh();
  });

  const handleNew = () => guard('new', async () => {
    const name = await promptDialog({
      title: 'New project',
      label: 'Project name',
      defaultValue: 'New Project',
      confirmLabel: 'Create',
    });
    if (!name) return;
    const filename = await uniqueFilename(name);
    await createProject(filename, name);
    navigate('/dashboard');
  });

  const handleOpen = (project) => guard(project.filename, async () => {
    if (project.error) return;
    await openProject(project.filename);
    navigate('/dashboard');
  });

  const handleRename = (project) => guard(project.filename, async () => {
    const name = await promptDialog({
      title: 'Rename project',
      label: 'Project name',
      defaultValue: project.name,
      confirmLabel: 'Rename',
    });
    if (!name || name === project.name) return;

    // No rename in the File System Access API: copy to the new name, then drop
    // the old file. Read first so a failure leaves the original untouched.
    const bytes = await readProjectFile(project.filename);
    const target = await uniqueFilename(name);
    await writeProjectFile(target, new Uint8Array(bytes));
    await deleteProjectFile(project.filename);

    // Renaming the file does not rename the project inside it
    await openProject(target);
    const { setProjectName } = await import('../services/projectStore');
    setProjectName(name);
    if (openFilename !== project.filename) await closeProject();
    await refresh();
  });

  const handleDuplicate = (project) => guard(project.filename, async () => {
    const bytes = await readProjectFile(project.filename);
    const target = await uniqueFilename(`${project.name} copy`);
    await writeProjectFile(target, new Uint8Array(bytes));
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
    const { deleteFromTrash } = await import('../services/projectFiles');
    await deleteFromTrash(item.filename);
    await refresh();
  });

  // --- Empty / gate states ---

  if (state === 'loading') {
    return <div className={styles.pageContainer}><p className={styles.muted}>Reading your projects folder…</p></div>;
  }

  if (state === 'unsupported') {
    return (
      <div className={styles.pageContainer}>
        <header className={styles.pageHeader}><div className={styles.titleBlock}><h1>Projects</h1></div></header>
        <div className={styles.gate}>
          <AlertTriangle size={22} className={styles.gateIcon} />
          <div>
            <p className={styles.gateTitle}>This browser can’t open a projects folder</p>
            <p className={styles.gateHint}>
              Opening a folder needs Chrome or Edge. In this browser you can still work on one project at a
              time and move it with <strong>Import</strong> and <strong>Export</strong> on the dashboard —
              same .tw file, just more steps.
            </p>
            <button type="button" className={styles.btnSecondary} onClick={() => navigate('/dashboard')}>
              Go to the dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (state === 'needs-permission' || state === 'no-folder') {
    const returning = state === 'needs-permission';
    return (
      <div className={styles.pageContainer}>
        <header className={styles.pageHeader}><div className={styles.titleBlock}><h1>Projects</h1></div></header>
        <div className={styles.gate}>
          <FolderOpen size={22} className={styles.gateIcon} />
          <div>
            <p className={styles.gateTitle}>
              {returning ? 'Reconnect your projects folder' : 'Choose where your projects live'}
            </p>
            <p className={styles.gateHint}>
              {returning
                ? 'Your browser needs permission again to read that folder. Nothing has been lost — your .tw files are still on disk.'
                : 'Pick a folder and every project becomes a .tw file inside it — PDFs and drawings included. Back it up, sync it, copy it to another machine: it is yours.'}
            </p>
            {error && <p className={styles.error}>{error}</p>}
            <button
              type="button"
              className={styles.btnPrimary}
              onClick={returning ? handleGrant : handlePickFolder}
              disabled={busy === 'folder'}
            >
              <FolderOpen size={15} /> {returning ? 'Reconnect folder' : 'Choose folder'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- The folder ---

  return (
    <div className={styles.pageContainer}>
      <header className={styles.pageHeader}>
        <div className={styles.titleBlock}>
          <h1>Projects</h1>
          <p>
            <HardDrive size={13} /> {folderName} · {projects.length} project{projects.length === 1 ? '' : 's'}
          </p>
        </div>
        <div className={styles.headerActions}>
          <button type="button" className={styles.btnSecondary} onClick={refresh} title="Re-read the folder">
            <RefreshCw size={15} /> Refresh
          </button>
          <button type="button" className={styles.btnSecondary} onClick={handlePickFolder} disabled={busy === 'folder'}>
            <FolderOpen size={15} /> Change folder
          </button>
          <button type="button" className={styles.btnPrimary} onClick={handleNew} disabled={busy === 'new'}>
            <Plus size={15} /> New project
          </button>
        </div>
      </header>

      {error && <div className={styles.errorBox}>{error}</div>}

      {projects.length === 0 ? (
        <div className={styles.emptyCard}>
          <FolderPlus size={20} />
          <p className={styles.emptyTitle}>No projects in this folder yet</p>
          <p className={styles.emptyHint}>
            Create one and it is saved as a .tw file in <strong>{folderName}</strong> as you work.
          </p>
          <button type="button" className={styles.btnPrimary} onClick={handleNew}>
            <Plus size={15} /> New project
          </button>
        </div>
      ) : (
        <div className={styles.grid}>
          {projects.map((project) => {
            const isOpen = openFilename === project.filename;
            const working = busy === project.filename;
            return (
              <article
                key={project.filename}
                className={[styles.card, project.error ? styles.cardBroken : '', isOpen ? styles.cardOpen : ''].join(' ')}
              >
                {project.error ? (
                  <>
                    <div className={styles.cardHead}>
                      <AlertTriangle size={16} className={styles.brokenIcon} />
                      <h2 className={styles.cardName}>{project.name}</h2>
                    </div>
                    <p className={styles.brokenMsg}>{project.error}</p>
                    <p className={styles.filename}>{project.filename}</p>
                    <div className={styles.cardActions}>
                      <button type="button" className={`${styles.iconBtn} ${styles.danger}`} onClick={() => handleDelete(project)} title="Delete this file">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className={styles.cardHead}>
                      <button type="button" className={styles.cardName} onClick={() => handleOpen(project)}>
                        {project.name}
                      </button>
                      {isOpen && <span className={styles.openBadge}>Open</span>}
                    </div>

                    {project.cover?.reportReference && (
                      <p className={styles.cardRef}>{project.cover.reportReference}</p>
                    )}

                    <div className={styles.stats}>
                      <span title="Calculations"><Calculator size={12} /> {project.calculationCount}</span>
                      <span title="Drawings"><Map size={12} /> {project.drawingCount}</span>
                      <span title="Documents"><Layers size={12} /> {project.documentCount}</span>
                    </div>

                    <p className={styles.meta}>
                      {formatSize(project.size)} · saved {formatWhen(project.modifiedAt)}
                    </p>
                    <p className={styles.filename} title={project.filename}>{project.filename}</p>

                    <div className={styles.cardActions}>
                      <button type="button" className={styles.openBtn} onClick={() => handleOpen(project)} disabled={working}>
                        {working ? 'Opening…' : 'Open'}
                      </button>
                      <button type="button" className={styles.iconBtn} onClick={() => handleRename(project)} title="Rename" disabled={working}>
                        <Pencil size={14} />
                      </button>
                      <button type="button" className={styles.iconBtn} onClick={() => handleDuplicate(project)} title="Duplicate" disabled={working}>
                        <Copy size={14} />
                      </button>
                      <button type="button" className={styles.iconBtn} onClick={() => setHistoryFor(project)} title="Version history" disabled={working}>
                        <History size={14} />
                      </button>
                      <button type="button" className={`${styles.iconBtn} ${styles.danger}`} onClick={() => handleDelete(project)} title="Move to trash" disabled={working}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </>
                )}
              </article>
            );
          })}
        </div>
      )}

      {/* Trash — collapsed by default so it never competes with live projects */}
      {trash.length > 0 && (
        <div className={styles.trashSection}>
          <button type="button" className={styles.trashToggle} onClick={() => setShowTrash((v) => !v)}>
            <Trash2 size={14} />
            Trash ({trash.length}) — kept {TRASH_DAYS} days
            <span className={styles.trashChevron}>{showTrash ? '▾' : '▸'}</span>
          </button>
          {showTrash && (
            <div className={styles.trashList}>
              {trash.map((item) => {
                const working = busy === `trash:${item.filename}`;
                return (
                  <div className={styles.trashRow} key={item.filename}>
                    <div className={styles.trashInfo}>
                      <span className={styles.trashName}>{item.name}</span>
                      <span className={styles.trashMeta}>
                        {formatSize(item.size)} · deleted {formatWhen(item.deletedAt)} ·{' '}
                        <strong>{item.daysLeft} day{item.daysLeft === 1 ? '' : 's'} left</strong>
                      </span>
                    </div>
                    <div className={styles.trashActions}>
                      <button type="button" className={styles.restoreBtn} onClick={() => handleRestore(item)} disabled={working}>
                        <RotateCcw size={13} /> Restore
                      </button>
                      <button type="button" className={`${styles.iconBtn} ${styles.danger}`} onClick={() => handleDeleteForever(item)} title="Delete permanently" disabled={working}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {historyFor && (
        <VersionHistory
          project={historyFor}
          onClose={() => setHistoryFor(null)}
          onRestored={async () => { setHistoryFor(null); await refresh(); }}
        />
      )}
    </div>
  );
}

/**
 * Version history for one project, in a dialog. Each row is a snapshot taken
 * before a later save overwrote it; restoring one snapshots the current file
 * first, so it is itself undoable.
 */
function VersionHistory({ project, onClose, onRestored }) {
  const [versions, setVersions] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');

  useEffect(() => {
    let cancelled = false;
    import('../services/projectFiles')
      .then(({ listVersions }) => listVersions(project.filename))
      .then((v) => { if (!cancelled) setVersions(v); })
      .catch((e) => { if (!cancelled) { setError(e?.message || 'Version history could not be read.'); setVersions([]); } });
    return () => { cancelled = true; };
  }, [project.filename]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleRestore = async (version) => {
    if (project.filename === getOpenFilename()) {
      const ok = await confirmDialog({
        title: 'Restore this version',
        message: 'The current version is kept in history first, so you can undo this.',
        confirmLabel: 'Restore',
      });
      if (!ok) return;
    }
    setBusy(version.filename);
    setError('');
    try {
      const { restoreVersion } = await import('../services/projectFiles');
      await restoreVersion(project.filename, version.filename);
      // If the restored project is the one open, reload it into the working copy
      if (project.filename === getOpenFilename()) await openProject(project.filename);
      await onRestored();
    } catch (e) {
      setError(e instanceof TwFileError ? e.message : (e?.message || 'The version could not be restored.'));
      setBusy('');
    }
  };

  return (
    <div className={styles.backdrop} onClick={onClose} role="presentation">
      <div className={styles.modal} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Version history">
        <header className={styles.modalHead}>
          <div>
            <h2><History size={16} /> Version history</h2>
            <p>{project.name}</p>
          </div>
          <button type="button" className={styles.iconBtn} onClick={onClose} title="Close">✕</button>
        </header>

        <div className={styles.modalBody}>
          {error && <p className={styles.error}>{error}</p>}
          {versions === null && <p className={styles.muted}>Reading history…</p>}
          {versions?.length === 0 && !error && (
            <p className={styles.muted}>
              No earlier versions yet. One is kept each time the project is saved after a change.
            </p>
          )}
          {versions?.map((v, i) => (
            <div className={styles.versionRow} key={v.filename}>
              <div>
                <span className={styles.versionWhen}>{formatWhen(v.savedAt)}</span>
                {i === 0 && <span className={styles.versionTag}>most recent</span>}
                <span className={styles.versionSize}>{formatSize(v.size)}</span>
              </div>
              <button type="button" className={styles.restoreBtn} onClick={() => handleRestore(v)} disabled={!!busy}>
                <Undo2 size={13} /> {busy === v.filename ? 'Restoring…' : 'Restore'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
