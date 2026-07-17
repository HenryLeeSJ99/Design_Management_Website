import { getPropCapacity } from './steelProp.js';
import { getTopHeldCapacity } from './shoringTower.js';

/**
 * Perform backpropping load distribution and structural capacity checks.
 * Spacing, heights, and shoring systems are calculated independently per level.
 * Handles Ground Slab toggling and calculates resultant forces on the foundation.
 *
 * @param {object} p
 * @param {number} p.pourThickness      Wet concrete slab thickness (mm)
 * @param {number} p.unitWeight         Wet concrete unit weight (kN/m³, default 25)
 * @param {number} p.formworkLoad       Formwork self-weight (kN/m², default 0.5)
 * @param {number} p.constructionLoad   Construction live load (kN/m², default 1.5)
 * @param {number} p.numFloors           Number of backpropped floors (1 to 6)
 * @param {Array<object>} p.floorConfigs Custom configuration for each cured slab level
 *                                       (from top slab 1 down to bottom slab N)
 * @returns {object} Calculated loads, floor-by-floor results, resultant foundation loads, and overall status
 */
export function calculateBackprop({
  pourThickness,
  unitWeight = 25,
  formworkLoad = 0.5,
  constructionLoad = 1.5,
  numFloors = 2,
  floorConfigs = [],
}) {
  const t_pour = Number(pourThickness) || 0;
  const uw = Number(unitWeight) || 25;
  const q_form = Number(formworkLoad) || 0.5;
  const q_const = Number(constructionLoad) || 1.5;
  const n = Number(numFloors) || 2;

  // 1. Wet concrete and total construction load on top
  const q_concrete = uw * (t_pour / 1000);
  const W_poured = q_concrete + q_form + q_const; // Total construction area load (kN/m²)

  // 2. Load distribution
  // Shared load per slab: W_poured is shared equally among the N cured slabs
  const slabLoadShare = W_poured / n;

  // Floor-by-floor evaluations (Floor index 0 = slab directly below pour, Floor index n-1 = bottom slab)
  const floorResults = [];
  let overallPass = true;

  for (let i = 0; i < n; i++) {
    const levelNumber = n - i; // Level index (e.g. Level 2, Level 1)
    
    // Fallback floor config if not provided
    const userCfg = floorConfigs[i] || {};
    const systemType = userCfg.systemType || 'prop';
    const selectedModel = userCfg.selectedModel || (systemType === 'prop' ? 'PA300' : 'WCL48-A');
    const s_l = Number(userCfg.spacingL) || 1.5;
    const s_w = Number(userCfg.spacingW) || 1.5;
    const h_prop = Number(userCfg.height) || 2.8;
    
    const ageFactor = Number(userCfg.ageFactor) !== undefined ? Number(userCfg.ageFactor) : (i === 0 ? 75 : 100);
    const deadCap = Number(userCfg.deadCapacity) !== undefined ? Number(userCfg.deadCapacity) : 1.5;
    const liveCap = Number(userCfg.liveCapacity) !== undefined ? Number(userCfg.liveCapacity) : 2.5;
    const slabThickness = Number(userCfg.slabThickness) || 300;
    const isGroundSlab = userCfg.isGroundSlab || false;

    // Tributary area per support at this level
    const tribArea = s_l * s_w;

    // Prop Force at this level (decreases linearly downwards)
    const propAreaLoad = W_poured * (levelNumber / n); // kN/m²
    const propDesignForce = propAreaLoad * tribArea; // kN

    // Look up support capacity
    let supportCap = null;
    let ultimateSupportCap = null;
    let supportStatus = 'invalid';

    if (systemType === 'prop') {
      const propRes = getPropCapacity(selectedModel, h_prop);
      supportCap = propRes.capacity;
      ultimateSupportCap = propRes.ultimateCapacity;
      supportStatus = propRes.status;
    } else {
      const [sysKey, typeKey] = (selectedModel || 'WCL48-A').split('-');
      const towerRes = getTopHeldCapacity(sysKey || 'WCL48', typeKey || 'A', h_prop);
      supportCap = towerRes.capacity;
      ultimateSupportCap = towerRes.capacity ? Number((towerRes.capacity * 1.65).toFixed(2)) : null;
      supportStatus = towerRes.status;
    }

    const propPass = supportCap !== null && propDesignForce <= supportCap && supportStatus !== 'exceeds-max';
    const propUtil = supportCap ? propDesignForce / supportCap : null;

    // Slab check (bypass if ground slab)
    let slabPermissibleCap = 0;
    let slabPass = true;
    let slabUtil = 0;

    if (isGroundSlab) {
      slabPermissibleCap = Infinity;
      slabPass = true;
      slabUtil = 0;
    } else {
      slabPermissibleCap = (deadCap + liveCap) * (ageFactor / 100);
      slabPass = slabLoadShare <= slabPermissibleCap;
      slabUtil = slabPermissibleCap > 0 ? slabLoadShare / slabPermissibleCap : null;
    }

    if (!propPass || !slabPass) {
      overallPass = false;
    }

    floorResults.push({
      level: levelNumber,
      // Layout parameters
      systemType,
      selectedModel,
      spacingL: s_l,
      spacingW: s_w,
      height: h_prop,
      tribArea,
      // Prop details
      propAreaLoad,
      propDesignForce,
      supportCap,
      ultimateSupportCap,
      propUtil,
      propPass,
      supportStatus,
      // Slab details
      slabThickness,
      ageFactor,
      deadCap,
      liveCap,
      slabLoadShare,
      slabPermissibleCap,
      slabUtil,
      slabPass,
      isGroundSlab,
    });
  }

  // Calculate resultant bottom load transferring to foundation
  // Lowest support level is index n - 1 (Props level 1)
  const lowestSupport = floorResults[n - 1] || {};
  const resultantAreaLoad = W_poured / n; // area load share at bottom (kN/m²)
  const resultantLegForce = resultantAreaLoad * (lowestSupport.tribArea || 2.25); // leg force in kN
  const resultantSpacingL = lowestSupport.spacingL || 1.5;
  const resultantSpacingW = lowestSupport.spacingW || 1.5;

  return {
    q_concrete,
    W_poured,
    slabLoadShare,
    floorResults,
    overallPass,
    resultantAreaLoad,
    resultantLegForce,
    resultantSpacingL,
    resultantSpacingW,
  };
}
