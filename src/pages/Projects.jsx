import { useCallback, useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FolderOpen, FolderPlus, Map, Plus, RefreshCw, Trash2, Undo2, LayoutTemplate, Calculator, Image as ImageIcon, X
} from 'lucide-react';
import {
  deleteProjectFile, listProjects, trashProject, restoreFromTrash, deleteFromTrash, TRASH_DAYS
} from '../services/projectFiles';
import { closeProject, createProject, getOpenFilename, openProject } from '../services/projectSession';
import { confirmDialog } from '../services/dialog';
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

  const refresh = useCallback(async () => {
    setError('');
    setLoading(true);
    try {
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

  const handleCreateSubmit = async (name, coverImageFile) => {
    await guard('new', async () => {
      await createProject(null, name, coverImageFile);
      setShowCreateModal(false);
      navigate('/dashboard');
    });
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
    await openProject(project.filename);
    navigate('/dashboard');
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
      
      <input 
        type="file" 
        accept="image/*" 
        style={{ display: 'none' }} 
        ref={coverInputRef} 
        onChange={handleCoverSelect} 
      />

      <div className={styles.grid}>
        {(!showTrash ? projects : trash).map((project) => (
          <div key={project.filename} className={styles.card}>
            <div className={styles.cardCover}>
              {project.cover_image ? (
                <img src={project.cover_image} alt={`${project.name} cover`} />
              ) : (
                <div className={styles.cardCoverPlaceholder}>
                  <ImageIcon size={48} />
                </div>
              )}
              
              {!showTrash && (role === 'admin' || role === 'manager') && (
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
                <h3 className={styles.cardName}>{project.name}</h3>
                <p className={styles.cardMeta}>
                  Modified {formatWhen(project.last_modified_at)} &middot; {formatSize(project.file_size)}
                </p>
                {isManagerLevel && project.updater_email && (
                  <p className={styles.cardMeta} style={{ marginTop: '-4px' }}>
                    By {project.updater_email}
                  </p>
                )}
                {isSales && <span className={styles.badge}>Status: {project.status}</span>}
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
        ))}

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
