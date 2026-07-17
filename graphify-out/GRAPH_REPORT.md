# Graph Report - Design_Management_Website  (2026-07-17)

## Corpus Check
- 81 files · ~93,834 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 564 nodes · 1351 edges · 20 communities (17 shown, 3 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 11 edges (avg confidence: 0.84)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `68409d73`
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
- Slab Formwork Load Path
- HTML App Shell
- Automatic Report Rendering
- Project Readme
- Vite Config
- CLAUDE.md
- Home.jsx
- projectFiles.test.mjs
- MultiBeamCalculator.jsx

## God Nodes (most connected - your core abstractions)
1. `ProjectDashboard()` - 46 edges
2. `getProject()` - 39 edges
3. `Projects()` - 23 edges
4. `ProjectOverview()` - 21 edges
5. `setProject()` - 21 edges
6. `SavedDesigns()` - 19 edges
7. `useAuth()` - 15 edges
8. `itemType()` - 14 edges
9. `solveBeam()` - 13 edges
10. `calculateSlabFormwork()` - 13 edges

## Surprising Connections (you probably didn't know these)
- `renderReportPdf()` --references--> `jspdf`  [EXTRACTED]
  src/utils/reportPdf.js → package.json
- `renderReportPdfBlob()` --references--> `jspdf`  [EXTRACTED]
  src/utils/reportPdf.js → package.json
- `shareReportPdf()` --references--> `jspdf`  [EXTRACTED]
  src/utils/reportPdf.js → package.json
- `AuthGuard()` --calls--> `useAuth()`  [EXTRACTED]
  src/App.jsx → src/contexts/AuthContext.jsx
- `ProjectOverview()` --calls--> `useAuth()`  [EXTRACTED]
  src/pages/ProjectOverview.jsx → src/contexts/AuthContext.jsx

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Client Bootstrap and Stale-Cache Recovery Flow** — index_app_shell, index_root_mount, index_main_jsx_entry, index_stale_cache_failsafe, index_reload_attempt_guard [INFERRED 0.85]
- **Browser Presentation and Discovery Metadata** — index_seo_open_graph_metadata, index_favicon_svg, index_viewport_zoom_policy, index_tempworks_product_identity [INFERRED 0.75]
- **Slab Formwork Vertical Load Path** — src_assets_slab_diagram_concrete_slab, src_assets_slab_diagram_plywood_decking, src_assets_slab_diagram_secondary_beam, src_assets_slab_diagram_primary_beam, src_assets_slab_diagram_shoring_prop [EXTRACTED 1.00]
- **Four Numbered Design Inputs (Callouts 1-4)** — src_assets_slab_diagram_slab_thickness, src_assets_slab_diagram_secondary_beam_spacing, src_assets_slab_diagram_primary_beam_spacing, src_assets_slab_diagram_prop_spacing [EXTRACTED 1.00]

## Communities (20 total, 3 thin omitted)

### Community 0 - "Project Dashboard & Documents"
Cohesion: 0.08
Nodes (80): useCalcReset(), CoverPageEditor(), CoverPreview, nextRevisionNo(), CoverPreview(), formatWhen(), SavedDesigns(), clamp01() (+72 more)

### Community 1 - "Beam Solver Engine"
Cohesion: 0.06
Nodes (50): analyzeBeam(), buildMesh(), buildResults(), createMatrix(), elementStiffnessMatrix(), fixedEndForces(), gaussianElimination(), multiplyMatrixVector() (+42 more)

### Community 2 - "checks.js"
Cohesion: 0.19
Nodes (14): DynamicBeamDiagram(), AnalysisDiagram(), CheckRow(), cleanNumericInput(), CLR, COMPANY_LOGOS, DESIGN_SESSION_KEYS, flattenPoints() (+6 more)

### Community 3 - "App Routing & Shell"
Cohesion: 0.06
Nodes (76): formatDay(), formatWhen(), ProjectOverview(), relativeDays(), formatSize(), formatWhen(), Projects(), StatusControl() (+68 more)

### Community 4 - "Markup Geometry"
Cohesion: 0.10
Nodes (32): rectToUserSpace(), approx(), check(), rect, ACCENT, compileCoverPdf(), compileProjectPdf(), contentsPageCount() (+24 more)

### Community 5 - "Dependencies"
Cohesion: 0.06
Nodes (34): dependencies, chart.js, fflate, html2canvas, jspdf-autotable, lucide-react, pdf-lib, pdfjs-dist (+26 more)

### Community 6 - "Multi-Span Beam UI"
Cohesion: 0.13
Nodes (19): asBytes(), decodeTw(), encodeTw(), entryName(), pdfIdFromEntry(), peekTw(), readEntries(), readManifest() (+11 more)

### Community 7 - "Graphics Layout Core"
Cohesion: 0.20
Nodes (16): computeSpanDimensions(), computeSupportPositions(), computeLoadGlyph(), computeLoadGlyphs(), buildResultChartData(), buildResultChartOptions(), flattenAnalysisPoints(), RESULT_CHART_DATASETS (+8 more)

### Community 9 - "Slab Formwork Load Path"
Cohesion: 0.27
Nodes (13): Slab Formwork Assembly Diagram, Concrete Slab, Vertical Load Path (Slab to Ground), Plywood Decking / Formwork Panel, Primary Beam (Bearer), Distance Between Primary Beams (Callout 3), Prop Forkhead / Beam Seating, Distance Between Primary Beam Supports (Callout 4) (+5 more)

### Community 10 - "HTML App Shell"
Cohesion: 0.24
Nodes (10): TempWorks HTML App Shell, Favicon SVG Asset (/favicon.svg), Module Entry Script (/src/main.jsx), Single-Attempt Reload Guard (tw_stale_reload_attempted), Root Mount Div (#root), SEO and Open Graph Metadata, Stale Index Cache Reload Fail-Safe, Stale Cache Recovery on Redeploy (+2 more)

### Community 13 - "Automatic Report Rendering"
Cohesion: 0.67
Nodes (3): CALCULATOR_COMPONENTS, ReportAutoRenderer(), waitForReport()

### Community 21 - "Home.jsx"
Cohesion: 0.06
Nodes (46): App(), AuthGuard(), DrawingViewer, MultiBeamCalculator, NotFound, ProjectDashboard, ProjectOverview, Projects (+38 more)

### Community 29 - "projectFiles.test.mjs"
Cohesion: 0.22
Nodes (7): blobs, bytesOf(), db, nowIso(), REAL_PROJECT_STATUS_ENUM, seedProject(), versionMeta

### Community 31 - "MultiBeamCalculator.jsx"
Cohesion: 0.09
Nodes (42): jspdf, StandardChart(), buildCapacityChartData(), calculateLegLoad(), evaluateConfigurations(), getFreeStandingCapacity(), getTopHeldCapacity(), SHORING_SYSTEMS (+34 more)

## Knowledge Gaps
- **102 isolated node(s):** `name`, `private`, `version`, `type`, `dev` (+97 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `jspdf` connect `MultiBeamCalculator.jsx` to `Dependencies`?**
  _High betweenness centrality (0.106) - this node is a cross-community bridge._
- **Why does `dependencies` connect `Dependencies` to `MultiBeamCalculator.jsx`?**
  _High betweenness centrality (0.106) - this node is a cross-community bridge._
- **Why does `shareReportPdf()` connect `MultiBeamCalculator.jsx` to `Beam Solver Engine`, `checks.js`?**
  _High betweenness centrality (0.096) - this node is a cross-community bridge._
- **What connects `name`, `private`, `version` to the rest of the system?**
  _103 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Project Dashboard & Documents` be split into smaller, more focused modules?**
  _Cohesion score 0.07686414708886619 - nodes in this community are weakly interconnected._
- **Should `Beam Solver Engine` be split into smaller, more focused modules?**
  _Cohesion score 0.058126619770455384 - nodes in this community are weakly interconnected._
- **Should `App Routing & Shell` be split into smaller, more focused modules?**
  _Cohesion score 0.058333333333333334 - nodes in this community are weakly interconnected._