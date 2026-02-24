# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```sh
bun install              # Install dependencies
bun run dev              # Start Vite dev server on :1420
bun run tauri dev        # Launch Tauri desktop app (starts dev server + Rust backend)
bun run tauri build      # Production build (.app bundle)
bun run build            # Frontend-only production build (type-check + bundle to dist/)
```

## Architecture

Pancake is a Tauri v2 desktop app — React/TypeScript frontend + Rust backend.

- **`src/`** — React frontend. Entry: `main.tsx` → TanStack Router. Styled with Tailwind CSS v4 (`index.css` defines `@theme` tokens).
- **`src/api/`** — API layer: `types.ts` (mirrors Rust structs), `tauri.ts` (invoke wrappers), `queries.ts` (React Query options + mutations).
- **`src/routes/`** — TanStack Router file-based routes. `__root.tsx` is the root layout, `index.tsx` is the home route.
- **`src/components/`** — Shared UI components (Sidebar, DiffViewer, ConflictViewer, CommentsPanel).
- **`src/data/`** — Mock data for development (`mockData.ts`).
- **`src-tauri/`** — Rust backend. `lib.rs` defines Tauri commands, types, and jj CLI integration. `main.rs` is the OS entry point.
- **`index.html`** — HTML entry point referencing `src/index.css` and `src/main.tsx` (Vite resolves them).

Frontend <-> Backend communication uses `@tauri-apps/api` to invoke Rust commands defined in `src-tauri/src/lib.rs`.

## Build System

Uses **Vite** with three plugins: `TanStackRouterVite` (file-based routing), `@vitejs/plugin-react`, and `@tailwindcss/vite`. Dev server runs on port **1420** (configured in `vite.config.ts`). Tailwind CSS v4 is integrated via the Vite plugin.

## TypeScript

- Strict mode enabled, no unused locals/params
- Target ES2022, module resolution: bundler
- `tsconfig.json` references `tsconfig.app.json` (frontend) and `tsconfig.node.json` (tooling)
