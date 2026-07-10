import { useState, useEffect } from 'react';
import { FileText, Save } from 'lucide-react';
import styles from './WallFormworkCalculator.module.css';
import StandardChart from '../components/StandardChart';
import { solveRateOfRise, generatePressureChartData, calculatePressureCiria108 } from '../engine/formwork/wallFormwork';

export default function WallFormworkCalculator() {
  const [activeTab, setActiveTab] = useState('calculator');
  const [boundary, setBoundary] = useState('wall');
  const [concreteType, setConcreteType] = useState('normal'); // normal or retarder
  
  // Inputs
  const [inputMode, setInputMode] = useState('pressure'); // 'pressure' or 'rate'
  const [density, setDensity] = useState(25.0);
  const [temp, setTemp] = useState(15);
  const [formHeight, setFormHeight] = useState(5.0);
  const [pourHeight, setPourHeight] = useState(5.0);
  
  const [maxPressure, setMaxPressure] = useState(60.0);
  const [rateOfRise, setRateOfRise] = useState(2.0);

  // Results
  const [calculatedPressure, setCalculatedPressure] = useState(0);
  const [calculatedRate, setCalculatedRate] = useState(0);
  const [hydroHead, setHydroHead] = useState(0);
  const [pourTime, setPourTime] = useState(0);
  const [chartData, setChartData] = useState([]);

  useEffect(() => {
    // Calculate values
    const C1 = boundary === 'wall' ? 1.0 : 1.5;
    const C2 = concreteType === 'normal' ? 0.3 : 0.45;
    
    let R_val = 0;
    let P_val = 0;

    if (inputMode === 'pressure') {
      const R = solveRateOfRise({
        D: Number(density),
        T: Number(temp),
        H: Number(formHeight),
        h: Number(pourHeight),
        P_target: Number(maxPressure),
        C1,
        C2
      });
      R_val = R === Infinity ? 0 : R;
      P_val = Number(maxPressure);
    } else {
      R_val = Number(rateOfRise);
      P_val = calculatePressureCiria108({
        D: Number(density),
        T: Number(temp),
        H: Number(formHeight),
        h: Number(pourHeight),
        R: R_val,
        C1,
        C2
      });
    }

    setCalculatedRate(R_val);
    setCalculatedPressure(P_val);

    const h_s = P_val / Number(density);
    setHydroHead(h_s);

    const t = R_val > 0 ? Number(pourHeight) / R_val : 0;
    setPourTime(t);

    setChartData(generatePressureChartData(P_val, Number(pourHeight), Number(density)));
  }, [boundary, concreteType, density, temp, formHeight, pourHeight, maxPressure, rateOfRise, inputMode]);

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      return (
        <div style={{ backgroundColor: 'white', padding: '10px', border: '1px solid #ccc', borderRadius: '4px' }}>
          <p style={{ margin: 0 }}><strong>Pressure:</strong> {payload[0].payload.pressure.toFixed(1)} kN/m²</p>
          <p style={{ margin: 0 }}><strong>Height:</strong> {payload[0].payload.height.toFixed(2)} m</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className={styles.pageContainer}>
      <header className={styles.pageHeader}>
        <div className={styles.titleBlock}>
          <h1>Formwork Load Calculator</h1>
          <p>based on CIRIA Report 108:1985</p>
        </div>
        <div className={styles.headerActions}>
          <button className={styles.btnSecondary}>
            <Save size={16} /> Save
          </button>
        </div>
      </header>

      <div className={styles.mainGrid}>
        {/* Left Sidebar */}
        <div className={styles.sidebarPanel}>
          <div className={styles.card}>
            <div className={styles.cardHeader}>Standard Selection</div>
            <div className={styles.fieldRow}>
              <span className={styles.fieldLabel}>Standard</span>
              <select className={styles.selectInput} style={{ width: 'auto', marginBottom: 0 }}>
                <option>CIRIA Report 108:1985</option>
              </select>
            </div>
          </div>

          <div className={styles.card}>
            <div className={styles.cardHeader}>Boundary Conditions</div>
            
            <div className={styles.radioGroup} style={{ marginBottom: '1rem' }}>
              <label className={styles.radioLabel}>
                <input type="radio" name="boundary" checked={boundary === 'wall'} onChange={() => setBoundary('wall')} /> Wall / base
              </label>
              <label className={styles.radioLabel}>
                <input type="radio" name="boundary" checked={boundary === 'column'} onChange={() => setBoundary('column')} /> Column
              </label>
            </div>

            <div className={styles.fieldRow}>
              <span className={styles.fieldLabel}>Concrete type</span>
              <select className={styles.selectInput} style={{ width: 'auto', marginBottom: 0 }} value={concreteType} onChange={(e) => setConcreteType(e.target.value)}>
                <option value="normal">(iv) Concrete without admixtures</option>
                <option value="retarder">Concrete with retarder</option>
              </select>
            </div>

            <div className={styles.fieldRow}>
              <span className={styles.fieldLabel}>Concrete specific weight D (kN/m³)</span>
              <input type="number" step="0.1" className={styles.fieldInput} value={density} onChange={(e) => setDensity(e.target.value)} />
            </div>
            
            <div className={styles.fieldRow}>
              <span className={styles.fieldLabel}>Placing temperature T (°C)</span>
              <input type="number" step="1" className={styles.fieldInput} value={temp} onChange={(e) => setTemp(e.target.value)} />
            </div>

            <div className={styles.fieldRow}>
              <span className={styles.fieldLabel}>Vertical form height H (m)</span>
              <input type="number" step="0.1" className={styles.fieldInput} value={formHeight} onChange={(e) => setFormHeight(e.target.value)} />
            </div>

            <div className={styles.fieldRow}>
              <span className={styles.fieldLabel}>Pouring height h (m)</span>
              <input type="number" step="0.1" className={styles.fieldInput} value={pourHeight} onChange={(e) => setPourHeight(e.target.value)} />
            </div>
          </div>

          <div className={styles.card}>
            <div className={styles.cardHeader}>Target Input</div>
            
            <div className={styles.radioGroup} style={{ marginBottom: '1rem' }}>
              <label className={styles.radioLabel}>
                <input type="radio" checked={inputMode === 'pressure'} onChange={() => setInputMode('pressure')} /> Max Pressure
              </label>
              <label className={styles.radioLabel}>
                <input type="radio" checked={inputMode === 'rate'} onChange={() => setInputMode('rate')} /> Rate of Pour
              </label>
            </div>

            {inputMode === 'pressure' ? (
              <div className={styles.fieldRow}>
                <span className={styles.fieldLabel}>Target Pmax (kN/m²)</span>
                <input type="number" step="0.1" className={styles.fieldInput} value={maxPressure} onChange={(e) => setMaxPressure(e.target.value)} />
              </div>
            ) : (
              <div className={styles.fieldRow}>
                <span className={styles.fieldLabel}>Target Rate R (m/h)</span>
                <input type="number" step="0.1" className={styles.fieldInput} value={rateOfRise} onChange={(e) => setRateOfRise(e.target.value)} />
              </div>
            )}
          </div>
        </div>

        {/* Right Content */}
        <div className={styles.mainContent}>
          <div className={styles.tabsContainer}>
            <div className={styles.tabs}>
              <button 
                className={`${styles.tab} ${activeTab === 'calculator' ? styles.active : ''}`}
                onClick={() => setActiveTab('calculator')}
              >
                Calculator UI
              </button>
              <button 
                className={`${styles.tab} ${activeTab === 'report' ? styles.active : ''}`}
                onClick={() => setActiveTab('report')}
              >
                Engineering Audit Report
              </button>
            </div>
          </div>

          {activeTab === 'calculator' && (
            <div className={styles.card}>
            <div className={styles.cardHeader} style={{ marginBottom: '1rem' }}>Results</div>
            <div className={styles.resultsGrid}>
              {inputMode === 'pressure' ? (
                <div className={styles.resultBox}>
                  <span className={styles.resultLabel}>Calculated Max. Rate of rise R (m/h)</span>
                  <span className={styles.resultValue}>{calculatedRate === Infinity ? '∞' : calculatedRate.toFixed(2)}</span>
                </div>
              ) : (
                <div className={styles.resultBox}>
                  <span className={styles.resultLabel}>Calculated Max. Pressure Pmax (kN/m²)</span>
                  <span className={styles.resultValue}>{calculatedPressure.toFixed(2)}</span>
                </div>
              )}
              <div className={styles.resultBox}>
                <span className={styles.resultLabel}>Hydrostatic pressure head hs (m)</span>
                <span className={styles.resultValue}>{hydroHead.toFixed(2)}</span>
              </div>
              <div className={styles.resultBox} style={{ gridColumn: 'span 2' }}>
                <span className={styles.resultLabel}>Minimum pouring time t (h)</span>
                <span className={styles.resultValue}>{pourTime === 0 && calculatedRate === Infinity ? 'Instant' : pourTime.toFixed(2)}</span>
              </div>
            </div>

            <h3 style={{ fontSize: '1rem', color: '#334155', marginBottom: '1rem', marginTop: '2rem' }}>Concrete Pressure Distribution</h3>
            <div className={styles.chartContainer}>
              <StandardChart
                layout="vertical"
                data={chartData}
                areas={[{ dataKey: 'actualPressure', name: 'Design Pressure Area', color: '#3b82f6', fillOpacity: 0.08, type: 'linear' }]}
                lines={[
                  { dataKey: 'actualPressure', name: 'Design Concrete Pressure', color: '#1d4ed8', type: 'linear', dot: false, props: { strokeWidth: 3 } },
                  { dataKey: 'hydrostatic', name: 'Hydrostatic Concrete Pressure (D × h)', color: '#2563eb', type: 'linear', dot: false, props: { strokeWidth: 2, strokeDasharray: '4 4' } }
                ]}
                xAxis={{ 
                  label: 'p [kN/m²]',
                  domain: [0, (dataMax) => Math.max(100, Math.ceil(dataMax / 50) * 50)],
                  props: { type: 'number' }
                }}
                yAxis={{ 
                  label: 'h [m]', 
                  dataKey: 'height',
                  domain: [0, (dataMax) => Math.max(2, Math.ceil(dataMax))],
                  props: { type: 'number', reversed: false }
                }}
                referenceLines={[
                  { y: 0, stroke: '#64748b', strokeDasharray: '3 3', label: 'Base (y=0)' },
                  { y: Number(pourHeight), stroke: '#64748b', strokeDasharray: '3 3', label: 'Top of Pour (y=h)' },
                  { y: Number(pourHeight) - Math.min(Number(pourHeight), hydroHead), stroke: '#1d4ed8', strokeDasharray: '3 3', label: 'Hydrostatic Limit Head (hs)' },
                  { x: calculatedPressure, stroke: '#1d4ed8', strokeDasharray: '3 3', label: `Pmax = ${calculatedPressure.toFixed(1)}` },
                  { x: Number(density) * Number(pourHeight), stroke: '#2563eb', strokeDasharray: '3 3', label: 'Concrete Hydrostatic (Base)' }
                ]}
                height={500}
              />
            </div>
          </div>
          )}

          {activeTab === 'report' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', width: '100%', paddingBottom: '40px' }}>
              <div style={{ width: '100%', maxWidth: '800px', display: 'flex', justifyContent: 'flex-end' }}>
                <button 
                  onClick={() => window.print()}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    backgroundColor: 'var(--primary)',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '999px',
                    padding: '10px 24px',
                    fontSize: '14px',
                    fontWeight: '800',
                    cursor: 'pointer',
                    boxShadow: '0 4px 14px rgba(37, 99, 235, 0.2)',
                    transition: 'transform 160ms cubic-bezier(0.23, 1, 0.32, 1)'
                  }}
                  onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.97)'}
                  onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
                >
                  <FileText size={16} /> Export PDF
                </button>
              </div>
              <div className={styles.card} style={{ maxWidth: '800px', width: '100%', backgroundColor: '#fff', padding: '2.5rem', fontFamily: 'serif', lineHeight: 1.6 }}>
                <h2 style={{ borderBottom: '2px solid #cbd5e1', paddingBottom: '0.5rem', marginBottom: '1.5rem', fontSize: '1.5rem' }}>
                  Engineering Audit Report
                </h2>
                <p style={{ fontStyle: 'italic', color: '#64748b' }}>Concrete Pressure on Formwork — CIRIA Report 108:1985</p>

              <h3 style={{ marginTop: '2rem', fontSize: '1.1rem' }}>1. Design Parameters</h3>
              <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <li><strong>Boundary Condition:</strong> {boundary === 'wall' ? 'Wall / base' : 'Column'} (C₁ = {boundary === 'wall' ? '1.0' : '1.5'})</li>
                <li><strong>Concrete Type:</strong> {concreteType === 'normal' ? 'Normal without admixtures' : 'Retarder'} (C₂ = {concreteType === 'normal' ? '0.3' : '0.45'})</li>
                <li><strong>Density (D):</strong> {density} kN/m³</li>
                <li><strong>Temperature (T):</strong> {temp} °C</li>
                <li><strong>Form Height (H):</strong> {formHeight} m</li>
                <li><strong>Pour Height (h):</strong> {pourHeight} m</li>
              </ul>

              <h3 style={{ marginTop: '2rem', fontSize: '1.1rem' }}>2. CIRIA 108 Formula</h3>
              <div style={{ backgroundColor: '#f8fafc', padding: '1rem', border: '1px solid #e2e8f0', borderRadius: '4px', textAlign: 'center', margin: '1rem 0' }}>
                <code style={{ fontSize: '1.1rem' }}>P_max = D [ C₁√R + C₂ K √(H - C₁√R) ]</code>
                <p style={{ marginTop: '0.5rem', fontSize: '0.9rem' }}>or fluid pressure (D × h), whichever is smaller.</p>
                <p style={{ fontSize: '0.9rem' }}>where K = (36 / (T + 16))²</p>
              </div>

              <h3 style={{ marginTop: '2rem', fontSize: '1.1rem' }}>3. Step-by-Step Calculation</h3>
              {inputMode === 'pressure' ? (
                <>
                  <p><strong>Goal:</strong> Determine allowable Rate of Rise (R) for Target P_max = {maxPressure} kN/m².</p>
                  <p>1. Calculate Temperature Coefficient (K):</p>
                  <pre style={{ background: '#f1f5f9', padding: '0.5rem' }}>K = (36 / ({temp} + 16))² = {Math.pow(36 / (Number(temp) + 16), 2).toFixed(3)}</pre>
                  <p>2. Iteratively solve for R using the bisection method:</p>
                  <pre style={{ background: '#f1f5f9', padding: '0.5rem' }}>Result R = {calculatedRate === Infinity ? 'Infinity (Hydrostatic)' : calculatedRate.toFixed(3)} m/h</pre>
                </>
              ) : (
                <>
                  <p><strong>Goal:</strong> Determine Max Pressure (P_max) for Rate of Rise R = {rateOfRise} m/h.</p>
                  <p>1. Calculate Temperature Coefficient (K):</p>
                  <pre style={{ background: '#f1f5f9', padding: '0.5rem' }}>K = (36 / ({temp} + 16))² = {Math.pow(36 / (Number(temp) + 16), 2).toFixed(3)}</pre>
                  
                  <p>2. Calculate √R term:</p>
                  <pre style={{ background: '#f1f5f9', padding: '0.5rem' }}>√R = √{rateOfRise} = {Math.sqrt(Number(rateOfRise)).toFixed(3)}</pre>

                  <p>3. Evaluate condition C₁√R {'>'} H:</p>
                  <pre style={{ background: '#f1f5f9', padding: '0.5rem' }}>{boundary === 'wall' ? '1.0' : '1.5'} × {Math.sqrt(Number(rateOfRise)).toFixed(3)} = {((boundary === 'wall' ? 1.0 : 1.5) * Math.sqrt(Number(rateOfRise))).toFixed(3)}</pre>
                  {((boundary === 'wall' ? 1.0 : 1.5) * Math.sqrt(Number(rateOfRise))) > Number(formHeight) ? (
                    <p style={{ color: 'red' }}>Condition C₁√R {'>'} H is met. Design pressure is fully fluid.</p>
                  ) : (
                    <p>Condition is not met. Applying CIRIA equation.</p>
                  )}

                  <p>4. Resulting Pressure P_max:</p>
                  <pre style={{ background: '#f1f5f9', padding: '0.5rem' }}>P_calc = {calculatedPressure.toFixed(2)} kN/m²</pre>
                </>
              )}

              <h3 style={{ marginTop: '2rem', fontSize: '1.1rem' }}>4. Final Results Summary</h3>
              <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '1rem' }}>
                <tbody>
                  <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '0.5rem' }}>Max Concrete Pressure (P_max)</td>
                    <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: 'bold' }}>{calculatedPressure.toFixed(2)} kN/m²</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '0.5rem' }}>Rate of Rise (R)</td>
                    <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: 'bold' }}>{calculatedRate === Infinity ? '∞' : calculatedRate.toFixed(2)} m/h</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '0.5rem' }}>Hydrostatic Head (hs)</td>
                    <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: 'bold' }}>{hydroHead.toFixed(2)} m</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          )}
        </div>
      </div>
    </div>
  );
}
