import { useState, useEffect, useRef } from 'react';
import { Save, FileText, Play, CheckCircle, XCircle, AlertTriangle, Info, Layers, Grid, Columns, Rows, ArrowUpDown } from 'lucide-react';
import { calculateSlabFormwork } from '../engine/formwork/slabFormwork.js';
import styles from './SlabFormworkCalculator.module.css';
import slabDiagram from '../assets/slab-diagram.png';
import DynamicBeamDiagram from '../calculators/MultiSpanBeam/DynamicBeamDiagram';
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

export default function SlabFormworkCalculator() {
  const initialInputs = getSessionData('tempworks_slabformwork_inputs', {
    slabThickness: 200,
    unitWeight: 25,
    panelType: 'WONDERBoard MG Series',
    panelThickness: '12 mm',
    panelDirection: 'Perpendicular to Secondary Beam',
    secondaryBeamType: 'WONDERBeam Alpha-Beam',
    secondarySpacing: 0.4,
    secondarySpanCount: 3,
    primaryBeamType: 'WONDERBeam Alpha-Beam',
    primarySpacing: 1.5,
    primarySpanCount: 3,
    primarySpanLength: 1.5, // Replaces towerGrid
    shoringSystem: 'tower', // tower or prop
    shoringType: 'WonderCrab M',
    towerHeight: 3,
    deflectionLimit: 360,
  });

  const [activeTab, setActiveTab] = useState(() => getSessionData('tempworks_slabformwork_active_tab', 'configuration'));
  const [activeMarker, setActiveMarker] = useState('slab'); // Which diagram marker is clicked

  const sectionRefs = {
    slab: useRef(null),
    panel: useRef(null),
    secondary: useRef(null),
    primary: useRef(null),
    shoring: useRef(null),
  };

  useEffect(() => {
    if (activeMarker && sectionRefs[activeMarker]?.current) {
      sectionRefs[activeMarker].current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    }
  }, [activeMarker]);

  const [slabThickness, setSlabThickness] = useState(initialInputs.slabThickness);
  const [unitWeight, setUnitWeight] = useState(initialInputs.unitWeight);
  const [panelType, setPanelType] = useState(initialInputs.panelType);
  const [panelThickness, setPanelThickness] = useState(initialInputs.panelThickness);
  const [panelDirection, setPanelDirection] = useState(initialInputs.panelDirection);
  const [secondaryBeamType, setSecondaryBeamType] = useState(initialInputs.secondaryBeamType);
  const [secondarySpacing, setSecondarySpacing] = useState(initialInputs.secondarySpacing);
  const [secondarySpanCount, setSecondarySpanCount] = useState(initialInputs.secondarySpanCount);
  const [primaryBeamType, setPrimaryBeamType] = useState(initialInputs.primaryBeamType);
  const [primarySpacing, setPrimarySpacing] = useState(initialInputs.primarySpacing);
  const [primarySpanCount, setPrimarySpanCount] = useState(initialInputs.primarySpanCount);
  const [primarySpanLength, setPrimarySpanLength] = useState(initialInputs.primarySpanLength);
  const [shoringSystem, setShoringSystem] = useState(initialInputs.shoringSystem);
  const [shoringType, setShoringType] = useState(initialInputs.shoringType);
  const [towerHeight, setTowerHeight] = useState(initialInputs.towerHeight);
  const [deflectionLimit, setDeflectionLimit] = useState(initialInputs.deflectionLimit || 360);

  const [projectId, setProjectId] = useState(() => getSessionData('tempworks_slabformwork_project_id', 'TW-2026-SLAB'));
  const [calculatedBy, setCalculatedBy] = useState(() => getSessionData('tempworks_slabformwork_calculated_by', 'Engineer'));
  const [verificationDate, setVerificationDate] = useState(() => getSessionData('tempworks_slabformwork_verification_date', new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })));

  useEffect(() => {
    saveSessionData('tempworks_slabformwork_project_id', projectId);
  }, [projectId]);

  useEffect(() => {
    saveSessionData('tempworks_slabformwork_calculated_by', calculatedBy);
  }, [calculatedBy]);

  useEffect(() => {
    saveSessionData('tempworks_slabformwork_verification_date', verificationDate);
  }, [verificationDate]);

  const [results, setResults] = useState(() => getSessionData('tempworks_slabformwork_results', null));
  const [calcError, setCalcError] = useState(null);

  useEffect(() => {
    const savedInputs = getSessionData('tempworks_slabformwork_inputs', null);
    const currentInputs = {
      slabThickness, unitWeight, panelType, panelThickness, panelDirection,
      secondaryBeamType, secondarySpacing, secondarySpanCount,
      primaryBeamType, primarySpacing, primarySpanCount, primarySpanLength,
      shoringSystem, shoringType, towerHeight, deflectionLimit
    };

    if (savedInputs && JSON.stringify(currentInputs) === JSON.stringify(savedInputs)) return;

    setResults(null);
    sessionStorage.removeItem('tempworks_slabformwork_results');
    saveSessionData('tempworks_slabformwork_inputs', currentInputs);
  }, [
    slabThickness, unitWeight, panelType, panelThickness, panelDirection,
    secondaryBeamType, secondarySpacing, secondarySpanCount,
    primaryBeamType, primarySpacing, primarySpanCount, primarySpanLength,
    shoringSystem, shoringType, towerHeight, deflectionLimit
  ]);

  useEffect(() => {
    saveSessionData('tempworks_slabformwork_active_tab', activeTab);
  }, [activeTab]);

  const handleCalculate = () => {
    try {
      setCalcError(null);
      // Auto-calculate grid spacing based on primary beam span length and spacing
      const gridX = Number(primarySpacing);
      const gridY = Number(primarySpanLength);

      const res = calculateSlabFormwork({
        slabThickness: Number(slabThickness),
        concreteDensity: Number(unitWeight),
        panelType,
        panelThickness,
        panelSpanCount: 3, // Always multi-span
        panelDirection,
        secondaryBeamType,
        secondarySpacing: Number(secondarySpacing),
        secondarySpanCount: Number(secondarySpanCount),
        primaryBeamType,
        primarySpacing: Number(primarySpacing),
        primarySpanCount: Number(primarySpanCount),
        shoringType: shoringType, // Use actual tower or prop
        towerHeight: Number(towerHeight),
        towerGridX: gridX,
        towerGridY: gridY,
        deflLimitRatio: Number(deflectionLimit),
      });
      setResults(res);
      saveSessionData('tempworks_slabformwork_results', res);
      setActiveTab('results');
    } catch (err) {
      setCalcError(err.message);
      console.error('Calculation error:', err);
    }
  };

  return (
    <div className={styles.pageContainer}>
      <header className={styles.pageHeader}>
        <div className={styles.titleBlock}>
          <h1>Slab Formwork Check</h1>
          <p>Design and verify your slab formwork system</p>
        </div>
        <div className={styles.headerActions}>
          <button className={styles.btnCalculate} onClick={handleCalculate}>
            <Play size={16} fill="currentColor" /> Calculate
          </button>
        </div>
      </header>

      {calcError && (
        <div className={styles.errorBanner}>
          <AlertTriangle size={16} /> {calcError}
        </div>
      )}

      <div className={styles.tabsWrapper}>
        <div className={styles.tabs}>
          <div
            className={`${styles.tab} ${activeTab === 'configuration' ? styles.active : ''}`}
            onClick={() => setActiveTab('configuration')}
          >
            System Configuration
          </div>
          <div
            className={`${styles.tab} ${activeTab === 'results' ? styles.active : ''}`}
            onClick={() => setActiveTab('results')}
          >
            Check Results
          </div>
          <div
            className={`${styles.tab} ${activeTab === 'report' ? styles.active : ''}`}
            onClick={() => setActiveTab('report')}
          >
            Report
          </div>
        </div>
      </div>

      <div className={styles.contentArea}>
        {activeTab === 'configuration' && (
          <div className={styles.diagramLayout}>
            {/* Interactive SVG Diagram Area */}
            <div className={styles.interactiveDiagramContainer}>
              <InteractiveDiagram 
                activeMarker={activeMarker}
                setActiveMarker={setActiveMarker}
                slabThickness={slabThickness}
                secondarySpacing={secondarySpacing}
                primarySpacing={primarySpacing}
                primarySpanLength={primarySpanLength}
                secondaryBeamType={secondaryBeamType}
                primaryBeamType={primaryBeamType}
                panelType={panelType}
                shoringType={shoringType}
              />
            </div>

            {/* Contextual Input Panel */}
            <div className={styles.inputPanel}>
              <div className={styles.card}>
                <div className={styles.cardHeader}>Configuration details</div>
                
                <div className={styles.formContainer}>
                  {/* Slab Properties */}
                  <div
                    ref={sectionRefs.slab}
                    className={`${styles.formSection} ${activeMarker === 'slab' ? styles.activeSection : ''}`}
                    onClick={() => setActiveMarker('slab')}
                  >
                    <div className={styles.sectionHeader}>
                      <Layers size={16} className={styles.sectionIcon} />
                      <h3 className={styles.panelTitle}>Slab Properties</h3>
                    </div>
                    <div className={styles.formStack}>
                      <label className={styles.fieldInline}>
                        <span>Slab Thickness</span>
                        <div className={styles.unitInput}>
                          <input
                            type="number"
                            value={slabThickness}
                            onChange={(e) => setSlabThickness(e.target.value)}
                            onFocus={() => setActiveMarker('slab')}
                          />
                          <span>mm</span>
                        </div>
                      </label>
                      <label className={styles.fieldInline}>
                        <span>Concrete Unit Weight</span>
                        <div className={styles.unitInput}>
                          <input
                            type="number"
                            value={unitWeight}
                            onChange={(e) => setUnitWeight(e.target.value)}
                            onFocus={() => setActiveMarker('slab')}
                          />
                          <span>kN/m³</span>
                        </div>
                      </label>
                      <label className={styles.fieldInline}>
                        <span>Deflection Limit</span>
                        <select 
                          value={deflectionLimit} 
                          onChange={(e) => setDeflectionLimit(Number(e.target.value))}
                          style={{ width: '120px', padding: '4px 8px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                        >
                          <option value={200}>L / 200</option>
                          <option value={270}>L / 270</option>
                          <option value={360}>L / 360</option>
                          <option value={400}>L / 400</option>
                          <option value={500}>L / 500</option>
                        </select>
                      </label>
                    </div>
                  </div>

                  {/* Formwork Panel */}
                  <div
                    ref={sectionRefs.panel}
                    className={`${styles.formSection} ${activeMarker === 'panel' ? styles.activeSection : ''}`}
                    onClick={() => setActiveMarker('panel')}
                  >
                    <div className={styles.sectionHeader}>
                      <Grid size={16} className={styles.sectionIcon} />
                      <h3 className={styles.panelTitle}>Formwork Panel</h3>
                    </div>
                    <div className={styles.formStack}>
                      <label className={styles.field}>
                        <span>Panel Type</span>
                        <select
                          value={panelType}
                          onChange={(e) => setPanelType(e.target.value)}
                          onFocus={() => setActiveMarker('panel')}
                        >
                          <option>WONDERBoard MG Series</option>
                          <option>Plywood 18 mm</option>
                          <option>Phenolic Board</option>
                        </select>
                      </label>
                      <label className={styles.field}>
                        <span>Panel Thickness</span>
                        <select
                          value={panelThickness}
                          onChange={(e) => setPanelThickness(e.target.value)}
                          onFocus={() => setActiveMarker('panel')}
                        >
                          <option>12 mm</option>
                          <option>15 mm</option>
                          <option>18 mm</option>
                        </select>
                      </label>
                      <label className={styles.field}>
                        <span>Panel Direction</span>
                        <select
                          value={panelDirection}
                          onChange={(e) => setPanelDirection(e.target.value)}
                          onFocus={() => setActiveMarker('panel')}
                        >
                          <option>Perpendicular to Secondary Beam</option>
                          <option>Parallel to Secondary Beam</option>
                        </select>
                      </label>
                      <p className={styles.noteText}>* Panel assumed as multi-span configuration.</p>
                    </div>
                  </div>

                  {/* Secondary Beams */}
                  <div
                    ref={sectionRefs.secondary}
                    className={`${styles.formSection} ${activeMarker === 'secondary' ? styles.activeSection : ''}`}
                    onClick={() => setActiveMarker('secondary')}
                  >
                    <div className={styles.sectionHeader}>
                      <Columns size={16} className={styles.sectionIcon} />
                      <h3 className={styles.panelTitle}>Secondary Beams</h3>
                    </div>
                    <div className={styles.formStack}>
                      <label className={styles.field}>
                        <span>Beam Type</span>
                        <select
                          value={secondaryBeamType}
                          onChange={(e) => setSecondaryBeamType(e.target.value)}
                          onFocus={() => setActiveMarker('secondary')}
                        >
                          <option>WONDERBeam Alpha-Beam</option>
                          <option>Timber H20 Beam</option>
                          <option>Aluminium Joist</option>
                        </select>
                      </label>
                      <label className={styles.field}>
                        <span>Span Configuration</span>
                        <select
                          value={secondarySpanCount}
                          onChange={(e) => setSecondarySpanCount(Number(e.target.value))}
                          onFocus={() => setActiveMarker('secondary')}
                        >
                          <option value={1}>Single Span</option>
                          <option value={2}>Two Span</option>
                          <option value={3}>Three Span and above</option>
                        </select>
                      </label>
                      <label className={styles.fieldInline}>
                        <span>Spacing (C/C)</span>
                        <div className={styles.unitInput}>
                          <input
                            type="number"
                            step="0.05"
                            value={secondarySpacing}
                            onChange={(e) => setSecondarySpacing(e.target.value)}
                            onFocus={() => setActiveMarker('secondary')}
                          />
                          <span>m</span>
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* Primary Beams */}
                  <div
                    ref={sectionRefs.primary}
                    className={`${styles.formSection} ${activeMarker === 'primary' ? styles.activeSection : ''}`}
                    onClick={() => setActiveMarker('primary')}
                  >
                    <div className={styles.sectionHeader}>
                      <Rows size={16} className={styles.sectionIcon} />
                      <h3 className={styles.panelTitle}>Primary Beams</h3>
                    </div>
                    <div className={styles.formStack}>
                      <label className={styles.field}>
                        <span>Beam Type</span>
                        <select
                          value={primaryBeamType}
                          onChange={(e) => setPrimaryBeamType(e.target.value)}
                          onFocus={() => setActiveMarker('primary')}
                        >
                          <option>WONDERBeam Alpha-Beam</option>
                          <option>Timber H20 Beam</option>
                          <option>Aluminium Joist</option>
                        </select>
                      </label>
                      <label className={styles.field}>
                        <span>Span Configuration</span>
                        <select
                          value={primarySpanCount}
                          onChange={(e) => setPrimarySpanCount(Number(e.target.value))}
                          onFocus={() => setActiveMarker('primary')}
                        >
                          <option value={1}>Single Span</option>
                          <option value={2}>Two Span</option>
                          <option value={3}>Three Span and above</option>
                        </select>
                      </label>
                      <label className={styles.fieldInline}>
                        <span>Spacing (C/C)</span>
                        <div className={styles.unitInput}>
                          <input
                            type="number"
                            step="0.1"
                            value={primarySpacing}
                            onChange={(e) => setPrimarySpacing(e.target.value)}
                            onFocus={() => setActiveMarker('primary')}
                          />
                          <span>m</span>
                        </div>
                      </label>
                      <label className={styles.fieldInline}>
                        <span>Support Span Length</span>
                        <div className={styles.unitInput}>
                          <input
                            type="number"
                            step="0.1"
                            value={primarySpanLength}
                            onChange={(e) => setPrimarySpanLength(e.target.value)}
                            onFocus={() => setActiveMarker('primary')}
                          />
                          <span>m</span>
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* Shoring System */}
                  <div
                    ref={sectionRefs.shoring}
                    className={`${styles.formSection} ${activeMarker === 'shoring' ? styles.activeSection : ''}`}
                    onClick={() => setActiveMarker('shoring')}
                  >
                    <div className={styles.sectionHeader}>
                      <ArrowUpDown size={16} className={styles.sectionIcon} />
                      <h3 className={styles.panelTitle}>Shoring System</h3>
                    </div>
                    <div className={styles.formStack}>
                      <div className={styles.radioGroup} style={{ marginBottom: '1rem' }}>
                        <label className={styles.radioLabel}>
                          <input
                            type="radio"
                            checked={shoringSystem === 'tower'}
                            onChange={() => { setShoringSystem('tower'); setShoringType('WonderCrab M'); }}
                            onFocus={() => setActiveMarker('shoring')}
                          /> Tower
                        </label>
                        <label className={styles.radioLabel}>
                          <input
                            type="radio"
                            checked={shoringSystem === 'prop'}
                            onChange={() => { setShoringSystem('prop'); setShoringType('Prop'); }}
                            onFocus={() => setActiveMarker('shoring')}
                          /> Prop
                        </label>
                      </div>

                      <label className={styles.field}>
                        <span>Shoring Type</span>
                        <select
                          value={shoringType}
                          onChange={(e) => setShoringType(e.target.value)}
                          onFocus={() => setActiveMarker('shoring')}
                        >
                          {shoringSystem === 'tower' ? (
                            <>
                              <option>WonderCrab M</option>
                              <option>Ringlock Tower</option>
                              <option>Frame Tower</option>
                            </>
                          ) : (
                            <>
                              <option>Prop (Light duty)</option>
                              <option>Prop (Heavy duty)</option>
                            </>
                          )}
                        </select>
                      </label>


                      <label className={styles.fieldInline}>
                        <span>Height</span>
                        <div className={styles.unitInput}>
                          <input
                            type="number"
                            step="0.1"
                            value={towerHeight}
                            onChange={(e) => setTowerHeight(e.target.value)}
                            onFocus={() => setActiveMarker('shoring')}
                          />
                          <span>m</span>
                        </div>
                      </label>

                      <div className={styles.infoBox}>
                        Grid spacing derived: <strong>{primarySpacing} m × {primarySpanLength} m</strong>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'results' && (
          <ResultsTab results={results} />
        )}

        {activeTab === 'report' && (
          results ? (
            <SlabPDFReportPreview 
              results={results} 
              inputs={{
                slabThickness, unitWeight, panelType, panelThickness, panelDirection,
                secondaryBeamType, secondarySpacing, secondarySpanCount,
                primaryBeamType, primarySpacing, primarySpanCount, primarySpanLength,
                shoringSystem, shoringType, towerHeight
              }} 
              projectId={projectId}
              setProjectId={setProjectId}
              calculatedBy={calculatedBy}
              setCalculatedBy={setCalculatedBy}
              verificationDate={verificationDate}
              setVerificationDate={setVerificationDate}
            />
          ) : (
            <div className={styles.card} style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>📋</div>
              <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>No Report Preview Available</div>
              <div style={{ fontSize: 13 }}>Click <strong>Calculate</strong> in the header to run the analysis first.</div>
            </div>
          )
        )}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Interactive Diagram Component
// ────────────────────────────────────────────────────────────────────────────
function InteractiveDiagram({ activeMarker, setActiveMarker, slabThickness, secondarySpacing, primarySpacing, primarySpanLength, secondaryBeamType, primaryBeamType, panelType, shoringType, resultsOverlay }) {
  const r = resultsOverlay;
  
  return (
    <div className={styles.diagramWrapper}>
      {/* A stylized SVG isometric representation of the formwork system */}
      <svg viewBox="0 0 800 600" className={styles.svgDiagram}>
        <image href={slabDiagram} x="0" y="0" width="800" height="600" preserveAspectRatio="xMidYMid meet" />

        {/* Markers overlaid on the image */}
        {/* Slab Thickness / Panel (Right edge) */}
        <Marker x="680" y="160" active={activeMarker === 'slab'} onClick={() => setActiveMarker && setActiveMarker('slab')} text={r && r.panel && r.panel.utilization != null ? `Panel Util: ${(r.panel.utilization * 100).toFixed(2)}%` : `Slab: ${slabThickness} mm`} utilRatio={r?.panel?.utilization} />
        
        {/* Distance between Secondary Beams (Top center) */}
        <Marker x="460" y="140" active={activeMarker === 'secondary'} onClick={() => setActiveMarker && setActiveMarker('secondary')} text={r && r.secondary && r.secondary.maxUtilization != null ? `Sec Util: ${(r.secondary.maxUtilization * 100).toFixed(2)}%` : `Sec: ${secondarySpacing} m`} type="blue" utilRatio={r?.secondary?.maxUtilization} />
        
        {/* Distance between Primary Beams (Left side) */}
        <Marker x="140" y="440" active={activeMarker === 'primary'} onClick={() => setActiveMarker && setActiveMarker('primary')} text={r && r.primary && r.primary.maxUtilization != null ? `Pri Util: ${(r.primary.maxUtilization * 100).toFixed(2)}%` : `Pri: ${primarySpacing} m`} type="blue" utilRatio={r?.primary?.maxUtilization} />
        
        {/* Distance between Primary Beam Supports (Bottom center) */}
        <Marker x="420" y="550" active={activeMarker === 'shoring'} onClick={() => setActiveMarker && setActiveMarker('shoring')} text={r && r.tower && r.tower.utilization != null ? `Shore Util: ${(r.tower.utilization * 100).toFixed(2)}%` : `Span: ${primarySpanLength} m`} utilRatio={r?.tower?.utilization} />
        
        {/* Component Markers (hide in results view for clarity) */}
        {!r && <Marker x="360" y="200" active={activeMarker === 'panel'} onClick={() => setActiveMarker('panel')} text={panelType} type="blue" />}
        {!r && <Marker x="246" y="500" active={activeMarker === 'shoring'} onClick={() => setActiveMarker('shoring')} text={shoringType} type="blue" />}
      </svg>
    </div>
  );
}

function Marker({ x, y, text, active, onClick, type = 'yellow', utilRatio }) {
  const isYellow = type === 'yellow';
  // If utilRatio is provided, color code it: >1 = red, >0.8 = orange, else green
  let color = isYellow ? "#eab308" : "#2563eb";
  if (utilRatio !== undefined) {
    color = utilRatio > 1.0 ? "#ef4444" : (utilRatio > 0.8 ? "#f97316" : "#22c55e");
  }

  return (
    <g transform={`translate(${x}, ${y})`} onClick={onClick} style={{ cursor: 'pointer' }} className={styles.markerGroup}>
      {active && <circle cx="0" cy="0" r="18" fill={color} className={styles.pulseCircle} />}
      <circle cx="0" cy="0" r="9" fill={color} stroke="white" strokeWidth="2.5" style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.25))' }} />
      <g className={styles.tooltipGroup} style={{ transform: active ? 'scale(1.05)' : 'none', transformOrigin: '0px 0px', transition: 'transform 0.2s ease' }}>
        <rect x={-(text.length * 6 + 12)/2} y="14" width={text.length * 6 + 12} height="22" rx="6" fill="white" stroke={active ? color : "#cbd5e1"} strokeWidth={active ? "1.5" : "1"} style={{ filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.06))' }} />
        <text x="0" y="29" textAnchor="middle" fontSize="11" fill="#334155" fontWeight="600">{text}</text>
      </g>
    </g>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Results Tab Component
// ────────────────────────────────────────────────────────────────────────────
function ResultsTab({ results }) {
  if (!results) {
    return (
      <div className={styles.card}>
        <div className={styles.placeholderBox} style={{ minHeight: '300px' }}>
          <span>Click <strong>Calculate</strong> to generate results</span>
        </div>
      </div>
    );
  }

  const { areaLoad, panel, secondary, primary, tower, overallPass, maxUtilization } = results;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', minWidth: 0 }}>
      {/* Percentage overlay image */}
      <div className={styles.card} style={{ padding: '0', overflow: 'hidden' }}>
        <InteractiveDiagram resultsOverlay={results} />
      </div>

      <div className={styles.resultsGridLayout}>
        {/* Left Column — Check Results */}
        <div>
          <div className={styles.card}>
            <h3 className={styles.cardTitle}>Component Check Results</h3>
            <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', width: '100%' }}>
              <div className={styles.resultsTable} style={{ minWidth: '600px' }}>
                <div className={styles.resultsTableHeader}>
                <span>Component</span>
                <span>Check</span>
                <span>Applied</span>
                <span>Capacity</span>
                <span>Utilization</span>
                <span>Status</span>
              </div>

              <ResultRow component="Formwork Panel" check="Bending" applied={`${panel.bending.applied} kNm/m`} capacity={`${panel.bending.capacity} kNm/m`} utilization={panel.bending.ratio} pass={panel.bending.pass} />
              <ResultRow component="" check="Deflection" applied={`${panel.deflection.actual} mm`} capacity={`${panel.deflection.allowable} mm`} utilization={panel.deflection.ratio} pass={panel.deflection.pass} />
              
              <ResultRow component="Secondary Beam" check="Bending" applied={`${secondary.bending.applied} kNm`} capacity={`${secondary.bending.capacity} kNm`} utilization={secondary.bending.ratio} pass={secondary.bending.pass} />
            <ResultRow component="" check="Shear" applied={`${secondary.shear.applied} kN`} capacity={`${secondary.shear.capacity} kN`} utilization={secondary.shear.ratio} pass={secondary.shear.pass} />
            <ResultRow component="" check="Deflection" applied={`${secondary.deflection.actual} mm`} capacity={`${secondary.deflection.allowable} mm`} utilization={secondary.deflection.ratio} pass={secondary.deflection.pass} />

            <ResultRow component="Primary Beam" check="Bending" applied={`${primary.bending.applied} kNm`} capacity={`${primary.bending.capacity} kNm`} utilization={primary.bending.ratio} pass={primary.bending.pass} />
            <ResultRow component="" check="Shear" applied={`${primary.shear.applied} kN`} capacity={`${primary.shear.capacity} kN`} utilization={primary.shear.ratio} pass={primary.shear.pass} />
            <ResultRow component="" check="Deflection" applied={`${primary.deflection.actual} mm`} capacity={`${primary.deflection.allowable} mm`} utilization={primary.deflection.ratio} pass={primary.deflection.pass} />

            <ResultRow component="Shoring System" check="Axial Load" applied={`${tower.applied} kN`} capacity={`${tower.capacity} kN`} utilization={tower.utilization} pass={tower.pass} />
            </div>
          </div>
        </div>

        <div className={styles.card}>
          <h3 className={styles.cardTitle}>Notes</h3>
          <ul className={styles.notesList}>
            <li>Secondary beam: {secondary.spanCount}-span, line load = {secondary.lineLoad} kN/m</li>
            <li>Primary beam: {primary.spanCount}-span, line load = {primary.lineLoad} kN/m</li>
            <li>Max secondary reaction = {secondary.maxReaction} kN</li>
            <li>Max primary reaction = {primary.maxReaction} kN (tower/prop load excl. self-weight)</li>
            <li>Design based on manufacturer's allowable capacities</li>
          </ul>
        </div>
      </div>

      {/* Right Column — Summary */}
      <div>
        <div className={`${styles.card} ${styles.summaryCard}`}>
          <h3 className={styles.cardTitle}>Design Summary</h3>
          <div className={`${styles.overallStatus} ${overallPass ? styles.statusPassBg : styles.statusFailBg}`}>
            {overallPass ? (
              <><CheckCircle size={28} /> <span>PASS</span></>
            ) : (
              <><XCircle size={28} /> <span>FAIL</span></>
            )}
          </div>
          <div className={styles.summaryGrid}>
            <div className={styles.summaryItem}>
              <span className={styles.summaryLabel}>Max Utilization</span>
              <span className={styles.summaryValue}>{(maxUtilization * 100).toFixed(2)}%</span>
            </div>
            <div className={styles.summaryItem}>
              <span className={styles.summaryLabel}>Max Support Reaction</span>
              <span className={styles.summaryValue}>{primary.maxReaction} kN</span>
            </div>
          </div>
        </div>

        <div className={styles.card}>
          <h3 className={styles.cardTitle}>Load Summary (Service Load)</h3>
          <div className={styles.loadBreakdown}>
            <div className={styles.loadRow}>
              <span>Concrete Self-Weight</span>
              <strong>{areaLoad.concreteWeight} kN/m²</strong>
            </div>
            <div className={styles.loadRow}>
              <span>Construction / Formwork Load</span>
              <strong>{areaLoad.formworkLoad} kN/m²</strong>
            </div>
            <div className={styles.loadRowDivider} />
            <div className={`${styles.loadRow} ${styles.loadRowTotal}`}>
              <span>Total Area Load</span>
              <strong>{areaLoad.totalAreaLoad} kN/m²</strong>
            </div>
            <div className={styles.loadTier}>
              Tier: Slab thickness {areaLoad.tier} mm
            </div>
          </div>
        </div>
      </div>
    </div>
    </div>
  );
}

function ResultRow({ component, check, applied, capacity, utilization, pass }) {
  const pct = (utilization * 100).toFixed(2);
  return (
    <div className={styles.resultsTableRow}>
      <span className={styles.resultComponent}>{component}</span>
      <span>{check}</span>
      <span>{applied}</span>
      <span>{capacity}</span>
      <span className={utilization > 1 ? styles.textDanger : ''}>{pct}%</span>
      <span>
        {pass ? (
          <span className={styles.statusPass}><CheckCircle size={14} /> OK</span>
        ) : (
          <span className={styles.statusFail}><XCircle size={14} /> FAIL</span>
        )}
      </span>
    </div>
  );
}

// ─── Slab PDF Report Preview Component ─────────────────────────────────────────
function SlabPDFReportPreview({ results, inputs, projectId, setProjectId, calculatedBy, setCalculatedBy, verificationDate, setVerificationDate }) {
  const { areaLoad, panel, secondary, primary, tower, overallPass, maxUtilization } = results;
  const dateStr = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

  const panelSpans = Array.from({ length: 3 }, (_, idx) => ({
    length: inputs.secondarySpacing * 1000,
    leftSupport: idx === 0 ? 'pin' : 'continuous',
    rightSupport: 'roller',
  }));
  const panelLoads = Array.from({ length: 3 }, (_, idx) => ({
    type: 'udl',
    spanIndex: idx,
    posStart: 0,
    posEnd: inputs.secondarySpacing * 1000,
    magnitude: areaLoad.totalAreaLoad,
  }));
  const panelBMDPts = flattenPoints(panel.analysis).map(p => ({ x: p.x, value: p.moment }));
  const panelDeflPts = flattenPoints(panel.analysis).map(p => ({ x: p.x, value: p.deflection }));

  const secSpans = Array.from({ length: inputs.secondarySpanCount }, (_, idx) => ({
    length: inputs.primarySpacing * 1000,
    leftSupport: idx === 0 ? 'pin' : 'continuous',
    rightSupport: 'roller',
  }));
  const secLoads = Array.from({ length: inputs.secondarySpanCount }, (_, idx) => ({
    type: 'udl',
    spanIndex: idx,
    posStart: 0,
    posEnd: inputs.primarySpacing * 1000,
    magnitude: secondary.lineLoad,
  }));
  const secBMDPts = flattenPoints(secondary.analysis).map(p => ({ x: p.x, value: p.moment }));
  const secSFDPts = flattenPoints(secondary.analysis).map(p => ({ x: p.x, value: p.shear }));
  const secDeflPts = flattenPoints(secondary.analysis).map(p => ({ x: p.x, value: p.deflection }));

  const priSpans = Array.from({ length: inputs.primarySpanCount }, (_, idx) => ({
    length: inputs.primarySpanLength * 1000,
    leftSupport: idx === 0 ? 'pin' : 'continuous',
    rightSupport: 'roller',
  }));
  const priLoads = Array.from({ length: inputs.primarySpanCount }, (_, idx) => ({
    type: 'udl',
    spanIndex: idx,
    posStart: 0,
    posEnd: inputs.primarySpanLength * 1000,
    magnitude: primary.lineLoad,
  }));
  const priBMDPts = flattenPoints(primary.analysis).map(p => ({ x: p.x, value: p.moment }));
  const priSFDPts = flattenPoints(primary.analysis).map(p => ({ x: p.x, value: p.shear }));
  const priDeflPts = flattenPoints(primary.analysis).map(p => ({ x: p.x, value: p.deflection }));

  // Print only the report preview div, not the entire page
  const reportRef = useRef(null);
  const handlePrint = () => {
    const content = reportRef.current;
    if (!content) return;
    const printWindow = window.open('', '_blank', 'width=900,height=1200');
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>TempWorks – Slab Formwork Check Report</title>
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
        <body>${content.innerHTML}</body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 400);
  };

  const pageStyle = {
    width: '210mm',
    height: '297mm',
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
    fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
    pageBreakAfter: 'always',
    breakAfter: 'page'
  };

  return (
    <div style={{ width: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch', paddingBottom: '2rem' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', minWidth: '210mm', margin: '0 auto' }}>
      {/* Export Action Area */}
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
              placeholder="e.g. TW-2026-SLAB"
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

      <div ref={reportRef} style={{ display: 'flex', flexDirection: 'column', gap: '30px', width: '210mm' }}>
        
        {/* PAGE 1: DESIGN SUMMARY */}
        <div className="report-page" style={pageStyle}>
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
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a' }}>Slab Formwork Report - Design Summary</div>
              <div style={{ fontSize: '8px', color: '#64748b', marginTop: '1px' }}>Standard: Manufacturer's Limits</div>
            </div>
          </div>

          {/* Metadata */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', background: '#f8fafc', padding: '8px 12px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
            <div>
              <span style={{ color: '#64748b', fontSize: '8px', textTransform: 'uppercase', fontWeight: 700 }}>Project</span>
              <div style={{ fontWeight: 600, fontSize: '10px' }}>{projectId || 'TW-2026-SLAB'}</div>
            </div>
            <div>
              <span style={{ color: '#64748b', fontSize: '8px', textTransform: 'uppercase', fontWeight: 700 }}>Prepared By</span>
              <div style={{ fontWeight: 600, fontSize: '10px' }}>{calculatedBy || 'Engineer'}</div>
            </div>
            <div>
              <span style={{ color: '#64748b', fontSize: '8px', textTransform: 'uppercase', fontWeight: 700 }}>Date</span>
              <div style={{ fontWeight: 600, fontSize: '10px' }}>{verificationDate || dateStr}</div>
            </div>
            <div>
              <span style={{ color: '#64748b', fontSize: '8px', textTransform: 'uppercase', fontWeight: 700 }}>Overall Status</span>
              <div style={{ fontWeight: 800, fontSize: '10px', color: overallPass ? '#16a34a' : '#ef4444' }}>{overallPass ? 'PASS' : 'FAIL'}</div>
            </div>
          </div>

          {/* Section 1: Overview and Schematic */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '20px', marginTop: '4px' }}>
            {/* Left: Interactive Diagram */}
            <div>
              <div style={{ fontSize: '10px', fontWeight: 700, color: '#334155', textTransform: 'uppercase', marginBottom: '4px', borderBottom: '1px solid #cbd5e1', paddingBottom: '2px' }}>
                1. System Schematic & Utilization
              </div>
              <div style={{ background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0', padding: '4px', display: 'flex', justifyContent: 'center' }}>
                <div style={{ width: '100%', maxWidth: '380px' }}>
                  <InteractiveDiagram 
                    activeMarker={null}
                    setActiveMarker={null}
                    slabThickness={inputs.slabThickness}
                    secondarySpacing={inputs.secondarySpacing}
                    primarySpacing={inputs.primarySpacing}
                    primarySpanLength={inputs.primarySpanLength}
                    secondaryBeamType={inputs.secondaryBeamType}
                    primaryBeamType={inputs.primaryBeamType}
                    panelType={inputs.panelType}
                    shoringType={inputs.shoringType}
                    resultsOverlay={results}
                  />
                </div>
              </div>
            </div>

            {/* Right: Design Parameters Summary */}
            <div>
              <div style={{ fontSize: '10px', fontWeight: 700, color: '#334155', textTransform: 'uppercase', marginBottom: '4px', borderBottom: '1px solid #cbd5e1', paddingBottom: '2px' }}>
                2. Design Parameters
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
                <tbody>
                  <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '4px 0', color: '#64748b' }}>Slab Thickness</td>
                    <td style={{ padding: '4px 0', fontWeight: 600, textAlign: 'right' }}>{inputs.slabThickness} mm</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '4px 0', color: '#64748b' }}>Concrete Weight</td>
                    <td style={{ padding: '4px 0', fontWeight: 600, textAlign: 'right' }}>{inputs.unitWeight} kN/m³</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '4px 0', color: '#64748b' }}>Area UDL (ULS)</td>
                    <td style={{ padding: '4px 0', fontWeight: 600, textAlign: 'right' }}>{areaLoad.totalAreaLoad.toFixed(2)} kN/m²</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '4px 0', color: '#64748b' }}>Sec. Spacing</td>
                    <td style={{ padding: '4px 0', fontWeight: 600, textAlign: 'right' }}>{inputs.secondarySpacing} m</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '4px 0', color: '#64748b' }}>Pri. Spacing</td>
                    <td style={{ padding: '4px 0', fontWeight: 600, textAlign: 'right' }}>{inputs.primarySpacing} m</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '4px 0', color: '#64748b' }}>Shoring Grid</td>
                    <td style={{ padding: '4px 0', fontWeight: 600, textAlign: 'right' }}>{inputs.primarySpacing} m × {inputs.primarySpanLength} m</td>
                  </tr>
                </tbody>
              </table>
              <div style={{ marginTop: '10px', background: overallPass ? '#f0fdf4' : '#fef2f2', border: `1px solid ${overallPass ? '#bbf7d0' : '#fecaca'}`, borderRadius: '6px', padding: '8px', textAlign: 'center' }}>
                <div style={{ fontSize: '8px', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Max Component Utilization</div>
                <div style={{ fontSize: '20px', fontWeight: 800, color: overallPass ? '#16a34a' : '#ef4444' }}>{(maxUtilization * 100).toFixed(2)}%</div>
              </div>
            </div>
          </div>

          {/* Section 2: Component Check Table */}
          <div>
            <div style={{ fontSize: '10px', fontWeight: 700, color: '#334155', textTransform: 'uppercase', marginBottom: '4px', borderBottom: '1px solid #cbd5e1', paddingBottom: '2px' }}>
              3. Component Capacity Verification
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px', marginTop: '4px' }}>
              <thead>
                <tr style={{ borderBottom: '1.5px solid #cbd5e1', color: '#475569', fontWeight: 700 }}>
                  <th style={{ padding: '4px', textAlign: 'left', width: '30%' }}>Component</th>
                  <th style={{ padding: '4px', textAlign: 'left', width: '20%' }}>Check Type</th>
                  <th style={{ padding: '4px', textAlign: 'right', width: '15%' }}>Applied</th>
                  <th style={{ padding: '4px', textAlign: 'right', width: '15%' }}>Capacity</th>
                  <th style={{ padding: '4px', textAlign: 'right', width: '12%' }}>Util.</th>
                  <th style={{ padding: '4px', textAlign: 'center', width: '8%' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '4px', fontWeight: 600 }}>Formwork Panel ({inputs.panelType})</td>
                  <td style={{ padding: '4px' }}>Bending Moment</td>
                  <td style={{ padding: '4px', textAlign: 'right' }}>{panel.bending.applied} kNm/m</td>
                  <td style={{ padding: '4px', textAlign: 'right' }}>{panel.bending.capacity} kNm/m</td>
                  <td style={{ padding: '4px', textAlign: 'right', fontWeight: 600 }}>{(panel.bending.ratio * 100).toFixed(2)}%</td>
                  <td style={{ padding: '4px', textAlign: 'center', fontWeight: 700, color: panel.bending.pass ? '#16a34a' : '#ef4444' }}>{panel.bending.pass ? 'PASS' : 'FAIL'}</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '4px' }}></td>
                  <td style={{ padding: '4px' }}>Deflection</td>
                  <td style={{ padding: '4px', textAlign: 'right' }}>{panel.deflection.actual} mm</td>
                  <td style={{ padding: '4px', textAlign: 'right' }}>{panel.deflection.allowable} mm</td>
                  <td style={{ padding: '4px', textAlign: 'right', fontWeight: 600 }}>{(panel.deflection.ratio * 100).toFixed(2)}%</td>
                  <td style={{ padding: '4px', textAlign: 'center', fontWeight: 700, color: panel.deflection.pass ? '#16a34a' : '#ef4444' }}>{panel.deflection.pass ? 'PASS' : 'FAIL'}</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '4px', fontWeight: 600 }}>Secondary Beam ({inputs.secondaryBeamType})</td>
                  <td style={{ padding: '4px' }}>Bending Moment</td>
                  <td style={{ padding: '4px', textAlign: 'right' }}>{secondary.bending.applied} kNm</td>
                  <td style={{ padding: '4px', textAlign: 'right' }}>{secondary.bending.capacity} kNm</td>
                  <td style={{ padding: '4px', textAlign: 'right', fontWeight: 600 }}>{(secondary.bending.ratio * 100).toFixed(2)}%</td>
                  <td style={{ padding: '4px', textAlign: 'center', fontWeight: 700, color: secondary.bending.pass ? '#16a34a' : '#ef4444' }}>{secondary.bending.pass ? 'PASS' : 'FAIL'}</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '4px' }}></td>
                  <td style={{ padding: '4px' }}>Shear Force</td>
                  <td style={{ padding: '4px', textAlign: 'right' }}>{secondary.shear.applied} kN</td>
                  <td style={{ padding: '4px', textAlign: 'right' }}>{secondary.shear.capacity} kN</td>
                  <td style={{ padding: '4px', textAlign: 'right', fontWeight: 600 }}>{(secondary.shear.ratio * 100).toFixed(2)}%</td>
                  <td style={{ padding: '4px', textAlign: 'center', fontWeight: 700, color: secondary.shear.pass ? '#16a34a' : '#ef4444' }}>{secondary.shear.pass ? 'PASS' : 'FAIL'}</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '4px' }}></td>
                  <td style={{ padding: '4px' }}>Deflection</td>
                  <td style={{ padding: '4px', textAlign: 'right' }}>{secondary.deflection.actual} mm</td>
                  <td style={{ padding: '4px', textAlign: 'right' }}>{secondary.deflection.allowable} mm</td>
                  <td style={{ padding: '4px', textAlign: 'right', fontWeight: 600 }}>{(secondary.deflection.ratio * 100).toFixed(2)}%</td>
                  <td style={{ padding: '4px', textAlign: 'center', fontWeight: 700, color: secondary.deflection.pass ? '#16a34a' : '#ef4444' }}>{secondary.deflection.pass ? 'PASS' : 'FAIL'}</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '4px', fontWeight: 600 }}>Primary Beam ({inputs.primaryBeamType})</td>
                  <td style={{ padding: '4px' }}>Bending Moment</td>
                  <td style={{ padding: '4px', textAlign: 'right' }}>{primary.bending.applied} kNm</td>
                  <td style={{ padding: '4px', textAlign: 'right' }}>{primary.bending.capacity} kNm</td>
                  <td style={{ padding: '4px', textAlign: 'right', fontWeight: 600 }}>{(primary.bending.ratio * 100).toFixed(2)}%</td>
                  <td style={{ padding: '4px', textAlign: 'center', fontWeight: 700, color: primary.bending.pass ? '#16a34a' : '#ef4444' }}>{primary.bending.pass ? 'PASS' : 'FAIL'}</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '4px' }}></td>
                  <td style={{ padding: '4px' }}>Shear Force</td>
                  <td style={{ padding: '4px', textAlign: 'right' }}>{primary.shear.applied} kN</td>
                  <td style={{ padding: '4px', textAlign: 'right' }}>{primary.shear.capacity} kN</td>
                  <td style={{ padding: '4px', textAlign: 'right', fontWeight: 600 }}>{(primary.shear.ratio * 100).toFixed(2)}%</td>
                  <td style={{ padding: '4px', textAlign: 'center', fontWeight: 700, color: primary.shear.pass ? '#16a34a' : '#ef4444' }}>{primary.shear.pass ? 'PASS' : 'FAIL'}</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '4px' }}></td>
                  <td style={{ padding: '4px' }}>Deflection</td>
                  <td style={{ padding: '4px', textAlign: 'right' }}>{primary.deflection.actual} mm</td>
                  <td style={{ padding: '4px', textAlign: 'right' }}>{primary.deflection.allowable} mm</td>
                  <td style={{ padding: '4px', textAlign: 'right', fontWeight: 600 }}>{(primary.deflection.ratio * 100).toFixed(2)}%</td>
                  <td style={{ padding: '4px', textAlign: 'center', fontWeight: 700, color: primary.deflection.pass ? '#16a34a' : '#ef4444' }}>{primary.deflection.pass ? 'PASS' : 'FAIL'}</td>
                </tr>
                <tr style={{ borderBottom: '1.5px solid #cbd5e1' }}>
                  <td style={{ padding: '4px', fontWeight: 600 }}>Shoring System ({inputs.shoringType})</td>
                  <td style={{ padding: '4px' }}>Axial Support Load</td>
                  <td style={{ padding: '4px', textAlign: 'right' }}>{tower.applied} kN</td>
                  <td style={{ padding: '4px', textAlign: 'right' }}>{tower.capacity} kN</td>
                  <td style={{ padding: '4px', textAlign: 'right', fontWeight: 600 }}>{(tower.utilization * 100).toFixed(2)}%</td>
                  <td style={{ padding: '4px', textAlign: 'center', fontWeight: 700, color: tower.pass ? '#16a34a' : '#ef4444' }}>{tower.pass ? 'PASS' : 'FAIL'}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Design Notes */}
          <div style={{ marginTop: 'auto', borderTop: '2.5px solid #cbd5e1', paddingTop: '8px' }}>
            <div style={{ fontSize: '9px', fontWeight: 700, color: '#334155', textTransform: 'uppercase', marginBottom: '2px' }}>
              Design Notes & System Details
            </div>
            <ul style={{ fontSize: '9px', color: '#475569', paddingLeft: '12px', margin: '0' }}>
              <li>Formwork panel type: <strong>{inputs.panelType} ({inputs.panelThickness})</strong>, layout run <strong>{inputs.panelDirection}</strong>.</li>
              <li>Secondary beam type: <strong>{inputs.secondaryBeamType}</strong> spaced at <strong>{inputs.secondarySpacing} m</strong>, loading UDL = <strong>{secondary.lineLoad} kN/m</strong>.</li>
              <li>Primary beam type: <strong>{inputs.primaryBeamType}</strong> spaced at <strong>{inputs.primarySpacing} m</strong>, loading UDL = <strong>{primary.lineLoad} kN/m</strong>.</li>
              <li>Shoring grid size = <strong>{inputs.primarySpacing} m × {inputs.primarySpanLength} m</strong> with height <strong>{inputs.towerHeight} m</strong>.</li>
              <li>Verification results are computed using manufacturer specifications and structural limit state rules.</li>
            </ul>
          </div>
        </div>

        {/* PAGE 2: PANEL CHECK */}
        <div className="report-page" style={pageStyle}>
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
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a' }}>Slab Formwork Report - Formwork Panel</div>
              <div style={{ fontSize: '8px', color: '#64748b', marginTop: '1px' }}>Standard: Manufacturer's Limits</div>
            </div>
          </div>

          {/* Metadata */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', background: '#f8fafc', padding: '8px 12px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
            <div>
              <span style={{ color: '#64748b', fontSize: '8px', textTransform: 'uppercase', fontWeight: 700 }}>Project</span>
              <div style={{ fontWeight: 600, fontSize: '10px' }}>{projectId || 'TW-2026-SLAB'}</div>
            </div>
            <div>
              <span style={{ color: '#64748b', fontSize: '8px', textTransform: 'uppercase', fontWeight: 700 }}>Prepared By</span>
              <div style={{ fontWeight: 600, fontSize: '10px' }}>{calculatedBy || 'Engineer'}</div>
            </div>
            <div>
              <span style={{ color: '#64748b', fontSize: '8px', textTransform: 'uppercase', fontWeight: 700 }}>Date</span>
              <div style={{ fontWeight: 600, fontSize: '10px' }}>{verificationDate || dateStr}</div>
            </div>
            <div>
              <span style={{ color: '#64748b', fontSize: '8px', textTransform: 'uppercase', fontWeight: 700 }}>Panel Status</span>
              <div style={{ fontWeight: 800, fontSize: '10px', color: panel.pass ? '#16a34a' : '#ef4444' }}>{panel.pass ? 'PASS' : 'FAIL'}</div>
            </div>
          </div>

          {/* Design parameters & loading info */}
          <div>
            <div style={{ fontSize: '10px', fontWeight: 700, color: '#334155', textTransform: 'uppercase', marginBottom: '4px', borderBottom: '1px solid #cbd5e1', paddingBottom: '2px' }}>
              1. Geometry & Loading Details
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '3px 0', color: '#64748b', width: '30%' }}>Slab Thickness</td>
                  <td style={{ padding: '3px 0', fontWeight: 600 }}>{inputs.slabThickness} mm</td>
                  <td style={{ padding: '3px 0', color: '#64748b', width: '30%' }}>Panel Type</td>
                  <td style={{ padding: '3px 0', fontWeight: 600 }}>{inputs.panelType} ({inputs.panelThickness})</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '3px 0', color: '#64748b' }}>Design Area Load (UDL)</td>
                  <td style={{ padding: '3px 0', fontWeight: 600 }}>{areaLoad.totalAreaLoad.toFixed(2)} kN/m²</td>
                  <td style={{ padding: '3px 0', color: '#64748b' }}>Secondary Beam Spacing</td>
                  <td style={{ padding: '3px 0', fontWeight: 600 }}>{inputs.secondarySpacing} m</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Loading Diagram */}
          <div>
            <div style={{ fontSize: '10px', fontWeight: 700, color: '#334155', textTransform: 'uppercase', marginBottom: '4px', borderBottom: '1px solid #cbd5e1', paddingBottom: '2px' }}>
              2. Structural Loading Diagram
            </div>
            <div style={{ background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0', padding: '6px' }}>
              <DynamicBeamDiagram spans={panelSpans} loads={panelLoads} reactions={[]} />
            </div>
          </div>

          {/* Analysis Diagrams */}
          <div>
            <div style={{ fontSize: '10px', fontWeight: 700, color: '#334155', textTransform: 'uppercase', marginBottom: '4px', borderBottom: '1px solid #cbd5e1', paddingBottom: '2px' }}>
              3. Structural Analysis Diagrams
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '4px' }}>
              <div style={{ background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0', padding: '10px' }}>
                <div style={{ fontSize: '10px', fontWeight: 700, color: CLR.bmd, marginBottom: '2px' }}>Bending Moment Diagram (kNm/m)</div>
                {panelBMDPts.length > 0 ? (
                  <AnalysisDiagram unit="" points={panelBMDPts} lineColor={CLR.bmd} fillColor={CLR.bmdFill} invertFill={true} height={160} />
                ) : <div style={{ fontSize: '10px', color: '#94a3b8', height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>No Data</div>}
              </div>
              <div style={{ background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0', padding: '10px' }}>
                <div style={{ fontSize: '10px', fontWeight: 700, color: CLR.defl, marginBottom: '2px' }}>Deflected Shape (mm)</div>
                {panelDeflPts.length > 0 ? (
                  <AnalysisDiagram unit="" points={panelDeflPts} lineColor={CLR.defl} fillColor={CLR.deflFill} invertFill={true} height={160} />
                ) : <div style={{ fontSize: '10px', color: '#94a3b8', height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>No Data</div>}
              </div>
            </div>
          </div>

          {/* Checks details */}
          <div style={{ marginTop: 'auto' }}>
            <div style={{ fontSize: '10px', fontWeight: 700, color: '#334155', textTransform: 'uppercase', marginBottom: '4px', borderBottom: '1px solid #cbd5e1', paddingBottom: '2px' }}>
              4. Capacity design checks
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', fontSize: '11px', marginTop: '4px' }}>
              <div>
                <div style={{ fontWeight: 600, color: '#475569', marginBottom: '3px' }}>Bending Moment Verification:</div>
                <div>Design Bending Moment (ULS): <strong>M<sub>Ed</sub> = {panel.bending.applied} kNm/m</strong></div>
                <div>Allowable Moment Capacity: <strong>M<sub>allow</sub> = {panel.bending.capacity} kNm/m</strong></div>
                <div>Bending Utilization Ratio: <strong>{(panel.bending.ratio*100).toFixed(2)}%</strong></div>
                <div style={{ color: panel.bending.pass ? '#16a34a' : '#ef4444', fontWeight: 800 }}>Status: {panel.bending.pass ? 'PASS' : 'FAIL'}</div>
              </div>
              <div>
                <div style={{ fontWeight: 600, color: '#475569', marginBottom: '3px' }}>Deflection Verification:</div>
                <div>Calculated Deflection (SLS): <strong>&delta;<sub>max</sub> = {panel.deflection.actual} mm</strong></div>
                <div>Allowable Deflection Limit: <strong>&delta;<sub>allow</sub> = {panel.deflection.allowable} mm</strong></div>
                <div>Deflection Utilization Ratio: <strong>{(panel.deflection.ratio*100).toFixed(2)}%</strong></div>
                <div style={{ color: panel.deflection.pass ? '#16a34a' : '#ef4444', fontWeight: 800 }}>Status: {panel.deflection.pass ? 'PASS' : 'FAIL'}</div>
              </div>
            </div>
          </div>
        </div>

        {/* PAGE 2: SECONDARY BEAM CHECK */}
        <div className="report-page" style={pageStyle}>
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
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a' }}>Slab Formwork Report - Secondary Beam</div>
              <div style={{ fontSize: '8px', color: '#64748b', marginTop: '1px' }}>Standard: Manufacturer's Limits</div>
            </div>
          </div>

          {/* Metadata */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', background: '#f8fafc', padding: '8px 12px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
            <div>
              <span style={{ color: '#64748b', fontSize: '8px', textTransform: 'uppercase', fontWeight: 700 }}>Project</span>
              <div style={{ fontWeight: 600, fontSize: '10px' }}>{projectId || 'TW-2026-SLAB'}</div>
            </div>
            <div>
              <span style={{ color: '#64748b', fontSize: '8px', textTransform: 'uppercase', fontWeight: 700 }}>Prepared By</span>
              <div style={{ fontWeight: 600, fontSize: '10px' }}>{calculatedBy || 'Engineer'}</div>
            </div>
            <div>
              <span style={{ color: '#64748b', fontSize: '8px', textTransform: 'uppercase', fontWeight: 700 }}>Date</span>
              <div style={{ fontWeight: 600, fontSize: '10px' }}>{verificationDate || dateStr}</div>
            </div>
            <div>
              <span style={{ color: '#64748b', fontSize: '8px', textTransform: 'uppercase', fontWeight: 700 }}>Secondary Status</span>
              <div style={{ fontWeight: 800, fontSize: '10px', color: secondary.pass ? '#16a34a' : '#ef4444' }}>{secondary.pass ? 'PASS' : 'FAIL'}</div>
            </div>
          </div>

          {/* Design parameters & loading info */}
          <div>
            <div style={{ fontSize: '10px', fontWeight: 700, color: '#334155', textTransform: 'uppercase', marginBottom: '4px', borderBottom: '1px solid #cbd5e1', paddingBottom: '2px' }}>
              1. Geometry & Loading Details
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '3px 0', color: '#64748b', width: '30%' }}>Beam Type</td>
                  <td style={{ padding: '3px 0', fontWeight: 600 }}>{inputs.secondaryBeamType}</td>
                  <td style={{ padding: '3px 0', color: '#64748b', width: '30%' }}>Span length (L)</td>
                  <td style={{ padding: '3px 0', fontWeight: 600 }}>{inputs.primarySpacing} m</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '3px 0', color: '#64748b' }}>Design Line UDL (w)</td>
                  <td style={{ padding: '3px 0', fontWeight: 600 }}>{secondary.lineLoad} kN/m</td>
                  <td style={{ padding: '3px 0', color: '#64748b' }}>Tributary Spacing</td>
                  <td style={{ padding: '3px 0', fontWeight: 600 }}>{inputs.secondarySpacing} m</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Loading Diagram */}
          <div>
            <div style={{ fontSize: '10px', fontWeight: 700, color: '#334155', textTransform: 'uppercase', marginBottom: '4px', borderBottom: '1px solid #cbd5e1', paddingBottom: '2px' }}>
              2. Structural Loading Diagram
            </div>
            <div style={{ background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0', padding: '6px' }}>
              <DynamicBeamDiagram spans={secSpans} loads={secLoads} reactions={secondary.reactions} />
            </div>
          </div>

          {/* Analysis Diagrams */}
          <div>
            <div style={{ fontSize: '10px', fontWeight: 700, color: '#334155', textTransform: 'uppercase', marginBottom: '4px', borderBottom: '1px solid #cbd5e1', paddingBottom: '2px' }}>
              3. Structural Analysis Diagrams
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '4px' }}>
              <div style={{ background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0', padding: '10px' }}>
                <div style={{ fontSize: '10px', fontWeight: 700, color: CLR.bmd, marginBottom: '2px' }}>Bending Moment Diagram (kNm)</div>
                {secBMDPts.length > 0 ? (
                  <AnalysisDiagram unit="" points={secBMDPts} lineColor={CLR.bmd} fillColor={CLR.bmdFill} invertFill={true} height={140} />
                ) : <div style={{ fontSize: '10px', color: '#94a3b8', height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>No Data</div>}
              </div>
              <div style={{ background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0', padding: '10px' }}>
                <div style={{ fontSize: '10px', fontWeight: 700, color: CLR.sfd, marginBottom: '2px' }}>Shear Force Diagram (kN)</div>
                {secSFDPts.length > 0 ? (
                  <AnalysisDiagram unit="" points={secSFDPts} lineColor={CLR.sfd} fillColor={CLR.sfdFill} invertFill={false} height={140} />
                ) : <div style={{ fontSize: '10px', color: '#94a3b8', height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>No Data</div>}
              </div>
              <div style={{ background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0', padding: '10px' }}>
                <div style={{ fontSize: '10px', fontWeight: 700, color: CLR.defl, marginBottom: '2px' }}>Deflected Shape (mm)</div>
                {secDeflPts.length > 0 ? (
                  <AnalysisDiagram unit="" points={secDeflPts} lineColor={CLR.defl} fillColor={CLR.deflFill} invertFill={true} height={140} />
                ) : <div style={{ fontSize: '10px', color: '#94a3b8', height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>No Data</div>}
              </div>
            </div>
          </div>

          {/* Checks details */}
          <div style={{ marginTop: 'auto' }}>
            <div style={{ fontSize: '10px', fontWeight: 700, color: '#334155', textTransform: 'uppercase', marginBottom: '4px', borderBottom: '1px solid #cbd5e1', paddingBottom: '2px' }}>
              4. Capacity design checks
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', fontSize: '11px', marginTop: '4px' }}>
              <div>
                <div style={{ fontWeight: 600, color: '#475569', marginBottom: '3px' }}>Bending Check:</div>
                <div>Moment (ULS): <strong>{secondary.bending.applied} kNm</strong></div>
                <div>Allowable M: <strong>{secondary.bending.capacity} kNm</strong></div>
                <div>Util Ratio: <strong>{(secondary.bending.ratio*100).toFixed(2)}%</strong></div>
                <div style={{ color: secondary.bending.pass ? '#16a34a' : '#ef4444', fontWeight: 800 }}>Status: {secondary.bending.pass ? 'PASS' : 'FAIL'}</div>
              </div>
              <div>
                <div style={{ fontWeight: 600, color: '#475569', marginBottom: '3px' }}>Shear Check:</div>
                <div>Shear (ULS): <strong>{secondary.shear.applied} kN</strong></div>
                <div>Allowable V: <strong>{secondary.shear.capacity} kN</strong></div>
                <div>Util Ratio: <strong>{(secondary.shear.ratio*100).toFixed(2)}%</strong></div>
                <div style={{ color: secondary.shear.pass ? '#16a34a' : '#ef4444', fontWeight: 800 }}>Status: {secondary.shear.pass ? 'PASS' : 'FAIL'}</div>
              </div>
              <div>
                <div style={{ fontWeight: 600, color: '#475569', marginBottom: '3px' }}>Deflection Check:</div>
                <div>Deflection (SLS): <strong>{secondary.deflection.actual} mm</strong></div>
                <div>Allowable &delta;: <strong>{secondary.deflection.allowable} mm</strong></div>
                <div>Util Ratio: <strong>{(secondary.deflection.ratio*100).toFixed(2)}%</strong></div>
                <div style={{ color: secondary.deflection.pass ? '#16a34a' : '#ef4444', fontWeight: 800 }}>Status: {secondary.deflection.pass ? 'PASS' : 'FAIL'}</div>
              </div>
            </div>
          </div>
        </div>

        {/* PAGE 3: PRIMARY BEAM CHECK */}
        <div className="report-page" style={pageStyle}>
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
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a' }}>Slab Formwork Report - Primary Beam</div>
              <div style={{ fontSize: '8px', color: '#64748b', marginTop: '1px' }}>Standard: Manufacturer's Limits</div>
            </div>
          </div>

          {/* Metadata */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', background: '#f8fafc', padding: '8px 12px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
            <div>
              <span style={{ color: '#64748b', fontSize: '8px', textTransform: 'uppercase', fontWeight: 700 }}>Project</span>
              <div style={{ fontWeight: 600, fontSize: '10px' }}>{projectId || 'TW-2026-SLAB'}</div>
            </div>
            <div>
              <span style={{ color: '#64748b', fontSize: '8px', textTransform: 'uppercase', fontWeight: 700 }}>Prepared By</span>
              <div style={{ fontWeight: 600, fontSize: '10px' }}>{calculatedBy || 'Engineer'}</div>
            </div>
            <div>
              <span style={{ color: '#64748b', fontSize: '8px', textTransform: 'uppercase', fontWeight: 700 }}>Date</span>
              <div style={{ fontWeight: 600, fontSize: '10px' }}>{verificationDate || dateStr}</div>
            </div>
            <div>
              <span style={{ color: '#64748b', fontSize: '8px', textTransform: 'uppercase', fontWeight: 700 }}>Primary Status</span>
              <div style={{ fontWeight: 800, fontSize: '10px', color: primary.pass ? '#16a34a' : '#ef4444' }}>{primary.pass ? 'PASS' : 'FAIL'}</div>
            </div>
          </div>

          {/* Design parameters & loading info */}
          <div>
            <div style={{ fontSize: '10px', fontWeight: 700, color: '#334155', textTransform: 'uppercase', marginBottom: '4px', borderBottom: '1px solid #cbd5e1', paddingBottom: '2px' }}>
              1. Geometry & Loading Details
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '3px 0', color: '#64748b', width: '30%' }}>Beam Type</td>
                  <td style={{ padding: '3px 0', fontWeight: 600 }}>{inputs.primaryBeamType}</td>
                  <td style={{ padding: '3px 0', color: '#64748b', width: '30%' }}>Span length (L)</td>
                  <td style={{ padding: '3px 0', fontWeight: 600 }}>{inputs.primarySpanLength} m</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '3px 0', color: '#64748b' }}>Equiv. Design Load (w)</td>
                  <td style={{ padding: '3px 0', fontWeight: 600 }}>{primary.lineLoad} kN/m</td>
                  <td style={{ padding: '3px 0', color: '#64748b' }}>Tributary Spacing</td>
                  <td style={{ padding: '3px 0', fontWeight: 600 }}>{inputs.primarySpacing} m</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Loading Diagram */}
          <div>
            <div style={{ fontSize: '10px', fontWeight: 700, color: '#334155', textTransform: 'uppercase', marginBottom: '4px', borderBottom: '1px solid #cbd5e1', paddingBottom: '2px' }}>
              2. Structural Loading Diagram
            </div>
            <div style={{ background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0', padding: '6px' }}>
              <DynamicBeamDiagram spans={priSpans} loads={priLoads} reactions={primary.reactions} />
            </div>
          </div>

          {/* Analysis Diagrams */}
          <div>
            <div style={{ fontSize: '10px', fontWeight: 700, color: '#334155', textTransform: 'uppercase', marginBottom: '4px', borderBottom: '1px solid #cbd5e1', paddingBottom: '2px' }}>
              3. Structural Analysis Diagrams
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '4px' }}>
              <div style={{ background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0', padding: '10px' }}>
                <div style={{ fontSize: '10px', fontWeight: 700, color: CLR.bmd, marginBottom: '2px' }}>Bending Moment Diagram (kNm)</div>
                {priBMDPts.length > 0 ? (
                  <AnalysisDiagram unit="" points={priBMDPts} lineColor={CLR.bmd} fillColor={CLR.bmdFill} invertFill={true} height={140} />
                ) : <div style={{ fontSize: '10px', color: '#94a3b8', height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>No Data</div>}
              </div>
              <div style={{ background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0', padding: '10px' }}>
                <div style={{ fontSize: '10px', fontWeight: 700, color: CLR.sfd, marginBottom: '2px' }}>Shear Force Diagram (kN)</div>
                {priSFDPts.length > 0 ? (
                  <AnalysisDiagram unit="" points={priSFDPts} lineColor={CLR.sfd} fillColor={CLR.sfdFill} invertFill={false} height={140} />
                ) : <div style={{ fontSize: '10px', color: '#94a3b8', height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>No Data</div>}
              </div>
              <div style={{ background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0', padding: '10px' }}>
                <div style={{ fontSize: '10px', fontWeight: 700, color: CLR.defl, marginBottom: '2px' }}>Deflected Shape (mm)</div>
                {priDeflPts.length > 0 ? (
                  <AnalysisDiagram unit="" points={priDeflPts} lineColor={CLR.defl} fillColor={CLR.deflFill} invertFill={true} height={140} />
                ) : <div style={{ fontSize: '10px', color: '#94a3b8', height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>No Data</div>}
              </div>
            </div>
          </div>

          {/* Checks details */}
          <div style={{ marginTop: 'auto' }}>
            <div style={{ fontSize: '10px', fontWeight: 700, color: '#334155', textTransform: 'uppercase', marginBottom: '4px', borderBottom: '1px solid #cbd5e1', paddingBottom: '2px' }}>
              4. Capacity design checks
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', fontSize: '11px', marginTop: '4px' }}>
              <div>
                <div style={{ fontWeight: 600, color: '#475569', marginBottom: '3px' }}>Bending Check:</div>
                <div>Moment (ULS): <strong>{primary.bending.applied} kNm</strong></div>
                <div>Allowable M: <strong>{primary.bending.capacity} kNm</strong></div>
                <div>Util Ratio: <strong>{(primary.bending.ratio*100).toFixed(2)}%</strong></div>
                <div style={{ color: primary.bending.pass ? '#16a34a' : '#ef4444', fontWeight: 800 }}>Status: {primary.bending.pass ? 'PASS' : 'FAIL'}</div>
              </div>
              <div>
                <div style={{ fontWeight: 600, color: '#475569', marginBottom: '3px' }}>Shear Check:</div>
                <div>Shear (ULS): <strong>{primary.shear.applied} kN</strong></div>
                <div>Allowable V: <strong>{primary.shear.capacity} kN</strong></div>
                <div>Util Ratio: <strong>{(primary.shear.ratio*100).toFixed(2)}%</strong></div>
                <div style={{ color: primary.shear.pass ? '#16a34a' : '#ef4444', fontWeight: 800 }}>Status: {primary.shear.pass ? 'PASS' : 'FAIL'}</div>
              </div>
              <div>
                <div style={{ fontWeight: 600, color: '#475569', marginBottom: '3px' }}>Deflection Check:</div>
                <div>Deflection (SLS): <strong>{primary.deflection.actual} mm</strong></div>
                <div>Allowable &delta;: <strong>{primary.deflection.allowable} mm</strong></div>
                <div>Util Ratio: <strong>{(primary.deflection.ratio*100).toFixed(2)}%</strong></div>
                <div style={{ color: primary.deflection.pass ? '#16a34a' : '#ef4444', fontWeight: 800 }}>Status: {primary.deflection.pass ? 'PASS' : 'FAIL'}</div>
              </div>
            </div>
          </div>
        </div>

        {/* PAGE 4: SHORING SYSTEM CHECK */}
        <div className="report-page" style={{ ...pageStyle, pageBreakAfter: 'avoid', breakAfter: 'avoid' }}>
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
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a' }}>Slab Formwork Report - Shoring System</div>
              <div style={{ fontSize: '8px', color: '#64748b', marginTop: '1px' }}>Standard: Manufacturer's Limits</div>
            </div>
          </div>

          {/* Metadata */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', background: '#f8fafc', padding: '8px 12px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
            <div>
              <span style={{ color: '#64748b', fontSize: '8px', textTransform: 'uppercase', fontWeight: 700 }}>Project</span>
              <div style={{ fontWeight: 600, fontSize: '10px' }}>{projectId || 'TW-2026-SLAB'}</div>
            </div>
            <div>
              <span style={{ color: '#64748b', fontSize: '8px', textTransform: 'uppercase', fontWeight: 700 }}>Prepared By</span>
              <div style={{ fontWeight: 600, fontSize: '10px' }}>{calculatedBy || 'Engineer'}</div>
            </div>
            <div>
              <span style={{ color: '#64748b', fontSize: '8px', textTransform: 'uppercase', fontWeight: 700 }}>Date</span>
              <div style={{ fontWeight: 600, fontSize: '10px' }}>{verificationDate || dateStr}</div>
            </div>
            <div>
              <span style={{ color: '#64748b', fontSize: '8px', textTransform: 'uppercase', fontWeight: 700 }}>Shoring Status</span>
              <div style={{ fontWeight: 800, fontSize: '10px', color: tower.pass ? '#16a34a' : '#ef4444' }}>{tower.pass ? 'PASS' : 'FAIL'}</div>
            </div>
          </div>

          {/* Design parameters & loading info */}
          <div>
            <div style={{ fontSize: '10px', fontWeight: 700, color: '#334155', textTransform: 'uppercase', marginBottom: '4px', borderBottom: '1px solid #cbd5e1', paddingBottom: '2px' }}>
              1. Geometry & Support Grid Details
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '4px 0', color: '#64748b', width: '30%' }}>Shoring System Type</td>
                  <td style={{ padding: '4px 0', fontWeight: 600 }}>{inputs.shoringType} ({inputs.shoringSystem})</td>
                  <td style={{ padding: '4px 0', color: '#64748b', width: '30%' }}>Shoring Tower Height</td>
                  <td style={{ padding: '4px 0', fontWeight: 600 }}>{inputs.towerHeight} m</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '4px 0', color: '#64748b' }}>Grid Dimensions (X × Y)</td>
                  <td style={{ padding: '4px 0', fontWeight: 600 }}>{inputs.primarySpacing} m × {inputs.primarySpanLength} m</td>
                  <td style={{ padding: '4px 0', color: '#64748b' }}>Tributary Support Area</td>
                  <td style={{ padding: '4px 0', fontWeight: 600 }}>{(inputs.primarySpacing * inputs.primarySpanLength).toFixed(2)} m²</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Structural Analysis details */}
          <div>
            <div style={{ fontSize: '10px', fontWeight: 700, color: '#334155', textTransform: 'uppercase', marginBottom: '4px', borderBottom: '1px solid #cbd5e1', paddingBottom: '2px' }}>
              2. Load Distribution Details
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '5px 0', color: '#64748b', width: '50%' }}>Reaction Force from Primary Beam (F)</td>
                  <td style={{ padding: '5px 0', fontWeight: 600, textAlign: 'right' }}>{primary.maxReaction} kN</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '5px 0', color: '#64748b' }}>Shoring System Selfweight (SW)</td>
                  <td style={{ padding: '5px 0', fontWeight: 600, textAlign: 'right' }}>{(tower.applied - primary.maxReaction).toFixed(2)} kN</td>
                </tr>
                <tr style={{ borderTop: '1.5px solid #cbd5e1', fontWeight: 700 }}>
                  <td style={{ padding: '6px 0', color: '#0f172a' }}>Total Axial Load on Shoring (N<sub>Ed</sub>)</td>
                  <td style={{ padding: '6px 0', textAlign: 'right', color: '#0f172a' }}>{tower.applied} kN</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Verification section */}
          <div>
            <div style={{ fontSize: '10px', fontWeight: 700, color: '#334155', textTransform: 'uppercase', marginBottom: '4px', borderBottom: '1px solid #cbd5e1', paddingBottom: '2px' }}>
              3. Safety Limit Checks
            </div>
            <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '10px 14px', fontSize: '11px', marginTop: '4px' }}>
              <div>Design Force (ULS): <strong>N<sub>Ed</sub> = {tower.applied} kN</strong></div>
              <div>Allowable Capacity (Standard Limit): <strong>N<sub>allow</sub> = {tower.capacity} kN</strong></div>
              <div style={{ marginTop: '4px', fontSize: '12px' }}>Safety Check: <strong>N<sub>Ed</sub> / N<sub>allow</sub> = {tower.applied} / {tower.capacity} = {(tower.utilization * 100).toFixed(2)}%</strong></div>
              <div style={{ color: tower.pass ? '#16a34a' : '#ef4444', fontWeight: 800, fontSize: '12px', marginTop: '4px' }}>
                Status: {tower.pass ? '✓ PASS (Loads are within allowable limits)' : '✗ FAIL (Loads exceed shoring capacity limits)'}
              </div>
            </div>
          </div>

          {/* Section 4: Design Summary */}
          <div style={{ marginTop: 'auto', borderTop: '2px solid #cbd5e1', paddingTop: '10px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '12px', fontWeight: 800, color: overallPass ? '#16a34a' : '#ef4444' }}>
                  {overallPass ? '✓ DESIGN PASSES ALLOWABLE CAPACITIES' : '✗ DESIGN EXCEEDS ALLOWABLE CAPACITIES'}
                </div>
                <div style={{ fontSize: '8px', color: '#64748b', marginTop: '2px' }}>
                  Verification calculations executed mathematically based on manufacturer specifications.
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>{(maxUtilization * 100).toFixed(2)}%</div>
                <div style={{ fontSize: '8px', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Max Component Utilization</div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
    </div>
  );
}

const CLR = {
  bmd: '#2563eb',
  bmdFill: 'rgba(37,99,235,0.10)',
  sfd: '#16a34a',
  sfdFill: 'rgba(22,163,74,0.10)',
  defl: '#dc2626',
  deflFill: 'rgba(220,38,38,0.10)',
  dim: '#94a3b8',
  label: '#475569',
  reaction: '#7c3aed',
  zero: '#cbd5e1',
};

function roundN(v, n = 2) {
  if (v == null || !isFinite(v)) return '—';
  return Number(v).toFixed(2);
}

function flattenPoints(analysis) {
  if (!analysis || !analysis.spans) return [];
  return analysis.spans.flatMap((s) => s.points);
}

function AnalysisDiagram({ unit, points, fillColor, lineColor, invertFill = false, reactions = [], height = 200 }) {
  const W = 860;
  const H = height;
  const ML = 62, MR = 20, MT = 30, MB = 42;
  const drawW = W - ML - MR;
  const drawH = H - MT - MB;
  const zeroY = MT + drawH / 2;

  const [hoverPt, setHoverPt] = useState(null);
  const [textScale, setTextScale] = useState(1);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (let entry of entries) {
        const width = entry.contentRect.width || W;
        const ratio = W / Math.max(width, 100);
        setTextScale(Math.max(1, Math.pow(ratio, 0.5) * 1.2));
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [W]);

  if (!points || points.length === 0) return null;

  const xs = points.map((p) => p.x);
  const vals = points.map((p) => p.value);
  const xMin = xs[0];
  const xMax = xs[xs.length - 1] || 1;
  const absMax = Math.max(...vals.map(Math.abs), 1e-9);

  const px = (x) => ML + ((x - xMin) / (xMax - xMin)) * drawW;
  const py = (v) => zeroY - (v / absMax) * (drawH / 2) * (invertFill ? -1 : 1);

  const polyPts = points.map((p) => `${px(p.x).toFixed(1)},${py(p.value).toFixed(1)}`).join(' ');
  const fillPath =
    `M${px(xMin).toFixed(1)},${zeroY} ` +
    points.map((p) => `L${px(p.x).toFixed(1)},${py(p.value).toFixed(1)}`).join(' ') +
    ` L${px(xMax).toFixed(1)},${zeroY} Z`;

  const yTicks = [-1, -0.5, 0, 0.5, 1].map((f) => ({
    y: zeroY - f * (drawH / 2) * (invertFill ? -1 : 1),
    label: roundN(f * absMax, 2),
  }));

  const xTicks = [];
  const numXTicks = 5;
  for (let i = 0; i < numXTicks; i++) {
    xTicks.push(xMin + (i / (numXTicks - 1)) * (xMax - xMin));
  }

  const getLocalExtrema = (pts) => {
    const extremes = [];
    if (pts.length < 3) return extremes;
    
    const compressed = [];
    for (let i = 0; i < pts.length; i++) {
      if (compressed.length === 0 || Math.abs(pts[i].value - compressed[compressed.length - 1].value) > 1e-9) {
        compressed.push({ ...pts[i], originalIndex: i });
      }
    }
    
    for (let i = 1; i < compressed.length - 1; i++) {
      const prev = compressed[i - 1].value;
      const curr = compressed[i].value;
      const next = compressed[i + 1].value;
      
      const isMax = curr > prev && curr > next;
      const isMin = curr < prev && curr < next;
      
      if (isMax) {
        extremes.push({ ...pts[compressed[i].originalIndex], type: 'max' });
      } else if (isMin) {
        extremes.push({ ...pts[compressed[i].originalIndex], type: 'min' });
      }
    }
    return extremes;
  };

  const extremes = getLocalExtrema(points);

  let globMax = points[0];
  let globMin = points[0];
  for (let i = 1; i < points.length; i++) {
    if (points[i].value > globMax.value) globMax = points[i];
    if (points[i].value < globMin.value) globMin = points[i];
  }
  if (globMax && !extremes.some((e) => Math.abs(e.x - globMax.x) < (xMax - xMin) * 0.02)) {
    extremes.push({ ...globMax, type: 'max' });
  }
  if (globMin && !extremes.some((e) => Math.abs(e.x - globMin.x) < (xMax - xMin) * 0.02)) {
    extremes.push({ ...globMin, type: 'min' });
  }
  
  const getDistinctExtremes = (sortedPts, count) => {
    const results = [];
    for (const pt of sortedPts) {
      if (results.length >= count) break;
      if (Math.abs(pt.value) < 1e-5) continue;
      const isDistinct = results.every(r => Math.abs(r.x - pt.x) > (xMax - xMin) * 0.05);
      if (isDistinct) results.push(pt);
    }
    return results;
  };
  
  const localMaxs = extremes.filter(e => e.type === 'max');
  const localMins = extremes.filter(e => e.type === 'min');

  const maxPeaks = getDistinctExtremes([...localMaxs].sort((a, b) => b.value - a.value), 2);
  const minPeaks = getDistinctExtremes([...localMins].sort((a, b) => a.value - b.value), 2);
  const displayPeaks = [...maxPeaks, ...minPeaks];

  const handleInteraction = (clientX, currentTarget) => {
    const pt = currentTarget.createSVGPoint();
    pt.x = clientX;
    pt.y = 0;
    const ctm = currentTarget.getScreenCTM();
    if (!ctm) return;
    const svgP = pt.matrixTransform(ctm.inverse());
    const svgX = svgP.x;

    const dataX = xMin + ((svgX - ML) / drawW) * (xMax - xMin);

    if (dataX < xMin || dataX > xMax) {
      setHoverPt(null);
      return;
    }

    let closest = points[0];
    let minDiff = Math.abs(points[0].x - dataX);
    for (let i = 1; i < points.length; i++) {
      const diff = Math.abs(points[i].x - dataX);
      if (diff < minDiff) {
        minDiff = diff;
        closest = points[i];
      }
    }
    setHoverPt(closest);
  };

  const handleMouseMove = (e) => {
    handleInteraction(e.clientX, e.currentTarget);
  };

  const handleTouch = (e) => {
    if (e.touches && e.touches[0]) {
      if (e.cancelable) e.preventDefault();
      handleInteraction(e.touches[0].clientX, e.currentTarget);
    }
  };

  return (
    <div ref={containerRef} style={{ width: '100%', position: 'relative' }}>
      <svg 
        width="100%"
        height="100%"
        viewBox={`0 0 ${W} ${H}`} 
        style={{ display: 'block', width: '100%', height: 'auto', maxHeight: H, cursor: 'crosshair', touchAction: 'none' }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoverPt(null)}
        onTouchStart={handleTouch}
        onTouchMove={handleTouch}
        onTouchEnd={() => setHoverPt(null)}
      >
        <line x1={ML} y1={zeroY} x2={ML + drawW} y2={zeroY} stroke={CLR.zero} strokeWidth={1.5} strokeDasharray="5 3" />
        {yTicks.map((t, i) => (
          <g key={i}>
            <line x1={ML - 4} y1={t.y} x2={ML} y2={t.y} stroke={CLR.dim} strokeWidth={1} />
            <text x={ML - 7} y={t.y + 4} textAnchor="end" fontSize={Math.round(12 * textScale)} fill={CLR.label}>{t.label}</text>
          </g>
        ))}
        <text x={11} y={MT + drawH / 2} textAnchor="middle" fontSize={Math.round(12 * textScale)} fill={CLR.label} transform={`rotate(-90,11,${MT + drawH / 2})`}>{unit}</text>
        <line x1={ML} y1={MT} x2={ML} y2={MT + drawH} stroke={CLR.dim} strokeWidth={1} />
        <line x1={ML} y1={MT + drawH} x2={ML + drawW} y2={MT + drawH} stroke={CLR.dim} strokeWidth={1} />
        {xTicks.map((p, i) => (
          <g key={i}>
            <line x1={px(p)} y1={MT + drawH} x2={px(p)} y2={MT + drawH + 4} stroke={CLR.dim} strokeWidth={1} />
            <text x={px(p)} y={MT + drawH + 16} textAnchor="middle" fontSize={Math.round(12 * textScale)} fill={CLR.label}>{roundN(p / 1000, 2)}m</text>
          </g>
        ))}
        <path d={fillPath} fill={fillColor} />
        <polyline points={polyPts} fill="none" stroke={lineColor} strokeWidth={2} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        
        {displayPeaks.map((peak, idx) => (
          <g key={`peak-${idx}`}>
            <circle cx={px(peak.x)} cy={py(peak.value)} r={3} fill={lineColor} />
            <text x={px(peak.x)} y={py(peak.value) > MT + 18 ? py(peak.value) - 8 : py(peak.value) + 16} textAnchor="middle" fontSize={Math.round(13 * textScale)} fontWeight={800} fill={lineColor}>
              {roundN(peak.value, 2)}
            </text>
          </g>
        ))}
        
        {reactions.map((r, i) => {
          const rx = px(r.x);
          const arrowTip = MT + drawH + 2;
          const arrowTail = arrowTip + 24;
          return (
            <g key={`rx-${i}`}>
              <defs>
                <marker id={`ra${i}`} viewBox="0 0 8 8" refX="6" refY="4" markerWidth={5} markerHeight={5} orient="auto-start-reverse">
                  <path d="M0 0 L8 4 L0 8 z" fill={CLR.reaction} />
                </marker>
              </defs>
              <line x1={rx} y1={arrowTail} x2={rx} y2={arrowTip} stroke={CLR.reaction} strokeWidth={2} markerEnd={`url(#ra${i})`} />
              <text x={rx} y={arrowTail + 14} textAnchor="middle" fontSize={Math.round(11 * textScale)} fill={CLR.reaction} fontWeight={700}>
                {roundN(Math.abs(r.value), 2)} kN
              </text>
            </g>
          );
        })}

        {hoverPt && (
          <g>
            <line 
              x1={px(hoverPt.x)} y1={MT} 
              x2={px(hoverPt.x)} y2={MT + drawH} 
              stroke="#64748b" strokeWidth={1} strokeDasharray="4 2" 
            />
            <circle cx={px(hoverPt.x)} cy={py(hoverPt.value)} r={4} fill={lineColor} stroke="#fff" strokeWidth={2} />
          </g>
        )}
      </svg>

      {hoverPt && (
        <div style={{
          position: 'absolute',
          left: `calc(${(px(hoverPt.x) / W) * 100}% + 8px)`,
          top: `${(py(hoverPt.value) / H) * 100}%`,
          transform: 'translateY(-100%)',
          background: '#1e293b',
          color: '#ffffff',
          padding: '6px 10px',
          borderRadius: '4px',
          fontSize: '11px',
          fontWeight: 600,
          pointerEvents: 'none',
          boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
          zIndex: 10,
          whiteSpace: 'nowrap'
        }}>
          <div>{roundN(hoverPt.value, 2)} {unit}</div>
          <div style={{ fontSize: '9px', color: '#94a3b8', marginTop: '2px' }}>x: {roundN(hoverPt.x / 1000, 2)}m</div>
        </div>
      )}
    </div>
  );
}
