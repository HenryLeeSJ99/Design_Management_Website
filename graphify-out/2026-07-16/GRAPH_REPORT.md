# Graph Report - Design_Management_Website  (2026-07-16)

## Corpus Check
- 74 files · ~81,018 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 514 nodes · 1208 edges · 20 communities (17 shown, 3 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 11 edges (avg confidence: 0.84)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `2d8a954d`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Project Dashboard & Documents
- Beam Solver Engine
- App Routing & Shell
- Markup Geometry
- Dependencies
- Multi-Span Beam UI
- Graphics Layout Core
- Slab Formwork Load Path
- HTML App Shell
- Cover Page Editor
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
3. `setProject()` - 21 edges
4. `Projects()` - 20 edges
5. `SavedDesigns()` - 18 edges
6. `solveBeam()` - 13 edges
7. `calculateSlabFormwork()` - 13 edges
8. `itemType()` - 13 edges
9. `DrawingViewer()` - 12 edges
10. `getPdf()` - 12 edges

## Surprising Connections (you probably didn't know these)
- `renderReportPdf()` --references--> `jspdf`  [EXTRACTED]
  src/utils/reportPdf.js → package.json
- `renderReportPdfBlob()` --references--> `jspdf`  [EXTRACTED]
  src/utils/reportPdf.js → package.json
- `shareReportPdf()` --references--> `jspdf`  [EXTRACTED]
  src/utils/reportPdf.js → package.json
- `Settings()` --calls--> `useAuth()`  [EXTRACTED]
  src/pages/Settings.jsx → src/contexts/AuthContext.jsx
- `AuthGuard()` --calls--> `useAuth()`  [EXTRACTED]
  src/App.jsx → src/contexts/AuthContext.jsx

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
Nodes (75): useCalcReset(), CoverPageEditor(), CoverPreview, nextRevisionNo(), CoverPreview(), formatWhen(), SavedDesigns(), clamp01() (+67 more)

### Community 1 - "Beam Solver Engine"
Cohesion: 0.08
Nodes (40): analyzeBeam(), buildMesh(), buildResults(), createMatrix(), elementStiffnessMatrix(), fixedEndForces(), gaussianElimination(), multiplyMatrixVector() (+32 more)

### Community 3 - "App Routing & Shell"
Cohesion: 0.44
Nodes (7): DialogHost(), promptDialog(), pump(), queue, request(), resolveDialog(), subscribeDialog()

### Community 4 - "Markup Geometry"
Cohesion: 0.11
Nodes (31): rectToUserSpace(), approx(), check(), rect, ACCENT, compileCoverPdf(), compileProjectPdf(), contentsPageCount() (+23 more)

### Community 5 - "Dependencies"
Cohesion: 0.06
Nodes (34): dependencies, chart.js, fflate, html2canvas, jspdf-autotable, lucide-react, pdf-lib, pdfjs-dist (+26 more)

### Community 6 - "Multi-Span Beam UI"
Cohesion: 0.07
Nodes (59): formatSize(), formatWhen(), Projects(), VersionHistoryModal(), Settings(), clearAllPdfs(), getPdf(), listPdfIds() (+51 more)

### Community 7 - "Graphics Layout Core"
Cohesion: 0.20
Nodes (16): computeSpanDimensions(), computeSupportPositions(), computeLoadGlyph(), computeLoadGlyphs(), buildResultChartData(), buildResultChartOptions(), flattenAnalysisPoints(), RESULT_CHART_DATASETS (+8 more)

### Community 9 - "Slab Formwork Load Path"
Cohesion: 0.27
Nodes (13): Slab Formwork Assembly Diagram, Concrete Slab, Vertical Load Path (Slab to Ground), Plywood Decking / Formwork Panel, Primary Beam (Bearer), Distance Between Primary Beams (Callout 3), Prop Forkhead / Beam Seating, Distance Between Primary Beam Supports (Callout 4) (+5 more)

### Community 10 - "HTML App Shell"
Cohesion: 0.24
Nodes (10): TempWorks HTML App Shell, Favicon SVG Asset (/favicon.svg), Module Entry Script (/src/main.jsx), Single-Attempt Reload Guard (tw_stale_reload_attempted), Root Mount Div (#root), SEO and Open Graph Metadata, Stale Index Cache Reload Fail-Safe, Stale Cache Recovery on Redeploy (+2 more)

### Community 12 - "Cover Page Editor"
Cohesion: 0.13
Nodes (18): asBytes(), decodeTw(), entryName(), pdfIdFromEntry(), peekTw(), readEntries(), readManifest(), asZip (+10 more)

### Community 13 - "Automatic Report Rendering"
Cohesion: 0.67
Nodes (3): CALCULATOR_COMPONENTS, ReportAutoRenderer(), waitForReport()

### Community 21 - "Home.jsx"
Cohesion: 0.07
Nodes (34): App(), AuthGuard(), DrawingViewer, MultiBeamCalculator, NotFound, ProjectDashboard, Projects, Settings (+26 more)

### Community 29 - "projectFiles.test.mjs"
Cohesion: 0.24
Nodes (6): blobs, bytesOf(), db, nowIso(), seedProject(), versionMeta

### Community 31 - "MultiBeamCalculator.jsx"
Cohesion: 0.06
Nodes (53): jspdf, DynamicBeamDiagram(), StandardChart(), buildCapacityChartData(), calculateLegLoad(), evaluateConfigurations(), getFreeStandingCapacity(), getTopHeldCapacity() (+45 more)

## Knowledge Gaps
- **93 isolated node(s):** `name`, `private`, `version`, `type`, `dev` (+88 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `jspdf` connect `MultiBeamCalculator.jsx` to `Dependencies`?**
  _High betweenness centrality (0.115) - this node is a cross-community bridge._
- **Why does `dependencies` connect `Dependencies` to `MultiBeamCalculator.jsx`?**
  _High betweenness centrality (0.115) - this node is a cross-community bridge._
- **What connects `name`, `private`, `version` to the rest of the system?**
  _94 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Project Dashboard & Documents` be split into smaller, more focused modules?**
  _Cohesion score 0.08286805759623861 - nodes in this community are weakly interconnected._
- **Should `Beam Solver Engine` be split into smaller, more focused modules?**
  _Cohesion score 0.07864488808227466 - nodes in this community are weakly interconnected._
- **Should `Markup Geometry` be split into smaller, more focused modules?**
  _Cohesion score 0.10588235294117647 - nodes in this community are weakly interconnected._
- **Should `Dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.05714285714285714 - nodes in this community are weakly interconnected._