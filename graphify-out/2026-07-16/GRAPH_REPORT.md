# Graph Report - Design_Management_Website  (2026-07-16)

## Corpus Check
- 66 files · ~76,111 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 462 nodes · 894 edges · 26 communities (20 shown, 6 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 10 edges (avg confidence: 0.84)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `dc7ee6a6`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Project Dashboard & Documents
- Beam Solver Engine
- Report Rendering & Charts
- App Routing & Shell
- Markup Geometry
- Dependencies
- Multi-Span Beam UI
- Graphics Layout Core
- EC3 Design Checks
- Slab Formwork Load Path
- HTML App Shell
- Analysis Results View
- Cover Page Editor
- Automatic Report Rendering
- Project Readme
- Vite Config
- ShoringTowerCalculator.jsx
- CLAUDE.md
- Home.jsx
- SplashScreen.jsx
- CalcInstance.jsx
- Layout.jsx

## God Nodes (most connected - your core abstractions)
1. `getProject()` - 25 edges
2. `setProject()` - 15 edges
3. `getFolder()` - 14 edges
4. `solveBeam()` - 13 edges
5. `DrawingViewer()` - 12 edges
6. `snapshotVersion()` - 11 edges
7. `itemType()` - 11 edges
8. `calculateSlabFormwork()` - 11 edges
9. `saveNow()` - 10 edges
10. `confirmDialog()` - 9 edges

## Surprising Connections (you probably didn't know these)
- `renderReportPdf()` --references--> `jspdf`  [EXTRACTED]
  src/utils/reportPdf.js → package.json
- `renderReportPdfBlob()` --references--> `jspdf`  [EXTRACTED]
  src/utils/reportPdf.js → package.json
- `shareReportPdf()` --references--> `jspdf`  [EXTRACTED]
  src/utils/reportPdf.js → package.json
- `saveNow()` --calls--> `getProject()`  [EXTRACTED]
  src/services/projectSession.js → src/services/projectStore.js
- `compileProjectPdf()` --calls--> `itemType()`  [EXTRACTED]
  src/services/pdfCompile.js → src/services/projectStore.js

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Client Bootstrap and Stale-Cache Recovery Flow** — index_app_shell, index_root_mount, index_main_jsx_entry, index_stale_cache_failsafe, index_reload_attempt_guard [INFERRED 0.85]
- **Browser Presentation and Discovery Metadata** — index_seo_open_graph_metadata, index_favicon_svg, index_viewport_zoom_policy, index_tempworks_product_identity [INFERRED 0.75]
- **Slab Formwork Vertical Load Path** — src_assets_slab_diagram_concrete_slab, src_assets_slab_diagram_plywood_decking, src_assets_slab_diagram_secondary_beam, src_assets_slab_diagram_primary_beam, src_assets_slab_diagram_shoring_prop [EXTRACTED 1.00]
- **Four Numbered Design Inputs (Callouts 1-4)** — src_assets_slab_diagram_slab_thickness, src_assets_slab_diagram_secondary_beam_spacing, src_assets_slab_diagram_primary_beam_spacing, src_assets_slab_diagram_prop_spacing [EXTRACTED 1.00]

## Communities (26 total, 6 thin omitted)

### Community 0 - "Project Dashboard & Documents"
Cohesion: 0.08
Nodes (47): CoverPageEditor(), CoverPreview, nextRevisionNo(), CoverPreview(), clamp01(), DrawingViewer(), generateMarkupId(), rectFromPoints() (+39 more)

### Community 1 - "Beam Solver Engine"
Cohesion: 0.10
Nodes (28): analyzeBeam(), buildMesh(), buildResults(), createMatrix(), elementStiffnessMatrix(), fixedEndForces(), gaussianElimination(), multiplyMatrixVector() (+20 more)

### Community 2 - "Report Rendering & Charts"
Cohesion: 0.09
Nodes (24): DynamicBeamDiagram(), AnalysisDiagram(), CheckRow(), cleanNumericInput(), CLR, COMPANY_LOGOS, DESIGN_SESSION_KEYS, flattenPoints() (+16 more)

### Community 3 - "App Routing & Shell"
Cohesion: 0.10
Nodes (31): App(), DrawingViewer, MultiBeamCalculator, NotFound, ProjectDashboard, Projects, ShoringTowerCalculator, SlabFormworkCalculator (+23 more)

### Community 4 - "Markup Geometry"
Cohesion: 0.08
Nodes (38): rectToUserSpace(), approx(), check(), rect, ACCENT, compileCoverPdf(), compileProjectPdf(), contentsPageCount() (+30 more)

### Community 5 - "Dependencies"
Cohesion: 0.06
Nodes (33): dependencies, chart.js, fflate, html2canvas, jspdf-autotable, lucide-react, pdf-lib, pdfjs-dist (+25 more)

### Community 6 - "Multi-Span Beam UI"
Cohesion: 0.11
Nodes (43): daysSince(), deleteFromTrash(), deleteProjectFile(), ensurePermission(), fileExists(), forgetFolder(), getFolder(), handleTx() (+35 more)

### Community 7 - "Graphics Layout Core"
Cohesion: 0.20
Nodes (16): computeSpanDimensions(), computeSupportPositions(), computeLoadGlyph(), computeLoadGlyphs(), buildResultChartData(), buildResultChartOptions(), flattenAnalysisPoints(), RESULT_CHART_DATASETS (+8 more)

### Community 8 - "EC3 Design Checks"
Cohesion: 0.41
Nodes (12): calcEpsilon(), checkBending(), checkBendingShearInteraction(), checkDeflection(), checkShear(), checkSystemBeam(), classifyHollowSection(), classifyISection() (+4 more)

### Community 9 - "Slab Formwork Load Path"
Cohesion: 0.27
Nodes (13): Slab Formwork Assembly Diagram, Concrete Slab, Vertical Load Path (Slab to Ground), Plywood Decking / Formwork Panel, Primary Beam (Bearer), Distance Between Primary Beams (Callout 3), Prop Forkhead / Beam Seating, Distance Between Primary Beam Supports (Callout 4) (+5 more)

### Community 10 - "HTML App Shell"
Cohesion: 0.24
Nodes (10): TempWorks HTML App Shell, Favicon SVG Asset (/favicon.svg), Module Entry Script (/src/main.jsx), Single-Attempt Reload Guard (tw_stale_reload_attempted), Root Mount Div (#root), SEO and Open Graph Metadata, Stale Index Cache Reload Fail-Safe, Stale Cache Recovery on Redeploy (+2 more)

### Community 12 - "Cover Page Editor"
Cohesion: 0.13
Nodes (20): asBytes(), decodeTw(), encodeTw(), entryName(), pdfIdFromEntry(), peekTw(), readEntries(), readManifest() (+12 more)

### Community 13 - "Automatic Report Rendering"
Cohesion: 0.67
Nodes (3): CALCULATOR_COMPONENTS, ReportAutoRenderer(), waitForReport()

### Community 19 - "ShoringTowerCalculator.jsx"
Cohesion: 0.13
Nodes (29): jspdf, StandardChart(), buildCapacityChartData(), calculateLegLoad(), evaluateConfigurations(), getFreeStandingCapacity(), getTopHeldCapacity(), SHORING_SYSTEMS (+21 more)

### Community 21 - "Home.jsx"
Cohesion: 0.40
Nodes (5): calculators, getGreeting(), HEADLINE_WORDS, Home(), upcoming

### Community 25 - "Layout.jsx"
Cohesion: 0.83
Nodes (3): getPageTitle(), Layout(), PAGE_TITLES

## Knowledge Gaps
- **87 isolated node(s):** `Projects`, `ProjectDashboard`, `DrawingViewer`, `NotFound`, `MultiBeamCalculator` (+82 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `dependencies` connect `Dependencies` to `ShoringTowerCalculator.jsx`?**
  _High betweenness centrality (0.052) - this node is a cross-community bridge._
- **Why does `jspdf` connect `ShoringTowerCalculator.jsx` to `Dependencies`?**
  _High betweenness centrality (0.050) - this node is a cross-community bridge._
- **What connects `Projects`, `ProjectDashboard`, `DrawingViewer` to the rest of the system?**
  _88 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Project Dashboard & Documents` be split into smaller, more focused modules?**
  _Cohesion score 0.08123904149620105 - nodes in this community are weakly interconnected._
- **Should `Beam Solver Engine` be split into smaller, more focused modules?**
  _Cohesion score 0.09513742071881606 - nodes in this community are weakly interconnected._
- **Should `Report Rendering & Charts` be split into smaller, more focused modules?**
  _Cohesion score 0.09090909090909091 - nodes in this community are weakly interconnected._
- **Should `App Routing & Shell` be split into smaller, more focused modules?**
  _Cohesion score 0.09672830725462304 - nodes in this community are weakly interconnected._