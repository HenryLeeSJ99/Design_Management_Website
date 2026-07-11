/**
 * @fileoverview Steel section database and grade data for formwork beam design.
 * Contains accurate section properties for IPE, UB, SHS, and RHS profiles
 * commonly used in temporary works / formwork applications.
 *
 * Units convention:
 *   - Dimensions (h, b, tw, tf, r): mm
 *   - Area (A, Av): cm²
 *   - Second moment of area (Iy): cm⁴
 *   - Section moduli (Wel_y, Wpl_y): cm³
 *   - Linear mass: kg/m
 *
 * @module sections
 */

// ────────────────────────────────────────────────────────────────────────────
// Steel grades per BS EN 1993-1-1
// ────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} SteelGrade
 * @property {number} fy  - Yield strength (MPa / N/mm²)
 * @property {number} E   - Young's modulus (MPa / N/mm²)
 * @property {number} gammaM0 - Partial safety factor for resistance (§6.1)
 */

/** @type {Object<string, SteelGrade>} */
export const STEEL_GRADES = {
  'S235': { fy: 235, E: 210000, gammaM0: 1.00 },
  'S355': { fy: 355, E: 210000, gammaM0: 1.00 }
};

// ────────────────────────────────────────────────────────────────────────────
// Section type identifiers
// ────────────────────────────────────────────────────────────────────────────

/** Supported section families. */
export const SECTION_TYPES = ['IPE', 'UB', 'SHS', 'RHS', 'System Beam'];

// ────────────────────────────────────────────────────────────────────────────
// Section database
// ────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} SectionProperties
 * @property {string}  name   - Display name (e.g. 'IPE 200')
 * @property {number}  h      - Total depth (mm)
 * @property {number}  b      - Width / flange width (mm)
 * @property {number}  tw     - Web thickness (mm)
 * @property {number}  tf     - Flange / wall thickness (mm)
 * @property {number}  r      - Root / corner radius (mm)
 * @property {number}  A      - Cross-section area (cm²)
 * @property {number}  Iy     - Second moment of area, major axis (cm⁴)
 * @property {number}  Wel_y  - Elastic section modulus, major axis (cm³)
 * @property {number}  Wpl_y  - Plastic section modulus, major axis (cm³)
 * @property {number}  Av     - Shear area (cm²)
 * @property {number}  mass   - Linear mass (kg/m)
 * @property {'I'|'hollow'} type - Section family flag
 */

/** @type {Object<string, SectionProperties[]>} */
export const SECTIONS = {

  // ── IPE – European I-beams (common formwork sizes) ────────────────────
  'IPE': [
    {
      name: 'IPE 100',
      h: 100, b: 55, tw: 4.1, tf: 5.7, r: 7,
      A: 10.3, Iy: 171, Wel_y: 34.2, Wpl_y: 39.4,
      Av: 5.10, mass: 8.1, type: 'I'
    },
    {
      name: 'IPE 120',
      h: 120, b: 64, tw: 4.4, tf: 6.3, r: 7,
      A: 13.2, Iy: 318, Wel_y: 53.0, Wpl_y: 60.7,
      Av: 6.31, mass: 10.4, type: 'I'
    },
    {
      name: 'IPE 140',
      h: 140, b: 73, tw: 4.7, tf: 6.9, r: 7,
      A: 16.4, Iy: 541, Wel_y: 77.3, Wpl_y: 88.3,
      Av: 7.64, mass: 12.9, type: 'I'
    },
    {
      name: 'IPE 160',
      h: 160, b: 82, tw: 5.0, tf: 7.4, r: 9,
      A: 20.1, Iy: 869, Wel_y: 109, Wpl_y: 124,
      Av: 9.66, mass: 15.8, type: 'I'
    },
    {
      name: 'IPE 180',
      h: 180, b: 91, tw: 5.3, tf: 8.0, r: 9,
      A: 23.9, Iy: 1317, Wel_y: 146, Wpl_y: 166,
      Av: 11.3, mass: 18.8, type: 'I'
    },
    {
      name: 'IPE 200',
      h: 200, b: 100, tw: 5.6, tf: 8.5, r: 12,
      A: 28.5, Iy: 1943, Wel_y: 194, Wpl_y: 221,
      Av: 14.0, mass: 22.4, type: 'I'
    },
    {
      name: 'IPE 220',
      h: 220, b: 110, tw: 5.9, tf: 9.2, r: 12,
      A: 33.4, Iy: 2772, Wel_y: 252, Wpl_y: 285,
      Av: 15.9, mass: 26.2, type: 'I'
    },
    {
      name: 'IPE 240',
      h: 240, b: 120, tw: 6.2, tf: 9.8, r: 15,
      A: 39.1, Iy: 3892, Wel_y: 324, Wpl_y: 367,
      Av: 18.5, mass: 30.7, type: 'I'
    }
  ],

  // ── UB – Universal Beams (UK sizes) ──────────────────────────────────
  'UB': [
    {
      name: '127x76x13',
      h: 127.0, b: 76.0, tw: 4.0, tf: 7.6, r: 7.6,
      A: 16.5, Iy: 473, Wel_y: 74.5, Wpl_y: 84.2,
      Av: 6.03, mass: 13, type: 'I'
    },
    {
      name: '152x89x16',
      h: 152.4, b: 88.7, tw: 4.5, tf: 7.7, r: 7.6,
      A: 20.3, Iy: 834, Wel_y: 109, Wpl_y: 123,
      Av: 8.04, mass: 16, type: 'I'
    },
    {
      name: '178x102x19',
      h: 177.8, b: 101.2, tw: 4.8, tf: 7.9, r: 7.6,
      A: 24.3, Iy: 1356, Wel_y: 153, Wpl_y: 171,
      Av: 9.88, mass: 19, type: 'I'
    },
    {
      name: '203x133x25',
      h: 203.2, b: 133.2, tw: 5.7, tf: 7.8, r: 7.6,
      A: 32.0, Iy: 2340, Wel_y: 230, Wpl_y: 258,
      Av: 13.2, mass: 25, type: 'I'
    },
    {
      name: '203x133x30',
      h: 206.8, b: 133.9, tw: 6.4, tf: 9.6, r: 7.6,
      A: 38.2, Iy: 2896, Wel_y: 280, Wpl_y: 314,
      Av: 14.9, mass: 30, type: 'I'
    },
    {
      name: '254x146x31',
      h: 251.4, b: 146.1, tw: 6.0, tf: 8.6, r: 7.6,
      A: 39.7, Iy: 4413, Wel_y: 351, Wpl_y: 393,
      Av: 17.1, mass: 31, type: 'I'
    }
  ],

  // ── SHS – Square Hollow Sections ─────────────────────────────────────
  'SHS': [
    {
      name: 'SHS 60x60x3.0',
      h: 60, b: 60, tw: 3.0, tf: 3.0, r: 3.0,
      A: 6.72, Iy: 38.3, Wel_y: 12.8, Wpl_y: 15.1,
      Av: 3.36, mass: 5.28, type: 'hollow'
    },
    {
      name: 'SHS 60x60x4.0',
      h: 60, b: 60, tw: 4.0, tf: 4.0, r: 4.0,
      A: 8.63, Iy: 47.3, Wel_y: 15.8, Wpl_y: 18.9,
      Av: 4.32, mass: 6.78, type: 'hollow'
    },
    {
      name: 'SHS 80x80x3.0',
      h: 80, b: 80, tw: 3.0, tf: 3.0, r: 3.0,
      A: 9.12, Iy: 96.0, Wel_y: 24.0, Wpl_y: 28.0,
      Av: 4.56, mass: 7.16, type: 'hollow'
    },
    {
      name: 'SHS 80x80x4.0',
      h: 80, b: 80, tw: 4.0, tf: 4.0, r: 4.0,
      A: 11.8, Iy: 121, Wel_y: 30.2, Wpl_y: 35.6,
      Av: 5.92, mass: 9.30, type: 'hollow'
    },
    {
      name: 'SHS 100x100x4.0',
      h: 100, b: 100, tw: 4.0, tf: 4.0, r: 4.0,
      A: 14.4, Iy: 237, Wel_y: 47.4, Wpl_y: 55.8,
      Av: 7.20, mass: 11.3, type: 'hollow'
    },
    {
      name: 'SHS 100x100x5.0',
      h: 100, b: 100, tw: 5.0, tf: 5.0, r: 5.0,
      A: 17.8, Iy: 284, Wel_y: 56.8, Wpl_y: 67.8,
      Av: 8.88, mass: 13.9, type: 'hollow'
    },
    {
      name: 'SHS 120x120x5.0',
      h: 120, b: 120, tw: 5.0, tf: 5.0, r: 5.0,
      A: 22.0, Iy: 497, Wel_y: 82.8, Wpl_y: 98.3,
      Av: 11.0, mass: 17.3, type: 'hollow'
    },
    {
      name: 'SHS 150x150x5.0',
      h: 150, b: 150, tw: 5.0, tf: 5.0, r: 5.0,
      A: 28.0, Iy: 1040, Wel_y: 139, Wpl_y: 163,
      Av: 14.0, mass: 22.0, type: 'hollow'
    }
  ],

  // ── RHS – Rectangular Hollow Sections (bending about major axis) ─────
  'RHS': [
    {
      name: 'RHS 80x40x3.0',
      h: 80, b: 40, tw: 3.0, tf: 3.0, r: 3.0,
      A: 6.72, Iy: 48.8, Wel_y: 12.2, Wpl_y: 15.2,
      Av: 3.36, mass: 5.28, type: 'hollow'
    },
    {
      name: 'RHS 100x50x3.0',
      h: 100, b: 50, tw: 3.0, tf: 3.0, r: 3.0,
      A: 8.52, Iy: 103, Wel_y: 20.6, Wpl_y: 25.2,
      Av: 4.26, mass: 6.69, type: 'hollow'
    },
    {
      name: 'RHS 100x50x4.0',
      h: 100, b: 50, tw: 4.0, tf: 4.0, r: 4.0,
      A: 11.0, Iy: 128, Wel_y: 25.6, Wpl_y: 31.9,
      Av: 5.50, mass: 8.63, type: 'hollow'
    },
    {
      name: 'RHS 120x60x4.0',
      h: 120, b: 60, tw: 4.0, tf: 4.0, r: 4.0,
      A: 13.4, Iy: 225, Wel_y: 37.5, Wpl_y: 46.2,
      Av: 6.72, mass: 10.5, type: 'hollow'
    },
    {
      name: 'RHS 120x60x5.0',
      h: 120, b: 60, tw: 5.0, tf: 5.0, r: 5.0,
      A: 16.4, Iy: 267, Wel_y: 44.5, Wpl_y: 55.6,
      Av: 8.20, mass: 12.8, type: 'hollow'
    },
    {
      name: 'RHS 150x100x5.0',
      h: 150, b: 100, tw: 5.0, tf: 5.0, r: 5.0,
      A: 23.0, Iy: 674, Wel_y: 89.9, Wpl_y: 106,
      Av: 11.5, mass: 18.0, type: 'hollow'
    },
    {
      name: 'RHS 200x100x5.0',
      h: 200, b: 100, tw: 5.0, tf: 5.0, r: 5.0,
      A: 28.0, Iy: 1370, Wel_y: 137, Wpl_y: 168,
      Av: 14.0, mass: 22.0, type: 'hollow'
    }
  ],
  'System Beam': [
    {
      // Manufacturer datasheet: Mallow 8.1 kNm, Vallow 25.5 kN, EI 360 kNm²,
      // mass 5.1 kg/m, FOS 1.65. Iy below is back-solved so E * Iy * 1e-5
      // (see solver EI wiring in MultiBeamCalculator.jsx) reproduces the
      // published EI exactly, since a proprietary section has no single
      // "real" second moment of area to measure directly.
      name: 'Alpha-Beam',
      company: 'PLYTEC',
      material: 'Steel',
      E: 210000,
      h: 150, b: 100, tw: 0, tf: 0, r: 0, A: 15.0,
      Iy: 171.43, Wel_y: 52.8, Wpl_y: 52.8, Av: 8.0,
      mass: 5.1, Mallow: 8.1, Vallow: 25.5, type: 'system', combinedLoadFactor: 1.65
    },
    {
      // Manufacturer datasheet: Mallow 7.2 kNm, Vallow 63 kN, EI 265 kNm²,
      // mass 4.7 kg/m, FOS 1.65.
      name: 'Alu-Beam 150H',
      company: 'PLYTEC',
      material: 'Aluminum',
      E: 70000,
      h: 150, b: 100, tw: 0, tf: 0, r: 0, A: 12.0,
      Iy: 378.57, Wel_y: 67.2, Wpl_y: 67.2, Av: 7.5,
      mass: 4.7, Mallow: 7.2, Vallow: 63.0, type: 'system', combinedLoadFactor: 1.65
    },
    {
      // Manufacturer datasheet: Mallow 31.1 kNm, Vallow 36.9 kN, EI 1630 kNm²,
      // mass 6.2 kg/m, FOS 1.65.
      name: 'Alu-Beam 225H',
      company: 'PLYTEC',
      material: 'Aluminum',
      E: 70000,
      h: 225, b: 120, tw: 0, tf: 0, r: 0, A: 18.0,
      Iy: 2328.57, Wel_y: 144, Wpl_y: 144, Av: 11.0,
      mass: 6.2, Mallow: 31.1, Vallow: 36.9, type: 'system', combinedLoadFactor: 1.65
    },
    {
      name: 'H20',
      company: 'Doka',
      material: 'Timber',
      E: 10000,
      h: 200, b: 80, tw: 0, tf: 0, r: 0, A: 60.0,
      Iy: 4600, Wel_y: 460, Wpl_y: 460, Av: 30.0,
      mass: 4.8, Mallow: 5.0, Vallow: 11.0, type: 'system', combinedLoadFactor: 1.50
    }
  ]
};

// ────────────────────────────────────────────────────────────────────────────
// Utility functions
// ────────────────────────────────────────────────────────────────────────────

/**
 * Look up a single section by its family type and display name.
 *
 * @param {string} type  - Section family key ('IPE' | 'UB' | 'SHS' | 'RHS').
 * @param {string} name  - Display name exactly as stored (e.g. 'IPE 200').
 * @returns {SectionProperties|undefined} The matching section or `undefined`.
 *
 * @example
 *   const sec = getSectionByName('IPE', 'IPE 200');
 *   console.log(sec.Iy); // 1943
 */
export function getSectionByName(type, name) {
  const family = SECTIONS[type];
  if (!family) {
    return undefined;
  }
  return family.find((s) => s.name === name);
}

/**
 * Build a grouped list of every section name, suitable for populating an
 * HTML `<select>` with `<optgroup>` elements.
 *
 * @returns {Array<{group: string, sections: string[]}>}
 *   Each entry contains the group label and an ordered array of section names.
 *
 * @example
 *   const groups = getAllSectionNames();
 *   // [
 *   //   { group: 'IPE', sections: ['IPE 100', 'IPE 120', …] },
 *   //   { group: 'UB',  sections: ['127x76x13', …] },
 *   //   …
 *   // ]
 */
export function getAllSectionNames() {
  return SECTION_TYPES.map((type) => ({
    group: type,
    sections: SECTIONS[type].map((s) => s.name)
  }));
}
