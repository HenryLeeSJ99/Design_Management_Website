import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Layout from './components/Layout';
import CalcInstance from './components/CalcInstance';
import SplashScreen from './components/SplashScreen';
import RouteLoader from './components/RouteLoader';
import ErrorBoundary from './components/ErrorBoundary';
import { useState, useEffect, lazy, Suspense } from 'react';

// Route-level code splitting: each of these (and their dependencies -
// Chart.js, jsPDF, html2canvas) ships in its own chunk and only
// loads when the user actually navigates there.
const ProjectDashboard = lazy(() => import('./pages/ProjectDashboard'));
const NotFound = lazy(() => import('./pages/NotFound'));
const Projects = lazy(() => import('./pages/Projects'));
const ProjectDetails = lazy(() => import('./pages/ProjectDetails'));
const Library = lazy(() => import('./pages/Library'));
const MultiSpanBeamCalculator = lazy(() => import('./calculators/MultiSpanBeam/MultiSpanBeamCalculator'));
const MultiBeamCalculator = lazy(() => import('./pages/MultiBeamCalculator'));
const SlabFormworkCalculator = lazy(() => import('./pages/SlabFormworkCalculator'));
const WallFormworkCalculator = lazy(() => import('./pages/WallFormworkCalculator'));
const ShoringTowerCalculator = lazy(() => import('./pages/ShoringTowerCalculator'));

function App() {
  const [showSplash, setShowSplash] = useState(true);

  // A prior render reached this point successfully, so a chunk-load retry
  // is no longer "in flight" - clear the flag so a future genuine failure
  // gets its own automatic retry instead of being silently skipped.
  useEffect(() => {
    sessionStorage.removeItem('tw_chunk_reload_attempted');
  }, []);

  if (showSplash) {
    return <SplashScreen onFinish={() => setShowSplash(false)} />;
  }

  return (
    <Router>
      <ErrorBoundary>
        <Suspense fallback={<RouteLoader full />}>
          <Routes>
            {/* Main layout with nested routes */}
            <Route path="/" element={<Layout />}>
              {/* Default home → landing page */}
              <Route index element={<Home />} />

              {/* Project dashboard — saved calculations for the project */}
              <Route path="dashboard" element={<ProjectDashboard />} />

              {/* Calculator routes — CalcInstance lets "Load design" remount them */}
              <Route path="calculators/multi-beam" element={<CalcInstance><MultiBeamCalculator /></CalcInstance>} />
              <Route path="calculators/slab-formwork" element={<CalcInstance><SlabFormworkCalculator /></CalcInstance>} />
              <Route path="calculators/wall-formwork" element={<CalcInstance><WallFormworkCalculator /></CalcInstance>} />
              <Route path="calculators/shoring-tower" element={<CalcInstance><ShoringTowerCalculator /></CalcInstance>} />

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
      </ErrorBoundary>
    </Router>
  );
}

export default App;
