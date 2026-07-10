import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Layout from './components/Layout';
import SplashScreen from './components/SplashScreen';
import NotFound from './pages/NotFound';
import { useState } from 'react';

import Projects from './pages/Projects';
import ProjectDetails from './pages/ProjectDetails';
import Library from './pages/Library';
import MultiSpanBeamCalculator from './calculators/MultiSpanBeam/MultiSpanBeamCalculator';
import MultiBeamCalculator from './pages/MultiBeamCalculator';
import SlabFormworkCalculator from './pages/SlabFormworkCalculator';
import WallFormworkCalculator from './pages/WallFormworkCalculator';

function PrivateRoute({ children }) {
  // Bypassing auth as requested by user
  return children;
}

function App() {
  const [showSplash, setShowSplash] = useState(true);

  if (showSplash) {
    return <SplashScreen onFinish={() => setShowSplash(false)} />;
  }

  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />

          {/* Main layout with nested routes */}
          <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
            {/* Default home → Multi-Beam Calculator */}
            <Route index element={<Navigate to="/calculators/multi-beam" replace />} />

            {/* Dashboard (legacy, kept for any internal links) */}
            <Route path="dashboard" element={<Dashboard />} />

            {/* Calculator routes */}
            <Route path="calculators/multi-beam" element={<MultiBeamCalculator />} />
            <Route path="calculators/slab-formwork" element={<SlabFormworkCalculator />} />
            <Route path="calculators/wall-formwork" element={<WallFormworkCalculator />} />

            {/* Legacy Routes */}
            <Route path="projects" element={<Projects />} />
            <Route path="projects/:projectId" element={<ProjectDetails />} />
            <Route path="projects/:projectId/case/:dcId" element={<MultiSpanBeamCalculator />} />
            <Route path="library" element={<Library />} />

            {/* 404 — catch-all nested under layout */}
            <Route path="*" element={<NotFound />} />
          </Route>

          {/* 404 — catch-all for top-level unknown paths */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
