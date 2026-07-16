/**
 * @module mesher
 * @description Preprocesses user-defined physical spans and arbitrary loads (point loads,
 * partial UDLs) into smaller "internal elements" (sub-structuring). This allows
 * the matrix stiffness solver to handle complex load cases using simple formulas.
 */

/**
 * @typedef {Object} PhysicalSpan
 * @property {number} length - Span length in mm
 * @property {string} leftSupport - 'pin', 'fixed', 'roller', 'free'
 * @property {string} rightSupport - 'pin', 'fixed', 'roller', 'free'
 */

/**
 * @typedef {Object} PhysicalLoad
 * @property {string} type - 'point' | 'udl'
 * @property {number} spanIndex - 0-based index of the physical span
 * @property {number} posStart - position from left node (mm)
 * @property {number} [posEnd] - position from left node (mm), for partial UDLs
 * @property {number} magnitude - Load value (kN or kN/m). Positive = downward
 */

/**
 * @typedef {Object} MeshedData
 * @property {number[]} internalSpans - Lengths of internal elements (mm)
 * @property {Array<{type: string}>} internalSupports - Support conditions at every internal node
 * @property {number[]} nodalLoads - Downward point loads at each internal node (kN)
 * @property {Array<{w1: number, w2: number}>} elementLoads - Start and end UDL on each internal element (kN/m)
 * @property {number[]} physicalNodeIndices - Which internal nodes correspond to the original physical nodes
 */

/**
 * Slices physical spans into internal elements based on load discontinuities.
 * 
 * @param {PhysicalSpan[]} spans 
 * @param {PhysicalLoad[]} loads 
 * @returns {MeshedData}
 */
export function buildMesh(spans, loads) {
  // 1. Gather all "nodes" (slice points) for each physical span.
  // Everything is coerced to Number: span lengths / positions arriving as
  // strings (e.g. from controlled inputs) would otherwise coexist with
  // their numeric twins in the Set ("4500" !== 4500), producing
  // zero-length elements and misplaced supports.
  const spanSlicePoints = spans.map(s => new Set([0, Number(s.length)]));

  loads.forEach(load => {
    if (load.spanIndex < 0 || load.spanIndex >= spans.length) return;

    // Add slice points to exactly match load boundaries
    if (load.type === 'point') {
      const pos = load.pos ?? load.posStart;
      if (pos != null) spanSlicePoints[load.spanIndex].add(Number(pos));
    } else if (load.type === 'udl' || load.type === 'varying') {
      spanSlicePoints[load.spanIndex].add(Number(load.posStart));
      if (load.posEnd !== undefined && load.posEnd !== null) {
        spanSlicePoints[load.spanIndex].add(Number(load.posEnd));
      } else {
        spanSlicePoints[load.spanIndex].add(Number(spans[load.spanIndex].length)); // Full span
      }
    }
  });

  // Deduped, sorted slice points per span (epsilon filter guards against
  // floating-point near-duplicates creating zero-length elements)
  const spanPoints = spanSlicePoints.map((set) => {
    const raw = Array.from(set).map(Number).sort((a, b) => a - b);
    return raw.filter((p, i) => i === 0 || p - raw[i - 1] > 1e-9);
  });

  // 2. Build Internal Elements & Nodes
  const internalSpans = [];
  const internalSupports = [];
  const nodalLoads = [];
  const elementLoads = [];
  const physicalNodeIndices = [];
  
  let currentInternalNodeIdx = 0;

  for (let s = 0; s < spans.length; s++) {
    const physicalSpan = spans[s];
    const points = spanPoints[s];

    // Record physical node mapping
    physicalNodeIndices.push(currentInternalNodeIdx);
    
    // Left Support of this physical span
    if (s === 0) {
      internalSupports.push({ type: physicalSpan.leftSupport });
      nodalLoads.push(0);
    }

    // Build internal elements
    for (let i = 0; i < points.length - 1; i++) {
      const xStart = points[i];
      const xEnd = points[i + 1];
      const elemLength = xEnd - xStart;
      
      if (elemLength <= 0) continue; // Should not happen with Set, but safe check
      
      internalSpans.push(elemLength);
      
      // Right node of this internal element
      currentInternalNodeIdx++;
      
      const isPhysicalRightNode = (i === points.length - 2);
      
      if (isPhysicalRightNode) {
        internalSupports.push({ type: physicalSpan.rightSupport });
      } else {
        internalSupports.push({ type: 'free' }); // Internal cut, completely free
      }
      nodalLoads.push(0); // Initialize load array
      
      // Determine element load (UDL or varying)
      let w1 = 0;
      let w2 = 0;
      loads.forEach(load => {
        if ((load.type === 'udl' || load.type === 'varying') && load.spanIndex === s) {
          const lStart = Number(load.posStart);
          const lEnd = Number(load.posEnd !== undefined && load.posEnd !== null ? load.posEnd : physicalSpan.length);
          
          // If the element is strictly inside the load range
          if (xStart >= lStart - 1e-5 && xEnd <= lEnd + 1e-5) {
            if (load.type === 'udl') {
              w1 += load.magnitude;
              w2 += load.magnitude;
            } else if (load.type === 'varying') {
              const mStart = load.magnitude;
              const mEnd = load.magnitudeEnd !== undefined ? load.magnitudeEnd : load.magnitude;
              const getW = (x) => lEnd === lStart ? mStart : mStart + (mEnd - mStart) * (x - lStart) / (lEnd - lStart);
              
              w1 += getW(xStart);
              w2 += getW(xEnd);
            }
          }
        }
      });
      elementLoads.push({ w1, w2 });
    }
  }

  // Record the final physical right node
  physicalNodeIndices.push(currentInternalNodeIdx);

  // 3. Apply Point Loads
  loads.forEach(load => {
    if (load.type === 'point') {
      const rawPos = load.pos ?? load.posStart;
      if (rawPos == null) return;
      const loadPos = Number(rawPos);
      // Find which internal node this corresponds to
      let nodeIdx = physicalNodeIndices[load.spanIndex]; // Start of physical span

      // Step through internal elements in this span to find the exact node
      let currentX = 0;
      let elemIdx = 0;
      for (let i = 0; i < load.spanIndex; i++) {
        elemIdx += spanPoints[i].length - 1; // number of elements in previous spans
      }
      
      let foundNode = nodeIdx;
      for (let i = elemIdx; i < internalSpans.length; i++) {
        if (Math.abs(currentX - loadPos) < 1e-5) {
          foundNode = nodeIdx;
          break;
        }
        currentX += internalSpans[i];
        nodeIdx++;
        if (Math.abs(currentX - loadPos) < 1e-5) {
          foundNode = nodeIdx;
          break;
        }
      }
      
      nodalLoads[foundNode] += load.magnitude;
    }
  });

  return {
    internalSpans,
    internalSupports,
    nodalLoads,
    elementLoads,
    physicalNodeIndices
  };
}
