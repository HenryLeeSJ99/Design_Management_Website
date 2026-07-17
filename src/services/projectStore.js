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
  'wall-formwork-design': {
    title: 'Panel & Tie Design',
    route: '/calculators/wall-formwork/design',
    prefix: 'tempworks_wallfwdesign_',
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

// --- Zones ---
// A project (a building) is organised into zones — a level, a range of levels,
// or a poured section: "Level 2", "Levels 3-20 (Typical)", "Roof". Zones are
// first-class and ordered so one can exist empty, be renamed and reordered;
// each item carries a zoneId (null = unassigned), which keeps the flat item
// array intact so the rest of the app changes little.

const normalizeZones = (zones) =>
  (Array.isArray(zones) ? zones : [])
    .filter((z) => z && z.id)
    .map((z, i) => ({ id: z.id, name: z.name || 'Untitled zone', order: Number.isFinite(z.order) ? z.order : i }))
    .sort((a, b) => a.order - b.order)
    .map((z, i) => ({ ...z, order: i })); // re-index so order is always 0..n-1

// --- Project store (localStorage) ---

export function getProject() {
  try {
    const raw = localStorage.getItem(PROJECT_STORAGE_KEY);
    const project = raw ? JSON.parse(raw) : null;
    return {
      name: project?.name || 'My Project',
      coverPage: !!project?.coverPage,
      cover: normalizeCover(project?.cover),
      zones: normalizeZones(project?.zones),
      // Ordered items: type 'calculation' (default for older saves), 'pdf' or 'drawing'
      calculations: Array.isArray(project?.calculations) ? project.calculations : [],
    };
  } catch {
    return { name: 'My Project', coverPage: false, cover: normalizeCover(), zones: [], calculations: [] };
  }
}

/**
 * Anyone who needs to know the project changed — in practice projectSession,
 * which saves it back to the open .tw file.
 *
 * A listener rather than a direct call so this module stays the leaf: having
 * the store import the session, which already imports the store, would be a
 * cycle.
 */
const changeListeners = new Set();

export function onProjectChange(listener) {
  changeListeners.add(listener);
  return () => changeListeners.delete(listener);
}

function setProject(project) {
  localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(project));
  // A listener must never be able to break a save that already succeeded
  changeListeners.forEach((listener) => {
    try {
      listener(project);
    } catch { /* a broken listener is not the store's problem */ }
  });
}

/**
 * Replace the whole project at once — used by undo to write a snapshot back.
 * Goes through setProject so the change reaches the session and is saved.
 */
export function replaceProject(project) {
  setProject({
    name: project?.name || 'My Project',
    coverPage: !!project?.coverPage,
    cover: normalizeCover(project?.cover),
    zones: normalizeZones(project?.zones),
    calculations: Array.isArray(project?.calculations) ? project.calculations : [],
  });
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

// --- Zone CRUD ---

/** Add a zone at the end. Returns its id. */
export function addZone(name) {
  const project = getProject();
  const id = generateId();
  const zones = [...project.zones, { id, name: name || 'New zone', order: project.zones.length }];
  setProject({ ...project, zones: normalizeZones(zones) });
  return id;
}

export function renameZone(id, name) {
  const project = getProject();
  const zones = project.zones.map((z) => (z.id === id ? { ...z, name } : z));
  setProject({ ...project, zones: normalizeZones(zones) });
}

/** Delete a zone; its items fall back to unassigned rather than vanishing. */
export function deleteZone(id) {
  const project = getProject();
  setProject({
    ...project,
    zones: normalizeZones(project.zones.filter((z) => z.id !== id)),
    calculations: project.calculations.map((c) => (c.zoneId === id ? { ...c, zoneId: null } : c)),
  });
}

/** Move a zone from one position to another (reorders the divider sequence). */
export function moveZone(fromIndex, toIndex) {
  const project = getProject();
  const zones = [...project.zones];
  if (fromIndex < 0 || fromIndex >= zones.length || toIndex < 0 || toIndex >= zones.length) return;
  const [moved] = zones.splice(fromIndex, 1);
  zones.splice(toIndex, 0, moved);
  setProject({ ...project, zones: normalizeZones(zones.map((z, i) => ({ ...z, order: i }))) });
}

/** Assign an item to a zone (or null for unassigned). */
export function setItemZone(itemId, zoneId) {
  const project = getProject();
  setProject({
    ...project,
    calculations: project.calculations.map((c) => (c.id === itemId ? { ...c, zoneId: zoneId || null } : c)),
  });
}

/**
 * Items grouped for display and compilation: each zone in order with the items
 * assigned to it, then an unassigned group last. Within a group, items keep
 * their order in the flat calculations array — the single source of ordering.
 *
 * Returns [{ zone: {id,name} | null, items: [...] }]. A zone with no items is
 * still returned (so an empty zone shows on the dashboard); the unassigned
 * group is only returned when it actually has items.
 */
export function groupItemsByZone(project) {
  const p = project || getProject();
  const byZone = new Map(p.zones.map((z) => [z.id, []]));
  const unassigned = [];
  for (const item of p.calculations) {
    const bucket = item.zoneId && byZone.has(item.zoneId) ? byZone.get(item.zoneId) : unassigned;
    bucket.push(item);
  }
  const groups = p.zones.map((zone) => ({ zone, items: byZone.get(zone.id) }));
  if (unassigned.length) groups.push({ zone: null, items: unassigned });
  return groups;
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
  project.calculations = project.calculations.map((c) => {
    if (c.id !== id) return c;
    const updated = { ...c, name, updatedAt: Date.now() };
    if (updated.pdfId && itemType(c) === 'calculation') {
      delete updated.pdfId;
      delete updated.pdfName;
      delete updated.pdfSize;
    }
    return updated;
  });
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
      // The cover and zones are typed data, so they travel in full. PDF bytes
      // live in this device's IndexedDB, so PDF and drawing items cannot — only
      // calculations do (keeping their zoneId so the grouping survives).
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
      zoneId: c.zoneId || null,
      createdAt: c.createdAt || Date.now(),
      updatedAt: c.updatedAt || Date.now(),
    }));
  // Keep only zones that still have at least one surviving item, since drawings
  // and PDFs did not travel in the JSON export
  const liveZoneIds = new Set(calculations.map((c) => c.zoneId).filter(Boolean));
  setProject({
    name: incoming.name || 'My Project',
    coverPage: !!incoming.coverPage,
    cover: normalizeCover(incoming.cover),
    zones: normalizeZones(incoming.zones).filter((z) => liveZoneIds.has(z.id)),
    calculations,
  });
  return calculations.length;
}
