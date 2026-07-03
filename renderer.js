/**
 * @module renderer
 * @description Draws structural engineering diagrams on HTML5 Canvas elements.
 * Provides rendering for beam diagrams, shear force diagrams (SFD),
 * bending moment diagrams (BMD), and deflection curves.
 *
 * All x values and lengths are in mm. Moments in kNm, shears in kN, deflections in mm.
 */

/* ──────────────────────── colour palette ──────────────────────── */
const COLORS = {
  beam: '#1E3A8A',        // blue-900
  support: '#4B5563',     // gray-600
  load: '#991B1B',        // red-800
  dimension: '#6B7280',   // gray-500
  text: '#374151',        // gray-700
  shearPositive: '#0284C7', // sky-600 (professional blue)
  shearNegative: '#38BDF8', // sky-400
  momentPositive: '#EA580C',// orange-600 (professional orange)
  momentNegative: '#FDBA74',// orange-300
  deflection: '#8B5CF6',    // violet-500 (professional purple)
  baseline: '#9CA3AF',    // gray-400
  grid: 'rgba(0,0,0,0.1)',
};

const MARGINS = { top: 40, bottom: 50, left: 60, right: 40 };
const FONT = '14px sans-serif';
const FONT_BOLD = 'bold 15px sans-serif';

/* ──────────────────────── helpers ──────────────────────── */

/**
 * Sets up a canvas for high-DPI rendering.
 * @param {HTMLCanvasElement} canvas
 * @returns {{ ctx: CanvasRenderingContext2D, width: number, height: number }}
 */
function setupCanvas(canvas) {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  return { ctx, width: rect.width, height: rect.height };
}

/**
 * Returns the drawable area after applying margins.
 * @param {number} width  - CSS width of canvas
 * @param {number} height - CSS height of canvas
 * @returns {{ x: number, y: number, w: number, h: number }}
 */
function plotArea(width, height) {
  return {
    x: MARGINS.left,
    y: MARGINS.top,
    w: width - MARGINS.left - MARGINS.right,
    h: height - MARGINS.top - MARGINS.bottom,
  };
}

/**
 * Creates a linear mapping function from data-space to pixel-space.
 * @param {number} domainMin
 * @param {number} domainMax
 * @param {number} rangeMin
 * @param {number} rangeMax
 * @returns {(v: number) => number}
 */
function linearScale(domainMin, domainMax, rangeMin, rangeMax) {
  const span = domainMax - domainMin || 1;
  return (v) => rangeMin + ((v - domainMin) / span) * (rangeMax - rangeMin);
}

/**
 * Format a number to a sensible precision for labels.
 * @param {number} v
 * @param {number} [digits=2]
 * @returns {string}
 */
function fmt(v, digits = 2) {
  return Number(v).toFixed(digits);
}

/**
 * Collects every point across all spans into one flat list for envelope rendering.
 * @param {Array} spans - solverResults.spans
 * @param {string} key  - 'shear' | 'moment' | 'deflection'
 * @returns {{ xs: number[], vals: number[] }}
 */
function collectPoints(spans, key) {
  const xs = [];
  const vals = [];
  for (const span of spans) {
    for (const pt of span.points) {
      xs.push(pt.x);
      vals.push(pt[key]);
    }
  }
  return { xs, vals };
}

/**
 * Draws a dashed horizontal baseline.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} y
 * @param {number} x0
 * @param {number} x1
 */
function drawBaseline(ctx, y, x0, x1) {
  ctx.save();
  ctx.strokeStyle = COLORS.baseline;
  ctx.lineWidth = 1;
  ctx.setLineDash([6, 4]);
  ctx.beginPath();
  ctx.moveTo(x0, y);
  ctx.lineTo(x1, y);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

/**
 * Draws a title string centred at the top of the canvas.
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} title
 * @param {number} width
 */
function drawTitle(ctx, title, width) {
  ctx.save();
  ctx.font = FONT_BOLD;
  ctx.fillStyle = COLORS.text;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(title, width / 2, 10);
  ctx.restore();
}

/**
 * Draws tick marks along the x-axis indicating span boundaries.
 * @param {CanvasRenderingContext2D} ctx
 * @param {Array} spans - solverResults.spans
 * @param {Function} xScale
 * @param {number} baselineY
 * @param {object} area
 */
function drawXTicks(ctx, spans, xScale, baselineY, area) {
  ctx.save();
  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 0.5;
  ctx.setLineDash([3, 3]);

  const drawn = new Set();
  for (const s of spans) {
    for (const edge of [s.startX, s.endX]) {
      if (drawn.has(edge)) continue;
      drawn.add(edge);
      const px = xScale(edge);
      ctx.beginPath();
      ctx.moveTo(px, area.y);
      ctx.lineTo(px, area.y + area.h);
      ctx.stroke();
    }
  }
  ctx.setLineDash([]);
  ctx.restore();
}

/* ══════════════════════════════════════════════════════════
   1.  BEAM DIAGRAM
   ══════════════════════════════════════════════════════════ */

/**
 * Renders the beam diagram showing supports, loads, dimensions and reactions.
 *
 * @param {HTMLCanvasElement} canvas
 * @param {object} params
 * @param {Array} params.physicalSpans
 * @param {Array} params.physicalLoads
 * @param {Array} params.mappedReactions
 * @param {boolean} [params.hideTitle=false]
 */
export function renderBeamDiagram(canvas, { physicalSpans, physicalLoads, mappedReactions, hideTitle }) {
  const { ctx, width, height } = setupCanvas(canvas);
  const area = plotArea(width, height);

  const totalLength = physicalSpans.reduce((s, v) => s + v.length, 0);
  const xScale = linearScale(0, totalLength, area.x, area.x + area.w);
  const beamY = area.y + area.h * 0.45;

  if (!hideTitle) {
    drawTitle(ctx, 'Beam Diagram', width);
  }

  /* ── beam line ── */
  ctx.save();
  ctx.strokeStyle = COLORS.beam;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(xScale(0), beamY);
  ctx.lineTo(xScale(totalLength), beamY);
  ctx.stroke();
  ctx.restore();

  /* ── node positions ── */
  const nodePositions = [0];
  let cumX = 0;
  for (const sp of physicalSpans) {
    cumX += sp.length;
    nodePositions.push(cumX);
  }

  /* ── supports ── */
  drawSupport(ctx, xScale(0), beamY, physicalSpans[0].leftSupport);
  for (let i = 0; i < physicalSpans.length; i++) {
    drawSupport(ctx, xScale(nodePositions[i + 1]), beamY, physicalSpans[i].rightSupport);
  }

  /* ── loads ── */
  for (const load of physicalLoads) {
    const spanStartX = nodePositions[load.spanIndex];
    const spanL = physicalSpans[load.spanIndex].length;
    
    if (load.type === 'udl') {
      const x0 = spanStartX + load.posStart;
      const x1 = load.posEnd !== null ? (spanStartX + load.posEnd) : (spanStartX + spanL);
      if (x1 > x0 && load.magnitude > 0) {
        drawUDL(ctx, xScale(x0), xScale(x1), beamY, load.magnitude);
      }
    } else if (load.type === 'point') {
      const x = spanStartX + load.posStart;
      if (load.magnitude > 0) {
        drawPointLoad(ctx, xScale(x), beamY, load.magnitude);
      }
    }
  }

  /* ── span dimension labels ── */
  for (let i = 0; i < physicalSpans.length; i++) {
    const startPx = xScale(nodePositions[i]);
    const endPx = xScale(nodePositions[i + 1]);
    const midPx = (startPx + endPx) / 2;
    const labelY = beamY + 75;

    ctx.save();
    ctx.strokeStyle = COLORS.dimension;
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(startPx, labelY - 5);
    ctx.lineTo(startPx, labelY + 5);
    ctx.moveTo(startPx, labelY);
    ctx.lineTo(endPx, labelY);
    ctx.moveTo(endPx, labelY - 5);
    ctx.lineTo(endPx, labelY + 5);
    ctx.stroke();

    drawArrowhead(ctx, startPx, labelY, 'right', 5, COLORS.dimension);
    drawArrowhead(ctx, endPx, labelY, 'left', 5, COLORS.dimension);

    ctx.font = FONT;
    ctx.fillStyle = COLORS.dimension;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(`${fmt(physicalSpans[i].length, 0)} mm`, midPx, labelY + 6);
    
    if (physicalSpans.length > 1) {
      ctx.textBaseline = 'bottom';
      ctx.font = 'bold 12px system-ui, sans-serif';
      ctx.fillText(`Span ${i + 1}`, midPx, labelY - 4);
    }
    
    ctx.restore();
  }

  /* ── reaction labels ── */
  if (mappedReactions) {
    for (const r of mappedReactions) {
      if (Math.abs(r.value) < 0.01) continue;
      const px = xScale(r.x);
      
      ctx.save();
      ctx.strokeStyle = COLORS.load;
      ctx.fillStyle = COLORS.load;
      ctx.lineWidth = 1.5;
      
      const arrowLen = 25;
      if (r.value > 0) {
        // Point UP towards support
        const topY = beamY + 32; 
        const bottomY = topY + arrowLen;
        
        ctx.beginPath();
        ctx.moveTo(px, bottomY);
        ctx.lineTo(px, topY);
        ctx.stroke();
        drawArrowhead(ctx, px, topY, 'up', 5, COLORS.load);
        
        ctx.font = FONT;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(`${fmt(r.value, 2)} kN`, px, bottomY + 4);
      } else {
        // Point DOWN away from support
        const topY = beamY + 32;
        const bottomY = topY + arrowLen;
        
        ctx.beginPath();
        ctx.moveTo(px, topY);
        ctx.lineTo(px, bottomY);
        ctx.stroke();
        drawArrowhead(ctx, px, bottomY, 'down', 5, COLORS.load);
        
        ctx.font = FONT;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(`${fmt(r.value, 2)} kN`, px, bottomY + 4);
      }
      ctx.restore();
    }
  }
}

/**
 * Draws a point load arrow.
 */
function drawPointLoad(ctx, px, beamY, mag) {
  const arrowLen = 30;
  const topY = beamY - arrowLen - 6;
  ctx.save();
  ctx.strokeStyle = COLORS.load;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(px, topY);
  ctx.lineTo(px, beamY - 4);
  ctx.stroke();
  drawArrowhead(ctx, px, beamY - 4, 'down', 5, COLORS.load);
  
  ctx.font = FONT;
  ctx.fillStyle = COLORS.load;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText(`${fmt(mag, 2)} kN`, px, topY - 3);
  ctx.restore();
}

/**
 * Draws UDL arrows along the top of the beam.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x0
 * @param {number} x1
 * @param {number} beamY
 * @param {number} loadPerMeter
 */
function drawUDL(ctx, x0, x1, beamY, loadPerMeter) {
  const arrowSpacing = 20;
  const arrowLen = 25;
  const topY = beamY - arrowLen - 6;
  const count = Math.max(2, Math.floor((x1 - x0) / arrowSpacing));
  const step = (x1 - x0) / count;

  ctx.save();
  /* top line */
  ctx.strokeStyle = COLORS.load;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x0, topY);
  ctx.lineTo(x1, topY);
  ctx.stroke();

  /* arrows */
  for (let i = 0; i <= count; i++) {
    const ax = x0 + i * step;
    ctx.beginPath();
    ctx.moveTo(ax, topY);
    ctx.lineTo(ax, beamY - 4);
    ctx.stroke();
    drawArrowhead(ctx, ax, beamY - 4, 'down', 4, COLORS.load);
  }

  /* label */
  ctx.font = FONT;
  ctx.fillStyle = COLORS.load;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText(`${fmt(loadPerMeter, 2)} kN/m`, (x0 + x1) / 2, topY - 3);
  ctx.restore();
}

/**
 * Draws a support symbol at the given position.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x   - pixel x
 * @param {number} y   - beam y
 * @param {string} type - 'pin' | 'roller' | 'fixed' | 'free'
 */
function drawSupport(ctx, x, y, type) {
  const size = 14;
  ctx.save();
  ctx.strokeStyle = COLORS.support;
  ctx.fillStyle = COLORS.support;
  ctx.lineWidth = 1.5;

  switch (type) {
    case 'pin': {
      /* triangle */
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - size, y + size);
      ctx.lineTo(x + size, y + size);
      ctx.closePath();
      ctx.stroke();
      /* ground line */
      ctx.beginPath();
      ctx.moveTo(x - size - 4, y + size + 2);
      ctx.lineTo(x + size + 4, y + size + 2);
      ctx.stroke();
      break;
    }
    case 'roller': {
      /* triangle */
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - size, y + size);
      ctx.lineTo(x + size, y + size);
      ctx.closePath();
      ctx.stroke();
      /* circle */
      ctx.beginPath();
      ctx.arc(x, y + size + 6, 5, 0, Math.PI * 2);
      ctx.stroke();
      /* ground line */
      ctx.beginPath();
      ctx.moveTo(x - size - 4, y + size + 13);
      ctx.lineTo(x + size + 4, y + size + 13);
      ctx.stroke();
      break;
    }
    case 'fixed': {
      /* filled rectangle / wall hatching */
      const w = 6;
      const h = size * 2;
      ctx.fillRect(x - w, y - h / 2, w, h);
      /* hatch lines */
      ctx.lineWidth = 1;
      for (let dy = -h / 2; dy < h / 2; dy += 5) {
        ctx.beginPath();
        ctx.moveTo(x - w, y + dy);
        ctx.lineTo(x - w - 6, y + dy + 6);
        ctx.stroke();
      }
      break;
    }
    case 'free':
    default:
      /* nothing */
      break;
  }
  ctx.restore();
}

/**
 * Draws a small arrowhead.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 * @param {'up'|'down'|'left'|'right'} dir
 * @param {number} size
 * @param {string} color
 */
function drawArrowhead(ctx, x, y, dir, size, color) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  switch (dir) {
    case 'down':
      ctx.moveTo(x, y);
      ctx.lineTo(x - size, y - size);
      ctx.lineTo(x + size, y - size);
      break;
    case 'up':
      ctx.moveTo(x, y);
      ctx.lineTo(x - size, y + size);
      ctx.lineTo(x + size, y + size);
      break;
    case 'left':
      ctx.moveTo(x, y);
      ctx.lineTo(x + size, y - size);
      ctx.lineTo(x + size, y + size);
      break;
    case 'right':
      ctx.moveTo(x, y);
      ctx.lineTo(x - size, y - size);
      ctx.lineTo(x - size, y + size);
      break;
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/* ══════════════════════════════════════════════════════════
   2.  SHEAR FORCE DIAGRAM
   ══════════════════════════════════════════════════════════ */

/**
 * Renders the Shear Force Diagram.
 * Positive shear is plotted above the baseline (green), negative below (red).
 *
 * @param {HTMLCanvasElement} canvas
 * @param {object} solverResults - solver output containing spans array and maxShear
 */
export function renderSFD(canvas, solverResults, hoverX = null) {
  const { ctx, width, height } = setupCanvas(canvas);
  const area = plotArea(width, height);
  const { spans, maxShear } = solverResults;

  const { xs, vals } = collectPoints(spans, 'shear');
  if (xs.length === 0) return;

  const totalLength = spans[spans.length - 1].endX;
  const xScale = linearScale(0, totalLength, area.x, area.x + area.w);

  /* symmetric y range so baseline is centred */
  const absMax = Math.max(
    Math.abs(Math.max(...vals)),
    Math.abs(Math.min(...vals)),
    0.001
  );
  const yScale = linearScale(-absMax, absMax, area.y + area.h, area.y);
  const baselineY = yScale(0);

  drawTitle(ctx, 'Shear Force Diagram (kN)', width);
  drawBaseline(ctx, baselineY, area.x, area.x + area.w);
  drawXTicks(ctx, spans, xScale, baselineY, area);

  /* ── filled shear envelope ── */
  for (let i = 0; i < xs.length - 1; i++) {
    const x0 = xScale(xs[i]);
    const x1 = xScale(xs[i + 1]);
    const v0 = vals[i];
    const v1 = vals[i + 1];
    const y0 = yScale(v0);
    const y1 = yScale(v1);

    /* determine dominant colour (average sign) */
    const avg = (v0 + v1) / 2;
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = avg >= 0 ? COLORS.shearPositive : COLORS.shearNegative;
    ctx.beginPath();
    ctx.moveTo(x0, baselineY);
    ctx.lineTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.lineTo(x1, baselineY);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1.0;
    ctx.restore();
  }

  /* ── shear line ── */
  ctx.save();
  ctx.strokeStyle = COLORS.shearPositive;
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i < xs.length; i++) {
    const px = xScale(xs[i]);
    const py = yScale(vals[i]);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.stroke();
  ctx.restore();

  /* ── labels ── */
  labelExtreme(ctx, maxShear, xScale, yScale, 'kN', true);
  labelShearMinimum(ctx, xs, vals, xScale, yScale);

  /* y-axis labels */
  drawYAxisLabels(ctx, -absMax, absMax, area, yScale, 'kN');

  if (hoverX !== null) {
    drawHoverScrubber(ctx, area, hoverX, xs, vals, xScale, yScale, 'kN');
  }
}

/**
 * Finds and labels the maximum negative shear.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number[]} xs
 * @param {number[]} vals
 * @param {Function} xScale
 * @param {Function} yScale
 */
function labelShearMinimum(ctx, xs, vals, xScale, yScale) {
  let minVal = 0;
  let minX = 0;
  for (let i = 0; i < vals.length; i++) {
    if (vals[i] < minVal) {
      minVal = vals[i];
      minX = xs[i];
    }
  }
  if (minVal < 0) {
    const px = xScale(minX);
    const py = yScale(minVal);
    ctx.save();
    ctx.font = FONT;
    ctx.fillStyle = COLORS.shearNegative;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(`${fmt(minVal)} kN`, px, py + 4);
    ctx.restore();
  }
}

/* ══════════════════════════════════════════════════════════
   3.  BENDING MOMENT DIAGRAM
   ══════════════════════════════════════════════════════════ */

/**
 * Renders the Bending Moment Diagram.
 * **Convention**: positive (sagging) moments are plotted BELOW the baseline.
 *
 * @param {HTMLCanvasElement} canvas
 * @param {object} solverResults
 */
export function renderBMD(canvas, solverResults, hoverX = null) {
  const { ctx, width, height } = setupCanvas(canvas);
  const area = plotArea(width, height);
  const { spans, maxMoment } = solverResults;

  const { xs, vals } = collectPoints(spans, 'moment');
  if (xs.length === 0) return;

  const totalLength = spans[spans.length - 1].endX;
  const xScale = linearScale(0, totalLength, area.x, area.x + area.w);

  const absMax = Math.max(
    Math.abs(Math.max(...vals)),
    Math.abs(Math.min(...vals)),
    0.001
  );

  /*
   * Invert the y-scale so positive moments go BELOW the baseline:
   *   yScale(+M) → lower on screen (larger y)
   *   yScale(-M) → higher on screen (smaller y)
   */
  const yScale = linearScale(-absMax, absMax, area.y, area.y + area.h);
  const baselineY = yScale(0);

  drawTitle(ctx, 'Bending Moment Diagram (kNm)', width);
  drawBaseline(ctx, baselineY, area.x, area.x + area.w);
  drawXTicks(ctx, spans, xScale, baselineY, area);

  /* ── filled moment envelope ── */
  for (let i = 0; i < xs.length - 1; i++) {
    const x0 = xScale(xs[i]);
    const x1 = xScale(xs[i + 1]);
    const m0 = vals[i];
    const m1 = vals[i + 1];
    const y0 = yScale(m0);
    const y1 = yScale(m1);

    const avg = (m0 + m1) / 2;
    ctx.save();
    ctx.globalAlpha = 0.30;
    /* positive (sagging) → blue, negative (hogging) → orange */
    ctx.fillStyle = avg >= 0 ? COLORS.momentPositive : COLORS.momentNegative;
    ctx.beginPath();
    ctx.moveTo(x0, baselineY);
    ctx.lineTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.lineTo(x1, baselineY);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1.0;
    ctx.restore();
  }

  /* ── moment curve ── */
  ctx.save();
  ctx.strokeStyle = COLORS.momentPositive;
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i < xs.length; i++) {
    const px = xScale(xs[i]);
    const py = yScale(vals[i]);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.stroke();
  ctx.restore();

  /* ── labels for max sagging and hogging ── */
  labelMomentExtremes(ctx, xs, vals, xScale, yScale);

  /* y-axis labels (inverted convention text) */
  drawYAxisLabelsBMD(ctx, absMax, area, yScale);
  
  if (hoverX !== null) {
    drawHoverScrubber(ctx, area, hoverX, xs, vals, xScale, yScale, 'kNm');
  }
}

/**
 * Labels both the maximum sagging and maximum hogging moments.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number[]} xs
 * @param {number[]} vals
 * @param {Function} xScale
 * @param {Function} yScale
 */
function labelMomentExtremes(ctx, xs, vals, xScale, yScale) {
  let maxSag = 0, maxSagX = 0;
  let maxHog = 0, maxHogX = 0;

  for (let i = 0; i < vals.length; i++) {
    if (vals[i] > maxSag) { maxSag = vals[i]; maxSagX = xs[i]; }
    if (vals[i] < maxHog) { maxHog = vals[i]; maxHogX = xs[i]; }
  }

  ctx.save();
  ctx.font = FONT;

  /* max sagging (positive, drawn below baseline) */
  if (maxSag > 0) {
    const px = xScale(maxSagX);
    const py = yScale(maxSag);
    ctx.fillStyle = COLORS.momentPositive;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(`${fmt(maxSag)} kNm`, px, py + 4);
  }

  /* max hogging (negative, drawn above baseline) */
  if (maxHog < 0) {
    const px = xScale(maxHogX);
    const py = yScale(maxHog);
    ctx.fillStyle = COLORS.momentNegative;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(`${fmt(maxHog)} kNm`, px, py - 4);
  }

  ctx.restore();
}

/**
 * Draws y-axis labels for the BMD with inverted convention annotation.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} absMax
 * @param {object} area
 * @param {Function} yScale
 */
function drawYAxisLabelsBMD(ctx, absMax, area, yScale) {
  ctx.save();
  ctx.font = FONT;
  ctx.fillStyle = COLORS.text;
  ctx.textAlign = 'right';

  const ticks = 4;
  for (let i = 0; i <= ticks; i++) {
    const v = -absMax + (2 * absMax * i) / ticks;
    const py = yScale(v);
    ctx.textBaseline = 'middle';
    ctx.fillText(fmt(v), area.x - 8, py);

    /* tick mark */
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(area.x - 3, py);
    ctx.lineTo(area.x, py);
    ctx.stroke();
  }

  /* convention note */
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  ctx.fillStyle = COLORS.momentPositive;
  ctx.fillText('+ve sagging ↓', area.x + 4, area.y + area.h - 2);

  ctx.restore();
}

/* ══════════════════════════════════════════════════════════
   4.  DEFLECTION DIAGRAM
   ══════════════════════════════════════════════════════════ */

/**
 * Renders the deflection diagram.
 * Shows the original beam (dashed) and the deflected shape (solid, exaggerated scale).
 *
 * @param {HTMLCanvasElement} canvas
 * @param {object} solverResults
 */
export function renderDeflection(canvas, solverResults, hoverX = null) {
  const { ctx, width, height } = setupCanvas(canvas);
  const area = plotArea(width, height);
  const { spans, maxDeflection } = solverResults;

  const { xs, vals } = collectPoints(spans, 'deflection');
  if (xs.length === 0) return;

  const totalLength = spans[spans.length - 1].endX;
  const xScale = linearScale(0, totalLength, area.x, area.x + area.w);

  const minDefl = Math.min(...vals);
  const maxDefl = Math.max(...vals);
  const absMax = Math.max(Math.abs(minDefl), Math.abs(maxDefl), 0.001);

  /* exaggerated scale: deflections fill ~70 % of plot height */
  const deflScale = (area.h * 0.35) / absMax;
  const beamY = area.y + area.h * 0.35; // original beam line

  drawTitle(ctx, 'Deflection (mm)', width);
  drawXTicks(ctx, spans, xScale, beamY, area);

  /* ── original beam (dashed) ── */
  ctx.save();
  ctx.strokeStyle = COLORS.baseline;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([8, 5]);
  ctx.beginPath();
  ctx.moveTo(xScale(0), beamY);
  ctx.lineTo(xScale(totalLength), beamY);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  /* ── deflected shape (solid) ── */
  ctx.save();
  ctx.strokeStyle = COLORS.deflection;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  for (let i = 0; i < xs.length; i++) {
    /* positive deflection downward on screen */
    const px = xScale(xs[i]);
    const py = beamY + vals[i] * deflScale;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.stroke();
  ctx.restore();

  /* ── shaded area between original and deflected ── */
  ctx.save();
  ctx.globalAlpha = 0.15;
  ctx.fillStyle = COLORS.deflection;
  ctx.beginPath();
  ctx.moveTo(xScale(xs[0]), beamY);
  for (let i = 0; i < xs.length; i++) {
    ctx.lineTo(xScale(xs[i]), beamY + vals[i] * deflScale);
  }
  ctx.lineTo(xScale(xs[xs.length - 1]), beamY);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1.0;
  ctx.restore();

  /* ── max deflection label ── */
  if (maxDeflection) {
    const px = xScale(maxDeflection.x);
    const py = beamY + maxDeflection.value * deflScale;
    const isBelow = maxDeflection.value >= 0;

    ctx.save();
    /* marker dot */
    ctx.fillStyle = COLORS.deflection;
    ctx.beginPath();
    ctx.arc(px, py, 4, 0, Math.PI * 2);
    ctx.fill();

    /* leader line */
    ctx.strokeStyle = COLORS.deflection;
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 2]);
    const lineEnd = isBelow ? py + 22 : py - 22;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px, lineEnd);
    ctx.stroke();
    ctx.setLineDash([]);

    /* text */
    ctx.font = FONT;
    ctx.fillStyle = COLORS.deflection;
    ctx.textAlign = 'center';
    ctx.textBaseline = isBelow ? 'top' : 'bottom';
    ctx.fillText(`${fmt(maxDeflection.value, 3)} mm`, px, lineEnd + (isBelow ? 2 : -2));
    ctx.fillStyle = COLORS.text;
    ctx.fillText(`@ ${fmt(maxDeflection.x, 0)} mm`, px, lineEnd + (isBelow ? 15 : -15));
    ctx.restore();
  }

  /* ── legend ── */
  ctx.save();
  ctx.font = FONT;
  const legendX = area.x + area.w - 120;
  const legendY = area.y + 5;

  /* original line sample */
  ctx.strokeStyle = COLORS.baseline;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 4]);
  ctx.beginPath();
  ctx.moveTo(legendX, legendY + 6);
  ctx.lineTo(legendX + 20, legendY + 6);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = COLORS.text;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillText('Original', legendX + 25, legendY + 6);

  /* deflected line sample */
  ctx.strokeStyle = COLORS.deflection;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(legendX, legendY + 20);
  ctx.lineTo(legendX + 20, legendY + 20);
  ctx.stroke();
  ctx.fillStyle = COLORS.deflection;
  ctx.fillText('Deflected', legendX + 25, legendY + 20);

  ctx.restore();
  
  if (hoverX !== null) {
    const yScale = (v) => beamY + v * deflScale;
    drawHoverScrubber(ctx, area, hoverX, xs, vals, xScale, yScale, 'mm');
  }
}

/* ──────────────────────── shared label helpers ──────────────────────── */

/**
 * Labels an extreme value on a filled diagram (SFD / BMD).
 * @param {CanvasRenderingContext2D} ctx
 * @param {{ value: number, x: number }} extreme
 * @param {Function} xScale
 * @param {Function} yScale
 * @param {string} unit
 * @param {boolean} positiveAbove - true if positive is above baseline
 */
function labelExtreme(ctx, extreme, xScale, yScale, unit, positiveAbove) {
  if (!extreme) return;
  const px = xScale(extreme.x);
  const py = yScale(extreme.value);
  const isAbove = positiveAbove ? extreme.value >= 0 : extreme.value <= 0;

  ctx.save();
  ctx.font = FONT;
  ctx.fillStyle = COLORS.text;
  ctx.textAlign = 'center';
  ctx.textBaseline = isAbove ? 'bottom' : 'top';
  ctx.fillText(`${fmt(extreme.value)} ${unit}`, px, py + (isAbove ? -6 : 6));
  ctx.restore();
}

/**
 * Draws y-axis tick labels.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} minVal
 * @param {number} maxVal
 * @param {object} area
 * @param {Function} yScale
 * @param {string} unit
 */
function drawYAxisLabels(ctx, minVal, maxVal, area, yScale, unit) {
  ctx.save();
  ctx.font = FONT;
  ctx.fillStyle = COLORS.text;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';

  const ticks = 4;
  for (let i = 0; i <= ticks; i++) {
    const v = minVal + ((maxVal - minVal) * i) / ticks;
    const py = yScale(v);
    ctx.fillText(fmt(v), area.x - 8, py);

    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(area.x - 3, py);
    ctx.lineTo(area.x, py);
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * Draws an interactive hover scrubber and tooltip at the given physical x coordinate.
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} area
 * @param {number} hoverX
 * @param {number[]} xs
 * @param {number[]} vals
 * @param {Function} xScale
 * @param {Function} yScale
 * @param {string} unit
 */
function drawHoverScrubber(ctx, area, hoverX, xs, vals, xScale, yScale, unit) {
  let closestIdx = 0;
  let minDiff = Infinity;
  for (let i = 0; i < xs.length; i++) {
    const diff = Math.abs(xs[i] - hoverX);
    if (diff < minDiff) {
      minDiff = diff;
      closestIdx = i;
    }
  }

  const px = xScale(xs[closestIdx]);
  const py = yScale(vals[closestIdx]);
  const val = vals[closestIdx];

  // Draw vertical line
  ctx.save();
  ctx.strokeStyle = '#000000';
  ctx.setLineDash([4, 4]);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(px, area.y);
  ctx.lineTo(px, area.y + area.h);
  ctx.stroke();

  // Draw point marker
  ctx.beginPath();
  ctx.arc(px, py, 5, 0, 2 * Math.PI);
  ctx.fillStyle = '#EF5350';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#FFFFFF';
  ctx.stroke();

  // Draw tooltip bubble
  const text = `x = ${xs[closestIdx].toFixed(0)} mm | ${val.toFixed(2)} ${unit}`;
  ctx.font = '600 14px Inter, sans-serif';
  const textWidth = ctx.measureText(text).width;
  
  const boxW = textWidth + 24;
  const boxH = 26;
  let boxX = px + 12;
  let boxY = py - 12;
  
  // Flip if goes out of bounds
  if (boxX + boxW > area.x + area.w) {
    boxX = px - boxW - 12;
  }
  if (boxY < area.y + boxH/2) {
    boxY = py + 12 + boxH/2;
  }

  ctx.fillStyle = 'rgba(26, 28, 32, 0.9)'; // Dark tooltip bg
  ctx.beginPath();
  ctx.roundRect(boxX, boxY - boxH/2, boxW, boxH, 4);
  ctx.fill();

  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, boxX + boxW/2, boxY + 1);

  ctx.restore();
}
