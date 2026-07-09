import { useState, useEffect, useRef } from 'react';
import { Save, FileText, Play, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { calculateSlabFormwork } from '../engine/formwork/slabFormwork.js';
import styles from './SlabFormworkCalculator.module.css';

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
    panelSpanCount: 3,
    panelDirection: 'Perpendicular to Secondary Beam',
    secondaryBeamType: 'WONDERBeam Alpha-Beam',
    secondarySpacing: 0.4,
    secondarySpanCount: 1,
    primaryBeamType: 'WONDERBeam Alpha-Beam',
    primarySpacing: 1.5,
    primarySpanCount: 1,
    shoringType: 'WonderCrab M',
    towerHeight: 3,
    towerGridX: 1.5,
    towerGridY: 1.5
  });

  const [activeTab, setActiveTab] = useState(() => getSessionData('tempworks_slabformwork_active_tab', 'configuration'));
  const [slabThickness, setSlabThickness] = useState(initialInputs.slabThickness);
  const [unitWeight, setUnitWeight] = useState(initialInputs.unitWeight);
  const [panelType, setPanelType] = useState(initialInputs.panelType);
  const [panelThickness, setPanelThickness] = useState(initialInputs.panelThickness);
  const [panelSpanCount, setPanelSpanCount] = useState(initialInputs.panelSpanCount);
  const [panelDirection, setPanelDirection] = useState(initialInputs.panelDirection);
  const [secondaryBeamType, setSecondaryBeamType] = useState(initialInputs.secondaryBeamType);
  const [secondarySpacing, setSecondarySpacing] = useState(initialInputs.secondarySpacing);
  const [secondarySpanCount, setSecondarySpanCount] = useState(initialInputs.secondarySpanCount);
  const [primaryBeamType, setPrimaryBeamType] = useState(initialInputs.primaryBeamType);
  const [primarySpacing, setPrimarySpacing] = useState(initialInputs.primarySpacing);
  const [primarySpanCount, setPrimarySpanCount] = useState(initialInputs.primarySpanCount);
  const [shoringType, setShoringType] = useState(initialInputs.shoringType);
  const [towerHeight, setTowerHeight] = useState(initialInputs.towerHeight);
  const [towerGridX, setTowerGridX] = useState(initialInputs.towerGridX);
  const [towerGridY, setTowerGridY] = useState(initialInputs.towerGridY);

  const [results, setResults] = useState(() => getSessionData('tempworks_slabformwork_results', null));
  const [calcError, setCalcError] = useState(null);

  // Save inputs and invalidate results if any input changes after initial load
  useEffect(() => {
    const savedInputs = getSessionData('tempworks_slabformwork_inputs', null);
    const currentInputs = {
      slabThickness,
      unitWeight,
      panelType,
      panelThickness,
      panelSpanCount,
      panelDirection,
      secondaryBeamType,
      secondarySpacing,
      secondarySpanCount,
      primaryBeamType,
      primarySpacing,
      primarySpanCount,
      shoringType,
      towerHeight,
      towerGridX,
      towerGridY
    };

    if (savedInputs && JSON.stringify(currentInputs) === JSON.stringify(savedInputs)) {
      return;
    }

    setResults(null);
    sessionStorage.removeItem('tempworks_slabformwork_results');
    saveSessionData('tempworks_slabformwork_inputs', currentInputs);
  }, [
    slabThickness,
    unitWeight,
    panelType,
    panelThickness,
    panelSpanCount,
    panelDirection,
    secondaryBeamType,
    secondarySpacing,
    secondarySpanCount,
    primaryBeamType,
    primarySpacing,
    primarySpanCount,
    shoringType,
    towerHeight,
    towerGridX,
    towerGridY
  ]);

  // Save active tab to session storage
  useEffect(() => {
    saveSessionData('tempworks_slabformwork_active_tab', activeTab);
  }, [activeTab]);

  const handleCalculate = () => {
    try {
      setCalcError(null);
      const res = calculateSlabFormwork({
        slabThickness: Number(slabThickness),
        concreteDensity: Number(unitWeight),
        panelType,
        panelThickness,
        panelSpanCount: Number(panelSpanCount),
        panelDirection,
        secondaryBeamType,
        secondarySpacing: Number(secondarySpacing),
        secondarySpanCount: Number(secondarySpanCount),
        primaryBeamType,
        primarySpacing: Number(primarySpacing),
        primarySpanCount: Number(primarySpanCount),
        shoringType,
        towerHeight: Number(towerHeight),
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
          <button className={styles.btnSecondary}>
            <FileText size={16} /> Export PDF
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
          <div className={styles.gridLayout}>
            {/* Left Column */}
            <div>
              <div className={styles.card}>
                <h3 className={styles.cardTitle}>1. Slab</h3>
                <div className={styles.formStack}>
                  <label className={styles.fieldInline}>
                    <span>Slab Thickness</span>
                    <div className={styles.unitInput}>
                      <input type="number" value={slabThickness} onChange={(e) => setSlabThickness(e.target.value)} />
                      <span>mm</span>
                    </div>
                  </label>
                  <label className={styles.fieldInline}>
                    <span>Unit Weight of Concrete</span>
                    <div className={styles.unitInput}>
                      <input type="number" value={unitWeight} onChange={(e) => setUnitWeight(e.target.value)} />
                      <span>kN/m3</span>
                    </div>
                  </label>
                </div>
              </div>
              <div className={styles.card}>
                <h3 className={styles.cardTitle}>2. Formwork Deck (Panel)</h3>
                <div className={styles.formStack}>
                  <label className={styles.field}>
                    <span>Panel Type</span>
                    <select value={panelType} onChange={(e) => setPanelType(e.target.value)}>
                      <option>WONDERBoard MG Series</option>
                      <option>Plywood 18 mm</option>
                      <option>Phenolic Board</option>
                    </select>
                  </label>
                  <label className={styles.field}>
                    <span>Panel Thickness</span>
                    <select value={panelThickness} onChange={(e) => setPanelThickness(e.target.value)}>
                      <option>12 mm</option>
                      <option>15 mm</option>
                      <option>18 mm</option>
                    </select>
                  </label>
                  <label className={styles.field}>
                    <span>Span Configuration</span>
                    <select value={panelSpanCount} onChange={(e) => setPanelSpanCount(Number(e.target.value))}>
                      <option value={1}>Single Span</option>
                      <option value={2}>Two Span</option>
                      <option value={3}>Three Span and above</option>
                    </select>
                  </label>
                  <label className={styles.field}>
                    <span>Panel Direction</span>
                    <select value={panelDirection} onChange={(e) => setPanelDirection(e.target.value)}>
                      <option>Perpendicular to Secondary Beam</option>
                      <option>Parallel to Secondary Beam</option>
                    </select>
                  </label>
                </div>
              </div>
              <div className={styles.card}>
                <h3 className={styles.cardTitle}>3. Secondary Beam</h3>
                <div className={styles.formStack}>
                  <label className={styles.field}>
                    <span>Beam Type</span>
                    <select value={secondaryBeamType} onChange={(e) => setSecondaryBeamType(e.target.value)}>
                      <option>WONDERBeam Alpha-Beam</option>
                      <option>Timber H20 Beam</option>
                      <option>Aluminium Joist</option>
                    </select>
                  </label>
                  <label className={styles.field}>
                    <span>Span Configuration</span>
                    <select value={secondarySpanCount} onChange={(e) => setSecondarySpanCount(Number(e.target.value))}>
                      <option value={1}>Single Span</option>
                      <option value={2}>Two Span</option>
                      <option value={3}>Three Span and above</option>
                    </select>
                  </label>
                  <label className={styles.fieldInline}>
                    <span>Spacing (Center to Center)</span>
                    <div className={styles.unitInput}>
                      <input type="number" step="0.05" value={secondarySpacing} onChange={(e) => setSecondarySpacing(e.target.value)} />
                      <span>m</span>
                    </div>
                  </label>
                </div>
              </div>
              <div className={styles.card}>
                <h3 className={styles.cardTitle}>4. Primary Beam</h3>
                <div className={styles.formStack}>
                  <label className={styles.field}>
                    <span>Beam Type</span>
                    <select value={primaryBeamType} onChange={(e) => setPrimaryBeamType(e.target.value)}>
                      <option>WONDERBeam Alpha-Beam</option>
                      <option>Timber H20 Beam</option>
                      <option>Aluminium Joist</option>
                    </select>
                  </label>
                  <label className={styles.field}>
                    <span>Span Configuration</span>
                    <select value={primarySpanCount} onChange={(e) => setPrimarySpanCount(Number(e.target.value))}>
                      <option value={1}>Single Span</option>
                      <option value={2}>Two Span</option>
                      <option value={3}>Three Span and above</option>
                    </select>
                  </label>
                  <label className={styles.fieldInline}>
                    <span>Spacing (Center to Center)</span>
                    <div className={styles.unitInput}>
                      <input type="number" step="0.1" value={primarySpacing} onChange={(e) => setPrimarySpacing(e.target.value)} />
                      <span>m</span>
                    </div>
                  </label>
                </div>
              </div>
              <div className={styles.card}>
                <h3 className={styles.cardTitle}>5. Shoring (Tower)</h3>
                <div className={styles.formStack}>
                  <label className={styles.field}>
                    <span>Shoring Type</span>
                    <select value={shoringType} onChange={(e) => setShoringType(e.target.value)}>
                      <option>WonderCrab M</option>
                      <option>Ringlock Tower</option>
                      <option>Frame Tower</option>
                    </select>
                  </label>
                  <label className={styles.fieldInline}>
                    <span>Tower Height</span>
                    <div className={styles.unitInput}>
                      <input type="number" step="0.1" value={towerHeight} onChange={(e) => setTowerHeight(e.target.value)} />
                      <span>m</span>
                    </div>
                  </label>
                  <div className={styles.gridSpacingRow}>
                    <span>Grid Spacing (X x Y)</span>
                    <div className={styles.gridInputs}>
                      <select value={towerGridX} onChange={(e) => setTowerGridX(e.target.value)} style={{ padding: '6px' }}>
                        <option value={0.7}>0.7 m</option>
                        <option value={0.9}>0.9 m</option>
                        <option value={1.2}>1.2 m</option>
                        <option value={1.5}>1.5 m</option>
                        <option value={1.8}>1.8 m</option>
                      </select>
                      <strong>x</strong>
                      <select value={towerGridY} onChange={(e) => setTowerGridY(e.target.value)} style={{ padding: '6px' }}>
                        <option value={0.7}>0.7 m</option>
                        <option value={0.9}>0.9 m</option>
                        <option value={1.2}>1.2 m</option>
                        <option value={1.5}>1.5 m</option>
                        <option value={1.8}>1.8 m</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            {/* Right Column */}
            <div>
              <div className={styles.card}>
                <h3 className={styles.cardTitle}>System Layout (Plan View)</h3>
                <PlanViewDiagram secondarySpacing={secondarySpacing} primarySpacing={primarySpacing} />
              </div>
              <div className={styles.card}>
                <h3 className={styles.cardTitle}>System Elevation (Typical Section)</h3>
                <ElevationDiagram
                  slabThickness={slabThickness}
                  panelThickness={panelThickness}
                  towerHeight={towerHeight}
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'results' && (
          <ResultsTab results={results} />
        )}

        {activeTab === 'report' && (
          <div className={styles.card} style={{ maxWidth: '800px', margin: '0 auto', width: '100%' }}>
            <h3 className={styles.cardTitle}>Generated Report Preview</h3>
            <div className={styles.placeholderBox} style={{ minHeight: '600px' }}>
              Full PDF Report Preview
            </div>
          </div>
        )}
      </div>
    </div>
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

            {/* Panel */}
            <ResultRow
              component="Formwork Panel"
              check="Bending"
              applied={`${panel.bending.applied} kNm/m`}
              capacity={`${panel.bending.capacity} kNm/m`}
              utilization={panel.bending.ratio}
              pass={panel.bending.pass}
            />
            <ResultRow
              component=""
              check="Deflection"
              applied={`${panel.deflection.actual} mm`}
              capacity={`${panel.deflection.allowable} mm`}
              utilization={panel.deflection.ratio}
              pass={panel.deflection.pass}
            />

            {/* Secondary Beam */}
            <ResultRow
              component="Secondary Beam"
              check="Bending"
              applied={`${secondary.bending.applied} kNm`}
              capacity={`${secondary.bending.capacity} kNm`}
              utilization={secondary.bending.ratio}
              pass={secondary.bending.pass}
            />
            <ResultRow
              component=""
              check="Shear"
              applied={`${secondary.shear.applied} kN`}
              capacity={`${secondary.shear.capacity} kN`}
              utilization={secondary.shear.ratio}
              pass={secondary.shear.pass}
            />
            <ResultRow
              component=""
              check="Deflection"
              applied={`${secondary.deflection.actual} mm`}
              capacity={`${secondary.deflection.allowable} mm`}
              utilization={secondary.deflection.ratio}
              pass={secondary.deflection.pass}
            />

            {/* Primary Beam */}
            <ResultRow
              component="Primary Beam"
              check="Bending"
              applied={`${primary.bending.applied} kNm`}
              capacity={`${primary.bending.capacity} kNm`}
              utilization={primary.bending.ratio}
              pass={primary.bending.pass}
            />
            <ResultRow
              component=""
              check="Shear"
              applied={`${primary.shear.applied} kN`}
              capacity={`${primary.shear.capacity} kN`}
              utilization={primary.shear.ratio}
              pass={primary.shear.pass}
            />
            <ResultRow
              component=""
              check="Deflection"
              applied={`${primary.deflection.actual} mm`}
              capacity={`${primary.deflection.allowable} mm`}
              utilization={primary.deflection.ratio}
              pass={primary.deflection.pass}
            />

            {/* Tower */}
            <ResultRow
              component="Shoring Tower"
              check="Axial Load"
              applied={`${tower.applied} kN`}
              capacity={`${tower.capacity} kN`}
              utilization={tower.utilization}
              pass={tower.pass}
            />
          </div>
        </div>

        <div className={styles.card}>
          <h3 className={styles.cardTitle}>Notes</h3>
          <ul className={styles.notesList}>
            <li>Secondary beam: {secondary.spanCount}-span, line load = {secondary.lineLoad} kN/m</li>
            <li>Primary beam: {primary.spanCount}-span, line load = {primary.lineLoad} kN/m</li>
            <li>Max secondary reaction = {secondary.maxReaction} kN</li>
            <li>Max primary reaction = {primary.maxReaction} kN (tower load excl. self-weight)</li>
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
              <span className={styles.summaryLabel}>Max Tower Reaction</span>
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

// ────────────────────────────────────────────────────────────────────────────
// Result Row Component
// ────────────────────────────────────────────────────────────────────────────

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

// ────────────────────────────────────────────────────────────────────────────
// Diagram Components (preserved from original)
// ────────────────────────────────────────────────────────────────────────────

function PlanViewDiagram({ secondarySpacing, primarySpacing }) {
  const secondaryLines = Array.from({ length: 8 });
  const primaryLines = Array.from({ length: 5 });
  const towers = Array.from({ length: 7 });

  return (
    <div className={styles.planDiagram}>
      <div className={styles.planGrid}>
        {secondaryLines.map((_, index) => <span className={styles.secondaryBeam} style={{ top: `${index * 14.2}%` }} key={`s-${index}`} />)}
        {primaryLines.map((_, index) => <span className={styles.primaryBeam} style={{ left: `${index * 25}%` }} key={`p-${index}`} />)}
        {towers.map((_, index) => <span className={styles.towerNode} style={{ left: `${index * 16.66}%` }} key={`t-${index}`} />)}
      </div>
      <div className={styles.dimensionY}>
        <span>Secondary Beam Spacing</span>
        <strong>{secondarySpacing} m</strong>
      </div>
      <div className={styles.dimensionX}>
        <span>Primary Beam Spacing</span>
        <strong>{primarySpacing} m</strong>
      </div>
      <div className={styles.legend}>
        <span><i className={styles.legendSecondary} /> Secondary Beam</span>
        <span><i className={styles.legendPrimary} /> Primary Beam</span>
        <span><i className={styles.legendTower} /> Shoring Tower</span>
      </div>
    </div>
  );
}

function ElevationDiagram({ slabThickness, panelThickness, towerHeight }) {
  return (
    <div className={styles.elevationDiagram}>
      <div className={styles.elevationStack}>
        <div className={styles.slabLayer} />
        <div className={styles.deckLayer} />
        <div className={styles.secondaryLayer} />
        <div className={styles.primaryLayer} />
        <div className={styles.towerFrame}>
          {Array.from({ length: 4 }).map((_, index) => (
            <div className={styles.towerLeg} key={`leg-${index}`}>
              <span />
              <span />
              <span />
            </div>
          ))}
          <span className={styles.braceLeft} />
          <span className={styles.braceRight} />
        </div>
        <div className={styles.baseLayer} />
      </div>
      <div className={styles.elevationLabels}>
        <span>Slab Thickness <strong>{slabThickness} mm</strong></span>
        <span>Formwork Deck <strong>{panelThickness}</strong></span>
        <span>Secondary Beam <strong>Alpha-Beam</strong></span>
        <span>Primary Beam <strong>Alpha-Beam</strong></span>
        <span>Shoring Tower <strong>WonderCrab M</strong></span>
      </div>
      <div className={styles.heightDimension}>
        <strong>{towerHeight} m</strong>
      </div>
    </div>
  );
}
