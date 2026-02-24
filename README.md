# Pancake

A Tauri v2 desktop app with React, TypeScript, and Tailwind CSS — bundled with Bun.

## Prerequisites

- [Bun](https://bun.sh/) (v1.1+)
- [Rust](https://rustup.rs/) (for Tauri)
- Tauri v2 system dependencies ([see docs](https://v2.tauri.app/start/prerequisites/))

## Setup

```sh
bun install
```

## Development

Run the Tauri app in dev mode (starts Bun dev server + Tauri window):

```sh
bun run tauri dev
```

Or run just the frontend dev server:

```sh
bun run dev
```

## Build

Create a production build:

```sh
bun run tauri build
```

## Lint

```sh
bun run lint
```
