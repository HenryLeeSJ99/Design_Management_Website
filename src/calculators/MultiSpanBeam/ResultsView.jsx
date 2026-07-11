import { useMemo, useState } from 'react';
import styles from './MultiSpanBeam.module.css';

// ─── Colour tokens ────────────────────────────────────────────────────────────
const CLR = {
  bmd: '#2563eb',      // blue
  bmdFill: 'rgba(37,99,235,0.12)',
  sfd: '#16a34a',      // green
  sfdFill: 'rgba(22,163,74,0.10)',
  defl: '#dc2626',     // red
  deflFill: 'rgba(220,38,38,0.10)',
  beam: '#1e293b',
  dim: '#94a3b8',
  label: '#475569',
  reaction: '#7c3aed',
  zero: '#cbd5e1',
};

// ─── Utility ─────────────────────────────────────────────────────────────────

function flattenPoints(analysis) {
  return analysis.spans.flatMap((s) => s.points);
}

function roundN(v, n = 2) {
  return +v.toFixed(n);
}

// ─── SVG Diagram Component ───────────────────────────────────────────────────

/**
 * Generic analysis diagram rendered as an SVG.
 *
 * @param {{
 *   title: string,
 *   unit: string,
 *   points: {x:number, value:number}[],
 *   analysis: object,
 *   fillColor: string,
 *   lineColor: string,
 *   invertFill?: boolean,     // draw filled area downward (BMD convention)
 *   reactions?: {x:number, value:number}[],
 *   height?: number,
 * }} props
 */
function AnalysisDiagram({ title, unit, points, fillColor, lineColor, invertFill = false, reactions = [], height = 220 }) {
  const W = 900;
  const H = height;
  const ML = 72, MR = 24, MT = 44, MB = 48;
  const drawW = W - ML - MR;
  const drawH = H - MT - MB;
  const zeroY = MT + drawH / 2;

  const xs = points.map((p) => p.x);
  const vals = points.map((p) => p.value);
  const xMin = xs[0] ?? 0;
  const xMax = xs[xs.length - 1] ?? 1;
  const absMax = Math.max(...vals.map(Math.abs), 1e-9);

  function px(x) {
    return ML + ((x - xMin) / (xMax - xMin)) * drawW;
  }
  function py(v) {
    // positive values go UP (sagging moment shown below beam is conventional,
    // but here we draw positive upward and negative downward for clarity)
    return zeroY - (v / absMax) * (drawH / 2) * (invertFill ? -1 : 1);
  }

  // Build SVG path
  const polylinePoints = points.map((p) => `${px(p.x).toFixed(1)},${py(p.value).toFixed(1)}`).join(' ');

  // Fill path: close polygon at zero line
  const fillPath =
    `M ${px(xMin).toFixed(1)},${zeroY} ` +
    points.map((p) => `L ${px(p.x).toFixed(1)},${py(p.value).toFixed(1)}`).join(' ') +
    ` L ${px(xMax).toFixed(1)},${zeroY} Z`;

  // Y-axis ticks
  const yTicks = [-1, -0.5, 0, 0.5, 1].map((f) => ({
    y: zeroY - f * (drawH / 2) * (invertFill ? -1 : 1),
    label: roundN(f * absMax, 2),
  }));

  // X-axis ticks (at span boundaries)
  const xTicksUniq = [...new Set(points.filter((_, i) => i % Math.floor(points.length / 8) === 0).map((p) => p.x))];

  return (
    <div style={{ width: '100%', overflowX: 'auto' }}>
      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        style={{ display: 'block', minWidth: W, fontFamily: 'inherit' }}
      >
        {/* Title */}
        <text x={W / 2} y={16} textAnchor="middle" fontSize={13} fontWeight={700} fill="#0f172a">
          {title}
        </text>

        {/* Zero baseline */}
        <line x1={ML} y1={zeroY} x2={ML + drawW} y2={zeroY} stroke={CLR.zero} strokeWidth={1.5} strokeDasharray="6 3" />

        {/* Y-axis ticks & labels */}
        {yTicks.map((t, i) => (
          <g key={i}>
            <line x1={ML - 4} y1={t.y} x2={ML} y2={t.y} stroke={CLR.dim} strokeWidth={1} />
            <text x={ML - 6} y={t.y + 4} textAnchor="end" fontSize={9} fill={CLR.label}>
              {t.label}
            </text>
          </g>
        ))}

        {/* Y axis label */}
        <text
          x={12}
          y={MT + drawH / 2}
          textAnchor="middle"
          fontSize={10}
          fill={CLR.label}
          transform={`rotate(-90, 12, ${MT + drawH / 2})`}
        >
          {unit}
        </text>

        {/* Axes */}
        <line x1={ML} y1={MT} x2={ML} y2={MT + drawH} stroke={CLR.dim} strokeWidth={1} />
        <line x1={ML} y1={MT + drawH} x2={ML + drawW} y2={MT + drawH} stroke={CLR.dim} strokeWidth={1} />

        {/* X axis ticks */}
        {xTicksUniq.map((x, i) => (
          <g key={i}>
            <line x1={px(x)} y1={MT + drawH} x2={px(x)} y2={MT + drawH + 4} stroke={CLR.dim} strokeWidth={1} />
            <text x={px(x)} y={MT + drawH + 14} textAnchor="middle" fontSize={9} fill={CLR.label}>
              {roundN(x / 1000, 2)}m
            </text>
          </g>
        ))}

        {/* Filled area */}
        <path d={fillPath} fill={fillColor} />

        {/* Polyline */}
        <polyline points={polylinePoints} fill="none" stroke={lineColor} strokeWidth={2} strokeLinejoin="round" />

        {/* Peak value annotation */}
        {(() => {
          const peak = points.reduce((a, b) => (Math.abs(b.value) > Math.abs(a.value) ? b : a), points[0]);
          if (!peak) return null;
          const bx = px(peak.x);
          const by = py(peak.value);
          const labelAbove = by > MT + 20;
          return (
            <g>
              <circle cx={bx} cy={by} r={3.5} fill={lineColor} />
              <text
                x={bx}
                y={labelAbove ? by - 6 : by + 14}
                textAnchor="middle"
                fontSize={10}
                fontWeight={700}
                fill={lineColor}
              >
                {roundN(peak.value, 2)} {unit.split(' ')[0]}
              </text>
            </g>
          );
        })()}

        {/* Reaction arrows */}
        {reactions.map((r, i) => {
          const rx = px(r.x);
          const isUp = r.value > 0;
          const tip = MT + drawH + 2;
          const tail = tip + 28;
          return (
            <g key={i}>
              <defs>
                <marker id={`rarrow-${i}`} viewBox="0 0 8 8" refX="6" refY="4" markerWidth={5} markerHeight={5} orient={isUp ? 'auto-start-reverse' : 'auto'}>
                  <path d="M0 0 L8 4 L0 8 z" fill={CLR.reaction} />
                </marker>
              </defs>
              <line
                x1={rx} y1={isUp ? tail : tip}
                x2={rx} y2={isUp ? tip : tail}
                stroke={CLR.reaction}
                strokeWidth={2}
                markerEnd={`url(#rarrow-${i})`}
              />
              <text x={rx} y={isUp ? tail + 12 : tail + 12} textAnchor="middle" fontSize={9} fill={CLR.reaction} fontWeight={600}>
                {roundN(Math.abs(r.value), 2)} kN
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ─── Utilization Bar ─────────────────────────────────────────────────────────

function UtilBar({ ratio }) {
  const pct = Math.min(ratio * 100, 120);
  const over = ratio > 1;
  const barColor = over ? '#ef4444' : ratio > 0.85 ? '#f59e0b' : '#22c55e';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 160 }}>
      <div style={{ flex: 1, height: 8, background: '#e2e8f0', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ width: `${Math.min(pct, 100)}%`, height: '100%', background: barColor, borderRadius: 4, transition: 'width 0.4s' }} />
      </div>
      <span style={{ fontSize: 12, fontWeight: 700, color: barColor, minWidth: 46, textAlign: 'right' }}>
        {(ratio * 100).toFixed(1)}%
      </span>
    </div>
  );
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function Badge({ pass, label }) {
  return (
    <span
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700,
        background: pass ? '#dcfce7' : '#fee2e2',
        color: pass ? '#16a34a' : '#dc2626',
      }}
    >
      {pass ? '✓' : '✗'} {label ?? (pass ? 'PASS' : 'FAIL')}
    </span>
  );
}

// ─── Check Table Row ─────────────────────────────────────────────────────────

function CheckRow({ label, formula, applied, capacity, unit, ratio, pass }) {
  return (
    <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
      <td style={{ padding: '10px 14px', fontWeight: 600, color: '#0f172a', fontSize: 13 }}>{label}</td>
      <td style={{ padding: '10px 14px', fontSize: 12, color: '#64748b', fontFamily: 'monospace' }}>{formula}</td>
      <td style={{ padding: '10px 14px', fontSize: 13, textAlign: 'right', fontWeight: 600, color: '#1e293b' }}>
        {applied != null ? `${roundN(applied, 2)} ${unit}` : '—'}
      </td>
      <td style={{ padding: '10px 14px', fontSize: 13, textAlign: 'right', color: '#475569' }}>
        {capacity != null ? `${roundN(capacity, 2)} ${unit}` : '—'}
      </td>
      <td style={{ padding: '10px 14px' }}>
        <UtilBar ratio={ratio} />
      </td>
      <td style={{ padding: '10px 14px', textAlign: 'center' }}>
        <Badge pass={pass} />
      </td>
    </tr>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ResultsView({ results, sectionName }) {
  const { analysis, checks, maxM, maxV, maxDefl } = results;

  // Flatten points for each diagram
  const bmdPoints = useMemo(
    () => flattenPoints(analysis).map((p) => ({ x: p.x, value: p.moment })),
    [analysis],
  );
  const sfdPoints = useMemo(
    () => flattenPoints(analysis).map((p) => ({ x: p.x, value: p.shear })),
    [analysis],
  );
  const deflPoints = useMemo(
    () => flattenPoints(analysis).map((p) => ({ x: p.x, value: p.deflection })),
    [analysis],
  );

  // Reactions from solver
  const reactions = useMemo(() => analysis.reactions ?? [], [analysis]);

  // Overall status
  const overallPass = checks.overallPass ?? (checks.bending?.pass && checks.shear?.pass && checks.deflection?.pass);

  // jsPDF and jspdf-autotable load on demand so they never weigh down the
  // calculator's initial bundle.
  const [pdfBusy, setPdfBusy] = useState(null); // 'preview' | 'download' | null

  const buildPDF = async () => {
    const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
      import('jspdf'),
      import('jspdf-autotable'),
    ]);
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text('TempWorks Design Management System', 14, 22);
    doc.setFontSize(14);
    doc.text('Multi-Span Beam Calculation Report', 14, 32);
    doc.setFontSize(10);
    doc.text(`Section: ${sectionName}`, 14, 45);
    doc.text(`Overall Status: ${overallPass ? 'PASS' : 'FAIL'}`, 14, 52);
    autoTable(doc, {
      startY: 60,
      head: [['Check', 'Applied', 'Capacity', 'Utilization', 'Status']],
      body: [
        ['Bending Moment', `${maxM.toFixed(2)} kNm`, `${checks.bending?.Mc_Rd?.toFixed(2) ?? '?'} kNm`, `${(checks.bending?.ratio * 100).toFixed(1)}%`, checks.bending?.pass ? 'PASS' : 'FAIL'],
        ['Shear Force', `${maxV.toFixed(2)} kN`, `${checks.shear?.Vc_Rd?.toFixed(2) ?? '?'} kN`, `${(checks.shear?.ratio * 100).toFixed(1)}%`, checks.shear?.pass ? 'PASS' : 'FAIL'],
        ['Deflection', `${maxDefl.toFixed(2)} mm`, `${checks.deflection?.allowable?.toFixed(2) ?? '?'} mm`, `${(checks.deflection?.ratio * 100).toFixed(1)}%`, checks.deflection?.pass ? 'PASS' : 'FAIL'],
      ],
    });
    return doc;
  };

  const previewPDF = async () => {
    setPdfBusy('preview');
    try {
      const doc = await buildPDF();
      window.open(doc.output('bloburl'), '_blank');
    } finally {
      setPdfBusy(null);
    }
  };

  const downloadPDF = async () => {
    setPdfBusy('download');
    try {
      const doc = await buildPDF();
      doc.save('TempWorks_Report.pdf');
    } finally {
      setPdfBusy(null);
    }
  };

  const cls = checks.classification;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Overall status banner ── */}
      <div
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: overallPass ? 'linear-gradient(135deg,#f0fdf4,#dcfce7)' : 'linear-gradient(135deg,#fff1f2,#fee2e2)',
          border: `1.5px solid ${overallPass ? '#86efac' : '#fca5a5'}`,
          borderRadius: 14, padding: '16px 24px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ fontSize: 36 }}>{overallPass ? '✅' : '❌'}</span>
          <div>
            <div style={{ fontSize: 20, fontWeight: 800, color: overallPass ? '#15803d' : '#b91c1c' }}>
              {overallPass ? 'DESIGN PASSES' : 'DESIGN FAILS'}
            </div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
              Section: <strong>{sectionName}</strong>
              {cls && <> · Class <strong>{cls.sectionClass}</strong> section</>}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            onClick={previewPDF}
            disabled={pdfBusy !== null}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: '#fff', color: '#1d4ed8', border: '1px solid #bfdbfe',
              padding: '10px 20px', borderRadius: 8, fontWeight: 600, fontSize: 13,
              cursor: pdfBusy ? 'wait' : 'pointer', opacity: pdfBusy && pdfBusy !== 'preview' ? 0.6 : 1,
            }}
          >
            {pdfBusy === 'preview' ? 'Preparing preview...' : 'Preview PDF'}
          </button>
          <button
            onClick={downloadPDF}
            disabled={pdfBusy !== null}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: '#1d4ed8', color: '#fff', border: 'none',
              padding: '10px 20px', borderRadius: 8, fontWeight: 600, fontSize: 13,
              cursor: pdfBusy ? 'wait' : 'pointer', opacity: pdfBusy && pdfBusy !== 'download' ? 0.6 : 1,
            }}
          >
            {pdfBusy === 'download' ? 'Preparing PDF...' : 'Download PDF'}
          </button>
        </div>
      </div>

      {/* ── Summary cards ── */}
      <div className={styles.resultsGrid}>
        {[
          { label: 'Max Bending Moment', value: maxM, cap: checks.bending?.Mc_Rd, unit: 'kNm', ratio: checks.bending?.ratio, pass: checks.bending?.pass, color: CLR.bmd },
          { label: 'Max Shear Force', value: maxV, cap: checks.shear?.Vc_Rd, unit: 'kN', ratio: checks.shear?.ratio, pass: checks.shear?.pass, color: CLR.sfd },
          { label: 'Max Deflection', value: maxDefl, cap: checks.deflection?.allowable, unit: 'mm', ratio: checks.deflection?.ratio, pass: checks.deflection?.pass, color: CLR.defl },
        ].map((item) => (
          <div
            key={item.label}
            className={styles.cardPanel}
            style={{ padding: '18px 20px', borderTop: `4px solid ${item.color}` }}
          >
            <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
              {item.label}
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', marginBottom: 4 }}>
              {roundN(item.value, 2)}
              <span style={{ fontSize: 13, fontWeight: 500, color: '#64748b', marginLeft: 4 }}>{item.unit}</span>
            </div>
            <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 10 }}>
              Capacity: <strong style={{ color: '#475569' }}>{item.cap != null ? roundN(item.cap, 2) : '—'} {item.unit}</strong>
            </div>
            <UtilBar ratio={item.ratio ?? 0} />
            <div style={{ marginTop: 8 }}>
              <Badge pass={item.pass} />
            </div>
          </div>
        ))}
      </div>

      {/* ── Analysis diagrams ── */}
      <div className={styles.cardPanel} style={{ overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>Analysis Diagrams</span>
          <span style={{ fontSize: 12, color: '#94a3b8', marginLeft: 'auto' }}>
            {reactions.length} reactions · {analysis.spans?.length ?? 0} span(s)
          </span>
        </div>

        {/* Bending Moment */}
        <div style={{ padding: '20px 16px 8px', borderBottom: '1px solid #f1f5f9' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={{ width: 14, height: 4, background: CLR.bmd, borderRadius: 2, display: 'inline-block' }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: CLR.bmd }}>Bending Moment Diagram (BMD)</span>
            <span style={{ fontSize: 11, color: '#94a3b8', marginLeft: 4 }}>kNm — positive sagging</span>
          </div>
          <AnalysisDiagram
            title=""
            unit="kNm"
            points={bmdPoints}
            lineColor={CLR.bmd}
            fillColor={CLR.bmdFill}
            invertFill={true}
            reactions={reactions}
            height={230}
          />
        </div>

        {/* Shear Force */}
        <div style={{ padding: '20px 16px 8px', borderBottom: '1px solid #f1f5f9' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={{ width: 14, height: 4, background: CLR.sfd, borderRadius: 2, display: 'inline-block' }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: CLR.sfd }}>Shear Force Diagram (SFD)</span>
            <span style={{ fontSize: 11, color: '#94a3b8', marginLeft: 4 }}>kN</span>
          </div>
          <AnalysisDiagram
            title=""
            unit="kN"
            points={sfdPoints}
            lineColor={CLR.sfd}
            fillColor={CLR.sfdFill}
            height={200}
          />
        </div>

        {/* Deflection */}
        <div style={{ padding: '20px 16px 8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={{ width: 14, height: 4, background: CLR.defl, borderRadius: 2, display: 'inline-block' }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: CLR.defl }}>Deflected Shape</span>
            <span style={{ fontSize: 11, color: '#94a3b8', marginLeft: 4 }}>mm — exaggerated for clarity</span>
          </div>
          <AnalysisDiagram
            title=""
            unit="mm"
            points={deflPoints}
            lineColor={CLR.defl}
            fillColor={CLR.deflFill}
            invertFill={false}
            height={200}
          />
        </div>
      </div>

      {/* ── EC3 Checks Table ── */}
      <div className={styles.cardPanel} style={{ overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>BS EN 1993-1-1 (EC3) Design Checks</span>
        </div>

        {/* Section classification banner */}
        {cls && (
          <div style={{ padding: '12px 20px', background: '#fafafa', borderBottom: '1px solid #e2e8f0', display: 'flex', gap: 24, flexWrap: 'wrap', fontSize: 12, color: '#475569' }}>
            <span>Section Class: <strong style={{ color: '#0f172a', fontSize: 14 }}>{cls.sectionClass}</strong></span>
            {cls.details.epsilon != null && <span>ε = {roundN(cls.details.epsilon, 4)}</span>}
            {cls.details.flangeRatio != null && <span>Flange c/t = {roundN(cls.details.flangeRatio, 2)} (Class {cls.details.flangeClass})</span>}
            {cls.details.webRatio != null && <span>Web c/t = {roundN(cls.details.webRatio, 2)} (Class {cls.details.webClass})</span>}
            {cls.details.wallRatio != null && <span>Wall c/t = {roundN(cls.details.wallRatio, 2)} (Class {cls.details.wallClass})</span>}
          </div>
        )}

        <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', width: '100%' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '650px' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
              {['Check', 'Reference', 'Applied', 'Capacity', 'Utilization', 'Status'].map((h) => (
                <th key={h} style={{ padding: '10px 14px', textAlign: h === 'Applied' || h === 'Capacity' ? 'right' : 'left', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {checks.bending && (
              <CheckRow
                label="Bending Resistance"
                formula="M_Ed / M_c,Rd ≤ 1.0 (§6.2.5)"
                applied={maxM}
                capacity={checks.bending.Mc_Rd}
                unit="kNm"
                ratio={checks.bending.ratio}
                pass={checks.bending.pass}
              />
            )}
            {checks.shear && (
              <CheckRow
                label="Shear Resistance"
                formula="V_Ed / V_c,Rd ≤ 1.0 (§6.2.6)"
                applied={maxV}
                capacity={checks.shear.Vc_Rd}
                unit="kN"
                ratio={checks.shear.ratio}
                pass={checks.shear.pass}
              />
            )}
            {checks.interaction && checks.interaction.ratio != null && (
              <CheckRow
                label="Bending–Shear Interaction"
                formula="M_V,Rd check (§6.2.8)"
                applied={null}
                capacity={null}
                unit=""
                ratio={checks.interaction.ratio}
                pass={checks.interaction.pass}
              />
            )}
            {checks.deflection && (
              <CheckRow
                label="Deflection"
                formula={`δ / L ≤ 1/${checks.deflection.limitRatio ?? 200} (SLS)`}
                applied={checks.deflection.actual ?? maxDefl}
                capacity={checks.deflection.allowable}
                unit="mm"
                ratio={checks.deflection.ratio}
                pass={checks.deflection.pass}
              />
            )}
            {checks.systemBeam && (
              <>
                {checks.systemBeam.bendingCheck && (
                  <CheckRow
                    label="Bending (Manufacturer)"
                    formula="M_Ed / M_allow ≤ 1.0"
                    applied={maxM}
                    capacity={checks.systemBeam.Mallow}
                    unit="kNm"
                    ratio={checks.systemBeam.bendingCheck.ratio}
                    pass={checks.systemBeam.bendingCheck.pass}
                  />
                )}
                {checks.systemBeam.shearCheck && (
                  <CheckRow
                    label="Shear (Manufacturer)"
                    formula="V_Ed / V_allow ≤ 1.0"
                    applied={maxV}
                    capacity={checks.systemBeam.Vallow}
                    unit="kN"
                    ratio={checks.systemBeam.shearCheck.ratio}
                    pass={checks.systemBeam.shearCheck.pass}
                  />
                )}
              </>
            )}
          </tbody>
        </table>
      </div>

        {/* Reaction summary */}
        {reactions.length > 0 && (
          <div style={{ padding: '14px 20px', borderTop: '1px solid #e2e8f0', background: '#fafafa' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
              Support Reactions
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {reactions.map((r, i) => (
                <div
                  key={i}
                  style={{
                    background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8,
                    padding: '6px 14px', fontSize: 12, fontWeight: 600, color: CLR.reaction,
                  }}
                >
                  R{i + 1} = {roundN(Math.abs(r.value), 2)} kN
                  <span style={{ fontSize: 10, color: '#94a3b8', marginLeft: 6 }}>
                    @ {roundN(r.x / 1000, 2)} m
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
