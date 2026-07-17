import { useState, useEffect, useMemo, useRef } from 'react';
import { FileText, SlidersHorizontal, Share2 } from 'lucide-react';
import { isIOS, shareReportPdf } from '../utils/reportPdf';
import styles from './ShoringTowerCalculator.module.css';
import StandardChart from '../components/StandardChart';
import SavedDesigns from '../components/SavedDesigns';
import {
  SHORING_SYSTEMS,
  SYSTEM_KEYS,
  TYPE_DESCRIPTIONS,
  calculateLegLoad,
  evaluateConfigurations,
  buildCapacityChartData,
} from '../engine/formwork/shoringTower';
import plytecLogoUrl from '../assets/PLYTEC_Logo.svg';

// sessionStorage keys that make up a saved design snapshot
const DESIGN_SESSION_KEYS = [
  'tempworks_shoringtower_inputs',
  'tempworks_shoringtower_chart_system',
  'tempworks_shoringtower_table_opts',
  'tempworks_shoringtower_project_id',
  'tempworks_shoringtower_calculated_by',
  'tempworks_shoringtower_verification_date',
];

const getSessionData = (key, defaultValue) => {
  try {
    const val = sessionStorage.getItem(key);
    return val ? JSON.parse(val) : defaultValue;
  } catch {
    return defaultValue;
  }
};

const saveSessionData = (key, data) => {
  try {
    sessionStorage.setItem(key, JSON.stringify(data));
  } catch {
    /* sessionStorage unavailable - state simply won't persist */
  }
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

const TYPE_COLORS = {
  A: '#1d4ed8',
  B: '#0891b2',
  C: '#16a34a',
  D: '#d97706',
  E: '#9333ea',
};

const STATUS_LABELS = {
  'below-min': 'Below chart range – capacity at minimum rated height used (conservative).',
  'exceeds-max': 'Tower height exceeds the rated range for this configuration.',
};

/**
 * @param initialTab  Which tab to open on. The dashboard's report renderer
 *   mounts this calculator off-screen with initialTab="report" to capture its
 *   report during a compile; everywhere else it opens on the calculator.
 */
export default function ShoringTowerCalculator({ initialTab }) {
  const initialInputs = getSessionData('tempworks_shoringtower_inputs', {
    concreteThickness: 300,
    unitWeight: 25,
    formworkLoad: 0.5,
    towerHeight: 6.9,
    areaMode: 'plan', // 'plan' (L x W) or 'direct'
    towerLength: 1.8,
    towerWidth: 1.2,
    directArea: 2.16,
    systemMode: 'topHeld', // 'topHeld' or 'freeStanding'
    jackExtension: 300,
  });

  const [concreteThickness, setConcreteThickness] = useState(initialInputs.concreteThickness);
  const [unitWeight, setUnitWeight] = useState(initialInputs.unitWeight);
  const [formworkLoad, setFormworkLoad] = useState(initialInputs.formworkLoad);
  const [towerHeight, setTowerHeight] = useState(initialInputs.towerHeight);
  const [areaMode, setAreaMode] = useState(initialInputs.areaMode);
  const [towerLength, setTowerLength] = useState(initialInputs.towerLength);
  const [towerWidth, setTowerWidth] = useState(initialInputs.towerWidth);
  const [directArea, setDirectArea] = useState(initialInputs.directArea);
  const [systemMode, setSystemMode] = useState(initialInputs.systemMode);
  const [jackExtension, setJackExtension] = useState(initialInputs.jackExtension);

  const [chartSystem, setChartSystem] = useState(() => getSessionData('tempworks_shoringtower_chart_system', 'WCL48'));
  const [activeTab, setActiveTab] = useState(initialTab || 'calculator');
  const tabsContainerRef = useRef(null);
  const reportRef = useRef(null);

  // Table display options (popup): sortDir = null | 'asc' | 'desc'
  const [tableOpts, setTableOpts] = useState(() => getSessionData('tempworks_shoringtower_table_opts', {
    passOnly: false,
    sortDir: null,
  }));
  const [optionsOpen, setOptionsOpen] = useState(false);
  const optionsRef = useRef(null);

  useEffect(() => {
    saveSessionData('tempworks_shoringtower_table_opts', tableOpts);
  }, [tableOpts]);

  // Close the options popup on outside click
  useEffect(() => {
    if (!optionsOpen) return;
    const onPointerDown = (e) => {
      if (optionsRef.current && !optionsRef.current.contains(e.target)) {
        setOptionsOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [optionsOpen]);

  // Metadata Inputs
  const [projectId, setProjectId] = useState(() => getSessionData('tempworks_shoringtower_project_id', 'TW-2026-SHORING'));
  const [calculatedBy, setCalculatedBy] = useState(() => getSessionData('tempworks_shoringtower_calculated_by', 'Engineer'));
  const [verificationDate, setVerificationDate] = useState(() => getSessionData('tempworks_shoringtower_verification_date', new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })));

  useEffect(() => {
    saveSessionData('tempworks_shoringtower_project_id', projectId);
  }, [projectId]);

  useEffect(() => {
    saveSessionData('tempworks_shoringtower_calculated_by', calculatedBy);
  }, [calculatedBy]);

  useEffect(() => {
    saveSessionData('tempworks_shoringtower_verification_date', verificationDate);
  }, [verificationDate]);

  // Report configurations visibility state
  const [visibleReportConfigs, setVisibleReportConfigs] = useState(null);

  useEffect(() => {
    saveSessionData('tempworks_shoringtower_inputs', {
      concreteThickness, unitWeight, formworkLoad, towerHeight,
      areaMode, towerLength, towerWidth, directArea, systemMode, jackExtension,
    });
  }, [concreteThickness, unitWeight, formworkLoad, towerHeight, areaMode, towerLength, towerWidth, directArea, systemMode, jackExtension]);

  useEffect(() => {
    saveSessionData('tempworks_shoringtower_chart_system', chartSystem);
  }, [chartSystem]);

  // Auto-scroll active tab into middle of scroll window on mobile/tablet viewports
  useEffect(() => {
    if (tabsContainerRef.current) {
      const activeTabEl = tabsContainerRef.current.querySelector(`.${styles.active}`);
      if (activeTabEl) {
        activeTabEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
  }, [activeTab]);

  // ── Calculation ──
  const loadArea = useMemo(() => {
    if (areaMode === 'plan') {
      return (Number(towerLength) || 0) * (Number(towerWidth) || 0);
    }
    return Number(directArea) || 0;
  }, [areaMode, towerLength, towerWidth, directArea]);

  const legLoad = useMemo(() => calculateLegLoad({
    thickness: concreteThickness,
    area: loadArea,
    unitWeight,
    formworkLoad,
  }), [concreteThickness, loadArea, unitWeight, formworkLoad]);

  const configResults = useMemo(() => evaluateConfigurations({
    height: Number(towerHeight),
    legLoad: legLoad.F,
    mode: systemMode,
    extension: Number(jackExtension),
  }), [towerHeight, legLoad.F, systemMode, jackExtension]);

  const passCount = configResults.filter((r) => r.pass).length;

  useEffect(() => {
    setVisibleReportConfigs(null);
  }, [configResults]);

  const activeReportConfigs = useMemo(() => {
    return visibleReportConfigs ?? configResults.map(r => `${r.system}-${r.type}`);
  }, [visibleReportConfigs, configResults]);

  const reportPassCount = useMemo(() => {
    return configResults.filter((r) => activeReportConfigs.includes(`${r.system}-${r.type}`) && r.pass).length;
  }, [configResults, activeReportConfigs]);

  const filteredReportResults = useMemo(() => {
    return configResults.filter((r) => activeReportConfigs.includes(`${r.system}-${r.type}`));
  }, [configResults, activeReportConfigs]);

  const handleToggleConfig = (key) => {
    setVisibleReportConfigs((prev) => {
      const current = prev ?? configResults.map((r) => `${r.system}-${r.type}`);
      if (current.includes(key)) {
        return current.filter((k) => k !== key);
      } else {
        return [...current, key];
      }
    });
  };

  const handleSelectAllConfigs = () => {
    setVisibleReportConfigs(null);
  };

  const handleSelectPassOnlyConfigs = () => {
    const passingKeys = configResults.filter((r) => r.pass).map((r) => `${r.system}-${r.type}`);
    setVisibleReportConfigs(passingKeys);
  };

  const handleClearAllConfigs = () => {
    setVisibleReportConfigs([]);
  };

  // On-screen table rows after applying the display options
  // (the audit report always shows the full set in manual order)
  const displayResults = useMemo(() => {
    let rows = configResults;
    if (tableOpts.passOnly) rows = rows.filter((r) => r.pass);
    if (tableOpts.sortDir) {
      // Rows without a capacity (N/A) always sort last
      const rank = (r) => (r.utilization === null
        ? Infinity
        : (tableOpts.sortDir === 'desc' ? -r.utilization : r.utilization));
      rows = [...rows].sort((a, b) => rank(a) - rank(b));
    }
    return rows;
  }, [configResults, tableOpts]);

  const chartInfo = useMemo(() => buildCapacityChartData(chartSystem), [chartSystem]);

  const handlePrint = () => {
    const content = reportRef.current;
    if (!content) return;
    // iOS Safari crashes on window.open + print() — share a PDF instead
    if (isIOS()) {
      shareReportPdf(content, 'TempWorks-Shoring-Tower-Report.pdf');
      return;
    }
    const printWindow = window.open('', '_blank', 'width=900,height=1200');
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>TempWorks – Shoring Tower Capacity Report</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap');
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { font-family: Inter, system-ui, sans-serif; background: #f1f5f9; color: #1e293b; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            @page { margin: 10mm; }
            .report-page {
              background: #fff;
              width: 210mm;
              min-height: 297mm;
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
                min-height: 270mm !important;
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

  const fmt = (v, dp = 2) => (Number.isFinite(v) ? v.toFixed(dp) : '—');

  const utilizationColor = (u) => {
    if (u === null) return '#94a3b8';
    if (u <= 0.8) return '#16a34a';
    if (u <= 1.0) return '#d97706';
    return '#dc2626';
  };

  const renderStatusBadge = (row) => {
    if (row.capacity === null) {
      return <span className={`${styles.badge} ${styles.badgeNa}`}>N/A</span>;
    }
    return row.pass
      ? <span className={`${styles.badge} ${styles.badgePass}`}>PASS</span>
      : <span className={`${styles.badge} ${styles.badgeFail}`}>FAIL</span>;
  };

  const configTable = () => (
    <table className={styles.configTable}>
      <thead>
        <tr>
          <th>Configuration</th>
          <th className={styles.numHead}>Rated H [m]</th>
          <th className={styles.numHead}>Capacity [kN]</th>
          <th>Utilisation</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        {displayResults.length === 0 && (
          <tr>
            <td colSpan={5} className={styles.emptyRow}>
              No configuration passes at this load / height. Adjust the tower height or load area, or clear the “PASS only” filter.
            </td>
          </tr>
        )}
        {displayResults.map((row) => (
          <tr key={`${row.system}-${row.type}`} className={row.capacity !== null && !row.pass ? styles.rowFail : ''}>
            <td className={styles.configCell}>
              <span className={styles.systemCell}>{row.system} · Type {row.type}</span>
              <span className={styles.descSub}>{row.description}</span>
            </td>
            <td className={styles.numCell}>{row.tableHeight !== null ? row.tableHeight.toFixed(1) : '—'}</td>
            <td className={styles.numCell}>{row.capacity !== null ? row.capacity.toFixed(1) : '—'}</td>
            <td>
              {row.utilization !== null ? (
                <div className={styles.utilBarWrap}>
                  <div className={styles.utilBar}>
                    <div
                      className={styles.utilFill}
                      style={{
                        width: `${Math.min(100, row.utilization * 100)}%`,
                        background: utilizationColor(row.utilization),
                      }}
                    />
                  </div>
                  <span className={styles.utilText} style={{ color: utilizationColor(row.utilization) }}>
                    {(row.utilization * 100).toFixed(0)}%
                  </span>
                </div>
              ) : (
                <span style={{ color: '#94a3b8' }}>{STATUS_LABELS[row.status] ? 'Out of range' : '—'}</span>
              )}
            </td>
            <td>{renderStatusBadge(row)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  return (
    <div className={styles.pageContainer}>
      <header className={styles.pageHeader}>
        <div className={styles.titleBlock}>
          <h1>Shoring Tower Calculator</h1>
          <p>WONDERCrab Modular Shoring System · PLYTEC Product Manual (Issue 26/01) · BS EN 12812 Class B1 / BS5975:2019</p>
        </div>
        <SavedDesigns
          calculator="shoring-tower"
          title="Shoring Tower"
          sessionKeys={DESIGN_SESSION_KEYS}
        />
      </header>

      {/* Tabs – above the grid so they stay at the top of the page on mobile */}
      <div ref={tabsContainerRef} className={styles.tabsContainer}>
        <div className={styles.tabs} role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'calculator'}
            className={`${styles.tab} ${activeTab === 'calculator' ? styles.active : ''}`}
            onClick={() => setActiveTab('calculator')}
          >
            Calculator UI
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'report'}
            className={`${styles.tab} ${activeTab === 'report' ? styles.active : ''}`}
            onClick={() => setActiveTab('report')}
          >
            Engineering Audit Report
          </button>
        </div>
      </div>

      <div className={styles.mainGrid}>
        {/* Left Sidebar */}
        <div className={styles.sidebarPanel}>
          <div className={styles.card}>
            <div className={styles.cardHeader}>Slab &amp; Load Parameters</div>
            <div className={styles.fieldRow}>
              <span className={styles.fieldLabel}>Concrete thickness (mm)</span>
              <input type="number" step="10" min="0" className={styles.fieldInput} value={concreteThickness} onChange={(e) => setConcreteThickness(cleanNumericInput(e.target.value))} />
            </div>
            <div className={styles.fieldRow}>
              <span className={styles.fieldLabel}>Concrete unit weight (kN/m³)</span>
              <input type="number" step="0.5" min="0" className={styles.fieldInput} value={unitWeight} onChange={(e) => setUnitWeight(cleanNumericInput(e.target.value))} />
            </div>
            <div className={styles.fieldRow}>
              <span className={styles.fieldLabel}>Formwork dead load q₁ (kN/m²)</span>
              <input type="number" step="0.1" min="0" className={styles.fieldInput} value={formworkLoad} onChange={(e) => setFormworkLoad(cleanNumericInput(e.target.value))} />
            </div>
            <p className={styles.hintText}>
              Construction load q₃ = 0.1·q₂ + 0.75 kN/m² (1.5 ≤ q₃ ≤ 2.5) per BS5975:2019 cl.17.4.3.1.
            </p>
          </div>

          <div className={styles.card}>
            <div className={styles.cardHeader}>Load Area per Leg</div>
            <div className={styles.radioGroup} style={{ marginBottom: '1rem' }}>
              <label className={styles.radioLabel}>
                <input type="radio" name="areaMode" checked={areaMode === 'plan'} onChange={() => setAreaMode('plan')} /> Tower plan (L × W)
              </label>
              <label className={styles.radioLabel}>
                <input type="radio" name="areaMode" checked={areaMode === 'direct'} onChange={() => setAreaMode('direct')} /> Direct area
              </label>
            </div>

            {areaMode === 'plan' ? (
              <>
                <div className={styles.fieldRow}>
                  <span className={styles.fieldLabel}>Tower length L (m)</span>
                  <input type="number" step="0.1" min="0" className={styles.fieldInput} value={towerLength} onChange={(e) => setTowerLength(cleanNumericInput(e.target.value))} />
                </div>
                <div className={styles.fieldRow}>
                  <span className={styles.fieldLabel}>Tower width W (m)</span>
                  <input type="number" step="0.1" min="0" className={styles.fieldInput} value={towerWidth} onChange={(e) => setTowerWidth(cleanNumericInput(e.target.value))} />
                </div>
                <div className={styles.fieldRow}>
                  <span className={styles.fieldLabel}>Load area A = L × W (m²)</span>
                  <input type="text" readOnly className={styles.fieldInput} value={fmt(loadArea)} />
                </div>
              </>
            ) : (
              <div className={styles.fieldRow}>
                <span className={styles.fieldLabel}>Load area A (m²)</span>
                <input type="number" step="0.1" min="0" className={styles.fieldInput} value={directArea} onChange={(e) => setDirectArea(cleanNumericInput(e.target.value))} />
              </div>
            )}
            <p className={styles.hintText}>
              Slab case: interior leg tributary area = tower grid length × width (manual p.64).
            </p>
          </div>

          <div className={styles.card}>
            <div className={styles.cardHeader}>Tower Configuration</div>
            <div className={styles.fieldRow}>
              <span className={styles.fieldLabel}>Tower height (m)</span>
              <input type="number" step="0.1" min="0" className={styles.fieldInput} value={towerHeight} onChange={(e) => setTowerHeight(cleanNumericInput(e.target.value))} />
            </div>
            <div className={styles.radioGroup} style={{ margin: '0.5rem 0 1rem' }}>
              <label className={styles.radioLabel}>
                <input type="radio" name="systemMode" checked={systemMode === 'topHeld'} onChange={() => setSystemMode('topHeld')} /> Top held
              </label>
              <label className={styles.radioLabel}>
                <input type="radio" name="systemMode" checked={systemMode === 'freeStanding'} onChange={() => setSystemMode('freeStanding')} /> Free standing
              </label>
            </div>
            {systemMode === 'freeStanding' && (
              <div className={styles.fieldRow}>
                <span className={styles.fieldLabel}>Jack base / U-head extension</span>
                <select className={`${styles.selectInput} ${styles.selectInputAuto}`} value={jackExtension} onChange={(e) => setJackExtension(Number(e.target.value))}>
                  <option value={100}>100 mm</option>
                  <option value={200}>200 mm</option>
                  <option value={300}>300 mm</option>
                </select>
              </div>
            )}
            <p className={styles.hintText}>
              {systemMode === 'topHeld'
                ? 'Top-held capacities assume the tower is restrained at the top, wind on the 1.8 m side (1.5 m for Type E) and jack base / U-head extension ≤ 300 mm.'
                : 'Free-standing towers are only rated up to the tabulated height for the selected jack base / U-head extension.'}
            </p>
          </div>
        </div>

        {/* Right Content */}
        <div>
          {activeTab === 'calculator' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div className={styles.card}>
                <div className={styles.cardHeader}>Design Load per Shoring Leg</div>
                <div className={styles.resultsGrid}>
                  <div className={styles.resultBox}>
                    <span className={styles.resultLabel}>Concrete load q₂</span>
                    <span className={styles.resultValue}>{fmt(legLoad.q2)}</span>
                    <span className={styles.resultUnit}>kN/m²</span>
                  </div>
                  <div className={styles.resultBox}>
                    <span className={styles.resultLabel}>Construction load q₃</span>
                    <span className={styles.resultValue}>{fmt(legLoad.q3)}</span>
                    <span className={styles.resultUnit}>kN/m²</span>
                  </div>
                  <div className={styles.resultBox}>
                    <span className={styles.resultLabel}>Total area load Q</span>
                    <span className={styles.resultValue}>{fmt(legLoad.Q)}</span>
                    <span className={styles.resultUnit}>kN/m²</span>
                  </div>
                  <div className={`${styles.resultBox} ${styles.resultBoxAccent}`}>
                    <span className={styles.resultLabel}>Design load per leg F</span>
                    <span className={styles.resultValue}>{fmt(legLoad.F)}</span>
                    <span className={styles.resultUnit}>kN</span>
                  </div>
                </div>
                <p className={styles.hintText} style={{ marginTop: 0 }}>
                  Q = q₁ + q₂ + q₃ = {fmt(legLoad.q1)} + {fmt(legLoad.q2)} + {fmt(legLoad.q3)} = {fmt(legLoad.Q)} kN/m² · F = Q × A = {fmt(legLoad.Q)} × {fmt(loadArea)} = <strong>{fmt(legLoad.F)} kN</strong>
                </p>
              </div>

              <div className={styles.card}>
                <div className={styles.tableToolbar}>
                  <div className={styles.cardHeader} style={{ margin: 0 }}>
                    Tower Capacity Check — {systemMode === 'topHeld' ? 'Top Held' : `Free Standing (${jackExtension} mm ext.)`} · {passCount}/{configResults.length} configurations pass
                  </div>
                  <div className={styles.optionsWrap} ref={optionsRef}>
                    <button
                      className={`${styles.optionsBtn} ${(tableOpts.passOnly || tableOpts.sortDir) ? styles.optionsBtnActive : ''}`}
                      onClick={() => setOptionsOpen((o) => !o)}
                      aria-haspopup="true"
                      aria-expanded={optionsOpen}
                    >
                      <SlidersHorizontal size={14} /> Table options
                    </button>
                    {optionsOpen && (
                      <div className={styles.optionsPopover}>
                        <label className={styles.optionsItem}>
                          <input
                            type="checkbox"
                            checked={tableOpts.passOnly}
                            onChange={(e) => setTableOpts((o) => ({ ...o, passOnly: e.target.checked }))}
                          />
                          Show PASS-only configurations
                        </label>
                        <label className={styles.optionsItem}>
                          <input
                            type="checkbox"
                            checked={tableOpts.sortDir === 'asc'}
                            onChange={() => setTableOpts((o) => ({ ...o, sortDir: o.sortDir === 'asc' ? null : 'asc' }))}
                          />
                          Sort by utilisation (low → high)
                        </label>
                        <label className={styles.optionsItem}>
                          <input
                            type="checkbox"
                            checked={tableOpts.sortDir === 'desc'}
                            onChange={() => setTableOpts((o) => ({ ...o, sortDir: o.sortDir === 'desc' ? null : 'desc' }))}
                          />
                          Sort by utilisation (high → low)
                        </label>
                      </div>
                    )}
                  </div>
                </div>
                <div className={styles.tableWrapper}>
                  {configTable()}
                </div>
                <p className={styles.hintText}>
                  Capacity taken at the first tabulated height ≥ tower height (conservative step lookup).
                  “N/A” = tower height exceeds the rated range of that configuration.
                </p>
              </div>

              {systemMode === 'topHeld' && (
                <div className={styles.card}>
                  <div className={styles.cardHeader}>Permissible Load vs Tower Height</div>
                  <div className={styles.systemChips}>
                    {SYSTEM_KEYS.map((key) => (
                      <button
                        key={key}
                        className={`${styles.systemChip} ${chartSystem === key ? styles.active : ''}`}
                        onClick={() => setChartSystem(key)}
                      >
                        {key}
                      </button>
                    ))}
                  </div>
                  <div className={styles.chartContainer}>
                    <StandardChart
                      data={chartInfo.data}
                      lines={chartInfo.types.map((t) => ({
                        dataKey: t,
                        name: `Type ${t} — ${TYPE_DESCRIPTIONS[t]}`,
                        color: TYPE_COLORS[t],
                        type: 'linear',
                        props: { strokeWidth: 2.5, connectNulls: true },
                      }))}
                      xAxis={{
                        dataKey: 'height',
                        label: 'Tower Height (m)',
                        domain: [3.5, 13],
                        props: { type: 'number', tickCount: 10 },
                      }}
                      yAxis={{
                        label: 'Permissible Load (kN)',
                        domain: [0, 'auto'],
                      }}
                      referenceLines={[
                        ...(Number(towerHeight) > 0 ? [{ x: Number(towerHeight), stroke: '#0f172a', label: `H = ${towerHeight} m` }] : []),
                        ...(legLoad.F > 0 ? [{ y: legLoad.F, stroke: '#dc2626', label: `F = ${fmt(legLoad.F, 1)} kN` }] : []),
                      ]}
                      height={420}
                    />
                  </div>
                  <p className={styles.hintText}>
                    {SHORING_SYSTEMS[chartSystem].label} — {SHORING_SYSTEMS[chartSystem].series}. Configurations whose curve sits above the red design-load line at your tower height are adequate.
                  </p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'report' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', width: '100%', paddingBottom: '40px', overflowX: 'auto' }}>
              {/* Configuration Panel */}
              <div style={{
                width: '100%',
                maxWidth: '210mm',
                backgroundColor: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '12px',
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
                boxShadow: '0 4px 15px rgba(0, 0, 0, 0.05)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                  <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#0f172a' }}>Report Configuration</h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
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
                    {isIOS() ? <><Share2 size={16} /> Share PDF</> : <><FileText size={16} /> Print Report</>}
                  </button>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    <span style={{ fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Project ID</span>
                    <input
                      type="text"
                      value={projectId}
                      onChange={(e) => setProjectId(e.target.value)}
                      placeholder="e.g. TW-2026-SHORING"
                      style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px', fontWeight: 500, color: '#1e293b', outline: 'none' }}
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    <span style={{ fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Calculated By</span>
                    <input
                      type="text"
                      value={calculatedBy}
                      onChange={(e) => setCalculatedBy(e.target.value)}
                      placeholder="e.g. Engineer Name"
                      style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px', fontWeight: 500, color: '#1e293b', outline: 'none' }}
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    <span style={{ fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Verification Date</span>
                    <input
                      type="text"
                      value={verificationDate}
                      onChange={(e) => setVerificationDate(e.target.value)}
                      placeholder="DD MMM YYYY"
                      style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px', fontWeight: 500, color: '#1e293b', outline: 'none' }}
                    />
                  </div>
                </div>

                {/* Report Configuration Selection Filters */}
                <div style={{ marginTop: '16px', background: 'var(--border-color-light)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-bezel)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-main)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Configurations to Include in Report:
                    </span>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button 
                        onClick={handleSelectAllConfigs} 
                        style={{ fontSize: '10px', padding: '4px 10px', borderRadius: '4px', border: '1px solid var(--border-bezel)', background: 'var(--bg-card)', color: 'var(--text-main)', cursor: 'pointer', fontWeight: 700 }}
                      >
                        Select All
                      </button>
                      <button 
                        onClick={handleSelectPassOnlyConfigs} 
                        style={{ fontSize: '10px', padding: '4px 10px', borderRadius: '4px', border: '1px solid var(--border-bezel)', background: 'var(--bg-card)', color: '#16a34a', cursor: 'pointer', fontWeight: 700 }}
                      >
                        Select PASS Only
                      </button>
                      <button 
                        onClick={handleClearAllConfigs} 
                        style={{ fontSize: '10px', padding: '4px 10px', borderRadius: '4px', border: '1px solid var(--border-bezel)', background: 'var(--bg-card)', color: '#dc2626', cursor: 'pointer', fontWeight: 700 }}
                      >
                        Clear All
                      </button>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '10px' }}>
                    {configResults.map((r) => {
                      const key = `${r.system}-${r.type}`;
                      const isChecked = activeReportConfigs.includes(key);
                      return (
                        <label key={key} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-secondary)', cursor: 'pointer', userSelect: 'none' }}>
                          <input 
                            type="checkbox" 
                            checked={isChecked} 
                            onChange={() => handleToggleConfig(key)} 
                            style={{ accentColor: 'var(--primary)', cursor: 'pointer' }}
                          />
                          <span style={{ fontWeight: 600 }}>{r.system} Type {r.type}</span>
                          <span style={{ fontSize: '8px', padding: '1px 4px', borderRadius: '3px', background: r.pass ? 'rgba(22, 163, 74, 0.1)' : 'rgba(220, 38, 38, 0.1)', color: r.pass ? '#16a34a' : '#dc2626', fontWeight: 800 }}>
                            {r.pass ? 'PASS' : 'FAIL'}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* A4 Printable Sheet */}
              <div
                ref={reportRef}
                data-report-root
                className={styles.reportSheet}
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
                <div className="report-page" style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: 0 }}>
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
                      <div style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a' }}>Shoring Tower Capacity Report — WONDERCrab Modular System</div>
                      <div style={{ fontSize: '8px', color: '#64748b', marginTop: '1px' }}>BS EN 12812 Class B1 · Loads per BS5975:2019 cl.17.4.3.1 · PLYTEC Manual Issue 26/01</div>
                    </div>
                  </div>

                  {/* Metadata */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', background: '#f8fafc', padding: '8px 12px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                    <div>
                      <span style={{ color: '#64748b', fontSize: '8px', textTransform: 'uppercase', fontWeight: 700 }}>Project</span>
                      <div style={{ fontWeight: 600, fontSize: '10px' }}>{projectId || 'TW-2026-SHORING'}</div>
                    </div>
                    <div>
                      <span style={{ color: '#64748b', fontSize: '8px', textTransform: 'uppercase', fontWeight: 700 }}>Prepared By</span>
                      <div style={{ fontWeight: 600, fontSize: '10px' }}>{calculatedBy || 'Engineer'}</div>
                    </div>
                    <div>
                      <span style={{ color: '#64748b', fontSize: '8px', textTransform: 'uppercase', fontWeight: 700 }}>Date</span>
                      <div style={{ fontWeight: 600, fontSize: '10px' }}>{verificationDate}</div>
                    </div>
                    <div>
                      <span style={{ color: '#64748b', fontSize: '8px', textTransform: 'uppercase', fontWeight: 700 }}>Status</span>
                      <div style={{ fontWeight: 800, fontSize: '10px', color: reportPassCount > 0 ? '#16a34a' : '#dc2626' }}>
                        {reportPassCount > 0 ? `✅ ${reportPassCount} CONFIGURATION${reportPassCount > 1 ? 'S' : ''} ADEQUATE` : '❌ NO ADEQUATE CONFIGURATION'}
                      </div>
                    </div>
                  </div>

                  {/* 1 & 2: Parameters + Load derivation */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '4px' }}>
                    <div>
                      <div style={{ fontSize: '10px', fontWeight: 700, color: '#334155', textTransform: 'uppercase', marginBottom: '4px', borderBottom: '1px solid #cbd5e1', paddingBottom: '2px' }}>
                        1. Design Parameters
                      </div>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
                        <tbody>
                          <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '4px 0', color: '#64748b' }}>Concrete Thickness</td>
                            <td style={{ padding: '4px 0', fontWeight: 600, textAlign: 'right' }}>{concreteThickness} mm</td>
                          </tr>
                          <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '4px 0', color: '#64748b' }}>Concrete Unit Weight</td>
                            <td style={{ padding: '4px 0', fontWeight: 600, textAlign: 'right' }}>{unitWeight} kN/m³</td>
                          </tr>
                          <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '4px 0', color: '#64748b' }}>Formwork Dead Load (q₁)</td>
                            <td style={{ padding: '4px 0', fontWeight: 600, textAlign: 'right' }}>{formworkLoad} kN/m²</td>
                          </tr>
                          <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '4px 0', color: '#64748b' }}>Load Area per Leg (A)</td>
                            <td style={{ padding: '4px 0', fontWeight: 600, textAlign: 'right' }}>
                              {areaMode === 'plan' ? `${towerLength} m × ${towerWidth} m = ${fmt(loadArea)} m²` : `${fmt(loadArea)} m²`}
                            </td>
                          </tr>
                          <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '4px 0', color: '#64748b' }}>Tower Height (H)</td>
                            <td style={{ padding: '4px 0', fontWeight: 600, textAlign: 'right' }}>{towerHeight} m</td>
                          </tr>
                          <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '4px 0', color: '#64748b' }}>Restraint Condition</td>
                            <td style={{ padding: '4px 0', fontWeight: 600, textAlign: 'right' }}>
                              {systemMode === 'topHeld' ? 'Top held' : `Free standing (${jackExtension} mm jack ext.)`}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    <div>
                      <div style={{ fontSize: '10px', fontWeight: 700, color: '#334155', textTransform: 'uppercase', marginBottom: '4px', borderBottom: '1px solid #cbd5e1', paddingBottom: '2px' }}>
                        2. Load Derivation (BS5975:2019 cl.17.4.3.1)
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '10px' }}>
                        <div>
                          <strong>Concrete load:</strong>
                          <div style={{ background: '#f1f5f9', padding: '3px 6px', borderRadius: '4px', fontFamily: 'monospace', marginTop: '2px' }}>
                            q₂ = {unitWeight} × {Number(concreteThickness) / 1000} = {fmt(legLoad.q2)} kN/m²
                          </div>
                        </div>
                        <div>
                          <strong>Construction load (1.5 ≤ q₃ ≤ 2.5):</strong>
                          <div style={{ background: '#f1f5f9', padding: '3px 6px', borderRadius: '4px', fontFamily: 'monospace', marginTop: '2px' }}>
                            q₃ = 0.1 × {fmt(legLoad.q2)} + 0.75 → {fmt(legLoad.q3)} kN/m²
                          </div>
                        </div>
                        <div>
                          <strong>Total area load:</strong>
                          <div style={{ background: '#f1f5f9', padding: '3px 6px', borderRadius: '4px', fontFamily: 'monospace', marginTop: '2px' }}>
                            Q = q₁ + q₂ + q₃ = {fmt(legLoad.Q)} kN/m²
                          </div>
                        </div>
                        <div>
                          <strong>Design load per shoring leg:</strong>
                          <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', padding: '3px 6px', borderRadius: '4px', fontFamily: 'monospace', marginTop: '2px', fontWeight: 700 }}>
                            F = Q × A = {fmt(legLoad.Q)} × {fmt(loadArea)} = {fmt(legLoad.F)} kN
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 3. Capacity check table */}
                  <div style={{ marginTop: '8px' }}>
                    <div style={{ fontSize: '10px', fontWeight: 700, color: '#334155', textTransform: 'uppercase', marginBottom: '4px', borderBottom: '1px solid #cbd5e1', paddingBottom: '2px' }}>
                      3. Permissible Load Capacity Check — {systemMode === 'topHeld' ? 'Top Held System' : `Free Standing System (${jackExtension} mm extension)`}
                    </div>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9px', marginTop: '4px' }}>
                      <thead>
                        <tr style={{ borderBottom: '1.5px solid #cbd5e1', color: '#475569', fontWeight: 700 }}>
                          <th style={{ padding: '4px', textAlign: 'left' }}>System</th>
                          <th style={{ padding: '4px', textAlign: 'left' }}>Type</th>
                          <th style={{ padding: '4px', textAlign: 'left' }}>Configuration</th>
                          <th style={{ padding: '4px', textAlign: 'right' }}>Rated H [m]</th>
                          <th style={{ padding: '4px', textAlign: 'right' }}>Capacity [kN]</th>
                          <th style={{ padding: '4px', textAlign: 'right' }}>Load F [kN]</th>
                          <th style={{ padding: '4px', textAlign: 'right' }}>Util.</th>
                          <th style={{ padding: '4px', textAlign: 'center' }}>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredReportResults.length === 0 ? (
                          <tr>
                            <td colSpan={8} style={{ padding: '12px', textAlign: 'center', color: '#94a3b8', fontStyle: 'italic' }}>
                              No configurations selected for report.
                            </td>
                          </tr>
                        ) : (
                          filteredReportResults.map((row) => (
                            <tr key={`rep-${row.system}-${row.type}`} style={{ borderBottom: '1px solid #f1f5f9', background: row.capacity !== null && !row.pass ? '#fef2f2' : 'transparent' }}>
                              <td style={{ padding: '3px 4px', fontWeight: 700 }}>{row.system}</td>
                              <td style={{ padding: '3px 4px' }}>{row.type}</td>
                              <td style={{ padding: '3px 4px', color: '#475569' }}>{row.description}</td>
                              <td style={{ padding: '3px 4px', textAlign: 'right' }}>{row.tableHeight !== null ? row.tableHeight.toFixed(1) : '—'}</td>
                              <td style={{ padding: '3px 4px', textAlign: 'right', fontWeight: 600 }}>{row.capacity !== null ? row.capacity.toFixed(1) : '—'}</td>
                              <td style={{ padding: '3px 4px', textAlign: 'right' }}>{fmt(legLoad.F, 1)}</td>
                              <td style={{ padding: '3px 4px', textAlign: 'right', fontWeight: 700, color: utilizationColor(row.utilization) }}>
                                {row.utilization !== null ? `${(row.utilization * 100).toFixed(0)}%` : '—'}
                              </td>
                              <td style={{ padding: '3px 4px', textAlign: 'center', fontWeight: 800, color: row.capacity === null ? '#94a3b8' : row.pass ? '#16a34a' : '#dc2626' }}>
                                {row.capacity === null ? 'N/A' : row.pass ? 'PASS' : 'FAIL'}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Notes */}
                  <div style={{ marginTop: 'auto', borderTop: '2.5px solid #cbd5e1', paddingTop: '8px' }}>
                    <div style={{ fontSize: '9px', fontWeight: 700, color: '#334155', textTransform: 'uppercase', marginBottom: '2px' }}>
                      Design Notes &amp; Methodology
                    </div>
                    <ul style={{ fontSize: '9px', color: '#475569', paddingLeft: '12px', margin: '0' }}>
                      <li>Permissible load capacities taken from the PLYTEC WONDERCrab Product Manual (Issue 26/01), designed to BS EN 12812 Class B1.</li>
                      <li>Capacity at intermediate heights uses the next larger tabulated height (conservative step lookup).</li>
                      <li>Top-held charts assume wind load on the 1.8 m side (1.5 m for Type E) and a maximum jack base / U-head extension of 300 mm.</li>
                      <li>Type D towers may adopt Type A capacity if fully braced with a 2 m diagonal at 1 m intervals (see manual).</li>
                      <li>Loading combinations per manual: self-weight, imposed vertical loads, horizontal loads and wind (ULS &amp; SLS cases).</li>
                      <li>This check covers the shoring tower leg capacity only. Verify U-head/beam bearing, foundation and formwork members separately.</li>
                    </ul>
                    <div style={{ marginTop: '6px', paddingTop: '5px', borderTop: '1px solid #e2e8f0', fontStyle: 'italic', fontWeight: 600, fontSize: '9px', color: '#64748b', textAlign: 'center' }}>
                      Electronic generated report, manual verification is required.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
