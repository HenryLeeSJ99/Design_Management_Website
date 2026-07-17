import { useState, useEffect, useRef } from 'react';
import { FileText, Play, CheckCircle, XCircle, AlertTriangle, Grid, Columns, Rows, Link2, Download, Share2 } from 'lucide-react';
import { isIOS, shareReportPdf } from '../utils/reportPdf';
import { calculateWallFormworkDesign } from '../engine/formwork/wallFormworkDesign.js';
import { calculatePressureCiria108 } from '../engine/formwork/wallFormwork.js';
import { FORMWORK_BEAMS, FORMWORK_PANELS, TIE_RODS, getFormworkBeam } from '../engine/materials/formworkBeams.js';
import styles from './SlabFormworkCalculator.module.css';
// Responsive A4 sheet scaling shared with the Concrete Pressure report
import wallStyles from './WallFormworkCalculator.module.css';
import SavedDesigns from '../components/SavedDesigns';
import plytecLogoUrl from '../assets/PLYTEC_Logo.svg';

// sessionStorage keys that make up a saved design snapshot
const DESIGN_SESSION_KEYS = [
  'tempworks_wallfwdesign_inputs',
  'tempworks_wallfwdesign_results',
  'tempworks_wallfwdesign_project_id',
  'tempworks_wallfwdesign_calculated_by',
  'tempworks_wallfwdesign_verification_date',
];

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

const cleanNumericInput = (val) => {
  if (val === '') return '';
  if (/^-?0[0-9]/.test(val)) {
    const hasMinus = val.startsWith('-');
    const cleanVal = hasMinus ? val.slice(1) : val;
    const stripped = cleanVal.replace(/^0+/, '') || '0';
    return hasMinus ? '-' + stripped : stripped;
  }
  return val;
};

/**
 * Recompute the CIRIA 108 design pressure from the Concrete Pressure
 * calculator's session inputs, so the two wall formwork pages agree.
 * Returns null when that calculator has no session yet.
 */
function pressureFromConcreteCalc() {
  const wf = getSessionData('tempworks_wallformwork_inputs', null);
  if (!wf) return null;
  const C1 = wf.boundary === 'wall' ? 1.0 : 1.5;
  const C2 = wf.concreteType === 'normal' ? 0.3 : 0.45;
  if (wf.inputMode === 'pressure') return Number(wf.maxPressure) || null;
  const P = calculatePressureCiria108({
    D: Number(wf.density),
    T: Number(wf.temp),
    H: Number(wf.pourHeight),
    h: Number(wf.pourHeight),
    R: Number(wf.rateOfRise),
    C1,
    C2,
  });
  return Number.isFinite(P) ? Math.round(P * 100) / 100 : null;
}

/**
 * @param initialTab  Which tab to open on. The dashboard's report renderer
 *   passes "report" to capture this calculator's report during a compile.
 */
export default function WallPanelDesignCalculator({ initialTab }) {
  const initialInputs = getSessionData('tempworks_wallfwdesign_inputs', {
    designPressure: 60,
    panelType: 'WONDERBoard MG Series',
    panelThickness: '18 mm',
    secondaryBeamType: 'H20',
    secondarySpacing: 0.25,
    secondarySpanCount: 3,
    primaryBeamType: 'H20',
    primaryMembers: 2,
    primarySpacing: 0.9,
    primarySpanCount: 3,
    tieRodType: 'DW15 Tie Rod (Ø15 mm)',
    tieSpacing: 0.6,
    deflectionLimit: 360,
  });

  const [activeTab, setActiveTab] = useState(
    () => initialTab || getSessionData('tempworks_wallfwdesign_active_tab', 'configuration'),
  );
  const tabsWrapperRef = useRef(null);
  const reportRef = useRef(null);

  // Auto-scroll active tab into middle of scroll window on mobile/tablet viewports
  useEffect(() => {
    if (tabsWrapperRef.current) {
      const activeTabEl = tabsWrapperRef.current.querySelector(`.${styles.active}`);
      if (activeTabEl) {
        activeTabEl.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
          inline: 'center'
        });
      }
    }
  }, [activeTab]);

  const [designPressure, setDesignPressure] = useState(initialInputs.designPressure);
  const [panelType, setPanelType] = useState(initialInputs.panelType);
  const [panelThickness, setPanelThickness] = useState(initialInputs.panelThickness);
  const [secondaryBeamType, setSecondaryBeamType] = useState(initialInputs.secondaryBeamType);
  const [secondarySpacing, setSecondarySpacing] = useState(initialInputs.secondarySpacing);
  const [secondarySpanCount, setSecondarySpanCount] = useState(initialInputs.secondarySpanCount);
  const [primaryBeamType, setPrimaryBeamType] = useState(initialInputs.primaryBeamType);
  const [primaryMembers, setPrimaryMembers] = useState(initialInputs.primaryMembers);
  const [primarySpacing, setPrimarySpacing] = useState(initialInputs.primarySpacing);
  const [primarySpanCount, setPrimarySpanCount] = useState(initialInputs.primarySpanCount);
  const [tieRodType, setTieRodType] = useState(initialInputs.tieRodType);
  const [tieSpacing, setTieSpacing] = useState(initialInputs.tieSpacing);
  const [deflectionLimit, setDeflectionLimit] = useState(initialInputs.deflectionLimit || 360);

  // Beam types come from the shared system-beam library — migrate legacy
  // names held in older sessions to their shared-library equivalents.
  useEffect(() => {
    const migrate = (name) => getFormworkBeam(name)?.name || 'H20';
    if (!FORMWORK_BEAMS[secondaryBeamType]) setSecondaryBeamType(migrate(secondaryBeamType));
    if (!FORMWORK_BEAMS[primaryBeamType]) setPrimaryBeamType(migrate(primaryBeamType));
  }, [secondaryBeamType, primaryBeamType]);

  const [projectId, setProjectId] = useState(() => getSessionData('tempworks_wallfwdesign_project_id', 'TW-2026-WALL'));
  const [calculatedBy, setCalculatedBy] = useState(() => getSessionData('tempworks_wallfwdesign_calculated_by', 'Engineer'));
  const [verificationDate, setVerificationDate] = useState(() => getSessionData('tempworks_wallfwdesign_verification_date', new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })));

  useEffect(() => {
    saveSessionData('tempworks_wallfwdesign_project_id', projectId);
  }, [projectId]);

  useEffect(() => {
    saveSessionData('tempworks_wallfwdesign_calculated_by', calculatedBy);
  }, [calculatedBy]);

  useEffect(() => {
    saveSessionData('tempworks_wallfwdesign_verification_date', verificationDate);
  }, [verificationDate]);

  const [results, setResults] = useState(() => getSessionData('tempworks_wallfwdesign_results', null));
  const [calcError, setCalcError] = useState(null);

  // Any input change invalidates stale results, then persists the inputs.
  useEffect(() => {
    const savedInputs = getSessionData('tempworks_wallfwdesign_inputs', null);
    const currentInputs = {
      designPressure, panelType, panelThickness,
      secondaryBeamType, secondarySpacing, secondarySpanCount,
      primaryBeamType, primaryMembers, primarySpacing, primarySpanCount,
      tieRodType, tieSpacing, deflectionLimit,
    };

    if (savedInputs && JSON.stringify(currentInputs) === JSON.stringify(savedInputs)) return;

    setResults(null);
    sessionStorage.removeItem('tempworks_wallfwdesign_results');
    saveSessionData('tempworks_wallfwdesign_inputs', currentInputs);
  }, [
    designPressure, panelType, panelThickness,
    secondaryBeamType, secondarySpacing, secondarySpanCount,
    primaryBeamType, primaryMembers, primarySpacing, primarySpanCount,
    tieRodType, tieSpacing, deflectionLimit,
  ]);

  useEffect(() => {
    saveSessionData('tempworks_wallfwdesign_active_tab', activeTab);
  }, [activeTab]);

  const ciriaPressure = pressureFromConcreteCalc();

  const handleImportPressure = () => {
    if (ciriaPressure !== null) setDesignPressure(ciriaPressure);
  };

  const handleCalculate = () => {
    try {
      setCalcError(null);
      const res = calculateWallFormworkDesign({
        designPressure: Number(designPressure),
        panelType,
        panelThickness,
        panelSpanCount: 3, // Always multi-span
        secondaryBeamType,
        secondarySpacing: Number(secondarySpacing),
        secondarySpanCount: Number(secondarySpanCount),
        primaryBeamType,
        primaryMembers: Number(primaryMembers),
        primarySpacing: Number(primarySpacing),
        primarySpanCount: Number(primarySpanCount),
        tieRodType,
        tieSpacing: Number(tieSpacing),
        deflLimitRatio: Number(deflectionLimit),
      });
      setResults(res);
      saveSessionData('tempworks_wallfwdesign_results', res);
      setActiveTab('results');
    } catch (err) {
      setCalcError(err.message);
      console.error('Calculation error:', err);
    }
  };

  const handlePrint = () => {
    const content = reportRef.current;
    if (!content) return;
    // iOS Safari crashes on window.open + print() — share a PDF instead
    if (isIOS()) {
      shareReportPdf(content, 'TempWorks-Wall-Formwork-Design-Report.pdf');
      return;
    }
    const printWindow = window.open('', '_blank', 'width=900,height=1200');
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>TempWorks – Wall Formwork Design Check Report</title>
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

  return (
    <div className={styles.pageContainer}>
      <header className={styles.pageHeader}>
        <div className={styles.titleBlock}>
          <h1>Wall Formwork Design Check</h1>
          <p>Panel, stud, waler and tie rod verification</p>
        </div>
        <div className={styles.headerActions}>
          <SavedDesigns
            calculator="wall-formwork-design"
            title="Panel & Tie Design"
            sessionKeys={DESIGN_SESSION_KEYS}
          />
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

      <div ref={tabsWrapperRef} className={styles.tabsWrapper}>
        <div className={styles.tabs} role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'configuration'}
            className={`${styles.tab} ${activeTab === 'configuration' ? styles.active : ''}`}
            onClick={() => setActiveTab('configuration')}
          >
            System Configuration
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'results'}
            className={`${styles.tab} ${activeTab === 'results' ? styles.active : ''}`}
            onClick={() => setActiveTab('results')}
          >
            Check Results
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'report'}
            className={`${styles.tab} ${activeTab === 'report' ? styles.active : ''}`}
            onClick={() => setActiveTab('report')}
          >
            Report
          </button>
        </div>
      </div>

      <div className={styles.contentArea}>
        {activeTab === 'configuration' && (
          <div className={styles.diagramLayout}>
            {/* Form face elevation diagram */}
            <div className={styles.interactiveDiagramContainer}>
              <WallFormDiagram
                secondarySpacing={secondarySpacing}
                primarySpacing={primarySpacing}
                tieSpacing={tieSpacing}
                primaryMembers={primaryMembers}
              />
            </div>

            {/* Input Panel */}
            <div className={styles.inputPanel}>
              <div className={styles.card}>
                <div className={styles.cardHeader}>Configuration details</div>

                <div className={styles.formContainer}>
                  {/* Design Pressure */}
                  <div className={styles.formSection}>
                    <div className={styles.sectionHeader}>
                      <Grid size={16} className={styles.sectionIcon} />
                      <h3 className={styles.panelTitle}>Design Pressure</h3>
                    </div>
                    <div className={styles.formStack}>
                      <label className={styles.fieldInline}>
                        <span>Concrete Pressure Pmax</span>
                        <div className={styles.unitInput}>
                          <input
                            type="number"
                            step="0.5"
                            value={designPressure}
                            onChange={(e) => setDesignPressure(cleanNumericInput(e.target.value))}
                          />
                          <span>kN/m²</span>
                        </div>
                      </label>
                      {ciriaPressure !== null && (
                        <button
                          type="button"
                          className={styles.btnSecondary}
                          onClick={handleImportPressure}
                          title="Use the Pmax computed in the Concrete Pressure calculator"
                        >
                          <Link2 size={14} /> Use CIRIA Pmax ({ciriaPressure} kN/m²)
                        </button>
                      )}
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
                      <p className={styles.noteText}>* Pressure applied as a uniform envelope over the checked band (conservative).</p>
                    </div>
                  </div>

                  {/* Wall Panel */}
                  <div className={styles.formSection}>
                    <div className={styles.sectionHeader}>
                      <Grid size={16} className={styles.sectionIcon} />
                      <h3 className={styles.panelTitle}>Wall Panel</h3>
                    </div>
                    <div className={styles.formStack}>
                      <label className={styles.field}>
                        <span>Panel Type</span>
                        <select value={panelType} onChange={(e) => setPanelType(e.target.value)}>
                          {Object.keys(FORMWORK_PANELS).map((p) => (
                            <option key={p}>{p}</option>
                          ))}
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
                      <p className={styles.noteText}>* Panel assumed as multi-span configuration over the studs.</p>
                    </div>
                  </div>

                  {/* Secondary Beams (Studs) */}
                  <div className={styles.formSection}>
                    <div className={styles.sectionHeader}>
                      <Columns size={16} className={styles.sectionIcon} />
                      <h3 className={styles.panelTitle}>Secondary Beams (Studs)</h3>
                    </div>
                    <div className={styles.formStack}>
                      <label className={styles.field}>
                        <span>Beam Type</span>
                        <select value={secondaryBeamType} onChange={(e) => setSecondaryBeamType(e.target.value)}>
                          {Object.values(FORMWORK_BEAMS).map((b) => (
                            <option key={b.name} value={b.name}>{b.name} ({b.company})</option>
                          ))}
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
                        <span>Spacing (C/C)</span>
                        <div className={styles.unitInput}>
                          <input
                            type="number"
                            step="0.05"
                            value={secondarySpacing}
                            onChange={(e) => setSecondarySpacing(cleanNumericInput(e.target.value))}
                          />
                          <span>m</span>
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* Primary Beams (Walers) */}
                  <div className={styles.formSection}>
                    <div className={styles.sectionHeader}>
                      <Rows size={16} className={styles.sectionIcon} />
                      <h3 className={styles.panelTitle}>Primary Beams (Walers)</h3>
                    </div>
                    <div className={styles.formStack}>
                      <label className={styles.field}>
                        <span>Beam Type</span>
                        <select value={primaryBeamType} onChange={(e) => setPrimaryBeamType(e.target.value)}>
                          {Object.values(FORMWORK_BEAMS).map((b) => (
                            <option key={b.name} value={b.name}>{b.name} ({b.company})</option>
                          ))}
                        </select>
                      </label>
                      <label className={styles.field}>
                        <span>Members per Waler</span>
                        <select value={primaryMembers} onChange={(e) => setPrimaryMembers(Number(e.target.value))}>
                          <option value={1}>Single</option>
                          <option value={2}>Double</option>
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
                        <span>Waler Spacing (C/C)</span>
                        <div className={styles.unitInput}>
                          <input
                            type="number"
                            step="0.05"
                            value={primarySpacing}
                            onChange={(e) => setPrimarySpacing(cleanNumericInput(e.target.value))}
                          />
                          <span>m</span>
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* Tie Rods */}
                  <div className={styles.formSection}>
                    <div className={styles.sectionHeader}>
                      <Download size={16} className={styles.sectionIcon} />
                      <h3 className={styles.panelTitle}>Tie Rods</h3>
                    </div>
                    <div className={styles.formStack}>
                      <label className={styles.field}>
                        <span>Tie Rod Type</span>
                        <select value={tieRodType} onChange={(e) => setTieRodType(e.target.value)}>
                          {Object.values(TIE_RODS).map((t) => (
                            <option key={t.name} value={t.name}>{t.name} — SWL {t.capacity} kN</option>
                          ))}
                        </select>
                      </label>
                      <label className={styles.fieldInline}>
                        <span>Tie Spacing (C/C)</span>
                        <div className={styles.unitInput}>
                          <input
                            type="number"
                            step="0.05"
                            value={tieSpacing}
                            onChange={(e) => setTieSpacing(cleanNumericInput(e.target.value))}
                          />
                          <span>m</span>
                        </div>
                      </label>
                      <div className={styles.infoBox}>
                        Tie tributary area ≈ <strong>{(Number(tieSpacing) * Number(primarySpacing)).toFixed(2)} m²</strong> → {(Number(designPressure) * Number(tieSpacing) * Number(primarySpacing)).toFixed(1)} kN
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
            <WallDesignReport
              results={results}
              inputs={{
                designPressure, panelType, panelThickness,
                secondaryBeamType, secondarySpacing, secondarySpanCount,
                primaryBeamType, primaryMembers, primarySpacing, primarySpanCount,
                tieRodType, tieSpacing, deflectionLimit,
              }}
              projectId={projectId}
              setProjectId={setProjectId}
              calculatedBy={calculatedBy}
              setCalculatedBy={setCalculatedBy}
              verificationDate={verificationDate}
              setVerificationDate={setVerificationDate}
              reportRef={reportRef}
              handlePrint={handlePrint}
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
// Form face elevation diagram
// ────────────────────────────────────────────────────────────────────────────
function WallFormDiagram({ secondarySpacing, primarySpacing, tieSpacing, primaryMembers }) {
  // Elevation of the form face: vertical studs, horizontal walers, tie
  // positions at waler/tie-grid intersections. Purely illustrative — the
  // spacing labels carry the real numbers.
  const W = 800;
  const H = 600;
  const face = { x: 90, y: 70, w: 620, h: 440 };
  const studXs = [0, 1, 2, 3, 4, 5, 6].map((i) => face.x + 30 + i * ((face.w - 60) / 6));
  const walerYs = [0, 1, 2, 3].map((i) => face.y + 45 + i * ((face.h - 90) / 3));
  const tieXs = [studXs[1], studXs[3], studXs[5]];
  const isDouble = Number(primaryMembers) === 2;

  return (
    <div className={styles.diagramWrapper}>
      <svg viewBox={`0 0 ${W} ${H}`} className={styles.svgDiagram}>
        {/* Panel face */}
        <rect x={face.x} y={face.y} width={face.w} height={face.h} rx="6" fill="#fef9c3" stroke="#ca8a04" strokeWidth="2" />
        <text x={face.x + 10} y={face.y + 22} fontSize="14" fontWeight="700" fill="#a16207">Wall Panel (facing)</text>

        {/* Studs (vertical secondary beams) */}
        {studXs.map((x) => (
          <rect key={x} x={x - 7} y={face.y + 8} width="14" height={face.h - 16} rx="3" fill="#93c5fd" stroke="#2563eb" strokeWidth="1.5" />
        ))}
        <text x={studXs[0] - 12} y={face.y - 10} fontSize="14" fontWeight="700" fill="#2563eb">Studs (Secondary)</text>

        {/* Walers (horizontal primary beams, single or double) */}
        {walerYs.map((y) => (
          <g key={y}>
            <rect x={face.x - 24} y={y - (isDouble ? 12 : 6)} width={face.w + 48} height="11" rx="3" fill="#fca5a5" stroke="#dc2626" strokeWidth="1.5" />
            {isDouble && (
              <rect x={face.x - 24} y={y + 3} width={face.w + 48} height="11" rx="3" fill="#fca5a5" stroke="#dc2626" strokeWidth="1.5" />
            )}
          </g>
        ))}
        <text x={face.x + face.w - 165} y={face.y - 10} fontSize="14" fontWeight="700" fill="#dc2626">Walers (Primary){isDouble ? ' ×2' : ''}</text>

        {/* Tie rods at waler / tie-grid intersections */}
        {walerYs.map((y) =>
          tieXs.map((x) => (
            <g key={`${x}-${y}`}>
              <circle cx={x} cy={y} r="9" fill="#f8fafc" stroke="#0f172a" strokeWidth="2.5" />
              <circle cx={x} cy={y} r="3" fill="#0f172a" />
            </g>
          ))
        )}
        <text x={face.x + 10} y={face.y + face.h + 28} fontSize="14" fontWeight="700" fill="#0f172a">⊙ Tie rod positions</text>

        {/* Dimension: stud spacing */}
        <g stroke="#2563eb" strokeWidth="1.5">
          <line x1={studXs[4]} y1={face.y + face.h + 14} x2={studXs[5]} y2={face.y + face.h + 14} markerEnd="none" />
          <line x1={studXs[4]} y1={face.y + face.h + 8} x2={studXs[4]} y2={face.y + face.h + 20} />
          <line x1={studXs[5]} y1={face.y + face.h + 8} x2={studXs[5]} y2={face.y + face.h + 20} />
        </g>
        <text x={(studXs[4] + studXs[5]) / 2} y={face.y + face.h + 34} fontSize="13" fontWeight="700" fill="#2563eb" textAnchor="middle">{secondarySpacing} m</text>

        {/* Dimension: waler spacing */}
        <g stroke="#dc2626" strokeWidth="1.5">
          <line x1={face.x - 44} y1={walerYs[1]} x2={face.x - 44} y2={walerYs[2]} />
          <line x1={face.x - 50} y1={walerYs[1]} x2={face.x - 38} y2={walerYs[1]} />
          <line x1={face.x - 50} y1={walerYs[2]} x2={face.x - 38} y2={walerYs[2]} />
        </g>
        <text x={face.x - 56} y={(walerYs[1] + walerYs[2]) / 2 + 4} fontSize="13" fontWeight="700" fill="#dc2626" textAnchor="end">{primarySpacing} m</text>

        {/* Dimension: tie spacing */}
        <g stroke="#0f172a" strokeWidth="1.5">
          <line x1={tieXs[0]} y1={face.y - 32} x2={tieXs[1]} y2={face.y - 32} />
          <line x1={tieXs[0]} y1={face.y - 38} x2={tieXs[0]} y2={face.y - 26} />
          <line x1={tieXs[1]} y1={face.y - 38} x2={tieXs[1]} y2={face.y - 26} />
        </g>
        <text x={(tieXs[0] + tieXs[1]) / 2} y={face.y - 42} fontSize="13" fontWeight="700" fill="#0f172a" textAnchor="middle">Ties @ {tieSpacing} m</text>
      </svg>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Results Tab
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

  const { designPressure, panel, secondary, primary, tie, overallPass, maxUtilization } = results;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', minWidth: 0 }}>
      <div className={styles.resultsGridLayout}>
        {/* Left Column — Check Results */}
        <div>
          <div className={styles.card}>
            <h3 className={styles.cardTitle}>Component Check Results</h3>
            <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', width: '100%' }}>
              <div className={styles.resultsTable}>
                <div className={styles.resultsTableHeader}>
                  <span>Component</span>
                  <span>Check</span>
                  <span>Applied</span>
                  <span>Capacity</span>
                  <span>Utilization</span>
                  <span>Status</span>
                </div>

                <ResultRow component="Wall Panel" check="Bending" applied={`${panel.bending.applied} kNm/m`} capacity={`${panel.bending.capacity} kNm/m`} utilization={panel.bending.ratio} pass={panel.bending.pass} />
                <ResultRow component="" check="Deflection" applied={`${panel.deflection.actual} mm`} capacity={`${panel.deflection.allowable} mm`} utilization={panel.deflection.ratio} pass={panel.deflection.pass} />

                <ResultRow component="Secondary Beam (Stud)" check="Bending" applied={`${secondary.bending.applied} kNm`} capacity={`${secondary.bending.capacity} kNm`} utilization={secondary.bending.ratio} pass={secondary.bending.pass} />
                <ResultRow component="" check="Shear" applied={`${secondary.shear.applied} kN`} capacity={`${secondary.shear.capacity} kN`} utilization={secondary.shear.ratio} pass={secondary.shear.pass} />
                <ResultRow component="" check="Deflection" applied={`${secondary.deflection.actual} mm`} capacity={`${secondary.deflection.allowable} mm`} utilization={secondary.deflection.ratio} pass={secondary.deflection.pass} />

                <ResultRow component={`Primary Beam (Waler${primary.members > 1 ? ` ×${primary.members}` : ''})`} check="Bending" applied={`${primary.bending.applied} kNm`} capacity={`${primary.bending.capacity} kNm`} utilization={primary.bending.ratio} pass={primary.bending.pass} />
                <ResultRow component="" check="Shear" applied={`${primary.shear.applied} kN`} capacity={`${primary.shear.capacity} kN`} utilization={primary.shear.ratio} pass={primary.shear.pass} />
                <ResultRow component="" check="Deflection" applied={`${primary.deflection.actual} mm`} capacity={`${primary.deflection.allowable} mm`} utilization={primary.deflection.ratio} pass={primary.deflection.pass} />

                <ResultRow component={`Tie Rod (Ø${tie.diameter} mm)`} check="Tension" applied={`${tie.applied} kN`} capacity={`${tie.capacity} kN`} utilization={tie.utilization} pass={tie.pass} />
              </div>
            </div>
          </div>

          <div className={styles.card} style={{ marginTop: '24px' }}>
            <h3 className={styles.cardTitle}>Notes</h3>
            <ul className={styles.notesList}>
              <li>Design pressure = {designPressure} kN/m² applied as a uniform envelope (conservative)</li>
              <li>Stud: {secondary.spanCount}-span over walers, line load = {secondary.lineLoad} kN/m</li>
              <li>Waler: {primary.spanCount}-span between ties, line load = {primary.lineLoad} kN/m</li>
              <li>Max stud reaction = {secondary.maxReaction} kN</li>
              <li>Max waler reaction (tie force) = {primary.maxReaction} kN; tributary check ≈ {tie.tributaryForce} kN</li>
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
                <span className={styles.summaryLabel}>Tie Force</span>
                <span className={styles.summaryValue}>{tie.applied} kN</span>
              </div>
            </div>
          </div>

          <div className={styles.card}>
            <h3 className={styles.cardTitle}>Load Path</h3>
            <div className={styles.loadBreakdown}>
              <div className={styles.loadRow}>
                <span>Concrete Pressure</span>
                <strong>{designPressure} kN/m²</strong>
              </div>
              <div className={styles.loadRow}>
                <span>→ Stud line load</span>
                <strong>{secondary.lineLoad} kN/m</strong>
              </div>
              <div className={styles.loadRow}>
                <span>→ Waler line load</span>
                <strong>{primary.lineLoad} kN/m</strong>
              </div>
              <div className={styles.loadRowDivider} />
              <div className={`${styles.loadRow} ${styles.loadRowTotal}`}>
                <span>→ Tie rod tension</span>
                <strong>{tie.applied} kN</strong>
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

// ────────────────────────────────────────────────────────────────────────────
// A4 report
// ────────────────────────────────────────────────────────────────────────────
function WallDesignReport({ results, inputs, projectId, setProjectId, calculatedBy, setCalculatedBy, verificationDate, setVerificationDate, reportRef, handlePrint }) {
  const { designPressure, panel, secondary, primary, tie, overallPass, maxUtilization } = results;

  const sectionTitle = {
    fontSize: '10px', fontWeight: 700, color: '#334155', textTransform: 'uppercase',
    marginBottom: '4px', borderBottom: '1px solid #cbd5e1', paddingBottom: '2px',
  };
  const paramCellL = { padding: '4px 0', color: '#64748b' };
  const paramCellR = { padding: '4px 0', fontWeight: 600, textAlign: 'right' };
  const th = { padding: '4px', textAlign: 'left' };
  const thR = { padding: '4px', textAlign: 'right' };
  const td = { padding: '4px' };
  const tdR = { padding: '4px', textAlign: 'right', fontWeight: 700 };
  const metaInput = {
    padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1',
    fontSize: '12px', fontWeight: 500, color: '#1e293b', outline: 'none',
  };
  const metaLabel = { fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' };

  const checkRows = [
    ['Wall Panel', 'Bending', `${panel.bending.applied}`, `${panel.bending.capacity}`, 'kNm/m', panel.bending],
    ['Wall Panel', 'Deflection', `${panel.deflection.actual}`, `${panel.deflection.allowable}`, 'mm', panel.deflection],
    ['Secondary Beam (Stud)', 'Bending', `${secondary.bending.applied}`, `${secondary.bending.capacity}`, 'kNm', secondary.bending],
    ['Secondary Beam (Stud)', 'Shear', `${secondary.shear.applied}`, `${secondary.shear.capacity}`, 'kN', secondary.shear],
    ['Secondary Beam (Stud)', 'Deflection', `${secondary.deflection.actual}`, `${secondary.deflection.allowable}`, 'mm', secondary.deflection],
    [`Primary Beam (Waler${primary.members > 1 ? ` ×${primary.members}` : ''})`, 'Bending', `${primary.bending.applied}`, `${primary.bending.capacity}`, 'kNm', primary.bending],
    [`Primary Beam (Waler${primary.members > 1 ? ` ×${primary.members}` : ''})`, 'Shear', `${primary.shear.applied}`, `${primary.shear.capacity}`, 'kN', primary.shear],
    [`Primary Beam (Waler${primary.members > 1 ? ` ×${primary.members}` : ''})`, 'Deflection', `${primary.deflection.actual}`, `${primary.deflection.allowable}`, 'mm', primary.deflection],
    [`Tie Rod (Ø${tie.diameter} mm)`, 'Tension', `${tie.applied}`, `${tie.capacity}`, 'kN', { ratio: tie.utilization, pass: tie.pass }],
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', width: '100%', paddingBottom: '40px', overflowX: 'auto' }}>
      {/* Configuration Panel */}
      <div style={{
        width: '100%', maxWidth: '210mm', backgroundColor: '#ffffff',
        border: '1px solid #cbd5e1', borderRadius: '12px', padding: '20px',
        display: 'flex', flexDirection: 'column', gap: '16px',
        boxShadow: '0 4px 15px rgba(0, 0, 0, 0.05)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#0f172a' }}>Report Configuration</h3>
          <button
            onClick={handlePrint}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '8px',
              backgroundColor: 'var(--primary)', color: '#ffffff', border: 'none',
              borderRadius: '999px', padding: '10px 24px', fontSize: '14px',
              fontWeight: '800', cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(37, 99, 235, 0.2)',
              transition: 'transform 160ms cubic-bezier(0.23, 1, 0.32, 1)'
            }}
            onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.97)'}
            onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
          >
            {isIOS() ? <><Share2 size={16} /> Share PDF</> : <><FileText size={16} /> Print Report</>}
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <span style={metaLabel}>Project ID</span>
            <input type="text" value={projectId} onChange={(e) => setProjectId(e.target.value)} placeholder="e.g. TW-2026-WALL" style={metaInput} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <span style={metaLabel}>Calculated By</span>
            <input type="text" value={calculatedBy} onChange={(e) => setCalculatedBy(e.target.value)} placeholder="e.g. Engineer Name" style={metaInput} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <span style={metaLabel}>Verification Date</span>
            <input type="text" value={verificationDate} onChange={(e) => setVerificationDate(e.target.value)} placeholder="DD MMM YYYY" style={metaInput} />
          </div>
        </div>
      </div>

      {/* A4 Printable Sheet */}
      <div
        ref={reportRef}
        data-report-root
        className={wallStyles.reportSheet}
        style={{
          width: '210mm', minHeight: '297mm', backgroundColor: '#ffffff',
          boxShadow: '0 4px 30px rgba(0, 0, 0, 0.15)', border: '1px solid #cbd5e1',
          padding: '24px 30px', boxSizing: 'border-box', display: 'flex',
          flexDirection: 'column', gap: '12px', fontSize: '11px', color: '#1e293b',
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
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a' }}>Wall Formwork Report - Panel, Members & Tie Design</div>
            <div style={{ fontSize: '8px', color: '#64748b', marginTop: '1px' }}>Design pressure per CIRIA Report 108:1985</div>
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
            <div style={{ fontWeight: 800, fontSize: '10px', color: overallPass ? '#16a34a' : '#dc2626' }}>
              {overallPass ? '✅ DESIGN OK' : '❌ DESIGN FAIL'}
            </div>
          </div>
        </div>

        {/* 1. Design Parameters */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '4px' }}>
          <div>
            <div style={sectionTitle}>1. Design Parameters</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
              <tbody>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={paramCellL}>Design Pressure (Pmax)</td>
                  <td style={paramCellR}>{designPressure} kN/m²</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={paramCellL}>Wall Panel</td>
                  <td style={paramCellR}>{inputs.panelType} — {inputs.panelThickness}</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={paramCellL}>Secondary Beam (Stud)</td>
                  <td style={paramCellR}>{inputs.secondaryBeamType} @ {inputs.secondarySpacing} m C/C</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={paramCellL}>Primary Beam (Waler)</td>
                  <td style={paramCellR}>{inputs.primaryBeamType} ×{inputs.primaryMembers} @ {inputs.primarySpacing} m C/C</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={paramCellL}>Tie Rod</td>
                  <td style={paramCellR}>{inputs.tieRodType} @ {inputs.tieSpacing} m C/C</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={paramCellL}>Deflection Limit</td>
                  <td style={paramCellR}>L / {inputs.deflectionLimit}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* 2. Load Path */}
          <div>
            <div style={sectionTitle}>2. Load Path</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '10px' }}>
              <div style={{ background: '#f1f5f9', padding: '4px 8px', borderRadius: '4px', fontFamily: 'monospace' }}>
                Panel strip load w = Pmax = {designPressure} kN/m per m
              </div>
              <div style={{ background: '#f1f5f9', padding: '4px 8px', borderRadius: '4px', fontFamily: 'monospace' }}>
                Stud load w = {designPressure} × {inputs.secondarySpacing} = {secondary.lineLoad} kN/m
              </div>
              <div style={{ background: '#f1f5f9', padding: '4px 8px', borderRadius: '4px', fontFamily: 'monospace' }}>
                Waler load w = R_stud / s_stud = {primary.lineLoad} kN/m
              </div>
              <div style={{ background: '#f1f5f9', padding: '4px 8px', borderRadius: '4px', fontFamily: 'monospace' }}>
                Tie tension T = R_waler = {tie.applied} kN ≤ {tie.capacity} kN
              </div>
              <div style={{ marginTop: '2px', color: '#475569' }}>
                Members analysed as continuous beams (stud: {secondary.spanCount}-span, waler: {primary.spanCount}-span)
                using manufacturer's allowable capacities.
              </div>
            </div>
          </div>
        </div>

        {/* 3. Component Checks */}
        <div style={{ marginTop: '8px' }}>
          <div style={sectionTitle}>3. Component Check Summary</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px', marginTop: '4px' }}>
            <thead>
              <tr style={{ borderBottom: '1.5px solid #cbd5e1', color: '#475569', fontWeight: 700 }}>
                <th style={th}>Component</th>
                <th style={th}>Check</th>
                <th style={thR}>Applied</th>
                <th style={thR}>Capacity</th>
                <th style={{ ...th, paddingLeft: '14px' }}>Unit</th>
                <th style={thR}>Utilization</th>
                <th style={th}>Status</th>
              </tr>
            </thead>
            <tbody>
              {checkRows.map(([comp, check, applied, capacity, unit, r], i) => (
                <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ ...td, fontWeight: 600 }}>{comp}</td>
                  <td style={td}>{check}</td>
                  <td style={tdR}>{applied}</td>
                  <td style={tdR}>{capacity}</td>
                  <td style={{ ...td, paddingLeft: '14px', color: '#64748b' }}>{unit}</td>
                  <td style={{ ...tdR, color: r.ratio > 1 ? '#dc2626' : '#0f172a' }}>{(r.ratio * 100).toFixed(1)}%</td>
                  <td style={{ ...td, fontWeight: 800, color: r.pass ? '#16a34a' : '#dc2626' }}>{r.pass ? 'OK' : 'FAIL'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 4. Summary */}
        <div style={{ marginTop: '8px' }}>
          <div style={sectionTitle}>4. Design Summary</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginTop: '4px' }}>
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '8px 10px' }}>
              <div style={{ fontSize: '8px', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Overall Result</div>
              <div style={{ fontSize: '13px', fontWeight: 800, color: overallPass ? '#16a34a' : '#dc2626' }}>{overallPass ? 'PASS' : 'FAIL'}</div>
            </div>
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '8px 10px' }}>
              <div style={{ fontSize: '8px', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Max Utilization</div>
              <div style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a' }}>{(maxUtilization * 100).toFixed(2)}%</div>
            </div>
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '8px 10px' }}>
              <div style={{ fontSize: '8px', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Tie Rod Tension</div>
              <div style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a' }}>{tie.applied} kN / {tie.capacity} kN</div>
            </div>
          </div>
        </div>

        {/* 5. Design Notes */}
        <div style={{ marginTop: 'auto', borderTop: '2.5px solid #cbd5e1', paddingTop: '8px' }}>
          <div style={{ fontSize: '9px', fontWeight: 700, color: '#334155', textTransform: 'uppercase', marginBottom: '2px' }}>
            Design Notes & Methodology
          </div>
          <ul style={{ fontSize: '9px', color: '#475569', paddingLeft: '12px', margin: '0' }}>
            <li>Design pressure applied as a uniform envelope over the checked band of the form face (conservative).</li>
            <li>Panel checked as a 1 m strip continuous over the studs; studs continuous over the walers; walers continuous between tie rods.</li>
            <li>Tie rod tension taken as the maximum waler reaction from the continuous beam analysis; tributary-area check ≈ {tie.tributaryForce} kN.</li>
            <li>All member capacities are manufacturer's permissible (allowable stress) values; tie rod capacity is the safe working load.</li>
            <li>Ensure tie spacing, waler arrangement and pour rate on site match this calculation.</li>
          </ul>
          <div style={{ marginTop: '6px', paddingTop: '5px', borderTop: '1px solid #e2e8f0', fontStyle: 'italic', fontWeight: 600, fontSize: '9px', color: '#64748b', textAlign: 'center' }}>
            Electronic generated report, manual verification is required.
          </div>
        </div>
      </div>
    </div>
  );
}
