import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getProjects, saveProject, deleteProject } from '../services/localDb';
import styles from './Projects.module.css';
import { Plus, Search, Edit2, Trash2, X } from 'lucide-react';

export default function Projects() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    projectName: '',
    client: '',
    contractor: '',
    location: '',
    designStandard: 'BS EN 1993',
    engineer: '',
    status: 'Active',
    remarks: ''
  });

  const loadProjects = async () => {
    setLoading(true);
    try {
      const data = await getProjects();
      setProjects(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProjects();
  }, []);

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (editingId) {
      await saveProject({ id: editingId, ...formData });
    } else {
      await saveProject(formData);
    }
    closeModal();
    loadProjects();
  };

  const handleEdit = (project, e) => {
    e.stopPropagation();
    setFormData(project);
    setEditingId(project.id);
    setIsModalOpen(true);
  };

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    if(window.confirm('Are you sure you want to delete this project? All associated design cases will be orphaned.')) {
      await deleteProject(id);
      loadProjects();
    }
  };

  const openModal = () => {
    setFormData({
      projectName: '', client: '', contractor: '', location: '',
      designStandard: 'BS EN 1993', engineer: '', status: 'Active', remarks: ''
    });
    setEditingId(null);
    setIsModalOpen(true);
  };

  const closeModal = () => setIsModalOpen(false);

  return (
    <div className={styles.projectsContainer}>
      <header className={styles.header}>
        <div>
          <h1>Projects</h1>
          <p>Manage all your projects</p>
        </div>
        <button className={styles.newProjectBtn} onClick={openModal}>
          <Plus size={18} /> New Project
        </button>
      </header>

      <div className={styles.controlsRow}>
        <div className={styles.searchBar}>
          <Search size={18} className={styles.searchIcon} />
          <input type="text" placeholder="Search projects..." />
        </div>
        <select className={styles.filterSelect}>
          <option>All Status</option>
          <option>Active</option>
          <option>Completed</option>
          <option>Draft</option>
        </select>
      </div>

      <div className={styles.tableWrapper}>
        <table className={styles.projectsTable}>
          <thead>
            <tr>
              <th>Project Name</th>
              <th>Client</th>
              <th>Location</th>
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
                </tr>
              ))
            ) : projects.length === 0 ? (
              <tr><td colSpan="5" className={styles.emptyState}>No projects yet. Select New Project to create your first one.</td></tr>
            ) : (
              projects.map((p) => (
                <tr key={p.id} onClick={() => navigate(`/projects/${p.id}`)} style={{cursor: 'pointer'}}>
                  <td className={styles.primaryCell}>{p.projectName}</td>
                  <td>{p.client}</td>
                  <td>{p.location}</td>
                  <td>
                    <span className={`${styles.statusBadge} ${styles[p.status.toLowerCase().replace(' ', '')] || ''}`}>
                      {p.status}
                    </span>
                  </td>
                  <td className={styles.actionsCell}>
                    <button className={styles.iconBtn} onClick={(e) => handleEdit(p, e)} title="Edit">
                      <Edit2 size={16} />
                    </button>
                    <button className={`${styles.iconBtn} ${styles.danger}`} onClick={(e) => handleDelete(p.id, e)} title="Delete">
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
              <h2>{editingId ? 'Edit Project' : 'New Project'}</h2>
              <button className={styles.closeBtn} onClick={closeModal}><X size={20} /></button>
            </div>
            <form className={styles.modalForm} onSubmit={handleSubmit}>
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Project Name *</label>
                  <input type="text" name="projectName" required value={formData.projectName} onChange={handleInputChange} />
                </div>
                <div className={styles.formGroup}>
                  <label>Location</label>
                  <input type="text" name="location" value={formData.location} onChange={handleInputChange} />
                </div>
              </div>
              
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Client</label>
                  <input type="text" name="client" value={formData.client} onChange={handleInputChange} />
                </div>
                <div className={styles.formGroup}>
                  <label>Contractor</label>
                  <input type="text" name="contractor" value={formData.contractor} onChange={handleInputChange} />
                </div>
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Engineer</label>
                  <input type="text" name="engineer" value={formData.engineer} onChange={handleInputChange} />
                </div>
                <div className={styles.formGroup}>
                  <label>Status</label>
                  <select name="status" value={formData.status} onChange={handleInputChange}>
                    <option value="Active">Active</option>
                    <option value="On Hold">On Hold</option>
                    <option value="Completed">Completed</option>
                    <option value="Archived">Archived</option>
                  </select>
                </div>
              </div>

              <div className={styles.formGroup}>
                <label>Design Standard</label>
                <select name="designStandard" value={formData.designStandard} onChange={handleInputChange}>
                  <option value="BS EN 1993">BS EN 1993 (Steel)</option>
                  <option value="BS EN 1995">BS EN 1995 (Timber)</option>
                  <option value="BS 5975">BS 5975 (Temporary Works)</option>
                </select>
              </div>
              
              <div className={styles.formGroup}>
                <label>Remarks</label>
                <textarea name="remarks" rows="3" value={formData.remarks} onChange={handleInputChange}></textarea>
              </div>

              <div className={styles.modalActions}>
                <button type="button" onClick={closeModal} className={styles.cancelBtn}>Cancel</button>
                <button type="submit" className={styles.submitBtn}>
                  {editingId ? 'Save Changes' : 'Create Project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
