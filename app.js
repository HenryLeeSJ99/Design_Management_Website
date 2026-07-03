/**
 * Formwork Beam Calculator — Main Application
 * Orchestrates UI, solver, mesher, design checks, rendering, and report.
 */

import { STEEL_GRADES, SECTIONS, getSectionByName } from './sections.js';
import { solveBeam } from './solver.js';
import { buildMesh } from './mesher.js';
import { performAllChecks } from './ec3-checks.js';
import { renderBeamDiagram, renderSFD, renderBMD, renderDeflection } from './renderer.js';
import { generateReport } from './report.js';

// ─── DOM References ───
const $tableGeometryBody = document.getElementById('tbodyGeometry');
const $tableLoadsBody = document.getElementById('tbodyLoads');
const $btnAddSpanRight = document.getElementById('btnAddSpanRight');
const $btnRemoveSpan = document.getElementById('btnRemoveSpan');
const $btnAddLoad = document.getElementById('btnAddLoad');

const $sectionTypeToggle = document.getElementById('sectionTypeToggle');
const $standardSectionInputs = document.getElementById('standardSectionInputs');
const $systemBeamInputs = document.getElementById('systemBeamInputs');
const $steelGrade = document.getElementById('steelGrade');
const $sectionCategory = document.getElementById('sectionCategory');
const $sectionName = document.getElementById('sectionName');
const $sectionPreview = document.getElementById('sectionPreview');
const $deflLimit = document.getElementById('deflLimit');
const $customDeflField = document.getElementById('customDeflField');
const $customDeflLimit = document.getElementById('customDeflLimit');
const $btnCalculate = document.getElementById('btnCalculate');
const $btnDownload = document.getElementById('btnDownload');
const $resultsPanel = document.getElementById('results-panel');

// ─── State ───
let currentSectionType = 'standard';
let lastResults = null;
let lastDesignChecks = null;
let lastInputData = null;

// Beam Builder State
let physicalSpans = [
  { length: 3000, leftSupport: 'pin', rightSupport: 'roller' }
];

let physicalLoads = [
  { type: 'udl', spanIndex: 0, posStart: 0, posEnd: null, magnitude: 10 }
];

const SUPPORT_OPTIONS = [
  { val: 'pin', label: 'Pin' },
  { val: 'roller', label: 'Roller' },
  { val: 'fixed', label: 'Fixed' },
  { val: 'free', label: 'Free' }
];

// ─── Initialisation ───
function init() {
  $btnAddSpanRight.addEventListener('click', addSpan);
  $btnRemoveSpan.addEventListener('click', removeSpan);
  $btnAddLoad.addEventListener('click', addLoad);
  
  $sectionCategory.addEventListener('change', populateSectionDropdown);
  $sectionName.addEventListener('change', onSectionNameChange);
  $deflLimit.addEventListener('change', onDeflLimitChange);
  $btnCalculate.addEventListener('click', onCalculate);
  $btnDownload.addEventListener('click', onDownloadReport);

  $sectionTypeToggle.querySelectorAll('.toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      $sectionTypeToggle.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentSectionType = btn.dataset.value;
      $standardSectionInputs.classList.toggle('hidden', currentSectionType !== 'standard');
      $systemBeamInputs.classList.toggle('hidden', currentSectionType !== 'system');
    });
  });

  populateSectionDropdown();
  renderGeometryTable();
  renderLoadsTable();
  updateMiniPreview();
  
  let resizePending = false;
  window.addEventListener('resize', () => {
    if (!resizePending) {
      resizePending = true;
      requestAnimationFrame(() => {
        updateMiniPreview();
        if (lastResults && !$resultsPanel.classList.contains('hidden')) {
          renderBeamDiagram(document.getElementById('canvasBeam'), lastInputData);
          renderSFD(document.getElementById('canvasSFD'), lastResults, null);
          renderBMD(document.getElementById('canvasBMD'), lastResults, null);
          renderDeflection(document.getElementById('canvasDeflection'), lastResults, null);
        }
        resizePending = false;
      });
    }
  });
}

function updateMiniPreview() {
  const canvas = document.getElementById('canvasMiniBeam');
  if (canvas) {
    renderBeamDiagram(canvas, { 
      physicalSpans, 
      physicalLoads, 
      mappedReactions: null,
      hideTitle: true
    });
  }
}

function showToast(message, type = 'warning') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.style.cssText = 'position: fixed; bottom: 20px; right: 20px; z-index: 9999; display: flex; flex-direction: column; gap: 10px; pointer-events: none;';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.style.cssText = `
    background: ${type === 'warning' ? 'var(--warning-color, #f59e0b)' : 'var(--success-color, #10b981)'};
    color: white;
    padding: 12px 20px;
    border-radius: 6px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    font-family: inherit;
    font-size: 14px;
    opacity: 0;
    transform: translateY(20px);
    transition: all 0.3s ease;
  `;
  toast.textContent = message;
  container.appendChild(toast);
  
  requestAnimationFrame(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';
  });
  
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// ─── Interactive Builder: Geometry ───
function renderGeometryTable() {
  $tableGeometryBody.innerHTML = '';
  physicalSpans.forEach((span, i) => {
    const tr = document.createElement('tr');
    
    // Span Name
    const tdSpan = document.createElement('td');
    tdSpan.dataset.label = 'Span';
    tdSpan.innerHTML = `<strong>Span ${i + 1}</strong>`;
    tr.appendChild(tdSpan);

    // Length
    const tdL = document.createElement('td');
    tdL.dataset.label = 'Length L (mm)';
    const inpL = document.createElement('input');
    inpL.type = 'number';
    inpL.min = '10';
    inpL.value = span.length;
    inpL.addEventListener('change', (e) => {
      const newLen = Math.max(10, parseFloat(e.target.value) || 3000);
      span.length = newLen;
      // Clamp loads that belong to this span
      physicalLoads.forEach(load => {
        if (load.spanIndex === i) {
          if (load.posStart > newLen) load.posStart = newLen;
          if (load.posEnd !== null && load.posEnd > newLen) load.posEnd = newLen;
          if (load.posEnd !== null && load.posEnd < load.posStart) load.posEnd = load.posStart;
        }
      });
      renderGeometryTable(); // Re-render to ensure limits and load dropdowns update
      renderLoadsTable();
    });
    tdL.appendChild(inpL);
    tr.appendChild(tdL);

    // Left Support
    const tdLeft = document.createElement('td');
    tdLeft.dataset.label = 'Left Support';
    if (i === 0) {
      const selLeft = document.createElement('select');
      SUPPORT_OPTIONS.forEach(opt => {
        const option = document.createElement('option');
        option.value = opt.val;
        option.textContent = opt.label;
        if (span.leftSupport === opt.val) option.selected = true;
        selLeft.appendChild(option);
      });
      selLeft.addEventListener('change', (e) => {
        span.leftSupport = e.target.value;
        updateMiniPreview();
      });
      tdLeft.appendChild(selLeft);
    } else {
      tdLeft.innerHTML = `<span style="color:var(--text-muted); font-style:italic">Continuous</span>`;
    }
    tr.appendChild(tdLeft);

    // Right Support
    const tdRight = document.createElement('td');
    tdRight.dataset.label = 'Right Support';
    const selRight = document.createElement('select');
    SUPPORT_OPTIONS.forEach(opt => {
      const option = document.createElement('option');
      option.value = opt.val;
      option.textContent = opt.label;
      if (span.rightSupport === opt.val) option.selected = true;
      selRight.appendChild(option);
    });
    selRight.addEventListener('change', (e) => {
      span.rightSupport = e.target.value;
      updateMiniPreview();
    });
    tdRight.appendChild(selRight);
    tr.appendChild(tdRight);

    $tableGeometryBody.appendChild(tr);
  });

  $btnRemoveSpan.disabled = physicalSpans.length <= 1;
  updateMiniPreview();
}

function addSpan() {
  if (physicalSpans.length >= 10) return alert("Maximum 10 spans allowed.");
  physicalSpans.push({
    length: physicalSpans[0].length,
    leftSupport: physicalSpans[physicalSpans.length - 1].rightSupport,
    rightSupport: 'roller'
  });
  renderGeometryTable();
  renderLoadsTable();
}

function removeSpan() {
  if (physicalSpans.length > 1) {
    physicalSpans.pop();
    // Validate loads (remove loads that were on the deleted span)
    physicalLoads = physicalLoads.filter(l => l.spanIndex < physicalSpans.length);
    renderGeometryTable();
    renderLoadsTable();
  }
}

// ─── Interactive Builder: Loads ───
function renderLoadsTable() {
  $tableLoadsBody.innerHTML = '';
  if (physicalLoads.length === 0) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td colspan="6" style="text-align:center; color:var(--text-muted)">No loads defined.</td>`;
    $tableLoadsBody.appendChild(tr);
    return;
  }

  physicalLoads.forEach((load, i) => {
    const tr = document.createElement('tr');
    
    // Type
    const tdType = document.createElement('td');
    tdType.dataset.label = 'Type';
    const selType = document.createElement('select');
    selType.innerHTML = `<option value="udl" ${load.type === 'udl' ? 'selected' : ''}>UDL</option>
                         <option value="point" ${load.type === 'point' ? 'selected' : ''}>PL</option>`;
    selType.addEventListener('change', (e) => {
      load.type = e.target.value;
      if (load.type === 'point') load.posEnd = null; // Point loads can't have end pos
      renderLoadsTable();
    });
    tdType.appendChild(selType);
    tr.appendChild(tdType);

    // Span Select
    const tdSpan = document.createElement('td');
    tdSpan.dataset.label = 'Span';
    const selSpan = document.createElement('select');
    physicalSpans.forEach((_, sIdx) => {
      selSpan.innerHTML += `<option value="${sIdx}" ${load.spanIndex === sIdx ? 'selected' : ''}>Span ${sIdx + 1}</option>`;
    });
    selSpan.addEventListener('change', (e) => {
      load.spanIndex = parseInt(e.target.value);
      updateMiniPreview();
    });
    tdSpan.appendChild(selSpan);
    tr.appendChild(tdSpan);

    // Pos Start
    const tdPosStart = document.createElement('td');
    tdPosStart.dataset.label = 'Start (mm)';
    const inpStart = document.createElement('input');
    inpStart.type = 'number';
    inpStart.min = '0';
    inpStart.value = load.posStart;
    inpStart.addEventListener('change', (e) => {
      const spanLen = physicalSpans[load.spanIndex].length;
      let val = Math.max(0, parseFloat(e.target.value) || 0);
      let clamped = false;
      if (val > spanLen) { val = spanLen; clamped = true; }
      load.posStart = val;
      if (load.posEnd !== null && load.posEnd < val) { load.posEnd = val; clamped = true; }
      
      if (clamped) {
        showToast('Load start position was autocorrected to fit within the span.');
        e.target.style.borderColor = 'orange';
      } else {
        e.target.style.borderColor = '';
      }
      
      renderLoadsTable();
      updateMiniPreview();
    });
    tdPosStart.appendChild(inpStart);
    tr.appendChild(tdPosStart);

    // Pos End (Only for UDL)
    const tdPosEnd = document.createElement('td');
    tdPosEnd.dataset.label = 'End (mm)';
    if (load.type === 'udl') {
      const inpEnd = document.createElement('input');
      inpEnd.type = 'number';
      inpEnd.min = '0';
      inpEnd.placeholder = "Full Span";
      inpEnd.value = load.posEnd !== null ? load.posEnd : '';
      inpEnd.addEventListener('change', (e) => {
        const valStr = e.target.value;
        const spanLen = physicalSpans[load.spanIndex].length;
        if (valStr === '') {
          load.posEnd = null;
        } else {
          let val = Math.max(0, parseFloat(valStr) || 0);
          let clamped = false;
          if (val > spanLen) { val = spanLen; clamped = true; }
          if (val < load.posStart) { val = load.posStart; clamped = true; }
          load.posEnd = val;
          
          if (clamped) {
            showToast('Load end position was autocorrected to fit within the span.');
            if (load.posEnd === load.posStart) {
              showToast('UDL length is now 0, so it will not be visible.', 'warning');
            }
          }
        }
        renderLoadsTable();
        updateMiniPreview();
      });
      tdPosEnd.appendChild(inpEnd);
    } else {
      tdPosEnd.innerHTML = `<span style="color:var(--text-muted)">—</span>`;
    }
    tr.appendChild(tdPosEnd);

    // Magnitude
    const tdMag = document.createElement('td');
    tdMag.dataset.label = 'Value';
    
    const magWrapper = document.createElement('div');
    magWrapper.style.display = 'flex';
    magWrapper.style.alignItems = 'center';
    magWrapper.style.gap = '8px';
    
    const inpMag = document.createElement('input');
    inpMag.type = 'number';
    inpMag.min = '0.1';
    inpMag.step = '0.1';
    inpMag.value = load.magnitude;
    inpMag.style.flex = '1';
    inpMag.addEventListener('change', (e) => {
      load.magnitude = parseFloat(e.target.value) || 0;
      updateMiniPreview();
    });
    
    const unitSpan = document.createElement('span');
    unitSpan.textContent = load.type === 'udl' ? 'kN/m' : 'kN';
    unitSpan.style.color = 'var(--text-muted)';
    unitSpan.style.fontSize = '0.85rem';
    unitSpan.style.whiteSpace = 'nowrap';
    
    magWrapper.appendChild(inpMag);
    magWrapper.appendChild(unitSpan);
    tdMag.appendChild(magWrapper);
    
    tr.appendChild(tdMag);

    // Remove
    const tdRemove = document.createElement('td');
    const btnRemove = document.createElement('button');
    btnRemove.className = 'btn-remove';
    btnRemove.innerHTML = '✖';
    btnRemove.addEventListener('click', () => {
      physicalLoads.splice(i, 1);
      renderLoadsTable();
    });
    tdRemove.appendChild(btnRemove);
    tr.appendChild(tdRemove);

    $tableLoadsBody.appendChild(tr);
  });
  
  updateMiniPreview();
}

function addLoad() {
  physicalLoads.push({
    type: 'point',
    spanIndex: 0,
    posStart: physicalSpans[0].length / 2,
    posEnd: null,
    magnitude: 5
  });
  renderLoadsTable();
}

// ─── Sections ───
function populateSectionDropdown() {
  const category = $sectionCategory.value;
  const sections = SECTIONS[category] || [];
  $sectionName.innerHTML = '';
  sections.forEach(sec => {
    const opt = document.createElement('option');
    opt.value = sec.name;
    opt.textContent = sec.name;
    $sectionName.appendChild(opt);
  });
  onSectionNameChange();
}

function onSectionNameChange() {
  const sec = getSectionByName($sectionCategory.value, $sectionName.value);
  if (!sec) {
    $sectionPreview.innerHTML = '<span style="color:var(--text-muted)">Select a section</span>';
    return;
  }
  $sectionPreview.innerHTML = `
    <div class="prop"><span class="prop-label">h</span><span class="prop-value">${sec.h} mm</span></div>
    <div class="prop"><span class="prop-label">b</span><span class="prop-value">${sec.b} mm</span></div>
    <div class="prop"><span class="prop-label">tw</span><span class="prop-value">${sec.tw} mm</span></div>
    <div class="prop"><span class="prop-label">tf</span><span class="prop-value">${sec.tf} mm</span></div>
    <div class="prop"><span class="prop-label">I<sub>y</sub></span><span class="prop-value">${sec.Iy} cm⁴</span></div>
    <div class="prop"><span class="prop-label">W<sub>pl,y</sub></span><span class="prop-value">${sec.Wpl_y} cm³</span></div>
  `;
}

function onDeflLimitChange() {
  $customDeflField.classList.toggle('hidden', $deflLimit.value !== 'custom');
}

function getDeflectionLimit() {
  return $deflLimit.value === 'custom' ? (parseFloat($customDeflLimit.value) || 360) : parseInt($deflLimit.value);
}

// ─── Calculate ───
function onCalculate() {
  try {
    if (physicalSpans.length === 0) return alert('Add at least one span.');
    if (physicalLoads.length === 0) return alert('Add at least one load.');

    let E, I, section, gradeName, isSystemBeam, systemCapacities;
    if (currentSectionType === 'standard') {
      isSystemBeam = false;
      gradeName = $steelGrade.value;
      const grade = STEEL_GRADES[gradeName];
      section = getSectionByName($sectionCategory.value, $sectionName.value);
      if (!section) return alert('Please select a valid section.');
      E = grade.E;
      I = section.Iy;
    } else {
      isSystemBeam = true;
      gradeName = null;
      section = null;
      E = parseFloat(document.getElementById('systemE').value) || 210000;
      I = parseFloat(document.getElementById('systemI').value) || 150;
      systemCapacities = {
        Mallow: parseFloat(document.getElementById('systemMallow').value),
        Vallow: parseFloat(document.getElementById('systemVallow').value),
        name: document.getElementById('systemBeamName').value || 'System Beam'
      };
    }

    // 1. Mesh the physical inputs into solver elements
    const meshed = buildMesh(physicalSpans, physicalLoads);

    // 2. Solve the beam
    const results = solveBeam({
      spans: meshed.internalSpans,
      supports: meshed.internalSupports,
      nodalLoads: meshed.nodalLoads,
      elementLoads: meshed.elementLoads,
      E, I
    });

    // We must map the reactions back to the physical nodes for rendering/reports
    const mappedReactions = [];
    meshed.physicalNodeIndices.forEach(internalIdx => {
      const rxn = results.reactions.find(r => Math.abs(r.x - results.nodes[internalIdx].x) < 1e-5);
      mappedReactions.push({
        x: results.nodes[internalIdx].x,
        value: rxn ? rxn.value : 0
      });
    });

    results.mappedReactions = mappedReactions;
    results.physicalSpans = physicalSpans;
    lastResults = results;

    const deflLimitRatio = getDeflectionLimit();
    const designChecks = performAllChecks(results, section, gradeName, deflLimitRatio, isSystemBeam, systemCapacities);
    lastDesignChecks = designChecks;

    // Cache physical data for renderer/report
    lastInputData = { physicalSpans, physicalLoads, mappedReactions };

    displayResults(results, designChecks, isSystemBeam, mappedReactions);

    $resultsPanel.classList.remove('hidden');
    // Ensure the DOM has updated layout before rendering canvases
    // A small delay isn't strictly necessary for classList, but getting rects might need it if it's display:none.
    // However, display:none removal is synchronous in browser layout.
    
    renderBeamDiagram(document.getElementById('canvasBeam'), lastInputData);
    makeCanvasInteractive('canvasSFD', renderSFD, results);
    makeCanvasInteractive('canvasBMD', renderBMD, results);
    makeCanvasInteractive('canvasDeflection', renderDeflection, results);

    $resultsPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });

  } catch (err) {
    console.error(err);
    alert('Calculation error: ' + err.message);
  }
}

function makeCanvasInteractive(canvasId, renderFunc, results) {
  const canvas = document.getElementById(canvasId);
  // Clone to remove old event listeners
  const newCanvas = canvas.cloneNode(true);
  canvas.parentNode.replaceChild(newCanvas, canvas);
  
  // Initial render without hover
  renderFunc(newCanvas, results, null);

  const totalLength = results.spans[results.spans.length - 1].endX;
  
  let isHovering = false;
  let hoverX = null;
  
  newCanvas.addEventListener('mousemove', (e) => {
    const rect = newCanvas.getBoundingClientRect();
    const marginL = 60;
    const marginR = 40;
    const plotW = rect.width - marginL - marginR;
    
    let localX = e.clientX - rect.left - marginL;
    if (localX < 0) localX = 0;
    if (localX > plotW) localX = plotW;

    hoverX = (localX / plotW) * totalLength;
    
    if (!isHovering) {
      isHovering = true;
      requestAnimationFrame(() => {
        renderFunc(newCanvas, results, hoverX);
        isHovering = false;
      });
    }
  });

  newCanvas.addEventListener('mouseleave', () => {
    hoverX = null;
    if (!isHovering) {
      isHovering = true;
      requestAnimationFrame(() => {
        renderFunc(newCanvas, results, null);
        isHovering = false;
      });
    }
  });
}

function displayResults(results, checks, isSystemBeam, mappedReactions) {
  const maxM = Math.abs(results.maxMoment.value);
  const maxV = Math.abs(results.maxShear.value);
  const maxD = Math.abs(results.maxDeflection.value);

  document.getElementById('valMoment').textContent = maxM.toFixed(2);
  document.getElementById('valShear').textContent = maxV.toFixed(2);
  document.getElementById('valDeflection').textContent = maxD.toFixed(2);

  const bendRatio = isSystemBeam ? checks.systemBeam.bendingCheck.ratio : checks.bending.ratio;
  const shearRatio = isSystemBeam ? checks.systemBeam.shearCheck.ratio : checks.shear.ratio;
  const deflRatio = checks.deflection.ratio;

  setRatio('ratioMoment', 'cardMoment', bendRatio);
  setRatio('ratioShear', 'cardShear', shearRatio);
  setRatio('ratioDeflection', 'cardDeflection', deflRatio);

  const $verdict = document.getElementById('valVerdict');
  const $cardVerdict = document.getElementById('cardVerdict');
  
  // Trigger pop animation
  $cardVerdict.classList.remove('pop-anim');
  void $cardVerdict.offsetWidth; // Force reflow
  $cardVerdict.classList.add('pop-anim');

  if (checks.overallPass) {
    $verdict.textContent = 'PASS';
    $verdict.className = 'card-value verdict-text verdict-pass';
    $cardVerdict.classList.add('pass');
    $cardVerdict.classList.remove('fail');
  } else {
    $verdict.textContent = 'FAIL';
    $verdict.className = 'card-value verdict-text verdict-fail';
    $cardVerdict.classList.add('fail');
    $cardVerdict.classList.remove('pass');
  }


  const $checksBody = document.getElementById('checksBody');
  $checksBody.innerHTML = '';

  if (!isSystemBeam && checks.classification) {
    addCheckRow($checksBody, 'Section Classification', `Class ${checks.classification.sectionClass}`, '—', '—',
      checks.classification.sectionClass <= 3 ? 'PASS' : 'Class 4');
  }

  const bendCap = isSystemBeam ? (parseFloat(document.getElementById('systemMallow').value) || 0) : checks.bending.Mc_Rd;
  const shearCap = isSystemBeam ? (parseFloat(document.getElementById('systemVallow').value) || 0) : checks.shear.Vc_Rd;
  
  addCheckRow($checksBody, `Bending`, `${maxM.toFixed(2)} kNm`, `${bendCap.toFixed(2)} kNm`, `${(bendRatio * 100).toFixed(1)}%`, (isSystemBeam ? checks.systemBeam.bendingCheck.pass : checks.bending.pass) ? 'PASS' : 'FAIL');
  addCheckRow($checksBody, `Shear`, `${maxV.toFixed(2)} kN`, `${shearCap.toFixed(2)} kN`, `${(shearRatio * 100).toFixed(1)}%`, (isSystemBeam ? checks.systemBeam.shearCheck.pass : checks.shear.pass) ? 'PASS' : 'FAIL');
  
  addCheckRow($checksBody, 'Deflection (SLS)', `${checks.deflection.actual.toFixed(2)} mm`, `${checks.deflection.allowable.toFixed(2)} mm`, `${(deflRatio * 100).toFixed(1)}%`, checks.deflection.pass ? 'PASS' : 'FAIL');
}

function setRatio(ratioId, cardId, ratio) {
  const $ratio = document.getElementById(ratioId);
  const $card = document.getElementById(cardId);
  $ratio.textContent = `${(ratio * 100).toFixed(1)}% utilised`;
  $ratio.className = ratio <= 1.0 ? 'card-ratio pass' : 'card-ratio fail';
}

function addCheckRow(tbody, check, demand, capacity, utilisation, status) {
  const tr = document.createElement('tr');
  tr.innerHTML = `<td>${check}</td><td>${demand}</td><td>${capacity}</td><td>${utilisation}</td><td class="${status === 'PASS' ? 'pass' : 'fail'}">${status}</td>`;
  tbody.appendChild(tr);
}

// ─── Download Report ───
async function onDownloadReport() {
  if (!lastResults) return alert('Calculate first.');
  const projectInfo = {
    projectName: document.getElementById('projectName').value || 'Untitled',
    engineerName: document.getElementById('engineerName').value || '—',
    date: new Date().toLocaleDateString()
  };
  
  const loadsStr = physicalLoads.map(l => {
    if (l.type === 'udl') return `Span ${l.spanIndex + 1}: ${l.magnitude} kN/m`;
    return `Span ${l.spanIndex + 1}: ${l.magnitude} kN at ${l.posStart}mm`;
  }).join('; ');

  const reportInput = {
    configuration: 'Custom Interactive',
    spans: physicalSpans.map(s => s.length),
    loadsStr: loadsStr,
    sectionType: currentSectionType,
    sectionName: currentSectionType === 'standard' ? `${$sectionCategory.value} ${$sectionName.value}` : document.getElementById('systemBeamName').value,
    gradeName: currentSectionType === 'standard' ? $steelGrade.value : '—',
    deflectionLimit: getDeflectionLimit(),
    isSystemBeam: currentSectionType === 'system',
  };

  const canvasElements = {
    beamDiagram: document.getElementById('canvasBeam'),
    sfd: document.getElementById('canvasSFD'),
    bmd: document.getElementById('canvasBMD'),
    deflection: document.getElementById('canvasDeflection')
  };
  await generateReport(projectInfo, reportInput, lastResults, lastDesignChecks, canvasElements);
}

document.addEventListener('DOMContentLoaded', init);
