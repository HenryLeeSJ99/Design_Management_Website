/**
 * @module shoringTower
 * @description WONDERCrab Modular Shoring Tower load capacity engine.
 *
 * Data source: PLYTEC WONDERCrab Product Manual (English), Issue 26/01.
 *  - Permissible load capacity charts: manual pages 39-63 (top-held & free-standing)
 *  - Load derivation: manual page 64 "Example of Calculation" / BS5975:2019 cl.17.4.3.1
 *  - Structural design basis: BS EN 12812 Class B1
 *
 * All capacities are permissible (working) loads per shoring leg in kN.
 */

// ---------------------------------------------------------------------------
// Capacity data
// ---------------------------------------------------------------------------

export const TYPE_DESCRIPTIONS = {
  A: 'Bracing every 2 m · Ledger every 1 m',
  B: 'Bracing every 2 m · Ledger every 2 m',
  C: 'Bracing every 1.5 m · Ledger every 1.5 m',
  D: 'Bracing every 2 m · Ledger every 2 m · Top unbraced (1 m / 0.5 m ledger)',
  E: '1 m fully braced · Wind on 1.5 m side',
};

export const SHORING_SYSTEMS = {
  WCL48: {
    label: 'WCL48',
    series: 'Ø48.3 Crab Lock series',
    topHeld: {
      A: { heights: [4.9, 6.9, 8.9, 10.9, 12.9], capacities: [26.0, 24.4, 24.0, 22.8, 21.6] },
      B: { heights: [4.9, 6.9, 8.9, 10.9, 12.9], capacities: [22.0, 20.6, 20.2, 19.6, 18.9] },
      C: { heights: [3.9, 5.4, 6.9, 8.4, 9.9, 11.4, 12.9], capacities: [29.8, 27.5, 26.2, 25.2, 24.6, 24.0, 23.0] },
      D: { heights: [4.4, 6.4, 8.4, 10.4, 12.4], capacities: [22.0, 20.6, 20.2, 19.6, 18.9] },
    },
    freeStanding: {
      A: [{ height: 4.9, ext: 300, cap: 23 }, { height: 4.8, ext: 200, cap: 25 }, { height: 4.7, ext: 100, cap: 26 }],
      B: [{ height: 4.9, ext: 300, cap: 19 }, { height: 4.8, ext: 200, cap: 19 }, { height: 4.7, ext: 100, cap: 20 }],
      C: [{ height: 5.4, ext: 300, cap: 23 }, { height: 5.3, ext: 200, cap: 24 }, { height: 5.2, ext: 100, cap: 26 }],
      D: [{ height: 3.9, ext: 300, cap: 14 }, { height: 3.8, ext: 200, cap: 14 }, { height: 3.7, ext: 100, cap: 15 }],
    },
  },
  WH48: {
    label: 'WH48',
    series: 'Ø48.3 heavy-duty series',
    topHeld: {
      A: { heights: [4.9, 6.9, 8.9, 10.9, 12.9], capacities: [35.0, 31.2, 30.8, 30.0, 29.0] },
      B: { heights: [4.9, 6.9, 8.9, 10.9, 12.9], capacities: [23.8, 22.4, 22.0, 21.8, 21.2] },
      C: { heights: [3.9, 5.4, 6.9, 8.4, 9.9, 11.4, 12.9], capacities: [35.6, 33.0, 31.8, 30.8, 30.0, 29.0, 28.2] },
      D: { heights: [4.4, 6.4, 8.4, 10.4, 12.4], capacities: [23.8, 22.4, 22.0, 21.8, 21.2] },
    },
    freeStanding: {
      A: [{ height: 4.9, ext: 300, cap: 27 }, { height: 4.8, ext: 200, cap: 29 }, { height: 4.7, ext: 100, cap: 32 }],
      B: [{ height: 4.9, ext: 300, cap: 19 }, { height: 4.8, ext: 200, cap: 20 }, { height: 4.7, ext: 100, cap: 21 }],
      C: [{ height: 5.4, ext: 300, cap: 27 }, { height: 5.3, ext: 200, cap: 29 }, { height: 5.2, ext: 100, cap: 31 }],
      D: [{ height: 3.9, ext: 300, cap: 14 }, { height: 3.8, ext: 200, cap: 15 }, { height: 3.7, ext: 100, cap: 16 }],
    },
  },
  WCL60: {
    label: 'WCL60',
    series: 'Ø60.3 Crab Lock series (Q355)',
    topHeld: {
      A: { heights: [4.9, 6.9, 8.9, 10.9, 12.9], capacities: [51.6, 47.4, 45.0, 41.6, 38.6] },
      B: { heights: [4.9, 6.9, 8.9, 10.9, 12.9], capacities: [39.2, 37.0, 35.4, 33.8, 32.6] },
      C: { heights: [3.9, 5.4, 6.9, 8.4, 9.9, 11.4, 12.9], capacities: [53.0, 49.6, 46.8, 44.8, 42.6, 38.6, 35.6] },
      D: { heights: [4.9, 6.9, 8.9, 10.9, 12.9], capacities: [39.2, 37.0, 35.4, 33.8, 32.6] },
      E: { heights: [4.9, 5.9, 6.9, 7.9, 8.9, 9.9, 10.9, 11.9, 12.9], capacities: [63.0, 60.4, 58.4, 56.2, 54.4, 52.6, 51.0, 49.6, 48.4] },
    },
    freeStanding: {
      A: [{ height: 4.9, ext: 300, cap: 43 }, { height: 4.8, ext: 200, cap: 47 }, { height: 4.7, ext: 100, cap: 49 }],
      B: [{ height: 4.9, ext: 300, cap: 33 }, { height: 4.8, ext: 200, cap: 33 }, { height: 4.7, ext: 100, cap: 35 }],
      C: [{ height: 5.4, ext: 300, cap: 46 }, { height: 5.3, ext: 200, cap: 48 }, { height: 5.2, ext: 100, cap: 50 }],
      D: [{ height: 3.9, ext: 300, cap: 28 }, { height: 3.8, ext: 200, cap: 29 }, { height: 3.7, ext: 100, cap: 31 }],
      E: [{ height: 4.9, ext: 300, cap: 51 }, { height: 4.8, ext: 200, cap: 56 }, { height: 4.7, ext: 100, cap: 60 }],
    },
  },
  WH60: {
    label: 'WH60',
    series: 'Ø60.3 heavy-duty series',
    topHeld: {
      A: { heights: [4.9, 6.9, 8.9, 10.9, 12.9], capacities: [64.8, 59.0, 56.0, 52.0, 49.2] },
      B: { heights: [4.9, 6.9, 8.9, 10.9, 12.9], capacities: [49.4, 46.2, 44.2, 42.6, 41.0] },
      C: { heights: [3.9, 5.4, 6.9, 8.4, 9.9, 11.4, 12.9], capacities: [68.0, 62.8, 59.4, 56.6, 54.0, 49.2, 46.4] },
      D: { heights: [4.4, 6.4, 8.4, 10.4, 12.4], capacities: [49.4, 46.2, 44.6, 42.6, 41.0] },
      E: { heights: [4.9, 5.9, 6.9, 7.9, 8.9, 9.9, 10.9, 11.9, 12.9], capacities: [80.8, 77.8, 75.0, 72.6, 70.4, 68.4, 66.6, 64.8, 63.0] },
    },
    freeStanding: {
      A: [{ height: 4.9, ext: 300, cap: 55 }, { height: 4.8, ext: 200, cap: 59 }, { height: 4.7, ext: 100, cap: 62 }],
      B: [{ height: 4.9, ext: 300, cap: 42 }, { height: 4.8, ext: 200, cap: 43 }, { height: 4.7, ext: 100, cap: 45 }],
      C: [{ height: 5.4, ext: 300, cap: 59 }, { height: 5.3, ext: 200, cap: 63 }, { height: 5.2, ext: 100, cap: 64 }],
      D: [{ height: 3.9, ext: 300, cap: 33 }, { height: 3.8, ext: 200, cap: 36 }, { height: 3.7, ext: 100, cap: 37 }],
      E: [{ height: 4.9, ext: 300, cap: 64 }, { height: 4.8, ext: 200, cap: 70 }, { height: 4.7, ext: 100, cap: 75 }],
    },
  },
};

export const SYSTEM_KEYS = Object.keys(SHORING_SYSTEMS);

// ---------------------------------------------------------------------------
// Load derivation (manual p.64 / BS5975:2019 cl.17.4.3.1)
// ---------------------------------------------------------------------------

/**
 * Derives the design load on a single shoring leg.
 *
 * @param {object} p
 * @param {number} p.thickness   Concrete thickness [mm]
 * @param {number} p.area        Tributary load area per leg [m²]
 * @param {number} [p.unitWeight=25]    Concrete unit weight [kN/m³]
 * @param {number} [p.formworkLoad=0.5] Formwork dead load q1 [kN/m²]
 * @returns {{q1:number,q2:number,q3:number,Q:number,F:number}}
 */
export function calculateLegLoad({ thickness, area, unitWeight = 25, formworkLoad = 0.5 }) {
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
 * Permissible capacity of a top-held tower configuration at a given height.
 * The chart is discrete; the capacity used is that of the first tabulated
 * height >= the requested height (conservative, capacity decreases with height).
 *
 * @returns {{capacity:number|null, tableHeight:number|null, status:string}}
 *   status: 'ok' | 'below-min' (height under chart range, min-height value used)
 *         | 'exceeds-max' (taller than rated range, not permissible)
 */
export function getTopHeldCapacity(systemKey, typeKey, height) {
  const cfg = SHORING_SYSTEMS[systemKey]?.topHeld?.[typeKey];
  if (!cfg) return { capacity: null, tableHeight: null, status: 'invalid' };
  const h = Number(height);
  const { heights, capacities } = cfg;
  if (!(h > 0)) return { capacity: null, tableHeight: null, status: 'invalid' };
  if (h > heights[heights.length - 1]) {
    return { capacity: null, tableHeight: heights[heights.length - 1], status: 'exceeds-max' };
  }
  if (h < heights[0]) {
    return { capacity: capacities[0], tableHeight: heights[0], status: 'below-min' };
  }
  const idx = heights.findIndex((th) => th >= h - 1e-9);
  return { capacity: capacities[idx], tableHeight: heights[idx], status: 'ok' };
}

/**
 * Permissible capacity of a free-standing tower configuration.
 * Free-standing towers are only rated at their tabulated maximum height for
 * each jack/U-head extension; the tower height must not exceed it.
 *
 * @returns {{capacity:number|null, tableHeight:number|null, status:string}}
 */
export function getFreeStandingCapacity(systemKey, typeKey, height, extension) {
  const rows = SHORING_SYSTEMS[systemKey]?.freeStanding?.[typeKey];
  if (!rows) return { capacity: null, tableHeight: null, status: 'invalid' };
  const row = rows.find((r) => r.ext === Number(extension));
  if (!row) return { capacity: null, tableHeight: null, status: 'invalid' };
  const h = Number(height);
  if (!(h > 0)) return { capacity: null, tableHeight: null, status: 'invalid' };
  if (h > row.height) {
    return { capacity: null, tableHeight: row.height, status: 'exceeds-max' };
  }
  return { capacity: row.cap, tableHeight: row.height, status: 'ok' };
}

/**
 * Evaluates every system/type configuration against the design leg load.
 *
 * @param {object} p
 * @param {number} p.height     Tower height [m]
 * @param {number} p.legLoad    Design load per leg F [kN]
 * @param {'topHeld'|'freeStanding'} [p.mode='topHeld']
 * @param {number} [p.extension=300]  Jack/U-head extension [mm] (free-standing only)
 * @returns {Array<object>} one row per configuration
 */
export function evaluateConfigurations({ height, legLoad, mode = 'topHeld', extension = 300 }) {
  const results = [];
  for (const systemKey of SYSTEM_KEYS) {
    const system = SHORING_SYSTEMS[systemKey];
    const types = Object.keys(system[mode === 'topHeld' ? 'topHeld' : 'freeStanding']);
    for (const typeKey of types) {
      const lookup = mode === 'topHeld'
        ? getTopHeldCapacity(systemKey, typeKey, height)
        : getFreeStandingCapacity(systemKey, typeKey, height, extension);
      const { capacity, tableHeight, status } = lookup;
      const utilization = capacity ? legLoad / capacity : null;
      results.push({
        system: systemKey,
        seriesLabel: system.series,
        type: typeKey,
        description: TYPE_DESCRIPTIONS[typeKey],
        capacity,
        tableHeight,
        status,
        utilization,
        pass: capacity !== null && utilization !== null && utilization <= 1.0,
      });
    }
  }
  return results;
}

/**
 * Chart series for one system: capacity vs tower height per type,
 * merged on the union of tabulated heights (linear interpolation between
 * tabulated points for plotting only).
 */
export function buildCapacityChartData(systemKey) {
  const system = SHORING_SYSTEMS[systemKey];
  if (!system) return { data: [], types: [] };
  const types = Object.keys(system.topHeld);
  const allHeights = [...new Set(types.flatMap((t) => system.topHeld[t].heights))].sort((a, b) => a - b);
  const data = allHeights.map((h) => {
    const point = { height: h };
    for (const t of types) {
      const { heights, capacities } = system.topHeld[t];
      if (h < heights[0] || h > heights[heights.length - 1]) continue;
      const idx = heights.findIndex((th) => th >= h - 1e-9);
      if (Math.abs(heights[idx] - h) < 1e-9) {
        point[t] = capacities[idx];
      } else {
        const h0 = heights[idx - 1];
        const h1 = heights[idx];
        const c0 = capacities[idx - 1];
        const c1 = capacities[idx];
        point[t] = Number((c0 + ((h - h0) / (h1 - h0)) * (c1 - c0)).toFixed(2));
      }
    }
    return point;
  });
  return { data, types };
}
