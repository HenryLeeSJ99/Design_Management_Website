/**
 * projectStore.js
 * Local, file-friendly persistence for the project's calculations.
 *
 * The project lives in localStorage under one key: a name plus an ordered
 * list of saved calculations. Each calculation snapshot is the calculator's
 * sessionStorage keys mapped to their raw JSON strings — the exact
 * representation calculators already hydrate from on mount, so "loading"
 * is: clear the calculator's keys, write the snapshot, remount.
 *
 * Everything can also be exported to / imported from plain .json files so
 * work can be backed up, shared, or moved between machines.
 */

export const PROJECT_STORAGE_KEY = 'tempworks_project';

const FILE_APP = 'tempworks-design';
const FILE_VERSION = 1;

// Registry of the calculators that support saved designs
export const CALCULATORS = {
  'multi-beam': {
    title: 'Multi Beam Span',
    route: '/calculators/multi-beam',
    prefix: 'tempworks_multibeam_',
  },
  'slab-formwork': {
    title: 'Slab Formwork',
    route: '/calculators/slab-formwork',
    prefix: 'tempworks_slabformwork_',
  },
  'wall-formwork': {
    title: 'Concrete Pressure',
    route: '/calculators/wall-formwork',
    prefix: 'tempworks_wallformwork_',
  },
  'shoring-tower': {
    title: 'Shoring Tower',
    route: '/calculators/shoring-tower',
    prefix: 'tempworks_shoringtower_',
  },
};

const generateId = () =>
  `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

// --- Cover page ---
// Every field on the printed title page that a person types. Stored on the
// project so it survives reloads and travels with an exported project file.

export const DEFAULT_COVER = {
  templateVersion: 'V3.2',
  companyRef: '',       // "P26023" — printed top-right as "PLYTEC Project Ref."
  issueDate: '',        // "June 2026"
  title: '',            // "WCL48 Shoring Design Calculation"
  subtitle: '',         // "for Level 2"
  projectName: '',
  projectReference: '',
  reportReference: '',
  revision: '',         // "rev01" — the revision this issue represents
  projectTitle: '',     // free-text paragraph describing the development
  peEndorsement: '',
  revisions: [],        // [{ no, preparer, preparerDate, checker, checkerDate }]
};

export const newRevisionRow = (no = '00') => ({
  no, preparer: '', preparerDate: '', checker: '', checkerDate: '',
});

/** Merge stored cover fields over the defaults so older saves stay valid. */
function normalizeCover(cover) {
  return {
    ...DEFAULT_COVER,
    ...(cover || {}),
    revisions: Array.isArray(cover?.revisions) ? cover.revisions : [],
  };
}

// --- Project store (localStorage) ---

export function getProject() {
  try {
    const raw = localStorage.getItem(PROJECT_STORAGE_KEY);
    const project = raw ? JSON.parse(raw) : null;
    return {
      name: project?.name || 'My Project',
      coverPage: !!project?.coverPage,
      cover: normalizeCover(project?.cover),
      // Ordered items: type 'calculation' (default for older saves), 'pdf' or 'drawing'
      calculations: Array.isArray(project?.calculations) ? project.calculations : [],
    };
  } catch {
    return { name: 'My Project', coverPage: false, cover: normalizeCover(), calculations: [] };
  }
}

function setProject(project) {
  localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(project));
}

export function setProjectName(name) {
  const project = getProject();
  setProject({ ...project, name });
}

export function setCoverPageEnabled(enabled) {
  const project = getProject();
  setProject({ ...project, coverPage: !!enabled });
}

/** Merge a patch of cover fields into the stored cover. */
export function setCover(patch) {
  const project = getProject();
  setProject({ ...project, cover: normalizeCover({ ...project.cover, ...patch }) });
}

/**
 * Has anything actually been typed on the cover? Excluding the cover from the
 * compiled PDF keeps the details, so the UI uses this to promise they are
 * still there rather than looking like they were thrown away.
 */
export function coverHasContent(cover) {
  const c = normalizeCover(cover);
  const typed = Object.entries(c).some(
    ([key, value]) => key !== 'revisions' && key !== 'templateVersion' && String(value || '').trim() !== '',
  );
  return typed || c.revisions.length > 0;
}

export const itemType = (item) => item.type || 'calculation';

export function listCalculations(calculator) {
  const { calculations } = getProject();
  const calcs = calculations.filter((c) => itemType(c) === 'calculation');
  return calculator ? calcs.filter((c) => c.calculator === calculator) : calcs;
}

/** Create (no id) or overwrite (with id) a calculation. Returns its id. */
export function saveCalculation({ id, name, calculator, data }) {
  const project = getProject();
  const now = Date.now();
  if (id) {
    project.calculations = project.calculations.map((c) =>
      c.id === id ? { ...c, name, calculator, data, updatedAt: now } : c,
    );
  } else {
    id = generateId();
    project.calculations.push({
      id, type: 'calculation', name, calculator, data, createdAt: now, updatedAt: now,
    });
  }
  setProject(project);
  return id;
}

/** Add a standalone PDF document to the project list. Returns its id. */
export function addPdfItem({ name, pdfId, pdfName, pdfSize }) {
  const project = getProject();
  const now = Date.now();
  const id = generateId();
  project.calculations.push({
    id, type: 'pdf', name, pdfId, pdfName, pdfSize, createdAt: now, updatedAt: now,
  });
  setProject(project);
  return id;
}

/** Add a plan drawing (a PDF that can carry markups). Returns its id. */
export function addDrawingItem({ name, pdfId, pdfName, pdfSize }) {
  const project = getProject();
  const now = Date.now();
  const id = generateId();
  project.calculations.push({
    id, type: 'drawing', name, pdfId, pdfName, pdfSize, markups: [], createdAt: now, updatedAt: now,
  });
  setProject(project);
  return id;
}

export const getMarkups = (item) => (Array.isArray(item?.markups) ? item.markups : []);

/**
 * Replace a drawing's markups. Called on every markup edit, so the engineer's
 * work on a drawing is saved as it happens rather than on an explicit save.
 */
export function setItemMarkups(id, markups) {
  const project = getProject();
  project.calculations = project.calculations.map((c) =>
    c.id === id ? { ...c, markups, updatedAt: Date.now() } : c,
  );
  setProject(project);
}

/** Every markup across all drawings that links to the given calculation id. */
export function findMarkupsForCalc(calcId) {
  const { calculations } = getProject();
  return calculations
    .filter((c) => itemType(c) === 'drawing')
    .flatMap((drawing) =>
      getMarkups(drawing)
        .filter((m) => m.calcId === calcId)
        .map((m) => ({ markup: m, drawing })),
    );
}

/** Attach (or replace) a report PDF on an existing item. */
export function setItemPdf(id, { pdfId, pdfName, pdfSize }) {
  const project = getProject();
  project.calculations = project.calculations.map((c) =>
    c.id === id ? { ...c, pdfId, pdfName, pdfSize, updatedAt: Date.now() } : c,
  );
  setProject(project);
}

/** Detach a report PDF (metadata only — bytes are the caller's to delete). */
export function clearItemPdf(id) {
  const project = getProject();
  project.calculations = project.calculations.map((c) => {
    if (c.id !== id) return c;
    const rest = { ...c, updatedAt: Date.now() };
    delete rest.pdfId;
    delete rest.pdfName;
    delete rest.pdfSize;
    return rest;
  });
  setProject(project);
}

// --- "Current design" marker ---
// Remembers which saved calculation is open in a calculator so its Report
// tab can attach the rendered PDF to the right project item. Lives in
// sessionStorage under the calculator's prefix, so applySnapshot() clears
// it and loading a different design can't leave a stale link behind.

const currentDesignKey = (calculator) => `${CALCULATORS[calculator].prefix}current_design`;

export function getCurrentDesign(calculator) {
  try {
    return JSON.parse(sessionStorage.getItem(currentDesignKey(calculator))) || null;
  } catch {
    return null;
  }
}

export function setCurrentDesign(calculator, { id, name }) {
  try {
    sessionStorage.setItem(currentDesignKey(calculator), JSON.stringify({ id, name }));
  } catch { /* session storage unavailable — attach will just prompt again */ }
}

export function renameItem(id, name) {
  const project = getProject();
  project.calculations = project.calculations.map((c) =>
    c.id === id ? { ...c, name, updatedAt: Date.now() } : c,
  );
  setProject(project);
}

export function deleteCalculation(id) {
  const project = getProject();
  project.calculations = project.calculations
    .filter((c) => c.id !== id)
    // A markup pointing at the deleted item would dangle, so unlink it. The
    // markup itself is the engineer's drawn work and stays on the drawing.
    .map((c) => {
      if (itemType(c) !== 'drawing') return c;
      const markups = getMarkups(c);
      if (!markups.some((m) => m.calcId === id)) return c;
      return {
        ...c,
        markups: markups.map((m) => (m.calcId === id ? { ...m, calcId: null } : m)),
      };
    });
  setProject(project);
}

/** Move the calculation at fromIndex to toIndex (project-wide order). */
export function moveCalculation(fromIndex, toIndex) {
  const project = getProject();
  const list = project.calculations;
  if (
    fromIndex === toIndex ||
    fromIndex < 0 || fromIndex >= list.length ||
    toIndex < 0 || toIndex >= list.length
  ) return list;
  const [moved] = list.splice(fromIndex, 1);
  list.splice(toIndex, 0, moved);
  setProject(project);
  return list;
}

// --- Loading snapshots into a calculator ---

/**
 * Copy the whole of sessionStorage.
 *
 * Compiling loads each saved calculation into its calculator to render the
 * report, which overwrites whatever the engineer currently has open. Capture
 * before, restoreSession() after, and compiling from the dashboard can never
 * cost someone their unsaved inputs.
 */
export function captureSession() {
  const saved = {};
  for (let i = 0; i < sessionStorage.length; i += 1) {
    const key = sessionStorage.key(i);
    saved[key] = sessionStorage.getItem(key);
  }
  return saved;
}

/** Put sessionStorage back exactly as captureSession() found it. */
export function restoreSession(saved) {
  const present = [];
  for (let i = 0; i < sessionStorage.length; i += 1) present.push(sessionStorage.key(i));
  // Drop keys the compile introduced, then restore the originals
  present.forEach((key) => { if (!(key in saved)) sessionStorage.removeItem(key); });
  Object.entries(saved).forEach(([key, value]) => sessionStorage.setItem(key, value));
}

/** Write a snapshot into sessionStorage, replacing the calculator's state. */
export function applySnapshot(calculator, data) {
  const prefix = CALCULATORS[calculator]?.prefix;
  if (prefix) {
    // Drop every key belonging to this calculator so stale state
    // (e.g. results not present in the snapshot) can't survive the load
    Object.keys(sessionStorage)
      .filter((key) => key.startsWith(prefix))
      .forEach((key) => sessionStorage.removeItem(key));
  }
  Object.entries(data || {}).forEach(([key, value]) => {
    if (typeof value === 'string') sessionStorage.setItem(key, value);
  });
}

// --- JSON file export / import ---

const safeFilename = (name) =>
  (name || 'design').replace(/[^\w-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'design';

export function downloadJson(filename, obj) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function readJsonFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read the file.'));
    reader.onload = () => {
      try {
        resolve(JSON.parse(reader.result));
      } catch {
        reject(new Error('The file is not valid JSON.'));
      }
    };
    reader.readAsText(file);
  });
}

export function exportCalculationFile({ name, calculator, data }) {
  downloadJson(`tempworks-${calculator}-${safeFilename(name)}.json`, {
    app: FILE_APP,
    kind: 'calculation',
    version: FILE_VERSION,
    name,
    calculator,
    savedAt: Date.now(),
    data,
  });
}

/** Validate a parsed file and return {name, calculator, data}. Throws on bad files. */
export function parseCalculationFile(obj) {
  if (obj?.app !== FILE_APP || obj?.kind !== 'calculation') {
    throw new Error('This is not a TempWorks calculation file.');
  }
  if (!CALCULATORS[obj.calculator]) {
    throw new Error(`Unknown calculator type "${obj.calculator}" in the file.`);
  }
  if (!obj.data || typeof obj.data !== 'object') {
    throw new Error('The file contains no design data.');
  }
  return { name: obj.name || 'Imported design', calculator: obj.calculator, data: obj.data };
}

export function exportProjectFile() {
  const project = getProject();
  downloadJson(`tempworks-project-${safeFilename(project.name)}.json`, {
    app: FILE_APP,
    kind: 'project',
    version: FILE_VERSION,
    exportedAt: Date.now(),
    project: {
      ...project,
      // The cover is typed data, so it travels in full. PDF bytes live in this
      // device's IndexedDB, so PDF and drawing items cannot — only calculations do.
      calculations: project.calculations.filter((c) => itemType(c) === 'calculation'),
    },
  });
}

/** Validate a parsed project file and REPLACE the stored project with it. */
export function importProjectFile(obj) {
  if (obj?.app !== FILE_APP || obj?.kind !== 'project') {
    throw new Error('This is not a TempWorks project file.');
  }
  const incoming = obj.project;
  if (!incoming || !Array.isArray(incoming.calculations)) {
    throw new Error('The project file contains no calculations.');
  }
  const calculations = incoming.calculations
    .filter((c) => c && itemType(c) === 'calculation' && CALCULATORS[c.calculator] && c.data && typeof c.data === 'object')
    .map((c) => ({
      id: c.id || generateId(),
      type: 'calculation',
      name: c.name || 'Untitled',
      calculator: c.calculator,
      data: c.data,
      createdAt: c.createdAt || Date.now(),
      updatedAt: c.updatedAt || Date.now(),
    }));
  setProject({
    name: incoming.name || 'My Project',
    coverPage: !!incoming.coverPage,
    cover: normalizeCover(incoming.cover),
    calculations,
  });
  return calculations.length;
}
