import { useState, useEffect, useRef } from 'react';
import { FileText, Minus, Play, Plus, Save, Trash2, CheckCircle, XCircle, Box, Layers } from 'lucide-react';
import DynamicBeamDiagram from '../calculators/MultiSpanBeam/DynamicBeamDiagram';
import styles from './MultiBeamCalculator.module.css';
import { analyzeBeam } from '@engine/beam';
import { getSectionByName, SECTIONS, STEEL_GRADES, SECTION_TYPES } from '@engine/materials';
import { performAllChecks } from '@engine/design/ec3';
import plytecLogoUrl from '../assets/PLYTEC_Logo.svg';

// Company logo map — add entries here as new providers are added
const COMPANY_LOGOS = {
  PLYTEC: plytecLogoUrl,
};

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

// ─── Colour tokens ─────────────────────────────────────────────────────────────
const CLR = {
  bmd: '#2563eb',
  bmdFill: 'rgba(37,99,235,0.12)',
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
  return analysis.spans.flatMap((s) => s.points);
}

// ─── Utilization Bar ──────────────────────────────────────────────────────────
function UtilBar({ ratio }) {
  const pct = Math.min(ratio * 100, 120);
  const color = ratio > 1 ? '#ef4444' : ratio > 0.85 ? '#f59e0b' : '#22c55e';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 7, background: '#e2e8f0', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ width: `${Math.min(pct, 100)}%`, height: '100%', background: color, borderRadius: 4 }} />
      </div>
      <span style={{ fontSize: 11, fontWeight: 700, color, minWidth: 44, textAlign: 'right' }}>
        {(ratio * 100).toFixed(2)}%
      </span>
    </div>
  );
}

// ─── SVG Analysis Diagram ─────────────────────────────────────────────────────
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

  // Generate 5 evenly-spaced x-axis ticks to prevent clustering
  const xTicks = [];
  const numXTicks = 5;
  for (let i = 0; i < numXTicks; i++) {
    xTicks.push(xMin + (i / (numXTicks - 1)) * (xMax - xMin));
  }

  // Peak logic: Find local extrema (change of direction)
  const getLocalExtrema = (pts) => {
    const extremes = [];
    if (pts.length < 3) return extremes;
    
    // Compress consecutive identical values to handle flat regions
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

  // Always include global absolute peaks (max & min) to support cantilevers/boundary peaks
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
      if (Math.abs(pt.value) < 1e-5) continue; // ignore zeros
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

// ─── Checks Table Row ────────────────────────────────────────────────────────
function CheckRow({ label, ref_clause, applied, capacity, unit, ratio, pass }) {
  return (
    <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
      <td style={{ padding: '9px 14px', fontWeight: 600, color: '#0f172a', fontSize: 13 }}>{label}</td>
      <td style={{ padding: '9px 14px', fontSize: 11, color: '#94a3b8', fontFamily: 'monospace' }}>{ref_clause}</td>
      <td style={{ padding: '9px 14px', fontSize: 13, textAlign: 'right', fontWeight: 600, color: '#1e293b' }}>
        {applied != null ? `${roundN(applied, 3)} ${unit}` : '—'}
      </td>
      <td style={{ padding: '9px 14px', fontSize: 13, textAlign: 'right', color: '#475569' }}>
        {capacity != null ? `${roundN(capacity, 3)} ${unit}` : '—'}
      </td>
      <td style={{ padding: '9px 14px', minWidth: 160 }}>
        <UtilBar ratio={ratio} />
      </td>
      <td style={{ padding: '9px 14px', textAlign: 'center' }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          padding: '2px 9px', borderRadius: 999, fontSize: 11, fontWeight: 700,
          background: pass ? '#dcfce7' : '#fee2e2',
          color: pass ? '#16a34a' : '#dc2626',
        }}>
          {pass ? '✓ PASS' : '✗ FAIL'}
        </span>
      </td>
    </tr>
  );
}

export default function MultiBeamCalculator() {
  const initialInputs = getSessionData('tempworks_multibeam_inputs', {
    material: 'system',
    sectionType: 'System Beam',
    steelGrade: 'S355',
    sectionSize: '',
    systemCompany: 'PLYTEC',
    isTwinProfile: false,
    includeSelfWeight: true,
    loadFactor: 1.5,
    materialFactor: 1.1,
    deflectionLimit: 360,
    spans: [
      { length: 3000, leftSupport: 'pin', rightSupport: 'roller' },
      { length: 3000, leftSupport: 'continuous', rightSupport: 'roller' },
    ],
    loads: [
      { type: 'udl', spanIndex: 0, posStart: 0, posEnd: 3000, magnitude: 10 },
      { type: 'point', spanIndex: 1, pos: 1500, magnitude: 5 },
    ],
    projectId: 'TW-2026-MULTI',
    calculatedBy: 'Antigravity AI',
    verificationDate: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  });

  const [activeTab, setActiveTab] = useState(() => getSessionData('tempworks_multibeam_active_tab', 'configuration'));
  const tabsWrapperRef = useRef(null);

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

  const [material, setMaterial] = useState(initialInputs.material || 'system');
  const [sectionType, setSectionType] = useState(initialInputs.sectionType || 'System Beam');
  const [steelGrade, setSteelGrade] = useState(initialInputs.steelGrade);
  const [systemCompany, setSystemCompany] = useState(() => initialInputs.systemCompany || 'PLYTEC');
  const [sectionSize, setSectionSize] = useState(() => {
    if (initialInputs.sectionSize) return initialInputs.sectionSize;
    // Default: first section for PLYTEC
    const co = initialInputs.systemCompany || 'PLYTEC';
    const first = (SECTIONS['System Beam'] || []).find(s => s.company === co);
    return first ? first.name : '';
  });

  const [isTwinProfile, setIsTwinProfile] = useState(!!initialInputs.isTwinProfile);
  const [includeSelfWeight, setIncludeSelfWeight] = useState(initialInputs.includeSelfWeight !== false);
  const [loadFactor, setLoadFactor] = useState(initialInputs.loadFactor != null ? String(initialInputs.loadFactor) : '1.5');
  const [materialFactor, setMaterialFactor] = useState(initialInputs.materialFactor != null ? String(initialInputs.materialFactor) : '1.1');
  const [deflectionLimit, setDeflectionLimit] = useState(initialInputs.deflectionLimit);
  const [spans, setSpans] = useState(initialInputs.spans);
  const [loads, setLoads] = useState(initialInputs.loads);
  
  const [loadModalOpen, setLoadModalOpen] = useState(false);
  const [editingLoadIndex, setEditingLoadIndex] = useState(null);
  const [modalLoadType, setModalLoadType] = useState('udl');
  const [modalSpanIndex, setModalSpanIndex] = useState(0);
  const [modalPosStart, setModalPosStart] = useState(0);
  const [modalPosEnd, setModalPosEnd] = useState(3000);
  const [modalPos, setModalPos] = useState(1500);
  const [modalMagnitude, setModalMagnitude] = useState(10);
  const [projectId, setProjectId] = useState(initialInputs.projectId);
  const [calculatedBy, setCalculatedBy] = useState(initialInputs.calculatedBy);
  const [verificationDate, setVerificationDate] = useState(initialInputs.verificationDate);
  const [results, setResults] = useState(() => getSessionData('tempworks_multibeam_results', null));
  const [calcError, setCalcError] = useState(null);
  const [isCalculating, setIsCalculating] = useState(false);

  // Save inputs and invalidate results if any input changes after initial load
  useEffect(() => {
    const savedInputs = getSessionData('tempworks_multibeam_inputs', null);
    const currentInputs = { material, sectionType, steelGrade, sectionSize, systemCompany, isTwinProfile, includeSelfWeight, loadFactor, materialFactor, deflectionLimit, spans, loads, projectId, calculatedBy, verificationDate };

    // Separate structural vs metadata inputs for comparison
    const structuralInputs = { material, sectionType, steelGrade, sectionSize, systemCompany, isTwinProfile, includeSelfWeight, loadFactor, materialFactor, deflectionLimit, spans, loads };
    const savedStructuralInputs = savedInputs ? {
      material: savedInputs.material,
      sectionType: savedInputs.sectionType,
      steelGrade: savedInputs.steelGrade,
      sectionSize: savedInputs.sectionSize,
      systemCompany: savedInputs.systemCompany,
      isTwinProfile: savedInputs.isTwinProfile,
      includeSelfWeight: savedInputs.includeSelfWeight,
      loadFactor: savedInputs.loadFactor,
      materialFactor: savedInputs.materialFactor,
      deflectionLimit: savedInputs.deflectionLimit,
      spans: savedInputs.spans,
      loads: savedInputs.loads
    } : null;

    if (savedInputs && JSON.stringify(currentInputs) === JSON.stringify(savedInputs)) {
      return;
    }

    if (savedStructuralInputs && JSON.stringify(structuralInputs) === JSON.stringify(savedStructuralInputs)) {
      // Only metadata changed, save updated data but do NOT clear results
      saveSessionData('tempworks_multibeam_inputs', currentInputs);
      return;
    }

    setResults(null);
    sessionStorage.removeItem('tempworks_multibeam_results');
    saveSessionData('tempworks_multibeam_inputs', currentInputs);
  }, [material, sectionType, steelGrade, sectionSize, systemCompany, isTwinProfile, includeSelfWeight, loadFactor, materialFactor, deflectionLimit, spans, loads, projectId, calculatedBy, verificationDate]);

  // Save active tab to session storage
  useEffect(() => {
    saveSessionData('tempworks_multibeam_active_tab', activeTab);
  }, [activeTab]);

  const supportOptions = [
    { value: 'pin', label: 'Pin' },
    { value: 'roller', label: 'Roller' },
    { value: 'fixed', label: 'Fixed' },
    { value: 'free', label: 'Free' },
  ];

  const diagramLoads = loads.map((load) => {
    const spanLength = Number(spans[load.spanIndex]?.length || 0);
    if (load.type === 'point') return { ...load, pos: Number(load.pos || 0) };
    return {
      ...load,
      posStart: Number(load.posStart || 0),
      posEnd: load.posEnd === '' ? spanLength : Number(load.posEnd || spanLength),
    };
  });

  const updateSpan = (index, field, value) => {
    if (field === 'length') {
      const cleanVal = cleanNumericInput(value);
      const newLength = Number(cleanVal || 0);
      const oldLength = Number(spans[index]?.length || 0);

      setSpans((cur) => cur.map((span, i) => i === index ? { ...span, length: cleanVal } : span));
      setLoads((curLoads) => curLoads.map((load) => {
        if (load.spanIndex === index && load.type === 'udl') {
          const isFullSpan = load.isFullSpan || (Number(load.posStart) === 0 && Number(load.posEnd) === oldLength);
          if (isFullSpan) {
            return {
              ...load,
              posEnd: newLength,
              isFullSpan: true
            };
          }
        }
        return load;
      }));
    } else {
      setSpans((cur) => cur.map((span, i) => i === index ? { ...span, [field]: value } : span));
    }
  };

  const addSpan = () => {
    setSpans((cur) => {
      // If the current last span has rightSupport === 'free' or 'fixed', change it to 'roller'
      const updated = cur.map((span, idx) => {
        if (idx === cur.length - 1 && (span.rightSupport === 'free' || span.rightSupport === 'fixed')) {
          return { ...span, rightSupport: 'roller' };
        }
        return span;
      });
      return [...updated, { length: 3000, leftSupport: 'continuous', rightSupport: 'roller' }];
    });
  };

  const removeSpan = () => {
    if (spans.length <= 1) return;
    setSpans((cur) => cur.slice(0, -1));
    setLoads((cur) => cur.filter((load) => load.spanIndex < spans.length - 1));
  };

  const handleOpenAddLoad = () => {
    setEditingLoadIndex(null);
    setModalLoadType('udl');
    setModalSpanIndex(0);
    setModalPosStart('0');
    setModalPosEnd(String(spans[0]?.length || 3000));
    setModalPos(String(Math.round(Number(spans[0]?.length || 3000) / 2)));
    setModalMagnitude('10');
    setLoadModalOpen(true);
  };

  const handleOpenEditLoad = (index) => {
    const load = loads[index];
    if (!load) return;
    setEditingLoadIndex(index);
    setModalLoadType(load.type);
    setModalSpanIndex(load.spanIndex);
    setModalPosStart(String(load.posStart !== undefined ? load.posStart : 0));
    setModalPosEnd(String(load.posEnd !== undefined ? load.posEnd : Number(spans[load.spanIndex]?.length || 3000)));
    setModalPos(String(load.pos !== undefined ? load.pos : Math.round(Number(spans[load.spanIndex]?.length || 3000) / 2)));
    setModalMagnitude(String(load.magnitude));
    setLoadModalOpen(true);
  };

  const handleSaveLoad = () => {
    const newLoad = {
      type: modalLoadType,
      spanIndex: Number(modalSpanIndex),
      magnitude: Number(modalMagnitude),
    };
    if (modalLoadType === 'udl') {
      newLoad.posStart = Number(modalPosStart);
      newLoad.posEnd = Number(modalPosEnd);
      const currentSpanLength = Number(spans[modalSpanIndex]?.length || 0);
      newLoad.isFullSpan = (newLoad.posStart === 0 && newLoad.posEnd === currentSpanLength);
    } else {
      newLoad.pos = Number(modalPos);
    }

    if (editingLoadIndex === null) {
      setLoads(cur => [...cur, newLoad]);
    } else {
      setLoads(cur => cur.map((l, i) => i === editingLoadIndex ? newLoad : l));
    }
    setLoadModalOpen(false);
  };

  const handleModalSpanIndexChange = (val) => {
    const si = Number(val);
    setModalSpanIndex(si);
    const spanLength = Number(spans[si]?.length || 3000);
    if (modalPosStart > spanLength) setModalPosStart(0);
    if (modalPosEnd > spanLength || modalPosEnd === 0) setModalPosEnd(spanLength);
    if (modalPos > spanLength) setModalPos(Math.round(spanLength / 2));
  };

  const removeLoad = (index) => setLoads((cur) => cur.filter((_, i) => i !== index));

  const handleMaterialChange = (newMat) => {
    setMaterial(newMat);
    if (newMat === 'steel') {
      setSectionType('IPE');
      setSectionSize('IPE 200');
    } else {
      setSectionType('System Beam');
      const filtered = (SECTIONS['System Beam'] || []).filter((s) => s.company === systemCompany);
      if (filtered.length > 0) {
        setSectionSize(filtered[0].name);
      } else {
        setSectionSize('Alpha-Beam');
      }
    }
  };

  const handleCompanyChange = (company) => {
    setSystemCompany(company);
    const filtered = (SECTIONS['System Beam'] || []).filter((s) => s.company === company);
    if (filtered.length > 0) {
      setSectionSize(filtered[0].name);
    }
  };

  const getValidationError = () => {
    if (spans.length === 0) {
      return 'At least one span is required.';
    }
    for (let i = 0; i < spans.length; i++) {
      const span = spans[i];
      if (!span.length || isNaN(span.length) || Number(span.length) <= 0) {
        return `Span ${i + 1} length must be greater than 0.`;
      }
    }
    for (let i = 0; i < loads.length; i++) {
      const load = loads[i];
      const span = spans[load.spanIndex];
      if (!span) continue;
      if (load.magnitude == null || isNaN(load.magnitude) || load.magnitude === '') {
        return `Load ${i + 1} magnitude must be a valid number.`;
      }
      if (load.type === 'point') {
        const pos = Number(load.pos);
        if (isNaN(pos) || pos < 0 || pos > span.length) {
          return `Load ${i + 1} (Point) position must be between 0 and Span ${load.spanIndex + 1} length (${span.length} mm).`;
        }
      } else {
        const start = Number(load.posStart);
        const end = Number(load.posEnd);
        if (isNaN(start) || start < 0 || start > span.length) {
          return `Load ${i + 1} (UDL) start position must be between 0 and Span ${load.spanIndex + 1} length.`;
        }
        if (isNaN(end) || end < 0 || end > span.length) {
          return `Load ${i + 1} (UDL) end position must be between 0 and Span ${load.spanIndex + 1} length.`;
        }
        if (start > end) {
          return `Load ${i + 1} (UDL) start position cannot be greater than end position.`;
        }
      }
    }
    if (!loadFactor || isNaN(loadFactor) || Number(loadFactor) <= 0) {
      return 'ULS Load Factor must be greater than 0.';
    }
    if (!materialFactor || isNaN(materialFactor) || Number(materialFactor) <= 0) {
      return 'ULS Material Factor must be greater than 0.';
    }
    
    // Stability Check
    let verticalRestraints = 0;
    let fixedSupportCount = 0;
    
    if (spans[0]?.leftSupport && spans[0].leftSupport !== 'free') {
      verticalRestraints++;
      if (spans[0].leftSupport === 'fixed') fixedSupportCount++;
    }
    for (let i = 0; i < spans.length; i++) {
      const rightSup = spans[i].rightSupport;
      if (rightSup && rightSup !== 'free') {
        verticalRestraints++;
        if (rightSup === 'fixed') fixedSupportCount++;
      }
    }
    
    if (verticalRestraints === 0) {
      return 'Structurally Unstable: The beam has no vertical supports.';
    }
    if (verticalRestraints === 1 && fixedSupportCount === 0) {
      return 'Structurally Unstable: A single pinned or roller support will rotate freely. A fixed support is required for a single-support cantilever.';
    }

    return null;
  };

  const validationError = getValidationError();

  const handleCalculate = () => {
    try {
      setCalcError(null);
      const section = getSectionByName(sectionType, sectionSize);
      if (!section) throw new Error(`Section "${sectionSize}" not found. Please select a valid section.`);

      setIsCalculating(true);

      setTimeout(() => {

        const N = isTwinProfile ? 2 : 1;
        const w_sw = includeSelfWeight ? (N * section.mass * 9.80665 / 1000) : 0;
        const lf = Number(loadFactor) || 1.5;
        const mf = Number(materialFactor) || 1.1;

        // Construct SLS loads
        const loads_SLS = loads.map((l) => {
          if (l.type === 'point') return { ...l, pos: Number(l.pos) };
          const spanL = Number(spans[l.spanIndex]?.length || 0);
          return {
            ...l,
            posStart: Number(l.posStart),
            posEnd: l.posEnd === '' ? spanL : Number(l.posEnd)
          };
        });

        if (w_sw > 0) {
          spans.forEach((span, idx) => {
            loads_SLS.push({
              type: 'udl',
              spanIndex: idx,
              posStart: 0,
              posEnd: span.length,
              magnitude: w_sw
            });
          });
        }

        // Construct ULS loads (factored by lf)
        const loads_ULS = loads_SLS.map((l) => ({
          ...l,
          magnitude: l.magnitude * lf
        }));

        // Solver runs
        const E_val = section.E || 210000;
        const I_val = section.Iy * N;

        const { analysis: analysisSLS } = analyzeBeam({ spans, loads: loads_SLS, E: E_val, I: I_val });
        const { analysis: analysisULS } = analyzeBeam({ spans, loads: loads_ULS, E: E_val, I: I_val });

        // Merge ULS and SLS results
        const mergedResults = {
          ...analysisULS,
          maxDeflection: analysisSLS.maxDeflection,
          spans: analysisULS.spans.map((spanULS, sIdx) => {
            const spanSLS = analysisSLS.spans[sIdx];
            return {
              ...spanULS,
              points: spanULS.points.map((ptULS, ptIdx) => ({
                ...ptULS,
                deflection: spanSLS.points[ptIdx].deflection
              }))
            };
          })
        };
        mergedResults.physicalSpans = spans;

        const maxM = Math.abs(mergedResults.maxMoment.value);
        const maxV = Math.abs(mergedResults.maxShear.value);
        const maxDefl = Math.abs(mergedResults.maxDeflection.value);

        // Perform checks
        const isSystemBeam = (material === 'system');
        const systemCapacities = isSystemBeam ? { Mallow: section.Mallow * N, Vallow: section.Vallow * N } : null;

        const checks = performAllChecks(
          mergedResults,
          section,
          steelGrade,
          Number(deflectionLimit),
          isSystemBeam,
          systemCapacities,
          mf
        );

        const calculated = {
          analysis: mergedResults,
          checks,
          maxM,
          maxV,
          maxDefl,
          section,
          isTwinProfile,
          includeSelfWeight,
          loadFactor: lf,
          materialFactor: mf,
          material,
          w_sw
        };

        setResults(calculated);
        saveSessionData('tempworks_multibeam_results', calculated);
        setActiveTab('results');
        setIsCalculating(false);
      }, 500);
    } catch (err) {
      console.error('Calculation error:', err);
      setCalcError(err.message);
      setIsCalculating(false);
    }
  };

  // Derive available section types and sections from current material
  const availableSectionTypes = material === 'steel'
    ? SECTION_TYPES.filter((t) => t !== 'System Beam')
    : ['System Beam'];

  const availableSections = (SECTIONS[sectionType] || []).filter((s) => {
    if (material === 'system') {
      return s.company === systemCompany;
    }
    return true;
  });

  return (
    <div className={styles.pageContainer}>
      <header className={styles.pageHeader}>
        <div className={styles.titleBlock}>
          <h1>Multi Beam Span Calculator</h1>
          <p>Design and verify multi-span beam systems to BS EN 1993-1-1 (EC3) and proprietary allowable properties</p>
        </div>
        <div className={styles.headerActions}>
          <button className={styles.btnSecondary}>
            <Save size={16} /> Save
          </button>
          <button 
            className={styles.btnCalculate} 
            onClick={handleCalculate}
            disabled={!!validationError}
            style={{ opacity: validationError ? 0.6 : 1, cursor: validationError ? 'not-allowed' : 'pointer' }}
          >
            <Play size={16} fill="currentColor" /> Calculate
          </button>
        </div>
      </header>

      {validationError && (
        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '12px 16px', color: '#b45309', fontSize: 13, fontWeight: 500 }}>
          ⚠️ Input Validation: {validationError}
        </div>
      )}

      {calcError && (
        <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 8, padding: '12px 16px', color: '#b91c1c', fontSize: 13, fontWeight: 500 }}>
          ⚠ {calcError}
        </div>
      )}

      <div ref={tabsWrapperRef} className={styles.tabsWrapper}>
        <div className={styles.tabs}>
          <div className={`${styles.tab} ${activeTab === 'configuration' ? styles.active : ''}`} onClick={() => setActiveTab('configuration')}>Configuration</div>
          <div className={`${styles.tab} ${activeTab === 'results' ? styles.active : ''}`} onClick={() => setActiveTab('results')}>Analysis Results</div>
          <div className={`${styles.tab} ${activeTab === 'report' ? styles.active : ''}`} onClick={() => setActiveTab('report')}>Report</div>
        </div>
      </div>

      <div className={styles.contentArea}>
        {isCalculating ? (
          <div className={styles.loaderOverlay}>
            <div className={styles.spinner}></div>
            <div className={styles.loadingText}>Calculating...</div>
            <div style={{ fontSize: '11px', color: '#64748b', fontStyle: 'italic', fontWeight: 500 }}>
              Iterating 2D finite element stiffness relations...
            </div>
          </div>
        ) : (
          <>
            {/* ─── CONFIGURATION TAB ─── */}
            {activeTab === 'configuration' && (
              <div className={styles.gridLayout}>
                {/* Cards flow in logical order (properties, layout, factors, loads)
                    so the mobile single-column stack keeps the input hierarchy;
                    desktop places factors + loads side by side below layout via grid areas. */}
                <div className={`${styles.card} ${styles.areaProperties}`}>
                    <h3 className={styles.cardTitle}>Beam Properties</h3>
                    <div className={styles.formStack}>
                      <div className={styles.materialSelectorContainer}>
                        <span className={styles.materialSelectorLabel}>Material Selection</span>
                        <div className={styles.materialGrid}>
                          <button
                            type="button"
                            className={`${styles.materialSquareBtn} ${material === 'steel' ? styles.activeSquareBtn : ''}`}
                            onClick={() => handleMaterialChange('steel')}
                          >
                            <Box size={24} className={styles.materialBtnIcon} />
                            <div className={styles.materialBtnTitle}>Profile Beam</div>
                            <div className={styles.materialBtnSubtitle}>Standard steel profiles (IPE, UB, etc.)</div>
                          </button>
                          <button
                            type="button"
                            className={`${styles.materialSquareBtn} ${material === 'system' ? styles.activeSquareBtn : ''}`}
                            onClick={() => handleMaterialChange('system')}
                          >
                            <Layers size={24} className={styles.materialBtnIcon} />
                            <div className={styles.materialBtnTitle}>System Beam</div>
                            <div className={styles.materialBtnSubtitle}>Proprietary formwork (Alpha, Alu)</div>
                          </button>
                        </div>
                      </div>
                      {material === 'system' && (
                        <label className={styles.field}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            System Provider
                            {COMPANY_LOGOS[systemCompany] && (
                              <img
                                src={COMPANY_LOGOS[systemCompany]}
                                alt={systemCompany}
                                style={{ height: '14px', width: 'auto', objectFit: 'contain', verticalAlign: 'middle', filter: 'brightness(0) saturate(100%)' }}
                              />
                            )}
                          </span>
                          <select value={systemCompany} onChange={(e) => handleCompanyChange(e.target.value)}>
                            <option value="PLYTEC">PLYTEC</option>
                            <option value="Doka">Doka</option>
                          </select>
                        </label>
                      )}

                      {material === 'steel' && (
                        <label className={styles.field}>
                          <span>Section Type</span>
                          <select value={sectionType} onChange={(e) => { setSectionType(e.target.value); setSectionSize((SECTIONS[e.target.value] || [])[0]?.name || ''); }}>
                            {availableSectionTypes.map((t) => <option key={t} value={t}>{t}</option>)}
                          </select>
                        </label>
                      )}
                      <label className={styles.field}>
                        <span>Section Size / Profile</span>
                        <select value={sectionSize} onChange={(e) => setSectionSize(e.target.value)}>
                          {availableSections.map((s) => <option key={s.name} value={s.name}>{s.name}</option>)}
                        </select>
                      </label>
                      {material === 'steel' ? (
                        <label className={styles.field}>
                          <span>Steel Grade</span>
                          <select value={steelGrade} onChange={(e) => setSteelGrade(e.target.value)}>
                            {Object.keys(STEEL_GRADES).map((g) => <option key={g} value={g}>{g}</option>)}
                          </select>
                        </label>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Material Info</span>
                          <div style={{ 
                            fontSize: '13px', 
                            fontWeight: 600, 
                            color: '#334155', 
                            background: '#f8fafc', 
                            padding: '8px 12px', 
                            borderRadius: '6px', 
                            border: '1px solid #e2e8f0' 
                          }}>
                            Material: {getSectionByName(sectionType, sectionSize)?.material || 'Proprietary'}
                          </div>
                        </div>
                      )}
                      
                      <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer', margin: '8px 0 2px' }}>
                        <input type="checkbox" checked={isTwinProfile} onChange={(e) => setIsTwinProfile(e.target.checked)} />
                        <span style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>Twin Profile Configuration (2x Beams)</span>
                      </label>
    
                      {(() => {
                        const sec = getSectionByName(sectionType, sectionSize);
                        if (!sec) return null;
                        const N = isTwinProfile ? 2 : 1;
                        const E_val = sec.E || 210000;
                        // EI in kNm²: E (MPa) * Iy (cm⁴) * 1e-5 — same conversion used
                        // in the solver wiring and the report's stiffness line.
                        const EI_val = E_val * sec.Iy * N * 1e-5;
                        return (
                          <div className={styles.propertyGrid}>
                            {sec.type !== 'system' ? (
                              <>
                                <span>h <strong>{sec.h} mm</strong></span>
                                <span>b <strong>{sec.b} mm</strong></span>
                                <span>tw <strong>{sec.tw} mm</strong></span>
                                <span>tf <strong>{sec.tf} mm</strong></span>
                                <span>Iy <strong>{(sec.Iy * N).toFixed(2)} cm⁴</strong></span>
                                <span>EI <strong>{EI_val.toFixed(2)} kNm²</strong></span>
                                <span>Wpl,y <strong>{(sec.Wpl_y * N).toFixed(2)} cm³</strong></span>
                              </>
                            ) : (
                              <>
                                <span>h <strong>{sec.h} mm</strong></span>
                                <span>b <strong>{sec.b} mm</strong></span>
                                <span>EI <strong>{EI_val.toFixed(2)} kNm²</strong></span>
                                <span>Allow. Moment <strong>{(sec.Mallow * N).toFixed(2)} kNm</strong></span>
                                <span>Allow. Shear <strong>{(sec.Vallow * N).toFixed(2)} kN</strong></span>
                                <span>Weight <strong>{(sec.mass * N).toFixed(2)} kg/m</strong></span>
                              </>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                </div>

                <div className={`${styles.card} ${styles.areaLayout}`}>
                    <div className={styles.cardHeadingRow}>
                      <h3 className={styles.cardTitle}>Beam Layout</h3>
                      <div className={styles.inlineActions}>
                        <button className={styles.smallAction} onClick={addSpan}><Plus size={16} /> <span className={styles.btnWord}>Add</span> Span</button>
                        <button className={styles.smallAction} onClick={removeSpan}><Minus size={16} /> <span className={styles.btnWord}>Remove</span> Span</button>
                      </div>
                    </div>
                    <DynamicBeamDiagram spans={spans} loads={diagramLoads} />
                    <div className={styles.spanTable}>
                      <div className={styles.tableHeader}>Span</div>
                      <div className={styles.tableHeader}>Length (mm)</div>
                      <div className={styles.tableHeader}>Left Support</div>
                      <div className={styles.tableHeader}>Right Support</div>
                      {spans.map((span, i) => (
                        <div className={styles.tableRow} key={`span-${i}`}>
                          <strong>Span {i + 1}</strong>
                          <input type="number" value={span.length} onChange={(e) => updateSpan(i, 'length', e.target.value)} />
                          {i === 0 ? (
                            <select value={span.leftSupport} onChange={(e) => updateSpan(i, 'leftSupport', e.target.value)}>
                              {supportOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                          ) : (
                            <div style={{ 
                              display: 'flex', 
                              alignItems: 'center', 
                              minHeight: '36px', 
                              padding: '0.45rem 0.65rem', 
                              color: '#64748b', 
                              background: '#f1f5f9',
                              borderRadius: '5px',
                              border: '1px solid #cbd5e1',
                              fontSize: '13px',
                              fontWeight: 500
                            }}>
                              Continuous
                            </div>
                          )}
                          <select value={span.rightSupport} onChange={(e) => updateSpan(i, 'rightSupport', e.target.value)}>
                            {supportOptions
                              .filter((o) => i === spans.length - 1 ? true : (o.value !== 'free' && o.value !== 'fixed'))
                              .map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                          </select>
                        </div>
                      ))}
                    </div>
                </div>

                <div className={`${styles.card} ${styles.areaFactors}`}>
                    <h3 className={styles.cardTitle}>Design Factors & Safety Limits</h3>
                    <div className={styles.formStack}>
                      <label className={styles.field}>
                        <span>ULS Load Factor (γ<sub>F</sub>)</span>
                        <input
                          type="number"
                          step="0.05"
                          value={loadFactor}
                          onChange={(e) => setLoadFactor(cleanNumericInput(e.target.value))}
                        />
                      </label>
                      <label className={styles.field}>
                        <span>ULS Material Factor (γ<sub>M</sub>)</span>
                        <input
                          type="number"
                          step="0.05"
                          value={materialFactor}
                          onChange={(e) => setMaterialFactor(cleanNumericInput(e.target.value))}
                        />
                      </label>
                      <label className={styles.field}>
                        <span>Deflection Limit</span>
                        <select value={deflectionLimit} onChange={(e) => setDeflectionLimit(Number(e.target.value))}>
                          <option value={200}>L / 200</option>
                          <option value={270}>L / 270</option>
                          <option value={360}>L / 360</option>
                          <option value={400}>L / 400</option>
                          <option value={500}>L / 500</option>
                        </select>
                      </label>
                    </div>
                </div>

                <div className={`${styles.card} ${styles.areaLoads}`}>
                    <div className={styles.cardHeadingRow}>
                      <h3 className={styles.cardTitle}>Loads</h3>
                      <button className={styles.smallAction} onClick={handleOpenAddLoad}><Plus size={16} /> Add Load</button>
                    </div>
                    <div style={{ padding: '4px 0 12px', borderBottom: '1px solid #f1f5f9', marginBottom: '10px' }}>
                      <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                        <input type="checkbox" checked={includeSelfWeight} onChange={(e) => setIncludeSelfWeight(e.target.checked)} />
                        <span style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>Include beam self-weight in analysis</span>
                      </label>
                    </div>
                    <div className={styles.loadList}>
                      {loads.length === 0 ? (
                        <button 
                          className={styles.emptyLoadBtn}
                          onClick={handleOpenAddLoad}
                          type="button"
                        >
                          <Plus size={20} style={{ marginBottom: '6px' }} />
                          <span>No loads added yet. Click to <strong>Add Load</strong>.</span>
                        </button>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {loads.map((load, i) => (
                            <div 
                              key={`load-${i}`} 
                              role="button"
                              tabIndex={0}
                              className={styles.loadItemBtn}
                              onClick={() => handleOpenEditLoad(i)}
                              title="Click to edit load parameters"
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, flexWrap: 'wrap' }}>
                                <span style={{ 
                                  fontSize: '10px', 
                                  fontWeight: 800, 
                                  textTransform: 'uppercase', 
                                  padding: '2px 6px', 
                                  borderRadius: '4px', 
                                  background: load.type === 'udl' ? '#fee2e2' : '#dbeafe', 
                                  color: load.type === 'udl' ? '#991b1b' : '#1e40af',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px'
                                }}>
                                  {load.type === 'udl' ? (
                                    <svg width="14" height="8" viewBox="0 0 24 12" style={{ pointerEvents: 'none' }}>
                                      <line x1="2" y1="10" x2="22" y2="10" stroke="#991b1b" strokeWidth="3" strokeLinecap="round" />
                                      <line x1="4" y1="4" x2="20" y2="4" stroke="#ef4444" strokeWidth="1.5" strokeDasharray="2 2" />
                                      {[4, 8, 12, 16, 20].map((x) => (
                                        <path key={x} d={`M${x} 4 L${x} 10`} stroke="#ef4444" strokeWidth="1.5" />
                                      ))}
                                    </svg>
                                  ) : (
                                    <svg width="14" height="8" viewBox="0 0 24 12" style={{ pointerEvents: 'none' }}>
                                      <line x1="2" y1="10" x2="22" y2="10" stroke="#1e40af" strokeWidth="3" strokeLinecap="round" />
                                      <path d="M12 2 L12 10 M12 10 L9 7 M12 10 L15 7" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" />
                                    </svg>
                                  )}
                                  {load.type.toUpperCase()}
                                </span>
                                <span style={{ fontSize: '13px', color: '#334155', fontWeight: 600 }}>
                                  Span {load.spanIndex + 1}
                                </span>
                                <span style={{ fontSize: '13px', color: '#64748b' }}>
                                  {load.type === 'udl' 
                                    ? `from ${load.posStart} to ${load.posEnd} mm` 
                                    : `at ${load.pos} mm`}
                                </span>
                                <span style={{ fontSize: '13px', color: '#0f172a', fontWeight: 700, marginLeft: 'auto' }}>
                                  {load.magnitude} {load.type === 'udl' ? 'kN/m' : 'kN'}
                                </span>
                              </div>
                              <div style={{ display: 'flex', gap: '6px' }}>
                                <button 
                                  type="button" 
                                  className={styles.loadItemDelete} 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    removeLoad(i);
                                  }}
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                </div>
              </div>
            )}

            {/* ─── RESULTS TAB ─── */}
            {activeTab === 'results' && (
              results ? <ResultsPanel results={results} spans={spans} loads={loads} /> : (
                <div className={styles.card} style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
                  <div style={{ fontSize: 48, marginBottom: 12 }}>📐</div>
                  <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>No Results Yet</div>
                  <div style={{ fontSize: 13 }}>Click <strong>Calculate</strong> in the header to run the analysis.</div>
                </div>
              )
            )}
    
            {/* ─── REPORT TAB ─── */}
            {activeTab === 'report' && (
              results ? (
                <PDFReportPreview 
                  results={results} 
                  spans={spans} 
                  loads={loads} 
                  systemCompany={systemCompany} 
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
                  <div style={{ fontSize: 13 }}>Click <strong>Calculate</strong> in the header to run the analysis.</div>
                </div>
              )
            )}
          </>
        )}
      </div>

      {loadModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.6)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '1rem'
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '460px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            animation: 'modalEnter 0.2s ease-out'
          }}>
            {/* Modal Header */}
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>
                {editingLoadIndex !== null ? 'Change Load Configuration' : 'Add New Load'}
              </h3>
              <button 
                onClick={() => setLoadModalOpen(false)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '18px', padding: '4px' }}
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto', maxHeight: '70vh' }}>
              {/* Type Selection Diagrams */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '8px' }}>Select Load Type</label>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button
                    type="button"
                    onClick={() => setModalLoadType('udl')}
                    style={{
                      flex: 1,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      padding: '12px 8px',
                      borderRadius: '10px',
                      border: modalLoadType === 'udl' ? '2px solid #3b82f6' : '1px solid #e2e8f0',
                      background: modalLoadType === 'udl' ? '#eff6ff' : '#ffffff',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {/* UDL Diagram */}
                    <svg width="100" height="40" viewBox="0 0 120 60" style={{ pointerEvents: 'none' }}>
                      <line x1="10" y1="45" x2="110" y2="45" stroke={modalLoadType === 'udl' ? '#3b82f6' : '#64748b'} strokeWidth="3" strokeLinecap="round" />
                      <line x1="20" y1="20" x2="100" y2="20" stroke="#ef4444" strokeWidth="2" strokeDasharray="3 3" />
                      {[20, 40, 60, 80, 100].map((x) => (
                        <path key={x} d={`M${x} 20 L${x} 40 M${x} 40 L${x-3} 37 M${x} 40 L${x+3} 37`} stroke="#ef4444" strokeWidth="1.5" />
                      ))}
                    </svg>
                    <span style={{ fontSize: '12px', fontWeight: 700, marginTop: '6px', color: modalLoadType === 'udl' ? '#1e40af' : '#475569' }}>UDL</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setModalLoadType('point')}
                    style={{
                      flex: 1,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      padding: '12px 8px',
                      borderRadius: '10px',
                      border: modalLoadType === 'point' ? '2px solid #3b82f6' : '1px solid #e2e8f0',
                      background: modalLoadType === 'point' ? '#eff6ff' : '#ffffff',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {/* PL Diagram */}
                    <svg width="100" height="40" viewBox="0 0 120 60" style={{ pointerEvents: 'none' }}>
                      <line x1="10" y1="45" x2="110" y2="45" stroke={modalLoadType === 'point' ? '#3b82f6' : '#64748b'} strokeWidth="3" strokeLinecap="round" />
                      <path d="M60 10 L60 40 M60 40 L55 35 M60 40 L65 35" stroke="#ef4444" strokeWidth="3" strokeLinecap="round" />
                    </svg>
                    <span style={{ fontSize: '12px', fontWeight: 700, marginTop: '6px', color: modalLoadType === 'point' ? '#1e40af' : '#475569' }}>Point Load</span>
                  </button>
                </div>
              </div>

              {/* Span Selector */}
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '6px' }}>Select Span</label>
                <select 
                  value={modalSpanIndex} 
                  onChange={(e) => handleModalSpanIndexChange(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', fontWeight: 600 }}
                >
                  {spans.map((_, si) => <option key={si} value={si}>Span {si + 1} ({spans[si]?.length} mm)</option>)}
                </select>
              </div>

              {/* Position parameters */}
              {modalLoadType === 'udl' ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '6px' }}>Start (mm)</label>
                    <input
                      type="number"
                      value={modalPosStart}
                      onChange={(e) => setModalPosStart(cleanNumericInput(e.target.value))}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '6px' }}>End (mm)</label>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <input
                        type="number"
                        value={modalPosEnd}
                        onChange={(e) => setModalPosEnd(cleanNumericInput(e.target.value))}
                        style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', flex: 1 }}
                      />
                      <button
                        type="button"
                        onClick={() => setModalPosEnd(Number(spans[modalSpanIndex]?.length || 3000))}
                        style={{ padding: '0 8px', fontSize: '11px', fontWeight: 700, color: '#2563eb', background: '#f0f6ff', border: '1px solid #bfdbfe', borderRadius: '8px', cursor: 'pointer' }}
                      >
                        Full
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '6px' }}>Position (mm)</label>
                  <input
                    type="number"
                    value={modalPos}
                    onChange={(e) => setModalPos(cleanNumericInput(e.target.value))}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px' }}
                  />
                </div>
              )}

              {/* Load Magnitude */}
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '6px' }}>
                  Magnitude ({modalLoadType === 'udl' ? 'kN/m' : 'kN'})
                </label>
                <input
                  type="number"
                  value={modalMagnitude}
                  onChange={(e) => setModalMagnitude(cleanNumericInput(e.target.value))}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', fontWeight: 700 }}
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{ padding: '16px 20px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end', gap: '10px', background: '#f8fafc' }}>
              <button
                type="button"
                onClick={() => setLoadModalOpen(false)}
                style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#475569', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveLoad}
                style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: '#2563eb', color: '#ffffff', fontWeight: 800, fontSize: '13px', cursor: 'pointer', boxShadow: '0 4px 12px rgba(37, 99, 235, 0.2)' }}
              >
                {editingLoadIndex !== null ? 'Change Load' : 'Add Load'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Results Panel ────────────────────────────────────────────────────────────
function ResultsPanel({ results, spans, loads }) {
  const { 
    analysis, 
    checks, 
    maxM, 
    maxV, 
    maxDefl, 
    section,
    isTwinProfile,
    includeSelfWeight,
    loadFactor,
    materialFactor,
    material,
    w_sw 
  } = results;

  const bmdPts = flattenPoints(analysis).map((p) => ({ x: p.x, value: p.moment }));
  const sfdPts = flattenPoints(analysis).map((p) => ({ x: p.x, value: p.shear }));
  const deflPts = flattenPoints(analysis).map((p) => ({ x: p.x, value: p.deflection }));
  const reactions = analysis.reactions ?? [];

  const overallPass = checks.overallPass;
  const cls = checks.classification;
  const deflectionLimit = results.checks.deflection?.limitRatio || 360;

  return (
    <div className={styles.resultsFadeIn} style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>
      
      {/* Overall banner */}
      <div className={overallPass ? styles.bannerPass : styles.bannerFail} style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: overallPass ? 'linear-gradient(135deg,#f0fdf4,#dcfce7)' : 'linear-gradient(135deg,#fff1f2,#fee2e2)',
        border: `1.5px solid ${overallPass ? '#86efac' : '#fca5a5'}`,
        borderRadius: 12, padding: '14px 20px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 32 }}>{overallPass ? '✅' : '❌'}</span>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: overallPass ? '#15803d' : '#b91c1c' }}>
              {overallPass ? 'DESIGN PASSES' : 'DESIGN FAILS'}
            </div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
              Section: <strong>{isTwinProfile ? 'Twin ' : ''}{section?.name}</strong>
              {cls && <> · Class <strong>{cls.sectionClass}</strong> section · ε = {roundN(cls.details.epsilon, 4)}</>}
            </div>
          </div>
        </div>
      </div>
 
      {/* Summary cards */}
      <div className={styles.summaryGrid}>
        {[
          { 
            label: 'Max Bending Moment', 
            value: maxM, 
            cap: material === 'steel' ? checks.bending?.Mc_Rd : (section?.Mallow * (isTwinProfile ? 2 : 1)), 
            unit: 'kNm', 
            ratio: material === 'steel' ? checks.bending?.ratio : checks.systemBeam?.bendingCheck?.ratio, 
            pass: material === 'steel' ? checks.bending?.pass : checks.systemBeam?.bendingCheck?.pass, 
            color: CLR.bmd 
          },
          { 
            label: 'Max Shear Force', 
            value: maxV, 
            cap: material === 'steel' ? checks.shear?.Vc_Rd : (section?.Vallow * (isTwinProfile ? 2 : 1)), 
            unit: 'kN', 
            ratio: material === 'steel' ? checks.shear?.ratio : checks.systemBeam?.shearCheck?.ratio, 
            pass: material === 'steel' ? checks.shear?.pass : checks.systemBeam?.shearCheck?.pass, 
            color: CLR.sfd 
          },
          { 
            label: 'Max Deflection (SLS)', 
            value: maxDefl, 
            cap: checks.deflection?.allowable, 
            unit: 'mm', 
            ratio: checks.deflection?.ratio, 
            pass: checks.deflection?.pass, 
            color: CLR.defl 
          },
        ].map((item) => (
          <div key={item.label} className={styles.card} style={{ padding: '16px 18px', borderTop: `4px solid ${item.color}`, marginBottom: 0 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>{item.label}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', marginBottom: 3 }}>
              {roundN(item.value, 2)} <span style={{ fontSize: 12, fontWeight: 500, color: '#94a3b8' }}>{item.unit}</span>
            </div>
            <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 8 }}>
              Capacity: <strong style={{ color: '#475569' }}>{item.cap != null ? roundN(item.cap, 2) : '—'} {item.unit}</strong>
            </div>
            <UtilBar ratio={item.ratio ?? 0} />
            <div style={{ marginTop: 8 }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '2px 9px', borderRadius: 999, fontSize: 11, fontWeight: 700,
                background: item.pass ? '#dcfce7' : '#fee2e2',
                color: item.pass ? '#16a34a' : '#dc2626',
              }}>
                {item.pass ? '✓ PASS' : '✗ FAIL'}
              </span>
            </div>
          </div>
        ))}
      </div>
 
      {/* Diagrams card */}
      <div className={styles.card} style={{ padding: 0, overflow: 'hidden', marginBottom: 0 }}>
        <div style={{ padding: '12px 18px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>Analysis Diagrams</span>
          <span style={{ fontSize: 11, color: '#94a3b8', marginLeft: 'auto' }}>{analysis.spans?.length} span(s) · {reactions.length} reactions</span>
        </div>
 
        {/* Beam Layout Diagram (Above analysis plots, same size/alignment) */}
        <div style={{ padding: '16px 14px 8px', borderBottom: '1px solid #f1f5f9' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{ width: 12, height: 3, background: '#64748b', borderRadius: 2, display: 'inline-block' }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: '#64748b' }}>Beam Layout</span>
          </div>
          <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', width: '100%' }}>
            <div style={{ minWidth: '600px', paddingBottom: '8px' }}>
              <DynamicBeamDiagram spans={spans} loads={loads} reactions={reactions} />
            </div>
          </div>
        </div>
 
        {[
          { label: 'Bending Moment Diagram (BMD)', unit: 'kNm', pts: bmdPts, lc: CLR.bmd, fc: CLR.bmdFill, inv: true, rxns: [] },
          { label: 'Shear Force Diagram (SFD)', unit: 'kN', pts: sfdPts, lc: CLR.sfd, fc: CLR.sfdFill, inv: false, rxns: reactions },
          { label: 'Deflected Shape', unit: 'mm', pts: deflPts, lc: CLR.defl, fc: CLR.deflFill, inv: true, rxns: [] },
        ].map((d, i) => (
          <div key={i} style={{ padding: '16px 14px 8px', borderBottom: i < 2 ? '1px solid #f1f5f9' : 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ width: 12, height: 3, background: d.lc, borderRadius: 2, display: 'inline-block' }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: d.lc }}>{d.label}</span>
            </div>
            <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', width: '100%' }}>
              <div style={{ minWidth: '600px', paddingBottom: '8px' }}>
                <AnalysisDiagram unit={d.unit} points={d.pts} lineColor={d.lc} fillColor={d.fc} invertFill={d.inv} reactions={d.rxns} height={i === 0 ? 220 : 180} />
              </div>
            </div>
          </div>
        ))}
      </div>
 
      {/* Design Checks Table */}
      <div className={styles.card} style={{ padding: 0, overflow: 'hidden', marginBottom: 0 }}>
        <div style={{ padding: '12px 18px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>
            {material === 'steel' ? 'BS EN 1993-1-1 Design Checks' : 'Manufacturer Allowable Capacity Checks'}
          </span>
        </div>
 
        {cls && (
          <div style={{ padding: '10px 18px', borderBottom: '1px solid #e2e8f0', background: '#fafafa', display: 'flex', gap: 20, flexWrap: 'wrap', fontSize: 12, color: '#475569' }}>
            <span>Section Class: <strong style={{ color: '#0f172a', fontSize: 13 }}>{cls.sectionClass}</strong></span>
            {cls.details.flangeRatio != null && <span>Flange c/t = {roundN(cls.details.flangeRatio, 2)} (Class {cls.details.flangeClass})</span>}
            {cls.details.webRatio != null && <span>Web c/t = {roundN(cls.details.webRatio, 2)} (Class {cls.details.webClass})</span>}
          </div>
        )}
 
        <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', width: '100%' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '650px' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                {['Check', 'Reference', 'Applied', 'Capacity', 'Utilization', 'Status'].map((h) => (
                  <th key={h} style={{ padding: '8px 14px', textAlign: (h === 'Applied' || h === 'Capacity') ? 'right' : 'left', fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
          <tbody>
            {material === 'system' && checks.systemBeam ? (
              <>
                <CheckRow 
                  label="Bending Resistance (Allowable)" 
                  ref_clause="Manufacturer Allowable" 
                  applied={maxM} 
                  capacity={section.Mallow * (isTwinProfile ? 2 : 1)} 
                  unit="kNm" 
                  ratio={checks.systemBeam.bendingCheck.ratio} 
                  pass={checks.systemBeam.bendingCheck.pass} 
                />
                <CheckRow 
                  label="Shear Resistance (Allowable)" 
                  ref_clause="Manufacturer Allowable" 
                  applied={maxV} 
                  capacity={section.Vallow * (isTwinProfile ? 2 : 1)} 
                  unit="kN" 
                  ratio={checks.systemBeam.shearCheck.ratio} 
                  pass={checks.systemBeam.shearCheck.pass} 
                />
                <CheckRow 
                  label="Deflection" 
                  ref_clause={`L/${deflectionLimit} (SLS)`} 
                  applied={checks.deflection.actual} 
                  capacity={checks.deflection.allowable} 
                  unit="mm" 
                  ratio={checks.deflection.ratio} 
                  pass={checks.deflection.pass} 
                />
              </>
            ) : (
              <>
                {checks.bending && (
                  <CheckRow label="Bending Resistance" ref_clause="§6.2.5" applied={maxM} capacity={checks.bending.Mc_Rd} unit="kNm" ratio={checks.bending.ratio} pass={checks.bending.pass} />
                )}
                {checks.shear && (
                  <CheckRow label="Shear Resistance" ref_clause="§6.2.6" applied={maxV} capacity={checks.shear.Vc_Rd} unit="kN" ratio={checks.shear.ratio} pass={checks.shear.pass} />
                )}
                {checks.interaction && (
                  <CheckRow label="Bending–Shear Interaction" ref_clause="§6.2.8" applied={null} capacity={null} unit="" ratio={checks.interaction.ratio} pass={checks.interaction.pass} />
                )}
                {checks.deflection && (
                  <CheckRow label="Deflection" ref_clause={`L/${checks.deflection.limitRatio ?? '—'} (SLS)`} applied={checks.deflection.actual ?? maxDefl} capacity={checks.deflection.allowable} unit="mm" ratio={checks.deflection.ratio} pass={checks.deflection.pass} />
                )}
              </>
            )}
          </tbody>
        </table>
      </div>
 
        {/* Reactions */}
        {reactions.length > 0 && (
          <div style={{ padding: '12px 18px', borderTop: '1px solid #e2e8f0', background: '#fafafa' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Support Reactions (ULS)</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {reactions.map((r, i) => (
                <div key={i} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 7, padding: '5px 12px', fontSize: 12, fontWeight: 600, color: CLR.reaction }}>
                  R{i + 1} = {roundN(Math.abs(r.value), 2)} kN
                  <span style={{ fontSize: 10, color: '#94a3b8', marginLeft: 5 }}>@ {roundN(r.x / 1000, 2)} m</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Calculation Verification Card */}
      <div className={styles.card} style={{ padding: '16px 18px', marginBottom: 0 }}>
        <h3 className={styles.cardTitle}>Calculation Verification Details</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '13px', color: '#334155', lineHeight: '1.6' }}>
          
          <div style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '10px' }}>
            <h4 style={{ margin: '0 0 6px 0', fontSize: '14px', color: '#0f172a' }}>1. Section Stiffness & Capacity Parameters</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '8px', fontSize: '12px' }}>
              <div>Profile Multiplier: <strong>N = {isTwinProfile ? '2 (Twin Profile)' : '1 (Single Profile)'}</strong></div>
              <div>Stiffness: <strong>EI = E &middot; I = {section.E || 210000} &middot; {section.Iy} {isTwinProfile ? '&middot; 2 ' : ''} = {((section.E || 210000) * section.Iy * 1e4 * (isTwinProfile ? 2 : 1) / 1e9).toFixed(2)} &times; 10⁹ N&middot;mm² ({((section.E || 210000) * section.Iy * (isTwinProfile ? 2 : 1) / 100000).toFixed(2)} kNm²)</strong></div>
              {includeSelfWeight && (
                <div>Self-weight UDL: <strong>w<sub>sw</sub> = N &middot; mass &middot; g = {isTwinProfile ? '2 &middot; ' : ''}{section.mass} kg/m &middot; 9.81 m/s² = {w_sw.toFixed(2)} kN/m</strong></div>
              )}
              {material === 'steel' ? (
                <>
                  <div>Yield Strength: <strong>f<sub>y</sub> = {section.fy || 355} MPa</strong></div>
                  <div>Material Safety Factor: <strong>&gamma;<sub>M</sub> = {materialFactor}</strong></div>
                </>
              ) : (
                <>
                  <div>Allowable Bending: <strong>M<sub>allow</sub> = {section.Mallow} kNm {isTwinProfile ? '(&times; 2 for twin = ' + (section.Mallow * 2).toFixed(2) + ' kNm)' : ''}</strong></div>
                  <div>Allowable Shear: <strong>V<sub>allow</sub> = {section.Vallow} kN {isTwinProfile ? '(&times; 2 for twin = ' + (section.Vallow * 2).toFixed(2) + ' kN)' : ''}</strong></div>
                </>
              )}
            </div>
          </div>

          <div style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '10px' }}>
            <h4 style={{ margin: '0 0 6px 0', fontSize: '14px', color: '#0f172a' }}>2. Bending Capacity Design Check</h4>
            {material === 'steel' ? (
              <div style={{ fontSize: '12px' }}>
                <div>Applied Moment (ULS): <strong>M<sub>Ed</sub> = {maxM.toFixed(2)} kNm</strong></div>
                <div>Design Bending Capacity: <strong>M<sub>c,Rd</sub> = N &middot; W &middot; f<sub>y</sub> / &gamma;<sub>M</sub></strong></div>
                <div style={{ paddingLeft: '10px', fontStyle: 'italic', color: '#64748b' }}>
                  W = {checks.classification?.sectionClass <= 2 ? 'Wpl,y (Plastic Modulus)' : 'Wel,y (Elastic Modulus)'} = {checks.classification?.sectionClass <= 2 ? section.Wpl_y : section.Wel_y} cm³ <br />
                  M<sub>c,Rd</sub> = {isTwinProfile ? '2 &middot; ' : ''}({checks.classification?.sectionClass <= 2 ? section.Wpl_y : section.Wel_y} &times; 10&sup3;) &middot; {section.fy || 355} / {materialFactor} &times; 10&sup6; = {checks.bending?.Mc_Rd} kNm
                </div>
                <div>Bending Utilization: <strong>M<sub>Ed</sub> / M<sub>c,Rd</sub> = {maxM.toFixed(2)} / {checks.bending?.Mc_Rd} = {(checks.bending?.ratio * 100).toFixed(2)}%</strong></div>
              </div>
            ) : (
              <div style={{ fontSize: '12px' }}>
                <div>Applied Moment (ULS): <strong>M<sub>Ed</sub> = {maxM.toFixed(2)} kNm</strong></div>
                <div>Design Bending Capacity: <strong>M<sub>Rd</sub> = N &middot; M<sub>allow</sub> = {isTwinProfile ? '2 &middot; ' : ''}{section.Mallow} = {(section.Mallow * (isTwinProfile ? 2 : 1)).toFixed(2)} kNm</strong></div>
                <div>Bending Utilization: <strong>M<sub>Ed</sub> / M<sub>Rd</sub> = {maxM.toFixed(2)} / {(section.Mallow * (isTwinProfile ? 2 : 1)).toFixed(2)} = {(checks.systemBeam?.bendingCheck?.ratio * 100).toFixed(2)}%</strong></div>
              </div>
            )}
          </div>

          <div style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '10px' }}>
            <h4 style={{ margin: '0 0 6px 0', fontSize: '14px', color: '#0f172a' }}>3. Shear Capacity Design Check</h4>
            {material === 'steel' ? (
              <div style={{ fontSize: '12px' }}>
                <div>Applied Shear (ULS): <strong>V<sub>Ed</sub> = {maxV.toFixed(2)} kN</strong></div>
                <div>Design Shear Capacity: <strong>V<sub>c,Rd</sub> = N &middot; A<sub>v</sub> &middot; (f<sub>y</sub> / &radic;3) / &gamma;<sub>M</sub></strong></div>
                <div style={{ paddingLeft: '10px', fontStyle: 'italic', color: '#64748b' }}>
                  A<sub>v</sub> = {section.Av} cm&sup2; <br />
                  V<sub>c,Rd</sub> = {isTwinProfile ? '2 &middot; ' : ''}({section.Av} &times; 100) &middot; ({section.fy || 355} / &radic;3) / {materialFactor} / 1000 = {checks.shear?.Vc_Rd} kN
                </div>
                <div>Shear Utilization: <strong>V<sub>Ed</sub> / V<sub>c,Rd</sub> = {maxV.toFixed(2)} / {checks.shear?.Vc_Rd} = {(checks.shear?.ratio * 100).toFixed(2)}%</strong></div>
              </div>
            ) : (
              <div style={{ fontSize: '12px' }}>
                <div>Applied Shear (ULS): <strong>V<sub>Ed</sub> = {maxV.toFixed(2)} kN</strong></div>
                <div>Design Shear Capacity: <strong>V<sub>Rd</sub> = N &middot; V<sub>allow</sub> = {isTwinProfile ? '2 &middot; ' : ''}{section.Vallow} = {(section.Vallow * (isTwinProfile ? 2 : 1)).toFixed(2)} kN</strong></div>
                <div>Shear Utilization: <strong>V<sub>Ed</sub> / V<sub>Rd</sub> = {maxV.toFixed(2)} / {(section.Vallow * (isTwinProfile ? 2 : 1)).toFixed(2)} = {(checks.systemBeam?.shearCheck?.ratio * 100).toFixed(2)}%</strong></div>
              </div>
            )}
          </div>

          <div>
            <h4 style={{ margin: '0 0 6px 0', fontSize: '14px', color: '#0f172a' }}>4. Deflection Verification (SLS)</h4>
            <div style={{ fontSize: '12px' }}>
              <div>Max Serviceability Deflection: <strong>&delta;<sub>max</sub> = {checks.deflection?.actual} mm</strong></div>
              <div>Allowable Deflection Limit: <strong>&delta;<sub>allow</sub> = L<sub>span</sub> / {deflectionLimit} = {checks.deflection?.allowable} mm</strong></div>
              <div>Deflection Utilization: <strong>&delta;<sub>max</sub> / &delta;<sub>allow</sub> = {checks.deflection?.actual} / {checks.deflection?.allowable} = {(checks.deflection?.ratio * 100).toFixed(2)}%</strong></div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

// ─── PDF Report Preview Component ─────────────────────────────────────────────
function PDFReportPreview({ results, spans, loads, systemCompany, projectId, setProjectId, calculatedBy, setCalculatedBy, verificationDate, setVerificationDate }) {
  const {
    analysis,
    checks,
    maxM,
    maxV,
    maxDefl,
    section,
    isTwinProfile,
    includeSelfWeight,
    loadFactor,
    materialFactor,
    material,
    w_sw
  } = results;

  const overallPass = checks.overallPass;
  const cls = checks.classification;
  const deflectionLimit = checks.deflection?.limitRatio || 360;
  const dateStr = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

  // Diagram data
  const bmdPts = flattenPoints(analysis).map((p) => ({ x: p.x, value: p.moment }));
  const sfdPts = flattenPoints(analysis).map((p) => ({ x: p.x, value: p.shear }));
  const deflPts = flattenPoints(analysis).map((p) => ({ x: p.x, value: p.deflection }));

  // Helpers to round numbers
  const roundN = (num) => {
    if (num == null || isNaN(num)) return '-';
    return Number(num).toFixed(2);
  };

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
          <title>TempWorks – Beam Calculation Report</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap');
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { font-family: Inter, system-ui, sans-serif; background: #fff; color: #1e293b; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            @page { margin: 0; }
          </style>
        </head>
        <body>${content.outerHTML}</body>
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
    <div style={{ width: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch', paddingBottom: '2rem' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', minWidth: '210mm', margin: '0 auto' }}>
        {/* Export & Configuration Action Area */}
        <div style={{
          width: '210mm',
          backgroundColor: '#ffffff',
          border: '1px solid #cbd5e1',
          borderRadius: '8px',
          padding: '16px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
        }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>Report Metadata Customization</h3>
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
              padding: '8px 20px',
              fontSize: '13px',
              fontWeight: '800',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(37, 99, 235, 0.2)',
              transition: 'transform 160ms cubic-bezier(0.23, 1, 0.32, 1)'
            }}
            onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.97)'}
            onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
          >
            <FileText size={15} /> Print Report
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <span style={{ fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Project ID</span>
            <input 
              type="text" 
              value={projectId} 
              onChange={(e) => setProjectId(e.target.value)} 
              placeholder="e.g. TW-2026-MULTI"
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

      <div ref={reportRef} style={{
        width: '210mm',
        minHeight: '297mm',
        backgroundColor: '#ffffff',
        boxShadow: '0 4px 30px rgba(0, 0, 0, 0.15)',
        border: '1px solid #cbd5e1',
        padding: '20px 32px',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        fontSize: '11px',
        color: '#1e293b',
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif'
      }}>
        {/* Header Block */}
        <div style={{ borderBottom: '2.5px solid #2563eb', paddingBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ fontSize: '18px', fontWeight: 800, color: '#2563eb', letterSpacing: '0.02em' }}>TEMPWORKS</div>
            <div style={{ fontSize: '9px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Structural Design Solutions</div>
            {/* System provider logo */}
            {material === 'system' && COMPANY_LOGOS[systemCompany] && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                <span style={{ fontSize: '8px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>System by</span>
                <img
                  src={COMPANY_LOGOS[systemCompany]}
                  alt={systemCompany}
                  style={{ height: '16px', width: 'auto', objectFit: 'contain' }}
                />
              </div>
            )}
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>Multi-Span Beam Calculation Report</div>
            <div style={{ fontSize: '9px', color: '#64748b', marginTop: '2px' }}>
              Standard: BS EN 1993-1-1 (EC3) & Proprietary Catalogues
            </div>
          </div>
        </div>

        {/* Metadata Details Row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', background: '#f8fafc', padding: '10px 16px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
          <div>
            <span style={{ color: '#64748b', fontSize: '9px', textTransform: 'uppercase', fontWeight: 700 }}>Project ID</span>
            <div style={{ fontWeight: 600, fontSize: '11px', color: '#0f172a' }}>{projectId || 'TW-2026-MULTI'}</div>
          </div>
          <div>
            <span style={{ color: '#64748b', fontSize: '9px', textTransform: 'uppercase', fontWeight: 700 }}>Calculated By</span>
            <div style={{ fontWeight: 600, fontSize: '11px', color: '#0f172a' }}>{calculatedBy || 'Antigravity AI'}</div>
          </div>
          <div>
            <span style={{ color: '#64748b', fontSize: '9px', textTransform: 'uppercase', fontWeight: 700 }}>Verification Date</span>
            <div style={{ fontWeight: 600, fontSize: '11px', color: '#0f172a' }}>{verificationDate || dateStr}</div>
          </div>
          <div>
            <span style={{ color: '#64748b', fontSize: '9px', textTransform: 'uppercase', fontWeight: 700 }}>Design Status</span>
            <div style={{ fontWeight: 800, fontSize: '11px', color: overallPass ? '#16a34a' : '#ef4444' }}>
              {overallPass ? '✅ PASS' : '❌ FAIL'}
            </div>
          </div>
        </div>

        {/* 1. Geometry & Support Conditions (Dynamic Diagram) */}
        <div>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#334155', textTransform: 'uppercase', marginBottom: '4px', borderBottom: '1px solid #cbd5e1', paddingBottom: '3px' }}>
            1. Structural Geometry & Support Reactions
          </div>
          <div style={{ background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0', padding: '6px' }}>
            <DynamicBeamDiagram spans={spans} loads={loads} reactions={analysis.reactions ?? []} />
          </div>
        </div>

        {/* 2. Material & Profile details vs Design Safety factors */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#334155', textTransform: 'uppercase', marginBottom: '4px', borderBottom: '1px solid #cbd5e1', paddingBottom: '3px' }}>
              2. Section & Material Properties
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '4px' }}>
              <tbody>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '4px 0', color: '#64748b' }}>Profile Name</td>
                  <td style={{ padding: '4px 0', fontWeight: 700, textAlign: 'right' }}>{isTwinProfile ? 'Twin ' : ''}{section.name}</td>
                </tr>
                {material === 'steel' && (
                  <>
                    <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '4px 0', color: '#64748b' }}>Material Classification</td>
                      <td style={{ padding: '4px 0', fontWeight: 600, textAlign: 'right' }}>Structural Steel</td>
                    </tr>
                    {cls && (
                      <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '4px 0', color: '#64748b' }}>Section Class</td>
                        <td style={{ padding: '4px 0', fontWeight: 600, textAlign: 'right' }}>Class {cls.sectionClass}</td>
                      </tr>
                    )}
                  </>
                )}
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '4px 0', color: '#64748b' }}>Moment of Inertia (Iy)</td>
                  <td style={{ padding: '4px 0', fontWeight: 600, textAlign: 'right' }}>{roundN(section.Iy * (isTwinProfile ? 2 : 1), 1)} cm⁴</td>
                </tr>
                {material === 'steel' ? (
                  <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '4px 0', color: '#64748b' }}>Plastic Modulus (Wpl,y)</td>
                    <td style={{ padding: '4px 0', fontWeight: 600, textAlign: 'right' }}>{roundN(section.Wpl_y * (isTwinProfile ? 2 : 1), 1)} cm³</td>
                  </tr>
                ) : (
                  <>
                    <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '4px 0', color: '#64748b' }}>Allow. Bending Capacity</td>
                      <td style={{ padding: '4px 0', fontWeight: 600, textAlign: 'right' }}>{roundN(section.Mallow * (isTwinProfile ? 2 : 1), 2)} kNm</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '4px 0', color: '#64748b' }}>Allow. Shear Capacity</td>
                      <td style={{ padding: '4px 0', fontWeight: 600, textAlign: 'right' }}>{roundN(section.Vallow * (isTwinProfile ? 2 : 1), 2)} kN</td>
                    </tr>
                  </>
                )}
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '4px 0', color: '#64748b' }}>Profile Weight</td>
                  <td style={{ padding: '4px 0', fontWeight: 600, textAlign: 'right' }}>{roundN(section.mass * (isTwinProfile ? 2 : 1), 1)} kg/m</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#334155', textTransform: 'uppercase', marginBottom: '4px', borderBottom: '1px solid #cbd5e1', paddingBottom: '3px' }}>
              3. Design Factors & Safety Limits
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '4px' }}>
              <tbody>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '4px 0', color: '#64748b' }}>ULS Combined Load & Material Factor (γ)</td>
                  <td style={{ padding: '4px 0', fontWeight: 700, textAlign: 'right' }}>{material === 'system' ? Number(section.combinedLoadFactor || 1.65).toFixed(2) : Number(loadFactor).toFixed(2)}</td>
                </tr>
                {material === 'steel' && (
                  <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '4px 0', color: '#64748b' }}>ULS Material Factor (γM)</td>
                    <td style={{ padding: '4px 0', fontWeight: 700, textAlign: 'right' }}>{Number(materialFactor).toFixed(2)}</td>
                  </tr>
                )}
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '4px 0', color: '#64748b' }}>SLS Deflection Limit</td>
                  <td style={{ padding: '4px 0', fontWeight: 600, textAlign: 'right' }}>L / {deflectionLimit}</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '4px 0', color: '#64748b' }}>Selfweight Inclusion</td>
                  <td style={{ padding: '4px 0', fontWeight: 600, textAlign: 'right' }}>{includeSelfWeight ? `YES (${roundN(w_sw, 3)} kN/m)` : 'NO'}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* 3. Structural Analysis Diagrams */}
        <div>
          <div style={{ fontSize: '10px', fontWeight: 700, color: '#334155', textTransform: 'uppercase', marginBottom: '3px', borderBottom: '1px solid #cbd5e1', paddingBottom: '2px' }}>
            3. Structural Analysis Diagrams
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
            <div style={{ background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0', padding: '6px' }}>
              <div style={{ fontSize: '9px', fontWeight: 700, color: CLR.bmd, marginBottom: '2px' }}>Bending Moment Diagram (kNm)</div>
              <AnalysisDiagram unit="" points={bmdPts} lineColor={CLR.bmd} fillColor={CLR.bmdFill} invertFill={true} reactions={[]} height={115} />
            </div>
            <div style={{ background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0', padding: '6px' }}>
              <div style={{ fontSize: '9px', fontWeight: 700, color: CLR.sfd, marginBottom: '2px' }}>Shear Force Diagram (kN)</div>
              <AnalysisDiagram unit="" points={sfdPts} lineColor={CLR.sfd} fillColor={CLR.sfdFill} invertFill={false} reactions={[]} height={115} />
            </div>
            <div style={{ background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0', padding: '6px' }}>
              <div style={{ fontSize: '9px', fontWeight: 700, color: CLR.defl, marginBottom: '2px' }}>Deflected Shape (mm)</div>
              <AnalysisDiagram unit="" points={deflPts} lineColor={CLR.defl} fillColor={CLR.deflFill} invertFill={true} reactions={[]} height={115} />
            </div>
          </div>
        </div>

        {/* 4. Limit State Checks & Utilization Summary */}
        <div style={{ flexGrow: 1 }}>
          <div style={{ fontSize: '10px', fontWeight: 700, color: '#334155', textTransform: 'uppercase', marginBottom: '3px', borderBottom: '1px solid #cbd5e1', paddingBottom: '2px' }}>
            4. Limit State Checks & Utilization Summary
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '4px' }}>
            <thead>
              <tr style={{ borderBottom: '1.5px solid #cbd5e1', color: '#64748b', fontSize: '9px', textTransform: 'uppercase' }}>
                <th style={{ padding: '4px 0', textAlign: 'left' }}>Design Check</th>
                <th style={{ padding: '4px 0', textAlign: 'center' }}>Applied</th>
                <th style={{ padding: '4px 0', textAlign: 'center' }}>Capacity</th>
                <th style={{ padding: '4px 0', textAlign: 'left' }}>Utilization</th>
                <th style={{ padding: '4px 0', textAlign: 'right' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {/* Bending */}
              <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '5px 0', fontWeight: 600, fontSize: '10px' }}>Bending (ULS)</td>
                <td style={{ padding: '5px 0', textAlign: 'center', fontSize: '10px' }}>{roundN(maxM, 2)} kNm</td>
                <td style={{ padding: '5px 0', textAlign: 'center', fontSize: '10px' }}>
                  {material === 'steel' ? roundN(checks.bending?.Mc_Rd, 2) : roundN(section.Mallow * (isTwinProfile ? 2 : 1), 2)} kNm
                </td>
                <td style={{ padding: '5px 0', width: '120px' }}>
                  <UtilBar ratio={material === 'steel' ? (checks.bending?.ratio || 0) : (checks.systemBeam?.bendingCheck?.ratio || 0)} />
                </td>
                <td style={{ padding: '5px 0', textAlign: 'right', fontWeight: 800, fontSize: '10px', color: (material === 'steel' ? checks.bending?.pass : checks.systemBeam?.bendingCheck?.pass) ? '#16a34a' : '#ef4444' }}>
                  {(material === 'steel' ? checks.bending?.pass : checks.systemBeam?.bendingCheck?.pass) ? 'PASS' : 'FAIL'}
                </td>
              </tr>
              {/* Shear */}
              <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '5px 0', fontWeight: 600, fontSize: '10px' }}>Shear (ULS)</td>
                <td style={{ padding: '5px 0', textAlign: 'center', fontSize: '10px' }}>{roundN(maxV, 2)} kN</td>
                <td style={{ padding: '5px 0', textAlign: 'center', fontSize: '10px' }}>
                  {material === 'steel' ? roundN(checks.shear?.Vc_Rd, 2) : roundN(section.Vallow * (isTwinProfile ? 2 : 1), 2)} kN
                </td>
                <td style={{ padding: '5px 0', width: '120px' }}>
                  <UtilBar ratio={material === 'steel' ? (checks.shear?.ratio || 0) : (checks.systemBeam?.shearCheck?.ratio || 0)} />
                </td>
                <td style={{ padding: '5px 0', textAlign: 'right', fontWeight: 800, fontSize: '10px', color: (material === 'steel' ? checks.shear?.pass : checks.systemBeam?.shearCheck?.pass) ? '#16a34a' : '#ef4444' }}>
                  {(material === 'steel' ? checks.shear?.pass : checks.systemBeam?.shearCheck?.pass) ? 'PASS' : 'FAIL'}
                </td>
              </tr>
              {/* Deflection */}
              <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '5px 0', fontWeight: 600, fontSize: '10px' }}>Deflection (SLS)</td>
                <td style={{ padding: '5px 0', textAlign: 'center', fontSize: '10px' }}>{roundN(checks.deflection?.actual, 1)} mm</td>
                <td style={{ padding: '5px 0', textAlign: 'center', fontSize: '10px' }}>{roundN(checks.deflection?.allowable, 1)} mm</td>
                <td style={{ padding: '5px 0', width: '120px' }}>
                  <UtilBar ratio={checks.deflection?.ratio || 0} />
                </td>
                <td style={{ padding: '5px 0', textAlign: 'right', fontWeight: 800, fontSize: '10px', color: checks.deflection?.pass ? '#16a34a' : '#ef4444' }}>
                  {checks.deflection?.pass ? 'PASS' : 'FAIL'}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Footer / Sign-off Block */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderTop: '1px solid #e2e8f0', paddingTop: '8px', marginTop: '4px' }}>
          <div>
            <div style={{ color: '#94a3b8', fontSize: '8px', textTransform: 'uppercase' }}>Report Signature</div>
            <div style={{ fontStyle: 'italic', fontWeight: 600, fontSize: '9px', color: '#64748b', marginTop: '1px' }}>Verified Electronically via TempWorks Web Portal</div>
          </div>
          <div style={{ textTransform: 'uppercase', letterSpacing: '0.05em', color: '#94a3b8', fontSize: '8px', fontWeight: 700 }}>
            Page 1 of 1
          </div>
        </div>
      </div>
    </div>
    </div>
  );
}
