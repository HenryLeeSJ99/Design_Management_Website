import { useState, useEffect } from 'react';
import { getLibraryProducts, saveLibraryProduct, deleteLibraryProduct } from '../services/localDb';
import styles from './Projects.module.css'; // Reusing the same styles for consistency
import { Plus, Edit2, Trash2, X } from 'lucide-react';

export default function Library() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    category: 'Beam',
    material: 'Steel',
    ei: '',
    momentCapacity: '',
    shearCapacity: '',
    weight: '',
    supplier: ''
  });

  const loadProducts = async () => {
    const items = await getLibraryProducts();
    setProducts(items);
    setLoading(false);
  };

  useEffect(() => {
    loadProducts();
  }, []);

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const productData = {
      ...formData,
      ei: Number(formData.ei),
      momentCapacity: Number(formData.momentCapacity),
      shearCapacity: Number(formData.shearCapacity),
      weight: Number(formData.weight)
    };

    await saveLibraryProduct(editingId ? { ...productData, id: editingId } : productData);
    closeModal();
    loadProducts();
  };

  const handleEdit = (product) => {
    setFormData({
      ...product,
      ei: product.ei.toString(),
      momentCapacity: product.momentCapacity.toString(),
      shearCapacity: product.shearCapacity.toString(),
      weight: product.weight.toString(),
    });
    setEditingId(product.id);
    setIsModalOpen(true);
  };

  const handleDelete = async (id) => {
    if(window.confirm('Are you sure you want to delete this product? Calculations using this product might be affected.')) {
      await deleteLibraryProduct(id);
      loadProducts();
    }
  };

  const openModal = () => {
    setEditingId(null);
    setFormData({
      name: '',
      category: 'Beam',
      material: 'Steel',
      ei: '',
      momentCapacity: '',
      shearCapacity: '',
      weight: '',
      supplier: ''
    });
    setIsModalOpen(true);
  };

  const closeModal = () => setIsModalOpen(false);

  return (
    <div className={styles.projectsContainer}>
      <header className={styles.header}>
        <div>
          <h1>Product Library</h1>
          <p>Manage standard beams, props, and formwork components</p>
        </div>
        <button className={styles.newProjectBtn} onClick={openModal}>
          <Plus size={18} /> Add Product
        </button>
      </header>

      <main>
        <div className={styles.tableWrapper}>
          <table className={styles.projectsTable}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Category</th>
                <th className={styles.numericCell}>EI (kNm²)</th>
                <th className={styles.numericCell}>M_cap (kNm)</th>
                <th className={styles.numericCell}>V_cap (kN)</th>
                <th className={styles.numericCell}>Weight (kN/m)</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(3)].map((_, i) => (
                  <tr key={i}>
                    <td><span className={styles.skeleton} /></td>
                    <td><span className={`${styles.skeleton} ${styles.short}`} /></td>
                    <td><span className={`${styles.skeleton} ${styles.short}`} /></td>
                    <td><span className={`${styles.skeleton} ${styles.short}`} /></td>
                    <td><span className={`${styles.skeleton} ${styles.short}`} /></td>
                    <td><span className={`${styles.skeleton} ${styles.short}`} /></td>
                    <td><span className={`${styles.skeleton} ${styles.short}`} /></td>
                  </tr>
                ))
              ) : products.length === 0 ? (
                <tr><td colSpan="7" className={styles.emptyState}>No products yet. Select Add Product to build your component library.</td></tr>
              ) : (
                products.map((p) => (
                  <tr key={p.id}>
                    <td className={styles.primaryCell}>{p.name}</td>
                    <td>{p.category}</td>
                    <td className={styles.numericCell}>{p.ei}</td>
                    <td className={styles.numericCell}>{p.momentCapacity}</td>
                    <td className={styles.numericCell}>{p.shearCapacity}</td>
                    <td className={styles.numericCell}>{p.weight}</td>
                    <td className={styles.actionsCell}>
                      <button className={styles.iconBtn} onClick={() => handleEdit(p)} title="Edit">
                        <Edit2 size={16} />
                      </button>
                      <button className={`${styles.iconBtn} ${styles.danger}`} onClick={() => handleDelete(p.id)} title="Delete">
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </main>

      {isModalOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h2>{editingId ? 'Edit Product' : 'New Product'}</h2>
              <button className={styles.closeBtn} onClick={closeModal} aria-label="Close">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className={styles.modalForm}>
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Product Name *</label>
                  <input type="text" name="name" required value={formData.name} onChange={handleInputChange} />
                </div>
                <div className={styles.formGroup}>
                  <label>Supplier</label>
                  <input type="text" name="supplier" value={formData.supplier} onChange={handleInputChange} />
                </div>
              </div>
              
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Category</label>
                  <select name="category" value={formData.category} onChange={handleInputChange}>
                    <option value="Beam">Beam (Primary/Secondary)</option>
                    <option value="Prop">Prop / Shore</option>
                    <option value="Plywood">Plywood</option>
                    <option value="Soldier">Soldier</option>
                  </select>
                </div>
                <div className={styles.formGroup}>
                  <label>Material</label>
                  <select name="material" value={formData.material} onChange={handleInputChange}>
                    <option value="Steel">Steel</option>
                    <option value="Aluminum">Aluminum</option>
                    <option value="Timber">Timber</option>
                  </select>
                </div>
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Flexural Stiffness (EI) [kNm²] *</label>
                  <input type="number" step="any" name="ei" required value={formData.ei} onChange={handleInputChange} />
                </div>
                <div className={styles.formGroup}>
                  <label>Moment Capacity [kNm] *</label>
                  <input type="number" step="any" name="momentCapacity" required value={formData.momentCapacity} onChange={handleInputChange} />
                </div>
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Shear Capacity [kN] *</label>
                  <input type="number" step="any" name="shearCapacity" required value={formData.shearCapacity} onChange={handleInputChange} />
                </div>
                <div className={styles.formGroup}>
                  <label>Unit Weight [kN/m] *</label>
                  <input type="number" step="any" name="weight" required value={formData.weight} onChange={handleInputChange} />
                </div>
              </div>

              <div className={styles.modalActions}>
                <button type="button" className={styles.cancelBtn} onClick={closeModal}>Cancel</button>
                <button type="submit" className={styles.submitBtn}>{editingId ? 'Save Changes' : 'Add Product'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
