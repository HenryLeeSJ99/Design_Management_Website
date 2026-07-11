/**
 * @module formwork/slabFormwork
 * @description Slab formwork design engine.
 *
 * Pipeline:
 *   1. Area load  → computeSlabAreaLoad (universal module)
 *   2. Panel check  → compare bending from area load against panel capacity
 *   3. Secondary beam check → area load × secondary spacing = line load → beam analysis
 *   4. Primary beam check → secondary reactions as point loads → beam analysis
 *   5. Shoring check → max primary reaction vs tower capacity
 */

import { computeSlabAreaLoad } from '../loads/slabLoad.js';
import { solveBeam } from '../beam/solver.js';
import { getFormworkBeam, getFormworkPanel, getShoringTower } from '../materials/formworkBeams.js';

/**
 * @typedef {Object} SlabFormworkInput
 * @property {number} slabThickness     - mm
 * @property {number} concreteDensity   - kN/m³
 * @property {string} panelType         - e.g. 'WONDERBoard MG Series'
 * @property {string} panelThickness    - e.g. '12 mm'
 * @property {string} panelDirection    - 'Perpendicular to Secondary Beam' | 'Parallel to Secondary Beam'
 * @property {string} secondaryBeamType - e.g. 'WONDERBeam Alpha-Beam'
 * @property {number} secondarySpacing  - m (center-to-center)
 * @property {number} secondarySpanCount - 1–5 (number of continuous spans)
 * @property {string} primaryBeamType   - e.g. 'WONDERBeam Alpha-Beam'
 * @property {number} primarySpacing    - m (center-to-center)
 * @property {number} primarySpanCount  - 1–5 (number of continuous spans)
 * @property {string} shoringType       - e.g. 'WonderCrab M'
 * @property {number} towerHeight       - m
 * @property {number} deflLimitRatio    - e.g. 360
 */

/**
 * Run the full slab formwork design check pipeline.
 *
 * @param {SlabFormworkInput} input
 * @returns {Object} Structured results for every component.
 */
export function calculateSlabFormwork(input) {
  const {
    slabThickness,
    concreteDensity,
    panelType,
    panelThickness,
    panelSpanCount = 1,
    secondaryBeamType,
    secondarySpacing,
    secondarySpanCount = 1,
    primaryBeamType,
    primarySpacing,
    primarySpanCount = 1,
    shoringType,
    towerHeight,
    deflLimitRatio = 360,
  } = input;

  // ── 1. Area Load ──
  const areaLoad = computeSlabAreaLoad(slabThickness, concreteDensity);

  // ── 2. Panel Check ──
  const panelData = getFormworkPanel(panelType, panelThickness);
  const panelResult = checkPanel(areaLoad, panelData, secondarySpacing, panelSpanCount, deflLimitRatio);

  // ── 3. Secondary Beam Check ──
  const secondaryBeam = getFormworkBeam(secondaryBeamType);
  const secondaryResult = checkBeam(
    areaLoad.totalAreaLoad,
    secondarySpacing,     // tributary width = secondary spacing
    primarySpacing * 1000, // span length in mm
    secondarySpanCount,
    secondaryBeam,
    deflLimitRatio,
    'secondary',
  );

  // ── 4. Primary Beam Check ──
  const primaryBeam = getFormworkBeam(primaryBeamType);
  const primaryResult = checkPrimaryBeam(
    secondaryResult,
    secondarySpacing,
    primarySpacing,
    primarySpanCount,
    primaryBeam,
    deflLimitRatio,
    towerHeight,
    input,
  );

  // ── 5. Shoring Tower Check ──
  const tower = getShoringTower(shoringType);
  const towerResult = checkTower(primaryResult, tower, towerHeight);

  // ── Overall ──
  const overallPass =
    panelResult.pass &&
    secondaryResult.pass &&
    primaryResult.pass &&
    towerResult.pass;

  const maxUtilization = Math.max(
    panelResult.utilization,
    secondaryResult.maxUtilization,
    primaryResult.maxUtilization,
    towerResult.utilization,
  );

  return {
    areaLoad,
    panel: panelResult,
    secondary: secondaryResult,
    primary: primaryResult,
    tower: towerResult,
    overallPass,
    maxUtilization: round(maxUtilization, 4),
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Panel check
// ────────────────────────────────────────────────────────────────────────────

function checkPanel(areaLoad, panelData, secondarySpacing_m, spanCount, deflLimitRatio) {
  if (!panelData) {
    return {
      pass: false,
      utilization: 999,
      applied: 0,
      capacity: 0,
      note: 'Panel data not found',
    };
  }

  // Panel spanning across secondary beams
  const spanLength_mm = secondarySpacing_m * 1000;
  const w = areaLoad.totalAreaLoad; // kN/m² → kN/m per metre strip

  const spans = [];
  const supports = [];

  for (let i = 0; i < spanCount; i++) {
    spans.push(spanLength_mm);
  }

  // Continuous supports
  supports.push({ type: 'pin' });
  for (let i = 0; i < spanCount - 1; i++) {
    supports.push({ type: 'roller' });
  }
  supports.push({ type: 'roller' });

  const elementLoads = spans.map(() => w);
  const nodalLoads = supports.map(() => 0);

  const E = panelData.E;
  const I = panelData.I_per_m; // cm^4/m

  const analysis = solveBeam({
    spans,
    supports,
    nodalLoads,
    elementLoads,
    E,
    I,
  });

  const absMoment = Math.abs(analysis.maxMoment.value);
  const M_capacity = panelData.Mallow_per_m;
  const bendingRatio = M_capacity > 0 ? absMoment / M_capacity : 999;

  const absDefl = Math.abs(analysis.maxDeflection.value);
  const deflAllow = spanLength_mm / deflLimitRatio;
  const deflRatio = deflAllow > 0 ? absDefl / deflAllow : 999;

  const maxUtil = Math.max(bendingRatio, deflRatio);

  return {
    component: 'Formwork Panel',
    pass: maxUtil <= 1.0,
    utilization: round(maxUtil, 4),
    applied: round(absMoment, 3),
    capacity: round(M_capacity, 3),
    unit: 'kNm/m',
    checkType: 'Bending',
    panelWeight: panelData.weight,
    bending: {
      applied: round(absMoment, 3),
      capacity: M_capacity,
      ratio: round(bendingRatio, 4),
      pass: bendingRatio <= 1.0,
    },
    deflection: {
      actual: round(absDefl, 2),
      allowable: round(deflAllow, 2),
      ratio: round(deflRatio, 4),
      pass: deflRatio <= 1.0,
    },
    analysis,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Beam check (secondary)
// ────────────────────────────────────────────────────────────────────────────

function checkBeam(totalAreaLoad, tributaryWidth_m, spanLength_mm, spanCount, beam, deflLimitRatio, label) {
  if (!beam) {
    return {
      component: label === 'secondary' ? 'Secondary Beam' : 'Primary Beam',
      pass: false,
      maxUtilization: 999,
      bending: { ratio: 999, pass: false },
      shear: { ratio: 999, pass: false },
      deflection: { ratio: 999, pass: false },
      note: 'Beam data not found',
    };
  }

  // Line load on beam (kN/m)
  const w_kNm = totalAreaLoad * tributaryWidth_m + beam.weight;

  // Build multi-span beam model
  const spans = [];
  const supports = [];

  for (let i = 0; i < spanCount; i++) {
    spans.push(spanLength_mm);
  }

  // Supports: pin at start, then rollers (continuous supports)
  supports.push({ type: 'pin' });
  for (let i = 0; i < spanCount - 1; i++) {
    supports.push({ type: 'roller' }); // intermediate supports
  }
  supports.push({ type: 'roller' }); // end support

  // Element loads: same UDL on all spans (kN/m = N/mm since units match)
  const elementLoads = spans.map(() => w_kNm);
  const nodalLoads = supports.map(() => 0);

  // Convert beam properties
  const E = beam.E;
  const I = beam.I;

  const analysis = solveBeam({
    spans,
    supports,
    nodalLoads,
    elementLoads,
    E,
    I,
  });

  // Design checks against manufacturer's allowable values
  const absMoment = Math.abs(analysis.maxMoment.value);
  const absShear = Math.abs(analysis.maxShear.value);
  const absDefl = Math.abs(analysis.maxDeflection.value);

  const bendingRatio = beam.Mallow > 0 ? absMoment / beam.Mallow : 999;
  const shearRatio = beam.Vallow > 0 ? absShear / beam.Vallow : 999;

  // Deflection: check per span
  const deflAllow = spanLength_mm / deflLimitRatio;
  const deflRatio = deflAllow > 0 ? absDefl / deflAllow : 999;

  const maxUtil = Math.max(bendingRatio, shearRatio, deflRatio);

  return {
    component: label === 'secondary' ? 'Secondary Beam' : 'Primary Beam',
    pass: bendingRatio <= 1.0 && shearRatio <= 1.0 && deflRatio <= 1.0,
    maxUtilization: round(maxUtil, 4),
    lineLoad: round(w_kNm, 3),
    spanLength: spanLength_mm,
    spanCount,
    bending: {
      applied: round(absMoment, 3),
      capacity: beam.Mallow,
      ratio: round(bendingRatio, 4),
      pass: bendingRatio <= 1.0,
    },
    shear: {
      applied: round(absShear, 3),
      capacity: beam.Vallow,
      ratio: round(shearRatio, 4),
      pass: shearRatio <= 1.0,
    },
    deflection: {
      actual: round(absDefl, 2),
      allowable: round(deflAllow, 2),
      ratio: round(deflRatio, 4),
      pass: deflRatio <= 1.0,
    },
    reactions: analysis.reactions,
    maxReaction: round(Math.max(...analysis.reactions.map(r => Math.abs(r.value))), 3),
    analysis, // full analysis for diagram rendering if needed
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Primary beam check
// ────────────────────────────────────────────────────────────────────────────

function checkPrimaryBeam(secondaryResult, secondarySpacing_m, primarySpacing_m, primarySpanCount, beam, deflLimitRatio, towerHeight) {
  if (!beam) {
    return {
      component: 'Primary Beam',
      pass: false,
      maxUtilization: 999,
      bending: { ratio: 999, pass: false },
      shear: { ratio: 999, pass: false },
      deflection: { ratio: 999, pass: false },
      note: 'Beam data not found',
    };
  }

  // The primary beam receives secondary beam reactions as point loads.
  // For simplicity, we model the primary beam with an equivalent UDL
  // derived from the secondary beam reactions spread over the tributary width.
  //
  // Equivalent UDL on primary beam = max secondary reaction / secondary spacing
  // This is a conservative approximation.
  const secondaryReaction = secondaryResult.maxReaction || 0;
  const w_kNm = (secondaryReaction / secondarySpacing_m) + beam.weight;

  // Span length of primary beam = tower grid spacing (assumed same as primary spacing for now)
  // In a real system, the primary beam spans between shoring towers
  const spanLength_mm = primarySpacing_m * 1000;

  // Build multi-span model
  const spans = [];
  const supports = [];

  for (let i = 0; i < primarySpanCount; i++) {
    spans.push(spanLength_mm);
  }

  supports.push({ type: 'pin' });
  for (let i = 0; i < primarySpanCount - 1; i++) {
    supports.push({ type: 'roller' });
  }
  supports.push({ type: 'roller' });

  const elementLoads = spans.map(() => w_kNm);
  const nodalLoads = supports.map(() => 0);

  const E = beam.E;
  const I = beam.I;

  const analysis = solveBeam({
    spans,
    supports,
    nodalLoads,
    elementLoads,
    E,
    I,
  });

  const absMoment = Math.abs(analysis.maxMoment.value);
  const absShear = Math.abs(analysis.maxShear.value);
  const absDefl = Math.abs(analysis.maxDeflection.value);

  const bendingRatio = beam.Mallow > 0 ? absMoment / beam.Mallow : 999;
  const shearRatio = beam.Vallow > 0 ? absShear / beam.Vallow : 999;
  const deflAllow = spanLength_mm / deflLimitRatio;
  const deflRatio = deflAllow > 0 ? absDefl / deflAllow : 999;

  const maxUtil = Math.max(bendingRatio, shearRatio, deflRatio);

  return {
    component: 'Primary Beam',
    pass: bendingRatio <= 1.0 && shearRatio <= 1.0 && deflRatio <= 1.0,
    maxUtilization: round(maxUtil, 4),
    lineLoad: round(w_kNm, 3),
    spanLength: spanLength_mm,
    spanCount: primarySpanCount,
    bending: {
      applied: round(absMoment, 3),
      capacity: beam.Mallow,
      ratio: round(bendingRatio, 4),
      pass: bendingRatio <= 1.0,
    },
    shear: {
      applied: round(absShear, 3),
      capacity: beam.Vallow,
      ratio: round(shearRatio, 4),
      pass: shearRatio <= 1.0,
    },
    deflection: {
      actual: round(absDefl, 2),
      allowable: round(deflAllow, 2),
      ratio: round(deflRatio, 4),
      pass: deflRatio <= 1.0,
    },
    reactions: analysis.reactions,
    maxReaction: round(Math.max(...analysis.reactions.map(r => Math.abs(r.value))), 3),
    analysis,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Shoring tower check
// ────────────────────────────────────────────────────────────────────────────

function checkTower(primaryResult, tower, towerHeight_m) {
  if (!tower) {
    return {
      component: 'Shoring Tower',
      pass: false,
      utilization: 999,
      applied: 0,
      capacity: 0,
      note: 'Tower data not found',
    };
  }

  // Max reaction from primary beam = load on one tower
  const maxReaction = primaryResult.maxReaction || 0;
  // Add tower self-weight
  const towerSelfWeight = tower.selfWeight * towerHeight_m;
  const totalLoad = maxReaction + towerSelfWeight;

  const utilization = tower.towerCapacity > 0 ? totalLoad / tower.towerCapacity : 999;

  return {
    component: 'Shoring Tower',
    pass: utilization <= 1.0,
    utilization: round(utilization, 4),
    applied: round(totalLoad, 3),
    capacity: tower.towerCapacity,
    unit: 'kN',
    checkType: 'Axial Load',
    maxReaction: round(maxReaction, 3),
    towerSelfWeight: round(towerSelfWeight, 3),
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Utility
// ────────────────────────────────────────────────────────────────────────────

function round(v, n) {
  const f = Math.pow(10, n);
  return Math.round(v * f) / f;
}
