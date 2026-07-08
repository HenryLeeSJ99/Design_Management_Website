import styles from './MultiSpanBeam.module.css';
import { Plus, Trash2 } from 'lucide-react';

export default function GeometryInput({ spans, setSpans }) {
  
  const addSpan = () => {
    setSpans([...spans, { length: 5000, leftSupport: 'pin', rightSupport: 'roller' }]);
  };
  
  const removeSpan = (index) => {
    if (spans.length <= 1) return;
    setSpans(spans.filter((_, i) => i !== index));
  };
  
  const updateSpan = (index, field, value) => {
    const newSpans = [...spans];
    newSpans[index][field] = value;
    setSpans(newSpans);
  };
  
  return (
    <>
      <div className={styles.panelHeader}>
        <h3>Geometry & Supports</h3>
      </div>
      <div className={styles.panelBody}>
        {spans.map((span, i) => (
          <div key={i} className={styles.formGroup} style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '1rem', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label>Span {i+1}</label>
              <button className={styles.deleteBtn} onClick={() => removeSpan(i)}>
                <Trash2 size={16} />
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <div className={styles.formGroup}>
                <label>Left Support</label>
                <select value={span.leftSupport} onChange={(e) => updateSpan(i, 'leftSupport', e.target.value)}>
                  <option value="pin">Pin</option>
                  <option value="fixed">Fixed</option>
                  <option value="roller">Roller</option>
                  <option value="free">Free</option>
                </select>
              </div>
              <div className={styles.formGroup}>
                <label>Right Support</label>
                <select value={span.rightSupport} onChange={(e) => updateSpan(i, 'rightSupport', e.target.value)}>
                  <option value="pin">Pin</option>
                  <option value="fixed">Fixed</option>
                  <option value="roller">Roller</option>
                  <option value="free">Free</option>
                </select>
              </div>
            </div>
            <div className={styles.formGroup}>
              <label>Length (mm)</label>
              <input type="number" value={span.length} onChange={(e) => updateSpan(i, 'length', Number(e.target.value))} />
            </div>
          </div>
        ))}
        <button className={styles.addBtn} onClick={addSpan}>
          <Plus size={18} /> Add Span
        </button>
      </div>
    </>
  );
}
