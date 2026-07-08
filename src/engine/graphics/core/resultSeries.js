/**
 * @module @engine/graphics/core/resultSeries
 * @description Transform solver analysis output into chart-ready series data.
 */

/**
 * @typedef {import('../../beam/types.js').BeamResults} BeamResults
 */

/**
 * @param {BeamResults} analysis
 * @returns {Array<{ x: number, moment: number, shear: number, deflection: number }>}
 */
export function flattenAnalysisPoints(analysis) {
  return analysis.spans.flatMap((span) => span.points);
}

/** Default Chart.js dataset styling for beam result diagrams. */
export const RESULT_CHART_DATASETS = [
  {
    label: 'Bending Moment (kNm)',
    field: 'moment',
    borderColor: '#0284c7',
    backgroundColor: 'rgba(2, 132, 199, 0.1)',
    fill: true,
    tension: 0.1,
    yAxisID: 'y',
    pointRadius: 0,
  },
  {
    label: 'Shear Force (kN)',
    field: 'shear',
    borderColor: '#16a34a',
    backgroundColor: 'transparent',
    borderDash: [5, 5],
    tension: 0,
    yAxisID: 'y1',
    pointRadius: 0,
  },
  {
    label: 'Deflection (mm)',
    field: 'deflection',
    borderColor: '#dc2626',
    backgroundColor: 'transparent',
    tension: 0.2,
    yAxisID: 'y2',
    pointRadius: 0,
  },
];

/**
 * Build Chart.js `data` object from solver analysis results.
 *
 * @param {BeamResults} analysis
 */
export function buildResultChartData(analysis) {
  const points = flattenAnalysisPoints(analysis);

  return {
    labels: points.map((p) => (p.x / 1000).toFixed(2)),
    datasets: RESULT_CHART_DATASETS.map(({ field, ...style }) => ({
      ...style,
      data: points.map((p) => p[field]),
    })),
  };
}

/** Default Chart.js options for combined M/V/deflection chart. */
export function buildResultChartOptions() {
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    scales: {
      x: { title: { display: true, text: 'Position (m)' } },
      y: {
        type: 'linear',
        display: true,
        position: 'left',
        title: { display: true, text: 'Moment (kNm)' },
      },
      y1: {
        type: 'linear',
        display: true,
        position: 'right',
        title: { display: true, text: 'Shear (kN)' },
        grid: { drawOnChartArea: false },
      },
      y2: {
        type: 'linear',
        display: true,
        position: 'right',
        title: { display: true, text: 'Deflection (mm)' },
        grid: { drawOnChartArea: false },
      },
    },
  };
}
