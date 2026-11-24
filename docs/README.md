# Mockup Studio documentation index

Start here for a source-backed view of the current project. The canonical inputs are [`package.json`](../package.json), [`electron.vite.config.ts`](../electron.vite.config.ts), [`vitest.config.ts`](../vitest.config.ts), [`src/`](../src/), and the command output recorded in [testing](./testing.md).

## Standard project pages

| Document | Description |
| --- | --- |
| [README](../README.md) | Product overview, features, stack, quick start, command summary, and license line. |
| [Product](./product.md) | What the app is for, what it does today, feature inventory, and known gaps. |
| [Architecture](./architecture.md) | Deep technical reference for processes, rendering, state, and data flow. |
| [Development](./development.md) | Install, run, checks, source layout, and conventions. |
| [Configuration](./configuration.md) | Scripts, build settings, env vars, runtime paths, and persisted state. |
| [Testing](./testing.md) | Test runner, exact commands, current suite counts, and gaps. |
| [Deployment](./deployment.md) | Build and package commands, artifacts, targets, and unconfigured items. |
| [Changelog](./changelog.md) | Pointer and summary for the maintained root [CHANGELOG](../CHANGELOG.md). |

## Existing deep docs

| Document | Description |
| --- | --- |
| [Documentation index](./index.md) | Original architecture documentation index and quick summary. |
| [Root changelog](../CHANGELOG.md) | Maintained release notes; summarized by [Changelog](./changelog.md). |
| [Folder structure](./folder-structure.md) | Canonical source-tree walkthrough; prefer this over duplicated trees. |
| [Engines](./engines.md) | Rasterizer, export, transform, polygon boolean, paint layers, stroke sampling, and preview systems. |
| [Tools](./tools.md) | Tool manager and tool taxonomy. |
| [State management](./state.md) | Zustand document slices, history, serialization, clipboard, and runtime store. |
| [Components](./components.md) | Component hierarchy, facades, and canvas subsystems. |
| [Core types](./types.md) | Type definitions for scenes, elements, masks, backgrounds, and components. |
| [Mask engine](./mask-engine.md) | Deep dive on scene-space mask layers, clip paths, boolean difference, and snapshots. |
| [Visual identity](./visual-identity.md) | Checked-in brand mark, colors, and note about the missing screenshot. |
| [Development log](../AGENTS.md) | Historical session log. Test counts and implementation notes are non-canonical; use the current source and standard pages for verified state. |

## Reading order

1. [README](../README.md) and [Product](./product.md) — orientation and current feature summary.
2. [Configuration](./configuration.md), [Development](./development.md), [Testing](./testing.md), and [Deployment](./deployment.md) — commands and verification.
3. [Folder structure](./folder-structure.md), [Architecture](./architecture.md), [Engines](./engines.md), [Tools](./tools.md), [State management](./state.md), [Components](./components.md), and [Core types](./types.md) — implementation detail.
4. [Mask engine](./mask-engine.md) and [Visual identity](./visual-identity.md) — specialized references.
5. [Changelog](./changelog.md), root [CHANGELOG](../CHANGELOG.md), and [Development log](../AGENTS.md) — history and planning context.

## Current-state caveats

- Masks are independent scene layers with scene-space geometry and `zIndex`; they do not use a `targetId`.
- Version-history auto-snapshots are time-gated by `AUTO_SNAPSHOT_INTERVAL = 5 * 60 * 1000` and capped by `MAX_SNAPSHOTS = 50`; there is no pinned-scene gate.
- `npm run build` runs `electron-vite build`; it does not run typechecking, linting, or tests.

## Sources

[`../package.json`](../package.json), [`../electron.vite.config.ts`](../electron.vite.config.ts), [`../vitest.config.ts`](../vitest.config.ts), [`../src/`](../src/), and the current command output recorded in [testing](./testing.md).
