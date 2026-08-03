# Tools

The tool system is a **Tool Manager pattern** — a single `toolManager` singleton dispatches pointer/keyboard events to the active tool. Tools are stateless descriptors of behavior that receive an `InteractionContext` and operate exclusively through that context's actions, runtime store, and fast overlay.

---

## Tool Manager

**File:** `src/renderer/tools/manager.ts`

### Architecture

```
┌─────────────────────┐
│   ToolManager       │  (singleton: toolManager)
│                     │
│  activeToolId       │  (default: 'select')
│  temporaryStack     │  (Space → Hand)
│  modifiers           │  (shift/ctrl/alt/meta)
│  ownership: Map      │  (pointerId → toolId)
│                     │
│  buildContext()     │  → InteractionContext
│  handleShortcut()   │  → shortcut routing
│  handleEscape()     │  → clear temp + ownership + interrupt
│  reset()            │  → restore defaults + interruptTools
│  interruptTools()   │  → onInterrupt on every tool
│  getCursor()        │  → CSS cursor resolution
│  setModifier()      │  → modifier tracking + onModifierChange
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│  InteractionContext  │  (rebuilt per event)
│                     │
│  effectiveToolId    │
│  pointerScenePos    │  (scene coordinates)
│  modifiers           │
│  hitResult           │  (from hitTest)
│  resizeHandle        │
│  actions             │  (DocumentActions → store)
│  getRuntime/setRuntime│
│  focusEditable(id)  │  (focus scope gate)
│  claimPointer/release│
│  fastOverlay         │  (imperative canvas)
│  beginInteraction/   │
│  endInteraction      │
└─────────────────────┘
          │
          ▼
┌─────────────────────┐
│  Tool (stateless)    │  (onPointerDown/Move/Up/Cancel)
│                     │
│  onActivate/onDeact. │
│  onHover             │
│  onDoubleClick       │
│  onContextMenu       │
│  onModifierChange    │
│  onInterrupt         │  (Escape/blur/reset cleanup)
└─────────────────────┘
```

### Key Methods

#### `getEffectiveToolId(): string`

Returns the effective tool, accounting for temporary tools (Space → Hand). Precedence:
1. If `temporaryToolStack` is non-empty → top of stack.
2. Else → `activeToolId`.

#### `buildContext(overrides): InteractionContext`

Rebuilds the context per pointer event:
1. Resolves `scenePoint` from runtime `pointerScenePos`.
2. Runs `hitTest(scene, scenePoint)` → `hitResult`.
3. Threads `focusEditable` (focus scope check), `fastOverlay` (lazy lookup), and all `DocumentActions`.

#### `handleReachableShortcut(key: string): boolean`

Handles single-key tool shortcuts (e.g., `V` → select, `H` → hand). Filters the registry for tools with `shortcut === key` AND `isToolReachable` (has `onPointerDown`), then cycles among them. Returns `true` if a tool was activated.

#### `getCursor(options: CursorOptions): string`

Cursor precedence chain:
1. If `pointerOwned` → `draggingCursor` (`'grabbing'` for pan, `'nwse-resize'` for resize).
2. If temporary tool active → effective tool's cursor.
3. If `focusDimmed` (hovered element outside focus scope) → `'default'`.
4. If tool is `select` + hovered moveable → `'move'`.
5. If tool is `focus` → `'crosshair'`.
6. Else → tool's `cursor` field.

#### `interruptTools(): void`

Iterates **all** tools in the registry and calls `onInterrupt?.()` on each. This is the safety net that clears stray module-level state (`pendingDrag`, `pendingResize`, `commitChain`, `maskPreview`, etc.) when Escape/blur/reset fires without a pointer-up.

#### `reset(): void`

Restores `activeToolId = 'select'`, clears `temporaryStack`/`modifiers`/`ownership`, calls `interruptTools()`. Registered via `registerFullResetHook` so it fires on `resetRuntime('all')`.

### Tool Lifecycle

```
onActivate(ctx)       ← fires when the tool becomes effective
  └─ e.g., paint presets apply non-color defaults to brush

onPointerDown(e, ctx)  ← the main entry point
  ├─ Focus gate: if target is dimmed → clearSelection + return
  ├─ Capability check (some tools reject locked/non-maskable)
  ├─ ctx.claimPointer() (if movement interaction)
  ├─ beginInteraction({ kind, toolId, pointerId })
  ├─ Create session (StrokeSampler, DragSession, ResizeSession, PendingMask)
  └─ Live preview (fastOverlay or runtime.preview)

onPointerMove(e, ctx)  ← live feedback
  ├─ Update sampler/session with scene point
  ├─ Draw stroke segment on fastOverlay
  └─ Update ghost preview

onPointerUp(e, ctx)    ← commit
  ├─ pushHistory(label)  ← BEFORE mutation (universally)
  ├─ Commit to store via ctx.actions
  └─ Cleanup (endInteraction, emitGhost(null), session null)

onPointerCancel(e, ctx) ← abort (no commit)
  ├─ Restore DOM to start position
  └─ Cleanup without store mutation

onInterrupt()           ← Escape/blur/reset (no pointer-up)
  ├─ Clears ALL module-level pending state
  └─ Restores runtime state
```

---

## Tool Taxonomy

### Groups

| Group | Tools | Shortcut |
|---|---|---|
| `select` | Select (V), Hand (H), Marquee (M), Focus (X) | Per-tool |
| `brush` | Paint (B), Brush presets (Pencil, Airbrush, Marker, Pen, Pixel) | B |
| `blur` | Blur Brush, Blur Element, Blur Rect, Blur Ellipse, Blur Line | B |
| `eraser` | Eraser, Magic Eraser, Delete | E |
| `mask` | Mask (G) | G |

### Reachable Tools (fully implemented, have `onPointerDown`)

Select, Hand, Marquee, Focus, Paint, Blur Brush, Blur Region tools, Eraser, Magic Eraser, Delete, Mask.

### Stub Tools (disabled, no `onPointerDown`)

None currently — all tools in the registry are reachable. Stubs were removed as tools were implemented.

---

## 1. Select Tool

**File:** `src/renderer/tools/tools/select.ts`

**Identity:** `id: 'select'`, `group: 'select'`, `shortcut: 'v'`, `cursor: 'default'`

**Purpose:** Element selection, drag-move (single + multi), resize, double-click actions (text edit / screenshot upload / triple-click rename), and context menus. The Select tool owns ALL element interactions — element components are pure presentational facades.

### Pointer-Down

The central orchestration point:

1. **`e.button === 0` gate** — primary button only.
2. **Focus gate** — `if (!ctx.focusEditable(hit.id))`: calls `clearSelection()` and returns. Dimmed (out-of-scope) elements cannot be interacted with.
3. **Lock gate** — if `hit.locked`: selects the element via `select(id)` and returns (locked = selectable but not draggable/resizable).
4. **Resize path** — if `ctx.resizeHandle && caps.resizable`:
   - `pushHistory('Resize ' + kind)` BEFORE mutation.
   - Creates `createResizeSession` with `lockAspectRatio: bounds.lockAspectRatio ?? false`, `onResize` dispatching `updateElement` with `Math.round` coords, `onPreview` calling `emitGhost`.
   - `beginInteraction({ kind: 'resize' })`.
5. **Selection path** — if the hit element isn't already selected:
   - Calls `select(id, e.ctrlKey || e.shiftKey || e.metaKey)` — group-aware selection (selects the whole group if the element is in one).
   - Resolves bounds + DOM element. If missing → release pointer.
   - Checks multi-drag count via `getMultiDragEntries`.
   - Creates `createDragSession` with snap function, `onEnd` that resolves the container drop decision (`pendingDrop`), `onPreview` calling `emitGhost`.
   - `nestEligible = !multi` (multi-drags are pure moves, can't nest).
   - `beginInteraction({ kind: 'move' })`.

### Pointer-Move

- Dispatches to `pendingDrag.session.move()` or `pendingResize.session.move({ shiftKey: ctx.modifiers.shift })`.
- During single-element drag, updates the live container drop-target ring via `resolveContainerDropTarget(scene, draggedId, scenePoint, focus)`.

### Pointer-Up

- Clears container drop target.
- Resolves `pendingDrop`: nest → `setElementContainer(id, targetId)`, unnest → `setElementContainer(id, null)`, else `MOVE_LABELS[hit.kind]`.
- For drags: `emitGhost(null)`, `endInteraction()`.
- For resizes: `endInteraction()`.

### Double-Click

Triple-click detection via `lastDblClick` timestamp (500ms window). Guard: if already editing and same element, skip unless it's the rename trigger.

Per kind, when `editable`:
- **TextBox**: `setEditing({ id, mode: 'text' })`
- **TextBox (triple-click)**: `setEditing({ id, mode: 'rename' })`
- **Device (triple-click)**: `setEditing({ id, mode: 'rename' })`
- **Device**: `uploadScreenImage(id)` (double-click screenshot upload)
- **Shape (triple-click)**: `setEditing({ id, mode: 'rename' })`
- **Shape**: if already renaming → exit editing

Locked elements skip ALL dblclick edits.

### Context Menu

Builds `RuntimeContextMenuItem[]` from hit + selection:
- **Selected elements**: Bring to Front, Send to Back, Duplicate, Delete
- **Group context**: Group (if 2+ selected, ungrouped), Ungroup (if in a group)
- **Container context**: Enter Focus (context-menu entry point)
- Opens via `rt.openContextMenu({ x, y, items })` at the pointer position.

### Hover (`onHover`)

Updates `rt.hoveredElement` with `{ id, kind }` or null. Intentionally does NOT set hover for resize-handle hits (so the hover outline doesn't fight the chrome). No-op if the hit hasn't changed.

### Ghost Preview (`emitGhost`)

```typescript
function emitGhost(bounds: GhostBounds | null) {
  if (bounds) {
    rt.setPreview(buildGhostPreview(bounds))
  } else {
    rt.setPreview(null)
  }
}
```

Pushes `buildGhostPreview` to `runtime.preview`. The ghost's `source` carries the element `id` — `resolveLiveGhost` reads this for WYSIWYG live geometry in ShapeRenderer and the selection chrome.

### Interrupt

Clears `containerDropTarget`, `pendingDrop`, cancels `pendingDrag`/`pendingResize` sessions. Clears interaction state. No store mutation.

### Key Decisions

1. **Resize is tool-independent**: The `ToolEventSurface` intercepts `[data-resize-handle]` grabs before resolving the active tool, so corner-handle resizing works with any tool active. The Select tool's full gate stack (focus/locked/capability) runs on the intercepted dispatch.
2. **Multi-drag followers**: When 2+ elements are selected, the DragSession's `multiDrag` entries move all followers by the same delta. `nestEligible = false` for multi-drags.
3. **Container drop decision at pointer-up**: The nest/unnest decision is made at pointer-up via `resolveContainerDrop`, but committed inside the drag session's `onEnd` callback — the session is the commit boundary.
4. **One history entry per pointer-down**: Whether it's a move, resize, or selection change, the history push happens exactly once at the start of the gesture (BEFORE mutation).

---

## 2. Hand Tool

**File:** `src/renderer/tools/tools/hand.ts`

**Identity:** `id: 'hand'`, `group: 'select'`, `shortcut: 'h'`, `cursor: 'grab'`

**Purpose:** Pan the viewport. Activated by `H` directly or `Space` as a temporary tool.

### Pointer-Down

Accepts `button === 0 || button === 1` (both left and middle). Reads current viewport pan, stores `PanState { pointerId, startX, startY, startPanX, startPanY }`, calls `setIsPanning(true)` and `beginInteraction({ kind: 'pan' })`.

**Key decision:** No `isPanGesture` guard — the surface only routes to the Hand tool when (a) a pan gesture (middle-button or Alt+left) occurs or (b) Hand is the effective tool. So the tool can accept any primary/middle press.

### Pointer-Move

Computes delta from start, calls `setPan(startPanX + dx, startPanY + dy)`.

### Pointer-Up / Cancel / Interrupt

Clears `panState`, `setIsPanning(false)`, `endInteraction()`. No store mutation.

---

## 3. Marquee Tool

**File:** `src/renderer/tools/tools/marquee.ts`

**Identity:** `id: 'marquee'`, `group: 'select'`, `shortcut: 'm'`, `cursor: 'crosshair'`

**Purpose:** Click-and-drag rectangular selection on empty canvas.

### Pointer-Down

Primary only. Claims pointer. Stores `startScenePoint`, calls `beginInteraction({ kind: 'marquee' })`.

### Pointer-Move

Updates `rt.marqueeRect` as a normalized rect (min/max of start and current). `Canvas.tsx` renders this as a blue-tinted dashed rectangle.

### Pointer-Up

Clears `marqueeRect`. If drag exceeded 3px in either axis → `selectInRect(startX, startY, w, h)` (handles negative w/h internally). Under 3px → `clearSelection()` (click = clear).

### Cancel

Clears `marqueeRect` and ends interaction, no selection.

### Key Decision

Marquee is a first-class tool (not part of the Select tool). `V` cycles Select↔Marquee↔Hand. `M` activates it directly.

---

## 4. Focus Tool

**File:** `src/renderer/tools/tools/focus.ts`

**Identity:** `id: 'focus'`, `group: 'select'`, `shortcut: 'x'`, `cursor: 'crosshair'`

**Purpose:** Enter group-scoped or element-scoped editing mode.

### Pointer-Down

Primary only, no pointer claim. Resolves `hit.id` → `findSceneElement` → element with `groupId` and `containerId` info.

- **Focus gate**: `isInFocusScope(hitId, focusGroupId, scene, focusElementId)` — rejects elements that would escape the current scope (can never drill out of focus).
- **Group focus**: If the element has a `groupId`, checks whether that group is reachable from the current `focusGroupId` (via `getFocusPath` ancestor check). If yes → `enterFocus(groupId)`.
- **Container focus**: If `isContainer(scene, hitId)` (element has children) → `enterElementFocus(hitId)`.

If the focus target is already active → `exitFocus()` (toggle behavior).

### Focus Entry Points (4 routes)

1. **Focus tool click** (X) — `onPointerDown` on a group/container.
2. **Enter key** — if selected equals a group's `childIds`, `enterFocus(match.id)`. If selected is a container, `enterElementFocus`.
3. **Group row double-click** — in `LayersPanel`, `e.detail >= 2` → `enterFocus(group.id)`.
4. **Context menu** — "Enter Focus" item on containers.

### Exit Routes

1. **Escape** — `exitFocus()`.
2. **Ungroup** — if the focused group is ungrouped, focus exits.
3. **Breadcrumb click** — click the Root segment in the toolbar breadcrumb.
4. **Project new/open** — `resetRuntime('all')` clears focus.

### Focus Dimming (`FocusDim.tsx`)

Renders a full-canvas scrim (`rgba(9,9,11,0.45)`) + a violet highlight ring (`#8b5cf6`) around the focused group's bounds (`getFocusBounds`). The scrim darkens everything; the ring shows what's editable. `data-focus-dim` / `data-focus-ring` markers. Inside the export node? No — `OverlayRenderer` is a sibling of `[data-scene-export]`, so it's export-clean.

### Focus Scope (`services/focus.ts`)

- `getDescendantGroupIds(scene, groupId)` — recursively collects all nested group ids (cycle-safe via `seen` set).
- `getFocusSubtreeIds(scene, focusGroupId, focusElementId)` — element ids in scope (group children + descendants, or container + its children).
- `getFocusScopeIds` — either subtree ids (group focus) or `[elementId, ...containerChildren]` (element focus). Empty when unfocused.
- `isInFocusScope(id, focusGroupId, scene, focusElementId)` — returns true if no focus is active, or the element is in the focus scope.
- `focusFilterFor(focusGroupId, scene, focusElementId?)` — returns a `(id) => boolean` predicate for selection operations. No-op default (`NOOP_FOCUS_FILTER`).
- `getFocusPath(scene, focusGroupId, focusElementId)` — root→focused ancestry (cycle-guarded).
- `getFocusBounds(scene, focusGroupId, focusElementId)` — union of visible scope members' bounds.

### Key Decisions

1. **Mutual exclusion**: `focusGroupId` and `focusElementId` are mutually exclusive — group focus and element focus cannot coexist.
2. **Dimmed rejection**: Every editing tool checks `ctx.focusEditable(hit.id)` at pointer-down. A dimmed element → `clearSelection()` + return (no interaction starts).
3. **Breadcrumb navigation**: The toolbar shows clickable segments from Root to the focused group, allowing drilling back up at any depth.
4. **Runtime contract**: `focusGroupId` survives transient resets (undo/redo, scene switch) — focus persists until explicitly exited or a full reset.

---

## 5. Paint Brush Tool

**File:** `src/renderer/tools/tools/paint.ts`

**Identity:** Factory `createPaintBrush(preset)` generates 6 tools. Each: `group: 'brush'`, `shortcut: preset.id === 'paint' ? 'b' : undefined`, `cursor: 'crosshair'`, `options: true`.

**Presets:** paint, pencil, airbrush, marker, calligraphy/Pen, pixel. Each has different default `size`/`hardness`/`shape`.

### Pointer-Down

1. `e.button === 0` gate.
2. **Focus gate**: if `focusGroupId` active and the hit target is a paint layer outside the focused subtree → `clearSelection()` + return.
3. `sampler.begin({ brushType: 'paint', size, hardness, color, targetId: rt.brush.color })` — note `targetId` is the brush color (for the live preview color).
4. `ctx.claimPointer()`.
5. `beginInteraction({ kind: 'paint' })`.
6. `ctx.fastOverlay?.beginStroke(previewColor, lineCap, lineJoin)`.

### Pointer-Move

1. `sampler.append(sceneX, sceneY, pressure)`.
2. If `points.length >= 2`: `sampler.forEach` → `ctx.fastOverlay.strokeLine(prev, curr, strokeState)`.
3. Set `rt.setStrokeDirty(true)` once per stroke.

### Pointer-Up

1. `endInteraction()`.
2. `rt.setStrokeBuffer(sampler.toPoints())`.
3. `commitChain = commitChain.then(() => commitStroke(ctx, points))`.

### commitStroke (async)

1. `ctx.fastOverlay.clear()`.
2. Read `rt.brush` (current settings, not snapshot).
3. `resolvePaintCommit(scene, points, brush)` → `compositeStrokeToRegion(null, null, points, brush, canvasW, canvasH)`.
4. If null → return (no context/empty).
5. `pushHistory('Brush stroke')` BEFORE mutation.
6. `const layer = createPaintLayer(scene, commit.src, focusGroupId, commit.region)`.
7. `ctx.actions.addImage(layer)`.
8. If focused: `ctx.actions.addToGroup(focusGroupId, layer.id)`.

### onActivate

Applies the preset's non-color defaults: `rt.setBrush({ size, hardness, shape, opacity })`. Color is global and survives tool switches.

### Key Decisions

1. **Per-stroke layers**: Every stroke creates its own `ImageOverlay` named `Paint N` (via `nextPaintLayerName`). No shared active layer. `resolvePaintCommit` always passes `null, null` to the rasterizer.
2. **Serialized commits**: `commitChain` is a module-level promise chain ensuring overlapping strokes commit in document order (async `compositeStrokeToRegion` involves image loading).
3. **Focus gating**: Painting on an existing paint layer outside the focused subtree is rejected. New layers register into the focused group via `addToGroup`.
4. **Live preview**: Uses `ctx.fastOverlay` (StrokeSurface canvas) — no React re-renders during the gesture.
5. **No pointer capture**: The ToolEventSurface owns pointer capture.

---

## 6. Blur Tools

**File:** `src/renderer/tools/tools/blur.ts`

**Identity:** Five tools:
- `blurBrushTool` — `createDestructiveTool` factory, `id: 'blur'`, `shortcut: 'b'`
- `blurElementTool` — standalone, `id: 'blur-element'`
- `blurRectTool` / `blurEllipseTool` / `blurLineTool` — `createBlurRegionTool` factory

### Brush Tool (factory: `createDestructiveTool`)

Shares the `createDestructiveTool` engine with Eraser and Magic Eraser.

**Pointer-down**: Hit required. Resolves `BitmapTarget` + element geometry. Focus gate. `ctx.claimPointer()`. Begins sampler with `targetId: element.id`. `beginInteraction()`. `ctx.fastOverlay.beginStroke(previewColor, ...)`.

**Pointer-move**: `sampler.append`. `ctx.fastOverlay.strokeLine`.

**Pointer-up**: `points = sampler.toPoints()`. `commitChain = commitChain.then(() => commitStroke(ctx, points))`.

**commitStroke**: 
1. `ctx.fastOverlay.clear()`.
2. `readCurrentSrc(scene, target)` — re-reads current bitmap from store.
3. `toLocalPoint(element, target, points)` — converts scene points to bitmap-local coords.
4. `applyDestructiveStroke({ src, width, height }, 'blur', localPoints, brush)`.
5. `pushHistory('Blur stroke')` BEFORE.
7. `commitBitmapSrc(state, target, dataUrl)` — kind-dispatched update.

**Brush settings mapping**: `brush.hardness` drives blur radius: `blurRadiusFromBrush(brush)` = `max(1, round((size/2) * (0.25 + 0.75 * hardness)))`. Live preview forces brightness to 0.2 for visibility.

### Region Tools (factory: `createBlurRegionTool`)

**Identity:** `id: 'blur-rect' | 'blur-ellipse' | 'blur-line'`, `group: 'blur'`, `shortcut: 'b'`, `cursor: 'crosshair'`.

**Pointer-down**: Hit required. `resolveBitmapTarget` required. Focus gate. Claims pointer. `beginInteraction({ kind: 'blur' })`.

**Pointer-move**: `buildBlurRegionPreview(buildGeometry(kind, start, current, brush.size))` → `rt.setPreview(...)`.

**Pointer-up**: Clears preview. Ends interaction. `commitChain.then(() => commitRegion(...))` which calls `applyBlurRegion` with local-coord geometry + `blurRadiusFromBrush`.

### Element Tool (standalone)

No drag — a single pointer-down commits. `commitChain.then(() => commitElement(...))` which calls `applyBlurRegion` with a full-canvas region.

### Preview

Blur region previews use `buildBlurRegionPreview` (white fill, hatch, glow) via `rt.setPreview` → `PreviewSurface`. NOT `fastOverlay`.

---

## 7. Eraser Tool

**File:** `src/renderer/tools/tools/eraser.ts`

**Identity:** `id: 'eraser'`, `group: 'eraser'`, `shortcut: 'e'`, `cursor: 'crosshair'`, `variants: ERASER_VARIANTS`

**Architecture**: `createDestructiveTool({...})` — a 12-line factory consumer, just like Magic Eraser. All the logic is in the factory.

**Brush semantics**: `brush.hardness` is the stroke softness (standard `drawStrokeSegments` path). `brush.size / 2` is the radius.

**Commit behavior**: `applyDestructiveStroke` with `brushType: 'eraser'` → `applyEraseStroke` → `destination-out` composite. One `pushHistory('Eraser stroke')` before `commitBitmapSrc`.

**Multi-touch**: Uses the `Map<pointerId, PendingStroke>` from the factory (multi-touch safe).

**Known constraint**: Erasing on opaque bitmaps (e.g. JPEG device screenshots) clears to alpha and may be visually inert — the alpha channel exists but there's nothing underneath to show through.

---

## 8. Magic Eraser Tool

**File:** `src/renderer/tools/tools/magic-eraser.ts`

**Identity:** `id: 'magic-eraser'`, `group: 'eraser'`, `shortcut: 'e'`, `label: 'Magic'`

**Architecture**: Also `createDestructiveTool({ brushType: 'magic-eraser', ... })`.

**Brush semantics**: `brush.hardness` is repurposed as **flood-fill tolerance**: `tolerance = clamp01(hardness) * 0.25`. A single `brush.size / 2` radius seed.

**Commit behavior**: `applyDestructiveStroke` → `applyMagicEraseStroke` → seeds at first point, runs `floodFill`, replaces matching pixels with transparent. Guards: transparent seed alpha → early return (nothing to erase).

**Toolbar option**: Only a single Tolerance slider (no Size/Color controls) — because `hardness` is tolerance, and `size` only sets the seed area.

---

## 9. Delete Tool

**File:** `src/renderer/tools/tools/delete.ts`

**Identity:** `id: 'delete'`, `group: 'eraser'`, `cursor: 'crosshair'`, `variants: ERASER_VARIANTS`.

**Behavior**: No drag session — a single pointer-down commits. Focus-gated. If the selected set includes the hit element, deletes the whole selection; otherwise deletes just the hit element. `pushHistory('Delete')` BEFORE `deleteSelected`.

---

## 10. Mask Tool

**File:** `src/renderer/tools/tools/mask.ts`

**Identity:** `id: 'mask'`, `group: 'mask'`, `shortcut: 'g'`, `cursor: 'crosshair'`, `options: true`.

**Purpose**: Draw, reverse, and apply masks as cutouts or reveals. Full documentation in the [Mask Engine](./mask-engine.md) deep-dive.

### Mask Modes

| Mode | Polarity | Effect |
|---|---|---|
| `mask` (default) | `inverted: true` | Drawn region becomes transparent (punch). Checkerboard shows where you drew. |
| `unmask` | `inverted: false` | Drawn region stays visible, rest is checkerboarded (reveal). |

### Mask Shapes

| Shape | Geometry |
|---|---|
| `rectangle` | `rectRing(x, y, w, h)` → 4-point polygon |
| `ellipse` | `ellipseRing(x, y, w, h)` → 32-gon |
| `brush` | `buildMaskStrokePolygon(points, radius)` → closed capsule outline |

### Pointer-Down

1. No hit required — masks are scene-wide. An empty-canvas press still starts a mask (like painting on the canvas).
2. Focus-gated via the runtime `maskPreview`; no element selection happens (masks have no target).
3. Builds `PendingMask { pointerId, shape, inverted, anchor, last, points, radius }` with **scene-space** geometry.
4. `ctx.claimPointer()`.
5. `beginInteraction({ kind: 'mask' })`.
6. Pushes preview (`buildMaskPreview`).

### Pointer-Move

- Updates `pm.last`.
- For brush: appends to `pm.points` (with `BRUSH_MIN_DISTANCE_SQ = 2.25` spatial simplification).
- Pushes preview (`previewToMaskVisual(preview, canvasWidth, canvasHeight)` → `rt.setPreview`).

### Pointer-Up

1. If brush: appends pointer-up point if it's at least `BRUSH_MIN_DISTANCE_SQ` from last.
2. Sub-3px drag check (`MIN_DRAG_DISTANCE_SQ = 9`): skip commit → clear preview + interaction (no history entry).
3. **Geometry is already scene-space** — no local-frame conversion (`toLocalPoint` is not used by masks).
4. Build the stroke ring based on shape:
   - brush → `buildMaskStrokePolygon(points, radius)`
   - ellipse → `ellipseRing(points[0], points[1] as corner)`
   - rect → `rectRing(points[0], points[1] as corner)`
5. **Commit branch**:
   - **Mask mode (inverted)**: `commitLiveMask` → `pushHistory('Add mask')` + `addMask({ ...mask, inverted: true, zIndex: nextMaskZIndex(scene) })`. Additive — a fresh mask for each stroke.
   - **Unmask mode (non-inverted)**: `resolveUnmaskCommit(scene.masks, stroke, canvasWidth, canvasHeight)` → if non-null: `pushHistory('Unmask')` + `replaceMasks(commit)`. Masks are scene layers — no target filter.
6. `rt.setMaskPreview(null)`.
7. `endInteraction()`.

### Pointer-Cancel / Interrupt

Clears `pm` (pending mask), ends interaction, clears mask preview (`rt.setMaskPreview(null)`). No commit.

### Mask Options Panel

The `ToolOptionsPanel` renders Shape buttons (Rect / Ellipse / Freehand / Brush) wired to `rt.maskShape` / `rt.setMaskShape`, a Mode toggle (Mask / Unmask), a brush-radius slider (`rt.brush.size`), and a "Clear masks" danger button (`clearAllMasks`). The mask/editor UI lives in the dedicated **Masks panel** (`sidebarTab === 'masks'`, see `docs/mask-engine.md` §13.2).

---

## Tool Event Surface

**File:** `src/renderer/components/canvas/ToolEventSurface.tsx`

### Purpose

The **single viewport-level pointer dispatcher**. Translates DOM coordinate events into scene-coordinate events and routes them to the active tool via the ToolManager. Owns pointer capture on claim.

### Three-Tier Tool Resolution

```typescript
function resolveTool(e): Tool | null {
  // 1. If a tool already owns this pointer
  const owner = toolManager.getOwner(e.pointerId)
  if (owner) return toolManager.getTool(owner)

  // 2. Pan gesture? (middle button or Alt+left)
  if (isPanGesture(e)) return toolManager.getTool('hand')

  // 3. Effective tool
  return toolManager.getEffectiveTool()
}
```

### Event Flow

```
onPointerDown(e):
  ├─ if isCanvasChromeTarget(e) → return (TitleBlock, guides)
  ├─ if resize-handle grab && !panGesture → route to select tool (tool-independent resize)
  ├─ resolveTool → tool
  ├─ scenePoint = screenToScene(e.clientX, e.clientY)
  ├─ ctx = toolManager.buildContext({ scenePoint, pointerScenePos, resizeHandle })
  ├─ rt.setPointerScenePos(scenePoint)
  ├─ tool.onPointerDown(e, ctx)
  ├─ if claimed → setPointerCapture(e.currentTarget, e.pointerId)

onPointerMove(e):
  ├─ rt.setPointerScenePos(scenePoint)
  ├─ if no owner → tool?.onHover(e, ctx) (hover dispatch)
  ├─ else → owner.onPointerMove(e, ctx)
  ├─ cursor = getCursor(...)

onPointerUp(e):
  ├─ if owner → owner.onPointerUp(e, ctx)
  ├─ releasePointerCapture
  ├─ toolManager.releasePointer(e.pointerId)

onPointerCancel(e):
  ├─ if owner → owner.onPointerCancel(e, ctx)
  ├─ toolManager.interruptTools()
  ├─ toolManager.releasePointer(e.pointerId)

onDoubleClick(e):
  ├─ if !isCanvasChromeTarget → owner?.onDoubleClick(e, ctx)

onContextMenu(e):
  ├─ if !isCanvasChromeTarget → owner?.onContextMenu(e, ctx)
```

### Hit-Testing Chain

```typescript
computeHit(e): HitTestResult | null {
  // 1. Scene-geometry hit test (primary)
  const hit = hitTest(scene, scenePoint)
  if (hit) return hit

  // 2. DOM fallback: [data-element-id] (handles rotated corners, handles outside bounds)
  const el = (e.target as Element).closest('[data-element-id]')
  if (el) {
    const id = el.getAttribute('data-element-id')!
    return resolveElementHit(scene, id, 'moveable')
  }

  // 3. DOM fallback: [data-chrome-element-id] (selection chrome resize handles)
  const chrome = (e.target as Element).closest('[data-chrome-element-id]')
  if (chrome) {
    const id = chrome.getAttribute('data-chrome-element-id')!
    const handle = (e.target as Element).closest('[data-resize-handle]')
    return { id, kind: resolveKind(id), zIndex: 9999, locked: false }
  }

  return null
}
```

### Cursor Computation

Subscribes to: `activeToolId`, `temporaryToolStack`, `hoveredElement`, `activeInteraction`, `focusGroupId`, `focusElementId`, `pointerInCanvas`. Computes `effectiveToolId` and `focusDimmed` (hovered element outside focus scope). Calls `toolManager.getCursor({...})`.

### Key Decisions

1. **Surface owns pointer capture** — tools never call `setPointerCapture`/`releasePointerCapture` directly. The surface releases on up/cancel.
2. **Chrome guard**: Clicks on `data-canvas-chrome` / `data-guide` elements are consumed by their own handlers and don't reach tools. This is how the interactive Guides (drag-to-move, right-click delete) and TitleBlock editing coexist with the Select tool.
3. **Two preview surfaces**: `StrokeSurface` (brush strokes, direct canvas API via `fastOverlay`) and `PreviewSurface` (ghost/blur, store-subscription draw). Both render in `OverlayRenderer` as siblings of `[data-scene-export]`.
4. **Drag threshold**: 3px for both drag-start and marquee-commit. A sub-3px move is treated as a click.
5. **Tool-independent resize**: Resize handles intercept BEFORE the active tool is resolved, so any tool can resize (previously, only select could). The Select tool's gate stack (focus/locked/capability) still applies.
