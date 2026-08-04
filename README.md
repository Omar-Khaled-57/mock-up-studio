# <img src="public/logo.png" width="64" height="64" style="vertical-align: middle; margin-right: 8px;" /> Mockup Studio

Desktop device mockup scene builder. Compose beautiful device mockups with drag-and-drop, multi-scene support, and instant export.

## Origin Story

Mockup Studio started as a single HTML file — `mockup-template.html` — a quick static mockup generator for showcasing device screens. As features piled on (text editing, backgrounds, layer management), it grew into a full React + Vite project. But the scope had outgrown a web app: native file handling, true drag-and-drop, performance at scale, and desktop packaging all demanded more. That's when Mockup Studio was reborn as a proper Electron desktop application with a real architecture — Zustand state management, IPC-based file I/O, and a component system designed to scale.

> The original web app (React + Tailwind) is preserved in the [`legacy`](https://github.com/Omar-Khaled-57/mock-up-studio/tree/legacy) branch.

## Features

### Core Editing
- **7 Device Types** — Monitor, Laptop, iPad, Phone, Watch, Browser, Terminal
- **Drag & Resize** — 60fps pointer-event-based dragging with direct DOM mutation, Shift-proportional scaling
- **Tool System** — Bottom toolbar with Select, Brush, Eraser, Focus, and Mask tool groups; single-key shortcuts (V/H/M/X/B/E/G)
- **Smart Snapping** — Snap to element edges, canvas center, grid, and guides; independent smart-guide and grid-snap toggles
- **Text Editing** — Inline editing with inline editor (gradient, glow, shadow, stroke, letter/word spacing, text-transform, line height)
- **Image Overlays** — Upload, position, and style images; opacity, border-radius, blend modes (12), flip X/Y, blur, glow, shadow, per-element effects

### Shape System
- **13 SVG shape kinds** — Rectangle, circle, ellipse, triangle, star, hexagon, diamond, parallelogram, trapezoid, cross, plus, heart, arrow-right
- Shape fill, opacity, rotation, blur, blend mode, corner radius
- Shape background image (SVG pattern fill)
- Shape-specific thickness controls (cross, plus, arrow)

### Masking
- **First-class masks** — reusable clip geometry on any element or the whole canvas
- **Mask / Unmask modes** — draw to hide (punch) or draw to restore (reveal)
- Additive masking (stacked strokes) with subtractive unmask via polygon boolean difference
- Mask brush, rectangle, and ellipse shapes
- Frozen mask snapshots (opt-in whole-scene capture)
- Transparent canvas with black + blue checkerboard visualization

### Image Editing Tools
- **Paint Brush** — freehand strokes committed as per-stroke raster layers
- **Blur Brush** — brush and region tools (rect, ellipse, line) for selective blur
- **Eraser** — destination-out erase to transparent
- **Magic Eraser** — tolerance-based flood-fill erase
- **Per-element effects** — 9 non-destructive adjustments (brightness, contrast, exposure, saturation, hue, gamma, temperature, tint, blur)

### Selection & Layers
- **Focus mode** — group-scoped editing with dimming scrim and highlight ring
- **Container clips** — grouped elements render clipped to their container's shape
- **Drag-to-nest** — drag elements onto containers to parent them; empty-canvas drop un-nests
- **Aspect ratio lock** — per-element toggle, preserves shape without holding Shift
- **Multi-scene** — Multiple scenes per project with tab navigation, drag-to-reorder, pinning
- **Layer management** — Z-order reordering, visibility/lock toggles, inline rename, groups, nested groups
- **Alignment & distribution** — 6-direction align, 4-direction distribute (space and center)
- **Copy / Paste Style** — transfer appearance properties between same-kind elements

### Canvas & Viewport
- **Canvas chrome bar** — scene tabs, zoom controls (in/out/reset/fit), View menu
- **Canvas rotation** — Rotate 90° button
- **Rulers** — zoom/pan-aware tick marks, drag to create guides
- **Interactive guides** — drag to reposition, right-click to delete
- **Grid** — configurable size, color, opacity, snap
- **Transparent canvas** — toggle in Themes panel; real alpha in exports

### Backgrounds & Themes
- **7 built-in backgrounds** — Aurora, Neon Grid, Blue Cyber, QPreset, Qless, Storybox 3, Dark Solid
- **Background editor** — Solid, gradient (linear/radial), image, and preset types
- **17 color theme presets** — instant one-click scene color schemes
- **Dark / Light UI** — interface theme toggle (canvas stays dark)

### Export & Projects
- **Export modal** — PNG, JPEG, WebP at 1x–4x scale with solid/transparent/custom backgrounds
- **Multi-scene export** — Export all scenes as a ZIP archive
- **Project files** — `.mockup` ZIP format with JSON manifest + embedded assets
- **Version history** — Auto-snapshots every 5 minutes (pinned scenes only)
- **Auto-save recovery** — Crash recovery with periodic snapshots
- **File association** — Double-click `.mockup` files to open them directly
- **Unsaved changes guard** — Prompts before closing with unsaved work
- **Auto-update** — GitHub Releases integration (production builds) with styled in-app prompts (checking / available / up-to-date / failed), a 25s network-timeout guard, and download progress bars
- **Styled dialogs** — About and all update prompts render as in-app modals instead of native system dialogs
- **Keyboard shortcuts** — Full shortcut suite with reference modal (Ctrl+/)
- **Watermark** — Optional text watermark excluded from exports
- **Color extraction** — Extract dominant colors from device screens
- **Layout templates** — Pre-composed layouts for quick scene setup

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop Shell | Electron 33 |
| Bundler | electron-vite 2 (Vite 5) |
| UI Framework | React 18 + TypeScript 5.6 |
| Styling | Tailwind CSS 3.4 |
| State Management | Zustand 5 (13 slices + runtime store) |
| Export | modern-screenshot 4 |
| Archive | JSZip 3 |
| Icons | Lucide React |
| Testing | Vitest + jsdom |
| Packaging | electron-builder 25 |

## Getting Started

### Prerequisites

- Node.js 18+
- npm 9+

### Install

```bash
npm install
```

### Development

```bash
npm run dev
```

### Build

```bash
# Windows (NSIS installer + portable)
npm run package

# macOS (DMG)
npm run package:mac

# Linux (AppImage)
npm run package:linux
```

Output is written to `release/`.

### Testing

```bash
npm test              # single run
npm run test:watch    # watch mode
```

### Linting

```bash
npm run lint
npm run typecheck
```

## Project Structure

The canonical, up-to-date source tree lives in **[`docs/folder-structure.md`](./docs/folder-structure.md)** — a complete `src/` walkthrough with per-directory descriptions and repository conventions. A high-level summary:

```
src/
  main/            Electron main process (window, menu, IPC, file I/O, auto-update)
  preload/         contextBridge API (sandbox-compatible CJS build)
  shared/          types.ts — core interfaces shared across processes
  guide/           In-app User Guide content
  renderer/
    App.tsx        Root layout, dirty tracking, menu IPC, file association
    store/         Zustand document store (13 merged slices)
    runtime/       Zustand runtime store (transient editor state)
    tools/         Tool system: manager, registry, types, tool implementations
    services/      Pure logic: rasterizer, transform, stroke, polygon-clip,
                   mask system, hit-test, snapping, geometry, preview, viewport
    hooks/         useDebouncedHistory, useKeyboardShortcuts, useTheme, ...
    lib/           constants, device-utils, export-engine, effects,
                   project-serialization, brush-presets, element-factories, ...
    elements/      ElementFacade (presentational wrapper, mask application)
    components/    canvas, devices, text, images, shapes, backgrounds,
                   effects, masks, primitives, sidebar, shared, splash, toolbar
    __tests__/       Vitest + Testing Library suites (74 test files)
docs/              Architecture documentation (see docs/index.md)
public/            Icons + in-app changelog.json
release/           electron-builder output
```

## Architecture

### State Management

Mockup Studio uses **two separate Zustand stores**:

| Store | Description |
|-------|-------------|
| **Document store** (`store/`) | All persisted state. Composed of 13 merged slices: project, scene, selection, history, viewport, UI, export, clipboard, version-history, watermark, shape, mask, effects. |
| **Runtime store** (`runtime/store.ts`) | Transient editor state (active tool, hover, marquee, brush settings, focus, previews, snap guides, editing). Never serialized. Importable by document slices via `resetRuntime`, but never the reverse. |

| Slice | Responsibility |
|-------|---------------|
| `projectSlice` | File path, dirty state, save/open/new |
| `sceneSlice` | Scene CRUD, z-order, grid/guides/masks/groups, `safeScene()` |
| `selectionSlice` | Multi-select, select-all, alignment, distribution, focus filter |
| `historySlice` | Undo/redo (JSON string snapshots, 500 max) |
| `viewportSlice` | Zoom, pan, fit-to-window |
| `uiSlice` | Sidebar tab, theme, splash state, rulers |
| `exportSlice` | Export format, scale, quality, background, scope |
| `clipboardSlice` | Internal copy/cut/paste, copy-paste style |
| `versionHistorySlice` | Auto-snapshots (5min interval, 50 max, pinned scenes only) |
| `watermarkSlice` | Watermark text and visibility |
| `shapeSlice` | Shape CRUD (independent from sceneSlice) |
| `maskSlice` | Mask CRUD, reverse, clear-all, refresh snapshot |
| `effectsSlice` | Per-element image effects (brightness, contrast, blur, etc.) |

### Key Patterns

- **Two-store separation**: document store (serialized) vs runtime store (transient, reset-aware)
- **Dirty tracking**: `attachDirtyTracking` sets `dirty` when the `scenes` array reference changes; `withDirtySuppressed` for programmatic loads
- **Tool Manager pattern**: centralized dispatch; elements are pure presentational facades with zero pointer handlers
- **Live DOM mutation**: Drag/resize mutate DOM styles directly (60fps), commit to store only on pointer-up
- **History contract**: `pushHistory(label)` called BEFORE every mutation; max 500 entries
- **Scene safety**: `safeScene()` selector prevents out-of-bounds access everywhere
- **Export boundary**: `[data-scene-export]` node isolates exportable content from transient editor chrome
- **Focus scoping**: group/element-scoped editing gates all tool interactions via `focusEditable`
- **Runtime reset**: `resetRuntime('transient')` (undo/redo, scene switch) vs `'all'` (project load/new)
- **Keyboard shortcuts**: V (Select), H (Hand), M (Marquee), X (Focus), B (Brush), E (Eraser), G (Mask), Space (temp Hand), Ctrl+E (Export), Ctrl+/(Shortcuts), Ctrl+Z/Y (Undo/Redo)
- **Close guard**: IPC-based unsaved-changes prompt with 3s safety timeout
- **File association**: Handles macOS `open-file`, Windows/Linux `second-instance`, and `process.argv`

## File Format

`.mockup` files are ZIP archives containing:

```
manifest.json          Project metadata + scene data
assets/                Device screens, images, thumbnails (base64 in manifest)
```

## Testing

1091 tests across 74 files covering all store slices, utility functions, tools, engines, mask system, rasterizer, export engine, and component rendering.

## License

MIT
