/**
 * localDb.js
 * An offline mock database using localStorage for TempWorks MVP.
 */

// Generate a random ID mimicking Firestore's
const generateId = () => Math.random().toString(36).substring(2, 15);

// Helper to get and set
const getDb = (key) => JSON.parse(localStorage.getItem(key) || '[]');
const setDb = (key, data) => localStorage.setItem(key, JSON.stringify(data));

// --- Projects ---

export const getProjects = async () => {
  // Simulate network delay
  await new Promise(r => setTimeout(r, 200));
  return getDb('projects').sort((a, b) => b.updatedAt - a.updatedAt);
};

export const getProjectById = async (id) => {
  await new Promise(r => setTimeout(r, 100));
  const projects = getDb('projects');
  return projects.find(p => p.id === id) || null;
};

export const saveProject = async (projectData) => {
  await new Promise(r => setTimeout(r, 200));
  const projects = getDb('projects');
  const now = Date.now();
  
  if (projectData.id) {
    // Update
    const index = projects.findIndex(p => p.id === projectData.id);
    if (index !== -1) {
      projects[index] = { ...projects[index], ...projectData, updatedAt: now };
    }
  } else {
    // Create
    const newProject = {
      ...projectData,
      id: generateId(),
      createdAt: now,
      updatedAt: now
    };
    projects.push(newProject);
  }
  
  setDb('projects', projects);
};

export const deleteProject = async (id) => {
  await new Promise(r => setTimeout(r, 200));
  const projects = getDb('projects');
  setDb('projects', projects.filter(p => p.id !== id));
  
  // Cascade delete design cases
  const cases = getDb('designCases');
  setDb('designCases', cases.filter(c => c.projectId !== id));
};


// --- Design Cases ---

export const getDesignCases = async (projectId) => {
  await new Promise(r => setTimeout(r, 100));
  const cases = getDb('designCases').filter(c => c.projectId === projectId);
  return cases.sort((a, b) => b.updatedAt - a.updatedAt);
};

export const getDesignCaseById = async (id) => {
  await new Promise(r => setTimeout(r, 100));
  const cases = getDb('designCases');
  return cases.find(c => c.id === id) || null;
};

export const saveDesignCase = async (caseData) => {
  await new Promise(r => setTimeout(r, 200));
  const cases = getDb('designCases');
  const now = Date.now();
  
  if (caseData.id) {
    // Update
    const index = cases.findIndex(c => c.id === caseData.id);
    if (index !== -1) {
      cases[index] = { ...cases[index], ...caseData, updatedAt: now };
    }
  } else {
    // Create
    // Auto-generate dcNumber if not provided
    const projectCases = cases.filter(c => c.projectId === caseData.projectId);
    const dcNumber = `DC-${String(projectCases.length + 1).padStart(3, '0')}`;
    
    const newCase = {
      ...caseData,
      id: generateId(),
      dcNumber,
      createdAt: now,
      updatedAt: now
    };
    cases.push(newCase);
  }
  
  setDb('designCases', cases);
};

export const deleteDesignCase = async (id) => {
  await new Promise(r => setTimeout(r, 200));
  const cases = getDb('designCases');
  setDb('designCases', cases.filter(c => c.id !== id));
};
