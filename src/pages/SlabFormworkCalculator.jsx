import { useState, useEffect, useRef } from 'react';
import { Save, FileText, Play, CheckCircle, XCircle, AlertTriangle, Info, Layers, Grid, Columns, Rows, ArrowUpDown } from 'lucide-react';
import { calculateSlabFormwork } from '../engine/formwork/slabFormwork.js';
import styles from './SlabFormworkCalculator.module.css';
import slabDiagram from '../assets/slab-diagram.png';


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

  const [results, setResults] = useState(() => getSessionData('tempworks_slabformwork_results', null));
  const [calcError, setCalcError] = useState(null);

  useEffect(() => {
    const savedInputs = getSessionData('tempworks_slabformwork_inputs', null);
    const currentInputs = {
      slabThickness, unitWeight, panelType, panelThickness, panelDirection,
      secondaryBeamType, secondarySpacing, secondarySpanCount,
      primaryBeamType, primarySpacing, primarySpanCount, primarySpanLength,
      shoringSystem, shoringType, towerHeight
    };

    if (savedInputs && JSON.stringify(currentInputs) === JSON.stringify(savedInputs)) return;

    setResults(null);
    sessionStorage.removeItem('tempworks_slabformwork_results');
    saveSessionData('tempworks_slabformwork_inputs', currentInputs);
  }, [
    slabThickness, unitWeight, panelType, panelThickness, panelDirection,
    secondaryBeamType, secondarySpacing, secondarySpanCount,
    primaryBeamType, primarySpacing, primarySpanCount, primarySpanLength,
    shoringSystem, shoringType, towerHeight
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
        deflLimitRatio: 360,
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
          <select className={styles.projectSelect}>
            <option>Hospital Block A - Level 3</option>
          </select>
          <button className={styles.btnSecondary}>
            <Save size={16} /> Save
          </button>
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
                        <span>Support Span Length</span>
                        <div className={styles.unitInput}>
                          <input
                            type="number"
                            step="0.1"
                            value={primarySpanLength}
                            onChange={(e) => setPrimarySpanLength(e.target.value)}
                            onFocus={() => setActiveMarker('shoring')}
                          />
                          <span>m</span>
                        </div>
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
            <SlabPDFReportPreview results={results} inputs={{
              slabThickness, unitWeight, panelType, panelThickness, panelDirection,
              secondaryBeamType, secondarySpacing, secondarySpanCount,
              primaryBeamType, primarySpacing, primarySpanCount, primarySpanLength,
              shoringSystem, shoringType, towerHeight
            }} />
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
function InteractiveDiagram({ activeMarker, setActiveMarker, slabThickness, secondarySpacing, primarySpacing, primarySpanLength, secondaryBeamType, primaryBeamType, panelType, shoringType }) {
  return (
    <div className={styles.diagramWrapper}>
      {/* A stylized SVG isometric representation of the formwork system */}
      <svg viewBox="0 0 800 600" className={styles.svgDiagram}>
        <image href={slabDiagram} x="0" y="0" width="800" height="600" preserveAspectRatio="xMidYMid meet" />

        {/* Markers overlaid on the image */}
        {/* Slab Thickness (Right edge) */}
        <Marker x="680" y="160" active={activeMarker === 'slab'} onClick={() => setActiveMarker('slab')} text={`Slab: ${slabThickness} mm`} />
        
        {/* Distance between Secondary Beams (Top center) */}
        <Marker x="460" y="140" active={activeMarker === 'secondary'} onClick={() => setActiveMarker('secondary')} text={`Sec: ${secondarySpacing} m`} type="blue" />
        
        {/* Distance between Primary Beams (Left side) */}
        <Marker x="140" y="440" active={activeMarker === 'primary'} onClick={() => setActiveMarker('primary')} text={`Pri: ${primarySpacing} m`} type="blue" />
        
        {/* Distance between Primary Beam Supports (Bottom center) */}
        <Marker x="420" y="550" active={activeMarker === 'shoring'} onClick={() => setActiveMarker('shoring')} text={`Span: ${primarySpanLength} m`} />
        
        {/* Component Markers */}
        <Marker x="360" y="200" active={activeMarker === 'panel'} onClick={() => setActiveMarker('panel')} text={panelType} type="blue" />
        <Marker x="246" y="500" active={activeMarker === 'shoring'} onClick={() => setActiveMarker('shoring')} text={shoringType} type="blue" />
      </svg>
    </div>
  );
}

function Marker({ x, y, text, active, onClick, type = 'yellow' }) {
  const isYellow = type === 'yellow';
  const color = isYellow ? "#eab308" : "#2563eb";
  return (
    <g transform={`translate(${x}, ${y})`} onClick={onClick} style={{ cursor: 'pointer' }} className={styles.markerGroup}>
      {active && <circle cx="0" cy="0" r="18" fill={color} className={styles.pulseCircle} />}
      <circle cx="0" cy="0" r="9" fill={color} stroke="white" strokeWidth="2.5" style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.25))' }} />
      <g className={styles.tooltipGroup} style={{ transform: active ? 'scale(1.05)' : 'none', transformOrigin: '0px 0px', transition: 'transform 0.2s ease' }}>
        <rect x="14" y="-12" width={text.length * 7 + 10} height="22" rx="6" fill="white" stroke={active ? color : "#cbd5e1"} strokeWidth={active ? "1.5" : "1"} style={{ filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.06))' }} />
        <text x="19" y="3" fontSize="11" fill="#334155" fontWeight="600">{text}</text>
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
    <div className={styles.resultsGridLayout}>
      {/* Left Column — Check Results */}
      <div>
        <div className={styles.card}>
          <h3 className={styles.cardTitle}>Component Check Results</h3>
          <div className={styles.resultsTable}>
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
              <span className={styles.summaryValue}>{(maxUtilization * 100).toFixed(1)}%</span>
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
  );
}

function ResultRow({ component, check, applied, capacity, utilization, pass }) {
  const pct = (utilization * 100).toFixed(1);
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
function SlabPDFReportPreview({ results, inputs }) {
  const { areaLoad, panel, secondary, primary, tower, overallPass, maxUtilization } = results;
  const dateStr = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', paddingBottom: '40px', width: '100%' }}>
      {/* Export Action Area */}
      <div style={{ width: '210mm', display: 'flex', justifyContent: 'flex-end' }}>
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

      <div style={{
        width: '210mm',
        minHeight: '297mm',
        backgroundColor: '#ffffff',
        boxShadow: '0 4px 30px rgba(0, 0, 0, 0.15)',
        border: '1px solid #cbd5e1',
        padding: '28px 36px',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
        fontSize: '11px',
        color: '#1e293b',
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif'
      }}>
        {/* Header Block */}
        <div style={{ borderBottom: '2.5px solid #2563eb', paddingBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: '18px', fontWeight: 800, color: '#2563eb', letterSpacing: '0.02em' }}>TEMPWORKS</div>
            <div style={{ fontSize: '9px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Structural Design Solutions</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>Slab Formwork Check Report</div>
            <div style={{ fontSize: '9px', color: '#64748b', marginTop: '2px' }}>
              Standard: Manufacturer's Allowable Load Limits
            </div>
          </div>
        </div>

        {/* Metadata */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px' }}>
          <div>
            <div style={{ marginBottom: '4px' }}><span style={{ color: '#64748b', fontWeight: 600 }}>Project:</span> Hospital Block A - Level 3</div>
            <div><span style={{ color: '#64748b', fontWeight: 600 }}>Prepared By:</span> Engineer</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ marginBottom: '4px' }}><span style={{ color: '#64748b', fontWeight: 600 }}>Date:</span> {dateStr}</div>
            <div><span style={{ color: '#64748b', fontWeight: 600 }}>Status:</span> <span style={{ color: overallPass ? '#16a34a' : '#ef4444', fontWeight: 800 }}>{overallPass ? 'PASS' : 'FAIL'}</span></div>
          </div>
        </div>

        {/* Section 1: Inputs */}
        <div>
          <div style={{ fontSize: '12px', fontWeight: 800, color: '#0f172a', marginBottom: '8px', borderBottom: '1.5px solid #cbd5e1', paddingBottom: '2px' }}>1. DESIGN PARAMETERS & GEOMETRY</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '10px' }}>
            <tbody>
              <tr>
                <td style={{ padding: '4px 0', color: '#64748b', width: '35%' }}>Slab Thickness</td>
                <td style={{ padding: '4px 0', fontWeight: 600 }}>{inputs.slabThickness} mm</td>
                <td style={{ padding: '4px 0', color: '#64748b', width: '35%' }}>Secondary Beam Spacing</td>
                <td style={{ padding: '4px 0', fontWeight: 600 }}>{inputs.secondarySpacing} m</td>
              </tr>
              <tr>
                <td style={{ padding: '4px 0', color: '#64748b' }}>Concrete Density</td>
                <td style={{ padding: '4px 0', fontWeight: 600 }}>{inputs.unitWeight} kN/m³</td>
                <td style={{ padding: '4px 0', color: '#64748b' }}>Primary Beam Spacing</td>
                <td style={{ padding: '4px 0', fontWeight: 600 }}>{inputs.primarySpacing} m</td>
              </tr>
              <tr>
                <td style={{ padding: '4px 0', color: '#64748b' }}>Formwork Panel Type</td>
                <td style={{ padding: '4px 0', fontWeight: 600 }}>{inputs.panelType} ({inputs.panelThickness})</td>
                <td style={{ padding: '4px 0', color: '#64748b' }}>Shoring Grid Dimensions</td>
                <td style={{ padding: '4px 0', fontWeight: 600 }}>{inputs.primarySpacing} m × {inputs.primarySpanLength} m</td>
              </tr>
              <tr>
                <td style={{ padding: '4px 0', color: '#64748b' }}>Shoring System Type</td>
                <td style={{ padding: '4px 0', fontWeight: 600 }}>{inputs.shoringType} ({inputs.shoringSystem})</td>
                <td style={{ padding: '4px 0', color: '#64748b' }}>Shoring Height</td>
                <td style={{ padding: '4px 0', fontWeight: 600 }}>{inputs.towerHeight} m</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Section 2: Load Summary */}
        <div>
          <div style={{ fontSize: '12px', fontWeight: 800, color: '#0f172a', marginBottom: '8px', borderBottom: '1.5px solid #cbd5e1', paddingBottom: '2px' }}>2. DESIGN LOADS (SERVICE LAYER)</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '10px' }}>
            <tbody>
              <tr>
                <td style={{ padding: '4px 0', color: '#64748b' }}>Concrete Self-Weight</td>
                <td style={{ padding: '4px 0', fontWeight: 600, textAlign: 'right' }}>{areaLoad.concreteWeight.toFixed(2)} kN/m²</td>
              </tr>
              <tr>
                <td style={{ padding: '4px 0', color: '#64748b' }}>Construction / Formwork Load</td>
                <td style={{ padding: '4px 0', fontWeight: 600, textAlign: 'right' }}>{areaLoad.formworkLoad.toFixed(2)} kN/m²</td>
              </tr>
              <tr style={{ borderTop: '1px solid #cbd5e1', fontWeight: 700 }}>
                <td style={{ padding: '6px 0', color: '#0f172a' }}>Total Service Area Load</td>
                <td style={{ padding: '6px 0', textAlign: 'right', color: '#0f172a' }}>{areaLoad.totalAreaLoad.toFixed(2)} kN/m²</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Section 3: Component Results */}
        <div>
          <div style={{ fontSize: '12px', fontWeight: 800, color: '#0f172a', marginBottom: '8px', borderBottom: '1.5px solid #cbd5e1', paddingBottom: '2px' }}>3. COMPONENT UTILIZATION CHECKS</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
            <thead>
              <tr style={{ borderBottom: '1.5px solid #cbd5e1', color: '#64748b', fontWeight: 700, textAlign: 'left' }}>
                <th style={{ padding: '6px 4px' }}>Component</th>
                <th style={{ padding: '6px 4px' }}>Check Type</th>
                <th style={{ padding: '6px 4px' }}>Applied Force</th>
                <th style={{ padding: '6px 4px' }}>Allowable Capacity</th>
                <th style={{ padding: '6px 4px', textAlign: 'right' }}>Ratio</th>
                <th style={{ padding: '6px 4px', textAlign: 'right' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '6px 4px', fontWeight: 600 }}>Formwork Panel</td>
                <td style={{ padding: '6px 4px' }}>Bending</td>
                <td style={{ padding: '6px 4px' }}>{panel.bending.applied} kNm/m</td>
                <td style={{ padding: '6px 4px' }}>{panel.bending.capacity} kNm/m</td>
                <td style={{ padding: '6px 4px', textAlign: 'right', fontWeight: 600 }}>{(panel.bending.ratio*100).toFixed(1)}%</td>
                <td style={{ padding: '6px 4px', textAlign: 'right', color: panel.bending.pass ? '#16a34a' : '#ef4444', fontWeight: 700 }}>{panel.bending.pass ? 'PASS' : 'FAIL'}</td>
              </tr>
              <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td></td>
                <td style={{ padding: '6px 4px' }}>Deflection</td>
                <td style={{ padding: '6px 4px' }}>{panel.deflection.actual} mm</td>
                <td style={{ padding: '6px 4px' }}>{panel.deflection.allowable} mm</td>
                <td style={{ padding: '6px 4px', textAlign: 'right', fontWeight: 600 }}>{(panel.deflection.ratio*100).toFixed(1)}%</td>
                <td style={{ padding: '6px 4px', textAlign: 'right', color: panel.deflection.pass ? '#16a34a' : '#ef4444', fontWeight: 700 }}>{panel.deflection.pass ? 'PASS' : 'FAIL'}</td>
              </tr>
              <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '6px 4px', fontWeight: 600 }}>Secondary Beam</td>
                <td style={{ padding: '6px 4px' }}>Bending</td>
                <td style={{ padding: '6px 4px' }}>{secondary.bending.applied} kNm</td>
                <td style={{ padding: '6px 4px' }}>{secondary.bending.capacity} kNm</td>
                <td style={{ padding: '6px 4px', textAlign: 'right', fontWeight: 600 }}>{(secondary.bending.ratio*100).toFixed(1)}%</td>
                <td style={{ padding: '6px 4px', textAlign: 'right', color: secondary.bending.pass ? '#16a34a' : '#ef4444', fontWeight: 700 }}>{secondary.bending.pass ? 'PASS' : 'FAIL'}</td>
              </tr>
              <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td></td>
                <td style={{ padding: '6px 4px' }}>Shear</td>
                <td style={{ padding: '6px 4px' }}>{secondary.shear.applied} kN</td>
                <td style={{ padding: '6px 4px' }}>{secondary.shear.capacity} kN</td>
                <td style={{ padding: '6px 4px', textAlign: 'right', fontWeight: 600 }}>{(secondary.shear.ratio*100).toFixed(1)}%</td>
                <td style={{ padding: '6px 4px', textAlign: 'right', color: secondary.shear.pass ? '#16a34a' : '#ef4444', fontWeight: 700 }}>{secondary.shear.pass ? 'PASS' : 'FAIL'}</td>
              </tr>
              <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td></td>
                <td style={{ padding: '6px 4px' }}>Deflection</td>
                <td style={{ padding: '6px 4px' }}>{secondary.deflection.actual} mm</td>
                <td style={{ padding: '6px 4px' }}>{secondary.deflection.allowable} mm</td>
                <td style={{ padding: '6px 4px', textAlign: 'right', fontWeight: 600 }}>{(secondary.deflection.ratio*100).toFixed(1)}%</td>
                <td style={{ padding: '6px 4px', textAlign: 'right', color: secondary.deflection.pass ? '#16a34a' : '#ef4444', fontWeight: 700 }}>{secondary.deflection.pass ? 'PASS' : 'FAIL'}</td>
              </tr>
              <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '6px 4px', fontWeight: 600 }}>Primary Beam</td>
                <td style={{ padding: '6px 4px' }}>Bending</td>
                <td style={{ padding: '6px 4px' }}>{primary.bending.applied} kNm</td>
                <td style={{ padding: '6px 4px' }}>{primary.bending.capacity} kNm</td>
                <td style={{ padding: '6px 4px', textAlign: 'right', fontWeight: 600 }}>{(primary.bending.ratio*100).toFixed(1)}%</td>
                <td style={{ padding: '6px 4px', textAlign: 'right', color: primary.bending.pass ? '#16a34a' : '#ef4444', fontWeight: 700 }}>{primary.bending.pass ? 'PASS' : 'FAIL'}</td>
              </tr>
              <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td></td>
                <td style={{ padding: '6px 4px' }}>Shear</td>
                <td style={{ padding: '6px 4px' }}>{primary.shear.applied} kN</td>
                <td style={{ padding: '6px 4px' }}>{primary.shear.capacity} kN</td>
                <td style={{ padding: '6px 4px', textAlign: 'right', fontWeight: 600 }}>{(primary.shear.ratio*100).toFixed(1)}%</td>
                <td style={{ padding: '6px 4px', textAlign: 'right', color: primary.shear.pass ? '#16a34a' : '#ef4444', fontWeight: 700 }}>{primary.shear.pass ? 'PASS' : 'FAIL'}</td>
              </tr>
              <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td></td>
                <td style={{ padding: '6px 4px' }}>Deflection</td>
                <td style={{ padding: '6px 4px' }}>{primary.deflection.actual} mm</td>
                <td style={{ padding: '6px 4px' }}>{primary.deflection.allowable} mm</td>
                <td style={{ padding: '6px 4px', textAlign: 'right', fontWeight: 600 }}>{(primary.deflection.ratio*100).toFixed(1)}%</td>
                <td style={{ padding: '6px 4px', textAlign: 'right', color: primary.deflection.pass ? '#16a34a' : '#ef4444', fontWeight: 700 }}>{primary.deflection.pass ? 'PASS' : 'FAIL'}</td>
              </tr>
              <tr style={{ borderBottom: '1.5px solid #cbd5e1' }}>
                <td style={{ padding: '6px 4px', fontWeight: 600 }}>Shoring System</td>
                <td style={{ padding: '6px 4px' }}>Axial Load</td>
                <td style={{ padding: '6px 4px' }}>{tower.applied} kN</td>
                <td style={{ padding: '6px 4px' }}>{tower.capacity} kN</td>
                <td style={{ padding: '6px 4px', textAlign: 'right', fontWeight: 600 }}>{(tower.utilization*100).toFixed(1)}%</td>
                <td style={{ padding: '6px 4px', textAlign: 'right', color: tower.pass ? '#16a34a' : '#ef4444', fontWeight: 700 }}>{tower.pass ? 'PASS' : 'FAIL'}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Section 4: Design Summary */}
        <div style={{ marginTop: 'auto', borderTop: '2px solid #cbd5e1', paddingTop: '10px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 800, color: overallPass ? '#16a34a' : '#ef4444' }}>
                {overallPass ? '✓ DESIGN PASSES ALLOWABLE CAPACITIES' : '✗ DESIGN EXCEEDS ALLOWABLE CAPACITIES'}
              </div>
              <div style={{ fontSize: '9px', color: '#64748b', marginTop: '2px' }}>
                Verification calculations executed mathematically based on manufacturer specifications.
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>{(maxUtilization * 100).toFixed(1)}%</div>
              <div style={{ fontSize: '8px', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Max Component Utilization</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
