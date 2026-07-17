# Graph Report - Design_Management_Website  (2026-07-18)

## Corpus Check
- 96 files · ~114,682 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 641 nodes · 1599 edges · 29 communities (24 shown, 5 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 15 edges (avg confidence: 0.81)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `f842a9cf`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Project Dashboard & Documents
- Beam Solver Engine
- checks.js
- App Routing & Shell
- Markup Geometry
- Dependencies
- Multi-Span Beam UI
- Graphics Layout Core
- projectFiles.js
- Slab Formwork Load Path
- HTML App Shell
- checks.js
- dialog.js
- Automatic Report Rendering
- Project Readme
- Vite Config
- ResetPassword.jsx
- CLAUDE.md
- Layout.jsx
- useAuth
- AuthContext.jsx
- ErrorBoundary
- autosaveWiring.test.mjs
- Overview.jsx
- projectFiles.test.mjs
- MultiBeamCalculator.jsx

## God Nodes (most connected - your core abstractions)
1. `ProjectDashboard()` - 46 edges
2. `getProject()` - 41 edges
3. `Projects()` - 24 edges
4. `ProjectOverview()` - 22 edges
5. `setProject()` - 22 edges
6. `SavedDesigns()` - 20 edges
7. `useAuth()` - 17 edges
8. `solveBeam()` - 16 edges
9. `shareReportPdf()` - 15 edges
10. `saveNow()` - 14 edges

## Surprising Connections (you probably didn't know these)
- `renderReportPdf()` --references--> `jspdf`  [EXTRACTED]
  src/utils/reportPdf.js → package.json
- `renderReportPdfBlob()` --references--> `jspdf`  [EXTRACTED]
  src/utils/reportPdf.js → package.json
- `shareReportPdf()` --references--> `jspdf`  [EXTRACTED]
  src/utils/reportPdf.js → package.json
- `AuthGuard()` --calls--> `useAuth()`  [EXTRACTED]
  src/App.jsx → src/contexts/AuthContext.jsx
- `ProjectContextBar()` --indirect_call--> `getProject()`  [INFERRED]
  src/components/ProjectContextBar.jsx → src/services/projectStore.js

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Client Bootstrap and Stale-Cache Recovery Flow** — index_app_shell, index_root_mount, index_main_jsx_entry, index_stale_cache_failsafe, index_reload_attempt_guard [INFERRED 0.85]
- **Browser Presentation and Discovery Metadata** — index_seo_open_graph_metadata, index_favicon_svg, index_viewport_zoom_policy, index_tempworks_product_identity [INFERRED 0.75]
- **Slab Formwork Vertical Load Path** — src_assets_slab_diagram_concrete_slab, src_assets_slab_diagram_plywood_decking, src_assets_slab_diagram_secondary_beam, src_assets_slab_diagram_primary_beam, src_assets_slab_diagram_shoring_prop [EXTRACTED 1.00]
- **Four Numbered Design Inputs (Callouts 1-4)** — src_assets_slab_diagram_slab_thickness, src_assets_slab_diagram_secondary_beam_spacing, src_assets_slab_diagram_primary_beam_spacing, src_assets_slab_diagram_prop_spacing [EXTRACTED 1.00]

## Communities (29 total, 5 thin omitted)

### Community 0 - "Project Dashboard & Documents"
Cohesion: 0.08
Nodes (74): useCalcReset(), CoverPageEditor(), CoverPreview, nextRevisionNo(), CoverPreview(), formatWhen(), SavedDesigns(), clamp01() (+66 more)

### Community 1 - "Beam Solver Engine"
Cohesion: 0.06
Nodes (76): useAuth(), AVATAR_COLORS, Overview(), formatDay(), formatWhen(), ProjectOverview(), relativeDays(), SubmissionCard() (+68 more)

### Community 2 - "checks.js"
Cohesion: 0.06
Nodes (44): analyzeBeam(), buildMesh(), buildResults(), createMatrix(), elementStiffnessMatrix(), fixedEndForces(), gaussianElimination(), multiplyMatrixVector() (+36 more)

### Community 3 - "App Routing & Shell"
Cohesion: 0.12
Nodes (16): App(), AuthGuard(), BackpropCalculator, DrawingViewer, MultiBeamCalculator, NotFound, Overview, ProjectDashboard (+8 more)

### Community 4 - "Markup Geometry"
Cohesion: 0.11
Nodes (31): rectToUserSpace(), approx(), check(), rect, ACCENT, compileCoverPdf(), compileProjectPdf(), contentsPageCount() (+23 more)

### Community 5 - "Dependencies"
Cohesion: 0.06
Nodes (34): dependencies, chart.js, fflate, html2canvas, jspdf-autotable, lucide-react, pdf-lib, pdfjs-dist (+26 more)

### Community 6 - "Multi-Span Beam UI"
Cohesion: 0.08
Nodes (50): formatAgo(), ProjectContextBar(), WORK_ROUTES, clearAllPdfs(), deletePdf(), getPdf(), listPdfIds(), openDb() (+42 more)

### Community 7 - "Graphics Layout Core"
Cohesion: 0.20
Nodes (16): computeSpanDimensions(), computeSupportPositions(), computeLoadGlyph(), computeLoadGlyphs(), buildResultChartData(), buildResultChartOptions(), flattenAnalysisPoints(), RESULT_CHART_DATASETS (+8 more)

### Community 8 - "projectFiles.js"
Cohesion: 0.47
Nodes (4): ThemeContext, ThemeProvider(), useTheme(), Settings()

### Community 9 - "Slab Formwork Load Path"
Cohesion: 0.27
Nodes (13): Slab Formwork Assembly Diagram, Concrete Slab, Vertical Load Path (Slab to Ground), Plywood Decking / Formwork Panel, Primary Beam (Bearer), Distance Between Primary Beams (Callout 3), Prop Forkhead / Beam Seating, Distance Between Primary Beam Supports (Callout 4) (+5 more)

### Community 10 - "HTML App Shell"
Cohesion: 0.24
Nodes (10): TempWorks HTML App Shell, Favicon SVG Asset (/favicon.svg), Module Entry Script (/src/main.jsx), Single-Attempt Reload Guard (tw_stale_reload_attempted), Root Mount Div (#root), SEO and Open Graph Metadata, Stale Index Cache Reload Fail-Safe, Stale Cache Recovery on Redeploy (+2 more)

### Community 11 - "checks.js"
Cohesion: 0.41
Nodes (12): calcEpsilon(), checkBending(), checkBendingShearInteraction(), checkDeflection(), checkShear(), checkSystemBeam(), classifyHollowSection(), classifyISection() (+4 more)

### Community 12 - "dialog.js"
Cohesion: 0.44
Nodes (7): DialogHost(), promptDialog(), pump(), queue, request(), resolveDialog(), subscribeDialog()

### Community 13 - "Automatic Report Rendering"
Cohesion: 0.67
Nodes (3): CALCULATOR_COMPONENTS, ReportAutoRenderer(), waitForReport()

### Community 19 - "ResetPassword.jsx"
Cohesion: 0.26
Nodes (8): AuthPanel(), Logo(), SplashScreen(), ForgotPassword(), Login(), ResetPassword(), requestPasswordReset(), updatePassword()

### Community 21 - "Layout.jsx"
Cohesion: 0.23
Nodes (9): CalcInstance(), CalcResetContext, CALCULATOR_NAV, getPageTitle(), groupsContaining(), Layout(), PAGE_TITLES, RouteLoader() (+1 more)

### Community 22 - "useAuth"
Cohesion: 0.40
Nodes (5): calculators, getGreeting(), HEADLINE_WORDS, Home(), upcoming

### Community 23 - "AuthContext.jsx"
Cohesion: 0.47
Nodes (6): AuthContext, AuthProvider(), getUserProfile(), onAuthStateChange(), signIn(), signOut()

### Community 26 - "Overview.jsx"
Cohesion: 0.19
Nodes (14): DynamicBeamDiagram(), AnalysisDiagram(), CheckRow(), cleanNumericInput(), CLR, COMPANY_LOGOS, DESIGN_SESSION_KEYS, flattenPoints() (+6 more)

### Community 29 - "projectFiles.test.mjs"
Cohesion: 0.20
Nodes (8): blobs, bytesOf(), db, nowIso(), REAL_PROJECT_STATUS_ENUM, seedProject(), versionMeta, ZONES

### Community 30 - "MultiBeamCalculator.jsx"
Cohesion: 0.06
Nodes (57): jspdf, StandardChart(), calculateBackprop(), buildCapacityChartData(), calculateLegLoad(), evaluateConfigurations(), getFreeStandingCapacity(), getTopHeldCapacity() (+49 more)

## Knowledge Gaps
- **115 isolated node(s):** `name`, `private`, `version`, `type`, `dev` (+110 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **5 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `jspdf` connect `MultiBeamCalculator.jsx` to `Dependencies`?**
  _High betweenness centrality (0.095) - this node is a cross-community bridge._
- **Why does `dependencies` connect `Dependencies` to `MultiBeamCalculator.jsx`?**
  _High betweenness centrality (0.094) - this node is a cross-community bridge._
- **Why does `shareReportPdf()` connect `MultiBeamCalculator.jsx` to `Overview.jsx`, `checks.js`?**
  _High betweenness centrality (0.088) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `getProject()` (e.g. with `ProjectContextBar()` and `ProjectDashboard()`) actually correct?**
  _`getProject()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `name`, `private`, `version` to the rest of the system?**
  _116 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Project Dashboard & Documents` be split into smaller, more focused modules?**
  _Cohesion score 0.08401084010840108 - nodes in this community are weakly interconnected._
- **Should `Beam Solver Engine` be split into smaller, more focused modules?**
  _Cohesion score 0.058383838383838385 - nodes in this community are weakly interconnected._