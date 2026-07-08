/**
 * @module @engine/graphics/core/beamLayout
 * @description Support positions and span dimension layout for beam schematics.
 */

/**
 * @typedef {Object} SupportMarker
 * @property {number} x - Position along beam (mm)
 * @property {string} type - 'pin' | 'roller' | 'fixed' | 'free'
 * @property {string} id
 */

/**
 * Collect unique support positions from physical spans.
 *
 * @param {Array<{ length?: number, leftSupport?: string, rightSupport?: string }>} spans
 * @returns {SupportMarker[]}
 */
export function computeSupportPositions(spans) {
  const sups = [];
  let currentX = 0;

  spans.forEach((span, index) => {
    if (span.leftSupport !== 'free') {
      sups.push({ x: currentX, type: span.leftSupport, id: `sup-${index}-L` });
    }

    currentX += Number(span.length || 0);

    if (index === spans.length - 1 && span.rightSupport !== 'free') {
      sups.push({ x: currentX, type: span.rightSupport, id: `sup-${index}-R` });
    }
  });

  const unique = [];
  const seenX = new Set();
  sups.forEach((s) => {
    if (!seenX.has(s.x)) {
      seenX.add(s.x);
      unique.push(s);
    }
  });

  return unique;
}

/**
 * Pixel dimensions for each span's dimension line.
 *
 * @param {Array<{ length?: number }>} spans
 * @param {number} scale - mm → px
 * @param {number} marginLeft
 */
export function computeSpanDimensions(spans, scale, marginLeft) {
  return spans.map((span, i) => {
    let startX = marginLeft;
    for (let j = 0; j < i; j++) {
      startX += Number(spans[j].length) * scale;
    }
    const width = Number(span.length) * scale;
    return { startX, width, length: span.length, isLast: i === spans.length - 1 };
  });
}
