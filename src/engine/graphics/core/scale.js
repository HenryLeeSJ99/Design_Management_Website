/**
 * @module @engine/graphics/core/scale
 * @description Coordinate scaling for beam schematic diagrams (mm → SVG pixels).
 */

/** @typedef {{ top: number, right: number, bottom: number, left: number }} Margins */

export const DEFAULT_SCHEMATIC_SIZE = {
  svgWidth: 800,
  svgHeight: 240,
  margin: { top: 60, right: 40, bottom: 60, left: 40 },
};

/**
 * @param {Array<{ length?: number }>} spans
 * @returns {number} Total beam length in mm (minimum 1 to avoid division by zero).
 */
export function computeTotalLength(spans) {
  return spans.reduce((sum, span) => sum + Number(span.length || 0), 0) || 1;
}

/**
 * @param {number} totalLengthMm
 * @param {number} drawWidthPx
 */
export function computeMmToPxScale(totalLengthMm, drawWidthPx) {
  return drawWidthPx / totalLengthMm;
}

/**
 * Build layout constants for a beam schematic SVG.
 *
 * @param {Array<{ length?: number }>} spans
 * @param {Partial<typeof DEFAULT_SCHEMATIC_SIZE>} [options]
 */
export function createSchematicLayout(spans, options = {}) {
  const { svgWidth, svgHeight, margin } = { ...DEFAULT_SCHEMATIC_SIZE, ...options };
  const drawWidth = svgWidth - margin.left - margin.right;
  const beamY = svgHeight / 2;
  const totalLength = computeTotalLength(spans);
  const scale = computeMmToPxScale(totalLength, drawWidth);

  return { svgWidth, svgHeight, margin, drawWidth, beamY, totalLength, scale };
}

/**
 * @param {number} mmPosition
 * @param {number} marginLeft
 * @param {number} scale
 */
export function mmToSvgX(mmPosition, marginLeft, scale) {
  return marginLeft + mmPosition * scale;
}

/**
 * Global x (mm) at the start of a physical span.
 *
 * @param {Array<{ length?: number }>} spans
 * @param {number} spanIndex
 */
export function spanStartMm(spans, spanIndex) {
  let x = 0;
  for (let i = 0; i < spanIndex; i++) {
    x += Number(spans[i]?.length || 0);
  }
  return x;
}
