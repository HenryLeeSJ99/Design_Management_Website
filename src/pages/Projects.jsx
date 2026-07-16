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
  AlertTriangle, Calculator, Copy, FolderOpen, FolderPlus, HardDrive, Layers,
  Map, Pencil, Plus, RefreshCw, Trash2,
} from 'lucide-react';
import {
  deleteProjectFile, ensurePermission, getFolder, isFolderSupported, listProjects,
  needsPermission, pickFolder, readProjectFile, uniqueFilename, writeProjectFile,
} from '../services/projectFiles';
import { closeProject, createProject, getOpenFilename, openProject } from '../services/projectSession';
import { TwFileError } from '../services/twFile';
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
  const [folderName, setFolderName] = useState(null);
  const [state, setState] = useState('loading'); // loading | ready | no-folder | needs-permission | unsupported
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');

  const openFilename = getOpenFilename();

  const refresh = useCallback(async () => {
    setError('');
    if (!isFolderSupported()) { setState('unsupported'); return; }
    if (await needsPermission()) { setState('needs-permission'); return; }
    const dir = await getFolder();
    if (!dir) { setState('no-folder'); return; }
    setFolderName(dir.name);
    try {
      setProjects(await listProjects(dir));
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
    const name = window.prompt('Project name:', 'New Project');
    if (!name || !name.trim()) return;
    const filename = await uniqueFilename(name.trim());
    await createProject(filename, name.trim());
    navigate('/dashboard');
  });

  const handleOpen = (project) => guard(project.filename, async () => {
    if (project.error) return;
    await openProject(project.filename);
    navigate('/dashboard');
  });

  const handleRename = (project) => guard(project.filename, async () => {
    const name = window.prompt('Project name:', project.name);
    if (!name || !name.trim() || name === project.name) return;

    // No rename in the File System Access API: copy to the new name, then drop
    // the old file. Read first so a failure leaves the original untouched.
    const bytes = await readProjectFile(project.filename);
    const target = await uniqueFilename(name.trim());
    await writeProjectFile(target, new Uint8Array(bytes));
    await deleteProjectFile(project.filename);

    // Renaming the file does not rename the project inside it
    await openProject(target);
    const { setProjectName } = await import('../services/projectStore');
    setProjectName(name.trim());
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
    if (!window.confirm(
      `Delete "${project.name}"?\n\nThis deletes ${project.filename} from your projects folder, including every PDF inside it. This cannot be undone.`,
    )) return;
    if (openFilename === project.filename) await closeProject();
    await deleteProjectFile(project.filename);
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
                      <button type="button" className={`${styles.iconBtn} ${styles.danger}`} onClick={() => handleDelete(project)} title="Delete" disabled={working}>
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
    </div>
  );
}
