# Components

The Mockup Studio renderer is a layered component tree with strict separation between **scene content** (inside the export node), **transient editor chrome** (sibling of the export node), and **UI chrome** (sidebar, toolbar, properties). All canvas components render inside a single viewport `<div>` whose `transform: translate(panX, panY) scale(zoom)` provides the pan/zoom camera.

---

## Component Hierarchy

```
App.tsx
├── ErrorBoundary("App")
├── UpdateModal (changelog)
├── ExportDialog (modal)
├── Sidebar.tsx
│   ├── SceneTabs (Design/Content/Organize/View/History tabs)
│   ├── DevicesPanel
│   ├── ImagesPanel
│   ├── TextPanel
│   ├── ShapesPanel
│   ├── ThemesPanel (Background editor)
│   ├── ThemePresetsPanel
│   ├── CanvasPresetsPanel
│   ├── GridPanel
│   ├── LayersPanel
│   ├── VersionHistoryPanel
│   └── WatermarkPanel
├── Canvas column (flex-1)
│   ├── CanvasChromeBar.tsx    (scene tabs, zoom, View menu)
│   ├── Canvas.tsx
│   │   ├── [ErrorBoundary("Canvas")]
│   │   └── CanvasEmptyState.tsx
│   └── BottomToolbar.tsx
│       └── ToolOptionsPanel.tsx
└── PropertiesPanel.tsx       (contextual: empty/multi/single)
```

Inside the Canvas viewport div (transformed):
```
Canvas viewport div (transform: translate/zoom)
├── Ruler.tsx (top) + Ruler.tsx (left)
├── Scene.tsx [data-scene-export]
│   ├── [data-scene-background] → BackgroundRenderer (band 0, never clipped)
│   ├── Grid.tsx
│   ├── [data-scene-band] grouping divs (z-band partition)
│   │   ├── ElementFacade → DeviceFrame
│   │   │   └── ScreenContainer
│   │   ├── ElementFacade → TextBox
│   │   │   ├── InlineEditor
│   │   │   └── RenameOverlay
│   │   ├── ElementFacade → ImageOverlay
│   │   ├── ElementFacade → ShapeRenderer
│   │   └── Container clip wrappers (nested)
│   ├── [data-scene-mask-clip] wrappers (z-aware masks fold descending)
│   │   └── MaskSnapshotLayer siblings (frozen masks)
│   ├── Guides.tsx (persistent, interactive)
│   │   (watermark is export-only — injected by export-engine)
│   └── ContextMenu (runtime)
└── ToolEventSurface.tsx (pointer dispatcher)
├── OverlayRenderer.tsx (transient editor chrome)
│   ├── Transparent checker
│   ├── FocusDim
│   ├── Guides (transient snap guides)
│   ├── MaskOverlay
│   ├── Selection chrome (resize handles)
│   ├── Container drop ring
│   ├── Marquee
│   ├── Hover outline
│   ├── StrokeSurface
│   └── PreviewSurface
└── CanvasChromeBar.tsx (at viewport top — actually separate)
```

---

## Canvas Components

### `Canvas.tsx`

**Role:** Viewport container. Manages the pan/zoom transform and renders rulers + scene + overlays.

**Key props:** None.

**Key responsibilities:**
- `ResizeObserver` on the container div — debounces 100ms, calls `fitToWindow` with scene canvas dimensions.
- Applies `transform: translate(panX, panY) scale(zoom)` to the scene div (pan/zoom camera).
- Renders `<Scene />` and `<ToolEventSurface />`.
- Renders `Ruler` components at top and left edges.
- Manages `canvasEmptyStateDismissed` — shows `<CanvasEmptyState />` when no user elements exist (excludes hero text boxes).
- Renders the canvas size chip (bottom-right: `W × H`).
- `onPointerDownCapture` dismisses the empty state unless the target is inside `[data-empty-state]`.
- Wheel handler: `Ctrl/Cmd + wheel` → zoom; middle-button/Alt+left → routed to Hand tool via the surface.

**Store interactions:** `safeScene`, `zoom`, `panX`/`panY`, `setZoom`, `fitToWindow`, `showRulers`, `canvasEmptyStateDismissed` + `dismissCanvasEmptyState`, `selectedIds` (for empty-state element count).

**Contracts:**
- `data-canvas-viewport` attribute — CanvasChromeBar's Fit button queries it.
- The transformed scene div has explicit `width`/`height` matching `scene.canvas`.
- Rulers render OUTSIDE the transformed div (in viewport space), so they stay pixel-fixed regardless of zoom.

### `Scene.tsx`

**Role:** The core renderer. Produces z-sorted elements, container clips, z-aware scene-mask banding, guides, watermark, and context menu. Everything inside `[data-scene-export]`.

**Key architecture:**

#### Z-Sorted Render

```typescript
function buildSortedEntries(scene): RenderNode[] {
  const all = findAllElements(scene)  // devices + textBoxes + images + shapes, sorted by zIndex
  const tree = build(all)             // group into container parent/child tree
  return flattenTree(tree)            // depth-first, but only for focused containers
}
```

`findAllElements` flattens across all 4 element kinds and sorts by `zIndex` — so a shape can layer between two devices. The tree builder respects `containerId` relationships.

#### Container Clip Wrappers

```typescript
// For each container (element with children) that is NOT focused:
<div data-container-clip="true"
     style={{
       left: container.x, top: container.y,
       width: container.width, height: container.height,
       zIndex: container.zIndex,
       overflow: 'hidden',
       clipPath: containerIsShape ? buildContainerClip(container) : undefined
     }}>
  <div style={{ left: -container.x, top: -container.y, width: canvasW, height: canvasH }}>
    {children}  // rendered at scene coordinates inside the clip window
  </div>
</div>
```

- `overflow: 'hidden'` clips rect containers.
- `clipPath` from `buildContainerClip` clips shape containers to their exact outline.
- The inner counter-translate layer shifts children back to scene coordinates.
- `handledInWrapper` set prevents double-rendering when a child's zIndex < the container's.

#### Focused Container

When `focusElementId === container.id`, the container's clip wrapper is **skipped** — children render inline unclipped. This is the "lift the clip" behavior of focus mode.

#### Z-Aware Scene Masks

Masks are independent scene layers (scene-space geometry, their own `zIndex`).
A mask **preserves** everything at or below its z-index and **punches out** only
content above it. The scene is partitioned into z-bands (band 0 = background +
everything at/below the lowest mask z; band i = `(mask[i-1].z, mask[i].z]`;
top band = above the highest mask):

```typescript
const liveMasks = visibleMasks.filter(m => !m.snapshot)   // sorted by zIndex
const bandForZ = z => liveMasks.findIndex(m => z <= m.zIndex) ?? liveMasks.length

bandContent[bandForZ(-1)] = <div data-scene-background>…</div>   // never clipped
bandContent[bandForZ(1)]  = <Grid …/>
nodes.forEach(node => bandContent[bandForZ(nodeZ)].push(renderNode(node)))

// inert per-band grouping divs (capturable by the export engine):
<div data-scene-band={b} style={{ position: 'absolute', inset: 0 }}>…</div>

// live masks fold DESCENDING: lowest mask outermost, highest innermost —
// clip m(i) wraps band i+1 + every higher mask, so each mask clips exactly
// the content above it.
```

Each mask wrapper is `<div data-scene-mask-clip="true" data-scene-mask-for={mask.id}
style={{ position:'absolute', inset:0, overflow:'hidden', zIndex: mask.zIndex,
pointerEvents:'none', clipPath: buildMaskClipPath(mask, canvasW, canvasH) }}>`.
Frozen masks (a `snapshot`) skip banding entirely and emit a `MaskSnapshotLayer`
sibling instead.

The `[data-scene-background]` wrapper lives in band 0 (always unclipped). For
non-`'scene'` exports, the engine strips `[data-scene-background]` nodes — but
the band wrappers persist so element holes stay correct.

#### Guides (Persistent)

```typescript
scene.guides.map(g => (
  <div data-guide="true" orientation={g.orientation}
       style={{
         [g.orientation === 'vertical' ? 'left' : 'top']: g.position + 'px',
         cursor: g.orientation === 'vertical' ? 'ew-resize' : 'ns-resize',
         // 4px hit area, pink gradient
       }}>
    <button data-guide-delete>×</button>
  </div>
))
```

Guides have full pointer handlers (drag-to-move via `setPointerCapture`, right-click context menu for delete). They're children of `[data-scene-export]` (so they ARE in exports — unlike snap guides which are overlay chrome).

#### Watermark + Context Menu

`WatermarkOverlay` was removed in favor of export-only watermarking: the watermark never renders in the editor, and `export-engine` injects it into the export clone when enabled (style built by `lib/watermark.ts`). Context menu renders from `runtime.contextMenu` (set by Select tool's `onContextMenu`).

### `ToolEventSurface.tsx`

**Role:** Viewport-level pointer dispatcher. Translates DOM coordinates → scene coordinates, resolves the active tool, and routes pointer events. Owns pointer capture.

**Key decisions (see [Tools](tools.md#tool-event-surface) for full detail):**
- Three-tier tool resolution: pointer owner → pan gesture → effective tool.
- Resize handle interception BEFORE active tool resolution (tool-independent resize).
- Three-tier hit-test fallback: scene-geometry → `[data-element-id]` DOM → `[data-chrome-element-id]` DOM.
- Cursor computation via `toolManager.getCursor()` with focus-dimming.
- `data-canvas-chrome` / `data-guide` guard blocks chrome clicks from reaching tools.
- Wheel: `Ctrl/Cmd+wheel` → zoom; middle-button/Alt+left → Hand tool.

### `OverlayRenderer.tsx`

**Role:** Renders ALL transient editor chrome as a sibling of `[data-scene-export]`. Export-clean by architecture.

**Layered (back to front):**
1. `[data-transparent-checker]` — when `background.transparent` is true.
2. `<FocusDim />` — scrim + highlight ring for focus mode.
3. `<Guides />` — transient snap guides (from `runtime.snapGuides`, `data-snap-guide`).
4. `<MaskOverlay />` — committed mask outlines + live stroke checkerboard preview (editor chrome; never inside the export node).
5. Selection chrome (single = rotation-aware wrapper; multi = union border).
6. Container drop ring (during drag-to-nest).
7. Marquee (during marquee drag).
8. Hover outline (suppressed for selected elements).
9. `<StrokeSurface />` — imperative canvas for brush strokes.
10. `<PreviewSurface />` — imperative canvas for ghost/blur indicators.

**Root:** `pointer-events: none` (children that need events set `pointer-events: auto`).

### `StrokeSurface.tsx`

**Role:** Imperative canvas for 60fps brush stroke rendering. No React re-renders.

**Key decisions:**
- Registers a `FastOverlayHost` via `registerFastOverlayHost()` on mount.
- Canvas `width/height` = `scene.canvas.width * zoom * dpr`; CSS size = scene dimensions.
- `ctx.setTransform(zoom * dpr, 0, 0, zoom * dpr, 0, 0)` so drawing stays in scene units.
- `pointerEvents: 'none'` — never receives pointer events.

### `PreviewSurface.tsx`

**Role:** Imperative canvas for tool preview indicators (ghost transform, blur region). Subscription-driven.

**Key decisions:**
- Subscribes to `useRuntimeStore((s) => s.preview)` — when the reference changes, draws directly in the subscription callback. No React state triggers a re-render.
- Same bitmap sizing as StrokeSurface (scene × zoom × dpr).
- Null-guarded `getContext('2d')` (jsdom returns null).

### `Ruler.tsx`

**Role:** Viewport-space ruler bar with drag-to-create-guide interaction.

**Key decisions:**
- Tick marks computed at ~50px visual intervals, snapped to 10-unit boundaries based on zoom.
- Drag preview line (`#ruler-guide-preview`) manipulated directly via style (no React state) for 60fps.
- `onPointerUp` commits via `addGuide(orientation, scenePosition)` + `pushHistory('Add guide')`.

### `Guides.tsx`

**Role:** Renders transient snap guides from `runtime.snapGuides` (blue dashed lines). The persistent user guides with interaction live inline in `Scene.tsx`.

**Key decisions:**
- `data-snap-guide="vertical|horizontal"` markers.
- `pointer-events: none` — purely visual.
- Only renders when guides exist.

---

## Element Facades

### `ElementFacade.tsx`

**Role:** Universal positioned wrapper for every scene element. Provides the hit surface (`data-element-id`, `data-element-kind`, `data-element-locked`). Masks are NOT applied here — masks are independent scene layers clipped at the Scene level (scene-space clip wrappers over all content), never per-element clips.

**Props:** `{ id: string, kind: SceneElementKind, locked: boolean, style: React.CSSProperties, children: React.ReactNode }`

**Key decisions:**
- **Zero pointer handlers** — the Tool Manager owns all interactions via DOM fallback (`[data-element-id]`) or hit-test.
- **Rotation:** `transform: rotate(rotation deg)` with `transformOrigin: 'center'` on the root.
- **Lock cursor:** `cursor: locked ? 'default' : 'move'`.

### Device Facades

| Component | Role |
|---|---|
| `DeviceFrame.tsx` | Dispatches to shell components (Monitor, Laptop, Phone, etc.) based on `device.type`. Wraps in ElementFacade. |
| `ScreenContainer.tsx` | The device screen area. Handles screenshot upload via drag/drop/paste. |
| `Monitor.tsx`, `Laptop.tsx`, `Phone.tsx`, `Ipad.tsx`, `Watch.tsx`, `Browser.tsx`, `Terminal.tsx` | Specific device shell renderers (SVG or CSS-based frames with bezels). |

**Key decisions:**
- Device screenshot upload is **double-click** (not single) — handled by the Select tool's `onDoubleClick` → `uploadScreenImage`.
- `ScreenContainer` drag/drop/paste uploads to `device.screenImage`.
- Device frames render through `resolveThemeColors` for bezel/border colors.

### `ShapeRenderer.tsx`

**Role:** SVG-based shape rendering with gradient, background image, effects, and live-transform WYSIWYG.

**Key decisions:**
- **`getShapePath`** imported from `services/shape-geometry.ts` — shared with container-clip service (one source of truth).
- **Live transform:** Reads `resolveLiveGhost(runtimeStore.preview, shape.id)` — when a ghost targets this shape, both the facade style AND SVG content regenerate from live bounds. Prevents the aspect-ratio letterbox bug.
- **Background image:** Renders as an SVG `<pattern>` with `<image>` (clipped to shape path via `preserveAspectRatio="xMidYMid slice"`).
- **SVG filters:** `feDropShadow` for glow/shadow, composed via `svgFilterDef`/`svgFilterId`.
- **CSS effects:** `buildEffectsFilter(shape.effects)` appended to `filterStr`.

### `TextBox.tsx`

**Role:** Renders a text box with inline editing, background, border, and effects.

**Key decisions:**
- Wraps content in `ElementFacade`.
- Delegates to `InlineEditor` for editable content (`selfStart={false}` — the Select tool's double-click triggers editing).
- `RenameOverlay` for triple-click rename.
- **Wrap control:** `textBox.wrap` → `pre-wrap break-word` (wrap) or `nowrap ellipsis` (no-wrap).
- **Height auto:** When `heightAuto` is true, the facade `height` is `undefined` (content-driven sizing).
- **Background/border:** Conditional on `backgroundVisible`/`borderVisible`.
- **Text styling:** `buildTextStyle(textBox)` from `lib/device-utils`.

### `InlineEditor.tsx`

**Role:** Contenteditable inline text editor with Enter-to-commit, Escape-to-cancel, and optional self-start.

**Key decisions:**
- `selfStart={false}` default — the parent (Select tool's dblclick) controls when editing starts by setting `editing` in the runtime store.
- `onPointerDown` stops propagation while editing (prevents the Select tool from grabbing the pointer).
- Commit on blur or Enter; cancel on Escape (restore original content).
- Uses a `contentEditable` div with `suppressContentEditableWarning` (React 19).

### `RenameOverlay.tsx`

**Role:** Inline rename input for element names (triple-click on any element).

**Key decisions:**
- `doneRef` guard prevents double-commit (Enter → commit → unmount → blur → commit again).
- Auto-focuses on mount. Enter commits, Escape cancels.
- `pushHistory('Rename')` before `updateElement`.

---

## UI Components

### Sidebar Components

| Component | Role |
|---|---|
| `Sidebar.tsx` | Rail with sectioned tabs (Design/Content/Organize/View/History), theme toggle pinned bottom. |
| `DevicesPanel.tsx` | Device type grid, device list with visibility/lock, quick-add. |
| `ImagesPanel.tsx` | Image list — **excludes** paint layers (`isPaintLayer` filter). Upload/list/visibility/lock/duplicate/delete. |
| `TextPanel.tsx` | TextBox list with Add Text button, wrap toggle, font/size/color controls. |
| `ShapesPanel.tsx` | 32 shape buttons in 4 categories (basic, polygon, decorative, arrows) + background image upload. |
| `ThemesPanel.tsx` | Background editor (type selector + theme color controls). |
| `ThemePresetsPanel.tsx` | 17 theme presets with thumbnails. |
| `CanvasPresetsPanel.tsx` | Canvas size presets (social media dimensions). |
| `GridPanel.tsx` | Grid settings (size, color, opacity, snap). |
| `LayersPanel.tsx` | Hierarchical layer tree with Ctrl+click multi-select, group triple-click rename, nested groups. |
| `VersionHistoryPanel.tsx` | Auto-snapshots and manual saves. |
| `WatermarkPanel.tsx` | Watermark text/font/opacity/position. |
| `ExportDialog.tsx` | Export modal (format, scale, quality, background, scope). |
| `ExportDialog.tsx` | Export modal (format, scale, quality, background, scope). |

### Toolbar Components

| Component | Role |
|---|---|
| `BottomToolbar.tsx` | Tool groups (select/brush/eraser/focus/mask), active tool label, undo/redo (right slot), export button (right slot). |
| `ToolButton.tsx` | 9×9 rounded button with `aria-pressed`/`aria-disabled`, shortcut badge. |
| `ToolOptionsPanel.tsx` | Inline tool-specific options (paint: color/size/hardness; mask: shape/mode). Accent left border. |

### Canvas Chrome Components

| Component | Role |
|---|---|
| `CanvasChromeBar.tsx` | Scene tabs, zoom controls, View menu. `data-canvas-viewport` Fit button. |
| `CanvasEmptyState.tsx` | First-run overlay with quick-add actions and shortcut legend. |

### Shared Primitives

| Component | Role |
|---|---|
| `ErrorBoundary.tsx` | Class-based crash isolation with retry button. |
| `Modal.tsx` | Portal-based modal (focus trap, Escape, focus restore). |
| `Menu.tsx` | Anchored popover (outside-click + Escape close). |
| `Tooltip.tsx` | Hover tooltip. |
| `Kbd.tsx` | Keyboard shortcut display. |
| `Badge.tsx` | Status badge. |
| `AccordionSection.tsx` | Collapsible section (controlled + uncontrolled mode). |
| `Button.tsx` | Themed button (variants: primary/secondary/accent/danger/ghost). |
| `IconButton.tsx` | Icon-only button. |
| `Field.tsx` | Label + input wrapper. |
| `NumberInput.tsx` | Commit on blur/Enter, clamp, Escape revert. |
| `SliderInput.tsx` | Range + value readout (fluid, `min-w-0`). |
| `SegmentedControl.tsx` | Grouped toggle buttons. |
| `Checkbox.tsx` | Styled checkbox. |

### Mask Components

| Component | Role |
|---|---|
| `MaskRenderer.tsx` | The `MaskOverlay` — checkerboard transparency visualization + mask outlines + live stroke preview (editor chrome; never inside the export node). |
| `MaskSnapshotLayer.tsx` | Renders a frozen mask's captured scene image (scene-wide inset-0, positioned at sourceBounds, emits `data-scene-mask-snapshot`). |

### ResponsiveButtonGroup

A responsive button group that:
- Renders buttons in a flex row.
- Each button has `minWidth` and `flex: 1` (equal width distribution).
- When space is constrained, buttons don't wrap (they shrink gracefully).
- The group itself has `overflow-x: auto` as a fallback.

Used in PropertiesPanel for multi-selection actions (Group, Ungroup, Duplicate, Delete, Copy/Paste Style).

---

## Data Flow: Render

```
Document Store Mutation
  ↓
pushHistory(label) BEFORE mutation        ← history contract
useStore setState (immutable scenes update)
  ↓
React Subscriptions Trigger
  ├─ Scene.tsx subscribes to safeScene      ← re-renders z-sorted tree
  ├─ OverlayRenderer subscribes to          ← re-renders editor chrome
  │   selectedIds, hover, marquee, snap,
  │   containerDropTarget, focus, preview
  ├─ PropertiesPanel subscribes to          ← re-renders panel state
  │   selectedIds, multi, focus
  ├─ Sidebar subscribes to activeScene     ← updates lists/tabs
  ├─ MasksPanel subscribes to scene.masks  ← mask list manager
  └─ LayersPanel subscribes to              ← updates layer tree
      scene.devices/textBoxes/images/shapes/groups
  ↓
DOM Updates
  ├─ Scene.tsx → renders ElementFacade(s)
  │   └─ Element component (Device/TextBox/Image/Shape)
  ├─ Scene.tsx → z-band wrappers + [data-scene-mask-clip]
  │   wrappers (buildMaskClipPath in scene coords)
  └─ OverlayRenderer → renders chrome
      Selection chrome reads
      resolveLiveGhost for live bounds
  ↓
Export Engine (on demand)
  ↓
Clones [data-scene-export] node
Strips [data-watermark], [data-guide]
Punches mask holes (canvas compositing)
```
