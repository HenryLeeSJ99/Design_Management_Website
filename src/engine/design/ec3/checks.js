/**
 * @fileoverview Design checks per BS EN 1993-1-1 (Eurocode 3).
 *
 * Provides cross-section classification, bending resistance, shear
 * resistance, bending–shear interaction, deflection verification, and
 * a combined "perform all checks" entry-point for formwork beam design.
 *
 * All input/output forces use kN / kNm; deflections and spans in mm.
 *
 * @module ec3-checks
 */

import { STEEL_GRADES } from '../../materials/sections.js';

// ────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ────────────────────────────────────────────────────────────────────────────

/**
 * Compute the ε factor used throughout the classification tables.
 * ε = √(235 / fy)
 *
 * @param {number} fy - Yield strength in MPa.
 * @returns {number}
 */
function calcEpsilon(fy) {
  return Math.sqrt(235 / fy);
}

/**
 * Resolve a steel grade name to its properties, throwing on unknown grades.
 *
 * @param {string} gradeName
 * @returns {import('../../materials/sections.js').SteelGrade}
 */
function resolveGrade(gradeName) {
  const grade = STEEL_GRADES[gradeName];
  if (!grade) {
    throw new Error(`Unknown steel grade "${gradeName}". Available: ${Object.keys(STEEL_GRADES).join(', ')}`);
  }
  return grade;
}

// ────────────────────────────────────────────────────────────────────────────
// Cross-section classification  (BS EN 1993-1-1 Table 5.2)
// ────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} ClassificationResult
 * @property {1|2|3|4} sectionClass - Overall cross-section class (worst of flange & web).
 * @property {Object}  details
 * @property {number}  details.epsilon      - ε = √(235/fy)
 * @property {number}  [details.flangeRatio] - c/t ratio of the flange (I-sections only).
 * @property {number}  [details.webRatio]    - c/t ratio of the web (I-sections only).
 * @property {number}  [details.wallRatio]   - c/t ratio of the wall (hollow sections only).
 * @property {1|2|3|4} [details.flangeClass] - Class of the flange (I-sections only).
 * @property {1|2|3|4} [details.webClass]    - Class of the web (I-sections only).
 * @property {1|2|3|4} [details.wallClass]   - Class of the wall (hollow sections only).
 */

/**
 * Classify a cross-section according to BS EN 1993-1-1 Table 5.2.
 *
 * For I-sections the flange outstand and web in bending are checked
 * independently; the overall class is the worse of the two.
 *
 * For hollow sections a simplified flat-wall check is used.
 *
 * @param {import('../../materials/sections.js').SectionProperties} section
 * @param {string} gradeName - Key into `STEEL_GRADES`.
 * @returns {ClassificationResult}
 */
export function classifySection(section, gradeName) {
  const { fy } = resolveGrade(gradeName);
  const epsilon = calcEpsilon(fy);

  if (section.type === 'I') {
    return classifyISection(section, epsilon);
  }
  return classifyHollowSection(section, epsilon);
}

/**
 * Classify an I-section (flange outstand + web in pure bending).
 * @private
 */
function classifyISection(section, epsilon) {
  const { h, b, tw, tf, r } = section;

  // ── Flange outstand (Table 5.2, sheet 2) ──
  const flangeC = (b / 2 - tw / 2 - r);
  const flangeRatio = flangeC / tf;
  let flangeClass;
  if (flangeRatio <= 9 * epsilon) {
    flangeClass = 1;
  } else if (flangeRatio <= 10 * epsilon) {
    flangeClass = 2;
  } else if (flangeRatio <= 14 * epsilon) {
    flangeClass = 3;
  } else {
    flangeClass = 4;
  }

  // ── Web in bending (Table 5.2, sheet 1) ──
  const webC = (h - 2 * tf - 2 * r);
  const webRatio = webC / tw;
  let webClass;
  if (webRatio <= 72 * epsilon) {
    webClass = 1;
  } else if (webRatio <= 83 * epsilon) {
    webClass = 2;
  } else if (webRatio <= 124 * epsilon) {
    webClass = 3;
  } else {
    webClass = 4;
  }

  const sectionClass = /** @type {1|2|3|4} */ (Math.max(flangeClass, webClass));

  return {
    sectionClass,
    details: {
      epsilon,
      flangeRatio,
      flangeClass,
      webRatio,
      webClass
    }
  };
}

/**
 * Classify a hollow section (SHS / RHS) using a simplified flat-wall check.
 * c/t = (h − 3·t) / t   (Table 5.2, sheet 1 – internal part in bending).
 * @private
 */
function classifyHollowSection(section, epsilon) {
  const { h, tf } = section;

  const wallC = (h - 3 * tf);
  const wallRatio = wallC / tf;
  let wallClass;
  if (wallRatio <= 72 * epsilon) {
    wallClass = 1;
  } else if (wallRatio <= 83 * epsilon) {
    wallClass = 2;
  } else if (wallRatio <= 124 * epsilon) {
    wallClass = 3;
  } else {
    wallClass = 4;
  }

  return {
    sectionClass: /** @type {1|2|3|4} */ (wallClass),
    details: {
      epsilon,
      wallRatio,
      wallClass
    }
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Bending resistance  (§6.2.5)
// ────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} BendingCheckResult
 * @property {number}  Mc_Rd - Design bending resistance (kNm).
 * @property {number}  ratio - M_Ed / M_c,Rd  (utilisation ratio).
 * @property {boolean} pass  - `true` if ratio ≤ 1.0.
 */

/**
 * Check bending resistance per BS EN 1993-1-1 §6.2.5.
 *
 * - Class 1 or 2: Mc,Rd = Wpl,y · fy / γM0
 * - Class 3:      Mc,Rd = Wel,y · fy / γM0
 * - Class 4 is flagged but uses elastic modulus as a conservative fallback.
 *
 * @param {number} Med - Design bending moment (kNm), absolute value used.
 * @param {import('../../materials/sections.js').SectionProperties} section
 * @param {string} gradeName
 * @returns {BendingCheckResult}
 */
export function checkBending(Med, section, gradeName) {
  const grade = resolveGrade(gradeName);
  const { fy, gammaM0 } = grade;
  const classification = classifySection(section, gradeName);
  const sectionClass = classification.sectionClass;

  // Pick the appropriate section modulus (cm³)
  const W = (sectionClass <= 2) ? section.Wpl_y : section.Wel_y;

  // Convert: W (cm³) → mm³  (* 1e3),  result Nmm → kNm (/ 1e6)
  const Mc_Rd = (W * 1e3) * fy / gammaM0 / 1e6;

  const absMed = Math.abs(Med);
  const ratio = Mc_Rd > 0 ? absMed / Mc_Rd : Infinity;

  return {
    Mc_Rd: roundTo(Mc_Rd, 3),
    ratio: roundTo(ratio, 4),
    pass: ratio <= 1.0
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Shear resistance  (§6.2.6)
// ────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} ShearCheckResult
 * @property {number}  Vc_Rd - Design shear resistance (kN).
 * @property {number}  ratio - V_Ed / V_c,Rd  (utilisation ratio).
 * @property {boolean} pass  - `true` if ratio ≤ 1.0.
 */

/**
 * Check plastic shear resistance per BS EN 1993-1-1 §6.2.6.
 *
 * Vc,Rd = Av · (fy / √3) / γM0
 *
 * @param {number} Ved - Design shear force (kN), absolute value used.
 * @param {import('../../materials/sections.js').SectionProperties} section
 * @param {string} gradeName
 * @returns {ShearCheckResult}
 */
export function checkShear(Ved, section, gradeName) {
  const grade = resolveGrade(gradeName);
  const { fy, gammaM0 } = grade;

  // Av in cm² → mm² (* 100);  result in N → kN (/ 1000)
  const Vc_Rd = (section.Av * 100) * (fy / Math.sqrt(3)) / gammaM0 / 1000;

  const absVed = Math.abs(Ved);
  const ratio = Vc_Rd > 0 ? absVed / Vc_Rd : Infinity;

  return {
    Vc_Rd: roundTo(Vc_Rd, 3),
    ratio: roundTo(ratio, 4),
    pass: ratio <= 1.0
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Bending–shear interaction  (§6.2.8)
// ────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} InteractionResult
 * @property {boolean} interactionRequired - `true` if V_Ed > 0.5 V_c,Rd.
 * @property {number}  Mc_Rd              - Full bending resistance (kNm).
 * @property {number}  reducedMcRd        - Reduced bending resistance (kNm) if interaction applies, else equals Mc_Rd.
 * @property {number}  rho                - Shear reduction factor ρ (0 when no interaction).
 * @property {number}  ratio              - M_Ed / reduced M_c,Rd.
 * @property {boolean} pass               - `true` if ratio ≤ 1.0.
 */

/**
 * Check bending–shear interaction per BS EN 1993-1-1 §6.2.8.
 *
 * When V_Ed > 0.5 V_c,Rd the bending resistance is reduced.
 * For I-sections the reduction removes the web contribution proportional
 * to the shear utilisation.
 *
 * @param {number} Med - Design bending moment (kNm).
 * @param {number} Ved - Design shear force (kN).
 * @param {import('../../materials/sections.js').SectionProperties} section
 * @param {string} gradeName
 * @returns {InteractionResult}
 */
export function checkBendingShearInteraction(Med, Ved, section, gradeName) {
  const grade = resolveGrade(gradeName);
  const { fy, gammaM0 } = grade;

  const bendingResult = checkBending(Med, section, gradeName);
  const shearResult = checkShear(Ved, section, gradeName);
  const classification = classifySection(section, gradeName);

  const Mc_Rd = bendingResult.Mc_Rd;
  const Vc_Rd = shearResult.Vc_Rd;
  const absVed = Math.abs(Ved);
  const absMed = Math.abs(Med);

  // No interaction required when V_Ed ≤ 0.5 V_c,Rd
  if (absVed <= 0.5 * Vc_Rd) {
    const ratio = Mc_Rd > 0 ? absMed / Mc_Rd : Infinity;
    return {
      interactionRequired: false,
      Mc_Rd,
      reducedMcRd: Mc_Rd,
      rho: 0,
      ratio: roundTo(ratio, 4),
      pass: ratio <= 1.0
    };
  }

  // ρ = (2·V_Ed / V_c,Rd − 1)²   (§6.2.8(3))
  const rho = Math.pow(2 * absVed / Vc_Rd - 1, 2);

  let reducedMcRd;

  if (section.type === 'I') {
    // Simplified: reduced Wpl = Wpl_y − ρ · Aw² / (4·tw)
    // where Aw = hw · tw  (hw ≈ h − 2·tf)
    const hw = section.h - 2 * section.tf;
    const Aw = hw * section.tw;                       // mm²
    const sectionClass = classification.sectionClass;
    const W = (sectionClass <= 2) ? section.Wpl_y : section.Wel_y;  // cm³
    const W_mm3 = W * 1e3;                            // mm³

    const reducedW_mm3 = W_mm3 - rho * (Aw * Aw) / (4 * section.tw);
    reducedMcRd = reducedW_mm3 * fy / gammaM0 / 1e6;  // kNm
  } else {
    // Hollow sections: apply ρ reduction directly to moment capacity
    reducedMcRd = Mc_Rd * (1 - rho);
  }

  // Ensure the reduced capacity is not negative
  reducedMcRd = Math.max(reducedMcRd, 0);

  const ratio = reducedMcRd > 0 ? absMed / reducedMcRd : Infinity;

  return {
    interactionRequired: true,
    Mc_Rd,
    reducedMcRd: roundTo(reducedMcRd, 3),
    rho: roundTo(rho, 4),
    ratio: roundTo(ratio, 4),
    pass: ratio <= 1.0
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Deflection check  (serviceability)
// ────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} DeflectionCheckResult
 * @property {number}  allowable - Allowable deflection (mm).
 * @property {number}  actual    - Actual deflection (mm).
 * @property {number}  ratio     - actual / allowable.
 * @property {boolean} pass      - `true` if ratio ≤ 1.0.
 */

/**
 * Check deflection against a span / limit ratio.
 *
 * Common limit ratios:
 * - L/250  (general)
 * - L/360  (formwork / concrete finish)
 * - L/500  (tight tolerance)
 *
 * @param {number} deflection  - Maximum deflection (mm), absolute value used.
 * @param {number} spanLength  - Span length (mm).
 * @param {number} limitRatio  - Denominator of the span/deflection limit (e.g. 360).
 * @returns {DeflectionCheckResult}
 */
export function checkDeflection(deflection, spanLength, limitRatio) {
  const allowable = spanLength / limitRatio;
  const absDefl = Math.abs(deflection);
  const ratio = allowable > 0 ? absDefl / allowable : Infinity;

  return {
    allowable: roundTo(allowable, 2),
    actual: roundTo(absDefl, 2),
    ratio: roundTo(ratio, 4),
    pass: ratio <= 1.0
  };
}

// ────────────────────────────────────────────────────────────────────────────
// System beam check  (manufacturer's allowable values)
// ────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} SystemBeamCheckResult
 * @property {{ratio: number, pass: boolean}} bendingCheck
 * @property {{ratio: number, pass: boolean}} shearCheck
 * @property {{ratio: number, pass: boolean}} deflectionCheck
 */

/**
 * Check a proprietary / system beam against the manufacturer's published
 * allowable moment, shear, and deflection limits.
 *
 * @param {number} Med            - Design bending moment (kNm).
 * @param {number} Ved            - Design shear force (kN).
 * @param {number} deflection     - Maximum deflection (mm).
 * @param {number} spanLength     - Span length (mm).
 * @param {number} Mallow         - Manufacturer's allowable moment (kNm).
 * @param {number} Vallow         - Manufacturer's allowable shear (kN).
 * @param {number} deflLimitRatio - Deflection limit ratio denominator.
 * @returns {SystemBeamCheckResult}
 */
export function checkSystemBeam(Med, Ved, deflection, spanLength, Mallow, Vallow, deflLimitRatio) {
  const absMed = Math.abs(Med);
  const absVed = Math.abs(Ved);

  const bendingRatio = Mallow > 0 ? absMed / Mallow : Infinity;
  const shearRatio = Vallow > 0 ? absVed / Vallow : Infinity;

  const deflResult = checkDeflection(deflection, spanLength, deflLimitRatio);

  return {
    bendingCheck: {
      ratio: roundTo(bendingRatio, 4),
      pass: bendingRatio <= 1.0
    },
    shearCheck: {
      ratio: roundTo(shearRatio, 4),
      pass: shearRatio <= 1.0
    },
    deflectionCheck: {
      ratio: deflResult.ratio,
      pass: deflResult.pass
    }
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Combined check entry-point
// ────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} SolverResults
 * @property {number} maxMoment    - Maximum bending moment from solver (kNm).
 * @property {number} maxShear     - Maximum shear force from solver (kN).
 * @property {number} maxDeflection - Maximum deflection from solver (mm).
 * @property {number} spanLength   - Span length used in analysis (mm).
 */

/**
 * @typedef {Object} SystemCapacities
 * @property {number} Mallow - Manufacturer's allowable moment (kNm).
 * @property {number} Vallow - Manufacturer's allowable shear (kN).
 */

/**
 * @typedef {Object} AllChecksResult
 * @property {ClassificationResult}                   classification - Section class info (EC3 mode only).
 * @property {BendingCheckResult|null}                bending        - Bending check (EC3 mode).
 * @property {ShearCheckResult|null}                  shear          - Shear check (EC3 mode).
 * @property {InteractionResult|null}                 interaction    - Bending–shear interaction (EC3 mode).
 * @property {DeflectionCheckResult}                  deflection     - Deflection check.
 * @property {SystemBeamCheckResult|null}             systemBeam     - System beam results (system mode only).
 * @property {boolean}                                overallPass    - `true` if every individual check passes.
 */

/**
 * Run the complete suite of design checks on a beam.
 *
 * In **EC3 mode** (default) the standard Eurocode cross-section checks are
 * used.  In **system-beam mode** (`isSystemBeam = true`) the manufacturer's
 * published allowable capacities are checked instead.
 *
 * @param {SolverResults} results          - Envelope forces / deflections from the solver.
 * @param {import('../../materials/sections.js').SectionProperties} section - Section properties.
 * @param {string}        gradeName        - Steel grade key (e.g. 'S355').
 * @param {number}        deflLimitRatio   - Deflection limit denominator (e.g. 360).
 * @param {boolean}       [isSystemBeam=false] - Use manufacturer's capacities instead of EC3.
 * @param {SystemCapacities} [systemCapacities] - Required when `isSystemBeam` is `true`.
 * @returns {AllChecksResult}
 */
export function performAllChecks(
  results,
  section,
  gradeName,
  deflLimitRatio,
  isSystemBeam = false,
  systemCapacities = null
) {
  const { maxMoment, maxShear, spans: internalSpans, physicalSpans } = results;

  const maxMomentVal = maxMoment.value;
  const maxShearVal = maxShear.value;

  // ── Deflection (per physical span) ──
  let worstDeflectionResult = { allowable: Infinity, actual: 0, ratio: 0, pass: true };
  
  if (physicalSpans && physicalSpans.length > 0) {
    let currentX = 0;
    for (const pSpan of physicalSpans) {
      const startX = currentX;
      const endX = currentX + pSpan.length;
      
      let maxDeflInSpan = 0;
      for (const elem of internalSpans) {
        for (const pt of elem.points) {
          if (pt.x >= startX - 1e-5 && pt.x <= endX + 1e-5) {
            if (Math.abs(pt.deflection) > Math.abs(maxDeflInSpan)) {
              maxDeflInSpan = pt.deflection;
            }
          }
        }
      }
      
      const spanDeflResult = checkDeflection(maxDeflInSpan, pSpan.length, deflLimitRatio);
      if (spanDeflResult.ratio > worstDeflectionResult.ratio) {
        worstDeflectionResult = spanDeflResult;
      }
      currentX += pSpan.length;
    }
  } else {
    // Fallback if physicalSpans is missing (should not happen)
    worstDeflectionResult = checkDeflection(results.maxDeflection.value, 3000, deflLimitRatio);
  }

  // ── System-beam mode ──
  if (isSystemBeam && systemCapacities) {
    const systemResult = checkSystemBeam(
      maxMomentVal,
      maxShearVal,
      worstDeflectionResult.actual,
      3000, // Not used inside checkSystemBeam anymore except to pass to checkDeflection, but we pass the raw result below
      systemCapacities.Mallow,
      systemCapacities.Vallow,
      deflLimitRatio
    );
    // Override the checkSystemBeam deflection result with our worst-case one
    systemResult.deflectionCheck = {
      ratio: worstDeflectionResult.ratio,
      pass: worstDeflectionResult.pass
    };

    const overallPass =
      systemResult.bendingCheck.pass &&
      systemResult.shearCheck.pass &&
      systemResult.deflectionCheck.pass;

    return {
      classification: null,
      bending: null,
      shear: null,
      interaction: null,
      deflection: worstDeflectionResult,
      systemBeam: systemResult,
      overallPass
    };
  }

  // ── EC3 mode ──
  const classificationResult = classifySection(section, gradeName);
  const bendingResult = checkBending(maxMomentVal, section, gradeName);
  const shearResult = checkShear(maxShearVal, section, gradeName);
  const interactionResult = checkBendingShearInteraction(maxMomentVal, maxShearVal, section, gradeName);

  const overallPass =
    bendingResult.pass &&
    shearResult.pass &&
    interactionResult.pass &&
    worstDeflectionResult.pass;

  return {
    classification: classificationResult,
    bending: bendingResult,
    shear: shearResult,
    interaction: interactionResult,
    deflection: worstDeflectionResult,
    systemBeam: null,
    overallPass
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Utility
// ────────────────────────────────────────────────────────────────────────────

/**
 * Round a number to a specified number of decimal places.
 *
 * @param {number} value    - The value to round.
 * @param {number} decimals - Number of decimal places.
 * @returns {number}
 */
function roundTo(value, decimals) {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}
