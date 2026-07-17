import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Home from './pages/Home';
import Layout from './components/Layout';
import CalcInstance from './components/CalcInstance';
import SplashScreen from './components/SplashScreen';
import RouteLoader from './components/RouteLoader';
import ErrorBoundary from './components/ErrorBoundary';
import DialogHost from './components/DialogHost';
import { useState, useEffect, lazy, Suspense } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './pages/Login';

// Autosave. projectSession registers `onProjectChange(() => touch())` when the
// module first loads, so autosave only exists on routes whose chunk pulls it
// in. That used to be Projects.jsx and ProjectOverview.jsx alone — meaning a
// designer landing straight on /dashboard or a calculator (refresh, bookmark,
// new tab, or Clear Cache & Reload) wrote to localStorage and NOTHING ever
// reached the cloud. Importing it here, from the entry chunk, makes autosave a
// property of the app rather than of which page you happened to arrive from.
// Side-effect import: it must not be tree-shaken away.
import './services/projectSession';

// Route-level code splitting: each of these (and their dependencies -
// Chart.js, jsPDF, html2canvas) ships in its own chunk and only
// loads when the user actually navigates there.
const Projects = lazy(() => import('./pages/Projects'));
const ProjectOverview = lazy(() => import('./pages/ProjectOverview'));
const ProjectDashboard = lazy(() => import('./pages/ProjectDashboard'));
const DrawingViewer = lazy(() => import('./pages/DrawingViewer'));
const NotFound = lazy(() => import('./pages/NotFound'));
const Settings = lazy(() => import('./pages/Settings'));
const MultiBeamCalculator = lazy(() => import('./pages/MultiBeamCalculator'));
const SlabFormworkCalculator = lazy(() => import('./pages/SlabFormworkCalculator'));
const WallFormworkCalculator = lazy(() => import('./pages/WallFormworkCalculator'));
const WallPanelDesignCalculator = lazy(() => import('./pages/WallPanelDesignCalculator'));
const ShoringTowerCalculator = lazy(() => import('./pages/ShoringTowerCalculator'));
const SteelPropCalculator = lazy(() => import('./pages/SteelPropCalculator'));

function AuthGuard({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <RouteLoader full />;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

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
    <AuthProvider>
      <Router>
        <ErrorBoundary>
          <Suspense fallback={<RouteLoader full />}>
            <Routes>
              {/* Login Page */}
              <Route path="/login" element={<Login />} />

              {/* Main layout with nested routes */}
              <Route path="/" element={<Layout />}>
                {/* Default home → landing page */}
                <Route index element={<Home />} />

                {/* Every project in the engineer's folder, one .tw file each */}
                <Route path="projects" element={<AuthGuard><Projects /></AuthGuard>} />

                {/* Project management view for one project — timeline and
                    status, for managers/team leaders/sales. The design work
                    itself lives in the workbook at /dashboard. */}
                <Route path="projects/:projectId" element={<AuthGuard><ProjectOverview /></AuthGuard>} />

                {/* Project dashboard — saved calculations for the open project */}
                <Route path="dashboard" element={<AuthGuard><ProjectDashboard /></AuthGuard>} />
                
                {/* User Settings */}
                <Route path="settings" element={<AuthGuard><Settings /></AuthGuard>} />

                {/* Plan drawing markup canvas — pdf.js ships in its own chunk */}
                <Route path="drawing/:itemId" element={<AuthGuard><DrawingViewer /></AuthGuard>} />

                {/* Calculator routes — CalcInstance lets "Load design" remount them */}
                <Route path="calculators/multi-beam" element={<CalcInstance><MultiBeamCalculator /></CalcInstance>} />
                <Route path="calculators/slab-formwork" element={<CalcInstance><SlabFormworkCalculator /></CalcInstance>} />
                <Route path="calculators/wall-formwork" element={<CalcInstance><WallFormworkCalculator /></CalcInstance>} />
                <Route path="calculators/wall-formwork/design" element={<CalcInstance><WallPanelDesignCalculator /></CalcInstance>} />
                <Route path="calculators/shoring-tower" element={<CalcInstance><ShoringTowerCalculator /></CalcInstance>} />
                <Route path="calculators/steel-prop" element={<CalcInstance><SteelPropCalculator /></CalcInstance>} />

                {/* 404 — catch-all nested under layout */}
                <Route path="*" element={<NotFound />} />
              </Route>

              {/* 404 — catch-all for top-level unknown paths */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
          {/* App-wide confirm/prompt dialogs, above every route and modal */}
          <DialogHost />
        </ErrorBoundary>
      </Router>
    </AuthProvider>
  );
}

export default App;
