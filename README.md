# TempWorks

A design toolkit for temporary works engineers — structural calculators, drawing markup, PDF report generation, and portfolio/timeline management, built as a React single-page app with a Supabase backend.

## Features

### Calculators

Each calculator has its own save/load design history and schematic diagrams rendered from the calculation inputs, and can run as a guest without an account:

- **Multi-Beam** — system beam analysis and design checks
- **Slab Formwork** — including a WONDERCrab shoring check
- **Wall Formwork** — panel/stud/waler/tie design, plus a dedicated Wall Panel Design sub-calculator
- **Shoring Tower** — WONDERCrab load capacity
- **Steel Prop** — interactive prop visualizer with configurable report filters
- **Backprop** — dynamic elevations, ground slab toggle, slab-by-slab load transfer timeline

### Project & portfolio management

- **Design Workbook** (`/dashboard`) — a project's saved calculations and drawings, organized into zones (levels), drag-to-reorder, cover page editor with revision tables.
- **Project Overview** (`/projects/:projectId`) — the management view for a single project: per-zone submission timeline against a fixed milestone template (design start → design complete → internal check → issued → client approved), status, and target dates. One zone is one submission — a project isn't "done" as a whole, each zone tracks its own client package.
- **Global Overview** (`/overview`) — cross-project stats, an activity feed, and productivity leaderboards (designers / team leaders / managers), scoped to the last 14 days.
- **Projects** — card/list views with search and status filtering.
- Cover images, project trash with 30-day auto-purge, and full version history/undo.

### Drawings & reports

- **Drawing markup** — view PDF plan drawings (via `pdf.js`) and annotate them on an HTML canvas.
- **PDF report compilation** — combine calculation results, schematics, and marked-up drawings into a single branded PDF (`pdf-lib` / `jsPDF`), with a terms-of-use acceptance modal before export.

### Accounts & access

- Supabase-backed sign-in/sign-up, forgot/reset password, and guest access to the calculators without an account.
- Per-project role-based access control: `admin`, `manager`, and `team_leader` manage timelines and statuses; `designer` has full workbook access; `sales` is read-only.
- User **Settings** for display name and theme.
- Light/dark/system **theme** toggle app-wide.

### Resilient client shell

Route-level code splitting, a splash screen, autosave wired at the app root (so it runs no matter which route you land on first), and a stale-cache reload fail-safe so redeploys don't strand users on a broken bundle.

## Tech stack

- [React 18](https://react.dev/) + [React Router 7](https://reactrouter.com/) on [Vite](https://vitejs.dev/)
- [Supabase](https://supabase.com/) for auth, Postgres, and storage
- [Chart.js](https://www.chartjs.org/) / `react-chartjs-2` / [Recharts](https://recharts.org/) for result charts
- [pdf-lib](https://pdf-lib.js.org/), [jsPDF](https://github.com/parallax/jsPDF), [pdf.js](https://mozilla.github.io/pdf.js/), `html2canvas` for PDF generation and drawing rendering
- [fflate](https://github.com/101arrowz/fflate) for `.tw` project file packing/unpacking

## Getting started

### Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com/) project (URL + anon key)

### Setup

```bash
npm install
```

Create a `.env.local` file in the project root with your Supabase credentials:

```
VITE_SUPABASE_URL=your-supabase-project-url
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

### Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Vite dev server with HMR |
| `npm run build` | Build for production |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | Run ESLint |

## Project structure

```
src/
  pages/       Route-level views (calculators, overview, dashboard, drawing viewer, auth)
  components/  Shared UI (layout, dialogs, saved designs, cover editor, theme toggle)
  services/    Persistence and integrations (project store, timeline/status, roles, Supabase, PDF compile)
  engine/      Structural analysis and schematic/graphics generation
  contexts/    React context providers (auth, theme)
  utils/       Misc helpers
```

## License

MIT — see [LICENSE](LICENSE).
