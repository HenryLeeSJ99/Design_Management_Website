import React, { useState, useMemo, useEffect, useRef } from 'react';
import { FileText, ArrowLeft, Share2, Info, X } from 'lucide-react';
import { calculateBackprop } from '../engine/formwork/backprop';

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
import { SHORING_SYSTEMS } from '../engine/formwork/shoringTower';
import styles from './BackpropCalculator.module.css';
import plytecLogoUrl from '../assets/PLYTEC_Logo.svg';

// Custom isIOS detection for print sharing
const isIOS = () => {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
};

// Available support model options
const propOptions = ['PA300', 'PA350', 'PA400', 'PB320', 'PB350', 'PB350-L', 'PD350', '30-350', 'PE350'];
const towerOptions = [
  { value: 'WCL48-A', label: 'WCL48 - Type A' },
  { value: 'WCL48-B', label: 'WCL48 - Type B' },
  { value: 'WCL48-C', label: 'WCL48 - Type C' },
  { value: 'WCL48-D', label: 'WCL48 - Type D' },
  { value: 'WH48-A', label: 'WH48 - Type A' },
  { value: 'WH48-B', label: 'WH48 - Type B' },
  { value: 'WH48-C', label: 'WH48 - Type C' },
  { value: 'WH48-D', label: 'WH48 - Type D' },
];

export default function BackpropCalculator({ initialTab }) {
  // Global Wet Pour Inputs
  const [pourThickness, setPourThickness] = useState(() => Number(getSessionData('tempworks_backprop_pour_thickness', 300)));
  const [unitWeight, setUnitWeight] = useState(() => Number(getSessionData('tempworks_backprop_unit_weight', 25)));
  const [formworkLoad, setFormworkLoad] = useState(() => Number(getSessionData('tempworks_backprop_formwork_load', 0.5)));
  const [constructionLoad, setConstructionLoad] = useState(() => Number(getSessionData('tempworks_backprop_construction_load', 1.5)));
  const [numFloors, setNumFloors] = useState(() => Number(getSessionData('tempworks_backprop_num_floors', 2)));

  // Level-specific configurations (Index 0 = Cured Slab 1 directly below pour)
  const [floorConfigs, setFloorConfigs] = useState(() => {
    return getSessionData('tempworks_backprop_floor_configs', [
      { slabThickness: 300, ageFactor: 75, deadCapacity: 1.5, liveCapacity: 2.5, systemType: 'prop', selectedModel: 'PA300', spacingL: 1.5, spacingW: 1.5, height: 2.8 },
      { slabThickness: 300, ageFactor: 85, deadCapacity: 1.5, liveCapacity: 2.5, systemType: 'prop', selectedModel: 'PA300', spacingL: 1.5, spacingW: 1.5, height: 2.8 },
      { slabThickness: 300, ageFactor: 90, deadCapacity: 1.5, liveCapacity: 2.5, systemType: 'prop', selectedModel: 'PA300', spacingL: 1.5, spacingW: 1.5, height: 2.8 },
      { slabThickness: 300, ageFactor: 95, deadCapacity: 1.5, liveCapacity: 2.5, systemType: 'prop', selectedModel: 'PA300', spacingL: 1.5, spacingW: 1.5, height: 2.8 },
      { slabThickness: 300, ageFactor: 100, deadCapacity: 1.5, liveCapacity: 2.5, systemType: 'prop', selectedModel: 'PA300', spacingL: 1.5, spacingW: 1.5, height: 2.8 },
      { slabThickness: 300, ageFactor: 100, deadCapacity: 1.5, liveCapacity: 2.5, systemType: 'prop', selectedModel: 'PA300', spacingL: 1.5, spacingW: 1.5, height: 2.8 },
    ]);
  });

  // Active editing overlay state: null | { type: 'slab'|'support', index: number }
  const [activeEdit, setActiveEdit] = useState(null);

  // Metadata states
  const [projectId, setProjectId] = useState(() => getSessionData('tempworks_backprop_project_id', 'TW-2026-BP'));
  const [calculatedBy, setCalculatedBy] = useState(() => getSessionData('tempworks_backprop_calculated_by', 'Engineer'));
  const [verificationDate, setVerificationDate] = useState(() => getSessionData('tempworks_backprop_verification_date', new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })));

  const [activeTab, setActiveTab] = useState(initialTab || 'calculator');
  const reportRef = useRef(null);

  // Persistence hooks
  useEffect(() => {
    saveSessionData('tempworks_backprop_pour_thickness', pourThickness);
    saveSessionData('tempworks_backprop_unit_weight', unitWeight);
    saveSessionData('tempworks_backprop_formwork_load', formworkLoad);
    saveSessionData('tempworks_backprop_construction_load', constructionLoad);
    saveSessionData('tempworks_backprop_num_floors', numFloors);
  }, [pourThickness, unitWeight, formworkLoad, constructionLoad, numFloors]);

  useEffect(() => {
    saveSessionData('tempworks_backprop_floor_configs', floorConfigs);
  }, [floorConfigs]);

  useEffect(() => {
    saveSessionData('tempworks_backprop_project_id', projectId);
  }, [projectId]);

  useEffect(() => {
    saveSessionData('tempworks_backprop_calculated_by', calculatedBy);
  }, [calculatedBy]);

  useEffect(() => {
    saveSessionData('tempworks_backprop_verification_date', verificationDate);
  }, [verificationDate]);

  // Handle floor configuration modification
  const handleConfigChange = (index, field, value) => {
    setFloorConfigs((prev) => {
      const copy = [...prev];
      if (!copy[index]) {
        copy[index] = { slabThickness: 300, ageFactor: 100, deadCapacity: 1.5, liveCapacity: 2.5, systemType: 'prop', selectedModel: 'PA300', spacingL: 1.5, spacingW: 1.5, height: 2.8 };
      }
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  // Perform backprop load and capacity calculations
  const calc = useMemo(() => {
    return calculateBackprop({
      pourThickness,
      unitWeight,
      formworkLoad,
      constructionLoad,
      numFloors,
      floorConfigs,
    });
  }, [pourThickness, unitWeight, formworkLoad, constructionLoad, numFloors, floorConfigs]);

  const handlePrint = () => {
    window.print();
  };

  // Diagram scaling math helper
  const H = 60; // constant story height in SVG pixels
  const bottomSlabIsGround = floorConfigs[numFloors - 1]?.isGroundSlab || false;
  const viewBoxHeight = bottomSlabIsGround ? 50 + numFloors * H : 50 + (numFloors + 1) * H;

  // Helper to draw slab status badge
  const renderStatusRing = (cx, cy, pass) => {
    return (
      <g>
        <circle cx={cx} cy={cy} r={10} fill={pass ? '#16a34a' : '#dc2626'} stroke="#ffffff" strokeWidth={1.5} />
        {pass ? (
          <path d={`M ${cx - 4.5} ${cy} L ${cx - 1.5} ${cy + 3} L ${cx + 4.5} ${cy - 3.5}`} fill="none" stroke="#ffffff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        ) : (
          <path d={`M ${cx - 3.5} ${cy - 3.5} L ${cx + 3.5} ${cy + 3.5} M ${cx + 3.5} ${cy - 3.5} L ${cx - 3.5} ${cy + 3.5}`} fill="none" stroke="#ffffff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        )}
      </g>
    );
  };

  const drawSlab = (y, labelText, isPour, pass, index) => {
    const isActive = activeEdit && activeEdit.type === 'slab' && activeEdit.index === index;
    return (
      <g
        key={y}
        onClick={() => {
          if (!isPour) setActiveEdit({ type: 'slab', index });
        }}
        className={styles.hotspotSlab + (isActive ? ' ' + styles.hotspotSlabActive : '')}
      >
        <rect
          x={15}
          y={y - 8}
          width={210}
          height={16}
          fill={isPour ? '#3b82f6' : '#64748b'}
          fillOpacity={isPour ? 0.85 : 0.65}
          stroke={isActive ? 'var(--primary)' : '#475569'}
          strokeWidth={isActive ? 2 : 1}
          rx={1.5}
        />
        {isPour && (
          <g opacity={0.3} stroke="#ffffff" strokeWidth={0.5}>
            {[20, 40, 60, 80, 100, 120, 140, 160, 180, 200, 220].map((x) => (
              <line key={x} x1={x} y1={y - 8} x2={x + 10} y2={y + 8} />
            ))}
          </g>
        )}
        <text x={120} y={y + 4} fill="#ffffff" fontSize="12px" fontWeight="900" textAnchor="middle">
          {labelText}
        </text>
        {!isPour && renderStatusRing(233, y, pass)}
      </g>
    );
  };

  const drawGroundSlab = (y) => {
    return (
      <g key="ground-slab">
        <rect
          x={15}
          y={y - 8}
          width={210}
          height={16}
          fill="#334155"
          fillOpacity={0.85}
          stroke="#1e293b"
          strokeWidth={1.5}
          rx={1.5}
        />
        <text x={120} y={y + 4} fill="#ffffff" fontSize="12px" fontWeight="900" textAnchor="middle">
          GROUND SLAB / FOUNDATION
        </text>
      </g>
    );
  };

  const drawSupports = (yTop, yBottom, pass, index, systemType) => {
    const isProp = systemType === 'prop';
    const isActive = activeEdit && activeEdit.type === 'support' && activeEdit.index === index;

    return (
      <g
        key={`supports-${index}`}
        onClick={() => setActiveEdit({ type: 'support', index })}
        className={styles.hotspotSupport + (isActive ? ' ' + styles.hotspotSupportActive : '')}
      >
        {/* Invisible wider bounding box for easier clicking */}
        <rect x={30} y={yTop + 8} width={180} height={yBottom - yTop - 16} fill="transparent" />

        {isProp ? (
          // Render 3 Steel Props
          [60, 120, 180].map((x) => (
            <g key={x} opacity={0.95}>
              <rect x={x - 3} y={yTop + (yBottom - yTop) * 0.3} width={6} height={(yBottom - yTop) * 0.7 - 8} fill={isActive ? 'var(--primary)' : '#475569'} rx={0.5} />
              <rect x={x - 2} y={yTop + 8} width={4} height={(yBottom - yTop) * 0.3} fill="#cbd5e1" />
              <rect x={x - 5} y={yTop + 8} width={10} height={2} fill="#334155" />
              <rect x={x - 5} y={yBottom - 10} width={10} height={2} fill="#334155" />
            </g>
          ))
        ) : (
          // Render a Shoring Tower frame with cross bracing
          <g opacity={0.95}>
            <rect x={60} y={yTop + 8} width={8} height={yBottom - yTop - 16} fill={isActive ? 'var(--primary)' : '#475569'} rx={0.5} />
            <rect x={172} y={yTop + 8} width={8} height={yBottom - yTop - 16} fill={isActive ? 'var(--primary)' : '#475569'} rx={0.5} />
            <line x1={68} y1={yTop + 14} x2={172} y2={yTop + 14} stroke="#334155" strokeWidth={2} />
            <line x1={68} y1={yBottom - 14} x2={172} y2={yBottom - 14} stroke="#334155" strokeWidth={2} />
            <line x1={68} y1={yTop + 14} x2={172} y2={yBottom - 14} stroke={isActive ? 'var(--primary)' : '#64748b'} strokeWidth={1.5} strokeDasharray="2,2" />
            <line x1={172} y1={yTop + 14} x2={68} y2={yBottom - 14} stroke={isActive ? 'var(--primary)' : '#64748b'} strokeWidth={1.5} strokeDasharray="2,2" />
          </g>
        )}
        {renderStatusRing(120, (yTop + yBottom) / 2, pass)}
        <text x={136} y={(yTop + yBottom) / 2 + 4} fill={pass ? '#16a34a' : '#dc2626'} fontSize="11.5px" fontWeight="900">
          P{numFloors - index}
        </text>
      </g>
    );
  };

  // Render floating overlay input parameters editor
  const renderFloatingOverlay = () => {
    if (!activeEdit) return null;
    const { type, index } = activeEdit;
    const cfg = floorConfigs[index] || {};

    // Calculate vertical alignment coordinates based on SVG level heights
    const yVal = 25 + (index + 1) * H;
    const yMid = 25 + (index + 0.5) * H;

    // Standard height ratio for alignment
    const percentageTop = type === 'slab' ? (yVal / viewBoxHeight) * 100 : (yMid / viewBoxHeight) * 100;

    if (type === 'slab') {
      return (
        <div className={styles.overlayCard} style={{ left: '15px', top: `${percentageTop - 12}%` }}>
          <div className={styles.overlayCardHeader}>
            <span>Configure Slab {index + 1}</span>
            <button className={styles.overlayCloseBtn} onClick={() => setActiveEdit(null)}><X size={14} /></button>
          </div>
          <div className={styles.fieldGroup}>
            <div className={styles.fieldRow}>
              <span className={styles.fieldLabel}>Thickness (mm)</span>
              <input
                type="number"
                step="10"
                value={cfg.slabThickness || 300}
                onChange={(e) => handleConfigChange(index, 'slabThickness', Math.max(0, Number(e.target.value)))}
                className={styles.fieldInput}
              />
            </div>
            <div className={styles.fieldRow}>
              <span className={styles.fieldLabel}>Strength Factor (%)</span>
              <input
                type="number"
                step="5"
                value={cfg.ageFactor !== undefined ? cfg.ageFactor : 100}
                onChange={(e) => handleConfigChange(index, 'ageFactor', Math.min(100, Math.max(0, Number(e.target.value))))}
                className={styles.fieldInput}
              />
            </div>
            <div className={styles.fieldRow}>
              <span className={styles.fieldLabel}>Super dead cap (kN/m²)</span>
              <input
                type="number"
                step="0.5"
                value={cfg.deadCapacity !== undefined ? cfg.deadCapacity : 1.5}
                onChange={(e) => handleConfigChange(index, 'deadCapacity', Math.max(0, Number(e.target.value)))}
                className={styles.fieldInput}
              />
            </div>
            <div className={styles.fieldRow}>
              <span className={styles.fieldLabel}>Design live cap (kN/m²)</span>
              <input
                type="number"
                step="0.5"
                value={cfg.liveCapacity !== undefined ? cfg.liveCapacity : 2.5}
                onChange={(e) => handleConfigChange(index, 'liveCapacity', Math.max(0, Number(e.target.value)))}
                className={styles.fieldInput}
              />
            </div>
            {index === numFloors - 1 && (
              <div className={styles.fieldRow} style={{ borderTop: '1px solid var(--border-color-light)', paddingTop: '8px', marginTop: '4px' }}>
                <span className={styles.fieldLabel} style={{ fontWeight: 800 }}>Is Ground Slab?</span>
                <input
                  type="checkbox"
                  checked={cfg.isGroundSlab || false}
                  onChange={(e) => handleConfigChange(index, 'isGroundSlab', e.target.checked)}
                  style={{ cursor: 'pointer', transform: 'scale(1.2)' }}
                />
              </div>
            )}
          </div>
        </div>
      );
    } else {
      // Support details editor
      const systemTypeVal = cfg.systemType || 'prop';
      const modelVal = cfg.selectedModel || (systemTypeVal === 'prop' ? 'PA300' : 'WCL48-A');

      return (
        <div className={styles.overlayCard} style={{ right: '15px', top: `${percentageTop - 15}%` }}>
          <div className={styles.overlayCardHeader}>
            <span>Configure Props Level {numFloors - index}</span>
            <button className={styles.overlayCloseBtn} onClick={() => setActiveEdit(null)}><X size={14} /></button>
          </div>
          <div className={styles.fieldGroup}>
            <div className={styles.fieldRow}>
              <span className={styles.fieldLabel}>System Type</span>
              <select
                value={systemTypeVal}
                onChange={(e) => {
                  const val = e.target.value;
                  handleConfigChange(index, 'systemType', val);
                  handleConfigChange(index, 'selectedModel', val === 'prop' ? 'PA300' : 'WCL48-A');
                }}
                className={styles.selectInput}
              >
                <option value="prop">Steel Prop</option>
                <option value="tower">Shoring Tower</option>
              </select>
            </div>
            <div className={styles.fieldRow}>
              <span className={styles.fieldLabel}>Support Model</span>
              {systemTypeVal === 'prop' ? (
                <select
                  value={modelVal}
                  onChange={(e) => handleConfigChange(index, 'selectedModel', e.target.value)}
                  className={styles.selectInput}
                >
                  {propOptions.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : (
                <select
                  value={modelVal}
                  onChange={(e) => handleConfigChange(index, 'selectedModel', e.target.value)}
                  className={styles.selectInput}
                >
                  {towerOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              )}
            </div>
            <div className={styles.fieldRow}>
              <span className={styles.fieldLabel}>Spacing L (m)</span>
              <input
                type="number"
                step="0.05"
                value={cfg.spacingL || 1.5}
                onChange={(e) => handleConfigChange(index, 'spacingL', Math.max(0.1, Number(e.target.value)))}
                className={styles.fieldInput}
              />
            </div>
            <div className={styles.fieldRow}>
              <span className={styles.fieldLabel}>Spacing W (m)</span>
              <input
                type="number"
                step="0.05"
                value={cfg.spacingW || 1.5}
                onChange={(e) => handleConfigChange(index, 'spacingW', Math.max(0.1, Number(e.target.value)))}
                className={styles.fieldInput}
              />
            </div>
            <div className={styles.fieldRow}>
              <span className={styles.fieldLabel}>Height (m)</span>
              <input
                type="number"
                step="0.05"
                value={cfg.height || 2.8}
                onChange={(e) => handleConfigChange(index, 'height', Math.max(0.1, Number(e.target.value)))}
                className={styles.fieldInput}
              />
            </div>
          </div>
        </div>
      );
    }
  };

  return (
    <div className={styles.pageContainer}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.headerTitle}>Backpropping Calculator</h1>
          <p className={styles.headerDesc}>Multistory Slab Construction Load Sharing & Support Capacity Checks</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setActiveTab(activeTab === 'calculator' ? 'report' : 'calculator')}
            className={styles.selectInputAuto}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 700 }}
          >
            {activeTab === 'calculator' ? <><FileText size={14} /> View Audit Report</> : <><ArrowLeft size={14} /> Back to Dashboard</>}
          </button>
        </div>
      </div>

      {activeTab === 'calculator' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Top Panel: Global Pour Setup & Layout */}
          <div className={styles.topInputsGrid}>
            {/* Global Slab Setup */}
            <div className={styles.card}>
              <div className={styles.cardHeader}>Wet Pour Concrete Slab Details</div>
              <div className={styles.fieldGroup}>
                <div className={styles.fieldRow}>
                  <span className={styles.fieldLabel}>Slab Thickness (mm)</span>
                  <input type="number" step="10" value={pourThickness} onChange={(e) => setPourThickness(Math.max(0, Number(e.target.value)))} className={styles.fieldInput} />
                </div>
                <div className={styles.fieldRow}>
                  <span className={styles.fieldLabel}>Concrete Weight (kN/m³)</span>
                  <input type="number" step="0.5" value={unitWeight} onChange={(e) => setUnitWeight(Math.max(0, Number(e.target.value)))} className={styles.fieldInput} />
                </div>
                <div className={styles.fieldRow}>
                  <span className={styles.fieldLabel}>Formwork Load (kN/m²)</span>
                  <input type="number" step="0.05" value={formworkLoad} onChange={(e) => setFormworkLoad(Math.max(0, Number(e.target.value)))} className={styles.fieldInput} />
                </div>
                <div className={styles.fieldRow}>
                  <span className={styles.fieldLabel}>Construction Load (kN/m²)</span>
                  <input type="number" step="0.1" value={constructionLoad} onChange={(e) => setConstructionLoad(Math.max(0, Number(e.target.value)))} className={styles.fieldInput} />
                </div>
              </div>
            </div>

            {/* Global Slabs Number Setup */}
            <div className={styles.card}>
              <div className={styles.cardHeader}>Structure Layout Configuration</div>
              <div className={styles.fieldGroup}>
                <div className={styles.fieldRow}>
                  <span className={styles.fieldLabel}>Backpropped Floors (N)</span>
                  <select value={numFloors} onChange={(e) => {
                    setNumFloors(Number(e.target.value));
                    setActiveEdit(null); // Close overlays
                  }} className={styles.selectInput}>
                    <option value={1}>1 floor level</option>
                    <option value={2}>2 floor levels</option>
                    <option value={3}>3 floor levels</option>
                    <option value={4}>4 floor levels</option>
                    <option value={5}>5 floor levels</option>
                    <option value={6}>6 floor levels</option>
                  </select>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', background: 'var(--border-color-light)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-bezel)', marginTop: '8px' }}>
                  <Info size={18} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: '1.45' }}>
                    <strong>Interactive Canvas below:</strong> Click on any Slab or Support line in the diagram to configure its independent spacing, age factors, and shoring systems!
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className={styles.visualizerCanvasCard}>
            {/* Dim backdrop overlay for tapping outside to close modal */}
            {activeEdit && (
              <div className={styles.backdrop} onClick={() => setActiveEdit(null)} />
            )}

            <div className={styles.canvasHeader}>
              <span className={styles.canvasTitle}>Backpropping Elevation Layout</span>
              <span className={styles.canvasInstruction}>👈 Click slab to edit / Click prop columns to edit system model 👉</span>
            </div>

            {/* Mobile Level Select Buttons */}
            <div className={styles.mobileLevelSelector}>
              <span className={styles.mobileLevelSelectorTitle}>Select Level to Configure:</span>
              <div className={styles.mobileLevelButtonsGrid}>
                {Array.from({ length: numFloors }).map((_, idx) => {
                  const slabActive = activeEdit?.type === 'slab' && activeEdit?.index === idx;
                  const supportActive = activeEdit?.type === 'support' && activeEdit?.index === idx;
                  const slabCfg = floorConfigs[idx] || {};
                  const isTower = slabCfg.systemType === 'tower';
                  const supportModel = slabCfg.selectedModel || (isTower ? 'WCL48-A' : 'PA300');
                  
                  return (
                    <React.Fragment key={idx}>
                      <button
                        onClick={() => setActiveEdit({ type: 'slab', index: idx })}
                        className={styles.mobileLevelBtn + (slabActive ? ' ' + styles.mobileLevelBtnActive : '')}
                      >
                        Slab {idx + 1} ({slabCfg.slabThickness || 300}mm)
                      </button>
                      <button
                        onClick={() => setActiveEdit({ type: 'support', index: idx })}
                        className={styles.mobileLevelBtn + (supportActive ? ' ' + styles.mobileLevelBtnActive : '')}
                      >
                        P{numFloors - idx} ({supportModel})
                      </button>
                    </React.Fragment>
                  );
                })}
              </div>
            </div>

            <div className={styles.visualizerWrapper}>
              <svg viewBox={`0 0 240 ${viewBoxHeight}`} className={styles.visualizerSvg}>
                {/* Draw Pour Slab */}
                {drawSlab(25, 'WET POUR SLAB', true, null, -1)}

                {/* Draw Slabs dynamically */}
                {Array.from({ length: numFloors }).map((_, idx) => {
                  const y = 25 + (idx + 1) * H;
                  const res = calc.floorResults[idx];
                  if (idx === numFloors - 1 && bottomSlabIsGround) {
                    return drawGroundSlab(y);
                  }
                  return drawSlab(y, `CURED SLAB ${idx + 1}`, false, res?.slabPass, idx);
                })}

                {/* Draw Props/Tower configurations dynamically */}
                {Array.from({ length: numFloors }).map((_, idx) => {
                  const yTop = 25 + idx * H;
                  const yBottom = 25 + (idx + 1) * H;
                  const res = calc.floorResults[idx];
                  return drawSupports(yTop, yBottom, res?.propPass, idx, res?.systemType);
                })}

                {/* Draw Ground Slab / Foundation Boundary (only if bottom slab is not already ground) */}
                {!bottomSlabIsGround && drawGroundSlab(25 + (numFloors + 1) * H)}
              </svg>

              {/* Floating parameter overview tags in visual canvas (Absolute Left) */}
              <div style={{ position: 'absolute', left: '-120px', top: 0, bottom: 0, width: '110px', pointerEvents: 'none' }}>
                <div
                  className={styles.paramBubble}
                  style={{
                    position: 'absolute',
                    top: `${(25 / viewBoxHeight) * 100}%`,
                    left: 0,
                    transform: 'translateY(-50%)'
                  }}
                >
                  Pour: {pourThickness}mm
                </div>
                {Array.from({ length: numFloors }).map((_, idx) => {
                  const cfg = floorConfigs[idx] || {};
                  const y = 25 + (idx + 1) * H;
                  return (
                    <div
                      key={idx}
                      className={styles.paramBubble}
                      style={{
                        position: 'absolute',
                        top: `${(y / viewBoxHeight) * 100}%`,
                        left: 0,
                        transform: 'translateY(-50%)'
                      }}
                    >
                      Slab {idx + 1}: {cfg.slabThickness || 300}mm | {cfg.ageFactor || 100}%
                    </div>
                  );
                })}
              </div>

              {/* Floating parameter overview tags in visual canvas (Absolute Right) */}
              <div style={{ position: 'absolute', right: '-145px', top: 0, bottom: 0, width: '135px', pointerEvents: 'none' }}>
                {Array.from({ length: numFloors }).map((_, idx) => {
                  const cfg = floorConfigs[idx] || {};
                  const isTower = cfg.systemType === 'tower';
                  const modelLabel = cfg.selectedModel || (isTower ? 'WCL48-A' : 'PA300');
                  const spacing = `${cfg.spacingL || 1.5}x${cfg.spacingW || 1.5}m`;
                  const yMid = 25 + (idx + 0.5) * H;
                  return (
                    <div
                      key={idx}
                      className={styles.paramBubble}
                      style={{
                        position: 'absolute',
                        top: `${(yMid / viewBoxHeight) * 100}%`,
                        left: 0,
                        transform: 'translateY(-50%)'
                      }}
                    >
                      P{numFloors - idx}: {modelLabel} @ {spacing}
                    </div>
                  );
                })}
              </div>

              {/* FLOATING INPUTS OVERLAY CARDS */}
              {renderFloatingOverlay()}
            </div>
          </div>

          {/* Results Summary Grid */}
          <div className={styles.resultsGrid}>
            <div className={styles.resultBox}>
              <span className={styles.resultLabel}>Total Pour Area Load</span>
              <span className={styles.resultValue}>{calc.W_poured.toFixed(2)} <span style={{ fontSize: '10px' }}>kN/m²</span></span>
            </div>
            <div className={styles.resultBox}>
              <span className={styles.resultLabel}>Shared Load per Slab</span>
              <span className={styles.resultValue}>{calc.slabLoadShare.toFixed(2)} <span style={{ fontSize: '10px' }}>kN/m²</span></span>
            </div>
            <div className={styles.resultBoxAccent + ' ' + styles.resultBox}>
              <span className={styles.resultLabel}>Resultant Ground Leg Load</span>
              <span className={styles.resultValue} style={{ color: 'var(--primary)' }}>
                {calc.resultantLegForce.toFixed(2)} <span style={{ fontSize: '10px' }}>kN</span>
              </span>
              <span style={{ fontSize: '9px', color: 'var(--text-secondary)', marginTop: '2px', fontWeight: 600 }}>
                ({calc.resultantAreaLoad.toFixed(2)} kN/m² @ {calc.resultantSpacingL}x{calc.resultantSpacingW}m)
              </span>
            </div>
            <div className={styles.resultBox}>
              <span className={styles.resultLabel}>Overall Status Check</span>
              <span className={styles.resultValue} style={{ color: calc.overallPass ? '#16a34a' : '#dc2626' }}>{calc.overallPass ? 'PASS' : 'FAIL'}</span>
            </div>
          </div>

          {/* Load Path & Transfer Timeline */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>Slab-by-Slab Load Path & Transfer Analysis</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', position: 'relative', paddingLeft: '24px', borderLeft: '2px solid var(--border-color-light)', marginLeft: '12px', marginTop: '12px', marginBottom: '12px' }}>
              
              {/* Node 0: Pour slab */}
              <div style={{ position: 'relative' }}>
                <div style={{ position: 'absolute', left: '-30px', top: '4px', width: '10px', height: '10px', borderRadius: '50%', background: '#3b82f6', border: '2px solid var(--bg-card)' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <strong style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>📥 Wet Concrete Pour Load</strong>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Initial load applied to formwork</div>
                  </div>
                  <div style={{ textAlign: 'right', fontWeight: 800, color: 'var(--text-main)' }}>
                    {calc.W_poured.toFixed(2)} kN/m²
                  </div>
                </div>
              </div>

              {/* Node loops: slabs and support levels */}
              {calc.floorResults.map((row, idx) => {
                const isTower = row.systemType === 'tower';
                const modelLabel = row.selectedModel;
                const nextLoad = calc.W_poured * ((calc.floorResults.length - idx - 1) / calc.floorResults.length);
                const nextLegForce = nextLoad * row.tribArea;

                return (
                  <React.Fragment key={idx}>
                    {/* Props carry load */}
                    <div style={{ position: 'relative' }}>
                      <div style={{ position: 'absolute', left: '-30px', top: '4px', width: '10px', height: '10px', borderRadius: '50%', background: '#64748b', border: '2px solid var(--bg-card)' }} />
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <span style={{ fontWeight: 600 }}>🔻 Props Level {row.level} ({isTower ? 'Tower' : 'Prop'} {modelLabel})</span>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Carrying load through this story level</div>
                        </div>
                        <div style={{ textAlign: 'right', fontWeight: 700 }}>
                          {row.propAreaLoad.toFixed(2)} kN/m² <span style={{ fontSize: '9px', fontWeight: 500, color: 'var(--text-muted)' }}>({row.propDesignForce.toFixed(2)} kN/leg)</span>
                        </div>
                      </div>
                    </div>

                    {/* Slab absorbs share */}
                    <div style={{ position: 'relative' }}>
                      <div style={{ position: 'absolute', left: '-30px', top: '4px', width: '10px', height: '10px', borderRadius: '50%', background: row.isGroundSlab ? '#475569' : '#10b981', border: '2px solid var(--bg-card)' }} />
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <strong>🏢 {row.isGroundSlab ? 'Ground Slab / Foundation' : `Cured Slab ${idx + 1}`}</strong>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            {row.isGroundSlab ? 'Rigid base transfers all remaining loads directly to soil' : `Absorbs equal deflection load share (W_poured / ${numFloors})`}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right', color: row.isGroundSlab ? 'var(--text-main)' : '#10b981', fontWeight: 700 }}>
                          -{calc.slabLoadShare.toFixed(2)} kN/m²
                        </div>
                      </div>
                    </div>

                    {/* Resultant transfer load below slab */}
                    <div style={{ position: 'relative', background: 'var(--border-color-light)', padding: '8px 12px', borderRadius: '6px', margin: '4px 0', border: '1px solid var(--border-bezel)' }}>
                      <div style={{ position: 'absolute', left: '-29px', top: '12px', width: '8px', height: '8px', borderRadius: '50%', background: '#3b82f6', border: '1.5px solid var(--bg-card)' }} />
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11.5px' }}>
                        <span style={{ color: 'var(--text-secondary)', fontWeight: 700 }}>➡️ Resultant Transfer Load below Slab {idx + 1}</span>
                        <strong style={{ color: 'var(--primary)', fontWeight: 800 }}>
                          {nextLoad.toFixed(2)} kN/m² <span style={{ fontSize: '9.5px', fontWeight: 500, color: 'var(--text-muted)' }}>({nextLegForce.toFixed(2)} kN/leg)</span>
                        </strong>
                      </div>
                    </div>
                  </React.Fragment>
                );
              })}
            </div>
          </div>

          {/* Results Summary & Checks Grid */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>Verification Summary Table</div>
            <div style={{ overflowX: 'auto' }}>
              <table className={styles.capacityTable}>
                <thead>
                  <tr>
                    <th>Level</th>
                    <th>Support Details</th>
                    <th>Spacing (m)</th>
                    <th>Leg Load (kN/m²)</th>
                    <th>Design Force (kN)</th>
                    <th>Support Cap (kN)</th>
                    <th>Support Check</th>
                    <th>Slab Load (kN/m²)</th>
                    <th>Slab Cap (kN/m²)</th>
                    <th>Slab Check</th>
                  </tr>
                </thead>
                <tbody>
                  {calc.floorResults.map((row, idx) => {
                    const cfg = floorConfigs[idx] || {};
                    const isTower = row.systemType === 'tower';
                    const propUtilization = row.supportCap ? `${(row.propUtil * 100).toFixed(0)}%` : '—';
                    const slabUtilization = row.slabPermissibleCap > 0 ? `${(row.slabUtil * 100).toFixed(0)}%` : '—';
                    
                    return (
                      <tr key={row.level} style={{ background: (!row.propPass || !row.slabPass) ? 'rgba(220, 38, 38, 0.03)' : 'transparent' }}>
                        <td style={{ fontWeight: 800 }}>P{row.level} (Floor {row.level})</td>
                        <td>{isTower ? 'Tower:' : 'Prop:'} <strong>{row.selectedModel}</strong></td>
                        <td>{row.spacingL} × {row.spacingW} m</td>
                        <td>{row.propAreaLoad.toFixed(2)}</td>
                        <td style={{ fontWeight: 700 }}>{row.propDesignForce.toFixed(2)}</td>
                        <td>{row.supportCap !== null ? row.supportCap.toFixed(2) : 'N/A'}</td>
                        <td>
                          <span className={styles.badge + ' ' + (row.propPass ? styles.badgePass : styles.badgeFail)}>
                            {row.propPass ? `PASS (${propUtilization})` : row.supportStatus === 'exceeds-max' ? 'EXCEEDS H' : `FAIL (${propUtilization})`}
                          </span>
                        </td>
                        <td>{row.slabLoadShare.toFixed(2)}</td>
                        <td>{row.isGroundSlab ? 'Infinite' : row.slabPermissibleCap.toFixed(2)} {!row.isGroundSlab && <span style={{ fontSize: '9px', color: '#64748b' }}>({row.ageFactor}%)</span>}</td>
                        <td>
                          <span className={styles.badge + ' ' + (row.slabPass ? styles.badgePass : styles.badgeFail)}>
                            {row.isGroundSlab ? 'GROUND' : (row.slabPass ? `PASS (${slabUtilization})` : `FAIL (${slabUtilization})`)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className={styles.hintText}>
              * Support capacity is looked up from datasheets at that level's configured height and model type (safety factor 1.65 applied). Slab capacities are computed using individual slab thickness, age factor, and design load ratings.
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
              {/* Header block */}
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
                  <div style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a' }}>Backpropping Design Report</div>
                  <div style={{ fontSize: '8px', color: '#64748b', fontWeight: 600, marginTop: '2px' }}>FORM: WONDERCRAB-BACKPROP / BS5975</div>
                  <div style={{ fontSize: '9px', fontWeight: 700, color: calc.overallPass ? '#16a34a' : '#dc2626', marginTop: '6px' }}>
                    {calc.overallPass ? 'VERIFIED PASS' : 'CRITICAL REJECTION'}
                  </div>
                </div>
              </div>

              {/* Metadata columns */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', background: '#f8fafc', padding: '8px 12px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                <div>
                  <span style={{ color: '#64748b', fontSize: '8px', textTransform: 'uppercase', fontWeight: 700 }}>Project ID</span>
                  <div style={{ fontWeight: 800, fontSize: '10px' }}>{projectId}</div>
                </div>
                <div>
                  <span style={{ color: '#64748b', fontSize: '8px', textTransform: 'uppercase', fontWeight: 700 }}>Calculated By</span>
                  <div style={{ fontWeight: 800, fontSize: '10px' }}>{calculatedBy}</div>
                </div>
                <div>
                  <span style={{ color: '#64748b', fontSize: '8px', textTransform: 'uppercase', fontWeight: 700 }}>Date Checked</span>
                  <div style={{ fontWeight: 800, fontSize: '10px' }}>{verificationDate}</div>
                </div>
                <div>
                  <span style={{ color: '#64748b', fontSize: '8px', textTransform: 'uppercase', fontWeight: 700 }}>System Status</span>
                  <div style={{ fontWeight: 800, fontSize: '10px', color: calc.overallPass ? '#16a34a' : '#dc2626' }}>
                    {calc.overallPass ? 'SAFE' : 'FAILURE'}
                  </div>
                </div>
              </div>

              {/* Section 1: Design Parameters */}
              <div>
                <h4 style={{ margin: '0 0 6px 0', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', color: '#2563eb', borderBottom: '1px solid #e2e8f0', paddingBottom: '3px' }}>
                  1. Wet Pour Slab Parameters
                </h4>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
                  <tbody>
                    <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '3px 0', color: '#475569' }}>Wet slab concrete thickness</td>
                      <td style={{ padding: '3px 0', textAlign: 'right', fontWeight: 700 }}>{pourThickness} mm</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '3px 0', color: '#475569' }}>Concrete unit weight</td>
                      <td style={{ padding: '3px 0', textAlign: 'right', fontWeight: 700 }}>{unitWeight} kN/m³</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '3px 0', color: '#475569' }}>{"Formwork self-weight load \\\\(q_1\\\\)"}</td>
                      <td style={{ padding: '3px 0', textAlign: 'right', fontWeight: 700 }}>{formworkLoad} kN/m²</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '3px 0', color: '#475569' }}>{"Construction live load \\\\(q_3\\\\)"}</td>
                      <td style={{ padding: '3px 0', textAlign: 'right', fontWeight: 700 }}>{constructionLoad} kN/m²</td>
                    </tr>
                    <tr>
                      <td style={{ padding: '3px 0', color: '#475569', fontWeight: 700 }}>{"Total Pour Construction Load \\\\(W_{\\\\text{poured}}\\\\)"}</td>
                      <td style={{ padding: '3px 0', textAlign: 'right', fontWeight: 800, color: '#2563eb' }}>{calc.W_poured.toFixed(2)} kN/m²</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Section 2: Checks Table */}
              <div>
                <h4 style={{ margin: '0 0 6px 0', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', color: '#2563eb', borderBottom: '1px solid #e2e8f0', paddingBottom: '3px' }}>
                  2. Level-by-Level Verification Checks
                </h4>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1.5px solid #cbd5e1', textAlign: 'left', fontWeight: 700, color: '#475569' }}>
                      <th style={{ padding: '4px' }}>Level</th>
                      <th style={{ padding: '4px' }}>Backprop Model</th>
                      <th style={{ padding: '4px' }}>Spacing (m)</th>
                      <th style={{ padding: '4px' }}>Prop Load (kN/m²)</th>
                      <th style={{ padding: '4px' }}>Design Force (kN)</th>
                      <th style={{ padding: '4px' }}>Prop Cap (kN)</th>
                      <th style={{ padding: '4px' }}>Prop Check</th>
                      <th style={{ padding: '4px' }}>Slab Load (kN/m²)</th>
                      <th style={{ padding: '4px' }}>Slab Capacity (kN/m²)</th>
                      <th style={{ padding: '4px' }}>Slab Check</th>
                    </tr>
                  </thead>
                  <tbody>
                    {calc.floorResults.map((row) => (
                      <tr key={row.level} style={{ borderBottom: '1px solid #e2e8f0' }}>
                        <td style={{ padding: '4px', fontWeight: 800 }}>P{row.level} (Floor {row.level})</td>
                        <td style={{ padding: '4px' }}>{row.systemType === 'tower' ? 'Tower:' : 'Prop:'} {row.selectedModel}</td>
                        <td style={{ padding: '4px' }}>{row.spacingL} × {row.spacingW} m</td>
                        <td style={{ padding: '4px' }}>{row.propAreaLoad.toFixed(2)}</td>
                        <td style={{ padding: '4px', fontWeight: 700 }}>{row.propDesignForce.toFixed(2)}</td>
                        <td style={{ padding: '4px' }}>{row.supportCap !== null ? row.supportCap.toFixed(2) : 'N/A'}</td>
                        <td style={{ padding: '4px', fontWeight: 800, color: row.propPass ? '#16a34a' : '#dc2626' }}>
                          {row.propPass ? `PASS (${(row.propUtil * 100).toFixed(0)}%)` : 'FAIL'}
                        </td>
                        <td style={{ padding: '4px' }}>{row.slabLoadShare.toFixed(2)}</td>
                        <td style={{ padding: '4px' }}>{row.isGroundSlab ? 'Infinite' : `${row.slabPermissibleCap.toFixed(2)} (${row.ageFactor}%)`}</td>
                        <td style={{ padding: '4px', fontWeight: 800, color: row.slabPass ? '#16a34a' : '#dc2626' }}>
                          {row.isGroundSlab ? 'GROUND' : (row.slabPass ? `PASS (${(row.slabUtil * 100).toFixed(0)}%)` : 'FAIL')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Dynamic Diagram inside printable sheet */}
              <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', alignItems: 'center', border: '1px solid #e2e8f0', padding: '10px', borderRadius: '8px' }}>
                <span style={{ fontSize: '8px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginBottom: '4px' }}>Backpropping System Elevation Sketch</span>
                <div style={{ width: '100%', height: '140px', display: 'flex', justifyContent: 'center' }}>
                  <svg viewBox={`0 0 240 ${viewBoxHeight}`} style={{ height: '100%', width: 'auto' }}>
                    {drawSlab(25, 'WET POUR SLAB', true, null, -1)}
                    {Array.from({ length: numFloors }).map((_, idx) => {
                      const y = 25 + (idx + 1) * H;
                      const res = calc.floorResults[idx];
                      return drawSlab(y, `CURED SLAB ${idx + 1}`, false, res?.slabPass, idx);
                    })}
                    {Array.from({ length: numFloors }).map((_, idx) => {
                      const yTop = 25 + idx * H;
                      const yBottom = 25 + (idx + 1) * H;
                      const res = calc.floorResults[idx];
                      return drawSupports(yTop, yBottom, res?.propPass, idx, res?.systemType);
                    })}
                    {drawGroundSlab(25 + (numFloors + 1) * H)}
                  </svg>
                </div>
              </div>

              {/* Footer notes */}
              <div style={{ marginTop: 'auto', borderTop: '1px solid #cbd5e1', paddingTop: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '7px', color: '#94a3b8' }}>TEMPWORKS CALCULATOR SUITE © 2026. ALL RIGHTS RESERVED.</span>
                <span style={{ fontSize: '7.5px', fontWeight: 700, color: '#64748b' }}>PLYTEC Structural Temporary Works Engineering Check</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
