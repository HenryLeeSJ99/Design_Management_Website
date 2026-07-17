/**
 * @module steelProp
 * @description Steel Prop load capacity engine.
 *
 * Data source: Ultimate Load New (Steel Prop) capacity chart.
 * All capacities in the chart are Ultimate Loads in kN.
 * To get Permissible (working) loads, we divide all values by a factor of safety of 1.65.
 */

// Safety factor to convert Ultimate Capacity to Permissible Capacity
export const SAFETY_FACTOR = 1.65;

// Prop configurations from user-provided table.
// ext: 0 = Standard (white), 500 = 500mm extension (green), 1000 = 1000mm extension (purple)
export const PROP_MODELS_DATA = {
  'PA300': [
    { len: 1.8, cap: 48.47, ext: 0 },
    { len: 1.9, cap: 48.00, ext: 0 },
    { len: 2.0, cap: 45.00, ext: 0 },
    { len: 2.1, cap: 42.00, ext: 0 },
    { len: 2.2, cap: 39.50, ext: 0 },
    { len: 2.3, cap: 37.00, ext: 0 },
    { len: 2.4, cap: 35.00, ext: 0 },
    { len: 2.5, cap: 33.00, ext: 0 },
    { len: 2.6, cap: 31.00, ext: 0 },
    { len: 2.7, cap: 29.00, ext: 0 },
    { len: 2.8, cap: 27.50, ext: 0 },
    { len: 2.9, cap: 25.50, ext: 0 },
    { len: 3.0, cap: 23.37, ext: 0 },
    { len: 3.1, cap: 26.50, ext: 500 },
    { len: 3.2, cap: 24.50, ext: 500 },
    { len: 3.3, cap: 23.00, ext: 500 },
    { len: 3.4, cap: 20.99, ext: 500 },
    { len: 3.5, cap: 18.53, ext: 500 },
    { len: 3.6, cap: 22.76, ext: 1000 },
    { len: 3.7, cap: 21.25, ext: 1000 },
    { len: 3.8, cap: 19.12, ext: 1000 },
    { len: 3.9, cap: 17.14, ext: 1000 },
    { len: 4.0, cap: 15.16, ext: 1000 }
  ],
  'PA350': [
    { len: 2.1, cap: 46.00, ext: 0 },
    { len: 2.2, cap: 42.00, ext: 0 },
    { len: 2.3, cap: 39.00, ext: 0 },
    { len: 2.4, cap: 36.00, ext: 0 },
    { len: 2.5, cap: 34.00, ext: 0 },
    { len: 2.6, cap: 32.00, ext: 0 },
    { len: 2.7, cap: 30.50, ext: 0 },
    { len: 2.8, cap: 28.50, ext: 0 },
    { len: 2.9, cap: 26.77, ext: 0 },
    { len: 3.0, cap: 24.63, ext: 0 },
    { len: 3.1, cap: 22.92, ext: 0 },
    { len: 3.2, cap: 21.60, ext: 0 },
    { len: 3.3, cap: 20.50, ext: 0 },
    { len: 3.4, cap: 18.31, ext: 0 },
    { len: 3.5, cap: 16.08, ext: 0 },
    { len: 3.6, cap: 19.75, ext: 500 },
    { len: 3.7, cap: 17.99, ext: 500 },
    { len: 3.8, cap: 16.35, ext: 500 },
    { len: 3.9, cap: 14.77, ext: 500 },
    { len: 4.0, cap: 13.13, ext: 500 },
    { len: 4.1, cap: 16.43, ext: 1000 },
    { len: 4.2, cap: 14.99, ext: 1000 },
    { len: 4.3, cap: 13.65, ext: 1000 },
    { len: 4.4, cap: 12.35, ext: 1000 },
    { len: 4.5, cap: 11.00, ext: 1000 }
  ],
  'PA400': [
    { len: 2.3, cap: 48.47, ext: 0 },
    { len: 2.4, cap: 46.00, ext: 0 },
    { len: 2.5, cap: 41.50, ext: 0 },
    { len: 2.6, cap: 37.50, ext: 0 },
    { len: 2.7, cap: 34.00, ext: 0 },
    { len: 2.8, cap: 31.50, ext: 0 },
    { len: 2.9, cap: 29.50, ext: 0 },
    { len: 3.0, cap: 28.00, ext: 0 },
    { len: 3.1, cap: 26.00, ext: 0 },
    { len: 3.2, cap: 24.40, ext: 0 },
    { len: 3.3, cap: 22.30, ext: 0 },
    { len: 3.4, cap: 20.57, ext: 0 },
    { len: 3.5, cap: 19.14, ext: 0 },
    { len: 3.6, cap: 17.95, ext: 0 },
    { len: 3.7, cap: 16.90, ext: 0 },
    { len: 3.8, cap: 15.57, ext: 0 },
    { len: 3.9, cap: 14.31, ext: 0 },
    { len: 4.0, cap: 13.19, ext: 0 },
    { len: 4.1, cap: 15.38, ext: 500 },
    { len: 4.2, cap: 14.18, ext: 500 },
    { len: 4.3, cap: 13.06, ext: 500 },
    { len: 4.4, cap: 12.01, ext: 500 },
    { len: 4.5, cap: 10.97, ext: 500 },
    { len: 4.6, cap: 13.07, ext: 1000 },
    { len: 4.7, cap: 12.07, ext: 1000 },
    { len: 4.8, cap: 11.14, ext: 1000 },
    { len: 4.9, cap: 10.26, ext: 1000 },
    { len: 5.0, cap: 9.39, ext: 1000 }
  ],
  'PB320': [
    { len: 2.1, cap: 49.50, ext: 0 },
    { len: 2.2, cap: 46.00, ext: 0 },
    { len: 2.3, cap: 43.00, ext: 0 },
    { len: 2.4, cap: 40.00, ext: 0 },
    { len: 2.5, cap: 38.00, ext: 0 },
    { len: 2.6, cap: 36.00, ext: 0 },
    { len: 2.7, cap: 33.91, ext: 0 },
    { len: 2.8, cap: 30.85, ext: 0 },
    { len: 2.9, cap: 28.43, ext: 0 },
    { len: 3.0, cap: 26.56, ext: 0 },
    { len: 3.1, cap: 25.24, ext: 0 },
    { len: 3.2, cap: 22.92, ext: 0 },
    { len: 3.3, cap: 26.14, ext: 500 },
    { len: 3.4, cap: 24.49, ext: 500 },
    { len: 3.5, cap: 22.88, ext: 500 },
    { len: 3.6, cap: 20.68, ext: 500 },
    { len: 3.7, cap: 18.52, ext: 500 },
    { len: 3.8, cap: 22.06, ext: 1000 },
    { len: 3.9, cap: 20.81, ext: 1000 },
    { len: 4.0, cap: 18.91, ext: 1000 },
    { len: 4.1, cap: 17.13, ext: 1000 },
    { len: 4.2, cap: 15.37, ext: 1000 }
  ],
  'PB350': [
    { len: 2.1, cap: 62.00, ext: 0 },
    { len: 2.2, cap: 57.00, ext: 0 },
    { len: 2.3, cap: 52.00, ext: 0 },
    { len: 2.4, cap: 48.50, ext: 0 },
    { len: 2.5, cap: 45.00, ext: 0 },
    { len: 2.6, cap: 42.50, ext: 0 },
    { len: 2.7, cap: 40.00, ext: 0 },
    { len: 2.8, cap: 37.50, ext: 0 },
    { len: 2.9, cap: 34.08, ext: 0 },
    { len: 3.0, cap: 31.03, ext: 0 },
    { len: 3.1, cap: 28.53, ext: 0 },
    { len: 3.2, cap: 26.48, ext: 0 },
    { len: 3.3, cap: 24.83, ext: 0 },
    { len: 3.4, cap: 23.59, ext: 0 },
    { len: 3.5, cap: 22.00, ext: 0 },
    { len: 3.6, cap: 24.54, ext: 500 },
    { len: 3.7, cap: 23.05, ext: 500 },
    { len: 3.8, cap: 21.81, ext: 500 },
    { len: 3.9, cap: 19.93, ext: 500 },
    { len: 4.0, cap: 18.10, ext: 500 },
    { len: 4.1, cap: 21.08, ext: 1000 },
    { len: 4.2, cap: 19.93, ext: 1000 },
    { len: 4.3, cap: 18.29, ext: 1000 },
    { len: 4.4, cap: 16.75, ext: 1000 },
    { len: 4.5, cap: 15.24, ext: 1000 }
  ],
  'PB350-L': [
    { len: 2.1, cap: 56.50, ext: 0 },
    { len: 2.2, cap: 51.00, ext: 0 },
    { len: 2.3, cap: 46.00, ext: 0 },
    { len: 2.4, cap: 43.50, ext: 0 },
    { len: 2.5, cap: 40.50, ext: 0 },
    { len: 2.6, cap: 38.00, ext: 0 },
    { len: 2.7, cap: 35.50, ext: 0 },
    { len: 2.8, cap: 33.50, ext: 0 },
    { len: 2.9, cap: 31.22, ext: 0 },
    { len: 3.0, cap: 28.53, ext: 0 },
    { len: 3.1, cap: 26.37, ext: 0 },
    { len: 3.2, cap: 24.63, ext: 0 },
    { len: 3.3, cap: 23.29, ext: 0 },
    { len: 3.4, cap: 21.93, ext: 0 },
    { len: 3.5, cap: 19.72, ext: 0 },
    { len: 3.6, cap: 22.66, ext: 500 },
    { len: 3.7, cap: 21.46, ext: 500 },
    { len: 3.8, cap: 19.70, ext: 500 },
    { len: 3.9, cap: 17.90, ext: 500 },
    { len: 4.0, cap: 16.09, ext: 500 },
    { len: 4.1, cap: 19.44, ext: 1000 },
    { len: 4.2, cap: 17.94, ext: 1000 },
    { len: 4.3, cap: 16.40, ext: 1000 },
    { len: 4.4, cap: 14.94, ext: 1000 },
    { len: 4.5, cap: 13.46, ext: 1000 }
  ],
  'PD350': [
    { len: 2.1, cap: 68.56, ext: 0 },
    { len: 2.2, cap: 68.56, ext: 0 },
    { len: 2.3, cap: 68.56, ext: 0 },
    { len: 2.4, cap: 68.56, ext: 0 },
    { len: 2.5, cap: 67.00, ext: 0 },
    { len: 2.6, cap: 63.00, ext: 0 },
    { len: 2.7, cap: 59.00, ext: 0 },
    { len: 2.8, cap: 55.00, ext: 0 },
    { len: 2.9, cap: 51.79, ext: 0 },
    { len: 3.0, cap: 47.31, ext: 0 },
    { len: 3.1, cap: 43.65, ext: 0 },
    { len: 3.2, cap: 40.70, ext: 0 },
    { len: 3.3, cap: 38.39, ext: 0 },
    { len: 3.4, cap: 36.75, ext: 0 },
    { len: 3.5, cap: 34.42, ext: 0 },
    { len: 3.6, cap: 36.64, ext: 500 },
    { len: 3.7, cap: 34.60, ext: 500 },
    { len: 3.8, cap: 33.04, ext: 500 },
    { len: 3.9, cap: 30.97, ext: 500 },
    { len: 4.0, cap: 27.86, ext: 500 },
    { len: 4.1, cap: 30.85, ext: 1000 },
    { len: 4.2, cap: 29.54, ext: 1000 },
    { len: 4.3, cap: 28.14, ext: 1000 },
    { len: 4.4, cap: 25.64, ext: 1000 },
    { len: 4.5, cap: 23.09, ext: 1000 }
  ],
  '30-350': [
    { len: 2.1, cap: 104.18, ext: 0 },
    { len: 2.2, cap: 104.18, ext: 0 },
    { len: 2.3, cap: 104.18, ext: 0 },
    { len: 2.4, cap: 104.18, ext: 0 },
    { len: 2.5, cap: 104.18, ext: 0 },
    { len: 2.6, cap: 104.18, ext: 0 },
    { len: 2.7, cap: 98.62, ext: 0 },
    { len: 2.8, cap: 87.75, ext: 0 },
    { len: 2.9, cap: 78.92, ext: 0 },
    { len: 3.0, cap: 71.70, ext: 0 },
    { len: 3.1, cap: 65.76, ext: 0 },
    { len: 3.2, cap: 60.90, ext: 0 },
    { len: 3.3, cap: 56.98, ext: 0 },
    { len: 3.4, cap: 53.99, ext: 0 },
    { len: 3.5, cap: 52.09, ext: 0 },
    { len: 3.6, cap: 53.86, ext: 500 },
    { len: 3.7, cap: 50.55, ext: 500 },
    { len: 3.8, cap: 47.89, ext: 500 },
    { len: 3.9, cap: 45.92, ext: 500 },
    { len: 4.0, cap: 42.74, ext: 500 },
    { len: 4.1, cap: 44.40, ext: 1000 },
    { len: 4.2, cap: 42.26, ext: 1000 },
    { len: 4.3, cap: 40.55, ext: 1000 },
    { len: 4.4, cap: 39.19, ext: 1000 },
    { len: 4.5, cap: 35.51, ext: 1000 }
  ],
  'PE350': [
    { len: 2.1, cap: 81.03, ext: 0 },
    { len: 2.2, cap: 81.03, ext: 0 },
    { len: 2.3, cap: 81.03, ext: 0 },
    { len: 2.4, cap: 81.03, ext: 0 },
    { len: 2.5, cap: 81.03, ext: 0 },
    { len: 2.6, cap: 81.03, ext: 0 },
    { len: 2.7, cap: 81.03, ext: 0 },
    { len: 2.8, cap: 81.03, ext: 0 },
    { len: 2.9, cap: 78.33, ext: 0 },
    { len: 3.0, cap: 71.65, ext: 0 },
    { len: 3.1, cap: 66.23, ext: 0 },
    { len: 3.2, cap: 61.88, ext: 0 },
    { len: 3.3, cap: 58.52, ext: 0 },
    { len: 3.4, cap: 56.19, ext: 0 },
    { len: 3.5, cap: 51.17, ext: 0 },
    { len: 3.6, cap: 53.31, ext: 500 },
    { len: 3.7, cap: 50.62, ext: 500 },
    { len: 3.8, cap: 48.59, ext: 500 },
    { len: 3.9, cap: 45.48, ext: 500 },
    { len: 4.0, cap: 40.52, ext: 500 },
    { len: 4.1, cap: 43.39, ext: 1000 },
    { len: 4.2, cap: 41.85, ext: 1000 },
    { len: 4.3, cap: 40.65, ext: 1000 },
    { len: 4.4, cap: 36.85, ext: 1000 },
    { len: 4.5, cap: 32.83, ext: 1000 }
  ]
};

export const PROP_KEYS = Object.keys(PROP_MODELS_DATA);

// ---------------------------------------------------------------------------
// Load calculation
// ---------------------------------------------------------------------------

/**
 * Calculates the design load on a single steel prop.
 * Matches BS5975 load derivation.
 *
 * @param {object} p
 * @param {number} p.thickness   Concrete thickness [mm]
 * @param {number} p.area        Tributary load area per prop [m²]
 * @param {number} [p.unitWeight=25]    Concrete unit weight [kN/m³]
 * @param {number} [p.formworkLoad=0.5] Formwork dead load q1 [kN/m²]
 * @returns {{q1:number,q2:number,q3:number,Q:number,F:number}}
 */
export function calculatePropLoad({ thickness, area, unitWeight = 25, formworkLoad = 0.5 }) {
  const t = Number(thickness) || 0;
  const A = Number(area) || 0;
  const q1 = Number(formworkLoad) || 0;
  const q2 = (Number(unitWeight) || 0) * (t / 1000);
  
  // Construction load: 10% of concrete load + 0.75, clamped to [1.5, 2.5] kN/m²
  const q3 = Math.min(2.5, Math.max(1.5, 0.1 * q2 + 0.75));
  
  const Q = q1 + q2 + q3;
  const F = Q * A;
  
  return { q1, q2, q3, Q, F };
}

// ---------------------------------------------------------------------------
// Capacity lookup
// ---------------------------------------------------------------------------

/**
 * Permissible capacity of a steel prop at a given length.
 * Finds the first tabulated length >= the requested length (conservative lookup).
 * Divides the ultimate load capacity by SAFETY_FACTOR (1.65) to get permissible capacity.
 *
 * @returns {{ultimateCapacity:number|null, capacity:number|null, tableLength:number|null, ext:number|null, status:string}}
 */
export function getPropCapacity(propKey, length) {
  const rows = PROP_MODELS_DATA[propKey];
  if (!rows) return { ultimateCapacity: null, capacity: null, tableLength: null, ext: null, status: 'invalid' };
  
  const len = Number(length);
  if (!(len > 0)) return { ultimateCapacity: null, capacity: null, tableLength: null, ext: null, status: 'invalid' };
  
  const sorted = [...rows].sort((a, b) => a.len - b.len);
  const minLen = sorted[0].len;
  const maxLen = sorted[sorted.length - 1].len;
  
  if (len > maxLen + 1e-9) {
    return { ultimateCapacity: null, capacity: null, tableLength: maxLen, ext: null, status: 'exceeds-max' };
  }
  
  if (len < minLen - 1e-9) {
    // Under minimum length, conservative is to use the min capacity or treat it as under range.
    // Let's use the min length capacity, marked as 'below-min'.
    const row = sorted[0];
    const capacity = Number((row.cap / SAFETY_FACTOR).toFixed(2));
    return { ultimateCapacity: row.cap, capacity, tableLength: row.len, ext: row.ext, status: 'below-min' };
  }
  
  // Find first tabulated length >= height
  const row = sorted.find((r) => r.len >= len - 1e-9);
  if (!row) return { ultimateCapacity: null, capacity: null, tableLength: null, ext: null, status: 'invalid' };
  
  const capacity = Number((row.cap / SAFETY_FACTOR).toFixed(2));
  return {
    ultimateCapacity: row.cap,
    capacity,
    tableLength: row.len,
    ext: row.ext,
    status: 'ok'
  };
}

/**
 * Evaluates every prop model configuration against the design prop load.
 *
 * @param {object} p
 * @param {number} p.length     Prop length [m]
 * @param {number} p.propLoad    Design load per prop F [kN]
 * @returns {Array<object>}
 */
export function evaluatePropConfigurations({ length, propLoad }) {
  const results = [];
  for (const propKey of PROP_KEYS) {
    const lookup = getPropCapacity(propKey, length);
    const { ultimateCapacity, capacity, tableLength, ext, status } = lookup;
    const utilization = capacity ? propLoad / capacity : null;
    
    results.push({
      model: propKey,
      ultimateCapacity,
      capacity,
      tableLength,
      ext,
      status,
      utilization,
      pass: capacity !== null && utilization !== null && utilization <= 1.0,
    });
  }
  return results;
}

/**
 * Chart series data for one prop model: capacity vs length,
 * mapped to permissible capacity (ultimate / 1.65) for plotting.
 */
export function buildPropChartData(propKey) {
  const rows = PROP_MODELS_DATA[propKey];
  if (!rows) return [];
  
  return rows.map((r) => ({
    length: r.len,
    capacity: Number((r.cap / SAFETY_FACTOR).toFixed(2)),
    ultimateCapacity: r.cap,
    ext: r.ext
  }));
}
