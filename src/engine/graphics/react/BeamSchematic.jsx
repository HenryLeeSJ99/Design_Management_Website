import { useMemo } from 'react';
import { createSchematicLayout } from '../core/scale.js';
import { computeSupportPositions, computeSpanDimensions } from '../core/beamLayout.js';
import { computeLoadGlyphs } from '../core/loadLayout.js';

const SUPPORT_SIZE = 16;

function SupportIcon({ x, type }) {
  const size = SUPPORT_SIZE;

  if (type === 'pin') {
    return (
      <g transform={`translate(${x}, 0)`}>
        <polygon points={`0,0 ${size / 2},${size} -${size / 2},${size}`} fill="#64748b" />
        <line x1={-size / 2 - 4} y1={size} x2={size / 2 + 4} y2={size} stroke="#334155" strokeWidth={2} />
      </g>
    );
  }

  if (type === 'roller') {
    return (
      <g transform={`translate(${x}, 0)`}>
        <polygon points={`0,0 ${size / 2},${size - 4} -${size / 2},${size - 4}`} fill="#64748b" />
        <circle cx={-size / 4} cy={size} r={4} fill="#64748b" />
        <circle cx={size / 4} cy={size} r={4} fill="#64748b" />
        <line x1={-size / 2 - 4} y1={size + 4} x2={size / 2 + 4} y2={size + 4} stroke="#334155" strokeWidth={2} />
      </g>
    );
  }

  if (type === 'fixed') {
    return (
      <g transform={`translate(${x}, 0)`}>
        <rect x={-4} y={-size} width={8} height={size * 2} fill="#64748b" />
        <path d="M 4 -12 L 12 -4 M 4 -4 L 12 4 M 4 4 L 12 12" stroke="#334155" strokeWidth={1} />
      </g>
    );
  }

  return null;
}

function PointLoadGlyph({ glyph }) {
  return (
    <g>
      <line x1={glyph.x} y1={glyph.startY} x2={glyph.x} y2={glyph.endY} stroke="#dc2626" strokeWidth="2" markerEnd="url(#arrow)" />
      <text x={glyph.x} y={glyph.labelY} fill="#dc2626" fontSize="12" textAnchor="middle" fontWeight="bold">
        {glyph.label}
      </text>
    </g>
  );
}

function UdlLoadGlyph({ glyph }) {
  const { startX, endX, yPos, height, isUp, arrowCount, labelX, labelY, label } = glyph;

  return (
    <g>
      <rect
        x={startX}
        y={yPos}
        width={Math.max(1, endX - startX)}
        height={height}
        fill="rgba(220, 38, 38, 0.2)"
        stroke="#dc2626"
        strokeWidth="1"
      />
      {Array.from({ length: arrowCount }).map((_, i) => {
        const px = startX + (endX - startX) * (i / (arrowCount - 1));
        return (
          <line
            key={i}
            x1={px}
            y1={isUp ? yPos + height : yPos}
            x2={px}
            y2={isUp ? yPos : yPos + height}
            stroke="#dc2626"
            strokeWidth="1"
            markerEnd="url(#arrow)"
          />
        );
      })}
      <text x={labelX} y={labelY} fill="#dc2626" fontSize="12" textAnchor="middle" fontWeight="bold">
        {label}
      </text>
    </g>
  );
}

/**
 * SVG schematic of a multi-span beam with supports and loads.
 *
 * @param {{ spans?: Array, loads?: Array, className?: string, style?: object }} props
 */
export default function BeamSchematic({ spans = [], loads = [], className, style }) {
  const layout = useMemo(() => createSchematicLayout(spans), [spans]);
  const { svgWidth, svgHeight, margin, drawWidth, beamY, scale } = layout;

  const supports = useMemo(() => computeSupportPositions(spans), [spans]);
  const spanDims = useMemo(
    () => computeSpanDimensions(spans, scale, margin.left),
    [spans, scale, margin.left],
  );
  const loadGlyphs = useMemo(
    () => computeLoadGlyphs(loads, spans, { marginLeft: margin.left, scale, beamY }),
    [loads, spans, margin.left, scale, beamY],
  );

  return (
    <div
      className={className}
      style={{
        width: '100%',
        overflowX: 'auto',
        background: '#f8fafc',
        border: '1px solid #e2e8f0',
        borderRadius: '8px',
        padding: '1rem 0',
        ...style,
      }}
    >
      <svg width={svgWidth} height={svgHeight} style={{ minWidth: '800px', display: 'block', margin: '0 auto' }}>
        <defs>
          <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#dc2626" />
          </marker>
        </defs>

        <line
          x1={margin.left}
          y1={beamY}
          x2={margin.left + drawWidth}
          y2={beamY}
          stroke="#1e293b"
          strokeWidth="6"
          strokeLinecap="round"
        />

        <g transform={`translate(0, ${svgHeight - 20})`}>
          {spanDims.map((dim, i) => (
            <g key={`dim-${i}`}>
              <line x1={dim.startX} y1={-10} x2={dim.startX} y2={5} stroke="#94a3b8" strokeWidth="1" />
              {dim.isLast && (
                <line x1={dim.startX + dim.width} y1={-10} x2={dim.startX + dim.width} y2={5} stroke="#94a3b8" strokeWidth="1" />
              )}
              <line x1={dim.startX} y1={0} x2={dim.startX + dim.width} y2={0} stroke="#94a3b8" strokeWidth="1" />
              <text x={dim.startX + dim.width / 2} y={-5} fill="#64748b" fontSize="11" textAnchor="middle">
                {dim.length} mm
              </text>
            </g>
          ))}
        </g>

        {supports.map((sup) => (
          <g key={sup.id} transform={`translate(0, ${beamY})`}>
            <SupportIcon x={margin.left + sup.x * scale} type={sup.type} />
          </g>
        ))}

        {loadGlyphs.map((glyph, index) =>
          glyph.kind === 'point' ? (
            <PointLoadGlyph key={`load-${index}`} glyph={glyph} />
          ) : (
            <UdlLoadGlyph key={`load-${index}`} glyph={glyph} />
          ),
        )}
      </svg>
    </div>
  );
}
