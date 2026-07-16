import { useMemo, useState, useEffect, useRef } from 'react';

export default function DynamicBeamDiagram({ spans = [], loads = [], reactions = [] }) {
  // Constants for drawing - matched to AnalysisDiagram for alignment
  const svgWidth = 860;
  const svgHeight = 180;
  const margin = { top: 40, right: 20, bottom: 40, left: 62 };
  const drawWidth = svgWidth - margin.left - margin.right;
  const beamY = 90; // offset slightly down to leave room for loads

  const [textScale, setTextScale] = useState(1);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (let entry of entries) {
        const width = entry.contentRect.width || svgWidth;
        const ratio = svgWidth / Math.max(width, 100);
        setTextScale(Math.max(1, Math.pow(ratio, 0.5) * 1.2));
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [svgWidth]);

  // Calculate total length
  const totalLength = useMemo(() => {
    return spans.reduce((sum, span) => sum + Number(span.length || 0), 0) || 1;
  }, [spans]);

  const scale = drawWidth / totalLength;

  // Calculate support positions
  const supports = useMemo(() => {
    const sups = [];
    if (spans.length === 0) return sups;

    // Leftmost support of the entire beam
    if (spans[0].leftSupport && spans[0].leftSupport !== 'free') {
      sups.push({ x: 0, type: spans[0].leftSupport, id: 'sup-start' });
    }

    let currentX = 0;
    spans.forEach((span, index) => {
      currentX += Number(span.length || 0);
      if (span.rightSupport && span.rightSupport !== 'free') {
        sups.push({ x: currentX, type: span.rightSupport, id: `sup-${index}-R` });
      }
    });

    return sups;
  }, [spans]);


  // Helper to draw a support icon
  const renderSupport = (x, type, key) => {
    const sx = margin.left + x * scale;
    const sy = beamY;
    const size = 16;
    
    // Find reaction matching this support coordinates (within 10mm tolerance)
    const rxn = reactions.find(r => Math.abs(r.x - x) < 10);
    const rxnText = rxn ? `${Math.abs(rxn.value).toFixed(2)} kN` : null;
    
    let supportIcon = null;
    if (type === 'pin') {
      supportIcon = (
        <g>
          <polygon points={`0,0 ${size/2},${size} -${size/2},${size}`} fill="#64748b" />
          <line x1={-size/2 - 4} y1={size} x2={size/2 + 4} y2={size} stroke="#334155" strokeWidth={2} />
        </g>
      );
    } else if (type === 'roller') {
      supportIcon = (
        <g>
           <polygon points={`0,0 ${size/2},${size-4} -${size/2},${size-4}`} fill="#64748b" />
           <circle cx={-size/4} cy={size} r={4} fill="#64748b" />
           <circle cx={size/4} cy={size} r={4} fill="#64748b" />
           <line x1={-size/2 - 4} y1={size+4} x2={size/2 + 4} y2={size+4} stroke="#334155" strokeWidth={2} />
        </g>
      );
    } else if (type === 'fixed') {
      supportIcon = (
        <g>
          <rect x={-4} y={-size} width={8} height={size*2} fill="#64748b" />
          {/* Hatches */}
          <path d="M 4 -12 L 12 -4 M 4 -4 L 12 4 M 4 4 L 12 12" stroke="#334155" strokeWidth={1} />
        </g>
      );
    }

    return (
      <g key={key} transform={`translate(${sx}, ${sy})`}>
        {supportIcon}
        {rxnText && (
          <g transform={`translate(0, ${size + 4})`}>
            {/* Upward green reaction force arrow */}
            <line x1={0} y1={14} x2={0} y2={2} stroke="#16a34a" strokeWidth={1.5} markerEnd="url(#rxn-arrow)" />
            <text x={0} y={24} fill="#15803d" fontSize={Math.round(10 * textScale)} textAnchor="middle" fontWeight="bold">
              {rxnText}
            </text>
          </g>
        )}
      </g>
    );
  };

  // Helper to draw loads
  const renderLoad = (load, index) => {
    // Calculate global X start based on spanIndex
    let spanStartX = 0;
    for (let i = 0; i < load.spanIndex; i++) {
      spanStartX += Number(spans[i]?.length || 0);
    }

    if (load.type === 'point') {
      const spanLength = spans[load.spanIndex] ? Number(spans[load.spanIndex].length || 0) : 0;
      const clampedPos = Math.max(0, Math.min(Number(load.pos || 0), spanLength));
      const pos = spanStartX + clampedPos;
      const x = margin.left + pos * scale;
      const mag = Number(load.magnitude || 0);
      const isUp = mag < 0;
      const arrowLen = 40;
      
      const startY = isUp ? beamY + 10 + arrowLen : beamY - 10 - arrowLen;
      const endY = isUp ? beamY + 10 : beamY - 10;
      
      return (
        <g key={`load-${index}`}>
          <line x1={x} y1={startY} x2={x} y2={endY} stroke="#dc2626" strokeWidth="2" markerEnd="url(#arrow)" />
          <text x={x} y={isUp ? startY + 15 * textScale : startY - 5 * textScale} fill="#dc2626" fontSize={Math.round(12 * textScale)} textAnchor="middle" fontWeight="bold">
            {mag} kN
          </text>
        </g>
      );
    } else if (load.type === 'udl' || load.type === 'varying') {
      const spanLength = spans[load.spanIndex] ? Number(spans[load.spanIndex].length || 0) : 0;
      const clampedStart = Math.max(0, Math.min(Number(load.posStart || 0), spanLength));
      const clampedEnd = Math.max(clampedStart, Math.min(Number(load.posEnd || 0), spanLength));
      const startX = margin.left + (spanStartX + clampedStart) * scale;
      const endX = margin.left + (spanStartX + clampedEnd) * scale;
      
      const mag = Number(load.magnitude || 0);
      const magEnd = load.type === 'varying' && load.magnitudeEnd !== undefined ? Number(load.magnitudeEnd) : mag;
      const maxMag = Math.max(Math.abs(mag), Math.abs(magEnd)) || 1;
      const hStart = (Math.abs(mag) / maxMag) * 20;
      const hEnd = (Math.abs(magEnd) / maxMag) * 20;
      
      const isUp = (mag + magEnd) / 2 < 0;
      const yBase = isUp ? beamY + 10 : beamY - 10;
      const yTopStart = isUp ? yBase + hStart : yBase - hStart;
      const yTopEnd = isUp ? yBase + hEnd : yBase - hEnd;

      const pts = `${startX},${yBase} ${startX},${yTopStart} ${endX},${yTopEnd} ${endX},${yBase}`;
      
      return (
        <g key={`load-${index}`}>
          <polygon points={pts} fill="rgba(220, 38, 38, 0.2)" stroke="#dc2626" strokeWidth="1" />
          {/* UDL/Varying arrows */}
          {Array.from({length: Math.max(2, Math.floor((endX - startX) / 20))}).map((_, i, arr) => {
            const px = startX + (endX - startX) * (i / (arr.length - 1));
            const pyTop = yTopStart + (yTopEnd - yTopStart) * (i / (arr.length - 1));
            // if isUp is true, arrow points UP from pyTop to yBase. Wait, markerEnd is on y2.
            // If load is DOWN (isUp=false), arrow points DOWN to yBase. y1 = pyTop, y2 = yBase.
            // If load is UP (isUp=true), arrow points UP to yBase. y1 = pyTop, y2 = yBase.
            return (
              <line key={i} x1={px} y1={pyTop} x2={px} y2={yBase} stroke="#dc2626" strokeWidth="1" markerEnd="url(#arrow)" />
            )
          })}
          <text 
            x={(startX + endX)/2} 
            y={isUp ? Math.max(yTopStart, yTopEnd) + 15 * textScale : Math.min(yTopStart, yTopEnd) - 5 * textScale} 
            fill="#dc2626" 
            fontSize={Math.round(12 * textScale)} 
            textAnchor="middle" 
            fontWeight="bold"
          >
            {load.type === 'varying' ? `${mag} to ${magEnd} kN/m` : `${mag} kN/m`}
          </text>
        </g>
      );
    }
  };

  return (
    <div ref={containerRef} style={{ width: '100%', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1rem 0' }}>
      <svg 
        width="100%" 
        height="100%" 
        viewBox={`0 0 ${svgWidth} ${svgHeight}`} 
        style={{ display: 'block', width: '100%', height: 'auto', maxHeight: svgHeight }}
      >
        <defs>
          <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#dc2626" />
          </marker>
          <marker id="rxn-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#16a34a" />
          </marker>
        </defs>

        {/* Beam Line */}
        <line 
          x1={margin.left} 
          y1={beamY} 
          x2={margin.left + drawWidth} 
          y2={beamY} 
          stroke="#1e293b" 
          strokeWidth="6" 
          strokeLinecap="round" 
        />

        {/* Dimension Lines */}
        <g transform={`translate(0, ${svgHeight - 20})`}>
          {spans.map((span, i) => {
            let startX = margin.left;
            for(let j=0; j<i; j++) startX += Number(spans[j].length) * scale;
            const width = Number(span.length) * scale;
            return (
              <g key={`dim-${i}`}>
                {/* vertical ticks */}
                <line x1={startX} y1={-10} x2={startX} y2={5} stroke="#94a3b8" strokeWidth="1" />
                {i === spans.length - 1 && (
                  <line x1={startX + width} y1={-10} x2={startX + width} y2={5} stroke="#94a3b8" strokeWidth="1" />
                )}
                {/* horizontal line */}
                <line x1={startX} y1={0} x2={startX + width} y2={0} stroke="#94a3b8" strokeWidth="1" />
                {/* text */}
                <text x={startX + width/2} y={-5} fill="#64748b" fontSize={Math.round(11 * textScale)} textAnchor="middle">
                  {span.length} mm
                </text>
              </g>
            )
          })}
        </g>

        {/* Supports */}
        {supports.map(sup => renderSupport(sup.x, sup.type, sup.id))}

        {/* Loads */}
        {loads.map((load, index) => renderLoad(load, index))}
        
      </svg>
    </div>
  );
}
