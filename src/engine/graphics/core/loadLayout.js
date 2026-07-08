/**
 * @module @engine/graphics/core/loadLayout
 * @description Load glyph layout for beam schematic diagrams.
 */

import { mmToSvgX, spanStartMm } from './scale.js';

/**
 * @typedef {Object} PointLoadGlyph
 * @property {'point'} kind
 * @property {number} x - SVG x
 * @property {number} startY
 * @property {number} endY
 * @property {number} labelY
 * @property {string} label
 */

/**
 * @typedef {Object} UdlLoadGlyph
 * @property {'udl'} kind
 * @property {number} startX
 * @property {number} endX
 * @property {number} yPos
 * @property {number} height
 * @property {boolean} isUp
 * @property {number} arrowCount
 * @property {number} labelX
 * @property {number} labelY
 * @property {string} label
 */

/**
 * @param {Object} load
 * @param {Array<{ length?: number }>} spans
 * @param {{ marginLeft: number, scale: number, beamY: number }} layout
 * @returns {PointLoadGlyph|UdlLoadGlyph|null}
 */
export function computeLoadGlyph(load, spans, { marginLeft, scale, beamY }) {
  const spanStart = spanStartMm(spans, load.spanIndex);

  if (load.type === 'point') {
    const posMm = spanStart + Number(load.posStart ?? load.pos ?? 0);
    const x = mmToSvgX(posMm, marginLeft, scale);
    const mag = Number(load.magnitude || 0);
    const isUp = mag < 0;
    const arrowLen = 40;
    const startY = isUp ? beamY + 10 + arrowLen : beamY - 10 - arrowLen;
    const endY = isUp ? beamY + 10 : beamY - 10;

    return {
      kind: 'point',
      x,
      startY,
      endY,
      labelY: isUp ? startY + 15 : startY - 5,
      label: `${mag} kN`,
    };
  }

  if (load.type === 'udl') {
    const startX = mmToSvgX(spanStart + Number(load.posStart || 0), marginLeft, scale);
    const endX = mmToSvgX(spanStart + Number(load.posEnd || 0), marginLeft, scale);
    const mag = Number(load.magnitude || 0);
    const height = 20;
    const isUp = mag < 0;
    const yPos = isUp ? beamY + 10 : beamY - 10 - height;
    const width = Math.max(1, endX - startX);

    return {
      kind: 'udl',
      startX,
      endX,
      yPos,
      height,
      isUp,
      arrowCount: Math.max(2, Math.floor(width / 20)),
      labelX: (startX + endX) / 2,
      labelY: isUp ? yPos + height + 15 : yPos - 5,
      label: `${mag} kN/m`,
    };
  }

  return null;
}

/**
 * @param {Object[]} loads
 * @param {Array<{ length?: number }>} spans
 * @param {{ marginLeft: number, scale: number, beamY: number }} layout
 * @returns {(PointLoadGlyph|UdlLoadGlyph)[]}
 */
export function computeLoadGlyphs(loads, spans, layout) {
  return loads
    .map((load) => computeLoadGlyph(load, spans, layout))
    .filter(Boolean);
}
