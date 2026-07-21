# TempWorks

A design toolkit for temporary works engineers — structural calculators, drawing markup, PDF report generation, and project management, built as a React single-page app with a Supabase backend.

## Features

- **Calculators** — Multi-Beam, Slab Formwork, Wall Formwork, and Shoring Tower, each with its own save/load design history and schematic diagrams rendered from the calculation inputs.
- **Project dashboard** — organize calculations and drawings into zones/levels, drag-to-reorder, cover page editor with revision tables.
- **Drawing markup** — view PDF plan drawings (via `pdf.js`) and annotate them on an HTML canvas.
- **PDF report compilation** — combine calculation results, schematics, and marked-up drawings into a single branded PDF (`pdf-lib` / `jsPDF`).
- **Accounts & access** — Supabase-backed sign-in with per-project roles (RBAC), cover images, project trash with 30-day auto-purge, and version history/undo.
- **Resilient client shell** — route-level code splitting, a splash screen, and a stale-cache reload fail-safe so redeploys don't strand users on a broken bundle.

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
  pages/       Route-level views (calculators, dashboard, drawing viewer, login)
  components/  Shared UI (layout, dialogs, saved designs, cover editor)
  services/    Persistence and integrations (project store, Supabase, PDF compile)
  engine/      Structural analysis and schematic/graphics generation
  contexts/    React context providers (auth)
  utils/       Misc helpers
```

## License

MIT — see [LICENSE](LICENSE).
