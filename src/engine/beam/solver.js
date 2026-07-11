/**
 * @module solver
 * @description Core structural analysis engine using the Direct Stiffness Method
 * (Matrix Analysis) for 2D Euler-Bernoulli beams.
 */

/**
 * @typedef {Object} BeamResults
 * @property {Array<{x: number, displacement: number, rotation: number, reaction: number}>} nodes
 * @property {Array<{startX: number, endX: number, length: number, points: Array<{x: number, moment: number, shear: number, deflection: number}>}>} spans
 * @property {{value: number, x: number}} maxMoment
 * @property {{value: number, x: number}} maxShear
 * @property {{value: number, x: number}} maxDeflection
 * @property {Array<{x: number, value: number}>} reactions
 */

/**
 * Solves the continuous beam using the Matrix Stiffness Method.
 *
 * @param {Object} params
 * @param {number[]} params.spans - Array of span lengths in mm
 * @param {Array<{type: 'pin'|'roller'|'fixed'|'free'}>} params.supports - Support conditions
 * @param {number[]} params.nodalLoads - Downward point loads at each node (kN)
 * @param {number[]} params.elementLoads - Downward full-span UDL on each element (kN/m)
 * @param {number} params.E - Modulus of elasticity in MPa (N/mm²)
 * @param {number} params.I - Moment of inertia in cm⁴
 * @returns {BeamResults} Analysis results
 */
export function solveBeam({ spans, supports, nodalLoads, elementLoads, E, I }) {
  const numSpans = spans.length;
  const numNodes = numSpans + 1;
  const totalDOFs = numNodes * 2;

  // Convert properties to consistent units (N, mm)
  const I_mm4 = I * 1e4;
  const EI = E * I_mm4;

  const nodeX = new Array(numNodes);
  nodeX[0] = 0;
  for (let i = 0; i < numSpans; i++) {
    nodeX[i + 1] = nodeX[i] + spans[i];
  }

  // 1: Assemble global stiffness matrix and global fixed-end force vector
  const K = createMatrix(totalDOFs, totalDOFs);
  const F_fixed = new Array(totalDOFs).fill(0);

  for (let e = 0; e < numSpans; e++) {
    const L = spans[e];
    const w = elementLoads[e]; // N/mm (since 1 kN/m = 1 N/mm)
    const ke = elementStiffnessMatrix(EI, L);
    const fe = fixedEndForces(w, L);

    // DOF mapping: node e → [2e, 2e+1], node e+1 → [2e+2, 2e+3]
    const dofMap = [2 * e, 2 * e + 1, 2 * e + 2, 2 * e + 3];

    for (let i = 0; i < 4; i++) {
      F_fixed[dofMap[i]] += fe[i];
      for (let j = 0; j < 4; j++) {
        K[dofMap[i]][dofMap[j]] += ke[i][j];
      }
    }
  }

  // 2: Identify restrained and free DOFs
  const restrainedDOFs = new Set();
  for (let n = 0; n < numNodes; n++) {
    const supportType = supports[n].type;
    if (supportType === 'pin' || supportType === 'roller') {
      restrainedDOFs.add(2 * n);
    } else if (supportType === 'fixed') {
      restrainedDOFs.add(2 * n);
      restrainedDOFs.add(2 * n + 1);
    }
  }

  const freeDOFs = [];
  for (let i = 0; i < totalDOFs; i++) {
    if (!restrainedDOFs.has(i)) {
      freeDOFs.push(i);
    }
  }

  // 3: Build reduced system
  const nFree = freeDOFs.length;
  const K_ff = createMatrix(nFree, nFree);
  const RHS = new Array(nFree).fill(0);

  for (let i = 0; i < nFree; i++) {
    const dof = freeDOFs[i];
    const isVertical = dof % 2 === 0;
    const nodeIdx = Math.floor(dof / 2);
    const pExt = isVertical ? -(nodalLoads[nodeIdx] * 1000) : 0; // kN -> N, downward load is negative in Y-up

    // RHS = P_ext - F_fixed
    RHS[i] = pExt - F_fixed[dof];
    
    for (let j = 0; j < nFree; j++) {
      K_ff[i][j] = K[dof][freeDOFs[j]];
    }
  }

  // 4: Solve
  const u_free = nFree > 0 ? gaussianElimination(K_ff, RHS) : [];
  const u = new Array(totalDOFs).fill(0);
  for (let i = 0; i < nFree; i++) {
    u[freeDOFs[i]] = u_free[i];
  }

  return buildResults(u, F_fixed, K, nodeX, spans, supports, EI, elementLoads, restrainedDOFs, nodalLoads);
}

function elementStiffnessMatrix(EI, L) {
  const L2 = L * L;
  const L3 = L2 * L;
  const c = EI / L3;

  return [
    [12 * c,      6 * L * c,    -12 * c,      6 * L * c   ],
    [6 * L * c,   4 * L2 * c,   -6 * L * c,   2 * L2 * c  ],
    [-12 * c,    -6 * L * c,     12 * c,      -6 * L * c  ],
    [6 * L * c,   2 * L2 * c,   -6 * L * c,   4 * L2 * c  ],
  ];
}

function fixedEndForces(w, L) {
  // For a downward load w (positive magnitude), actual load is -w.
  // Fixed-end reactions (to hold nodes at 0 displacement) in Y-up system:
  // R1(up) = +wL/2, M1(ccw) = +wL^2/12, R2(up) = +wL/2, M2(cw) = -wL^2/12
  const wL = w * L;
  const wL2 = w * L * L;
  return [
     wL / 2,
     wL2 / 12,
     wL / 2,
    -wL2 / 12,
  ];
}

function gaussianElimination(A, b) {
  const n = A.length;
  const M = A.map(row => [...row]);
  const rhs = [...b];

  for (let col = 0; col < n; col++) {
    let maxVal = Math.abs(M[col][col]);
    let maxRow = col;
    for (let row = col + 1; row < n; row++) {
      const absVal = Math.abs(M[row][col]);
      if (absVal > maxVal) {
        maxVal = absVal;
        maxRow = row;
      }
    }

    if (maxRow !== col) {
      [M[col], M[maxRow]] = [M[maxRow], M[col]];
      [rhs[col], rhs[maxRow]] = [rhs[maxRow], rhs[col]];
    }

    const pivot = M[col][col];
    for (let row = col + 1; row < n; row++) {
      const factor = M[row][col] / pivot;
      rhs[row] -= factor * rhs[col];
      for (let j = col; j < n; j++) {
        M[row][j] -= factor * M[col][j];
      }
    }
  }

  const x = new Array(n).fill(0);
  for (let row = n - 1; row >= 0; row--) {
    let sum = rhs[row];
    for (let j = row + 1; j < n; j++) {
      sum -= M[row][j] * x[j];
    }
    x[row] = sum / M[row][row];
  }

  return x;
}

function multiplyMatrixVector(K, u) {
  return K.map(row => row.reduce((sum, val, j) => sum + val * u[j], 0));
}

function buildResults(u, F_fixed, K, nodeX, spans, supports, EI, elementLoads, restrainedDOFs, nodalLoads) {
  const totalDOFs = u.length;
  const numNodes = nodeX.length;
  const numSpans = spans.length;
  
  // Compute global force vector: F = K · u + F_fixed
  const F_global = multiplyMatrixVector(K, u);
  for (let i = 0; i < totalDOFs; i++) {
    F_global[i] += F_fixed[i];
  }

  const nodes = [];
  const reactions = [];

  for (let n = 0; n < numNodes; n++) {
    const vDOF = 2 * n;
    const thetaDOF = 2 * n + 1;
    const displacement = u[vDOF];
    const rotation = u[thetaDOF];

    let reactionForce = 0;
    if (restrainedDOFs.has(vDOF)) {
      // F_global is the total force (Ku + F_fixed) required at the node.
      // If it's positive, the support must pull UPWARD (positive reaction).
      // We must also subtract any applied nodal load at the support (which was downward = negative).
      const appliedLoad = -(nodalLoads[n] * 1000 || 0); // N
      reactionForce = (F_global[vDOF] - appliedLoad) / 1000; // kN
    }

    nodes.push({
      x: nodeX[n],
      displacement,
      rotation,
      reaction: reactionForce,
    });

    if (restrainedDOFs.has(vDOF)) {
      reactions.push({ x: nodeX[n], value: reactionForce });
    }
  }

  let maxMoment = { value: 0, x: 0 };
  let maxShear = { value: 0, x: 0 };
  let maxDeflection = { value: 0, x: 0 };

  const spanResults = [];

  for (let e = 0; e < numSpans; e++) {
    const L = spans[e];
    const startX = nodeX[e];
    const endX = nodeX[e + 1];
    const w = elementLoads[e]; // N/mm (positive = downward)

    const v1 = u[2 * e];
    const theta1 = u[2 * e + 1];
    const v2 = u[2 * e + 2];
    const theta2 = u[2 * e + 3];

    const ke = elementStiffnessMatrix(EI, L);
    const fe = fixedEndForces(w, L);
    const ue = [v1, theta1, v2, theta2];

    const f_elem = new Array(4).fill(0);
    for (let i = 0; i < 4; i++) {
      f_elem[i] = fe[i];
      for (let j = 0; j < 4; j++) {
        f_elem[i] += ke[i][j] * ue[j];
      }
    }

    // Standard sign convention for internal forces:
    // f_elem[0] is UPWARD force on left node. So V(0) = f_elem[0]
    // f_elem[1] is CCW moment on left node. So Sagging M(0) = -f_elem[1]
    const P_left = f_elem[0];
    const M_left = -f_elem[1];

    const numPoints = 50;
    const points = [];

    for (let p = 0; p <= numPoints; p++) {
      const xi = p / numPoints;
      const x_local = xi * L;
      const x_global = startX + x_local;

      const V_N = P_left - w * x_local;
      const V_kN = V_N / 1000;

      const M_Nmm = M_left + P_left * x_local - w * x_local * x_local / 2;
      const M_kNm = M_Nmm / 1e6;

      const xi2 = xi * xi;
      const xi3 = xi2 * xi;

      const N1 = 1 - 3 * xi2 + 2 * xi3;
      const N2 = L * (xi - 2 * xi2 + xi3);
      const N3 = 3 * xi2 - 2 * xi3;
      const N4 = L * (-xi2 + xi3);

      const v_shape = N1 * v1 + N2 * theta1 + N3 * v2 + N4 * theta2;
      // Downward load (w) produces downward (-) particular deflection
      const v_particular = -(w * L * L * L * L) / (24 * EI) * xi2 * (1 - xi) * (1 - xi);

      const deflection = v_shape + v_particular;

      points.push({
        x: x_global,
        moment: M_kNm,
        shear: V_kN,
        deflection,
      });

      if (Math.abs(M_kNm) > Math.abs(maxMoment.value)) {
        maxMoment = { value: M_kNm, x: x_global };
      }
      if (Math.abs(V_kN) > Math.abs(maxShear.value)) {
        maxShear = { value: V_kN, x: x_global };
      }
      if (Math.abs(deflection) > Math.abs(maxDeflection.value)) {
        maxDeflection = { value: deflection, x: x_global };
      }
    }

    spanResults.push({
      startX,
      endX,
      length: L,
      points,
    });
  }

  return {
    nodes,
    spans: spanResults,
    maxMoment,
    maxShear,
    maxDeflection,
    reactions,
  };
}

function createMatrix(rows, cols) {
  const m = new Array(rows);
  for (let i = 0; i < rows; i++) {
    m[i] = new Array(cols).fill(0);
  }
  return m;
}
