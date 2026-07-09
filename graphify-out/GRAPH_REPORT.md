# Graph Report - .  (2026-07-09)

## Corpus Check
- Corpus is ~41,998 words - fits in a single context window. You may not need a graph.

## Summary
- 307 nodes · 640 edges · 20 communities (16 shown, 4 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 12 edges (avg confidence: 0.58)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Legacy Application Core
- React Navigation & Components
- Beam Solver Engine
- Legacy Canvas Rendering
- React Canvas Graphics
- Project Configuration
- Legacy PDF Reports
- Eurocode 3 Design Engine
- Legacy EC3 Checks
- React Multi-Span Beam Page
- React Results Presentation
- Legacy Beam Solver
- React Slab Formwork Page
- Vite Configuration
- Agent Graphify Rules
- Agent Graphify Workflow
- Legacy Entry Page

## God Nodes (most connected - your core abstractions)
1. `init()` - 16 edges
2. `renderSFD()` - 15 edges
3. `renderBeamDiagram()` - 14 edges
4. `renderBMD()` - 14 edges
5. `onCalculate()` - 13 edges
6. `solveBeam()` - 13 edges
7. `renderDeflection()` - 12 edges
8. `calculateSlabFormwork()` - 12 edges
9. `generateReport()` - 11 edges
10. `fmt()` - 10 edges

## Surprising Connections (you probably didn't know these)
- `ResultsView()` --references--> `jspdf`  [EXTRACTED]
  src/calculators/MultiSpanBeam/ResultsView.jsx → package.json
- `generateReport()` --references--> `jspdf`  [EXTRACTED]
  legacy/report.js → package.json
- `drawHeader()` --references--> `jspdf`  [EXTRACTED]
  legacy/report.js → package.json
- `drawBoundaryConditions()` --references--> `jspdf`  [EXTRACTED]
  legacy/report.js → package.json
- `drawResults()` --references--> `jspdf`  [EXTRACTED]
  legacy/report.js → package.json

## Import Cycles
- None detected.

## Communities (20 total, 4 thin omitted)

### Community 0 - "Legacy Application Core"
Cohesion: 0.07
Nodes (43): addCheckRow(), addLoad(), addSpan(), $btnAddLoad, $btnAddSpanRight, $btnCalculate, $btnDownload, $btnRemoveSpan (+35 more)

### Community 1 - "React Navigation & Components"
Cohesion: 0.10
Nodes (31): firebase, App(), GeometryInput(), LoadsInput(), MultiSpanBeamCalculator(), Layout(), Logo(), AuthContext (+23 more)

### Community 2 - "Beam Solver Engine"
Cohesion: 0.10
Nodes (26): analyzeBeam(), buildMesh(), buildResults(), createMatrix(), elementStiffnessMatrix(), fixedEndForces(), gaussianElimination(), multiplyMatrixVector() (+18 more)

### Community 3 - "Legacy Canvas Rendering"
Cohesion: 0.23
Nodes (25): onCalculate(), collectPoints(), COLORS, drawArrowhead(), drawBaseline(), drawHoverScrubber(), drawPointLoad(), drawSupport() (+17 more)

### Community 4 - "React Canvas Graphics"
Cohesion: 0.20
Nodes (16): computeSpanDimensions(), computeSupportPositions(), computeLoadGlyph(), computeLoadGlyphs(), buildResultChartData(), buildResultChartOptions(), flattenAnalysisPoints(), RESULT_CHART_DATASETS (+8 more)

### Community 5 - "Project Configuration"
Cohesion: 0.09
Nodes (20): devDependencies, eslint, @eslint/js, eslint-plugin-react, eslint-plugin-react-hooks, eslint-plugin-react-refresh, globals, @types/react (+12 more)

### Community 6 - "Legacy PDF Reports"
Cohesion: 0.15
Nodes (20): C, drawBoundaryConditions(), drawDesignChecks(), drawDiagrams(), drawFooter(), drawHeader(), drawResults(), drawVerdict() (+12 more)

### Community 7 - "Eurocode 3 Design Engine"
Cohesion: 0.41
Nodes (12): calcEpsilon(), checkBending(), checkBendingShearInteraction(), checkDeflection(), checkShear(), checkSystemBeam(), classifyHollowSection(), classifyISection() (+4 more)

### Community 8 - "Legacy EC3 Checks"
Cohesion: 0.45
Nodes (12): calcEpsilon(), checkBending(), checkBendingShearInteraction(), checkDeflection(), checkShear(), checkSystemBeam(), classifyHollowSection(), classifyISection() (+4 more)

### Community 9 - "React Multi-Span Beam Page"
Cohesion: 0.24
Nodes (10): DynamicBeamDiagram(), AnalysisDiagram(), CheckRow(), CLR, flattenPoints(), getSessionData(), MultiBeamCalculator(), ResultsPanel() (+2 more)

### Community 10 - "React Results Presentation"
Cohesion: 0.33
Nodes (6): AnalysisDiagram(), CheckRow(), CLR, flattenPoints(), ResultsView(), roundN()

### Community 11 - "Legacy Beam Solver"
Cohesion: 0.54
Nodes (7): buildResults(), createMatrix(), elementStiffnessMatrix(), fixedEndForces(), gaussianElimination(), multiplyMatrixVector(), solveBeam()

### Community 12 - "React Slab Formwork Page"
Cohesion: 0.32
Nodes (3): getSessionData(), saveSessionData(), SlabFormworkCalculator()

## Knowledge Gaps
- **57 isolated node(s):** `$tableGeometryBody`, `$tableLoadsBody`, `$btnAddSpanRight`, `$btnRemoveSpan`, `$btnAddLoad` (+52 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `jspdf` connect `Legacy PDF Reports` to `React Results Presentation`?**
  _High betweenness centrality (0.476) - this node is a cross-community bridge._
- **Why does `generateReport()` connect `Legacy PDF Reports` to `Legacy Application Core`?**
  _High betweenness centrality (0.396) - this node is a cross-community bridge._
- **Why does `ResultsView()` connect `React Results Presentation` to `React Navigation & Components`, `Legacy PDF Reports`?**
  _High betweenness centrality (0.385) - this node is a cross-community bridge._
- **Are the 9 inferred relationships involving `init()` (e.g. with `app.js` and `addLoad()`) actually correct?**
  _`init()` has 9 INFERRED edges - model-reasoned connections that need verification._
- **Are the 4 inferred relationships involving `onCalculate()` (e.g. with `init()` and `renderBMD()`) actually correct?**
  _`onCalculate()` has 4 INFERRED edges - model-reasoned connections that need verification._
- **What connects `$tableGeometryBody`, `$tableLoadsBody`, `$btnAddSpanRight` to the rest of the system?**
  _58 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Legacy Application Core` be split into smaller, more focused modules?**
  _Cohesion score 0.06938020351526364 - nodes in this community are weakly interconnected._