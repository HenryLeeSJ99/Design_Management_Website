# Graph Report - readme-enhancement-049414  (2026-07-21)

## Corpus Check
- 102 files · ~120,949 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 692 nodes · 1753 edges · 24 communities (21 shown, 3 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 15 edges (avg confidence: 0.81)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `1dc13bad`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- projectStore.js
- SlabFormworkCalculator.jsx
- dialog.js
- App.jsx
- pdfCompile.js
- dependencies
- projectFiles.js
- index.js
- checks.js
- Slab Formwork Assembly Diagram
- TempWorks HTML App Shell
- projectFiles.test.mjs
- twFile.test.mjs
- ReportAutoRenderer.jsx
- README.md
- vite.config.js
- MultiBeamCalculator.jsx
- CLAUDE.md
- autosaveWiring.test.mjs
- projectFiles.test.mjs
- SteelPropCalculator.jsx

## God Nodes (most connected - your core abstractions)
1. `ProjectDashboard()` - 46 edges
2. `getProject()` - 43 edges
3. `Projects()` - 26 edges
4. `SavedDesigns()` - 23 edges
5. `ProjectOverview()` - 22 edges
6. `setProject()` - 22 edges
7. `useAuth()` - 21 edges
8. `saveNow()` - 21 edges
9. `openProject()` - 20 edges
10. `solveBeam()` - 16 edges

## Surprising Connections (you probably didn't know these)
- `renderReportPdf()` --references--> `jspdf`  [EXTRACTED]
  src/utils/reportPdf.js → package.json
- `renderReportPdfBlob()` --references--> `jspdf`  [EXTRACTED]
  src/utils/reportPdf.js → package.json
- `shareReportPdf()` --references--> `jspdf`  [EXTRACTED]
  src/utils/reportPdf.js → package.json
- `ProjectContextBar()` --indirect_call--> `getProject()`  [INFERRED]
  src/components/ProjectContextBar.jsx → src/services/projectStore.js
- `WallDesignReport()` --calls--> `isIOS()`  [EXTRACTED]
  src/pages/WallPanelDesignCalculator.jsx → src/utils/reportPdf.js

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Client Bootstrap and Stale-Cache Recovery Flow** — index_app_shell, index_root_mount, index_main_jsx_entry, index_stale_cache_failsafe, index_reload_attempt_guard [INFERRED 0.85]
- **Browser Presentation and Discovery Metadata** — index_seo_open_graph_metadata, index_favicon_svg, index_viewport_zoom_policy, index_tempworks_product_identity [INFERRED 0.75]
- **Slab Formwork Vertical Load Path** — src_assets_slab_diagram_concrete_slab, src_assets_slab_diagram_plywood_decking, src_assets_slab_diagram_secondary_beam, src_assets_slab_diagram_primary_beam, src_assets_slab_diagram_shoring_prop [EXTRACTED 1.00]
- **Four Numbered Design Inputs (Callouts 1-4)** — src_assets_slab_diagram_slab_thickness, src_assets_slab_diagram_secondary_beam_spacing, src_assets_slab_diagram_primary_beam_spacing, src_assets_slab_diagram_prop_spacing [EXTRACTED 1.00]

## Communities (24 total, 3 thin omitted)

### Community 0 - "projectStore.js"
Cohesion: 0.07
Nodes (83): useCalcReset(), CoverPageEditor(), CoverPreview, nextRevisionNo(), CoverPreview(), formatWhen(), SavedDesigns(), clamp01() (+75 more)

### Community 1 - "SlabFormworkCalculator.jsx"
Cohesion: 0.06
Nodes (85): formatAgo(), ProjectContextBar(), WORK_ROUTES, formatAgo(), formatSize(), formatWhen(), Projects(), SORTS (+77 more)

### Community 2 - "dialog.js"
Cohesion: 0.05
Nodes (52): analyzeBeam(), buildMesh(), buildResults(), createMatrix(), elementStiffnessMatrix(), fixedEndForces(), gaussianElimination(), multiplyMatrixVector() (+44 more)

### Community 3 - "App.jsx"
Cohesion: 0.05
Nodes (52): App(), AuthGuard(), BackpropCalculator, DrawingViewer, MultiBeamCalculator, NotFound, Overview, ProjectDashboard (+44 more)

### Community 4 - "pdfCompile.js"
Cohesion: 0.10
Nodes (30): rectToUserSpace(), approx(), check(), rect, ACCENT, compileCoverPdf(), contentsPageCount(), drawBox() (+22 more)

### Community 5 - "dependencies"
Cohesion: 0.06
Nodes (34): dependencies, chart.js, fflate, html2canvas, jspdf-autotable, lucide-react, pdf-lib, pdfjs-dist (+26 more)

### Community 6 - "projectFiles.js"
Cohesion: 0.13
Nodes (20): asBytes(), decodeTw(), encodeTw(), entryName(), pdfIdFromEntry(), peekTw(), readEntries(), readManifest() (+12 more)

### Community 7 - "index.js"
Cohesion: 0.20
Nodes (16): computeSpanDimensions(), computeSupportPositions(), computeLoadGlyph(), computeLoadGlyphs(), buildResultChartData(), buildResultChartOptions(), flattenAnalysisPoints(), RESULT_CHART_DATASETS (+8 more)

### Community 8 - "checks.js"
Cohesion: 0.12
Nodes (41): AVATAR_COLORS, Overview(), formatDay(), formatWhen(), ProjectOverview(), relativeDays(), SubmissionCard(), CardTimeline() (+33 more)

### Community 9 - "Slab Formwork Assembly Diagram"
Cohesion: 0.27
Nodes (13): Slab Formwork Assembly Diagram, Concrete Slab, Vertical Load Path (Slab to Ground), Plywood Decking / Formwork Panel, Primary Beam (Bearer), Distance Between Primary Beams (Callout 3), Prop Forkhead / Beam Seating, Distance Between Primary Beam Supports (Callout 4) (+5 more)

### Community 10 - "TempWorks HTML App Shell"
Cohesion: 0.24
Nodes (10): TempWorks HTML App Shell, Favicon SVG Asset (/favicon.svg), Module Entry Script (/src/main.jsx), Single-Attempt Reload Guard (tw_stale_reload_attempted), Root Mount Div (#root), SEO and Open Graph Metadata, Stale Index Cache Reload Fail-Safe, Stale Cache Recovery on Redeploy (+2 more)

### Community 11 - "projectFiles.test.mjs"
Cohesion: 0.41
Nodes (12): calcEpsilon(), checkBending(), checkBendingShearInteraction(), checkDeflection(), checkShear(), checkSystemBeam(), classifyHollowSection(), classifyISection() (+4 more)

### Community 12 - "twFile.test.mjs"
Cohesion: 0.44
Nodes (7): DialogHost(), promptDialog(), pump(), queue, request(), resolveDialog(), subscribeDialog()

### Community 13 - "ReportAutoRenderer.jsx"
Cohesion: 0.67
Nodes (3): CALCULATOR_COMPONENTS, ReportAutoRenderer(), waitForReport()

### Community 14 - "README.md"
Cohesion: 0.20
Nodes (9): Features, Getting started, License, Prerequisites, Project structure, Scripts, Setup, Tech stack (+1 more)

### Community 19 - "MultiBeamCalculator.jsx"
Cohesion: 0.42
Nodes (7): canUseWorkbook(), isKnownRole(), isManagerLevel(), isReadOnly(), MANAGER_ROLES, UNKNOWN, WORKBOOK_ROLES

### Community 29 - "projectFiles.test.mjs"
Cohesion: 0.18
Nodes (9): blobs, bytesOf(), clock, db, nowIso(), REAL_PROJECT_STATUS_ENUM, seedProject(), versionMeta (+1 more)

### Community 30 - "SteelPropCalculator.jsx"
Cohesion: 0.06
Nodes (63): jspdf, DynamicBeamDiagram(), StandardChart(), calculateBackprop(), buildCapacityChartData(), calculateLegLoad(), evaluateConfigurations(), getFreeStandingCapacity() (+55 more)

## Knowledge Gaps
- **124 isolated node(s):** `name`, `private`, `version`, `type`, `dev` (+119 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `shareReportPdf()` connect `SteelPropCalculator.jsx` to `dialog.js`?**
  _High betweenness centrality (0.088) - this node is a cross-community bridge._
- **Why does `jspdf` connect `SteelPropCalculator.jsx` to `dependencies`?**
  _High betweenness centrality (0.087) - this node is a cross-community bridge._
- **Why does `dependencies` connect `dependencies` to `SteelPropCalculator.jsx`?**
  _High betweenness centrality (0.086) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `getProject()` (e.g. with `ProjectContextBar()` and `ProjectDashboard()`) actually correct?**
  _`getProject()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `name`, `private`, `version` to the rest of the system?**
  _125 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `projectStore.js` be split into smaller, more focused modules?**
  _Cohesion score 0.07099664053751399 - nodes in this community are weakly interconnected._
- **Should `SlabFormworkCalculator.jsx` be split into smaller, more focused modules?**
  _Cohesion score 0.056493884682585906 - nodes in this community are weakly interconnected._