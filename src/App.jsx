import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import Home from './pages/Home';
import Layout from './components/Layout';
import SplashScreen from './components/SplashScreen';
import RouteLoader from './components/RouteLoader';
import { useState, lazy, Suspense } from 'react';

// Route-level code splitting: each of these (and their dependencies -
// Firebase, Chart.js, jsPDF, html2canvas) ships in its own chunk and only
// loads when the user actually navigates there.
const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const NotFound = lazy(() => import('./pages/NotFound'));
const Projects = lazy(() => import('./pages/Projects'));
const ProjectDetails = lazy(() => import('./pages/ProjectDetails'));
const Library = lazy(() => import('./pages/Library'));
const MultiSpanBeamCalculator = lazy(() => import('./calculators/MultiSpanBeam/MultiSpanBeamCalculator'));
const MultiBeamCalculator = lazy(() => import('./pages/MultiBeamCalculator'));
const SlabFormworkCalculator = lazy(() => import('./pages/SlabFormworkCalculator'));
const WallFormworkCalculator = lazy(() => import('./pages/WallFormworkCalculator'));

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
        <Suspense fallback={<RouteLoader full />}>
          <Routes>
            <Route path="/login" element={<Login />} />

            {/* Main layout with nested routes */}
            <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
              {/* Default home → landing page */}
              <Route index element={<Home />} />

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
        </Suspense>
      </Router>
    </AuthProvider>
  );
}

export default App;
