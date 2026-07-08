/**
 * @fileoverview Shared type definitions and unit conventions for the beam engine.
 *
 * Units convention (document once, use everywhere):
 *   - Lengths, deflections, positions: mm
 *   - Forces: kN (downward positive for loads and reactions)
 *   - Moments: kNm (sagging positive along spans; hogging negative at supports)
 *   - Distributed loads: kN/m (downward positive)
 *   - E (Young's modulus): MPa (N/mm²)
 *   - I (second moment of area): cm⁴ — converted to mm⁴ inside the solver (× 10⁴)
 *   - Section dimensions in materials DB: mm; area cm²; Iy cm⁴; moduli cm³
 *
 * @module @engine/beam/types
 */

/**
 * @typedef {'pin'|'roller'|'fixed'|'free'} SupportType
 */

/**
 * Physical span as entered by the user (one bay between supports).
 *
 * @typedef {Object} PhysicalSpan
 * @property {number} length - Span length in mm
 * @property {SupportType} leftSupport
 * @property {SupportType} rightSupport
 */

/**
 * @typedef {Object} PhysicalLoad
 * @property {'point'|'udl'} type
 * @property {number} spanIndex - 0-based index of the physical span
 * @property {number} posStart - Position from left node of span (mm)
 * @property {number} [posEnd] - End position for partial UDLs (mm)
 * @property {number} magnitude - kN (point) or kN/m (udl); downward positive
 */

/**
 * Output of the mesher — internal FEA model derived from physical input.
 *
 * @typedef {Object} MeshedData
 * @property {number[]} internalSpans - Element lengths (mm)
 * @property {Array<{type: SupportType}>} internalSupports
 * @property {number[]} nodalLoads - Point loads at each internal node (kN)
 * @property {number[]} elementLoads - UDL on each internal element (kN/m)
 * @property {number[]} physicalNodeIndices - Maps physical nodes → internal node indices
 */

/**
 * @typedef {Object} BeamAnalysisPoint
 * @property {number} x - Global position (mm)
 * @property {number} moment - kNm
 * @property {number} shear - kN
 * @property {number} deflection - mm
 */

/**
 * @typedef {Object} BeamResults
 * @property {Array<{x: number, displacement: number, rotation: number, reaction: number}>} nodes
 * @property {Array<{startX: number, endX: number, length: number, points: BeamAnalysisPoint[]}>} spans
 * @property {{value: number, x: number}} maxMoment
 * @property {{value: number, x: number}} maxShear
 * @property {{value: number, x: number}} maxDeflection
 * @property {Array<{x: number, value: number}>} reactions
 */

/**
 * Combined input for the analyzeBeam facade.
 *
 * @typedef {Object} BeamAnalysisInput
 * @property {PhysicalSpan[]} spans
 * @property {PhysicalLoad[]} loads
 * @property {number} E - Young's modulus (MPa)
 * @property {number} I - Second moment of area (cm⁴)
 */

/**
 * @typedef {Object} BeamAnalysisOutput
 * @property {MeshedData} mesh
 * @property {BeamResults} analysis
 */

export {};
