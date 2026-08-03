# Mask Engine

The masking system cuts regions out of the scene as first-class, reusable
**scene layers**. A mask is an independent layer (like a device, image or
shape): it owns a `name`, participates in z-order via `zIndex`, and honors
`visible`/`locked`. Its geometry is **scene-space** (canvas coordinates), so a
mask has **no target element** — it clips whatever stacks above it.

Masks are Z-AWARE: a mask **preserves everything at or below its z-index**
(content beneath the mask — the scene background and anything drawn before it —
shows through its region) **and punches out only content above it**. A mask
drawn over a shape then followed by paint leaves the shape visible while the
paint is removed in the mask region.

This document describes the full pipeline: the data model, geometry
primitives, the render path, the tool, the UI, export, serialization, and the
contracts that hold it together.

---

## 1. Architecture overview

```
 Scene.masks: Mask[]                    ← the single source of truth
   │
   ├── editor render path (Scene.tsx)
   │     └── z-band partitioning + CSS clip-path wrappers → visual cutout
   │
   ├── overlay render path (MaskOverlay)
   │     └── committed outlines + live-stroke checkerboard — pure derived geometry
   │
   ├── live stroke (mask.ts tool + runtime maskPreview)
   │     └── same geometry builders as commit → WYSIWYG
   │
   └── export path (export-engine.ts)
         └── per-band domToCanvas + deterministic canvas punch (foreignObject
             capture silently drops clip-path: polygon(… evenodd))
```

Masks are stored in `Scene.masks[]` as independent scene layers with scene-space
geometry and their own `zIndex`. There is no target element — no per-type code,
no local-frame mapping.

**Key invariant — scene coordinates:** every mask's geometry (`x`, `y`,
`width`, `height`, `points`, `holes`) is in canvas coordinates, so the clip
aligns with the canvas at render time. Ellipses are 32-gons (shared with the
diff engine and the punch).

**Key invariant — z-awareness:** a mask preserves content at/below its
`zIndex` and punches out content above it. The editor expresses this by
partitioning the scene into z-bands (Section 8.3); the export rebuilds the same
semantics per band (Section 10.3).

**History contract:** callers MUST call `pushHistory()` BEFORE mutating so
undo restores the exact pre-mask state (same rule as every other document
slice).

---

## 2. Data model

Defined in `src/shared/types.ts` (L236–291).

```ts
type MaskShape = 'rectangle' | 'ellipse' | 'brush'

interface MaskPoint { x: number; y: number }

interface Mask {
  id: string
  name: string                // user-facing (e.g. "Mask 1", renamed in the panel)
  shape: MaskShape
  x: number                   // scene-space bounding box
  y: number
  width: number
  height: number
  points: MaskPoint[]         // brush outline polygon (rect/ellipse: [])
  inverted: boolean           // false = reveal, true = punch
  zIndex: number              // z-order layer (nextMaskZIndex → max + 1)
  visible: boolean
  locked: boolean
  holes?: MaskPoint[][]       // restored sub-regions on a brush punch
  snapshot?: MaskSnapshot     // frozen whole-scene freeze stamp
}

interface MaskSnapshot {
  dataUrl: string               // PNG data URL
  width: number                 // snapshot pixels (sourceBounds × scale)
  height: number
  sourceBounds: { x: number; y: number; width: number; height: number }
  capturedAt: number
}
```

### 2.1 `Scene.masks`

`Scene` carries `masks: Mask[]` (default `[]` in `createDefaultScene`). Masks
are independent scene layers — no `targetId`, no element coupling. `addMask`,
`updateMask`, `removeMask`, `replaceMasks`, `clearAllMasks` and
`nextMaskZIndex` live in `store/maskSlice.ts`.

### 2.2 Z-order

A mask is a layer in the scene's z-order like any element: its `zIndex` decides
which content it preserves vs. punches. `nextMaskZIndex(scene)` assigns the
maximum z-index across all elements and masks + 1, so freshly-drawn masks sit
above existing content by default (masks drawn first get lower z and are
preserved by later masks). The MasksPanel manages the mask list (add, reverse,
freeze, duplicate, delete, rename, visibility/lock); mask z-order is currently
assigned by creation order via `nextMaskZIndex`. A mask's `zIndex` is the
single piece of data that drives both the editor banding (Section 8.3) and the
export punch (Section 10).

### 2.3 Inversion semantics (the single source of truth)

Every mask is interpreted through its **hidden (masked-out) region**:

- **`inverted: true` — punch**: the drawn shape becomes transparent.
  hidden = `shape ∖ holes`
- **`inverted: false` — reveal**: everything outside the drawn shape is
  transparent (the shape is the "window"). hidden = `canvas box ∖ shape ∖ holes`

This hidden-region interpretation is shared verbatim by:
- the renderer (`buildMaskClipPath` — CSS clip),
- the overlay (`buildMaskPunchClipPath` / `buildMaskClipPath`),
- the subtractive unmask engine (`maskHiddenRegion` in `mask-diff.ts`),
- the export punch (`punchSceneMaskHoles`).

### 2.4 `Mask.holes`

Restored-area rings carved out of a punch by a subtractive unmask stroke
(Section 7). Rendered as nested evenodd contours: every hole ring contributes
to the same `polygon(...)`, and evenodd compositing subtracts them from the
shape — a reveal carved into a punch shows the original content through the
hole. `holes` is optional and legacy-absent (read with `?? []`); rect/ellipse
masks carrying holes render through the generic polygon branch.

### 2.5 `Mask.snapshot` (frozen masks)

An immutable freeze stamp of the whole scene captured at refresh time (Section
9). Frozen masks never show a checkerboard — the captured pixels ARE the
visualization of the masked region, and they render over the live canvas. Only
the explicit MasksPanel Refresh action rewrites a snapshot.

---

## 3. Geometry primitives

### 3.1 `maskOuterRing(mask)` — `services/mask-visualization.ts`

The closed contour that bounds a mask's own shape, in scene coordinates:

- rectangle → 4 corners (top-left → top-right → bottom-right → bottom-left)
- ellipse → 32-point approximation (matches the diff engine and clip renderer)
- brush → `mask.points` directly

This is the single geometry source shared by the CSS clip renderer, the
overlay, and the export punch — no ring/path drift between editor and export.

### 3.2 Ellipse approximation

Ellipses are approximated as a **32-gon** (32 points). The same constant
(`ELLIPSE_SEGMENTS = 32` in `mask-diff.ts`, and the literal 32 in
`ellipseRingPoints`) is used in the clip renderer, the diff engine, and the
punch.

---

## 4. Clip path builders — `services/mask-visualization.ts`

`buildMaskClipPath(mask, width, height): string` builds the CSS `clip-path`
value for the canvas of dimensions `width`/`height` (the mask is scene-space).
Null is never returned for a well-formed mask.

| Case | Output |
|---|---|
| inverted, box-covering | `polygon(<outer>, <holes…>, evenodd)` — single contour (see below) |
| inverted, partial | `polygon(0px 0px, W 0px, W H, 0px H, <outer>, <holes…>, evenodd)` — full canvas + shape hole |
| non-inverted rectangle, no holes | `inset(top right bottom left)` |
| non-inverted ellipse, no holes | `ellipse(rx ry at cx cy)` |
| non-inverted polygon, no holes | `polygon(<outer>)` |
| any shape with holes | `polygon(<outer>, <holes…>, evenodd)` |

**Box-covering single contour:** an inverted mask whose outer ring spans the
whole canvas must emit the outer contour directly. Emitting
`polygon(box, shape, evenodd)` would be a self-cancelling double contour
(evenodd parity flips twice over the box) that renders as an EMPTY clip — a
whole-canvas mask would leave the canvas exposed instead of hidden. Guarded by
`ringCoversBox` (Section 7.3).

`buildMaskPunchClipPath(mask, width, height)` returns the complement — the
clip of the **transparent** region — by flipping `inverted` and re-building:

```ts
return buildMaskClipPath({ ...mask, inverted: !mask.inverted }, width, height)
```

---

## 5. Brush geometry — `services/mask-brush.ts`

A brush mask is stored as a closed polygon approximating the **capsule strip**
swept by a disc of `radius` along the sampled centre-line (round caps + round
joins, like canvas `lineCap/lineJoin: round`).

`buildMaskStrokePolygon(points, radius): MaskStrokePoint[]`:

- radius clamped to `max(0.5, radius)`
- empty input → `[]`
- single point → 24-point circle (`CIRCLE_SEGMENTS = 24`)
- otherwise: start cap (half-disc behind the first point) → forward offset
  chain → end cap (half-disc beyond the last point) → reverse offset chain
  → start cap closed.
- **Per-joint anchors:** every join emits an anchor at BOTH tangents (plus arc
  interior points for sharp turns), so the flanks interpolate every sampled
  joint — a smooth curve with sub-`JOIN_STEP` direction changes still traces
  the cursor instead of collapsing into a straight chord between the caps.
- Arc interior points fill corners at `JOIN_STEP = π/6 ≈ 30°` granularity
  (`joinSegments = max(1, ceil(|Δ| / JOIN_STEP))`); caps use `CAP_SEGMENTS = 8`.
- Winding normalized: the polygon is reversed when its signed area is negative.
- All points rounded to 2 decimals so mask bounds serialize cleanly.

`boundsOf(points): MaskBounds` — axis-aligned bounds of a point set (zero rect
on empty input).

The same builder produces the committed mask and the live overlay preview, so
what you see while painting is exactly what commits (WYSIWYG).

---

## 6. Mask visual resolution — `services/mask-visualization.ts`

### 6.1 Per-mask overlay visuals

Because masks are scene-space layers spanning the whole canvas, every `MaskVisual`
has origin `(0,0)`, canvas dimensions, `rotation: 0`, and stacks by the mask's
own `zIndex`. No target resolution exists anymore (`findMaskTarget` is gone).

### 6.2 `MaskVisualItem` / `MaskVisual`

Per-mask overlay data:

```ts
interface MaskVisualItem {
  maskId: string
  shape: MaskShape
  inverted: boolean
  hiddenClipPath: string    // transparent region clip → checkerboard area
  visibleClipPath: string   // kept region clip → editing highlight
  rect: { x, y, width, height }       // scene-space bbox
  points: MaskPoint[] | null          // brush polygon (null for rect/ellipse)
  holes: MaskPoint[][] | null         // restored rings
}

interface MaskVisual {
  maskId: string
  origin: { x, y }          // always (0,0) — the mask spans the whole canvas
  width: number             // scene.canvas.width
  height: number            // scene.canvas.height
  rotation: number          // always 0
  zIndex: number            // mask.zIndex — stacks like the mask layer itself
  items: MaskVisualItem[]   // one per mask
}
```

`maskToVisualItem(mask, canvasW, canvasH)` derives one item (hidden clip =
`buildMaskPunchClipPath`, visible clip = `buildMaskClipPath`).

### 6.3 `collectMaskVisuals(scene, options)`

Resolves every mask to a scene-space visual, z-sorted (`mask.zIndex` ascending)
so the overlay stacks like the scene. Skips:

- frozen masks (with a `snapshot`) — they render their own snapshot content,
  never an outline;
- invisible masks (`mask.visible === false`);
- masks not in `options.ids` when `options.targets === 'ids'`.

Options: `{ targets: 'all' | 'ids', ids? }`.

### 6.4 `previewToMaskVisual(preview, canvasWidth, canvasHeight)`

Converts a live mask stroke (`maskPreview` from the runtime store) into a
scene-space visual so the overlay renders the same shape that will commit.
Stroke points are already in scene coordinates:

- brush → `buildMaskStrokePolygon(preview.points, preview.radius ?? 8)`, bbox
  from the polygon extents;
- rect/ellipse → normalized box from the two corner points.

Returns null until the stroke has at least one point. The synthetic mask id is
`'__mask_preview__'`.

---

## 7. Subtractive unmask — `services/mask-diff.ts`

The Mask tool's **unmask** mode must ERASE previously applied masks (restore
content) by exactly subtracting the drawn stroke from each existing mask's
masked-out region. A reveal clip can never do that — `(canvas ∖ A) ∩ R` only
hides more — so the subtraction happens in the **data model** with real polygon
boolean difference (`polygon-clip.differenceRegion`). Unmasking operates
**scene-wide**: every mask in `scene.masks` is a candidate, and any mask whose
hidden region the stroke touches is rewritten (Section 11.4).

### 7.1 Ring builders

- `rectRing(x, y, width, height)` — axis-aligned rectangle ring (TL→TR→BR→BL).
- `ellipseRing(x, y, width, height)` — 32-gon matching the clip renderer.

### 7.2 Hidden-region interpretation

```ts
function maskHiddenRegion(mask, width, height): Region {
  // inverted (punch):      hidden = shape ∖ holes
  // non-inverted (reveal): hidden = canvas box ∖ shape ∖ holes
}
```

The clip ring is the stroke's simple ring in **scene coordinates** (the stroke
is scene-space, so no local-frame mapping is involved).

### 7.3 `resolveUnmaskCommit(sceneMasks, stroke, width, height): Mask[] | null`

For each mask in the scene, computes `hidden ∖ stroke`:

- masks the stroke never touches → kept **by reference** (identity preserved);
- fully-erased masks → removed;
- a reveal (non-inverted) mask whose kept shape the stroke overlaps → removed
  entirely (see 7.5);
- a residual whose outer ring still covers the whole canvas → dropped
  (see 7.6);
- everything else → replaced by one `brush`-shape mask per residual connected
  region, always `inverted: true`, carrying rounded (2dp) coords, fitted
  bounds, `holes` for carved-out restored regions, and the source mask's
  `snapshot` inherited (a carve into a frozen mask keeps showing frozen
  content).

Returns `null` when the stroke erased nothing (no history entry) — a stray
unmask click over unmasked area is never an undo entry.

### 7.4 `ringCoversBox(ring, width, height): boolean`

True when a ring's boundary spans the whole canvas — the degenerate
"mask hides everything" state. Uses full-precision ring bounds + absolute
area (vs. `width × height`) with a 0.5 tolerance, so rounded residuals never
false-trigger. Shared by:

- the unmask resolver (drop canvas-covering residuals);
- the renderer (single-contour guard in `buildMaskClipPath`).

### 7.5 Reveal-mask recovery

A reveal (non-inverted) mask is a subtractive dead end: its hidden region is
the whole canvas, so a stroke anywhere on it (on its kept shape OR in the
hidden frame) can only leave the entire canvas hidden. Reveals are only
produced by the MasksPanel Reveal / Add-Mask actions or legacy builds, so ANY
unmask stroke that overlaps a reveal's kept shape removes it entirely — the
in-app recovery path for stale whole-canvas checkerboards.

### 7.6 Box-covering residual drop

A residual whose outer ring still spans the whole canvas is the
"unmask restored only interior holes" state — the mask hides the entire canvas
again after the carve. Dropping it means an unmask stroke clears a whole-canvas
punch rather than leaving it masked. An edge-touching carve genuinely restores
a strip/bay and is kept (topology preserved).

### 7.7 Coincident-boundary robustness

- `regionTouchesClip` finds candidates by boundary overlap + containment
  (segment intersections both ways + `pointInRegion`).
- `ringsEqual` / `regionEqual` (rotation-agnostic cyclic comparison with
  orientation-normalized holes) short-circuit touch-but-unchanged cases, so a
  stroke that merely re-traces an existing hole edge is a geometric no-op
  (`null`, no history entry).
- `differenceRegion` dedupes coincident loops (a clip ring coincident with a
  subject hole ring contributes the same contour twice and must be kept once).

---

## 8. Render path

### 8.1 Element facades — `elements/ElementFacade.tsx`

The single shared positioned wrapper every element kind renders through
(`data-element-id` / `data-element-kind` hit surface, no pointer handlers).
Masks are deliberately **NOT** applied here: masks are independent scene layers
clipped at the Scene level (scene-space clip wrappers over all content), never
per-element clips. Elements carry no mask references and no clip-path; masking
one region of the canvas affects whatever content happens to sit under the
mask — by z-order, not by which element it belongs to.

### 8.2 Container clipping — `Scene.tsx` + `services/container-clip.ts`

When an element has children (`containerId` references), those children clip to
the container's exact geometry at render time (Phase 3 container pipeline):

- rectangle boxes clip via `overflow: hidden` on the `data-container-clip`
  wrapper;
- shape parents additionally clip to their SVG outline via
  `clip-path: path('…')` (from `shape-geometry.getShapePath`);
- masks are NOT part of container clipping — they are scene layers and apply
  scene-wide on top of whatever the container already clipped;
- a container that is the active `focusElementId` skips its wrapper so its
  children render in full (fully editable); nested containers stay clipped
  inside any unfocused ancestor;
- `handledInWrapper` prevents double-render even when a child's z < the
  container's z.

The wrapper is positioned at the container's scene origin, carries the
container's `zIndex`, and hosts a counter-translate layer returning children to
scene coordinates.

### 8.3 Z-aware scene masks — `Scene.tsx`

Masks are independent SCENE layers with scene-space geometry and their own
`zIndex`. A mask **preserves everything at or below its z-index** (content
beneath the mask — the scene background and anything drawn before it — shows
through its region) **and punches out only content above it**. A mask drawn
over a shape then followed by paint leaves the shape visible while the paint is
removed in the mask region.

To express that, the scene content is partitioned into **z-bands**:

- band 0 = the background layer (`data-scene-background`) + the grid + every
  node with z ≤ the lowest live mask's z — never clipped;
- band i = content with z in `(mask[i-1].z, mask[i].z]`, clipped by every mask
  below it;
- the top band = everything above the highest live mask.

`bandForZ(z)` assigns each content layer its band; the background always lands
in band 0 (`bandForZ(-1)`), the grid bands at z=1 like any element. Each band
renders inside an inert `<div data-scene-band={i}>` wrapper
(`position:absolute; inset:0` — no z-index/transform, so children keep stacking
by their own z-index) — the grouping exists so the export engine can capture
bands independently.

Live masks (no `snapshot`) fold **descending** into `data-scene-mask-clip`
divs: `clip m(i)` wraps `band i+1` plus every higher mask, so the **lowest-z
mask is the OUTERMOST wrapper and the highest is the innermost**, and band b
lands inside the clip of exactly the masks below it. Each wrapper is
`inset:0`, `overflow:hidden`, `pointerEvents:none`, `zIndex: mask.zIndex`
(keeping the wrappers in the scene's stacking order), and clips via
`buildMaskClipPath`. A mask therefore affects exactly the content above it —
content at or below its z stays unclipped (preserved).

Frozen masks (a `snapshot`) don't create bands: their opaque snapshot is the
only thing the masked region shows, which makes banding them a visual no-op —
they emit a `MaskSnapshotLayer` sibling (Section 8.4) instead. Editor chrome
that must stay interactive or export-stripped (guides, watermark, context
menu) renders outside the band wrappers.

Z-aware bands are exported via `punchSceneMaskHoles` (Section 10), and the
`data-scene-background` node survives `background: 'scene'` exports.

### 8.4 Frozen content — `components/masks/MaskSnapshotLayer.tsx`

Paints `mask.snapshot` pixels as a scene layer covering the whole canvas:

- an inset-0 wrapper spans the whole canvas and clips to the mask's HIDDEN
  region (`buildMaskPunchClipPath(mask, canvasWidth, canvasHeight)`), with
  `background: transparent` so the live canvas can never leak through — the
  frozen pixels are the ONLY thing the masked region shows;
- the snapshot `<img>` is placed at its own `sourceBounds` (already scene-space)
  and sized to `sourceBounds` in scene units, so the captured region lines up
  with the canvas at render time (masks are scene layers, no element offset).

Emits `data-scene-mask-snapshot="true"` + `data-mask-snapshot="true"` +
`data-mask-snapshot-for={mask.id}` (the export engine re-captures frozen masks
by that marker, Section 10.3). Renders as a sibling of the z-band wrappers, on
top of the live scene.

---

## 9. Frozen-mask capture — `services/mask-snapshot.ts`

`captureMaskSnapshot(bounds)` produces an immutable PNG freeze stamp of the
whole scene, cropped to the mask's own scene-space box — the masked region
shows exactly what the canvas looked like at capture time, including other
layers, z-order, and the scene background.

- Clone-strip-offscreen-cleanup pattern (same as the export engine): clones
  `[data-scene-export]`, positions it fixed at `-99999px`, strips
  `[data-watermark]`/`[data-guide]`, keeps `[data-scene-background]`,
  `domToCanvas` at `MASK_SNAPSHOT_SCALE = 1`, crops via
  `ctx.drawImage(canvas, -bounds.x, -bounds.y)`, returns
  `{ dataUrl, width, height, sourceBounds, capturedAt }`.
- Returns `null` when there is no scene DOM (unit tests, early lifecycle) or
  rendering fails — callers fall back to a geometry-only mask with no snapshot.
- `canCaptureMaskSnapshot()` = `document.querySelector('[data-scene-export]') != null`,
  used by callers to keep the commit path synchronous when there is nothing to
  capture.

Frozen masks are created ONLY via the MasksPanel Refresh action
(`refreshMaskSnapshot` in `maskSlice`). Auto-capturing at creation was
reverted: a snapshot taken at creation time captures the same canvas the user
is looking at, so the frozen pixels are pixel-identical to the live scene and
the freshly-drawn mask is invisible — the reported "the mask disappears on
mouse release" regression.

`refreshMaskSnapshot(maskId)`: finds the mask, captures its own scene box,
no-ops (no history) when the mask is missing or capture returns null, else
`pushHistory('Refresh mask')` + `updateMask(maskId, { snapshot })`.

---

## 10. Export — `lib/export-engine.ts`

### 10.1 The problem

The scene DOM clips masks with `clip-path: polygon(… evenodd)` wrappers, which
the foreignObject capture silently ignores (probe-proven) — a shape inside a
masked region renders at full opacity in exports. The punch reproduces the
transparency hole on the raster deterministically.

### 10.2 `punchSceneMaskHoles(ctx, masks, canvasWidth, canvasHeight, scale)`

- `destination-out` fill with `fillRule: 'evenodd'` erases exactly the masked
  region. Hidden-region semantics mirror `buildMaskClipPath`:
  - inverted (punch): path = shape + holes
  - non-inverted (reveal): path = box + shape + holes
- No-op / degenerate rings (empty outer) are skipped.
- Uses `maskOuterRing` — the same geometry source as the editor clip.

The punch is Z-AWARE in how `exportScene` calls it: a mask punches only the
content ABOVE it, so each band is punched by exactly the masks below it
(`liveMasks.slice(0, b)`) and content at or below a mask's z — the background
in band 0 and any element beneath the mask — survives inside its region.

### 10.3 Band compositing in `exportScene`

For masked scenes the foreignObject capture drops the masks' evenodd clip-path
wrappers, so the z-aware semantics are rebuilt on the raster. The scene
renders as z-bands (Section 8.3); `exportScene` captures each band
independently from the export clone and composites them bottom-up:

- `captureSceneBandNode(cloned, b, w, h, scale)` re-homes a clone of
  `[data-scene-band="b"]` inside a fixed, scene-sized wrapper (the band is
  `absolute; inset: 0`, so the wrapper supplies the containing block) and
  `domToCanvas`s it with the same `scale`/`style` options as the main capture.
- Band b's canvas is punched with `liveMasks.slice(0, b)` (the masks below it)
  and `drawImage`d onto an offscreen out-canvas — so masks erase only the
  content above them, and the background in band 0 is never punched (its
  capture is raw and always present, giving `background: 'scene'` exports their
  preserved background through every hole with no separate composite step).
- Frozen masks are repainted, not punched away: their hole is punched on the
  out-canvas, then `[data-mask-snapshot-for={id}]` is captured, punched to the
  mask's shape, and drawn back over the hole — so exports show the frozen
  snapshot exactly where the editor shows it.

Background gating:
- `'scene'` → band 0 keeps `[data-scene-background]` (holes reveal the scene's
  own background); the out-canvas needs no fill.
- `'solid'` → `destination-over` fill with the requested color after
  compositing (holes read as the requested color).
- `'transparent'` → punch only (hole stays transparent alpha).
- JPEG/WebP (no alpha) composite over black via the encoder — holes read as the
  background color instead of black.

No visible masks → a single flat capture (no band machinery, no out-canvas).

Every export route (Preview/Save/Copy, and `exportAllScenes` per-scene) calls
`exportScene`, so the punch applies to all of them.

---

## 11. The Mask tool — `tools/tools/mask.ts`

Tool id `mask`, group `'mask'`, shortcut `G`, `options: true`, cursor
`crosshair`.

### 11.1 Pointer-down

- Primary button only.
- Claims the pointer and pins a `PendingMask` — geometry is SCENE-space (canvas
  coordinates) for every shape, so there is no element targeting, no
  hit-testing, and no local-frame mapping:

  ```ts
  interface PendingMask {
    pointerId: number
    shape: 'rectangle' | 'ellipse' | 'brush'
    inverted: boolean                       // 'mask' mode
    anchor: { x; y }                        // pointer-down scene point
    last: { x; y }
    points: { x; y }[]                      // scene-space polyline (brush only)
    radius: number                          // brush.size / 2
  }
  ```

- Begins the `mask` interaction and pushes the live preview.

`inverted = rt.maskMode === 'mask'` — 'mask' mode cuts the DRAWN region out of
the canvas (the shape becomes transparent); 'unmask' mode keeps the drawn
region and hides the rest. Default `maskMode` is `'mask'`.

### 11.2 Pointer-move

- Rect/ellipse: just updates `last`.
- Brush: appends to the scene-space point cloud when the sample is ≥
  `BRUSH_MIN_DISTANCE_SQ` (2.25) from the previous point.
- Re-pushes the preview (live checkerboard/highlight).

### 11.3 Pointer-up

- The pointer-up scene point is authoritative (caps the brush polyline at the
  release point even when the final move was > the sample distance away).
- Ends the interaction, clears the preview.
- Sub-3px clicks (rect/ellipse only) are ignored (`MIN_DRAG_DISTANCE_SQ = 9`).
- Computes the stroke:
  - brush → `buildMaskStrokePolygon(pm.points, pm.radius)` (the closed capsule
    polygon, NOT the raw polyline — `maskOuterRing`/`mask-diff` consume the
    ring directly);
  - ellipse → `ellipseRing(rect…)`;
  - rect → `rectRing(rect…)`.
- **Mask mode (`inverted`)**: `commitLiveMask` — `pushHistory('Add mask')`
  BEFORE the mutation, then `addMask` with a fresh id and
  `zIndex: nextMaskZIndex(scene)`. Additive: every stroke appends a fresh mask;
  strokes stack by clip-path intersection (re-drawing over an already-masked
  region adds a SECOND mask, never replacing). Committed LIVE (geometry-only,
  no snapshot); frozen only via the MasksPanel Refresh action.
- **Unmask mode**: `resolveUnmaskCommit(scene.masks, stroke, canvasW, canvasH)`
  against the scene's mask list (scene-wide — a stroke can touch any mask's
  hidden region); only when non-null → `pushHistory('Unmask')` +
  `replaceMasks(commit)`. A no-op stroke changes nothing and pushes no history
  entry.

### 11.4 Cancel / interrupt

`onPointerCancel` clears the pending stroke + preview + interaction, no commit.
`onInterrupt` (Escape / window blur / manager reset) does the same via direct
runtime-store access — a stranded pending mask can never commit.

---

## 12. Runtime state — `runtimeSlice.ts`

```ts
interface MaskPreviewState {
  shape: 'rectangle' | 'ellipse' | 'brush'
  points: { x: number; y: number }[]   // scene coordinates
  inverted: boolean
  radius?: number                      // brush strokes only
}
```

- `maskPreview: MaskPreviewState | null` + `setMaskPreview` — live stroke.
- `maskShape: 'rectangle'` (default) + `setMaskShape` — next stroke shape.
- `maskMode: 'mask'` (default) + `setMaskMode` — mask vs unmask.
- `maskShape` resets to `'rectangle'` on `FULL_RESET` (`'all'`, project
  new/open); `TRANSIENT_RESET` keeps it (undo/redo, scene switches) — the
  selected shape survives like brush settings.
- `maskPreview` is cleared wholesale by both `TRANSIENT_RESET` and
  `FULL_RESET` (transient editor state, never serialized/snapshotted).

---

## 13. UI

### 13.1 MaskOverlay — `components/masks/MaskRenderer.tsx`

Transient editor chrome rendered as a sibling overlay (never inside
`[data-scene-export]`), in scene coordinates, on top of the scene.

**Checkerboard:** dark + blue squares exactly where a mask is being drawn. The
checkerboard is a LIVE-STROKE affordance only — committed masks render as
outlines, never as a checkerboard.

```ts
CHECKER_DARK = '#000000'
CHECKER_BLUE = '#2563eb'
CHECKER_SIZE = 64   // one square's edge, scene units
```

`repeating-conic-gradient(dark 0% 25%, blue 0% 50%)` encodes a 2×2 checkerboard
per tile, so `backgroundSize = CHECKER_SIZE * 2` keeps each square exactly
64×64 scene units.

Rendering:
- per-mask `data-mask-visual` wrapper at the mask's scene origin (scene-space
  geometry, `data-mask-for` carries the mask id);
- committed masks render as an SVG `MaskOutline` per mask — a dashed outline
  only (blue `#6366f1` for punch masks, amber `#f59e0b` for inverted),
  emphasizing the shape + each `holes` ring, with corner-control dots on
  rect/ellipse masks. Committed masks show NO checkerboard, scrim, badge, or
  highlight: the editor renders the mask's effect via the scene's own z-band
  clipping (Section 8.3) and the outline just marks where a mask exists
  (it must never read as transparency);
- while a stroke is in flight (`preview != null`, which also emphasizes the
  committed outlines): `data-mask-preview` renders `data-mask-preview-checkerboard`
  (the live checkerboard clipped to the stroke's hidden region, mask strokes
  only), `data-mask-preview-highlight` (blue tint on mask strokes, green
  "restore" tint on unmask — a subtractive stroke masks nothing), and the live
  stroke outline.

`MaskOverlay` is rendered unconditionally by `OverlayRenderer` with
`visuals={collectMaskVisuals(scene)}` — committed masks show their outlines
permanently.

### 13.2 MasksPanel — `components/sidebar/MasksPanel.tsx`

The dedicated sidebar panel (`masks` tab) for managing scene-layer masks. It is
the ONLY panel that edits masks — the PropertiesPanel never references masks
(masks belong to the canvas, not to any selected element).

- **Add Mask** — "Full Canvas Mask" button: `pushHistory('Add mask')` +
  `addMask` with a fresh id, `name: Mask N` (count + 1), a full-canvas
  rectangle, `inverted: true` (punch), `zIndex: nextMaskZIndex(scene)`, visible
  and unlocked.
- **Per-mask row** (name + shape/inverted caption): visibility eye, lock,
  **Reverse** (`pushHistory('Reverse mask')` → `reverseMask`, toggles
  punch↔reveal), **Freeze↔Refresh** (`refreshMaskSnapshot`; "Freeze current
  canvas" when live, "Refresh frozen snapshot" when frozen), **Duplicate**
  (`pushHistory('Duplicate mask')` → `addMask({...m, id, name: name copy,
  zIndex: nextMaskZIndex})`), and **Delete** (`pushHistory('Remove mask')` →
  `removeMask`).
- Double-click the name to rename (`pushHistory('Rename mask')` on commit).
- **Clear all masks** danger button — the in-app recovery path for stale masks
  (e.g. a reveal mask tiling the whole canvas in checkerboards).

Every operation pushes history BEFORE the mutation.

### 13.3 ToolOptionsPanel mask options

- Shape buttons: Rect / Ellipse / Brush (`MASK_SHAPES`).
- Mode buttons: Mask / Unmask (`MASK_MODES`).
- Brush radius slider (1–120px) when `maskShape === 'brush'` (writes
  `brush.size`).
- "Clear masks" danger button (`pushHistory('Clear masks')` →
  `clearAllMasks()`), so stale whole-canvas masks are removable without opening
  the panel.

---

## 14. Store — `store/maskSlice.ts`

| Action | Behavior |
|---|---|
| `addMask(mask)` | appends to the active scene |
| `updateMask(id, patch)` | merges a partial patch |
| `removeMask(id)` | deletes by id |
| `reverseMask(id)` | toggles `inverted` |
| `replaceMasks(masks)` | replaces the whole active scene's mask list — the commit boundary for a subtractive unmask stroke (one history entry) |
| `clearAllMasks()` | empties the active scene's `masks` |
| `refreshMaskSnapshot(maskId)` | re-captures a frozen snapshot (Section 9) |
| `nextMaskZIndex(scene)` | max z-index across all elements and masks, + 1 |

All mutators are pure immutable `set` updates on `scenes[activeSceneIndex]`.
History is the caller's responsibility (`pushHistory` BEFORE the mutation).

---

## 15. Serialization — `lib/project-serialization.ts`

`SerializedScene.masks?: SerializedMask[]` — each round-trips `id`, `name`,
`shape`, `x/y/width/height`, `points`, `inverted`, `zIndex`, `visible`,
`locked`, optional `holes`, and optional `snapshot`. The snapshot's `dataUrl`
is walked through the asset walker (`asset://img-*.png` and back), so a frozen
capture survives `.mockup` save/load. Deserialization reads
`masks: scene.masks ?? []` (legacy files predate masks), and `holes`/`snapshot`
are legacy-absent (no hydration logic).

**Legacy migration:** pre-mask-layers files stored masks with a `targetId`
referencing an element and local-frame geometry. On deserialize, `targetId`
masks are migrated to scene layers: the target's scene position is added to the
geometry (element rotation is baked in at load time — documented limitation),
the background sentinel becomes a full-canvas low-z mask, and masks whose
target no longer exists are dropped. New-format masks (no `targetId`) pass
through unchanged.

`regionToMask` (mask-diff) copies a source mask's `snapshot` onto carved
residuals, so unmasking a frozen mask keeps showing frozen content.

---

## 16. Clipboard

Clipboard is element-only: `ClipboardEntry` copies/cuts/pastes elements and
groups but NEVER masks. Masks are scene layers that don't belong to any
element, so copy/cut/paste of an element leaves every mask untouched — a mask
keeps clipping the canvas (and whatever content happens to be under it) exactly
as before the operation.

---

## 17. Test coverage

Contract tests live in `src/__tests__/`:

| File | Coverage |
|---|---|
| `mask.test.ts` | clip-path builders, `collectMaskVisuals` (scene-wide, frozen skip), maskSlice CRUD + `nextMaskZIndex`, serialization round-trip + legacy migration, tool behaviors (rect/ellipse/brush, additive re-draw, unmask carve/cover/reveal-recovery/box-clear, sub-3px click, non-primary, undo, pointer-cancel, scene-wide strokes) |
| `mask-diff.test.ts` | ring builders, `resolveUnmaskCommit` (no-ops, carve with hole, split, full cover, reveal erasure, reference preservation, coincident-hole no-op, clip-path hole contours, box-covering single contour), `ringCoversBox` |
| `maskBrush.test.ts` | capsule for 2-point stroke, corner regression (both flanks), U-turn, smooth-curve flanks, single-point circle |
| `maskOverlay.test.tsx` | checkerboard color contract, per-mask clipped layers, live preview checkerboard/highlight, badge label by mode, nested evenodd contours, outline-only committed visuals, never leaks into the export node |
| `maskSnapshot.test.ts` | live geometry-only commit (no snapshot), `refreshMaskSnapshot` re-capture/undo, capture-fail no-op, unknown-id no-op |
| `masksPanel.test.tsx` | panel Add/visibility/lock/reverse/freeze/duplicate/delete/rename/clear-all with one history entry each |
| `export-engine.test.ts` | punch primitives (inverted/reveal/holes/degenerate), **z-aware band compositing** (band b punched by `liveMasks.slice(0, b)`, band 0 never punched, no-background masked scene, frozen-mask repaint over its punched hole) |
| `containerClip.test.tsx` | container clip wrappers + shape-outline clipping (mask intersection removed from containers) |
| `polygon-clip.test.ts` | boolean difference engine (contained clip → hole, split, full cover, disjoint, annulus sever, re-entrant fold) |

---

## 18. Contract summary (the rules that must not break)

1. **Geometry is scene-space**: masks store full-canvas coordinates, never
   element-local frames; there is no `targetId`, no `findMaskTarget`, and no
   `toLocalPoint` mapping in the mask path. A mask clips the whole canvas.
2. **Z-awareness**: a mask preserves content at/below its `zIndex` and punches
   out only content above it. Editor rendering expresses this with z-bands and
   a descending `data-scene-mask-clip` fold; export reproduces it with
   per-band punch subsets (`liveMasks.slice(0, b)`) and bottom-up compositing.
3. **Hidden region is the single source of truth**: inverted → `shape ∖ holes`;
   non-inverted → `canvas ∖ shape ∖ holes`; used identically by clip builder,
   overlay, diff engine, and export punch.
4. **History BEFORE mutation**, always, one entry per committed stroke/action.
5. **Additive mask / subtractive unmask**: mask mode appends fresh masks
   (compose by z + intersection); unmask mode rewrites via
   `resolveUnmaskCommit` and returns `null` (no history) when nothing is erased.
6. **Frozen snapshots are Refresh-only**: capture at creation is invisible
   (pixel-identical to the live canvas) and was reverted; live-by-default is
   the contract. Frozen masks never show an outline/checkerboard — their
   snapshot layer is the visualization.
7. **Export punch is z-aware and background-correct**: band 0 (the background
   layer) is never punched, so `'scene'` exports show the preserved background
   through every hole with no separate composite; frozen masks repaint their
   snapshot over their punched hole.
8. **Box-covering masks are single-contour**: `ringCoversBox` guards both the
   renderer (no self-cancelling evenodd double contour) and the unmask resolver
   (drop canvas-covering residuals).
9. **Tools never touch the DOM**: geometry is pure functions over store/runtime
   state; the only DOM the mask path touches is the snapshot capture service.
