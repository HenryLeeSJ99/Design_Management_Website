import styles from './MultiSpanBeam.module.css';
import { Plus, Trash2 } from 'lucide-react';

export default function LoadsInput({ loads, setLoads, spans }) {
  
  const addLoad = () => {
    setLoads([...loads, { type: 'udl', spanIndex: 0, magnitude: 10, posStart: 0, posEnd: spans[0]?.length || 1000 }]);
  };
  
  const removeLoad = (index) => {
    setLoads(loads.filter((_, i) => i !== index));
  };
  
  const updateLoad = (index, field, value) => {
    const newLoads = [...loads];
    newLoads[index][field] = value;
    setLoads(newLoads);
  };
  
  return (
    <>
      <div className={styles.panelHeader}>
        <h3>Loads (Serviceability)</h3>
      </div>
      <div className={styles.panelBody}>
        {loads.map((load, i) => (
          <div key={i} className={styles.formGroup} style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '1rem', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <label>Load {i+1}</label>
              <button className={styles.deleteBtn} onClick={() => removeLoad(i)}>
                <Trash2 size={16} />
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem' }}>
              <div className={styles.formGroup}>
                <label>Type</label>
                <select value={load.type} onChange={(e) => updateLoad(i, 'type', e.target.value)}>
                  <option value="udl">UDL</option>
                  <option value="point">Point Load</option>
                </select>
              </div>
              <div className={styles.formGroup}>
                <label>Span</label>
                <select value={load.spanIndex} onChange={(e) => updateLoad(i, 'spanIndex', Number(e.target.value))}>
                  {spans.map((_, idx) => (
                    <option key={idx} value={idx}>Span {idx+1}</option>
                  ))}
                </select>
              </div>
              <div className={styles.formGroup}>
                <label>Pos Start (mm)</label>
                <input type="number" value={load.posStart} onChange={(e) => updateLoad(i, 'posStart', Number(e.target.value))} />
              </div>
              <div className={styles.formGroup}>
                <label>Pos End (mm)</label>
                <input type="number" value={load.posEnd || 0} disabled={load.type === 'point'} onChange={(e) => updateLoad(i, 'posEnd', Number(e.target.value))} />
              </div>
              <div className={styles.formGroup}>
                <label>Magnitude</label>
                <input type="number" value={load.magnitude} onChange={(e) => updateLoad(i, 'magnitude', Number(e.target.value))} />
              </div>
            </div>
          </div>
        ))}
        <button className={styles.addBtn} onClick={addLoad}>
          <Plus size={18} /> Add Load
        </button>
      </div>
    </>
  );
}
