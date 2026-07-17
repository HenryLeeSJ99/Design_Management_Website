import { useState, useEffect, useMemo, useRef } from 'react';
import { FileText, SlidersHorizontal, Share2 } from 'lucide-react';
import { isIOS, shareReportPdf } from '../utils/reportPdf';
import styles from './SteelPropCalculator.module.css';
import StandardChart from '../components/StandardChart';
import SavedDesigns from '../components/SavedDesigns';
import {
  PROP_MODELS_DATA,
  PROP_KEYS,
  SAFETY_FACTOR,
  calculatePropLoad,
  evaluatePropConfigurations,
  buildPropChartData,
  getPropCapacity,
} from '../engine/formwork/steelProp';
import plytecLogoUrl from '../assets/PLYTEC_Logo.svg';

const DESIGN_SESSION_KEYS = [
  'tempworks_steelprop_inputs',
  'tempworks_steelprop_chart_model',
  'tempworks_steelprop_table_opts',
  'tempworks_steelprop_project_id',
  'tempworks_steelprop_calculated_by',
  'tempworks_steelprop_verification_date',
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
    /* sessionStorage unavailable */
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

const EXTENSION_COLORS = {
  0: '#94a3b8',    // standard/grey
  500: '#16a34a',  // green
  1000: '#9333ea', // purple
};

const STATUS_LABELS = {
  'below-min': 'Below chart range – capacity at minimum rated height used (conservative).',
  'exceeds-max': 'Prop height exceeds the rated range for this model.',
};

/**
 * Prop Visualizer SVG Component
 */
function PropDiagram({ model, height, ext, load, reportMode = false }) {
  const minH = 1.8;
  const maxH = 5.0;
  const hVal = Math.max(minH, Math.min(maxH, Number(height) || minH));

  // Determine physical extension in meters
  const extMeters = ext / 1000;
  
  // The prop itself has length:
  const propLen = Math.max(1.8, hVal - extMeters);

  // Visual sizes in SVG coordinates
  const extHeight = extMeters * 60; // 0mm -> 0, 500mm -> 30px, 1000mm -> 60px
  const outerTubeHeight = 85;
  // Inner tube extension above the collar (scale 35px per meter)
  const innerTubeExt = (propLen - 1.8) * 35;

  const groundY = 230;
  const extTopY = groundY - extHeight;
  const propCollarY = extTopY - outerTubeHeight;
  const yTop = propCollarY - 6 - innerTubeExt; // collar is 6px high

  let extColor = '#64748b';
  let extLabel = 'Standard';
  if (ext === 500) {
    extColor = '#16a34a'; // green
    extLabel = '500 mm Extension';
  } else if (ext === 1000) {
    extColor = '#9333ea'; // purple
    extLabel = '1000 mm Extension';
  }

  const statusText = ext > 0 ? `Requires ${extLabel}` : 'Standard (No Extension)';
  const labelText = model ? `${model} Setup: ${statusText}` : `${extLabel} Setup`;

  // Downward force arrow settings
  const arrowY1 = yTop - 36;
  const arrowY2 = yTop - 12;

  const renderSvg = () => (
    <svg viewBox="0 -45 160 305" className={styles.visualizerSvg} style={reportMode ? { height: '100%', width: 'auto' } : undefined}>
      {/* Ground Line */}
      <line x1={10} y1={230} x2={110} y2={230} stroke="var(--border-color)" strokeWidth={1} strokeDasharray="3 3" />
      
      {/* Dimension Line on left */}
      <g>
        <line x1={25} y1={yTop} x2={25} y2={230} stroke="var(--primary)" strokeWidth={1.5} />
        <polygon points={`25,${yTop} 21,${yTop + 6} 29,${yTop + 6}`} fill="var(--primary)" />
        <polygon points="25,230 21,224 29,224" fill="var(--primary)" />
        <rect x={4} y={(yTop + 230) / 2 - 9} width={42} height={18} fill="var(--bg-card)" rx={4} />
        <text x={25} y={(yTop + 230) / 2 + 5} fill="var(--primary)" fontSize={12} fontWeight="bold" textAnchor="middle">
          {hVal.toFixed(2)}m
        </text>
      </g>

      {/* Load Arrow (Force acting downward on top plate) */}
      {load !== undefined && (
        <g>
          <line x1={60} y1={arrowY1} x2={60} y2={arrowY2} stroke="#dc2626" strokeWidth={2} />
          <polygon points={`60,${arrowY2} 56,${arrowY2 - 6} 64,${arrowY2 - 6}`} fill="#dc2626" />
          <text x={60} y={arrowY1 - 6} fill="#dc2626" fontSize={11} fontWeight="bold" textAnchor="middle">
            {Number(load).toFixed(2)} kN
          </text>
        </g>
      )}

      {/* 1. EXTENSION (at the bottom) */}
      {ext > 0 && (
        <g>
          {/* Extension Baseplate */}
          <rect x={42} y={230} width={36} height={6} fill="#334155" rx={1} />
          <line x1={42} y1={233} x2={78} y2={233} stroke="#1e293b" strokeWidth={1} />
          
          {/* Extension Tube */}
          <rect x={53} y={extTopY} width={14} height={extHeight} fill={extColor} stroke={extColor} strokeWidth={0.5} />
          
          {/* Extension Top Plate */}
          <rect x={42} y={extTopY} width={36} height={6} fill="#475569" rx={1} />
        </g>
      )}

      {/* 2. PROP (stacked above the extension) */}
      {/* Prop Baseplate (sits on ground or top of extension top plate) */}
      <rect 
        x={ext > 0 ? 44 : 42} 
        y={ext > 0 ? extTopY - 4 : 230} 
        width={ext > 0 ? 32 : 36} 
        height={ext > 0 ? 4 : 6} 
        fill="#475569" 
        rx={1} 
      />

      {/* Prop Outer Tube */}
      <rect 
        x={55} 
        y={propCollarY} 
        width={10} 
        height={outerTubeHeight} 
        fill="#64748b" 
      />

      {/* Thread markings on Prop Outer Tube (upper part) */}
      <g opacity={0.4}>
        <line x1={55} y1={propCollarY + 10} x2={65} y2={propCollarY + 10} stroke="#1e293b" strokeWidth={1} />
        <line x1={55} y1={propCollarY + 15} x2={65} y2={propCollarY + 15} stroke="#1e293b" strokeWidth={1} />
        <line x1={55} y1={propCollarY + 20} x2={65} y2={propCollarY + 20} stroke="#1e293b" strokeWidth={1} />
        <line x1={55} y1={propCollarY + 25} x2={65} y2={propCollarY + 25} stroke="#1e293b" strokeWidth={1} />
        <line x1={55} y1={propCollarY + 30} x2={65} y2={propCollarY + 30} stroke="#1e293b" strokeWidth={1} />
      </g>

      {/* Collar */}
      <rect x={52} y={propCollarY} width={16} height={6} fill="#334155" rx={1} />

      {/* Inner Tube */}
      <rect x={57} y={yTop} width={6} height={propCollarY - yTop} fill="#cbd5e1" />

      {/* Adjustment Holes on Inner Tube */}
      <g fill="#475569" opacity={0.8}>
        {Array.from({ length: 10 }).map((_, i) => {
          const holeY = yTop + 10 + i * 12;
          if (holeY < propCollarY) {
            return <circle key={i} cx={60} cy={holeY} r={1} />;
          }
          return null;
        })}
      </g>

      {/* Pin */}
      <rect x={49} y={propCollarY - 3} width={22} height={3} fill="#f1f5f9" rx={0.5} stroke="#334155" strokeWidth={0.5} />
      <circle cx={50} cy={propCollarY - 1.5} r={1} fill="#64748b" />

      {/* Top Plate */}
      <rect x={42} y={yTop - 6} width={36} height={6} fill="#475569" rx={1} />
      <line x1={42} y1={yTop - 3} x2={78} y2={yTop - 3} stroke="#334155" strokeWidth={1} />
    </svg>
  );

  if (reportMode) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', height: '100%' }}>
        <span style={{ fontSize: '9px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '6px', letterSpacing: '0.05em' }}>Prop Layout Scheme</span>
        <div style={{ width: '100%', height: '190px', display: 'flex', alignItems: 'center', justifycontent: 'center' }}>
          {renderSvg()}
        </div>
        <span style={{ fontSize: '9px', fontWeight: 700, color: extColor, marginTop: '6px', textAlign: 'center' }}>
          {labelText}
        </span>
      </div>
    );
  }

  return (
    <div className={styles.visualizerCard}>
      <div className={styles.cardHeader}>Prop Visualisation</div>
      <div className={styles.visualizerWrapper}>
        {renderSvg()}
      </div>
      <div className={styles.visualizerLabel} style={{ color: extColor }}>
        {labelText}
      </div>
    </div>
  );
}

export default function SteelPropCalculator({ initialTab }) {
  const initialInputs = getSessionData('tempworks_steelprop_inputs', {
    concreteThickness: 300,
    unitWeight: 25,
    formworkLoad: 0.5,
    propLength: 2.8,
    areaMode: 'plan', // 'plan' (L x W) or 'direct'
    propSpacingL: 1.2,
    propSpacingW: 1.2,
    directArea: 1.44,
  });

  const [concreteThickness, setConcreteThickness] = useState(initialInputs.concreteThickness);
  const [unitWeight, setUnitWeight] = useState(initialInputs.unitWeight);
  const [formworkLoad, setFormworkLoad] = useState(initialInputs.formworkLoad);
  const [propLength, setPropLength] = useState(initialInputs.propLength);
  const [areaMode, setAreaMode] = useState(initialInputs.areaMode);
  const [propSpacingL, setPropSpacingL] = useState(initialInputs.propSpacingL);
  const [propSpacingW, setPropSpacingW] = useState(initialInputs.propSpacingW);
  const [directArea, setDirectArea] = useState(initialInputs.directArea);

  const [chartModel, setChartModel] = useState(() => getSessionData('tempworks_steelprop_chart_model', 'PA300'));
  const [activeTab, setActiveTab] = useState(initialTab || 'calculator');
  const tabsContainerRef = useRef(null);
  const reportRef = useRef(null);

  // Table display options
  const [tableOpts, setTableOpts] = useState(() => getSessionData('tempworks_steelprop_table_opts', {
    passOnly: false,
    sortDir: null,
  }));
  const [optionsOpen, setOptionsOpen] = useState(false);
  const optionsRef = useRef(null);

  useEffect(() => {
    saveSessionData('tempworks_steelprop_table_opts', tableOpts);
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
  const [projectId, setProjectId] = useState(() => getSessionData('tempworks_steelprop_project_id', 'TW-2026-PROP'));
  const [calculatedBy, setCalculatedBy] = useState(() => getSessionData('tempworks_steelprop_calculated_by', 'Engineer'));
  const [verificationDate, setVerificationDate] = useState(() => getSessionData('tempworks_steelprop_verification_date', new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })));

  useEffect(() => {
    saveSessionData('tempworks_steelprop_project_id', projectId);
  }, [projectId]);

  useEffect(() => {
    saveSessionData('tempworks_steelprop_calculated_by', calculatedBy);
  }, [calculatedBy]);

  useEffect(() => {
    saveSessionData('tempworks_steelprop_verification_date', verificationDate);
  }, [verificationDate]);

  // Report props visibility state
  const [visibleReportProps, setVisibleReportProps] = useState(null);

  useEffect(() => {
    saveSessionData('tempworks_steelprop_inputs', {
      concreteThickness, unitWeight, formworkLoad, propLength,
      areaMode, propSpacingL, propSpacingW, directArea,
    });
  }, [concreteThickness, unitWeight, formworkLoad, propLength, areaMode, propSpacingL, propSpacingW, directArea]);

  useEffect(() => {
    saveSessionData('tempworks_steelprop_chart_model', chartModel);
  }, [chartModel]);

  // Auto-scroll active tab into middle of scroll window on mobile
  useEffect(() => {
    if (tabsContainerRef.current) {
      const activeTabEl = tabsContainerRef.current.querySelector(`.${styles.active}`);
      if (activeTabEl) {
        activeTabEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
  }, [activeTab]);

  // Calculations
  const loadArea = useMemo(() => {
    if (areaMode === 'plan') {
      return (Number(propSpacingL) || 0) * (Number(propSpacingW) || 0);
    }
    return Number(directArea) || 0;
  }, [areaMode, propSpacingL, propSpacingW, directArea]);

  const propLoad = useMemo(() => calculatePropLoad({
    thickness: concreteThickness,
    area: loadArea,
    unitWeight,
    formworkLoad,
  }), [concreteThickness, loadArea, unitWeight, formworkLoad]);

  const configResults = useMemo(() => evaluatePropConfigurations({
    length: Number(propLength),
    propLoad: propLoad.F,
  }), [propLength, propLoad.F]);

  const passCount = configResults.filter((r) => r.pass).length;

  useEffect(() => {
    setVisibleReportProps(null);
  }, [configResults]);

  const activeReportProps = useMemo(() => {
    return visibleReportProps ?? configResults.map(r => r.model);
  }, [visibleReportProps, configResults]);

  const reportPassCount = useMemo(() => {
    return configResults.filter(r => activeReportProps.includes(r.model) && r.pass).length;
  }, [configResults, activeReportProps]);

  const filteredReportResults = useMemo(() => {
    return configResults.filter(r => activeReportProps.includes(r.model));
  }, [configResults, activeReportProps]);

  const handleToggleProp = (model) => {
    setVisibleReportProps((prev) => {
      const current = prev ?? configResults.map((r) => r.model);
      if (current.includes(model)) {
        return current.filter((m) => m !== model);
      } else {
        return [...current, model];
      }
    });
  };

  const handleSelectAllProps = () => {
    setVisibleReportProps(null);
  };

  const handleSelectPassOnlyProps = () => {
    const passingProps = configResults.filter((r) => r.pass).map((r) => r.model);
    setVisibleReportProps(passingProps);
  };

  const handleClearAllProps = () => {
    setVisibleReportProps([]);
  };

  const displayResults = useMemo(() => {
    let rows = configResults;
    if (tableOpts.passOnly) rows = rows.filter((r) => r.pass);
    if (tableOpts.sortDir) {
      const rank = (r) => (r.utilization === null
        ? Infinity
        : (tableOpts.sortDir === 'desc' ? -r.utilization : r.utilization));
      rows = [...rows].sort((a, b) => rank(a) - rank(b));
    }
    return rows;
  }, [configResults, tableOpts]);

  // Find the selected prop model's extension type at the current length to update the SVG
  const activeExt = useMemo(() => {
    const selectedProp = configResults.find((r) => r.model === chartModel);
    return selectedProp?.ext || 0;
  }, [configResults, chartModel]);

  const chartData = useMemo(() => buildPropChartData(chartModel), [chartModel]);

  const handlePrint = () => {
    const content = reportRef.current;
    if (!content) return;
    if (isIOS()) {
      shareReportPdf(content, 'TempWorks-Steel-Prop-Report.pdf');
      return;
    }
    const printWindow = window.open('', '_blank', 'width=900,height=1200');
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>TempWorks – Steel Prop Capacity Report</title>
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

  const extensionBadge = (ext) => {
    if (ext === 500) {
      return <span className={styles.badge} style={{ background: 'rgba(22, 163, 74, 0.12)', color: '#16a34a' }}>500mm Ext.</span>;
    }
    if (ext === 1000) {
      return <span className={styles.badge} style={{ background: 'rgba(147, 51, 234, 0.12)', color: '#9333ea' }}>1000mm Ext.</span>;
    }
    return <span className={styles.badge} style={{ background: 'var(--border-color-light)', color: 'var(--text-muted)' }}>Standard</span>;
  };

  const configTable = () => (
    <table className={styles.configTable}>
      <thead>
        <tr>
          <th>Model</th>
          <th>Extension required</th>
          <th className={styles.numHead}>Rated L [m]</th>
          <th className={styles.numHead}>Permissible Cap [kN]</th>
          <th>Utilisation</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        {displayResults.length === 0 && (
          <tr>
            <td colSpan={6} className={styles.emptyRow}>
              No prop configuration passes at this load / length. Adjust spacing or slab thickness.
            </td>
          </tr>
        )}
        {displayResults.map((row) => {
          const isSelected = row.model === chartModel;
          return (
            <tr
              key={row.model}
              className={`${row.capacity !== null && !row.pass ? styles.rowFail : ''} ${isSelected ? styles.rowSelected : ''}`}
              onClick={() => setChartModel(row.model)}
              style={{ cursor: 'pointer' }}
            >
              <td className={styles.systemCell}>{row.model}</td>
              <td>{row.capacity !== null ? extensionBadge(row.ext) : <span style={{ color: '#94a3b8' }}>—</span>}</td>
              <td className={styles.numCell}>{row.tableLength !== null ? row.tableLength.toFixed(1) : '—'}</td>
              <td className={styles.numCell}>{row.capacity !== null ? row.capacity.toFixed(2) : '—'}</td>
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
          );
        })}
      </tbody>
    </table>
  );

  return (
    <div className={styles.pageContainer}>
      <header className={styles.pageHeader}>
        <div className={styles.titleBlock}>
          <h1>Steel Prop Calculator</h1>
          <p>Heavy Duty Steel Prop System · Design Safety Factor: 1.65 (Permissible loads) · BS5975:2019</p>
        </div>
        <SavedDesigns
          calculator="steel-prop"
          title="Steel Prop"
          sessionKeys={DESIGN_SESSION_KEYS}
        />
      </header>

      {/* Tabs */}
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
          </div>

          <div className={styles.card}>
            <div className={styles.cardHeader}>Load Area per Prop</div>
            <div className={styles.radioGroup} style={{ marginBottom: '1rem' }}>
              <label className={styles.radioLabel}>
                <input type="radio" name="areaMode" checked={areaMode === 'plan'} onChange={() => setAreaMode('plan')} /> Spacing (L × W)
              </label>
              <label className={styles.radioLabel}>
                <input type="radio" name="areaMode" checked={areaMode === 'direct'} onChange={() => setAreaMode('direct')} /> Direct area
              </label>
            </div>

            {areaMode === 'plan' ? (
              <>
                <div className={styles.fieldRow}>
                  <span className={styles.fieldLabel}>Prop spacing L (m)</span>
                  <input type="number" step="0.1" min="0" className={styles.fieldInput} value={propSpacingL} onChange={(e) => setPropSpacingL(cleanNumericInput(e.target.value))} />
                </div>
                <div className={styles.fieldRow}>
                  <span className={styles.fieldLabel}>Prop spacing W (m)</span>
                  <input type="number" step="0.1" min="0" className={styles.fieldInput} value={propSpacingW} onChange={(e) => setPropSpacingW(cleanNumericInput(e.target.value))} />
                </div>
                <div className={styles.fieldRow}>
                  <span className={styles.fieldLabel}>Tributary area A = L × W (m²)</span>
                  <input type="text" readOnly className={styles.fieldInput} value={fmt(loadArea)} />
                </div>
              </>
            ) : (
              <div className={styles.fieldRow}>
                <span className={styles.fieldLabel}>Tributary area A (m²)</span>
                <input type="number" step="0.1" min="0" className={styles.fieldInput} value={directArea} onChange={(e) => setDirectArea(cleanNumericInput(e.target.value))} />
              </div>
            )}
          </div>

          <div className={styles.card}>
            <div className={styles.cardHeader}>Prop Length &amp; Settings</div>
            <div className={styles.fieldRow}>
              <span className={styles.fieldLabel}>Prop height / length (m)</span>
              <input type="number" step="0.1" min="1.8" max="5.0" className={styles.fieldInput} value={propLength} onChange={(e) => setPropLength(cleanNumericInput(e.target.value))} />
            </div>
            <p className={styles.hintText}>
              Props are rated for lengths from 1.8m to 5.0m. Capacity lookup rounds conservatively to the next 0.1m step.
            </p>
          </div>

        </div>

        {/* Right Content */}
        <div>
          {activeTab === 'calculator' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div className={styles.topRow}>
                <div className={styles.card} style={{ margin: 0 }}>
                  <div className={styles.cardHeader}>Design Load per Prop</div>
                  <div className={styles.resultsGrid}>
                    <div className={styles.resultBox}>
                      <span className={styles.resultLabel}>Concrete load q₂</span>
                      <span className={styles.resultValue}>{fmt(propLoad.q2)}</span>
                      <span className={styles.resultUnit}>kN/m²</span>
                    </div>
                    <div className={styles.resultBox}>
                      <span className={styles.resultLabel}>Construction load q₃</span>
                      <span className={styles.resultValue}>{fmt(propLoad.q3)}</span>
                      <span className={styles.resultUnit}>kN/m²</span>
                    </div>
                    <div className={styles.resultBox}>
                      <span className={styles.resultLabel}>Total area load Q</span>
                      <span className={styles.resultValue}>{fmt(propLoad.Q)}</span>
                      <span className={styles.resultUnit}>kN/m²</span>
                    </div>
                    <div className={`${styles.resultBox} ${styles.resultBoxAccent}`}>
                      <span className={styles.resultLabel}>Design load per prop F</span>
                      <span className={styles.resultValue}>{fmt(propLoad.F)}</span>
                      <span className={styles.resultUnit}>kN</span>
                    </div>
                  </div>
                  <p className={styles.hintText} style={{ marginTop: 0 }}>
                    Q = q₁ + q₂ + q₃ = {fmt(propLoad.q1)} + {fmt(propLoad.q2)} + {fmt(propLoad.q3)} = {fmt(propLoad.Q)} kN/m² · F = Q × A = {fmt(propLoad.Q)} × {fmt(loadArea)} = <strong>{fmt(propLoad.F)} kN</strong>
                  </p>
                </div>
                <PropDiagram model={chartModel} height={propLength} ext={activeExt} load={propLoad.F} />
              </div>

              <div className={styles.card}>
                <div className={styles.tableToolbar}>
                  <div className={styles.cardHeader} style={{ margin: 0 }}>
                    Prop Capacity Checks — Permissible capacity (Ultimate / 1.65) · {passCount}/{configResults.length} models pass
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
                          Show PASS-only props
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
                  Permissible load is computed as: Ultimate capacity in chart / 1.65.
                  Capacity lookup rounds conservatively to the next 0.1m step.
                </p>
              </div>

              <div className={styles.card}>
                <div className={styles.cardHeader}>Permissible Load vs Prop Length</div>
                <div className={styles.systemChips}>
                  {PROP_KEYS.map((key) => (
                    <button
                      key={key}
                      className={`${styles.systemChip} ${chartModel === key ? styles.active : ''}`}
                      onClick={() => setChartModel(key)}
                    >
                      {key}
                    </button>
                  ))}
                </div>
                <div className={styles.chartContainer}>
                  <StandardChart
                    data={chartData}
                    lines={[
                      {
                        dataKey: 'capacity',
                        name: `Permissible Capacity (kN)`,
                        color: 'var(--primary)',
                        type: 'linear',
                        props: { strokeWidth: 2.5, connectNulls: true },
                      },
                      {
                        dataKey: 'ultimateCapacity',
                        name: `Ultimate Capacity (kN)`,
                        color: '#94a3b8',
                        type: 'linear',
                        props: { strokeWidth: 1.5, strokeDasharray: '4 4', connectNulls: true },
                      }
                    ]}
                    xAxis={{
                      dataKey: 'length',
                      label: 'Prop Length (m)',
                      domain: [1.8, 5.0],
                      props: { type: 'number', tickCount: 10, domain: [1.8, 5.0] },
                    }}
                    yAxis={{
                      label: 'Capacity (kN)',
                      domain: [0, 'auto'],
                    }}
                    referenceLines={[
                      ...(Number(propLength) > 0 ? [{ x: Number(propLength), stroke: '#0f172a', label: `L = ${propLength} m` }] : []),
                      ...(propLoad.F > 0 ? [{ y: propLoad.F, stroke: '#dc2626', label: `F = ${fmt(propLoad.F, 1)} kN` }] : []),
                    ]}
                    height={380}
                  />
                </div>
                <p className={styles.hintText}>
                  Model: {chartModel}. Solid primary line shows permissible capacity (with 1.65 safety factor applied). Dashed line shows raw ultimate capacity. The red line represents the design load of {fmt(propLoad.F, 1)} kN.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'report' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', width: '100%', paddingBottom: '40px', overflowX: 'auto' }}>
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
                  >
                    {isIOS() ? <><Share2 size={16} /> Share PDF</> : <><FileText size={16} /> Print Report</>}
                  </button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    <span style={{ fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Project ID</span>
                    <input type="text" value={projectId} onChange={(e) => setProjectId(e.target.value)} style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px' }} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    <span style={{ fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Calculated By</span>
                    <input type="text" value={calculatedBy} onChange={(e) => setCalculatedBy(e.target.value)} style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px' }} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    <span style={{ fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Verification Date</span>
                    <input type="text" value={verificationDate} onChange={(e) => setVerificationDate(e.target.value)} style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px' }} />
                  </div>
                </div>

                {/* Inclusion Select Control */}
                <div style={{ marginTop: '0px', background: 'var(--border-color-light)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-bezel)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-main)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Models to Include in Report:
                    </span>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button 
                        onClick={handleSelectAllProps} 
                        style={{ fontSize: '10px', padding: '4px 10px', borderRadius: '4px', border: '1px solid var(--border-bezel)', background: 'var(--bg-card)', color: 'var(--text-main)', cursor: 'pointer', fontWeight: 700 }}
                      >
                        Select All
                      </button>
                      <button 
                        onClick={handleSelectPassOnlyProps} 
                        style={{ fontSize: '10px', padding: '4px 10px', borderRadius: '4px', border: '1px solid var(--border-bezel)', background: 'var(--bg-card)', color: '#16a34a', cursor: 'pointer', fontWeight: 700 }}
                      >
                        Select PASS Only
                      </button>
                      <button 
                        onClick={handleClearAllProps} 
                        style={{ fontSize: '10px', padding: '4px 10px', borderRadius: '4px', border: '1px solid var(--border-bezel)', background: 'var(--bg-card)', color: '#dc2626', cursor: 'pointer', fontWeight: 700 }}
                      >
                        Clear All
                      </button>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(135px, 1fr))', gap: '10px' }}>
                    {configResults.map((r) => {
                      const isChecked = activeReportProps.includes(r.model);
                      return (
                        <label key={r.model} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-secondary)', cursor: 'pointer', userSelect: 'none' }}>
                          <input 
                            type="checkbox" 
                            checked={isChecked} 
                            onChange={() => handleToggleProp(r.model)} 
                            style={{ accentColor: 'var(--primary)', cursor: 'pointer' }}
                          />
                          <span style={{ fontWeight: 600 }}>{r.model}</span>
                          <span style={{ fontSize: '8px', padding: '1px 4px', borderRadius: '3px', background: r.pass ? 'rgba(22, 163, 74, 0.1)' : 'rgba(220, 38, 38, 0.1)', color: r.pass ? '#16a34a' : '#dc2626', fontWeight: 800 }}>
                            {r.pass ? 'PASS' : 'FAIL'}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Printable Sheet */}
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
                  fontFamily: 'Inter, system-ui, sans-serif'
                }}
              >
                <div className="report-page" style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: 0 }}>
                  <div style={{ borderBottom: '2.5px solid #2563eb', paddingBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <div style={{ fontSize: '18px', fontWeight: 800, color: '#2563eb' }}>TEMPWORKS</div>
                      <div style={{ fontSize: '8px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Structural Design Solutions</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                        <span style={{ fontSize: '8px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>System by</span>
                        <img src={plytecLogoUrl} alt="PLYTEC" style={{ height: '16px', width: 'auto', objectFit: 'contain' }} />
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a' }}>Steel Prop Capacity Report</div>
                      <div style={{ fontSize: '8px', color: '#64748b', marginTop: '1px' }}>Permissible Design (Safety Factor 1.65) · Loads per BS5975:2019</div>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', background: '#f8fafc', padding: '8px 12px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                    <div>
                      <span style={{ color: '#64748b', fontSize: '8px', textTransform: 'uppercase', fontWeight: 700 }}>Project</span>
                      <div style={{ fontWeight: 600, fontSize: '10px' }}>{projectId || 'TW-2026-PROP'}</div>
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
                        {reportPassCount > 0 ? `✅ ${reportPassCount} MODEL${reportPassCount > 1 ? 'S' : ''} ADEQUATE` : '❌ NO ADEQUATE MODELS'}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '20px', marginTop: '4px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
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
                              <td style={{ padding: '4px 0', color: '#64748b' }}>Tributary Area per Prop (A)</td>
                              <td style={{ padding: '4px 0', fontWeight: 600, textAlign: 'right' }}>
                                {areaMode === 'plan' ? `${propSpacingL} m × ${propSpacingW} m = ${fmt(loadArea)} m²` : `${fmt(loadArea)} m²`}
                              </td>
                            </tr>
                            <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                              <td style={{ padding: '4px 0', color: '#64748b' }}>Prop Design Length</td>
                              <td style={{ padding: '4px 0', fontWeight: 600, textAlign: 'right' }}>{propLength} m</td>
                            </tr>
                            <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                              <td style={{ padding: '4px 0', color: '#64748b' }}>Factor of Safety (FoS)</td>
                              <td style={{ padding: '4px 0', fontWeight: 600, textAlign: 'right' }}>{SAFETY_FACTOR} (Permissible load design)</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>

                      <div>
                        <div style={{ fontSize: '10px', fontWeight: 700, color: '#334155', textTransform: 'uppercase', marginBottom: '4px', borderBottom: '1px solid #cbd5e1', paddingBottom: '2px' }}>
                          2. Load Derivation (BS5975:2019)
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '10px' }}>
                          <div>
                            <strong>Concrete load:</strong>
                            <div style={{ background: '#f1f5f9', padding: '3px 6px', borderRadius: '4px', fontFamily: 'monospace', marginTop: '2px' }}>
                              q₂ = {unitWeight} × {Number(concreteThickness) / 1000} = {fmt(propLoad.q2)} kN/m²
                            </div>
                          </div>
                          <div>
                            <strong>Construction load (1.5 ≤ q₃ ≤ 2.5):</strong>
                            <div style={{ background: '#f1f5f9', padding: '3px 6px', borderRadius: '4px', fontFamily: 'monospace', marginTop: '2px' }}>
                              q₃ = 0.1 × {fmt(propLoad.q2)} + 0.75 → {fmt(propLoad.q3)} kN/m²
                            </div>
                          </div>
                          <div>
                            <strong>Total area load:</strong>
                            <div style={{ background: '#f1f5f9', padding: '3px 6px', borderRadius: '4px', fontFamily: 'monospace', marginTop: '2px' }}>
                              Q = q₁ + q₂ + q₃ = {fmt(propLoad.Q)} kN/m²
                            </div>
                          </div>
                          <div>
                            <strong>Design load per prop:</strong>
                            <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', padding: '3px 6px', borderRadius: '4px', fontFamily: 'monospace', marginTop: '2px', fontWeight: 700 }}>
                              F = Q × A = {fmt(propLoad.Q)} × {fmt(loadArea)} = {fmt(propLoad.F)} kN
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Prop visual layout inside the engineering audit report */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '10px', background: '#f8fafc' }}>
                      <PropDiagram model={chartModel} height={propLength} ext={activeExt} load={propLoad.F} reportMode={true} />
                    </div>
                  </div>

                  <div style={{ marginTop: '10px' }}>
                    <div style={{ fontSize: '10px', fontWeight: 700, color: '#334155', textTransform: 'uppercase', marginBottom: '4px', borderBottom: '1px solid #cbd5e1', paddingBottom: '2px' }}>
                      3. Configuration Evaluations
                    </div>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9px' }}>
                      <thead>
                        <tr style={{ borderBottom: '1.5px solid #64748b', color: '#475569', fontWeight: 700 }}>
                          <th style={{ padding: '4px', textAlign: 'left' }}>Model</th>
                          <th style={{ padding: '4px', textAlign: 'left' }}>Extension Required</th>
                          <th style={{ padding: '4px', textAlign: 'right' }}>Tabulated Length [m]</th>
                          <th style={{ padding: '4px', textAlign: 'right' }}>Ultimate Capacity [kN]</th>
                          <th style={{ padding: '4px', textAlign: 'right' }}>Permissible Capacity [kN]</th>
                          <th style={{ padding: '4px', textAlign: 'right' }}>Utilisation</th>
                          <th style={{ padding: '4px', textAlign: 'center' }}>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredReportResults.length === 0 ? (
                          <tr>
                            <td colSpan={7} style={{ padding: '8px', textAlign: 'center', color: '#94a3b8', fontStyle: 'italic' }}>
                              No models selected for report.
                            </td>
                          </tr>
                        ) : (
                          filteredReportResults.map((row) => {
                            const extLabel = row.ext === 500 ? '500mm Extension' : row.ext === 1000 ? '1000mm Extension' : 'Standard (0mm)';
                            const utilizationPct = row.utilization !== null ? `${(row.utilization * 100).toFixed(0)}%` : '—';
                            
                            return (
                              <tr key={row.model} style={{ borderBottom: '1px solid #f1f5f9', background: row.capacity !== null && !row.pass ? 'rgba(220, 38, 38, 0.03)' : 'transparent' }}>
                                <td style={{ padding: '4px', fontWeight: 600 }}>{row.model}</td>
                                <td style={{ padding: '4px' }}>{row.capacity !== null ? extLabel : '—'}</td>
                                <td style={{ padding: '4px', textAlign: 'right' }}>{row.tableLength !== null ? row.tableLength.toFixed(1) : '—'}</td>
                                <td style={{ padding: '4px', textAlign: 'right' }}>{row.ultimateCapacity !== null ? row.ultimateCapacity.toFixed(2) : '—'}</td>
                                <td style={{ padding: '4px', textAlign: 'right', fontWeight: 600 }}>{row.capacity !== null ? row.capacity.toFixed(2) : '—'}</td>
                                <td style={{ padding: '4px', textAlign: 'right', fontWeight: 600, color: utilizationColor(row.utilization) }}>{utilizationPct}</td>
                                <td style={{ padding: '4px', textAlign: 'center', fontWeight: 800, color: row.pass ? '#16a34a' : '#dc2626' }}>
                                  {row.capacity === null ? 'N/A' : row.pass ? 'PASS' : 'FAIL'}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div style={{ marginTop: '16px', borderTop: '1px solid #cbd5e1', paddingTop: '8px', fontSize: '8px', color: '#64748b', display: 'flex', justifyContent: 'space-between' }}>
                    <span>TempWorks Design Engine · Generated Automatically</span>
                    <span>Page 1 of 1</span>
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
