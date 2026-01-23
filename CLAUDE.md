# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```sh
bun install              # Install dependencies
bun run dev              # Start frontend dev server on :5173
bun run tauri dev        # Launch Tauri desktop app (starts dev server + Rust backend)
bun run tauri build      # Production build (.app bundle)
bun run build            # Frontend-only production build (type-check + bundle to dist/)
bun run lint             # ESLint
```

## Architecture

Pancake is a Tauri v2 desktop app — React/TypeScript frontend + Rust backend.

- **`src/`** — React frontend. Entry: `main.tsx` → `App.tsx`. Styled with Tailwind CSS (`index.css` imports tailwindcss).
- **`src-tauri/`** — Rust backend. `lib.rs` sets up the Tauri builder and plugins. `main.rs` is the OS entry point.
- **`index.html`** — HTML entry point referencing `src/index.css` and `src/main.tsx` directly (Bun resolves them).
- **`bunfig.toml`** — Enables `bun-plugin-tailwind` for the dev server.

Frontend ↔ Backend communication uses `@tauri-apps/api` to invoke Rust commands defined in `src-tauri/src/lib.rs`.

## Build System

Uses **Bun's native HTML bundler** (not Vite). Bun handles TSX, CSS, and HMR out of the box. Tailwind is provided by `bun-plugin-tailwind` rather than a standalone `tailwindcss` package.

## TypeScript

- Strict mode enabled, no unused locals/params
- Target ES2022, module resolution: bundler
- `tsconfig.json` references `tsconfig.app.json` (frontend) and `tsconfig.node.json` (tooling)
