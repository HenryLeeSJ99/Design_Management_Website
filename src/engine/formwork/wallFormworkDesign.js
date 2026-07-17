/**
 * @module formwork/wallFormworkDesign
 * @description Wall formwork member design engine.
 *
 * Pipeline (single-sided face under fresh concrete pressure):
 *   1. Design pressure → taken as the CIRIA 108 Pmax (from the Concrete
 *      Pressure calculator) or entered directly, applied as a uniform
 *      envelope over the checked band of the form face (conservative).
 *   2. Wall panel check   → pressure on a 1 m strip spanning across the
 *      secondary beams (studs).
 *   3. Secondary beam check → pressure × stud spacing = line load, studs
 *      spanning across the primary beams (walers).
 *   4. Primary beam check → stud reactions as an equivalent UDL, walers
 *      spanning between tie rod positions.
 *   5. Tie rod check      → max waler reaction vs tie safe working load.
 */

import { solveBeam } from '../beam/solver.js';
import { getFormworkBeam, getFormworkPanel, getTieRod } from '../materials/formworkBeams.js';

/**
 * @typedef {Object} WallFormworkDesignInput
 * @property {number} designPressure    - kN/m² (CIRIA 108 Pmax or manual)
 * @property {string} panelType         - e.g. 'WONDERBoard MG Series'
 * @property {string} panelThickness    - e.g. '18 mm'
 * @property {number} panelSpanCount    - 1–3 (continuous spans over studs)
 * @property {string} secondaryBeamType - stud, e.g. 'H20' (shared system-beam library)
 * @property {number} secondarySpacing  - m (stud center-to-center)
 * @property {number} secondarySpanCount - 1–3 (continuous spans over walers)
 * @property {string} primaryBeamType   - waler (shared system-beam library)
 * @property {number} primaryMembers    - members per waler (1 = single, 2 = double)
 * @property {number} primarySpacing    - m (waler center-to-center)
 * @property {number} primarySpanCount  - 1–3 (continuous spans between ties)
 * @property {string} tieRodType        - e.g. 'DW15 Tie Rod (Ø15 mm)'
 * @property {number} tieSpacing        - m (tie center-to-center along waler)
 * @property {number} deflLimitRatio    - e.g. 360
 */

/**
 * Run the full wall formwork design check pipeline.
 *
 * @param {WallFormworkDesignInput} input
 * @returns {Object} Structured results for every component.
 */
export function calculateWallFormworkDesign(input) {
  const {
    designPressure,
    panelType,
    panelThickness,
    panelSpanCount = 3,
    secondaryBeamType,
    secondarySpacing,
    secondarySpanCount = 3,
    primaryBeamType,
    primaryMembers = 1,
    primarySpacing,
    primarySpanCount = 3,
    tieRodType,
    tieSpacing,
    deflLimitRatio = 360,
  } = input;

  const P = Number(designPressure);

  // ── 1. Panel Check ──
  // 1 m wide strip of the form face spanning across the studs.
  const panelData = getFormworkPanel(panelType, panelThickness);
  const panelResult = checkPanel(P, panelData, secondarySpacing, panelSpanCount, deflLimitRatio);

  // ── 2. Secondary Beam (Stud) Check ──
  const secondaryBeam = getFormworkBeam(secondaryBeamType);
  const secondaryResult = checkMember({
    w_kNm: P * Number(secondarySpacing),
    spanLength_mm: Number(primarySpacing) * 1000,
    spanCount: secondarySpanCount,
    beam: secondaryBeam,
    members: 1,
    deflLimitRatio,
    component: 'Secondary Beam (Stud)',
  });

  // ── 3. Primary Beam (Waler) Check ──
  // Stud reactions land on the waler; spread as an equivalent UDL over the
  // stud spacing (conservative), spanning between tie positions.
  const primaryBeam = getFormworkBeam(primaryBeamType);
  const secondaryReaction = secondaryResult.maxReaction || 0;
  const primaryResult = checkMember({
    w_kNm: secondaryReaction / Number(secondarySpacing),
    spanLength_mm: Number(tieSpacing) * 1000,
    spanCount: primarySpanCount,
    beam: primaryBeam,
    members: Number(primaryMembers) || 1,
    deflLimitRatio,
    component: 'Primary Beam (Waler)',
  });

  // ── 4. Tie Rod Check ──
  const tieResult = checkTieRod(primaryResult, getTieRod(tieRodType), P, tieSpacing, primarySpacing);

  // ── Overall ──
  const overallPass =
    panelResult.pass &&
    secondaryResult.pass &&
    primaryResult.pass &&
    tieResult.pass;

  const maxUtilization = Math.max(
    panelResult.utilization,
    secondaryResult.maxUtilization,
    primaryResult.maxUtilization,
    tieResult.utilization,
  );

  return {
    designPressure: round(P, 3),
    panel: panelResult,
    secondary: secondaryResult,
    primary: primaryResult,
    tie: tieResult,
    overallPass,
    maxUtilization: round(maxUtilization, 4),
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Panel check
// ────────────────────────────────────────────────────────────────────────────

function checkPanel(pressure, panelData, secondarySpacing_m, spanCount, deflLimitRatio) {
  if (!panelData) {
    return {
      component: 'Wall Panel',
      pass: false,
      utilization: 999,
      applied: 0,
      capacity: 0,
      note: 'Panel data not found',
      bending: { applied: 0, capacity: 0, ratio: 999, pass: false },
      deflection: { actual: 0, allowable: 0, ratio: 999, pass: false },
    };
  }

  const spanLength_mm = Number(secondarySpacing_m) * 1000;
  const w = pressure; // kN/m² → kN/m per metre strip

  const { spans, supports } = continuousModel(spanLength_mm, spanCount);

  const analysis = solveBeam({
    spans,
    supports,
    nodalLoads: supports.map(() => 0),
    elementLoads: spans.map(() => w),
    E: panelData.E,
    I: panelData.I_per_m,
  });

  const absMoment = Math.abs(analysis.maxMoment.value);
  const M_capacity = panelData.Mallow_per_m;
  const bendingRatio = M_capacity > 0 ? absMoment / M_capacity : 999;

  const absDefl = Math.abs(analysis.maxDeflection.value);
  const deflAllow = spanLength_mm / deflLimitRatio;
  const deflRatio = deflAllow > 0 ? absDefl / deflAllow : 999;

  const maxUtil = Math.max(bendingRatio, deflRatio);

  return {
    component: 'Wall Panel',
    pass: maxUtil <= 1.0,
    utilization: round(maxUtil, 4),
    applied: round(absMoment, 3),
    capacity: round(M_capacity, 3),
    unit: 'kNm/m',
    checkType: 'Bending',
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
// Member check (stud / waler)
// ────────────────────────────────────────────────────────────────────────────

function checkMember({ w_kNm, spanLength_mm, spanCount, beam, members, deflLimitRatio, component }) {
  if (!beam) {
    return {
      component,
      pass: false,
      maxUtilization: 999,
      bending: { ratio: 999, pass: false },
      shear: { ratio: 999, pass: false },
      deflection: { ratio: 999, pass: false },
      note: 'Beam data not found',
    };
  }

  // Multi-member walers (e.g. double H20) share the load equally, so
  // stiffness and manufacturer capacities scale by the member count.
  const n = Math.max(1, members);
  const w_total = w_kNm + beam.weight * n;

  const { spans, supports } = continuousModel(spanLength_mm, spanCount);

  const analysis = solveBeam({
    spans,
    supports,
    nodalLoads: supports.map(() => 0),
    elementLoads: spans.map(() => w_total),
    E: beam.E,
    I: beam.I * n,
  });

  const absMoment = Math.abs(analysis.maxMoment.value);
  const absShear = Math.abs(analysis.maxShear.value);
  const absDefl = Math.abs(analysis.maxDeflection.value);

  const Mallow = beam.Mallow * n;
  const Vallow = beam.Vallow * n;

  const bendingRatio = Mallow > 0 ? absMoment / Mallow : 999;
  const shearRatio = Vallow > 0 ? absShear / Vallow : 999;
  const deflAllow = spanLength_mm / deflLimitRatio;
  const deflRatio = deflAllow > 0 ? absDefl / deflAllow : 999;

  const maxUtil = Math.max(bendingRatio, shearRatio, deflRatio);

  return {
    component,
    pass: bendingRatio <= 1.0 && shearRatio <= 1.0 && deflRatio <= 1.0,
    maxUtilization: round(maxUtil, 4),
    lineLoad: round(w_total, 3),
    spanLength: spanLength_mm,
    spanCount,
    members: n,
    bending: {
      applied: round(absMoment, 3),
      capacity: round(Mallow, 3),
      ratio: round(bendingRatio, 4),
      pass: bendingRatio <= 1.0,
    },
    shear: {
      applied: round(absShear, 3),
      capacity: round(Vallow, 3),
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
// Tie rod check
// ────────────────────────────────────────────────────────────────────────────

function checkTieRod(primaryResult, tie, pressure, tieSpacing_m, primarySpacing_m) {
  if (!tie) {
    return {
      component: 'Tie Rod',
      pass: false,
      utilization: 999,
      applied: 0,
      capacity: 0,
      note: 'Tie rod data not found',
    };
  }

  // Tie tension = max waler reaction at a tie position (from the continuous
  // beam analysis, so continuity over interior ties is captured).
  const tieForce = primaryResult.maxReaction || 0;

  // Simple tributary-area figure for the report notes only.
  const tributaryForce = pressure * Number(tieSpacing_m) * Number(primarySpacing_m);

  const utilization = tie.capacity > 0 ? tieForce / tie.capacity : 999;

  return {
    component: 'Tie Rod',
    checkType: 'Tension',
    pass: utilization <= 1.0,
    utilization: round(utilization, 4),
    applied: round(tieForce, 3),
    capacity: tie.capacity,
    unit: 'kN',
    diameter: tie.diameter,
    tributaryForce: round(tributaryForce, 3),
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Utility
// ────────────────────────────────────────────────────────────────────────────

/** Pin + rollers continuous beam model with equal spans. */
function continuousModel(spanLength_mm, spanCount) {
  const spans = [];
  for (let i = 0; i < spanCount; i++) spans.push(spanLength_mm);

  const supports = [{ type: 'pin' }];
  for (let i = 0; i < spanCount - 1; i++) supports.push({ type: 'roller' });
  supports.push({ type: 'roller' });

  return { spans, supports };
}

function round(v, n) {
  const f = Math.pow(10, n);
  return Math.round(v * f) / f;
}
