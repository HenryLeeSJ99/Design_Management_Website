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
const Projects = lazy(() => import('./pages/Projects'));
const ProjectDashboard = lazy(() => import('./pages/ProjectDashboard'));
const DrawingViewer = lazy(() => import('./pages/DrawingViewer'));
const NotFound = lazy(() => import('./pages/NotFound'));
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

              {/* Every project in the engineer's folder, one .tw file each */}
              <Route path="projects" element={<Projects />} />

              {/* Project dashboard — saved calculations for the open project */}
              <Route path="dashboard" element={<ProjectDashboard />} />

              {/* Plan drawing markup canvas — pdf.js ships in its own chunk */}
              <Route path="drawing/:itemId" element={<DrawingViewer />} />

              {/* Calculator routes — CalcInstance lets "Load design" remount them */}
              <Route path="calculators/multi-beam" element={<CalcInstance><MultiBeamCalculator /></CalcInstance>} />
              <Route path="calculators/slab-formwork" element={<CalcInstance><SlabFormworkCalculator /></CalcInstance>} />
              <Route path="calculators/wall-formwork" element={<CalcInstance><WallFormworkCalculator /></CalcInstance>} />
              <Route path="calculators/shoring-tower" element={<CalcInstance><ShoringTowerCalculator /></CalcInstance>} />

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
