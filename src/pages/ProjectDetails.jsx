import { useCallback, useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { getProjectById, getDesignCases, saveDesignCase, deleteDesignCase } from '../services/localDb';
import styles from './Projects.module.css';
import { Plus, Search, Edit2, Trash2, X } from 'lucide-react';

export default function ProjectDetails() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [designCases, setDesignCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    title: '',
    designType: 'Multi-Span Beam',
    revision: 'A',
    engineer: '',
    status: 'Draft',
    remarks: ''
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    const proj = await getProjectById(projectId);
    if (proj) {
      setProject(proj);
      const cases = await getDesignCases(projectId);
      setDesignCases(cases);
    }
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (editingId) {
      await saveDesignCase({ id: editingId, ...formData });
    } else {
      await saveDesignCase({ ...formData, projectId });
    }
    closeModal();
    loadData();
  };

  const handleEdit = (dc) => {
    setFormData(dc);
    setEditingId(dc.id);
    setIsModalOpen(true);
  };

  const handleDelete = async (id) => {
    if(window.confirm('Are you sure you want to delete this design case?')) {
      await deleteDesignCase(id);
      loadData();
    }
  };

  const openModal = () => {
    setEditingId(null);
    setFormData({
      title: '',
      designType: 'Multi-Span Beam',
      revision: 'A',
      engineer: project?.engineer || '',
      status: 'Draft',
      remarks: ''
    });
    setIsModalOpen(true);
  };

  const closeModal = () => setIsModalOpen(false);

  return (
    <div className={styles.projectsContainer}>
      <header className={styles.header}>
        <div>
          <h1>{project ? project.projectName : 'Loading...'}</h1>
          <p>
            <Link to="/projects" className={styles.breadcrumb}>Projects</Link> / Design Cases
          </p>
        </div>
        <button className={styles.newProjectBtn} onClick={openModal}>
          <Plus size={18} /> New Design Case
        </button>
      </header>

      <div className={styles.controlsRow}>
        <div className={styles.searchBar}>
          <Search size={18} className={styles.searchIcon} />
          <input type="text" placeholder="Search design cases..." />
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <select className={styles.filterSelect}>
            <option>All Projects</option>
          </select>
          <select className={styles.filterSelect}>
            <option>All Types</option>
            <option>Multi-Span Beam</option>
          </select>
          <select className={styles.filterSelect}>
            <option>All Status</option>
            <option>Pass</option>
            <option>Review</option>
            <option>Fail</option>
            <option>Draft</option>
          </select>
        </div>
      </div>

      <div className={styles.tableWrapper}>
        <table className={styles.projectsTable}>
          <thead>
            <tr>
              <th>Design Case</th>
              <th>Project</th>
              <th>Type</th>
              <th>Revision</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              [...Array(3)].map((_, i) => (
                <tr key={i}>
                  <td><span className={styles.skeleton} /></td>
                  <td><span className={styles.skeleton} /></td>
                  <td><span className={`${styles.skeleton} ${styles.short}`} /></td>
                  <td><span className={`${styles.skeleton} ${styles.short}`} /></td>
                  <td><span className={`${styles.skeleton} ${styles.short}`} /></td>
                  <td><span className={`${styles.skeleton} ${styles.short}`} /></td>
                </tr>
              ))
            ) : designCases.length === 0 ? (
              <tr><td colSpan="6" className={styles.emptyState}>No design cases yet. Select New Design Case to add the first one.</td></tr>
            ) : (
              designCases.map((dc) => (
                <tr key={dc.id} onClick={() => navigate(`/projects/${projectId}/case/${dc.id}`)} style={{cursor: 'pointer'}}>
                  <td className={styles.primaryCell}>{dc.dcNumber}</td>
                  <td>{project?.projectName}</td>
                  <td>{dc.designType}</td>
                  <td>{dc.revision}</td>
                  <td>
                    <span className={`${styles.statusBadge} ${styles[dc.status.toLowerCase().replace(' ', '')] || styles.draft}`}>
                      {dc.status}
                    </span>
                  </td>
                  <td className={styles.actionsCell}>
                    <button className={styles.iconBtn} onClick={(e) => handleEdit(dc, e)} title="Edit">
                      <Edit2 size={16} />
                    </button>
                    <button className={`${styles.iconBtn} ${styles.danger}`} onClick={(e) => handleDelete(dc.id, e)} title="Delete">
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h2>{editingId ? 'Edit Design Case' : 'New Design Case'}</h2>
              <button className={styles.closeBtn} onClick={closeModal} aria-label="Close">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className={styles.modalForm}>
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Title *</label>
                  <input type="text" name="title" required value={formData.title} onChange={handleInputChange} />
                </div>
                <div className={styles.formGroup}>
                  <label>Design Type</label>
                  <select name="designType" value={formData.designType} onChange={handleInputChange}>
                    <option value="Multi-Span Beam">Multi-Span Beam</option>
                    <option value="Wall Formwork" disabled>Wall Formwork (Coming Soon)</option>
                    <option value="Slab Formwork" disabled>Slab Formwork (Coming Soon)</option>
                  </select>
                </div>
              </div>
              
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Revision</label>
                  <input type="text" name="revision" value={formData.revision} onChange={handleInputChange} />
                </div>
                <div className={styles.formGroup}>
                  <label>Engineer</label>
                  <input type="text" name="engineer" value={formData.engineer} onChange={handleInputChange} />
                </div>
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Status</label>
                  <select name="status" value={formData.status} onChange={handleInputChange}>
                    <option value="Draft">Draft</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Checking">Checking</option>
                    <option value="Approved">Approved</option>
                  </select>
                </div>
              </div>
              
              <div className={styles.formGroup}>
                <label>Remarks</label>
                <textarea name="remarks" rows="2" value={formData.remarks} onChange={handleInputChange}></textarea>
              </div>

              <div className={styles.modalActions}>
                <button type="button" onClick={closeModal} className={styles.cancelBtn}>Cancel</button>
                <button type="submit" className={styles.submitBtn}>
                  {editingId ? 'Save Changes' : 'Create Design Case'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
