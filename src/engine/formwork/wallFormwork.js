/**
 * wallFormwork.js
 * 
 * Engine to calculate concrete pressure based on CIRIA 108:1985.
 */

/**
 * Calculate the max pressure given a rate of rise.
 */
export function calculatePressureCiria108({ D, T, H, h, R, C1 = 1.0, C2 = 0.3 }) {
  const K = Math.pow(36 / (T + 16), 2);
  const sqrtR = Math.sqrt(R);
  
  // When C1 * sqrt(R) > H, the fluid pressure (Dh) should be taken as the design pressure
  if (C1 * sqrtR > H) {
    return D * h;
  }

  const innerSqrt = H - C1 * sqrtR;
  const P_calc = D * (C1 * sqrtR + C2 * K * Math.sqrt(innerSqrt));
  const P_hydro = D * h;

  return Math.min(P_calc, P_hydro);
}

/**
 * Calculate the rate of rise given a target max pressure.
 * Uses a simple bisection method.
 */
export function solveRateOfRise({ D, T, H, h, P_target, C1 = 1.0, C2 = 0.3 }) {
  // If target pressure is greater than or equal to hydrostatic, 
  // then we can pour instantly (infinite rate of rise).
  if (P_target >= D * h) {
    return Infinity; // Or a very large number
  }

  let low = 0;
  let high = 100; // 100 m/h is a practical upper bound for search
  let iter = 0;
  let R_mid = 0;

  while (iter < 100 && high - low > 0.001) {
    R_mid = (low + high) / 2;
    const p = calculatePressureCiria108({ D, T, H, h, R: R_mid, C1, C2 });
    
    if (p < P_target) {
      low = R_mid;
    } else {
      high = R_mid;
    }
    iter++;
  }

  return R_mid;
}

/**
 * Generate chart data for the pressure distribution.
 */
export function generatePressureChartData(P_max, h, D) {
  const h_s = P_max / D;
  
  if (h_s >= h) {
    return [
      { height: 0, actualPressure: h * D, hydrostatic: h * D },
      { height: h, actualPressure: 0, hydrostatic: 0 }
    ];
  }

  return [
    { height: 0, actualPressure: P_max, hydrostatic: h * D },
    { height: Number((h - h_s).toFixed(3)), actualPressure: P_max, hydrostatic: Number((h_s * D).toFixed(3)) },
    { height: h, actualPressure: 0, hydrostatic: 0 }
  ];
}
