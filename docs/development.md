# Development

This page describes the current developer workflow. It points to the deeper subsystem docs in [`docs/index.md`](index.md) rather than duplicating them.

## Prerequisites

[`package.json`](../package.json) declares npm scripts and dependencies but no `engines` field. The README recommends Node.js 18+ and npm 9+. Use a Node/npm installation that can run Electron 33, Vite 5, TypeScript 5.6, and Vitest 4.

Run all commands from the `mock-up-studio/` directory.

## Install and run

```bash
npm install
npm run dev
```

`npm run dev` starts Electron Vite in development mode. [`src/main/index.ts`](../src/main/index.ts) loads `process.env['ELECTRON_RENDERER_URL']` in development and `out/renderer/index.html` otherwise.

## Command reference

Commands and actions are copied from [`package.json`](../package.json):

| Command | Action |
|---|---|
| `npm run dev` | `electron-vite dev` |
| `npm run build` | `electron-vite build` |
| `npm run start` | `electron-vite preview` |
| `npm run preview` | `electron-vite preview` |
| `npm run typecheck:node` | `tsc --noEmit -p tsconfig.node.json` |
| `npm run typecheck:web` | `tsc --noEmit -p tsconfig.web.json` |
| `npm run typecheck` | `npm run typecheck:node && npm run typecheck:web` |
| `npm run lint` | `eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0` |
| `npm run format` | `prettier --write "src/**/*.{ts,tsx,css}"` |
| `npm test` | `vitest run` |
| `npm run test:watch` | `vitest` |
| `npm run package` | `electron-builder --win --publish never` |
| `npm run package:mac` | `electron-builder --mac --publish never` |
| `npm run package:linux` | `electron-builder --linux --publish never` |
| `npm run postinstall` | `electron-builder install-app-deps` |

`npm run build` does not type-check; run `npm run typecheck` separately. Packaging reads `out/**/*`, so build before running a package script. See [configuration.md](configuration.md) and [deployment.md](deployment.md).

## Repository structure

[`docs/folder-structure.md`](folder-structure.md) is the canonical source tree. In brief:

- `src/main/` — Electron main process: window, menu, IPC handlers, file I/O, updater.
- `src/preload/` — `contextBridge` API exposed as `window.api`; built as CJS.
- `src/shared/` — cross-process types.
- `src/renderer/store/` — Zustand document store composed from 14 slices.
- `src/renderer/runtime/` — transient Zustand runtime store.
- `src/renderer/tools/` — tool manager, registry, and implementations.
- `src/renderer/services/` — pure logic for geometry, rasterization, transform, masking, and export support.
- `src/renderer/elements/` — presentational element facades.
- `src/renderer/components/` — canvas, sidebar, toolbar, shared primitives, and dialogs.
- `src/__tests__/` — Vitest suites.

See [architecture.md](architecture.md), [state.md](state.md), and [components.md](components.md) for subsystem detail.

## Conventions evidenced in the source

- Use `safeScene()` rather than raw `scenes[activeSceneIndex]` when reading the active scene.
- Push history before a document mutation; the documented history cap is 500 entries.
- Element components in `src/renderer/elements/` and visual facades under `src/renderer/components/` are presentational; pointer routing goes through `ToolEventSurface` and the tool manager.
- Runtime state is transient and never serialized; document state is snapshot/serialized through the store.
- `@shared` maps to `src/shared`; renderer build code also maps `@` to `src/renderer`.
- Masks are independent scene layers in scene space with `zIndex`; do not reintroduce `targetId` coupling.
- File-system helpers use `app.getPath('userData')`; recovery ids are sanitized before path construction.

## Adding a feature

1. Decide which process owns it: main for native dialogs/file I/O/updates, renderer for UI and document/runtime state.
2. Update shared types in `src/shared/types.ts` only when data crosses a boundary or changes serialization.
3. For document behavior, add or change a store slice and preserve the history/dirty-tracking contracts.
4. For canvas interactions, add or change a tool rather than attaching pointer handlers to facades.
5. Add or update tests under `src/__tests__/`.
6. Run `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build` for changes that touch those surfaces.
7. Update the relevant doc and [`docs/index.md`](index.md) when behavior or file layout changes.

## Troubleshooting

- **Tests log `HTMLCanvasElement's getContext() is not implemented`** — jsdom has no canvas implementation unless the optional `canvas` package is installed; see [testing.md](testing.md) for the current run output.
- **Type errors after a successful build** — expected: `npm run build` only bundles; use `npm run typecheck`.
- **Update checks in `npm run dev` or `npm run start`** — the manual check returns a packaged-build-only failure by design; see [deployment.md](deployment.md).
- **`AGENTS.md` conflicts with source** — treat [`AGENTS.md`](../AGENTS.md) as a historical development log; current source and command output are canonical.

## Known gaps

- No formal contribution template or branch naming policy was found in the project files.
- `dev/` contains planning/design documents and is gitignored according to [`AGENTS.md`](../AGENTS.md); it is not a runtime source of truth.

## Sources

[`../package.json`](../package.json), [`../electron.vite.config.ts`](../electron.vite.config.ts), [`../tsconfig.node.json`](../tsconfig.node.json), [`../tsconfig.web.json`](../tsconfig.web.json), [`../vitest.config.ts`](../vitest.config.ts), [`../src/`](../src/), and [`../AGENTS.md`](../AGENTS.md).
