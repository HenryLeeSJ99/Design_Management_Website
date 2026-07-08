import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Layout from './components/Layout';

import Projects from './pages/Projects';
import ProjectDetails from './pages/ProjectDetails';
import Library from './pages/Library';
import MultiSpanBeamCalculator from './calculators/MultiSpanBeam/MultiSpanBeamCalculator';
import MultiBeamCalculator from './pages/MultiBeamCalculator';
import SlabFormworkCalculator from './pages/SlabFormworkCalculator';

function PrivateRoute({ children }) {
  // Bypassing auth as requested by user
  return children;
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
            <Route index element={<Navigate to="/dashboard" />} />
            <Route path="dashboard" element={<Dashboard />} />
            
            {/* New MVP Calculator Routes */}
            <Route path="calculators/multi-beam" element={<MultiBeamCalculator />} />
            <Route path="calculators/slab-formwork" element={<SlabFormworkCalculator />} />
            
            {/* Legacy Routes */}
            <Route path="projects" element={<Projects />} />
            <Route path="projects/:projectId" element={<ProjectDetails />} />
            <Route path="projects/:projectId/case/:dcId" element={<MultiSpanBeamCalculator />} />
            <Route path="library" element={<Library />} />
          </Route>
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
