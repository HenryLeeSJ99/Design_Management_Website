import { useState, useEffect, useRef } from 'react';
import { FileText, Save } from 'lucide-react';
import styles from './WallFormworkCalculator.module.css';
import StandardChart from '../components/StandardChart';
import { solveRateOfRise, generatePressureChartData, calculatePressureCiria108 } from '../engine/formwork/wallFormwork';
import plytecLogoUrl from '../assets/PLYTEC_Logo.svg';

const getSessionData = (key, defaultValue) => {
  try {
    const val = sessionStorage.getItem(key);
    return val ? JSON.parse(val) : defaultValue;
  } catch (e) {
    return defaultValue;
  }
};

const saveSessionData = (key, data) => {
  try {
    sessionStorage.setItem(key, JSON.stringify(data));
  } catch (e) {}
};

export default function WallFormworkCalculator() {
  const [activeTab, setActiveTab] = useState('calculator');
  const reportRef = useRef(null);

  const handlePrint = () => {
    const content = reportRef.current;
    if (!content) return;
    const printWindow = window.open('', '_blank', 'width=900,height=1200');
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>TempWorks – Concrete Pressure Check Report</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap');
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { font-family: Inter, system-ui, sans-serif; background: #f1f5f9; color: #1e293b; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            @page { margin: 10mm; }
            .report-page {
              background: #fff;
              width: 210mm;
              height: 297mm;
              padding: 24px 30px;
              box-sizing: border-box;
              display: flex;
              flex-direction: column;
              gap: 12px;
              font-size: 11px;
              color: #1e293b;
              page-break-after: always;
              break-after: page;
            }
            @media print {
              body { background: #fff; }
              .report-page {
                height: 270mm !important;
                padding: 5mm !important;
                margin: 0 !important;
                border: none !important;
                box-shadow: none !important;
              }
            }
          </style>
        </head>
        <body>\${content.innerHTML}</body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 400);
  };
  const [boundary, setBoundary] = useState('wall');
  const [concreteType, setConcreteType] = useState('normal'); // normal or retarder
  
  // Inputs
  const [inputMode, setInputMode] = useState('pressure'); // 'pressure' or 'rate'
  const [density, setDensity] = useState(25.0);
  const [temp, setTemp] = useState(15);
  const [pourHeight, setPourHeight] = useState(5.0);
  
  const [maxPressure, setMaxPressure] = useState(60.0);
  const [rateOfRise, setRateOfRise] = useState(2.0);

  // Metadata Inputs
  const [projectId, setProjectId] = useState(() => getSessionData('tempworks_wallformwork_project_id', 'TW-2026-WALL'));
  const [calculatedBy, setCalculatedBy] = useState(() => getSessionData('tempworks_wallformwork_calculated_by', 'Engineer'));
  const [verificationDate, setVerificationDate] = useState(() => getSessionData('tempworks_wallformwork_verification_date', new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })));

  useEffect(() => {
    saveSessionData('tempworks_wallformwork_project_id', projectId);
  }, [projectId]);

  useEffect(() => {
    saveSessionData('tempworks_wallformwork_calculated_by', calculatedBy);
  }, [calculatedBy]);

  useEffect(() => {
    saveSessionData('tempworks_wallformwork_verification_date', verificationDate);
  }, [verificationDate]);

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
        H: Number(pourHeight),
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
        H: Number(pourHeight),
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
  }, [boundary, concreteType, density, temp, pourHeight, maxPressure, rateOfRise, inputMode]);

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
              <span className={styles.fieldLabel}>Pouring / Form height H (m)</span>
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
                  props: { type: 'number', reversed: true }
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
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', width: '100%', paddingBottom: '40px', overflowX: 'auto' }}>
              {/* Configuration Panel */}
              <div style={{
                width: '210mm',
                backgroundColor: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '12px',
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
                boxShadow: '0 4px 15px rgba(0, 0, 0, 0.05)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#0f172a' }}>Report Configuration</h3>
                  <button 
                    onClick={handlePrint}
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
                    <FileText size={16} /> Print Report
                  </button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    <span style={{ fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Project ID</span>
                    <input 
                      type="text" 
                      value={projectId} 
                      onChange={(e) => setProjectId(e.target.value)} 
                      placeholder="e.g. TW-2026-WALL"
                      style={{
                        padding: '8px 12px',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        fontSize: '12px',
                        fontWeight: 500,
                        color: '#1e293b',
                        outline: 'none'
                      }}
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    <span style={{ fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Calculated By</span>
                    <input 
                      type="text" 
                      value={calculatedBy} 
                      onChange={(e) => setCalculatedBy(e.target.value)} 
                      placeholder="e.g. Engineer Name"
                      style={{
                        padding: '8px 12px',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        fontSize: '12px',
                        fontWeight: 500,
                        color: '#1e293b',
                        outline: 'none'
                      }}
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    <span style={{ fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Verification Date</span>
                    <input 
                      type="text" 
                      value={verificationDate} 
                      onChange={(e) => setVerificationDate(e.target.value)} 
                      placeholder="DD MMM YYYY"
                      style={{
                        padding: '8px 12px',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        fontSize: '12px',
                        fontWeight: 500,
                        color: '#1e293b',
                        outline: 'none'
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* A4 Printable Sheet */}
              <div 
                ref={reportRef} 
                style={{
                  width: '210mm',
                  minHeight: '297mm',
                  backgroundColor: '#ffffff',
                  boxShadow: '0 4px 30px rgba(0, 0, 0, 0.15)',
                  border: '1px solid #cbd5e1',
                  padding: '24px 30px',
                  boxSizing: 'border-box',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  fontSize: '11px',
                  color: '#1e293b',
                  fontFamily: 'Inter, system-ui, -apple-system, sans-serif'
                }}
              >
                {/* Header Block */}
                <div style={{ borderBottom: '2.5px solid #2563eb', paddingBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <div style={{ fontSize: '18px', fontWeight: 800, color: '#2563eb', letterSpacing: '0.02em' }}>TEMPWORKS</div>
                    <div style={{ fontSize: '8px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Structural Design Solutions</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                      <span style={{ fontSize: '8px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>System by</span>
                      <img src={plytecLogoUrl} alt="PLYTEC" style={{ height: '16px', width: 'auto', objectFit: 'contain' }} />
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a' }}>Wall Formwork Report - Concrete Pressure</div>
                    <div style={{ fontSize: '8px', color: '#64748b', marginTop: '1px' }}>Standard: CIRIA Report 108:1985</div>
                  </div>
                </div>

                {/* Metadata */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', background: '#f8fafc', padding: '8px 12px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                  <div>
                    <span style={{ color: '#64748b', fontSize: '8px', textTransform: 'uppercase', fontWeight: 700 }}>Project</span>
                    <div style={{ fontWeight: 600, fontSize: '10px' }}>{projectId || 'TW-2026-WALL'}</div>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', fontSize: '8px', textTransform: 'uppercase', fontWeight: 700 }}>Prepared By</span>
                    <div style={{ fontWeight: 600, fontSize: '10px' }}>{calculatedBy || 'Engineer'}</div>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', fontSize: '8px', textTransform: 'uppercase', fontWeight: 700 }}>Date</span>
                    <div style={{ fontWeight: 600, fontSize: '10px' }}>{verificationDate || new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', fontSize: '8px', textTransform: 'uppercase', fontWeight: 700 }}>Status</span>
                    <div style={{ fontWeight: 800, fontSize: '10px', color: '#16a34a' }}>✅ DESIGN OK</div>
                  </div>
                </div>

                {/* Layout Grid: Left Details & Math, Right Chart */}
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '20px', marginTop: '4px' }}>
                  
                  {/* Left Column */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    
                    {/* 1. Design Parameters */}
                    <div>
                      <div style={{ fontSize: '10px', fontWeight: 700, color: '#334155', textTransform: 'uppercase', marginBottom: '4px', borderBottom: '1px solid #cbd5e1', paddingBottom: '2px' }}>
                        1. Design Parameters
                      </div>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
                        <tbody>
                          <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '4px 0', color: '#64748b' }}>Boundary Condition</td>
                            <td style={{ padding: '4px 0', fontWeight: 600, textAlign: 'right' }}>{boundary === 'wall' ? 'Wall / base' : 'Column'} (C₁ = {boundary === 'wall' ? '1.0' : '1.5'})</td>
                          </tr>
                          <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '4px 0', color: '#64748b' }}>Concrete Type</td>
                            <td style={{ padding: '4px 0', fontWeight: 600, textAlign: 'right' }}>{concreteType === 'normal' ? 'Normal (no admixtures)' : 'Retarder'} (C₂ = {concreteType === 'normal' ? '0.3' : '0.45'})</td>
                          </tr>
                          <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '4px 0', color: '#64748b' }}>Density (D)</td>
                            <td style={{ padding: '4px 0', fontWeight: 600, textAlign: 'right' }}>{density} kN/m³</td>
                          </tr>
                          <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '4px 0', color: '#64748b' }}>Placing Temp. (T)</td>
                            <td style={{ padding: '4px 0', fontWeight: 600, textAlign: 'right' }}>{temp} °C</td>
                          </tr>
                          <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '4px 0', color: '#64748b' }}>Pour Height (H)</td>
                            <td style={{ padding: '4px 0', fontWeight: 600, textAlign: 'right' }}>{pourHeight} m</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* 2. Step-by-Step Calculation */}
                    <div>
                      <div style={{ fontSize: '10px', fontWeight: 700, color: '#334155', textTransform: 'uppercase', marginBottom: '4px', borderBottom: '1px solid #cbd5e1', paddingBottom: '2px' }}>
                        2. Calculation Steps & Formula
                      </div>
                      <div style={{ fontSize: '9px', background: '#f8fafc', border: '1px solid #e2e8f0', padding: '6px', borderRadius: '4px', margin: '4px 0' }}>
                        <code style={{ fontWeight: 'bold' }}>Pmax = D [ C₁√R + C₂ K √(H - C₁√R) ]</code>
                      </div>
                      
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '10px' }}>
                        <div>
                          <strong>1. Temperature Coeff. (K):</strong>
                          <div style={{ background: '#f1f5f9', padding: '3px 6px', borderRadius: '4px', fontFamily: 'monospace', marginTop: '2px' }}>
                            K = (36 / ({temp} + 16))² = {Math.pow(36 / (Number(temp) + 16), 2).toFixed(3)}
                          </div>
                        </div>

                        {inputMode === 'pressure' ? (
                          <>
                            <div style={{ marginTop: '2px' }}>
                              <strong>2. Solved Rate of Rise (R):</strong>
                              <div>Target Max Pressure: <strong>{maxPressure} kN/m²</strong></div>
                              <div style={{ background: '#f1f5f9', padding: '3px 6px', borderRadius: '4px', fontFamily: 'monospace', marginTop: '2px' }}>
                                Resulting R = {calculatedRate === Infinity ? 'Infinity (Hydrostatic)' : `${calculatedRate.toFixed(2)} m/h`}
                              </div>
                            </div>
                          </>
                        ) : (
                          <>
                            <div style={{ marginTop: '2px' }}>
                              <strong>2. Evaluate CIRIA Equation:</strong>
                              <div>Pour Rate (R) = <strong>{rateOfRise} m/h</strong></div>
                              <div style={{ background: '#f1f5f9', padding: '3px 6px', borderRadius: '4px', fontFamily: 'monospace', marginTop: '2px' }}>
                                C₁√R = {(boundary === 'wall' ? 1.0 : 1.5).toFixed(1)} × √{rateOfRise} = {((boundary === 'wall' ? 1.0 : 1.5) * Math.sqrt(Number(rateOfRise))).toFixed(2)}
                              </div>
                              <div style={{ marginTop: '2px' }}>
                                {((boundary === 'wall' ? 1.0 : 1.5) * Math.sqrt(Number(rateOfRise))) > Number(pourHeight) ? (
                                  <span style={{ color: '#16a34a', fontWeight: 'bold' }}>C₁√R &gt; H (Hydrostatic envelope governs)</span>
                                ) : (
                                  <span>C₁√R &le; H (CIRIA limit governs)</span>
                                )}
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                  </div>

                  {/* Right Column: Chart */}
                  <div>
                    <div style={{ fontSize: '10px', fontWeight: 700, color: '#334155', textTransform: 'uppercase', marginBottom: '4px', borderBottom: '1px solid #cbd5e1', paddingBottom: '2px' }}>
                      3. Concrete Pressure Envelope
                    </div>
                    <div style={{ background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0', padding: '6px', marginTop: '4px' }}>
                      <StandardChart
                        layout="vertical"
                        data={chartData}
                        areas={[{ dataKey: 'actualPressure', name: 'Design Pressure Area', color: '#3b82f6', fillOpacity: 0.08, type: 'linear' }]}
                        lines={[
                          { dataKey: 'actualPressure', name: 'Design Pressure', color: '#1d4ed8', type: 'linear', dot: false, props: { strokeWidth: 2.5 } },
                          { dataKey: 'hydrostatic', name: 'Hydrostatic (D × h)', color: '#2563eb', type: 'linear', dot: false, props: { strokeWidth: 1.5, strokeDasharray: '3 3' } }
                        ]}
                        xAxis={{ 
                          label: 'p [kN/m²]',
                          domain: [0, (dataMax) => Math.max(100, Math.ceil(dataMax / 50) * 50)],
                          props: { type: 'number', style: { fontSize: '8px' } }
                        }}
                        yAxis={{ 
                          label: 'h [m]', 
                          dataKey: 'height',
                          domain: [0, (dataMax) => Math.max(2, Math.ceil(dataMax))],
                          props: { type: 'number', reversed: true, style: { fontSize: '8px' } }
                        }}
                        referenceLines={[
                          { y: 0, stroke: '#94a3b8', strokeDasharray: '2 2' },
                          { y: Number(pourHeight), stroke: '#94a3b8', strokeDasharray: '2 2' },
                          { x: calculatedPressure, stroke: '#1d4ed8', strokeDasharray: '2 2' }
                        ]}
                        height={230}
                      />
                    </div>
                  </div>

                </div>

                {/* 4. Final Results Summary */}
                <div style={{ marginTop: '6px' }}>
                  <div style={{ fontSize: '10px', fontWeight: 700, color: '#334155', textTransform: 'uppercase', marginBottom: '4px', borderBottom: '1px solid #cbd5e1', paddingBottom: '2px' }}>
                    4. Calculation Summary
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px', marginTop: '4px' }}>
                    <thead>
                      <tr style={{ borderBottom: '1.5px solid #cbd5e1', color: '#475569', fontWeight: 700 }}>
                        <th style={{ padding: '4px', textAlign: 'left' }}>Parameter</th>
                        <th style={{ padding: '4px', textAlign: 'right' }}>Calculated Value</th>
                        <th style={{ padding: '4px', textAlign: 'left', paddingLeft: '20px' }}>Unit</th>
                        <th style={{ padding: '4px', textAlign: 'left' }}>Condition / Note</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '4px', fontWeight: 600 }}>Design Max. Pressure (Pmax)</td>
                        <td style={{ padding: '4px', textAlign: 'right', fontWeight: 700, fontSize: '11px', color: '#0f172a' }}>{calculatedPressure.toFixed(2)}</td>
                        <td style={{ padding: '4px', paddingLeft: '20px', color: '#64748b' }}>kN/m²</td>
                        <td style={{ padding: '4px', color: '#475569' }}>Governing design envelope pressure</td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '4px', fontWeight: 600 }}>Rate of Rise (R)</td>
                        <td style={{ padding: '4px', textAlign: 'right', fontWeight: 700 }}>{calculatedRate === Infinity ? '∞' : calculatedRate.toFixed(2)}</td>
                        <td style={{ padding: '4px', paddingLeft: '20px', color: '#64748b' }}>m/h</td>
                        <td style={{ padding: '4px', color: '#475569' }}>Allowable pouring velocity rate</td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '4px', fontWeight: 600 }}>Hydrostatic Pressure Head (hs)</td>
                        <td style={{ padding: '4px', textAlign: 'right', fontWeight: 700 }}>{hydroHead.toFixed(2)}</td>
                        <td style={{ padding: '4px', paddingLeft: '20px', color: '#64748b' }}>m</td>
                        <td style={{ padding: '4px', color: '#475569' }}>Height above base where fluid envelope ends</td>
                      </tr>
                      <tr style={{ borderBottom: '1.5px solid #cbd5e1' }}>
                        <td style={{ padding: '4px', fontWeight: 600 }}>Minimum Pouring Time (t)</td>
                        <td style={{ padding: '4px', textAlign: 'right', fontWeight: 700 }}>{calculatedRate === Infinity ? 'Instant' : pourTime.toFixed(2)}</td>
                        <td style={{ padding: '4px', paddingLeft: '20px', color: '#64748b' }}>hours</td>
                        <td style={{ padding: '4px', color: '#475569' }}>Time required to safely complete the lift</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* 5. Design Notes */}
                <div style={{ marginTop: 'auto', borderTop: '2.5px solid #cbd5e1', paddingTop: '8px' }}>
                  <div style={{ fontSize: '9px', fontWeight: 700, color: '#334155', textTransform: 'uppercase', marginBottom: '2px' }}>
                    Design Notes & Methodology
                  </div>
                  <ul style={{ fontSize: '9px', color: '#475569', paddingLeft: '12px', margin: '0' }}>
                    <li>Concrete pressure calculated in accordance with the CIRIA Report 108 code rules.</li>
                    <li>Temperature coeff. K accounts for hydration temperature kinetics of concrete mix.</li>
                    <li>Fluid pressure limit (D × H) forms an absolute upper bound to the design pressure envelope.</li>
                    <li>Ensure placing rates, vibration depths, and formwork tie configurations match calculations.</li>
                  </ul>
                </div>

              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
