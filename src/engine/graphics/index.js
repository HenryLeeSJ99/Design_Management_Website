/**
 * @module @engine/graphics
 * @description Shared diagram and chart rendering for structural calculators.
 */

export {
  DEFAULT_SCHEMATIC_SIZE,
  computeTotalLength,
  computeMmToPxScale,
  createSchematicLayout,
  mmToSvgX,
  spanStartMm,
} from './core/scale.js';

export { computeSupportPositions, computeSpanDimensions } from './core/beamLayout.js';
export { computeLoadGlyph, computeLoadGlyphs } from './core/loadLayout.js';

export {
  flattenAnalysisPoints,
  buildResultChartData,
  buildResultChartOptions,
  RESULT_CHART_DATASETS,
} from './core/resultSeries.js';

export { default as BeamSchematic } from './react/BeamSchematic.jsx';
export { default as ResultCharts } from './react/ResultCharts.jsx';
