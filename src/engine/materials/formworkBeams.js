/**
 * @module materials/formworkBeams
 * @description Proprietary / system formwork beams (shared with the Multi
 * Beam calculator via sections.js), panels and shoring towers with
 * manufacturer-published capacities for temporary works design.
 *
 * Units:
 *   - E: MPa (N/mm²)
 *   - I: cm⁴
 *   - Mallow: kNm  (allowable bending moment)
 *   - Vallow: kN   (allowable shear force)
 *   - weight: kN/m (self-weight)
 */

import { SECTIONS } from './sections.js';

// ────────────────────────────────────────────────────────────────────────────
// Formwork beam catalogue
// ────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} FormworkBeam
 * @property {string} name
 * @property {string} company - System provider (e.g. 'PLYTEC', 'Doka')
 * @property {number} E       - Modulus of elasticity (MPa)
 * @property {number} I       - Second moment of area (cm⁴)
 * @property {number} Mallow  - Allowable bending moment (kNm)
 * @property {number} Vallow  - Allowable shear force (kN)
 * @property {number} weight  - Self-weight (kN/m)
 */

/**
 * Derived from the shared system-beam library (sections.js) so the slab
 * formwork checks use exactly the same manufacturer capacities as the
 * Multi Beam Span calculator — single source of truth.
 * @type {Object<string, FormworkBeam>}
 */
export const FORMWORK_BEAMS = Object.fromEntries(
  (SECTIONS['System Beam'] || []).map((s) => [s.name, {
    name: s.name,
    company: s.company,
    E: s.E,               // MPa
    I: s.Iy,              // cm⁴ (back-solved so E·Iy reproduces published EI)
    Mallow: s.Mallow,     // kNm (manufacturer permissible)
    Vallow: s.Vallow,     // kN  (manufacturer permissible)
    weight: round3(s.mass * 9.80665 / 1000), // kN/m from kg/m
  }])
);

/** Legacy display names from the old standalone catalogue → shared library names */
const LEGACY_BEAM_ALIASES = {
  'WONDERBeam Alpha-Beam': 'Alpha-Beam',
  'Timber H20 Beam': 'H20',
  'Aluminium Joist': 'Alu-Beam 150H',
};

function round3(v) {
  return Math.round(v * 1000) / 1000;
}

// ────────────────────────────────────────────────────────────────────────────
// Formwork panel catalogue
// ────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} FormworkPanel
 * @property {string} name
 * @property {Object<string, PanelThicknessData>} thicknesses
 */

/**
 * @typedef {Object} PanelThicknessData
 * @property {number} thickness   - mm
 * @property {number} E           - Modulus of elasticity (MPa)
 * @property {number} I_per_m     - Second moment of area per metre width (cm⁴/m)
 * @property {number} Mallow_per_m - Allowable bending moment per metre width (kNm/m)
 * @property {number} weight      - Self-weight (kN/m²)
 * @property {number} maxSpan     - Max recommended span (mm)
 */

/** @type {Object<string, FormworkPanel>} */
export const FORMWORK_PANELS = {
  'WONDERBoard MG Series': {
    name: 'WONDERBoard MG Series',
    thicknesses: {
      '12 mm': { thickness: 12, E: 8000,  I_per_m: 14.4,  Mallow_per_m: 0.96, weight: 0.12, maxSpan: 400 },
      '15 mm': { thickness: 15, E: 8000,  I_per_m: 28.1,  Mallow_per_m: 1.50, weight: 0.15, maxSpan: 500 },
      '18 mm': { thickness: 18, E: 8000,  I_per_m: 48.6,  Mallow_per_m: 2.16, weight: 0.18, maxSpan: 600 },
    },
  },
  'Plywood 18 mm': {
    name: 'Plywood 18 mm',
    thicknesses: {
      '12 mm': { thickness: 12, E: 9500,  I_per_m: 14.4,  Mallow_per_m: 0.84, weight: 0.08, maxSpan: 350 },
      '15 mm': { thickness: 15, E: 9500,  I_per_m: 28.1,  Mallow_per_m: 1.31, weight: 0.10, maxSpan: 450 },
      '18 mm': { thickness: 18, E: 9500,  I_per_m: 48.6,  Mallow_per_m: 1.89, weight: 0.12, maxSpan: 550 },
    },
  },
  'Phenolic Board': {
    name: 'Phenolic Board',
    thicknesses: {
      '12 mm': { thickness: 12, E: 10000, I_per_m: 14.4,  Mallow_per_m: 1.08, weight: 0.10, maxSpan: 420 },
      '15 mm': { thickness: 15, E: 10000, I_per_m: 28.1,  Mallow_per_m: 1.69, weight: 0.13, maxSpan: 520 },
      '18 mm': { thickness: 18, E: 10000, I_per_m: 48.6,  Mallow_per_m: 2.43, weight: 0.16, maxSpan: 620 },
    },
  },
};

// ────────────────────────────────────────────────────────────────────────────
// Tie rod catalogue (wall formwork)
// ────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} TieRod
 * @property {string} name
 * @property {number} diameter - Nominal bar diameter (mm)
 * @property {number} capacity - Safe working load in tension (kN)
 */

/** @type {Object<string, TieRod>} */
export const TIE_RODS = {
  'DW15 Tie Rod (Ø15 mm)': {
    name: 'DW15 Tie Rod (Ø15 mm)',
    diameter: 15,
    capacity: 90,
  },
  'DW20 Tie Rod (Ø20 mm)': {
    name: 'DW20 Tie Rod (Ø20 mm)',
    diameter: 20,
    capacity: 150,
  },
  'DW26 Tie Rod (Ø26 mm)': {
    name: 'DW26 Tie Rod (Ø26 mm)',
    diameter: 26,
    capacity: 250,
  },
};

// ────────────────────────────────────────────────────────────────────────────
// Shoring tower catalogue
// ────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} ShoringTower
 * @property {string} name
 * @property {number} legCapacity   - Allowable load per leg (kN)
 * @property {number} numLegs       - Number of legs per tower
 * @property {number} towerCapacity - Total allowable load per tower (kN)
 * @property {number} selfWeight    - Approximate tower self-weight (kN/m height)
 */

/** @type {Object<string, ShoringTower>} */
export const SHORING_TOWERS = {
  'WonderCrab M': {
    name: 'WonderCrab M',
    legCapacity: 30,
    numLegs: 4,
    towerCapacity: 120,
    selfWeight: 0.35,
  },
  'Ringlock Tower': {
    name: 'Ringlock Tower',
    legCapacity: 25,
    numLegs: 4,
    towerCapacity: 100,
    selfWeight: 0.40,
  },
  'Frame Tower': {
    name: 'Frame Tower',
    legCapacity: 20,
    numLegs: 4,
    towerCapacity: 80,
    selfWeight: 0.30,
  },
};

// ────────────────────────────────────────────────────────────────────────────
// Utility
// ────────────────────────────────────────────────────────────────────────────

/**
 * Look up a formwork beam by name (legacy catalogue names are aliased
 * to their shared-library equivalents).
 * @param {string} name
 * @returns {FormworkBeam|undefined}
 */
export function getFormworkBeam(name) {
  return FORMWORK_BEAMS[name] || FORMWORK_BEAMS[LEGACY_BEAM_ALIASES[name]];
}

/**
 * Look up panel data by panel type and thickness.
 * @param {string} panelType
 * @param {string} thickness
 * @returns {PanelThicknessData|undefined}
 */
export function getFormworkPanel(panelType, thickness) {
  const panel = FORMWORK_PANELS[panelType];
  if (!panel) return undefined;
  return panel.thicknesses[thickness];
}

/**
 * Look up a shoring tower by name.
 * @param {string} name
 * @returns {ShoringTower|undefined}
 */
export function getShoringTower(name) {
  return SHORING_TOWERS[name];
}

/**
 * Look up a tie rod by name.
 * @param {string} name
 * @returns {TieRod|undefined}
 */
export function getTieRod(name) {
  return TIE_RODS[name];
}
