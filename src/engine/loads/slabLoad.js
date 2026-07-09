/**
 * @module loads/slabLoad
 * @description Universal area load calculator for slab formwork.
 *
 * Computes the total design area load (kN/m²) on formwork based on slab
 * thickness and concrete density. This is a shared module used by all
 * formwork calculators.
 *
 * Load tiers:
 *   1) t ≤ 300 mm   → γ·(t/1000) + 1.5 kN/m²
 *   2) 300 < t ≤ 700 → γ·(t/1000) + 0.75 + 10 % of concrete weight
 *   3) t > 700 mm   → γ·(t/1000) + 2.5 kN/m²
 */

/**
 * @typedef {Object} SlabAreaLoadResult
 * @property {number} concreteWeight  - Self-weight of concrete slab (kN/m²).
 * @property {number} formworkLoad    - Additional formwork / construction load (kN/m²).
 * @property {number} totalAreaLoad   - Total design area load (kN/m²).
 * @property {string} tier            - Which load tier was applied ('≤300', '300–700', '>700').
 */

/**
 * Compute the total design area load on slab formwork.
 *
 * @param {number} slabThickness_mm - Slab thickness in mm.
 * @param {number} concreteDensity  - Unit weight of concrete in kN/m³ (typically 25).
 * @returns {SlabAreaLoadResult}
 */
export function computeSlabAreaLoad(slabThickness_mm, concreteDensity = 25) {
  const t = Number(slabThickness_mm);
  const gamma = Number(concreteDensity);

  // Concrete self-weight (kN/m²) = density × thickness in metres
  const concreteWeight = gamma * (t / 1000);

  let formworkLoad;
  let tier;

  if (t <= 300) {
    // Tier 1: lighter slabs – 1.5 kN/m² construction load
    formworkLoad = 1.5;
    tier = '≤300';
  } else if (t <= 700) {
    // Tier 2: medium slabs – 0.75 kN/m² + 10 % of concrete weight
    formworkLoad = 0.75 + 0.10 * concreteWeight;
    tier = '300–700';
  } else {
    // Tier 3: thick slabs – 2.5 kN/m² construction load
    formworkLoad = 2.5;
    tier = '>700';
  }

  const totalAreaLoad = concreteWeight + formworkLoad;

  return {
    concreteWeight: round(concreteWeight, 3),
    formworkLoad: round(formworkLoad, 3),
    totalAreaLoad: round(totalAreaLoad, 3),
    tier,
  };
}

/** Round to n decimal places. */
function round(v, n) {
  const f = Math.pow(10, n);
  return Math.round(v * f) / f;
}
