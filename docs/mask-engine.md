# Mask Engine

The masking system turns any scene element — or the whole canvas — into a
transparent cutout. Masks are first-class scene content: reusable clip geometry
stored in each target element's **local coordinate frame**, rendered through
CSS `clip-path` compositing in the editor, and reproduced deterministically on
the raster at export time.

This document describes the full pipeline: the data model, geometry
primitives, the render path, the tool, the UI, export, serialization, and the
contracts that hold it together.

---

## 1. Architecture overview

```
 Scene.masks: Mask[]                    ← the single source of truth
   │
   ├── editor render path (Scene.tsx / ElementFacade.tsx / container-clip.ts)
   │     └── CSS clip-path (evenodd compositing) → visual cutout
   │
   ├── overlay render path (MaskOverlay)
   │     └── checkerboard / outlines / scrim — pure derived geometry
   │
   ├── live stroke (mask.ts tool + runtime maskPreview)
   │     └── same geometry builders as commit → WYSIWYG
   │
   └── export path (export-engine.ts)
         └── domToCanvas + deterministic canvas punch (foreignObject
             capture silently drops clip-path: polygon(… evenodd))
```

Masks are stored in `Scene.masks[]` and reference their target element by
`targetId` (elements never know their masks). Any element kind can be masked
with zero per-type code, and masks never participate in z-order — they ride
along with the target element.

**Key invariant — local coordinates:** every mask's geometry (`x`, `y`,
`width`, `height`, `points`, `holes`) lives in the target element's local
frame, so the clip rotates with the element. The scene-wide exception is the
background sentinel (`__background__`), whose "local frame" IS the canvas
(origin 0,0, full canvas size).

**History contract:** callers MUST call `pushHistory()` BEFORE mutating so
undo restores the exact pre-mask state (same rule as every other document
slice).

---

## 2. Data model

Defined in `src/shared/types.ts` (L226–282).

```ts
type MaskShape = 'rectangle' | 'ellipse' | 'brush'

interface MaskPoint { x: number; y: number }

interface Mask {
  id: string
  targetId: string              // element id, or BACKGROUND_MASK_TARGET_ID
  shape: MaskShape
  x: number                     // local-frame bounding box
  y: number
  width: number
  height: number
  points: MaskPoint[]           // brush outline polygon (rect/ellipse: [])
  inverted: boolean             // false = reveal, true = punch
  holes?: MaskPoint[][]         // restored sub-regions on a brush punch
  snapshot?: MaskSnapshot       // frozen whole-scene freeze stamp
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

`Scene` carries `masks: Mask[]` (default `[]` in `createDefaultScene`). Every
mask is matched against its target by `targetId`; masks whose target is missing
("ghost" masks) are tolerated by the renderer and simply not drawn.

### 2.2 Targets

| Target | `targetId` | Local frame | Notes |
|---|---|---|---|
| Any element | element id | element box (x/y/w/h/rotation) | devices, textBoxes, images, shapes |
| Container | element id | container box | children clip to the container's geometry **and** its masks |
| Background/canvas | `'__background__'` (sentinel) | full canvas (0,0 → scene.canvas.w/h) | a scene-level cutout; clips the background layer + grid + every element |

The sentinel is exported from `services/mask-visualization.ts` as
`BACKGROUND_MASK_TARGET_ID`. It is never part of the focus scope, so a focused
mask session can't reach the dimmed background.

### 2.3 Inversion semantics (the single source of truth)

Every mask is interpreted through its **hidden (masked-out) region**:

- **`inverted: true` — punch**: the drawn shape becomes transparent.
  hidden = `shape ∖ holes`
- **`inverted: false` — reveal**: everything outside the drawn shape is
  transparent (the shape is the "window"). hidden = `element box ∖ shape ∖ holes`

This hidden-region interpretation is shared verbatim by:
- the renderer (`buildMaskClipPath` — CSS clip),
- the overlay (`buildMaskPunchClipPath` / `buildMaskClipPath`),
- the subtractive unmask engine (`maskHiddenRegion` in `mask-diff.ts`),
- the export punch (`punchSceneMaskHoles`).

### 2.4 `Mask.holes`

Restored-area rings carved out of a punch by a subtractive unmask stroke
(Section 8). Rendered as nested evenodd contours: every hole ring contributes
to the same `polygon(...)`, and evenodd compositing subtracts them from the
shape — a reveal carved into a punch shows the original content through the
hole. `holes` is optional and legacy-absent (read with `?? []`); rect/ellipse
masks carrying holes render through the generic polygon branch.

### 2.5 `Mask.snapshot` (frozen masks)

An immutable freeze stamp of the whole scene captured at creation/refresh time
(Section 9). Frozen masks never show a checkerboard — the captured pixels ARE
the visualization of the masked region. Only the explicit Refresh action
rewrites a snapshot.

---

## 3. Geometry primitives

### 3.1 `maskOuterRing(mask)` — `services/mask-visualization.ts`

The closed contour that bounds a mask's own shape, in local coordinates:

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
value for a target box of local dimensions `width`/`height`. Null is never
returned for a well-formed mask.

| Case | Output |
|---|---|
| inverted, box-covering | `polygon(<outer>, <holes…>, evenodd)` — single contour (see below) |
| inverted, partial | `polygon(0px 0px, W 0px, W H, 0px H, <outer>, <holes…>, evenodd)` — full box + shape hole |
| non-inverted rectangle, no holes | `inset(top right bottom left)` |
| non-inverted ellipse, no holes | `ellipse(rx ry at cx cy)` |
| non-inverted polygon, no holes | `polygon(<outer>)` |
| any shape with holes | `polygon(<outer>, <holes…>, evenodd)` |

**Box-covering single contour:** an inverted mask whose outer ring spans the
whole element box must emit the outer contour directly. Emitting
`polygon(box, shape, evenodd)` would be a self-cancelling double contour
(evenodd parity flips twice over the box) that renders as an EMPTY clip — a
whole-canvas mask would leave the box exposed instead of hidden. Guarded by
`ringCoversBox` (Section 7.4).

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

### 6.1 `MaskTarget` resolution

`findMaskTarget(scene, id): MaskTarget | null` resolves a targetId to its
scene-space geometry + z-index. The background sentinel resolves to a
full-canvas target with `rotation: 0`, `visible: true`, and `zIndex: -1` (the
background's checkerboard stacks beneath every element's).

### 6.2 `MaskVisualItem` / `MaskVisual`

Per-mask overlay data:

```ts
interface MaskVisualItem {
  maskId: string
  shape: MaskShape
  inverted: boolean
  hiddenClipPath: string    // transparent region clip → checkerboard area
  visibleClipPath: string   // kept region clip → editing highlight
  rect: { x, y, width, height }       // local bbox
  points: MaskPoint[] | null          // brush polygon (null for rect/ellipse)
  holes: MaskPoint[][] | null         // restored rings
}

interface MaskVisual {
  elementId: string
  origin: { x, y }          // scene position of the target
  width: number
  height: number
  rotation: number
  zIndex: number
  items: MaskVisualItem[]   // one per mask on this target
}
```

### 6.3 `collectMaskVisuals(scene, options)`

Resolves every visible, in-scope target mask to scene-space visuals, grouped
per element and z-sorted (checkerboards stack like the scene itself). Skips:

- frozen masks (with a `snapshot`) — they render their own snapshot content,
  never a checkerboard;
- ghost (unresolvable target) and invisible targets;
- out-of-scope targets when `focusGroupId`/`focusElementId` options are given.

Options: `{ targets: 'all' | 'ids', ids?, focusGroupId?, focusElementId? }`.

### 6.4 `previewToMaskVisual(preview)`

Converts a live mask stroke (`maskPreview` from the runtime store) into a
scene-space visual so the overlay renders the same shape that will commit.
Scene-space stroke points are mapped to local coordinates via `toLocalPoint`,
then:

- brush → `buildMaskStrokePolygon(localPoints, preview.radius ?? 8)`, bbox from
  `boundsOf`;
- rect/ellipse → normalized box from the two local corner points.

Returns null until the stroke has at least one point. The synthetic mask id is
`'__mask_preview__'`.

### 6.5 Focus scrim

`buildSceneDimPunch(canvasWidth, canvasHeight, x, y, width, height, rotation)`
builds the evenodd `polygon(whole canvas, rotated target box)` clip used to dim
everything but the target while a mask stroke is in flight. Null when the
canvas is degenerate. `rotatedBoxCorners` computes the rotated target corners
(rotation pivot = box center).

---

## 7. Subtractive unmask — `services/mask-diff.ts`

The Mask tool's **unmask** mode must ERASE previously applied masks (restore
content) by exactly subtracting the drawn stroke from each existing mask's
masked-out region. A reveal clip can never do that — `(element ∖ A) ∩ R` only
hides more — so the subtraction happens in the **data model** with real polygon
boolean difference (`polygon-clip.differenceRegion`).

### 7.1 Ring builders

- `rectRing(x, y, width, height)` — axis-aligned rectangle ring (TL→TR→BR→BL).
- `ellipseRing(x, y, width, height)` — 32-gon matching the clip renderer.

### 7.2 Hidden-region interpretation

```ts
function maskHiddenRegion(mask, width, height): Region {
  // inverted (punch):      hidden = shape ∖ holes
  // non-inverted (reveal): hidden = element box ∖ shape ∖ holes
}
```

The clip ring is the stroke's simple ring in the target's local coordinate
frame.

### 7.3 `resolveUnmaskCommit(targetMasks, stroke, width, height): Mask[] | null`

For each mask on the target, computes `hidden ∖ stroke`:

- masks the stroke never touches → kept **by reference** (identity preserved);
- fully-erased masks → removed;
- a reveal (non-inverted) mask whose target box is touched at all → removed
  entirely (see 7.5);
- a residual whose outer ring still covers the whole element box → dropped
  (see 7.6);
- everything else → replaced by one `brush`-shape mask per residual connected
  region, always `inverted: true`, carrying rounded (2dp) coords, fitted
  bounds, `holes` for carved-out restored regions, and the source mask's
  `snapshot` inherited (a carve into a frozen mask keeps showing frozen
  content).

Returns `null` when the stroke erased nothing (no history entry) — a stray
unmask click over unmasked area is never an undo entry.

### 7.4 `ringCoversBox(ring, width, height): boolean`

True when a ring's boundary spans the whole element box — the degenerate
"mask hides everything" state. Uses full-precision ring bounds + absolute
area (vs. `width × height`) with a 0.5 tolerance, so rounded residuals never
false-trigger. Shared by:

- the unmask resolver (drop box-covering residuals);
- the renderer (single-contour guard in `buildMaskClipPath`).

### 7.5 Reveal-mask recovery

A reveal (non-inverted) mask is a subtractive dead end: its hidden region is
the whole element box, so a stroke anywhere on the target (on its kept shape
OR in the hidden frame) can only leave the entire box hidden. Reveals are only
produced by PropertiesPanel Add Mask/Reverse or legacy builds, so ANY unmask
stroke on a reveal's target removes it entirely — the in-app recovery path for
stale whole-canvas checkerboards.

### 7.6 Box-covering residual drop

A residual whose outer ring still spans the whole element box is the
"unmask restored only interior holes" state — the mask hides the entire box
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

### 8.1 Per-element masks — `elements/ElementFacade.tsx`

The single shared positioned wrapper every element kind renders through.
Applies the element's masks with zero per-type code, so masking works for
devices, text boxes, images and shapes. The clip correctly lives in the
element's rotated local frame.

- The first mask clips the element's own border box (`masks[0]` → root
  `clipPath`).
- Any additional masks are intersected as **nested inset-0 clip layers**
  (`data-element-mask-clip="true"`), each in the same local frame — pure
  `clip-path` intersection, no compositing math. Layer order: `masks[0]`
  innermost, the last mask outermost (the outer-most extra mask wraps the
  inner ones).
- **Frozen masks** (with a `snapshot`) do NOT clip the element. A frozen
  `masks[0]` cannot clip the root (its hidden region would clip the frozen
  layer away with it), so the root stays unclipped and a `MaskSnapshotLayer`
  paints the frozen pixels over the hidden region, keeping the element's live
  content visible everywhere else. Frozen extra masks keep their clip wrapper
  (live content clipped to the visible region) plus a `MaskSnapshotLayer`
  sibling.

### 8.2 Container masks — `Scene.tsx` + `services/container-clip.ts`

When an element has children (`containerId` references), those children clip to
the container's exact geometry at render time (Phase 3 container pipeline):

- rectangle boxes clip via `overflow: hidden` on the `data-container-clip`
  wrapper;
- shape parents additionally clip to their SVG outline via
  `clip-path: path('…')` (from `shape-geometry.getShapePath`);
- any masks on the container are intersected with the shape by nesting
  `data-container-mask-clip` inset-0 clip-path layers (each in the container's
  local frame) — frozen container masks emit a `MaskSnapshotLayer` sibling;
- a container that is the active `focusElementId` skips its wrapper so its
  children render in full (fully editable); nested containers stay clipped
  inside any unfocused ancestor;
- `handledInWrapper` prevents double-render even when a child's z < the
  container's z.

The wrapper is positioned at the container's scene origin, carries the
container's `zIndex`, and hosts a counter-translate layer returning children to
scene coordinates.

### 8.3 Background masks (scene-level cutout) — `Scene.tsx`

A mask drawn on empty canvas targets the `__background__` sentinel and is a
**scene-level cutout**: the `data-scene-mask-clip` wrapper holds the background
layer (`data-scene-background`), the grid and every element, so content added
AFTER the mask (new shapes/devices/images) is clipped too and can never leak
into the masked region. Multi-mask intersection via nested inset-0 layers,
mirroring ElementFacade's contract; frozen bg masks emit a `MaskSnapshotLayer`
sibling. Editor chrome that must stay interactive or export-stripped (guides,
watermark, context menu) renders outside the wrapper.

Background masks are exported at full opacity in exports via
`punchSceneMaskHoles` (Section 10), and the `data-scene-background` node
survives `background: 'scene'` exports.

### 8.4 Frozen content — `components/masks/MaskSnapshotLayer.tsx`

Paints `mask.snapshot` pixels inside the element's clip frame:

- container clipped to the mask's HIDDEN region
  (`buildMaskPunchClipPath(mask, targetWidth, targetHeight)`), with
  `background: transparent` so the live canvas can never leak through — the
  frozen pixels are the ONLY thing the masked region shows;
- the snapshot `<img>` placed at `sourceBounds` offset by the element's scene
  position (`elementX`/`elementY`) and sized to `sourceBounds` in scene units,
  so the captured region lines up with the element's box at render time (it
  moves/rotates with the facade, exactly like clip geometry).

Emits `data-element-mask-clip="true"` + `data-mask-snapshot="true"` so DOM
tests can count live wrappers via `[data-element-mask-clip]:not([data-mask-snapshot])`.

---

## 9. Frozen-mask capture — `services/mask-snapshot.ts`

`captureMaskSnapshot(bounds)` produces an immutable PNG freeze stamp of the
whole scene, cropped to the target's scene-space bounding box — the masked
region shows exactly what the canvas looked like at capture time, including
other layers, z-order, and the scene background.

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

Frozen masks are created ONLY via the PropertiesPanel Refresh action
(`refreshMaskSnapshot` in `maskSlice`). Auto-capturing at creation was
reverted: a snapshot taken at creation time captures the same canvas the user
is looking at, so the frozen pixels are pixel-identical to the live scene and
the freshly-drawn mask is invisible — the reported "the mask disappears on
mouse release" regression.

`refreshMaskSnapshot(maskId)`: finds the mask + its target, captures the target
box, no-ops (no history) when the mask/target is missing or capture returns
null, else `pushHistory('Refresh mask')` + `updateMask(maskId, { snapshot })`.

---

## 10. Export — `lib/export-engine.ts`

### 10.1 The problem

The scene DOM clips masks with `clip-path: polygon(… evenodd)` wrappers, which
the foreignObject capture silently ignores (probe-proven) — a shape inside a
masked region renders at full opacity in exports. The punch reproduces the
transparency hole on the raster deterministically.

### 10.2 `punchSceneMaskHoles(ctx, masks, canvasWidth, canvasHeight, scale)`

- Only background masks (target `__background__`) are punched. Element and
  container masks clip only their own facade — reproducing their hidden regions
  would require revealing content beneath them, which CSS clip-path does not do
  either — out of scope (documented decision).
- `destination-out` fill with `fillRule: 'evenodd'` erases exactly the masked
  region. Hidden-region semantics mirror `buildMaskClipPath`:
  - inverted (punch): path = shape + holes
  - non-inverted (reveal): path = box + shape + holes
- No-op / degenerate rings (empty outer) are skipped.
- Uses `maskOuterRing` — the same geometry source as the editor clip.

### 10.3 Scene-background preservation

For `background: 'scene'` exports with background masks present, the punched
hole must reveal the scene's own background layer — the content "under" the
mask — instead of a transparent void (which reads as the app surface, black in
dark mode / white in light mode, in preview and paste).

`captureSceneBackgroundNode(sceneNode, width, height, scale)` captures just the
`[data-scene-background]` layer: the bg node is re-homed inside a fixed,
scene-sized wrapper (the node is `absolute; inset: 0` and its renderers are
full-size absolute children, so the wrapper supplies the containing block),
`domToCanvas` with the same `scale`/`style` options as the main capture, then
`destination-over` `drawImage` under the punched capture — so only the hole
reveals the preserved background while everything above the mask stays hidden.

Gating:
- `'scene'` + bg masks → punch + background composite.
- `'solid'` → punch + `destination-over` fill with the requested color.
- `'transparent'` → punch only (hole stays transparent alpha).
- JPEG/WebP (no alpha) composite over black via the encoder — holes read as the
  background color instead of black.

Every export route (Preview/Save/Copy, and `exportAllScenes` per-scene) calls
`exportScene`, so the punch applies to all of them. Frozen-mask snapshots are
unhandled by the punch — a frozen mask's export behavior is a separate concern.

---

## 11. The Mask tool — `tools/tools/mask.ts`

Tool id `mask`, group `'mask'`, shortcut `G`, `options: true`, cursor
`crosshair`.

### 11.1 Pointer-down

- Primary button only.
- Hit on an element:
  - rejects non-maskable kinds and locked elements (`getCapabilities(...).maskable`);
  - focus-gates: an out-of-scope (dimmed) hit → `clearSelection()` + return;
  - resolves geometry via `resolveMaskGeometry` (extends
    `resolveElementGeometry` so textBoxes — maskable, but not bitmap targets —
    resolve to their box with `rotation: 0`);
  - `selectDirect(hit.id)` so the panel/mask section follows the stroke.
- Empty-canvas press targets the background via the sentinel (scene coords,
  origin 0,0, canvas dims, rotation 0) — the mask brush behaves like the paint
  brush. The background is never in the focus scope, so focus blocks it
  (returns, no selection change).
- Claims the pointer, pins a `PendingMask` (`{ pointerId, targetId, shape,
  inverted, element, anchor, last, points, radius }`), begins the `mask`
  interaction, pushes the preview.

`inverted = rt.maskMode === 'mask'` — 'mask' mode cuts the DRAWN region out of
the target (the shape becomes transparent); 'unmask' mode keeps the drawn
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
- Converts scene points to the target's local frame via `toLocalPoint(element,
  ZERO_ORIGIN, …)` — so rotated targets carve correctly.
- Computes the stroke:
  - brush → `buildMaskStrokePolygon(localPoints, pm.radius)` (radius =
    `rt.brush.size / 2`);
  - ellipse → `ellipseRing(...)`;
  - rect → `rectRing(...)`.
- **Mask mode (`inverted`)**: `commitLiveMask` — `pushHistory('Add mask')`
  BEFORE the mutation, then `addMask` with a fresh id. Additive: every stroke
  appends a fresh mask; strokes stack by clip-path intersection (re-drawing
  over an already-masked target adds a SECOND mask, never replacing).
  Committed LIVE (geometry-only, no snapshot) so the checkerboard stays
  visible right after mouse-up.
- **Unmask mode**: `resolveUnmaskCommit` against the target's masks in
  element-local coords; only when non-null → `pushHistory('Unmask')` +
  `replaceTargetMasks(targetId, commit)`. A no-op stroke changes nothing and
  pushes no history entry.

### 11.4 Cancel / interrupt

`onPointerCancel` clears the pending stroke + preview + interaction, no commit.
`onInterrupt` (Escape / window blur / manager reset) does the same via direct
runtime-store access — a stranded pending mask can never commit.

---

## 12. Runtime state — `runtimeSlice.ts`

```ts
interface MaskPreviewState {
  targetId: string
  shape: 'rectangle' | 'ellipse' | 'brush'
  points: { x: number; y: number }[]   // scene space
  element: { id: string; x: number; y: number; width: number; height: number; rotation: number }
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

**Checkerboard:** dark + blue squares exactly where the element is masked out.

```ts
CHECKER_DARK = '#000000'
CHECKER_BLUE = '#2563eb'
CHECKER_SIZE = 64   // one square's edge, scene units
```

`repeating-conic-gradient(dark 0% 25%, blue 0% 50%)` encodes a 2×2 checkerboard
per tile, so `backgroundSize = CHECKER_SIZE * 2` keeps each square exactly
64×64 scene units.

Rendering:
- per-element `data-mask-visual` rotation-matched wrapper at the target's
  scene origin;
- one `data-mask-checkerboard` layer per mask, clipped to `hiddenClipPath`
  (opacity 0.85 at rest, 1 while editing);
- `data-mask-visible-highlight` layers while editing (kept-region clip + inset
  ring, blue for punch, amber for inverted);
- SVG `MaskOutline` — dashed outlines + corner controls (amber for inverted,
  emphasized while editing); brush outlines draw `points` and each `holes`
  ring;
- while a stroke is in flight: `data-mask-edit-dim` (whole-canvas scrim punched
  to the target via `buildSceneDimPunch`), the live `MaskPreviewVisual`
  (checkerboard for mask strokes, green "restore" highlight for unmask — a
  subtractive stroke masks nothing), and a `data-mask-edit-badge`
  ("Hide mask" / "Unmask" by mode).

`MaskOverlay` is rendered unconditionally by `OverlayRenderer` with
`visuals={collectMaskVisuals(scene)}` — committed masks show their checkerboard
permanently.

### 13.2 PropertiesPanel mask section

Per-mask row (masks filtered by the selected element's `targetId`):
shape/inverted label + three controls — **Reverse** (`reverseMask`, toggles
inverted), **Freeze**↔**Refresh** (`refreshMaskSnapshot`; shows "Freeze" when
the mask has no snapshot, "Refresh" when frozen), **Remove** (`removeMask`).
Plus "Add Mask" (full-bounds `maskElement`) and "Clear all masks"
(`pushHistory('Clear masks')` → `removeMaskFromElement(selected.data.id)`).
Every operation pushes history BEFORE the mutation; `maskElement` is a
non-inverted (reveal) full-bounds mask — the legacy whole-canvas checkerboard
source, recoverable via unmask (Section 7.5).

### 13.3 ToolOptionsPanel mask options

- Shape buttons: Rect / Ellipse / Brush (`MASK_SHAPES`).
- Mode buttons: Mask / Unmask (`MASK_MODES`).
- Brush radius slider (1–120px) when `maskShape === 'brush'` (writes
  `brush.size`).
- "Clear masks" danger button (`pushHistory('Clear masks')` →
  `clearAllMasks()`), so stale canvas/background masks are removable without
  selecting anything.

---

## 14. Store — `store/maskSlice.ts`

| Action | Behavior |
|---|---|
| `addMask(mask)` | appends to the active scene |
| `updateMask(id, patch)` | merges a partial patch |
| `removeMask(id)` | deletes by id |
| `maskElement(id, geometry)` | creates a full-bounds rectangle reveal mask |
| `removeMaskFromElement(id)` | clears every mask on the target |
| `reverseMask(id)` | toggles `inverted` |
| `replaceTargetMasks(targetId, masks)` | filters the target's masks then splices the residual list in one immutable update — the commit boundary for a subtractive unmask stroke (one history entry) |
| `clearAllMasks()` | empties the active scene's `masks` incl. the background sentinel |
| `refreshMaskSnapshot(maskId)` | re-captures a frozen snapshot (Section 9) |

All mutators are pure immutable `set` updates on `scenes[activeSceneIndex]`.
History is the caller's responsibility (`pushHistory` BEFORE the mutation).

---

## 15. Serialization — `lib/project-serialization.ts`

`SerializedScene.masks?: SerializedMask[]` — each round-trips `id`, `targetId`,
`shape`, `x/y/width/height`, `points`, `inverted`, optional `holes`, and
optional `snapshot`. The snapshot's `dataUrl` is walked through the asset
walker (`asset://img-*.png` and back), so a frozen capture survives `.mockup`
save/load. Deserialization reads `masks: scene.masks ?? []` (legacy files
predate masks), and `holes`/`snapshot` are legacy-absent (no hydration logic).

`regionToMask` (mask-diff) copies a source mask's `snapshot` onto carved
residuals, so unmasking a frozen mask keeps showing frozen content.

---

## 16. Clipboard

`ClipboardEntry` carries `masks: Mask[]`; copy/cut clones masks matching each
copied target; paste re-adds each with `{ ...m, id: generateId(), targetId:
newId }`. Masks ride along with their elements.

---

## 17. Test coverage

Contract tests live in `src/__tests__/`:

| File | Coverage |
|---|---|
| `mask.test.ts` | clip-path builders, `collectMaskVisuals` (per kind, background, frozen skip), maskSlice CRUD, serialization round-trip + legacy, tool behaviors (rect/ellipse/brush, additive re-draw, unmask carve/cover/reveal-recovery/box-clear, sub-3px click, locked, textBox, focus gating, non-primary, undo, pointer-cancel) |
| `mask-diff.test.ts` | ring builders, `resolveUnmaskCommit` (no-ops, carve with hole, split, full cover, reveal erasure, reference preservation, coincident-hole no-op, clip-path hole contours, box-covering single contour), `ringCoversBox` |
| `maskBrush.test.ts` | capsule for 2-point stroke, corner regression (both flanks), U-turn, smooth-curve flanks, single-point circle |
| `maskOverlay.test.tsx` | checkerboard color contract, per-mask clipped layers, rotation, scrim/badge/preview, badge label by mode, nested evenodd contours, background/canvas mask visual, scene-level bg clip (export-node isolation), end-to-end canvas-mask-then-shape clipping, textBox targeting, never leaks into export node |
| `maskSnapshot.test.ts` | live geometry-only commit (no snapshot), `refreshMaskSnapshot` re-capture/undo, capture-fail no-op, unknown-id no-op, background-sentinel canvas-box capture |
| `containerClip.test.tsx` | container clip wrappers, multi-mask nesting, frozen snapshot layers in facades |
| `polygon-clip.test.ts` | boolean difference engine (contained clip → hole, split, full cover, disjoint, annulus sever, re-entrant fold) |

---

## 18. Contract summary (the rules that must not break)

1. **Geometry is local**: element masks store local-frame coords; only the
   background sentinel uses scene coords. Scene→local conversion happens once
   in the tool via `toLocalPoint` (inverse-rotate around the element center).
2. **Hidden region is the single source of truth**: inverted → `shape ∖ holes`;
   non-inverted → `box ∖ shape ∖ holes`; used identically by clip builder,
   overlay, diff engine, and export punch.
3. **History BEFORE mutation**, always, one entry per committed stroke/action.
4. **Additive mask / subtractive unmask**: mask mode appends fresh masks
   (compose by intersection); unmask mode rewrites via `resolveUnmaskCommit`
   and returns `null` (no history) when nothing is erased.
5. **Frozen snapshots are Refresh-only**: capture at creation is invisible
   (pixel-identical to the live canvas) and was reverted; live-by-default is
   the contract.
6. **Export punch scope**: only background masks; the scene background is
   composited beneath the punch for `'scene'` exports so the hole preserves the
   area under the mask.
7. **Overlay is export-clean by structure**: MaskOverlay is a sibling of
   `[data-scene-export]`; the export clone strips `data-watermark`/`data-guide`
   and never sees the overlay.
8. **Box-covering masks are single-contour**: `ringCoversBox` guards both the
   renderer (no self-cancelling evenodd double contour) and the unmask resolver
   (drop box-covering residuals).
9. **Tools never touch the DOM**: geometry is pure functions over store/runtime
   state; the only DOM the mask path touches is the snapshot capture service.
