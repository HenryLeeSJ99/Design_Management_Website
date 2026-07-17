# Graph Report - Design_Management_Website  (2026-07-17)

## Corpus Check
- 76 files · ~82,908 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 523 nodes · 1238 edges · 20 communities (17 shown, 3 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 11 edges (avg confidence: 0.84)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `88a81111`
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
4. `setProject()` - 21 edges
5. `SavedDesigns()` - 18 edges
6. `itemType()` - 14 edges
7. `useAuth()` - 13 edges
8. `solveBeam()` - 13 edges
9. `calculateSlabFormwork()` - 13 edges
10. `DrawingViewer()` - 12 edges

## Surprising Connections (you probably didn't know these)
- `renderReportPdf()` --references--> `jspdf`  [EXTRACTED]
  src/utils/reportPdf.js → package.json
- `renderReportPdfBlob()` --references--> `jspdf`  [EXTRACTED]
  src/utils/reportPdf.js → package.json
- `shareReportPdf()` --references--> `jspdf`  [EXTRACTED]
  src/utils/reportPdf.js → package.json
- `AuthGuard()` --calls--> `useAuth()`  [EXTRACTED]
  src/App.jsx → src/contexts/AuthContext.jsx
- `SavedDesigns()` --calls--> `deletePdf()`  [EXTRACTED]
  src/components/SavedDesigns.jsx → src/services/pdfStore.js

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
Nodes (74): useCalcReset(), CoverPageEditor(), CoverPreview, nextRevisionNo(), CoverPreview(), formatWhen(), SavedDesigns(), clamp01() (+66 more)

### Community 1 - "Beam Solver Engine"
Cohesion: 0.07
Nodes (38): analyzeBeam(), buildMesh(), buildResults(), createMatrix(), elementStiffnessMatrix(), fixedEndForces(), gaussianElimination(), multiplyMatrixVector() (+30 more)

### Community 2 - "checks.js"
Cohesion: 0.41
Nodes (12): calcEpsilon(), checkBending(), checkBendingShearInteraction(), checkDeflection(), checkShear(), checkSystemBeam(), classifyHollowSection(), classifyISection() (+4 more)

### Community 3 - "App Routing & Shell"
Cohesion: 0.10
Nodes (34): formatSize(), formatWhen(), Projects(), StatusControl(), VersionHistoryModal(), deleteFromTrash(), deleteProjectFile(), listProjects() (+26 more)

### Community 4 - "Markup Geometry"
Cohesion: 0.11
Nodes (31): rectToUserSpace(), approx(), check(), rect, ACCENT, compileCoverPdf(), compileProjectPdf(), contentsPageCount() (+23 more)

### Community 5 - "Dependencies"
Cohesion: 0.06
Nodes (34): dependencies, chart.js, fflate, html2canvas, jspdf-autotable, lucide-react, pdf-lib, pdfjs-dist (+26 more)

### Community 6 - "Multi-Span Beam UI"
Cohesion: 0.08
Nodes (48): clearAllPdfs(), deletePdf(), getPdf(), listPdfIds(), openDb(), putPdf(), run(), readProjectFile() (+40 more)

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
Nodes (44): App(), AuthGuard(), DrawingViewer, MultiBeamCalculator, NotFound, ProjectDashboard, Projects, Settings (+36 more)

### Community 29 - "projectFiles.test.mjs"
Cohesion: 0.24
Nodes (6): blobs, bytesOf(), db, nowIso(), seedProject(), versionMeta

### Community 31 - "MultiBeamCalculator.jsx"
Cohesion: 0.08
Nodes (43): jspdf, DynamicBeamDiagram(), StandardChart(), buildCapacityChartData(), calculateLegLoad(), evaluateConfigurations(), getFreeStandingCapacity(), getTopHeldCapacity() (+35 more)

## Knowledge Gaps
- **94 isolated node(s):** `name`, `private`, `version`, `type`, `dev` (+89 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `jspdf` connect `MultiBeamCalculator.jsx` to `Dependencies`?**
  _High betweenness centrality (0.113) - this node is a cross-community bridge._
- **Why does `dependencies` connect `Dependencies` to `MultiBeamCalculator.jsx`?**
  _High betweenness centrality (0.113) - this node is a cross-community bridge._
- **Why does `shareReportPdf()` connect `MultiBeamCalculator.jsx` to `Beam Solver Engine`?**
  _High betweenness centrality (0.097) - this node is a cross-community bridge._
- **What connects `name`, `private`, `version` to the rest of the system?**
  _95 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Project Dashboard & Documents` be split into smaller, more focused modules?**
  _Cohesion score 0.08401084010840108 - nodes in this community are weakly interconnected._
- **Should `Beam Solver Engine` be split into smaller, more focused modules?**
  _Cohesion score 0.06610169491525424 - nodes in this community are weakly interconnected._
- **Should `App Routing & Shell` be split into smaller, more focused modules?**
  _Cohesion score 0.09948979591836735 - nodes in this community are weakly interconnected._