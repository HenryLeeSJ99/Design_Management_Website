/**
 * Quick verification of the beam solver against known analytical solutions.
 * Run with: node --experimental-modules solver.test.mjs
 */
import { solveBeam } from './src/engine/beam/solver.js';

const E = 210000;  // MPa
const I = 1000;    // cm⁴
const w = 10;      // kN/m

function approxEqual(a, b, tol = 0.01) {
  return Math.abs(a - b) < tol * Math.max(1, Math.abs(b));
}

function test(name, fn) {
  try {
    fn();
    console.log(`✅ ${name}`);
  } catch (err) {
    console.error(`❌ ${name}: ${err.message}`);
  }
}

// Test 1: Simply supported beam, L = 6000mm
test('Simply supported beam — M_max = wL²/8', () => {
  const L = 6000;
  const result = solveBeam({
    spans: [L],
    supports: [{ type: 'pin' }, { type: 'roller' }],
    nodalLoads: [0, 0],
    elementLoads: [w],
    E, I,
  });

  const L_m = L / 1000;
  const expectedM = w * L_m * L_m / 8;  // kNm
  const expectedV = w * L_m / 2;         // kN
  const expectedR = w * L_m / 2;         // kN

  console.log(`  M_max expected: ${expectedM.toFixed(2)} kNm, got: ${result.maxMoment.value.toFixed(2)} kNm`);
  console.log(`  V_max expected: ${expectedV.toFixed(2)} kN,  got: ${result.maxShear.value.toFixed(2)} kN`);
  console.log(`  R_left:  ${result.reactions[0].value.toFixed(2)} kN (expected ${expectedR.toFixed(2)})`);
  console.log(`  R_right: ${result.reactions[1].value.toFixed(2)} kN (expected ${expectedR.toFixed(2)})`);

  if (!approxEqual(result.maxMoment.value, expectedM)) throw new Error(`M_max mismatch`);
  if (!approxEqual(Math.abs(result.maxShear.value), expectedV)) throw new Error(`V_max mismatch`);
  if (!approxEqual(result.reactions[0].value, expectedR)) throw new Error(`R_left mismatch`);
  if (!approxEqual(result.reactions[1].value, expectedR)) throw new Error(`R_right mismatch`);

  // Deflection: 5wL⁴/(384EI)
  const w_Nmm = w * 1000 / 1000; // N/mm
  const I_mm4 = I * 10000;
  const expectedDefl = 5 * w_Nmm * Math.pow(L, 4) / (384 * E * I_mm4);
  console.log(`  δ_max expected: ${expectedDefl.toFixed(4)} mm, got: ${result.maxDeflection.value.toFixed(4)} mm`);
  if (!approxEqual(result.maxDeflection.value, expectedDefl)) throw new Error(`Deflection mismatch`);
});

// Test 2: Cantilever, L = 3000mm
test('Cantilever — M_max = wL²/2 at fixed end', () => {
  const L = 3000;
  const result = solveBeam({
    spans: [L],
    supports: [{ type: 'fixed' }, { type: 'free' }],
    nodalLoads: [0, 0],
    elementLoads: [w],
    E, I,
  });

  const L_m = L / 1000;
  const expectedM = w * L_m * L_m / 2;  // kNm (hogging, so negative in sagging convention)
  const expectedV = w * L_m;             // kN
  const expectedR = w * L_m;             // kN

  console.log(`  M_max expected: ±${expectedM.toFixed(2)} kNm, got: ${result.maxMoment.value.toFixed(2)} kNm`);
  console.log(`  V_max expected: ${expectedV.toFixed(2)} kN,  got: ${result.maxShear.value.toFixed(2)} kN`);
  console.log(`  Reaction: ${result.reactions[0].value.toFixed(2)} kN (expected ${expectedR.toFixed(2)})`);

  if (!approxEqual(Math.abs(result.maxMoment.value), expectedM)) throw new Error(`M_max mismatch`);
  if (!approxEqual(Math.abs(result.maxShear.value), expectedV)) throw new Error(`V_max mismatch`);
  if (!approxEqual(result.reactions[0].value, expectedR)) throw new Error(`Reaction mismatch`);

  // Deflection: wL⁴/(8EI)
  const w_Nmm = w * 1000 / 1000;
  const I_mm4 = I * 10000;
  const expectedDefl = w_Nmm * Math.pow(L, 4) / (8 * E * I_mm4);
  console.log(`  δ_max expected: ${expectedDefl.toFixed(4)} mm, got: ${result.maxDeflection.value.toFixed(4)} mm`);
  if (!approxEqual(Math.abs(result.maxDeflection.value), expectedDefl)) throw new Error(`Deflection mismatch`);
});

// Test 3: 2-span continuous beam, each span L = 4000mm
test('2-span continuous — center reaction = 5wL/4', () => {
  const L = 4000;
  const result = solveBeam({
    spans: [L, L],
    supports: [{ type: 'pin' }, { type: 'roller' }, { type: 'roller' }],
    nodalLoads: [0, 0, 0],
    elementLoads: [w, w],
    E, I,
  });

  const L_m = L / 1000;
  const totalLoad = w * 2 * L_m;                    // kN
  const expectedCenter = 5 * w * L_m / 4;           // kN (= 1.25 * wL)
  const expectedEnd = (totalLoad - expectedCenter) / 2; // kN each (= 3wL/8)

  console.log(`  Center reaction expected: ${expectedCenter.toFixed(2)} kN, got: ${result.reactions[1].value.toFixed(2)} kN`);
  console.log(`  Left reaction expected: ${expectedEnd.toFixed(2)} kN, got: ${result.reactions[0].value.toFixed(2)} kN`);
  console.log(`  Right reaction expected: ${expectedEnd.toFixed(2)} kN, got: ${result.reactions[2].value.toFixed(2)} kN`);

  if (!approxEqual(result.reactions[1].value, expectedCenter)) throw new Error(`Center reaction mismatch`);
  if (!approxEqual(result.reactions[0].value, expectedEnd)) throw new Error(`Left reaction mismatch`);
  if (!approxEqual(result.reactions[2].value, expectedEnd)) throw new Error(`Right reaction mismatch`);

  // Center moment should be -wL²/8 (hogging)
  const expectedCenterM = -w * L_m * L_m / 8;
  const centerMoment = result.spans[0].points[result.spans[0].points.length - 1].moment;
  console.log(`  Center moment expected: ${expectedCenterM.toFixed(2)} kNm, got: ${centerMoment.toFixed(2)} kNm`);
  if (!approxEqual(centerMoment, expectedCenterM)) throw new Error(`Center moment mismatch`);
});

console.log('\nAll tests complete.');
