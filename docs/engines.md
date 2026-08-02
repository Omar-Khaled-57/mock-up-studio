# Engines

The Mockup Studio engine layer contains pure-logic services that implement the core editing operations: raster compositing, vector stroke sampling, boolean polygon clipping, coordinate transforms, and preview rendering. These services are consumed by the tool layer and the renderer, but contain no React-specific code or DOM dependencies (except where canvas rendering is explicitly required).

---

## 1. Rasterizer Engine

**File:** `src/renderer/services/rasterizer.ts`

### Purpose

Performs all pixel-level image operations for destructive tools (blur, eraser, magic eraser) and paint layer compositing. Bridges the gap between SVG/vector stroke geometry and bitmap data URLs through an imperative canvas pipeline.

### Architecture

The rasterizer supports two canvas backends with automatic fallback:

```
createRasterSurface(width, height)
  │
  ├── Try OffscreenCanvas (preferred — works in any thread context)
  │     → new OffscreenCanvas(w, h).getContext('2d')
  │
  └── Fallback: HTMLCanvasElement
        → document.createElement('canvas')
          .getContext('2d') || null
```

If neither backend yields a 2D context (e.g., headless jsdom without node-canvas), all canvas-backed operations return `null` — callers handle the null gracefully (no commit, no crash).

### Key Types

| Type | Description |
|---|---|
| `DestructiveBrushType` | `'blur' | 'eraser' | 'magic-eraser'` |
| `DestructiveStrokeTarget` | `{ src: string, width: number, height: number }` |
| `StrokeBrush` | `{ brushType, size, hardness, color, opacity, shape, mode }` |
| `StrokePoint` | `{ x, y, pressure }` |

### Exported Functions

#### `compositeStrokeToRegion(existingSrc, existingRegion, points, brush, canvasW, canvasH)`

The **paint stroke compositor**. Called by the Paint Brush tool to rasterize a stroke onto a paint layer.

**Algorithm:**
1. If `points` is empty → `null`.
2. Create a raster surface at `canvasW × canvasH` (full scene canvas).
3. If `existingSrc` is provided, draw the existing bitmap onto the surface (composites over prior strokes).
4. Call `drawStrokeSegments(ctx, points, brush)` to paint the new stroke.
5. Compute the stroke's bounding box (with brush radius padding) via `strokeBounds`.
6. If `existingRegion` is provided, expand bounds to cover both the stroke and the existing region.
7. Crop the surface to bounds → `croppedCanvas`.
8. Return `{ src: canvasToDataUrl(croppedCanvas, 'image/png'), region: bounds }`.

**The `null` region parameter** (`compositeStrokeToRegion(null, null, points, brush, canvasW, canvasH)`) means: no existing layer, no existing region — always create a fresh cropped canvas. This is what `paint.ts` uses for per-stroke layers.

#### `applyDestructiveStroke(target, brushType, points, brush)`

The **destructive stroke applier**. Called by blur/eraser/magic-eraser tools.

**Algorithm:**
1. Load `target.src` as an `HTMLImageElement` via `loadImage` (Promise, `crossOrigin: 'anonymous'`).
2. Create a raster surface at `target.width × target.height`.
3. Draw the source image onto the surface.
4. Dispatch to the brush-type-specific applier:
   - `applyBlurStroke` — `ctx.filter = blur(Npx)`, blit-back bounds-cropped.
   - `applyEraseStroke` — `globalCompositeOperation = 'destination-out'`, draw stroke in black.
   - `applyMagicEraseStroke` — `floodFill` from first point, opaque→transparent.
5. Return `canvasToDataUrl(surface, 'image/png')` or `null`.

#### `applyBlurStroke(ctx, srcImg, points, brush, width, height)`

Bounds-cropped blur. Computes `strokeBounds(points, radius)` (clamped to bitmap dimensions), crops to that region, applies `ctx.filter = blur(blurRadiusFromBrush(brush))`, and blits back to the original surface at the offset.

#### `applyEraseStroke(ctx, points, brush, width, height)`

Uses `destination-out` composite: draws the stroke segments in black with the brush's size/hardness/pressure, erasing pixels to transparent.

#### `applyMagicEraseStroke(ctx, srcImg, points, brush, width, height)`

1. Seeds at `points[0]` (first stroke point).
2. Guards against transparent seeds (alpha 0 → early return, nothing to erase).
3. `floodFill(imageData, seedX, seedY, tolerance, replacement)` replaces connected pixels matching the tolerance.
4. `putImageData` back to the canvas.

**Tolerance** = `clamp01(hardness) * 0.25` — the `hardness` slider repurposed as the magic-eraser's tolerance control.

#### `drawStrokeSegments(ctx, points, brush)`

Pure stroke geometry renderer. For each consecutive pair of points, draws a line segment with:
- `lineWidth = max(0.25, size * (0.25 + 0.75 * pressure))`
- `globalAlpha = (opacity ?? 1) * (0.15 + 0.85 * min(1, max(0, hardness)))`
- Round caps and round joins
- Color/stroke style from `brush.color`

For single-point strokes (dots), calls `drawDot` which draws a filled circle of radius `size / 2`.

#### `floodFill(imageData, seedX, seedY, tolerance, replacement)`

**Pure function** (no DOM). Implements a BFS flood fill:
1. Pre-allocated `Int32Array` queue (size = width × height — worst case).
2. `Uint8Array` visited bitmap (same size).
3. RGB-distance tolerance comparison.
4. Seeds with the replacement RGBA, propagates to 4-connected neighbors within tolerance.
5. Returns `ImageData` with filled pixels.

#### `floodFill(imageData, seedX, seedY, tolerance, replacement)`

**Pure function** (no DOM). Implements a BFS flood fill:
1. Pre-allocated `Int32Array` queue (size = width × height — worst case).
2. `Uint8Array` visited bitmap (same size).
3. RGB-distance tolerance comparison.
4. Seeds with the replacement RGBA, propagates to 4-connected neighbors within tolerance.
5. Returns `ImageData` with filled pixels.

#### `loadImage(src)`

Returns `Promise<HTMLImageElement | null>`. Sets `img.crossOrigin = 'anonymous'` (CORS-safe). Resolves on `onload`, rejects on `onerror` (returns null). Used by both destructive and paint engines.

#### `canvasToDataUrl(canvas, type, quality?)`

Converts either a `HTMLCanvasElement` (via `toDataURL`) or an `OffscreenCanvas` (via `convertToBlob` + `FileReader`) to a data URL string. The `'toDataURL' in canvas` check dispatches between the two paths.

#### `blurRegionOnSurface` (internal)

Bounds-cropped `ctx.filter = blur(Npx)` blit-back. Region is clamped to the bitmap bounds so strokes near edges don't sample transparent pixels.

### Brush Radius Mapping

| Tool | Hardness role | Radius formula |
|---|---|---|
| Blur | Blur radius driver | `max(1, round((size/2) * (0.25 + 0.75 * hardness)))` |
| Eraser | Stroke softness | `size / 2` (standard stroke) |
| Magic Eraser | Flood-fill tolerance | `clamp01(hardness) * 0.25` |

### Data Flow

```
Tool.commitStroke (tool)
  → readCurrentSrc (re-reads from store for latest bitmap)
  → toLocalPoint (scene → element-local → bitmap coords)
  → applyDestructiveStroke / compositeStrokeToRegion (rasterizer)
  → pushHistory(label) BEFORE commit
  → ctx.actions.updateDevice/updateImage/updateShape (store)
```

---

## 2. Export Engine

**File:** `src/renderer/lib/export-engine.ts`

### Purpose

Renders the scene to a PNG/JPEG/WebP blob via DOM cloning + canvas rasterization. Handles background overrides, mask punching, watermark removal, and multi-scene ZIP export.

### Architecture

The export engine has two entry points:

1. **`exportScene(scene, options)`** — Captures a single scene to a canvas.
2. **`exportAllScenes(scenes, options)`** — Iterates scenes (with double-rAF waits), captures each, and packages as a ZIP via JSZip (lazy-loaded).

Both call the same core pipeline:

```
exportScene(scene, options)
  → Scene.tsx renders scene into [data-scene-export] DOM node
  → domToCanvas(clonedExportNode, { scale, style })     [modern-screenshot]
  → punchSceneMaskHoles(ctx, masks, width, height, scale)  [mask holes]
  → (background === 'solid') ? destination-over fill  : passthrough
  → canvas.toBlob(mime, quality)
```

### Sanitization

Before rasterization, the export engine **clones** `[data-scene-export]` and strips:

| Selector | Reason |
|---|---|
| `[data-watermark]` | Watermark is editor chrome |
| `[data-guide]` | Snap guides are editor chrome |
| `[data-scene-background]` (when `background !== 'scene'`) | Background override replaces the scene background |

`[data-scene-export]` itself is never cloned — the overlay chrome (`OverlayRenderer`) sits as a sibling and is excluded from the capture.

### Mask Punch (`punchSceneMaskHoles`)

Filters scene masks (`mask.targetId === BACKGROUND_MASK_TARGET_ID`) and punches each as a hole via canvas compositing:

```
for each mask:
  ctx.save()
  ctx.globalCompositeOperation = 'destination-out'
  ctx.fillStyle = 'black'
  ctx.fill(maskPath, 'evenodd')    // evenodd = box ∩ holes
  ctx.restore()

if background === 'solid':
  ctx.globalCompositeOperation = 'destination-over'
  ctx.fillStyle = options.backgroundColor
  ctx.fillRect(0, 0, width, height)
```

- **Inverted mask** (punch): `polygon(box, shape, evenodd)` — hides the drawn region.
- **Non-inverted mask** (reveal): `polygon(box, holes)` — the mask IS the hole; reveal semantics.
- **Degenerate rings** (zero area) are skipped.

### Background Handling

| `options.background` | Behavior |
|---|---|
| `'scene'` | Scene's own background renders; mask holes show transparency |
| `'solid'` | `[data-scene-background]` stripped; hole punched, then filled with `options.backgroundColor` (destination-over) |
| `'transparent'` | `[data-scene-background]` stripped; hole stays transparent (alpha 0) |

### Export Formats

| Format | MIME | Quality | Notes |
|---|---|---|---|
| PNG | `image/png` | — | Default, lossless, supports alpha |
| JPEG | `image/jpeg` | 0–100 (default 90) | No alpha → background fills black unless overridden |
| WebP | `image/webp` | 0–100 (default 80) | Supports alpha, smaller than PNG |

### Multi-Scene Export

`exportAllScenes`:
1. For each scene: `setActiveSceneIndex(i)`, wait 2 rAFs (React commits + rasterizer stabilizes).
2. Capture via `exportScene`.
3. Name: `<sceneName>_<timestamp>.<ext>`.
4. Package all blobs into a ZIP (lazy `jszip` import — code-split).
5. **Restores** the original `activeSceneIndex` in a `finally` block (even on error).

### Export Routes

All three renderer-initiated routes call the same `exportScene`/`exportAllScenes`:
- **Preview**: in-app preview dialog showing the rasterized result.
- **Save**: `saveImageDialog` native dialog → writes blob to file.
- **Copy**: copies the blob to the OS clipboard via `navigator.clipboard.write`.

---

## 3. Transform Sessions

**File:** `src/renderer/services/transform.ts`

### Purpose

Stateful mouse-gesture sessions for drag-move and resize. Both follow the **live DOM mutation + commit-on-end** contract: DOM styles are mutated directly during the gesture (60fps), and the store is written only once on pointer-up.

### Types

```typescript
interface DragSessionOptions {
  element: ElementBounds
  onDrag: (id, x, y) => void          // DOM mutation callback
  onEnd: (id, x, y) => void            // commit callback (history push)
  onPreview?: (id, x, y, w, h, rotation?) => void  // ghost preview
  onGuidesChange?: (guides) => void
  snapFn: (x, y, w, h) => SnapResult
  multiDrag: MultiDragEntry[]          // followers for multi-select
}

interface ResizeSessionOptions {
  element: ElementBounds
  handle: ResizeHandleName             // 'nw'|'n'|'ne'|'w'|'e'|'sw'|'s'|'se'
  onResize: (id, x, y, w, h) => void   // commit callback
  onEnd: (id) => void
  onPreview?: (id, x, y, w, h, rotation?) => void
  lockAspectRatio: boolean
}
```

### `createDragSession(options)`

**Lifecycle:**

1. **`begin(pointer)`**: Stores `startX/Y` (from `ctx.scenePoint` via `pointerScenePos`), `el` (DOM element), `geom` (ElementBounds), `multiDrag` entries (followers). Calls `onEnd`'s wrapper setup.
2. **`move(pointer)`**: Computes delta = `current - start`, applies `snapFn` for smart-guide snapping, sets `el.style.left/top` directly (DOM mutation only — no store writes), calls `onPreview` for ghost. Moves multi-drag followers by the same delta.
3. **`end(pointer)`**: Calls `onEnd(id, finalX, finalY)` — the tool's callback pushes history and commits the store via `ctx.actions.updateElement`. The `onEnd` callback is responsible for nest/unnest decisions.
4. **`cancel()`**: Restores `el.style.left/top` to the start position. No store commit. No `onEnd` call.

**Multi-drag**: When `multiDrag` has entries (e.g., 3 selected elements), the `begin`/`move`/`end` loop applies the same delta to each follower via its own `onDrag`. The primary element is handled separately.

### `createResizeSession(options)`

**Lifecycle:**

1. **`begin(handle, pointer)`**: Stores start geometry + handle, reads `shiftKey` state.
2. **`move(pointer, shiftKey)`**: Calls `computeToDom(bounds, handle, target, { shiftKey, lockAspectRatio, minW, minH })` → returns `{ width, height, left, top }`. Sets `el.style.width/height/left/top` directly. Calls `onPreview` for ghost.
3. **`end(pointer, shiftKey)`**: Computes final dimensions, calls `onEnd(id)` (history push), then calls `onResize(id, x, y, w, h)` — the tool's callback commits the store via `ctx.actions.updateElement`.
4. **`cancel()`**: Restores start dimensions. No store commit.

### `computeResize(bounds, pointer, handle, options)`

The pure resize math (in `geometry.ts`):

```typescript
function computeResize(bounds, pointer, handle, opts): { x, y, width, height }
```

- **Handle mapping**: Each handle constrains which edges move.
  - `se`: width grows right, height grows down.
  - `nw`: width grows left (x shifts), height grows up (y shifts).
  - `n`: height grows up only.
  - `e`: width grows right only.
  - etc.
- **Proportional mode**: `shiftKey || lockAspectRatio` — locks to the start aspect ratio. Width drives height: `newHeight = newWidth / startRat` (and vice versa).
- **Min size**: Enforced as `Math.max(min, newWidth)` where `min` defaults to 20 (PropertiesPanel clamps to `< 20`).

### Commit-on-End Contract

```
Live gesture:   DOM mutation only (60fps)
                ├─ el.style.left/top/width/height
                ├─ onPreview → ghost (runtime.preview)
                └─ onGuidesChange → snap guides (runtime.snapGuides)

Pointer-up:     pushHistory(label)         ← BEFORE mutation
                onEnd/onResize → store.*     ← immutable update
                emitGhost(null)
                endInteraction()
```

On **cancel** (Escape, pointer-cancel, window blur):
- `session.cancel()` restores DOM to start position.
- No store commit, no history entry.
- `toolManager.interruptTools()` is called by the manager on these events.

---

## 4. Polygon Boolean Engine

**File:** `src/renderer/services/polygon-clip.ts`

### Purpose

Implements true region-subtraction for the mask system. CSS `clip-path` can only intersect keep-sets (AND), never subtract (A − B). The mask tool's `unmask` mode must **erase** masked regions, so the subtraction happens in the data model via this engine, then the residual masks are re-rendered as ordinary clip-paths.

### Data Structures

| Type | Description |
|---|---|
| `Pt { x, y }` | 2D point |
| `Ring = Pt[]` | Closed polygon (ordered vertices) |
| `Region { outer: Ring, holes: Ring[] }` | Connected region (outer boundary + interior holes) |
| `EPS` | `1e-9` — floating-point tolerance |

### Key Functions

#### `differenceRegion(subject: Region, clip: Ring): Region[]`

The core operation: **subject minus clip**. Returns all regions comprising the set difference.

**Algorithm (4 steps):**

**Step 1 — Subdivide:**
Every subject ring (outer + holes) and the single clip ring are split at every intersection point (including collinear-overlap endpoints). This ensures no sub-edge is ambiguous during classification. Edge keys preserve the original ring membership.

```
For each ring R in [subject.outer, ...subject.holes, clip]:
  For each edge (i, i+1) in R:
    For each edge (j, j+1) in all other rings:
      Find intersection point(s)
      Split both edges at intersection
```

**Step 2 — Classify:**
Each directed sub-edge is tested by sampling a point just off its left side:
- **Subject edges** are kept when their region side is **outside** the clip.
- **Clip edges** are kept (reversed) when their region side is **inside** the subject region.

This is the Martinez "inverted" classification for difference.

**Step 3 — Assemble:**
Selected directed edges form closed loops. At each vertex, the outgoing edge with the **largest right-turn angle** (most-left-turn traversal) is chosen. This greedy rule ensures correct topology — it's the key to avoiding bowties and incorrect island detection.

```
For vertex v with multiple outgoing candidates:
  Choose edge with max atan2(cross(in, out), dot(in, out))
  (largest positive turn angle = most clockwise = correct for difference)
```

**Step 4 — Normalize + Group:**
- Normalize orientations (CCW for outers, CW for holes).
- **Dedupe coincident loops** (`loopsEqual` — rotation-agnostic) — critical when a clip ring exactly coincides with a subject hole: both the clip's reversed edges and the subject's edges get selected, producing the same contour twice; it must appear once.
- Group loops into `Region[]` by even-odd containment depth (outer at depth 0, holes at depth 1, islands-in-holes at depth 2, etc.).

### Supporting Functions

| Function | Description |
|---|---|
| `ringArea(ring)` | Signed shoelace area |
| `regionArea(region)` | Outer area − hole areas |
| `pointInRegion(p, rings)` | Even-odd test over multiple rings |
| `normalizeRing(ring, ccw)` | Ensures ring orientation |
| `segmentIntersection(a1, a2, b1, b2)` | Segment intersection: single point, collinear overlap interval, or null |
| `isDegenerateRing(ring)` | True when `|ringArea| < EPS` |

### Critical Design Decisions

1. **Deduping coincident loops:** When a clip ring exactly coincides with a subject hole ring, both the clip's reversed edges AND the subject's edges are selected — the same contour appears twice. `loopsEqual` + the dedupe pass ensures regions carry one copy. Without this, holes would be rendered twice and produce empty regions.

2. **Right-turn tie-break:** At shared vertices with multiple outgoing edges, the edge with the largest positive turn angle is chosen. Greedy endpoint stitching would produce bowties (~2.2× area error); the most-left-turn rule is mandatory.

3. **Collinear overlap handling:** The intersection computation returns an interval for collinear overlaps, and the splitting step inserts both endpoints — so no sub-edge spans an ambiguous overlap region.

4. **Tolerance:** `EPS = 1e-9` for all comparisons. `Math.round` to 2dp in `regionToMask` is applied AFTER the boolean operation, so the engine works at full precision and the data model rounds only for storage.

### Usage

```
Tool.commitMask (unmask mode)
  → resolveUnmaskCommit(targetMasks, stroke, width, height)
    → for each mask: compute hidden region
    → if reveal mask touching stroke: remove entirely
    → if inverted mask: maskHiddenRegion(mask) ⊖ stroke via differenceRegion
    → drop box-covering residuals
    → regionToMask(residual) for each meaningful residual
  → replaceTargetMasks(targetId, newMaskList)
```

---

## 5. Paint Layer Engine

**File:** `src/renderer/services/paint-layers.ts`

### Purpose

Manages per-stroke raster paint layers. Each brush stroke becomes its own `ImageOverlay` named `Paint N` (friendly, human-readable), enabling independent layer manipulation (reorder, lock, delete) in the Layers panel.

### Types and Constants

| Export | Description |
|---|---|
| `PAINT_LAYER_PREFIX = 'Paint '` | Name prefix for friendly paint layer names |
| `PAINT_LAYER_NAME = '__paint_layer__'` | Legacy marker for pre-naming builds (load-time detection) |
| `isPaintLayer(name)` | `name === PAINT_LAYER_NAME || name.startsWith(PAINT_LAYER_PREFIX)` |
| `isPaintLayerImage(img)` | Same check against `ImageOverlay.name` |
| `isPaintLayerId(id)` | (internal) checks the element's name |

### Key Functions

#### `nextPaintLayerName(scene): string`

Counts existing paint layers across all element kinds and returns `Paint N` where N = count + 1. Uses the `isPaintLayer` prefix check as the single source of truth — one place recognizes paint layers, shared by the engine, Layers panel, Images panel filter, and import numbering.

#### `createPaintLayer(scene, src, groupId?, region?): ImageOverlay`

Creates a new 64×64 unlocked `ImageOverlay` (not actually 64×64 — the `src` is a full-resolution PNG from the rasterizer). Named via `nextPaintLayerName`. `zIndex` = `nextPaintLayerZIndex(scene)` (max zIndex across all 4 kinds + 1). Accepts `groupId` for focus mode (registers in the focused group) and `region` (bounds metadata for export culling).

#### `resolvePaintCommit(scene, points, brush)`

The paint commit resolver. Always calls `compositeStrokeToRegion(null, null, points, brush, canvasW, canvasH)` — meaning every stroke is rasterized onto a **fresh cropped canvas** (no compositing over an existing layer). This is the key to per-stroke layers: there is no shared active layer to overwrite.

```typescript
export function resolvePaintCommit(scene, points, brush) {
  const { canvasW, canvasH } = scene.canvas
  return compositeStrokeToRegion(null, null, points, brush, canvasW, canvasH)
}
```

#### `findActivePaintLayer(scene)` (REMOVED)

Previously looked up the topmost `Paint N` layer for compositing. **Removed** in the per-stroke refactor — every stroke creates a fresh layer.

### Architecture Decisions

1. **Per-stroke layers:** Each committed stroke becomes its own `Paint N` `ImageOverlay`. Layers stack per-stroke in the Layers panel and are filtered out of the ImagesPanel entirely.
2. **Prefix-based identity:** `Paint ` prefix (not a schema field). `isPaintLayer` is the single test — shared by the Images panel filter, Layers panel, `nextPaintLayerName`, and `importImageFromFile` numbering. Renaming a `Paint N` layer in the Layers panel removes the prefix, promoting it to a regular image that appears in the Images panel.
3. **No active layer lookup:** `resolvePaintCommit` always passes `null, null` to `compositeStrokeToRegion` — the rasterizer creates a fresh canvas each time. There's no "find the active layer" step.
4. **Focus mode:** Painting while focused still creates per-stroke layers registered in the focused group (`addToGroup`).

---

## 6. Stroke Sampling Engine

**File:** `src/renderer/services/stroke.ts`

### Purpose

Pre-allocated, allocation-free stroke point sampling with spatial simplification. Used by paint, blur, eraser, and mask brush tools.

### Types

| Type | Fields |
|---|---|
| `Point` | `{ x: number, y: number }` |
| `StrokePoint` | `{ x, y, pressure: number }` |
| `StrokeDescriptor` | `{ brushType, size, hardness, color, targetId, seed }` |
| `StrokeRenderState` | `{ brush, strokeWidth, globalAlpha }` |
| `BrushType` | `'paint' | 'blur' | 'eraser' | 'magic-eraser'` |

### `StrokeSampler`

A class with **no per-point allocation** — uses pre-allocated `Float64Array` buffers.

| Method | Behavior |
|---|---|
| `begin(descriptor)` | Resets state, sets `length = 0`, stores descriptor |
| `append(x, y, pressure = 1)` | Spatial simplification: skips if distance from last > `minDistance` (default 1.5px). Otherwise stores in buffer. |
| `appendLast(x, y, pressure = 1)` | Force-accept (always stores, regardless of distance). Used for stroke endings. |
| `forEach(callback)` | Iterates stored points |
| `toPoints()` | Allocates a fresh `StrokePoint[]` (one call at commit) |
| `length` | Current point count |
| `full` | `length >= capacity` |
| `capacity` | `DEFAULT_MAX_POINTS` (8192) |
| `reset()` | Releases buffers (sets to null, allows GC) |

**Spatial simplification**: `sqrt(dx² + dy²) < minDistance` → skip. This reduces point density for smooth strokes. The `minDistance` is configurable per tool (paint uses default 1.5; mask brush uses `BRUSH_MIN_DISTANCE_SQ = 2.25` → `minDistance = 1.5`).

### Constants

| Constant | Value | Purpose |
|---|---|---|
| `DEFAULT_MAX_POINTS` | 8192 | Max points before the sampler stops accepting (prevents memory exhaustion) |
| `DEFAULT_MIN_DISTANCE` | 1.5 | Spatial simplification threshold |
| `DEFAULT_MIN_DISTANCE_SQ` | 2.25 | Squared threshold (for fast distance check) |

### Lifecycle Contract

```
1. sampler.begin({ brushType, size, hardness, color, targetId })
2. (per pointer-move) sampler.append(sceneX, sceneY, pressure)
3. (on pointer-up) points = sampler.toPoints()
4. sampler.reset() / sampler = null
```

---

## 7. Preview System

**File:** `src/renderer/services/preview.ts`

### Purpose

A data-driven, imperative-canvas preview framework for live tool feedback. The ghost transform indicator, blur region indicators, and container drop ring all flow through a single `PreviewState` object rendered by `PreviewSurface.tsx`.

### Types

```typescript
interface PreviewStyle {
  fill?: string
  stroke?: string
  strokeWidth?: number
  lineDash?: number[]
  hatch?: boolean      // diagonal hatch pattern
  glow?: boolean       // soft shadow glow
}

type PreviewGeometry =
  | { type: 'rect'; source?: GhostBounds }
  | { type: 'ellipse' }
  | { type: 'line'; x, y, x2, y2 }

interface PreviewVisual extends PreviewGeometry { style?: PreviewStyle }
interface PreviewState { style?: PreviewStyle; visuals: PreviewVisual[] }
```

### `GhostBounds`

Carries the element identity through the ghost:
```typescript
interface GhostBounds {
  id: string          // element id the ghost targets
  x: number
  y: number
  width: number
  height: number
  rotation?: number
}
```

The `id` field is critical: `resolveLiveGhost(preview, elementId)` uses it to find the matching ghost source, which is the shared live-transform read by both the selection chrome (OverlayRenderer) and the ShapeRenderer facades.

### Key Functions

#### `buildGhostPreview(bounds: GhostBounds): PreviewState`

Builds a semi-transparent dashed blue outline with glow at the element's (rotated) target bounds:
```typescript
{
  visuals: [{
    type: 'rect',
    ...bounds,                  // x, y, width, height, rotation
    source: bounds,             // carries id for resolveLiveGhost
    style: {
      fill: 'rgba(99, 102, 241, 0.05)',
      stroke: 'rgba(99, 102, 241, 0.9)',
      strokeWidth: 1,
      lineDash: [6, 4],
      glow: true,
    }
  }]
}
```

The bounds are run through `getRotatedBounds` so the ghost outline matches the rotated element's AABB. The `source` field carries the raw unrotated box + element `id`.

#### `resolveLiveGhost(preview: PreviewState | null, elementId: string): GhostBounds | null`

The **shared live-transform reader**. Returns the first rect visual's `source` whose `id` matches. Used by:
- `OverlayRenderer.tsx` — resize chrome reads live bounds during resize gestures.
- `ShapeRenderer.tsx` — shape facades read live bounds via `useRuntimeStore((s) => resolveLiveGhost(s.preview, shape.id))`.

The zustand selector returns stable `null` for non-targeted shapes, so only the resized shape re-renders.

#### `buildBlurRegionPreview(geometry): PreviewState`

White translucent fill + hatch + glow (distinct from blue ghost):
```typescript
{
  visuals: [{
    type: geometry.type,  // 'rect' | 'ellipse' | 'line'
    ...geometry,
    style: {
      fill: 'rgba(255, 255, 255, 0.2)',
      stroke: 'rgba(255, 255, 255, 0.9)',
      strokeWidth: 1,
      hatch: true,
      glow: true,
    }
  }]
}
```

#### `drawPreview(ctx, state: PreviewState)`

The single geometry→canvas renderer. Draw pass:
1. For each visual: resolve style (base + per-visual merge).
2. **Fill pass**: `beginPath` → `traceShape` → `fill`. If `hatch`, save → clip to shape → fill diagonal hatch lines → restore.
3. **Outline pass**: stroke the path. For `'line'` visuals, skip fill and stroke at the visual's own width.

`traceShape` dispatches on `visual.type`:
- `'rect'` → `rect(x, y, w, h)` arc-rounded corners? No — just `ctx.rect`.
- `'ellipse'` → `ctx.ellipse(x+w/2, y+h/2, w/2, h/2, 0, 0, 2π)`.
- `'line'` → `moveTo(x, y)` → `lineTo(x2, y2)`.

### Two Preview Mechanisms

| Mechanism | Host | Use case | Performance |
|---|---|---|---|
| `ctx.fastOverlay` (StrokeSurface) | Imperative canvas | Brush strokes (paint/eraser/blur) | 60fps, no React re-renders |
| `runtime.preview` → PreviewSurface | Imperative canvas, store subscription | Ghost, blur regions, container drop ring | 60fps, subscribes to runtime store |

Both render through imperative canvas — the `PreviewSurface` subscribes to the runtime store's `preview` field and draws directly in the subscription callback (no React state triggers a re-render). Only the `zoom`/`scene.canvas` change effects trigger a re-subscription.

### Export-Cleanliness

`[data-preview-surface]` and `[data-stroke-surface]` both render in `OverlayRenderer`, a sibling of `[data-scene-export]`. They can never appear in exports.

---

## Engine Interaction Diagram

```
┌──────────────────────────────────────────────────┐
│              Tool Layer                          │
│                                                  │
│  Select Tool                                      │
│  ├─ createDragSession (transform.ts)              │
│  │  ├─ DOM mutation (live)                       │
│  │  ├─ onPreview → emitGhost → buildGhostPreview │
│  │  └─ onEnd → pushHistory → updateElement       │
│  │                                               │
│  ├─ createResizeSession (transform.ts)           │
│  │  └─ (same pattern, with resize math)          │
│  │                                               │
│  ├─ resolveContainerDrop (container-drop.ts)     │
│  │  └─ on pointer-up, decides nest/unnest        │
│  │                                               │
│  Paint Tool                                      │
│  ├─ StrokeSampler.begin/append/toPoints          │
│  ├─ fastOverlay.strokeLine (live preview)        │
│  └─ commit → resolvePaintCommit                  │
│     → compositeStrokeToRegion (rasterizer)      │
│     → pushHistory → addImage(createPaintLayer)   │
│                                                  │
│  Mask Tool                                       │
│  ├─ buildMaskStrokePolygon (mask-brush)          │
│  ├─ previewToMaskVisual → preview                 │
│  └─ commit → resolveUnmaskCommit OR addMask      │
│     → differenceRegion (polygon-clip)            │
│                                                  │
│  Destructive Tools (blur/eraser/magic)            │
│  ├─ StrokeSampler + fastOverlay (live)           │
│  └─ commit → applyDestructiveStroke              │
│     → pushHistory → updateDevice/Image/Shape     │
│                                                  │
│  Blur Region Tools                               │
│  ├─ buildBlurRegionPreview → preview             │
│  └─ commit → applyBlurRegion                     │
└──────────────────────────────────────────────────┘

                ↓ (reads/writes)
┌──────────────────────────────────────────────────┐
│              Engine Layer                        │
│                                                  │
│  transform.ts       — drag/resize sessions       │
│  geometry.ts        — resize math, unionBounds   │
│  rasterizer.ts      — canvas compositing         │
│  stroke.ts          — point sampling             │
│  polygon-clip.ts    — boolean difference         │
│  mask-diff.ts       — unmask resolution          │
│  mask-brush.ts      — brush stroke polygon       │
│  mask-visualization.ts — clip path strings      │
│  container-drop.ts  — nest/unnest resolution     │
│  preview.ts         — preview state + drawing    │
│  snapping.ts        — smart guides + grid snap   │
│  hit-test.ts        — scene-geometry hit test    │
│  capabilities.ts    — per-kind capabilities      │
│  focus.ts           — focus scope resolution     │
└──────────────────────────────────────────────────┘

                ↓ (React subscribes)
┌──────────────────────────────────────────────────┐
│           Renderer (React)                       │
│                                                  │
│  ToolEventSurface  ← dispatches to ToolManager   │
│  Scene.tsx         ← z-sort + container clips    │
│  OverlayRenderer   ← selection chrome + previews │
│  StrokeSurface     ← brush live preview canvas   │
│  PreviewSurface    ← ghost/blur indicator canvas │
│  ElementFacade     ← position + mask clip        │
│  Element components─ presentational (no handlers)│
└──────────────────────────────────────────────────┘

                ↓ (invokes)
┌──────────────────────────────────────────────────┐
│           Document Store (Zustand)               │
│                                                  │
│  sceneSlice    — all element CRUD + grouping      │
│  selectionSlice — select/align/distribute         │
│  historySlice  — undo/redo (JSON snapshots)      │
│  clipboardSlice — copy/cut/paste                 │
│  ... (14 slices total)                           │
│                                                  │
│  ← resetRuntime (never imports runtime store)    │
└──────────────────────────────────────────────────┘
                ↓ (transient state)
┌──────────────────────────────────────────────────┐
│           Runtime Store (Zustand)                │
│                                                  │
│  activeToolId, brush, focusGroupId, preview,    │
│  maskPreview, marqueeRect, hoveredElement,        │
│  snapGuides, containerDropTarget, editing, etc.  │
│  (never serialized, reset on transient/all)     │
└──────────────────────────────────────────────────┘
```
