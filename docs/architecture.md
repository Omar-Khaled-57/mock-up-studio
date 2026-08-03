# Architecture Overview

## Process Architecture

Mockup Studio runs in three processes connected by Electron's IPC:

### 1. Main Process (`src/main/`)

The Electron main process manages the application lifecycle, native menus, file I/O, and packaging.

| File | Responsibility |
|---|---|
| `index.ts` | Window creation (1400×900, maximized, `contextIsolation: true`, `sandbox: true`), lifecycle events, file-association handling, unsaved-changes guard with 3s safety timeout |
| `menu.ts` | Native Electron menu (File/Edit/View/Help) — all actions sent to renderer via `menu-action` IPC |
| `ipc-handlers.ts` | All IPC `invoke` handlers: save/open project, save image dialog, recent projects, crash recovery |
| `file-system.ts` | ZIP I/O for `.mockup` files, recovery snapshots, recent projects persistence |
| `auto-updater.ts` | Auto-update via GitHub Releases (production only, 6h check interval) |

**Security:** The renderer has **no Node.js access**. All file I/O is mediated by the main process through `ipcRenderer.invoke` calls exposed via the context bridge (`window.api`).

### 2. Preload (`src/preload/`)

A CJS-compiled context bridge that exposes `window.api` with typed methods:
- `saveProject`, `saveProjectAs`, `openProject`, `openProjectByPath`
- `saveImageDialog`
- `getRecentProjects`, `writeRecovery`/`readRecovery`/`deleteRecovery`
- `onMenuAction`, `onRequestClose`, `confirmClose`/`cancelClose`
- `onOpenFile`, `openUserGuide`, `checkForUpdatesNow`, `onDownloadProgress`

### 3. Renderer Process (`src/renderer/`)

The React application, built with electron-vite. It contains two state layers (document store and runtime store) and the entire UI component tree.

---

## Rendering Pipeline

The canvas is a **layered, export-safe, data-driven system**. All canvas components render inside a single viewport `<div>` whose `transform: translate(panX, panY) scale(zoom)` provides the pan/zoom coordinate space — every child inherits the camera.

### Layer Stack (back to front)

```
┌─────────────────────────────────────────────────────────────────┐
│  Canvas.tsx (viewport container — pan/zoom transform lives here)│
├─────────────────────────────────────────────────────────────────┤
│  Ruler.tsx (top + left, viewport space)                         │
├─────────────────────────────────────────────────────────────────┤
│  Scene.tsx  ─── [data-scene-export] (EXPORT NODE)              │
│  ├── [data-scene-background] → BackgroundRenderer (band 0)    │
│  ├── Grid.tsx (z-index: 1)                                     │
│  ├── [data-scene-band] grouping divs (z-band partition)        │
│  │   └── Z-sorted elements:                                    │
│  │     DeviceFacade → DeviceFrame → ScreenContainer            │
│  │     TextBoxFacade → InlineEditor / RenameOverlay            │
│  │     ImageOverlay (with effects, blend, flip, blur)          │
│  │     ShapeRenderer (SVG, gradient, background image)         │
│  │     └─ Container clip wrappers (nested)                    │
│  ├── [data-scene-mask-clip] wrappers (z-aware, fold descending)│
│  │   └── MaskSnapshotLayer siblings (frozen masks)             │
│  ├── Guides.tsx (persistent, data-guide, interactive drag)    │
│  │   (watermark is export-only — injected by export-engine)     │
│  └── Context menu (from runtime store)                         │
├─────────────────────────────────────────────────────────────────┤
│  ToolEventSurface.tsx (pointer dispatcher, viewport space)    │
├─────────────────────────────────────────────────────────────────┤
│  OverlayRenderer.tsx (transient editor chrome)                 │
│  ├── Transparent checker ([data-transparent-checker])         │
│  ├── FocusDim (scrim + highlight ring)                        │
│  ├── Guides (snap, data-snap-guide, export-clean)             │
│  ├── MaskRenderer (mask outlines + live stroke preview)       │
│  ├── Selection chrome (resize handles, rotation-aware)        │
│  ├── Container drop ring (live nest target)                    │
│  ├── Marquee (transient selection rect)                        │
│  ├── Hover outline (suppressed for selected)                  │
│  ├── StrokeSurface (imperative canvas, brush preview)         │
│  └── PreviewSurface (imperative canvas, ghost/blur indicators)│
└─────────────────────────────────────────────────────────────────┘
```

### Export Boundary

The `[data-scene-export]` node is the export boundary. The export engine clones this subtree and:
- Strips `[data-watermark]` and `[data-guide]` elements (transient chrome).
- Strips `[data-scene-background]` when `background !== 'scene'` (solid/transparent overrides).
- Punches scene-mask holes via canvas compositing (`destination-out` + `evenodd`).

**All overlay chrome** (OverlayRenderer contents) is a sibling of `[data-scene-export]`, so it can never leak into exports.

---

## Store Architecture

Two completely separate Zustand stores:

### Document Store (`src/renderer/store/index.ts`)

Composed of 13 slices, all serialized/snapshotted by history:

| Slice | File | Responsibility |
|---|---|---|
| `ProjectSlice` | `projectSlice.ts` | Project metadata, file path, dirty flag (activeSceneIndex lives in SceneSlice) |
| `SceneSlice` | `sceneSlice.ts` | All scenes, activeSceneIndex, device/textBox/image/shape CRUD, z-order, grouping, guides, grid, masks |
| `SelectionSlice` | `selectionSlice.ts` | selectedIds, group-aware selection, align, distribute |
| `HistorySlice` | `historySlice.ts` | undoStack/redoStack (JSON string snapshots, max 500), undo/redo |
| `ViewportSlice` | `viewportSlice.ts` | zoom, pan, fitToWindow, canvas size |
| `UiSlice` | `uiSlice.ts` | sidebarTab, sidebarCollapsed, propertiesPanelOpen, showRulers, showSmartGuides, theme, showSplash, sidebarPanelWidth, propertiesPanelWidth, downloadProgress (no `showSidebar`/`showGrid`) |
| `ExportSlice` | `exportSlice.ts` | format, scale, quality, background, background color (no `scope` field) |
| `ClipboardSlice` | `clipboardSlice.ts` | clipboard entries, copy/cut/paste, copiedStyle |
| `VersionHistorySlice` | `versionHistorySlice.ts` | Auto-snapshots, restore/delete snapshots |
| `WatermarkSlice` | `watermarkSlice.ts` | watermark text, font, opacity, position |
| `ShapeSlice` | `shapeSlice.ts` | Shape-specific state (separate from sceneSlice) |
| `MaskSlice` | `maskSlice.ts` | Mask CRUD, reverse, clear, refresh snapshot |
| `EffectsSlice` | `effectsSlice.ts` | updateEffects, resetEffects (state lives on elements) |

Composition: `(...a) => ({ ...createProjectSlice(...a), ...createSceneSlice(...a), ... })` — each slice receives the full Zustand tuple and returns a partial state.

**Dirty tracking:** `attachDirtyTracking` subscribes to the store and sets `dirty = true` whenever the `scenes` array reference changes (every mutating action is an immutable update). Programmatic loads (open/new/recent) use `withDirtySuppressed` so they don't mark a fresh project dirty.

### Runtime Store (`src/renderer/runtime/store.ts`)

A **separate** Zustand store. Transient state — **never serialized or snapshotted**.

| Category | Fields | Reset behavior |
|---|---|---|
| **Tool** | `activeToolId`, `temporaryToolStack` | transient: kept / all: default `select` |
| **Interaction** | `pointerScenePos`, `pointerInCanvas`, `activeInteraction` | transient: cleared |
| **Selection chrome** | `hoveredElement`, `marqueeRect` | transient: cleared |
| **Brush** | `strokeBuffer`, `strokeDirty`, `brush: BrushOptions` | strokeBuffer + strokeDirty: transient: cleared / brush: kept on transient, reset to defaults on 'all' |
| **Focus** | `focusGroupId`, `focusElementId` | transient: kept / all: cleared |
| **Previews** | `preview: PreviewState`, `maskPreview`, `maskShape`, `maskMode` | transient: cleared / maskShape/mode: kept (all: reset) |
| **Editing** | `editing` (text/rename/upload) | transient: cleared |
| **Chrome** | `snapGuides`, `containerDropTarget`, `canvasEmptyStateDismissed` | snapGuides + containerDropTarget: transient: cleared / canvasEmptyStateDismissed: kept on transient, cleared on 'all' |
| **UI** | `propertiesSections`, `exportModalOpen`, `toolbarToolsVisible` | transient: kept / all: reset |

**Reset contract:**
- `resetRuntime('transient')` — clears in-flight interaction state. Used on undo/redo, scene switches, multi-scene export iteration.
- `resetRuntime('all')` — additionally restores defaults (tool, brush, focus, etc.). Used on project load/new. Fires `registerFullResetHook` callbacks (e.g., `toolManager.reset()`) after state is set.

**Critical constraint:** The runtime store module must never import from the document store — it would create a circular dependency (document slices need `resetRuntime`). Instead, document slices import `resetRuntime` from the runtime module.

---

## Data Flow

```
User Input (pointer/key)
    ↓
ToolEventSurface (hit-test, scene-point, dispatch to ToolManager)
    ↓
ToolManager.buildContext() (resolve effective tool, hit result, modifiers, actions)
    ↓
Tool.onPointerDown / onPointerMove / onPointerUp
    │
    ├── (live) DOM mutation via session OR fastOverlay canvas OR preview
    └── (commit) ctx.actions.* → useStore.getState().* → pushHistory BEFORE mutation
    ↓
React re-render of affected element facades (via store subscriptions)
```

### History Contract

```
1. pushHistory(label) — BEFORE mutation
   - Serializes scenes array to JSON string
   - Pushes onto undoStack, clears redoStack, caps at 500
   - Triggers maybeAutoSnapshot() on next tick

2. Store mutation (updateDevice/updateShape/etc.)
   - Immutable update of scenes[activeSceneIndex]

3. React re-renders affected elements

Undo:
1. Pop undoStack, push current to redoStack
2. Parse snapshot → set scenes
3. Clamp activeSceneIndex
4. resetRuntime('transient')
```

### Tool Architecture Pattern

```
Tool Descriptor (stateless)
    ↓
InteractionContext (from ToolManager.buildContext)
    │  ├─ effectiveToolId, pointerScenePos
    │  ├─ hitResult (from hitTest sceneGeometry)
    │  ├─ modifiers {shift, ctrl, alt, meta}
    │  ├─ actions (DocumentActions → store)
    │  ├─ getRuntime() / setRuntime()
    │  ├─ focusEditable(id) (focus scope gate)
    │  └─ fastOverlay (imperative canvas host)
    ↓
Tool.onPointerDown(e, ctx)
    ├─ Focus gate: !focusEditable → clearSelection + return
    ├─ Pointer claim: ctx.claimPointer()
    ├─ beginInteraction({ kind, toolId, pointerId })
    ├─ (live) DOM mutation OR session.move() OR fastOverlay/stroke
    └─ (commit) pushHistory(label) → ctx.actions.*(mutation)
```

### Store State Immutability Contract

Every mutation in the document store is an **immutable update** — `set`, `produce`, or spread that creates a new state object. The dirty tracker relies on this: it subscribes to the store and checks if the `scenes` array reference has changed. Direct mutation of scene objects will not trigger the dirty flag.

### Reset Semantics Contract

| Operation | Reset type | What's cleared |
|---|---|---|
| Undo/Redo | `'transient'` | All in-flight gesture state (marquee, stroke, preview, interaction, hover, guides, drop target) |
| Scene switch | `'transient'` | Same as above (stale element references) |
| Project load/new | `'all'` + `fullResetHook` | Everything above + activeToolId→select, temp stack cleared, focus cleared, brush→defaults, maskShape/mode→defaults, export modal closed, properties sections reset |
| Multi-scene export iteration | `'transient'` | Between scenes (prevents ghost state leaking into captures) |

---

## Coordinate Systems

The application uses three coordinate spaces:

### Scene Coordinates
The canonical coordinate system. `scene.canvas.width` × `scene.canvas.height`. All element positions (x, y, width, height) are in scene coordinates. The scene div has explicit `width`/`height` matching the canvas.

### Viewport Coordinates
Screen pixels. The viewport container (`Canvas.tsx`) measures its size via `ResizeObserver` and applies `transform: translate(panX, panY) scale(zoom)`. Pan/zoom translate scene coordinates to viewport coordinates.

### Element-Local Coordinates
Used by the bitmap-target machinery for destructive tools (see Canvas-Bitmap
Coordinates): conversion via `toLocalPoint(element, origin, scenePoint)`
inverse-rotates around the element center then subtracts the element origin +
bitmap offset. Masks are NOT stored in element-local frames — masks are
independent scene layers with scene-space geometry (see `docs/mask-engine.md`),
so a mask clips whatever content stacks above it by z-order.

### Canvas-Bitmap Coordinates
For destructive tools (blur/eraser), the bitmap (device screenshot, shape background image, image src) has its own pixel grid. A device's screen region is inset from the element box per device type (monitor bezel is 4% top / 3% bottom, etc.). Conversion: scene point → element-local → screen-region-relative → bitmap pixel.

---

## Path Aliases

| Alias | Resolves to |
|---|---|
| `@shared/*` | `src/shared/*@shared/types.ts` (core types, via `tsconfig.web.json` + `tsconfig.node.json`) |
| `@` | `src/renderer/` (convenience) |

---

## Key Invariants

1. **`safeScene()` everywhere** — never `scenes[activeSceneIndex]` directly; it guards against empty arrays and out-of-bounds indices.

2. **Elements are pure facades** — no pointer handlers on `ElementFacade`, `DeviceFrame`, `TextBox`, `ImageOverlay`, or `ShapeRenderer`. All interactions go through the Tool Manager via `ToolEventSurface`.

3. **`pushHistory` before mutation** — universally enforced across all 13 slices and the PropertiesPanel.

4. **Runtime store never imports document store** — breaks the circular dependency. Document slices import `resetRuntime`.

5. **Export node boundary** — `[data-scene-export]` is the canonical subtree cloned by the export engine. Overlay chrome renders outside it.

6. **`objectFit: 'fill'`** on image overlays — the image always fills its box so the rendered bitmap agrees with the box aspect ratio (critical for aspect-ratio lock).

7. **Scene elements are z-sorted** across all four kinds (devices, textBoxes, images, shapes) — a single flat array sorted by `zIndex` produces the render order, so a shape can layer between two devices.

8. **`@shared/types.ts` is the single source of truth** for all data models — imported by both main and renderer processes.
