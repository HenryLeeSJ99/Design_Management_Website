import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import styles from './Projects.module.css'; // Reusing the same styles for consistency

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

  useEffect(() => {
    const q = query(collection(db, 'library'), orderBy('name', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = [];
      snapshot.forEach((doc) => {
        items.push({ id: doc.id, ...doc.data() });
      });
      setProducts(items);
      setLoading(false);
    });

    return unsubscribe;
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

    if (editingId) {
      const docRef = doc(db, 'library', editingId);
      await updateDoc(docRef, { ...productData, updatedAt: serverTimestamp() });
    } else {
      await addDoc(collection(db, 'library'), {
        ...productData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    }
    closeModal();
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
      await deleteDoc(doc(db, 'library', id));
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
          <h1 className={styles.pageTitle}>Product Library</h1>
          <p className={styles.pageSubtitle}>Manage standard beams, props, and formwork components</p>
        </div>
        <button className={styles.primaryBtn} onClick={openModal}>+ Add Product</button>
      </header>

      <main className={styles.mainContent}>
        {loading ? (
          <div className={styles.loading}>Loading library...</div>
        ) : products.length === 0 ? (
          <div className={styles.emptyState}>
            No products found. Add a new component to get started!
          </div>
        ) : (
          <div className={styles.tableContainer}>
            <table className={styles.dataTable}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Category</th>
                  <th>EI (kNm²)</th>
                  <th>M_cap (kNm)</th>
                  <th>V_cap (kN)</th>
                  <th>Weight (kN/m)</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id}>
                    <td className={styles.primaryCell}>{p.name}</td>
                    <td>{p.category}</td>
                    <td>{p.ei}</td>
                    <td>{p.momentCapacity}</td>
                    <td>{p.shearCapacity}</td>
                    <td>{p.weight}</td>
                    <td className={styles.actionsCell}>
                      <button className={styles.iconBtn} onClick={() => handleEdit(p)}>Edit</button>
                      <button className={`${styles.iconBtn} ${styles.danger}`} onClick={() => handleDelete(p.id)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {isModalOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h2>{editingId ? 'Edit Product' : 'New Product'}</h2>
              <button className={styles.closeBtn} onClick={closeModal}>&times;</button>
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

              <div className={styles.modalFooter}>
                <button type="button" className={styles.secondaryBtn} onClick={closeModal}>Cancel</button>
                <button type="submit" className={styles.primaryBtn}>{editingId ? 'Save Changes' : 'Add Product'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
