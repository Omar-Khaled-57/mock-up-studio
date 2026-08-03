# Mockup Studio — Architecture Documentation

> Version 0.3.0 · Released August 2, 2026
>
> Comprehensive technical reference for the Mockup Studio desktop application — an Electron + React + TypeScript device mockup scene builder.

---

## Table of Contents

### Core Documents

| Document | Summary |
|---|---|
| [Architecture Overview](./architecture.md) | High-level architecture, rendering pipeline, store separation, data flow |
| [Engines](./engines.md) | Rasterizer, export, transform sessions, polygon boolean, paint layers, stroke sampling, preview system |
| [Tools](./tools.md) | Tool manager, select/hand/marquee/focus/mask/brush tool taxonomy and behavior |
| [State Management](./state.md) | Zustand store (13 slices), history, serialization, clipboard, runtime store |
| [Components](./components.md) | Component hierarchy, element facades, overlay renderer, canvas subsystems |
| [Core Types](./types.md) | Type definitions for Scene, Device, TextBox, ImageOverlay, Shape, Mask, Background, etc. |

### Existing Specialized Documents

| Document | Summary |
|---|---|
| [Mask Engine](./mask-engine.md) | Deep-dive on the first-class mask system — clip paths, boolean difference, frozen snapshots, background masks |

---

## Quick Summary

**Mockup Studio** is an Electron desktop application for building device mockup scenes. Users place devices (phones, laptops, monitors, etc.), add text boxes, images, and shapes, and arrange them on a canvas with smart guides, grouping, masking, and effects.

### Tech Stack

| Layer | Technology |
|---|---|
| Desktop shell | Electron (`contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`) |
| Bundler | electron-vite (requires Vite 5) |
| UI framework | React 19 + TypeScript |
| Styling | Tailwind CSS 3.4 |
| State management | Zustand (13 slices merged into a single store + separate runtime store) |
| Testing | vitest + jsdom (980 tests across 64 files) |
| Packaging | electron-builder (Windows NSIS/portable, macOS DMG, Linux AppImage) |
| Auto-update | electron-updater via GitHub Releases |

### Architecture at a Glance

```
┌─────────────────────────────────────────────────────────┐
│                    Electron Main Process                 │
│  (index.ts, menu.ts, ipc-handlers.ts, file-system.ts)   │
├─────────────────────────────────────────────────────────┤
│                    Preload (contextBridge)              │
│  (index.ts → window.api)                                │
└──────────────────────────┬──────────────────────────────┘
                           │
┌──────────────────────────┴──────────────────────────────┐
│                     Renderer Process                     │
│                                                         │
│  Document Store (Zustand)          Runtime Store       │
│  - ProjectSlice                     - runtimeSlice      │
│  - SceneSlice / SelectionSlice      - brush, focus,     │
│  - HistorySlice / ViewportSlice     preview, overlay   │
│  - UiSlice / ExportSlice            transient state   │
│  - ClipboardSlice / VersionHistory                     │
│  - WatermarkSlice / ShapeSlice                         │
│  - MaskSlice / EffectsSlice                           │
│  - (13 slices total)                                  │
│                                                         │
│  App.tsx                                               │
│  ├── Sidebar (rail + tab panels)                       │
│  ├── Canvas                                            │
│  │   ├── CanvasChromeBar (zoom, view, scene tabs)      │
│  │   ├── Canvas                                      │
│  │   │   ├── Ruler.tsx                               │
│  │   │   ├── Scene.tsx    ← [data-scene-export]      │
│  │   │   │   ├── BackgroundRenderer                   │
│  │   │   │   ├── Grid.tsx                            │
│  │   │   │   ├── ElementFacade (per element)         │
│  │   │   │   │   ├── DeviceFrame / TextBox /         │
│  │   │   │   │   │   ImageOverlay / ShapeRenderer      │
│  │   │   │   ├── Container clip wrappers             │
│  │   │   │   └── Guides.tsx (persistent)             │
│  │   │   │   (watermark is export-only)              │
│  │   │   └── ToolEventSurface (pointer dispatcher)   │
│  │   └── OverlayRenderer (transient editor chrome)   │
│  │       ├── FocusDim                               │
│  │       ├── Guides (snap, transient)              │
│  │       ├── MaskRenderer                           │
│  │       ├── Selection chrome (resize handles)      │
│  │       ├── Marquee                                 │
│  │       ├── Hover outline                          │
│  │       ├── StrokeSurface (brush preview)          │
│  │       └── PreviewSurface (ghost/blur indicator)  │
│  └── PropertiesPanel (contextual: empty/multi/single)│
│  └── ExportDialog (modal, ≥3 entry points)           │
│                                                         │
│  BottomToolbar (tool groups + options + undo/redo)    │
│  ToolOptionsPanel (inline, accent left border)         │
└─────────────────────────────────────────────────────────┘
```

### Key Architectural Principles

1. **Elements are presentational facades** — Element components (`ElementFacade`, `DeviceFrame`, `TextBox`, `ImageOverlay`, `ShapeRenderer`) have **zero pointer handlers**. The Tool Manager (via `ToolEventSurface`) owns all interactions: click-select, drag-move, resize, double-click, context menus.

2. **Live DOM mutation + commit-on-end** — Drag and resize sessions mutate DOM styles directly during the gesture (60fps), committing to the store only on pointer-up. Cancel restores the start position. This applies to both `createDragSession` and `createResizeSession`.

3. **Export-clean by architecture** — The `[data-scene-export]` node is the export boundary. All transient editor chrome (selection, guides, masks, previews, watermark) renders in `OverlayRenderer` as a **sibling** of the export node, so it can never leak into exports.

4. **Runtime vs. document separation** — Two Zustand stores: the **document store** (scenes, elements, history — serialized/snapshotted) and the **runtime store** (tools, previews, focus, transient state — never serialized). Document slices import `resetRuntime` but the runtime store never imports from the document store (circular dependency avoidance).

5. **History contract** — `pushHistory(label)` is called **BEFORE** every store mutation. Undo restores the pre-mutation snapshot. Max 500 entries. Undo/redo triggers `resetRuntime('transient')` to clear stale editor state.

6. **Mask system** — First-class scene layers (`Scene.masks[]`). Masks are **z-aware scene layers**: no `targetId`, no element coupling — geometry is stored in **scene coordinates** and a mask preserves content at/below its `zIndex` while punching out content above it. Additive masking (every `mask`-mode stroke adds a new mask); subtractive unmask (polygon boolean difference in the data model via `differenceRegion`). Frozen masks embed whole-scene captures via `MaskSnapshotLayer`.

7. **Polygon boolean clipping** — The `polygon-clip.ts` module implements a full Martinez-style boolean difference algorithm for the unmask operation, since CSS `clip-path` can only intersect (keep-sets), never subtract.

8. **Two preview mechanisms** — The fast overlay (`StrokeSurface` canvas) for brush strokes at 60fps, and the preview system (`PreviewState` in runtime store → `PreviewSurface` canvas) for ghost/transform indicators. Both are imperative canvas renders subscribing to store changes, avoiding React re-render storms.

9. **Safe scene access** — `safeScene(state)` must be used everywhere instead of raw `scenes[activeSceneIndex]` — it guards against empty arrays and out-of-bounds indices (after undo/redo or scene deletion).

10. **`safeScene()` must be used instead of raw `scenes[activeSceneIndex]` everywhere** — it guards against empty arrays and out-of-bounds indices.

11. **Focus-scoping** — Focus mode (M9) gates all element interactions: dimmed-out content is rejected at pointer-down. Smart guides and grid snap are independent toggles. The focus path is root→focused group ancestry.

12. **`@shared/*` path alias** — Configured in both `tsconfig.web.json` and `tsconfig.node.json`, resolving to `src/shared/types.ts`.

---

## Development Commands

| Command | Description |
|---|---|
| `npm run dev` | Dev mode with hot reload |
| `npm run build` | Production build |
| `npm start` | Run production build |
| `npm test` | Run vitest (single run) |
| `npm run test:watch` | Run vitest in watch mode |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript type checking |
| `npm run package` | Build Windows distributable (NSIS + portable) |
| `npm run package:mac` | Build macOS DMG |
| `npm run package:linux` | Build Linux AppImage |
