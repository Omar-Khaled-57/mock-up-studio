# Core Types

**File:** `src/shared/types.ts`

The single source of truth for all data models, imported by both the Electron main process and the renderer via the `@shared/*` path alias. Contains 331 lines of pure interface definitions with zero implementation.

---

## Core Model Hierarchy

```
Project
  └─ Scene[]
       ├─ CanvasSettings
       ├─ Background
       ├─ devices: Device[]      ← device frames with screen images
       ├─ textBoxes: TextBox[]   ← styled text (heroes are first-class)
       ├─ images: ImageOverlay[] ← imported/raster images
       � ├── shapes: Shape[]      ← SVG shapes (rect, circle, star, etc.)
       ├─ guides: Guide[]
       ├─ GridSettings
       ├─ groups: ElementGroup[] (flat, parentGroupId links)
       └─ masks: Mask[]          ← first-class reusable masks
```

All element kinds share core fields: `id`, `name`, `visible`, `locked`, `x/y/width/height`, `rotation`, `zIndex`, `groupId`, `containerId`. The `lockAspectRatio` field appears on Device, ImageOverlay, and Shape (deliberately absent on TextBox).

---

## Project

```typescript
interface Project {
  id: string              // UUID
  name: string            // User-facing project name
  createdAt: string       // ISO timestamp
  updatedAt: string       // ISO timestamp
  scenes: Scene[]         // Multi-scene: every tab/document is a Scene
  activeSceneIndex: number
  filePath?: string       // OS path after save (absent for new/untitled)
}
```

**Multi-scene:** The app supports multiple scenes (tabs). Each is fully independent (its own canvas, elements, masks). `activeSceneIndex` selects the current one. Pinned scenes are included in multi-scene export; unpinned are excluded.

---

## Scene

```typescript
interface Scene {
  id: string
  name: string
  pinned: boolean           // User wants version history + multi-scene export
  canvas: CanvasSettings
  background: Background
  devices: Device[]
  textBoxes: TextBox[]      // Heroes (title/slogan) live here as stylePreset
  images: ImageOverlay[]
  shapes: Shape[]
  guides: Guide[]
  grid: GridSettings
  groups: ElementGroup[]   // Flat list with parentGroupId (hierarchical)
  masks: Mask[]             // First-class reusable masks
}
```

**Heroes:** The title/slogan text boxes are first-class `TextBox` entries tagged `stylePreset: 'title' | 'slogan'` — NOT bespoke scene fields. This means they participate in z-order, selection, drag, resize, grouping, masking, and clipboard like any other text box. The only special handling is that `CanvasEmptyState` counts only `stylePreset === 'custom'` boxes when checking if the canvas is empty.

---

## CanvasSettings

```typescript
interface CanvasSettings {
  width: number              // Scene canvas width in scene units
  height: number             // Scene canvas height in scene units
  aspectRatio: string        // '16:9', '1:1', '4:3', 'portrait', 'custom' — for resize preservation
}
```

Default: `{ width: 1280, height: 720, aspectRatio: '16:9' }`. The `aspectRatio` string determines how CanvasPresetsPanel's "Rotate 90°" behaves — it swaps width/height and updates the aspectRatio label.

---

## Background

```typescript
interface Background {
  type: 'solid' | 'gradient' | 'image' | 'preset'
  color?: string            // For 'solid' type
  gradient?: {
    type: 'linear' | 'radial'
    colors: { stop: number, color: string }[]  // Stop positions 0-100
    angle: number            // Linear gradient angle (degrees)
    radialShape?: 'circle' | 'ellipse'
  }
  image?: {
    src: string             // data URL
    blur: number
    dim: number             // 0-1 overlay opacity
    overlayColor: string
  }
  presetName?: BackgroundPresetName  // 'aurora' | 'neon-grid' | 'blue-cyber' | 'q-preset' | 'qless' | 'storybox3' | 'dark-solid'
  transparent?: boolean     // When true, BackgroundRenderer returns null — editor shows checkerboard
}
```

**Transparent contract:** When `background.transparent` is true, `BackgroundRenderer` returns `null` — only `[data-scene-background]` (the empty wrapper) exists. The editor renders a black/blue checkerboard (`[data-transparent-checker]`) as editor chrome. The export engine carries real alpha (the checkerboard is stripped from exports). `color`/`gradient`/etc. fields are **ignored** while transparent.

Applying a theme preset rebuilds the Background object without `transparent`, which is the intended "opt back into a visible background" behavior.

**BackgroundPresetName:** Exported from `constants.ts`, not `types.ts` (per the key decisions in AGENTS.md).

---

## Device

```typescript
interface Device {
  id: string
  type: 'monitor' | 'laptop' | 'ipad' | 'phone' | 'watch' | 'browser' | 'terminal'
  name: string              // "Monitor 1", "Laptop 2", etc.
  visible: boolean
  locked: boolean
  x: number
  y: number
  width: number
  height: number
  rotation: number          // 0, 90, 180, 270 (degrees)
  zIndex: number
  colorTheme: 'dark' | 'light' | 'space-gray' | 'midnight' | 'custom'
  customBezelColor?: string   // When colorTheme === 'custom'
  customBorderColor?: string  // When colorTheme === 'custom'
  screenImage?: string        // data URL of the device screenshot
  objectFit: 'contain' | 'cover' | 'stretch'  // stretch → CSS object-fit: fill
  customFrame?: CustomFrame   // SVG path + screen region inset
  groupId?: string            // Element group membership
  containerId?: string        // Parent container element (clipping parent)
  lockAspectRatio?: boolean   // When true, resize preserves current box aspect
}
```

**Device types:** 7 device kinds, each with a specific shell component (`Monitor`, `Laptop`, `Phone`, `Ipad`, `Watch`, `Browser`, `Terminal`). Each has a default width/height ratio from `DEVICE_ASPECT_RATIOS`.

**Custom frame:** `CustomFrame { svgPath: string, screenRegion: { top, bottom, left, right } }` — allows non-rectangular device shells with inset screen regions. Used by some device types.

**Screen region insets** (per device type, in `bitmap-targets.ts`):
- Monitor: top 4%, bottom 3% (min 12px/8px, bottom fixed 9px)
- Laptop: top 2.76%, bottom 0.92%
- iPad: top 3%, bottom 2%
- Phone: top 2%, bottom 1.5%
- Watch: 18.8% all sides
- Browser/Terminal: top 8%

---

## TextBox

```typescript
interface TextBox {
  id: string
  name: string
  content: string             // The text content
  x: number
  y: number
  width: number
  height: number
  heightAuto: boolean         // When true, height is content-driven
  wrap: boolean               // pre-wrap (true) vs nowrap+ellipsis (false)
  fontSize: number            // px
  fontFamily: string
  fontWeight: number          // 100-900
  color: string               // Text color
  textAlign: 'left' | 'center' | 'right' | 'justify'
  lineHeight: number          // Multiplier (default 1.1)
  letterSpacing: number       // em units
  wordSpacing: number         // em units
  textTransform: 'none' | 'uppercase' | 'lowercase' | 'capitalize'
  strokeColor?: string        // Text outline color
  strokeWidth?: number        // Text outline width
  gradient?: TextGradient    // Linear gradient fill
  glow?: TextGlow            // Single-layer glow
  shadow?: TextShadow        // Single-layer shadow
  visible: boolean
  locked: boolean
  backgroundVisible: boolean
  backgroundColor: string
  borderRadius: number
  borderVisible: boolean
  borderColor: string
  stylePreset: 'custom' | 'title' | 'slogan'  // Hero text box marker
  zIndex: number
  rotation: number
  groupId?: string
  containerId?: string
  // Note: NO lockAspectRatio field
}
```

**Hero text:** Seeded by `createDefaultScene` with `stylePreset: 'title'` (z-index 1, y=60, h=72) and `stylePreset: 'slogan'` (z-index 0, y=152, h=36). Both at x=60, width = `max(320, canvasW * 0.5)`, `textAlign: 'left'`, `wrap: true`.

**Height auto:** When `heightAuto` is true, the facade `height` is `undefined` and CSS `height: fit-content` is used. The element is still selectable and draggable but its height grows/shrinks with content.

---

## ImageOverlay

```typescript
interface ImageOverlay {
  id: string
  name: string              // "Image 1" (imported) or "Paint N" (paint layer)
  src: string               // data URL
  x: number
  y: number
  width: number
  height: number
  rotation: number          // degrees
  opacity: number          // 0-1
  borderRadius: number
  blendMode: BlendMode     // 13 CSS blend modes (default 'normal')
  flipX: boolean
  flipY: boolean
  blur: number             // CSS blur radius
  glow: GlowLayer[]
  shadow: ShadowLayer[]
  zIndex: number
  locked: boolean
  visible: boolean
  groupId?: string
  containerId?: string
  effects?: ImageEffects   // Non-destructive per-element effects
  lockAspectRatio?: boolean
}
```

**BlendMode:** All 13 CSS composite modes: `source-over`, `source-in`, `source-out`, `source-atop`, `destination-over`, `destination-in`, `destination-out`, `destination-atop`, `lighter`, `copy`, `xor`, `multiply`, `screen`, `overlay`, `darken`, ` lighten`, `color-dodge`, `color-burn`, `hard-light`, `soft-light`, `difference`, `exclusion`, `hue`, `saturation`, `color`, `luminosity`.

**Paint layers:** `ImageOverlay` entries whose `name` starts with `'Paint '` are paint layers (created by the Paint Brush tool). `isPaintLayer` checks the name prefix — these are filtered out of the ImagesPanel and get friendly sequential names.

**objectFit rendering:** ALWAYS renders with `objectFit: 'fill'` (CSS `object-fit: fill`) so the image always fills its box, matching the box's aspect ratio. The `objectFit` type field supports `contain | cover | stretch` but the renderer always uses `fill` for WYSIWYG consistency.

---

## Shape

```typescript
interface Shape {
  id: string
  kind: ShapeKind          // 13 shape variants
  name: string
  x: number
  y: number
  width: number
  height: number
  rotation: number         // degrees
  opacity: number          // 0-1
  color: string            // Fill color
  gradient?: ShapeGradient // Linear/radial gradient fill
  blur: number             // CSS blur radius
  glow: GlowLayer[]
  shadow: ShadowLayer[]
  zIndex: number
  locked: boolean
  visible: boolean
  cornerRadius: number     // For rect-like shapes
  backgroundImage?: string // data URL, renders as SVG <pattern>
  angles?: [number, number] // For star shapes (outer/inner point angles)
  crossThickness?: number
  plusThickness?: number
  arrowThickness?: number
  groupId?: string
  containerId?: string
  effects?: ImageEffects
  lockAspectRatio?: boolean
}
```

**ShapeKind** (13 variants): `rectangle`, `circle`, `triangle`, `hexagon`, `diamond`, `parallelogram`, `trapezoid`, `cross`, `plus`, `heart`, `shield`, `arrow-right`, `star`.

**Star angles:** `[outerPointAngle, innerPointAngle]` in degrees (default `[27.5, 68.5]`).

**Shape thickness modifiers:** `crossThickness`, `plusThickness`, `arrowThickness` control the arm width for cross/plus/arrow shapes (as a fraction of the element size).

**Background image:** Renders as an SVG `<pattern>` with `<image>` element, clipped to the shape path. The image fills the shape bounds and rotates with it.

---

## Mask

```typescript
interface Mask {
  id: string
  targetId: string         // References the element being masked (or '__background__')
  shape: MaskShape         // 'rectangle' | 'ellipse' | 'brush'
  x: number                // Element-local coordinates (rotated frame)
  y: number
  width: number
  height: number
  points?: MaskPoint[]     // Brush-freeform polygon vertices (local)
  inverted: boolean        // true = punch (drawn region transparent)
  holes?: MaskPoint[][]    // Restored regions carved out (from subtractive unmask)
  snapshot?: MaskSnapshot  // Frozen whole-scene capture
}
```

**targetId:** References elements by ID. Elements never know their masks — masks are queried by `targetId` in the renderer and overlay. The `BACKGROUND_MASK_TARGET_ID = '__background__'` sentinel targets the whole canvas.

**Local coordinate frame:** `x/y/width/height/points` are in the target element's local frame (origin 0,0, unrotated). This is critical: the mask clip rotates with the element because the facade applies `transform: rotate(...)` on the same root. The renderer builds the clip-path in local coords and applies it via the facade's rotation.

**Inverted polarity:**
- `inverted: true` → punch: the drawn region becomes transparent (checkerboard shows).
- `inverted: false` → reveal: the drawn region stays visible, rest is checkerboarded.

**Additive masking:** Every `mask`-mode stroke adds a fresh mask (`addMask`), so strokes stack by clip-path intersection. No replace-in-place after the first stroke.

**Subtractive unmask:** `unmask` mode uses `resolveUnmaskCommit` → `differenceRegion` (polygon boolean) to compute the residual masks. Residuals are always inverted brush masks.

**Holes:** Carved-out restored regions from subtractive unmask strokes. Rendered as nested evenodd contours in the CSS clip-path (`polygon(outer, hole1, hole2, ..., evenodd)`).

---

## MaskSnapshot

```typescript
interface MaskSnapshot {
  dataUrl: string         // PNG data URL of the captured scene
  width: number           // Capture dimensions (scene canvas size)
  height: number
  sourceBounds: {        // Target element's scene-space bounds at capture
    x: number, y: number, width: number, height: number
  }
  capturedAt: number      // ISO timestamp
}
```

**Frozen masks:** When a mask has a `snapshot`, it renders the captured scene pixels (via `MaskSnapshotLayer`) instead of the live checkerboard. The snapshot is cropped to the target's scene-space bounds at capture time. Refresh via the PropertiesPanel's "Refresh" button calls `refreshMaskSnapshot`.

**Asset serialization:** The `dataUrl` is walked by `project-serialization.ts`'s asset extractor — it's saved as `asset://img-N.png` in the ZIP and restored on load.

---

## MaskPoint

```typescript
type MaskPoint = [number, number]  // [x, y] tuple — compact storage
```

Used in `Mask.points` (brush-freeform vertices), `Mask.holes` (restored region rings), and serialization. Stored as tuples (not objects) for compactness.

---

## MaskShape

```typescript
type MaskShape = 'rectangle' | 'ellipse' | 'brush'
```

The shape of the current mask stroke. `'brush'` uses `buildMaskStrokePolygon` for the capsule outline. `'rectangle'` and `'ellipse'` build their rings from two corner points.

---

## MaskMode

```typescript
type MaskMode = 'mask' | 'unmask'
```

The active mask tool mode. `'mask'` = inverted punch (draw to hide). `'unmask'` = non-inverted reveal (draw to restore). Controlled by the ToolOptionsPanel toggle when the Mask tool is active.

---

## ImageEffects

```typescript
interface ImageEffects {
  brightness: number      // 0-200, 100 = neutral
  contrast: number        // 0-200, 100 = neutral
  exposure: number        // 0-200, 100 = neutral
  saturation: number      // 0-200, 100 = neutral
  hue: number             // -180 to 180, 0 = neutral
  gamma: number           // 50-200, 100 = neutral
  temperature: number     // -100 to 100, 0 = neutral
  tint: number            // -100 to 100, 0 = neutral
  blur: number            // 0-30px, 0 = neutral
}
```

**Neutral scale:** Linear adjustments (brightness, contrast, exposure, saturation, gamma) use 100 = neutral. Bipolar adjustments (hue, temperature, tint) use 0 = neutral. `blur` uses 0 = no blur.

**CSS composition:** Each non-neutral field emits a CSS filter term. `gamma` decomposes to `brightness(G) contrast(2-G)`. `temperature`/`tint` use sepia + hue-rotate compositions.

**Legacy:** Optional field — legacy `.mockup` files load with `effects: undefined` (neutral). No hydration logic needed.

---

## ShadowLayer / GlowLayer

```typescript
interface ShadowLayer {
  enabled: boolean
  color: string              // '#RRGGBB' or 'rgba(...)'
  blur: number               // px
  spread: number             // px (outset/inset)
  opacity: number            // 0-1
  inset: boolean             // CSS inset box-shadow (vs outset)
  x: number                  // px offset
  y: number                  // px offset
}

interface GlowLayer {
  enabled: boolean
  color: string
  blur: number               // px
  opacity: number            // 0-1
}
```

**Multi-layer:** Arrays allowing multiple shadows/glows per element. Applied via CSS `filter` (shapes via SVG `feDropShadow`, images via CSS `drop-shadow()`).

---

## ElementGroup

```typescript
interface ElementGroup {
  id: string
  name: string              // "Group 1" — editable via triple-click rename
  childIds: string[]        // Direct members (NOT recursive)
  parentGroupId?: string    // For nesting (hierarchical groups)
}
```

**Flat list with parent links:** Groups form a tree via `parentGroupId`. `getDescendantGroupIds` recursively collects nested group ids (cycle-safe). Focus mode uses this for subtree resolution.

**Group-aware selection:** `select(id)` resolves the element's `groupId` → selects all `childIds`. Multi-select toggles within the group.

**Group roles:** Groups enable:
- Focus scoping (enter/exit group edit mode)
- Align/distribute across group members
- Rename as a unit
- Nesting/un-nesting via drag-to-nest
- Lock/visibility at the group level (via member properties)

---

## Guide

```typescript
interface Guide {
  id: string
  orientation: 'horizontal' | 'vertical'
  position: number          // Scene coordinate
}
```

**Persistent guides:** User-placed via ruler drag. Stored in `Scene.guides[]`. Interactive: drag-to-move, right-click-to-delete. In the export node (so they appear in exports — a feature, not a bug: guides define the user's alignment intent).

**Transient guides:** Snap guides from `useSnapping` → `runtime.snapGuides`. Rendered by `OverlayRenderer > Guides` (export-clean, `data-snap-guide`).

---

## GridSettings

```typescript
interface GridSettings {
  enabled: boolean
  size: number              // Scene units per grid cell (default 50)
  color: string             // Theme-dependent
  opacity: number           // 0-1 (default 1)
  snapEnabled: boolean      // Grid snap (independent of smart guides)
  style: 'dots' | 'lines'
}
```

**Independent toggles:** Grid visibility (`enabled`) and grid snapping (`snapEnabled`) are separate. Smart guides and grid snap are separate toggles (per the v0.3.0 redesign). Grid snap requires `snapEnabled && size > 0`.

---

## CanvasSettings

```typescript
interface CanvasSettings {
  width: number              // Scene canvas width in scene units
  height: number             // Scene canvas height in scene units
  aspectRatio: string        // '16:9', '1:1', '4:3', 'portrait', 'custom'
}
```

Used by the canvas presets panel, export engine (canvas dimensions), and the empty state ("Build your first mockup"). The `aspectRatio` string is informational — it's preserved through canvas preset changes but doesn't enforce anything.

---

## BlendMode

```typescript
type BlendMode =
  | 'source-over' | 'source-in' | 'source-out' | 'source-atop'
  | 'destination-over' | 'destination-in' | 'destination-out' | 'destination-atop'
  | 'lighter' | 'copy' | 'xor'
  | 'multiply' | 'screen' | 'overlay' | 'darken' | 'lighten'
  | 'color-dodge' | 'color-burn' | 'hard-light' | 'soft-light'
  | 'difference' | 'exclusion'
  | 'hue' | 'saturation' | 'color' | 'luminosity'
```

Applied to `ImageOverlay` via CSS `mix-blend-mode` on the `<img>` element.

---

## DeviceType

```typescript
type DeviceType = 'monitor' | 'laptop' | 'ipad' | 'phone' | 'watch' | 'browser' | 'terminal'
```

Each maps to a shell component via `DEVICE_COMPONENTS[type]`. Default dimensions come from `DEVICE_DEFAULTS[type]` (monitor 520, laptop 420, ipad 280, phone 160, watch 90, browser 480, terminal 400). Aspect ratios from `DEVICE_ASPECT_RATIOS[type]`.

---

## ColorTheme

```typescript
type ColorTheme = 'dark' | 'light' | 'space-gray' | 'midnight' | 'custom'
```

Resolved via `resolveThemeColors(theme, customBezelColor?, customBorderColor?)` → `{ bezel, border }`. The `THEME_COLORS` map in `device-utils.ts` provides the palette.

---

## BackgroundPresetName

```typescript
type AnimatedPreset = 'aurora' | 'neon-grid' | 'blue-cyber'
type StaticPreset = 'q-preset' | 'qless' | 'storybox3' | 'dark-solid'
type BackgroundPresetName = AnimatedPreset | StaticPreset
```

**Exported from `constants.ts`, not `types.ts`** (per the key decisions). Consumed by `BackgroundRenderer` dispatch and the ThemesPanel preset gallery.

---

## ElementKind / SceneElementKind

```typescript
type ElementKind = 'device' | 'textbox' | 'image' | 'shape'
type SceneElementKind = ElementKind  // alias
```

Used throughout the codebase for kind-dispatched logic (hit-test, selection, z-order, capabilities, update dispatch, etc.).

---

## Serialized Types

**File:** `src/renderer/lib/project-serialization.ts`

All `Serialized*` interfaces are structurally identical to their live counterparts but with optional fields (for backward compatibility with older `.mockup` versions). Key differences:

- `SerializedImage` has `src?: string` and `effects?: ImageEffects` (optional).
- `SerializedShape` has `backgroundImage?: string | null` and `effects?: ImageEffects` (optional).
- `SerializedMask` has `holes?: MaskPoint[][]`, `snapshot?: MaskSnapshot` (optional).
- `SerializedScene` has `masks?: Mask[]` (defaults to `[]` if absent — legacy files).
- `SerializedProject` has `activeSceneIndex?: number` (defaults to 0 if absent).

**One-way migrations:**
- Legacy `titleText`/`sloganText` → `textBoxes[]` with `stylePreset: 'title'|'slogan'`. Legacy keys are deleted on restore so re-save never re-migrates.
- Legacy single-object `shadow`/`glow` → array format.
- Legacy `objectFit: 'stretch'` → CSS `object-fit: fill`.

**Asset references:** Data URLs in `screenImage`, `src`, `backgroundImage`, `image.src`, `mask.snapshot.dataUrl` are replaced with `asset://<filename>` references during serialization and restored on deserialization. The `asset://` → data URL conversion uses the binary buffers stored in the ZIP's `assets/` directory.

---

## BrushOptions / Runtime Types

**File:** `src/renderer/runtime/runtimeSlice.ts`

```typescript
interface BrushOptions {
  size: number              // px (default 24, range 1-120)
  hardness: number          // 0-1 (default 0.6, affects blur radius / erase softness / tolerance)
  color: string             // Hex color (default '#6366f1')
  shape: 'round' | 'square' | 'soft' | 'pixel'  // (default 'round')
  opacity: number           // 0-1 (default 1)
}
```

**Purpose:** Controls the paint brush, eraser, blur, and mask brush appearance. `hardness` is repurposed per tool (see the respective tool docs). Survives transient reset; resets to defaults on full reset.

```typescript
interface InteractionDescriptor {
  toolId: string
  pointerId: number
  kind: 'move' | 'resize' | 'pan' | 'marquee' | 'paint' | 'mask' | 'blur' | 'unmask'
  startedAt: number         // performance.now()
}
```

**Purpose:** Tracks active gestures for cursor management and interaction state.

```typescript
interface MaskPreviewState {
  element: ElementGeometry  // scene-space geometry of the mask target
  shape: MaskPreviewShape   // 'rectangle' | 'ellipse' | 'brush'
  inverted: boolean         // mask/unmask polarity
  radius?: number           // brush radius (brush mode only)
}
```

**Purpose:** Live mask stroke visualization for the `MaskOverlay` renderer.

```typescript
interface PreviewState {
  style?: PreviewStyle      // Base style (fill/stroke/etc.)
  visuals: PreviewVisual[]   // Geometry + per-visual style overrides
}

type PreviewVisual = PreviewGeometry & { style?: PreviewStyle }
type PreviewGeometry =
  | { type: 'rect'; x: number; y: number; width: number; height: number; source?: GhostBounds }
  | { type: 'ellipse'; x: number; y: number; width: number; height: number }
  | { type: 'line'; x: number; y: number; x2: number; y2: number }
```

**Purpose:** Data-driven preview system for ghost transform indicators and blur region previews. Rendered by `PreviewSurface` (imperative canvas, subscription-driven).

```typescript
interface GhostBounds {
  id: string                // Element id the ghost targets
  x: number
  y: number
  width: number
  height: number
  rotation?: number
}
```

**Purpose:** The ghost carries the element `id` so `resolveLiveGhost(preview, elementId)` can match it — this is the shared live-transform read by the selection chrome and shape facades for WYSIWYG live geometry.
