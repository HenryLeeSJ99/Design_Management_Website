/**
 * @module @engine/beam
 * @description Public API for multi-span Euler-Bernoulli beam analysis.
 */

import { buildMesh } from './mesher.js';
import { solveBeam } from './solver.js';

export { buildMesh } from './mesher.js';
export { solveBeam } from './solver.js';

/**
 * Mesh physical spans/loads and run matrix stiffness analysis.
 *
 * @param {import('./types.js').BeamAnalysisInput} input
 * @returns {import('./types.js').BeamAnalysisOutput}
 */
export function analyzeBeam({ spans, loads, E, I }) {
  const mesh = buildMesh(spans, loads);
  const analysis = solveBeam({
    spans: mesh.internalSpans,
    supports: mesh.internalSupports,
    nodalLoads: mesh.nodalLoads,
    elementLoads: mesh.elementLoads,
    E,
    I,
  });
  return { mesh, analysis };
}
