export interface Project {
  id: string
  name: string
  createdAt: number
  updatedAt: number
  scenes: Scene[]
  activeSceneIndex: number
}

export interface Scene {
  id: string
  name: string
  pinned: boolean
  canvas: CanvasSettings
  background: Background
  devices: Device[]
  textBoxes: TextBox[]
  images: ImageOverlay[]
  shapes: Shape[]
  guides: Guide[]
  grid: GridSettings
  groups: ElementGroup[]
  masks: Mask[]
}

export interface TextGradient {
  enabled: boolean
  color1: string
  color2: string
  angle: number
}

export interface TextGlow {
  enabled: boolean
  color: string
  blur: number
}

export interface TextShadow {
  enabled: boolean
  color: string
  offsetX: number
  offsetY: number
  blur: number
}

export interface CanvasSettings {
  width: number
  height: number
  aspectRatio: string
}

export interface ElementGroup {
  id: string
  name: string
  childIds: string[]
  parentGroupId: string | null
}

export interface Device {
  id: string
  type: 'monitor' | 'laptop' | 'ipad' | 'phone' | 'watch' | 'browser' | 'terminal' | 'custom'
  name: string
  visible: boolean
  locked: boolean
  x: number
  y: number
  width: number
  height: number
  rotation: number
  zIndex: number
  colorTheme: 'dark' | 'light' | 'space-gray' | 'midnight' | 'custom'
  customBezelColor?: string
  customBorderColor?: string
  screenImage: string | null
  objectFit: 'contain' | 'cover' | 'stretch'
  customFrame?: {
    svgData: string
    screenRegion: { x: number; y: number; w: number; h: number }
  }
  groupId: string | null
  containerId: string | null
  /** When true, resize/numeric-size edits preserve the current width/height aspect ratio. */
  lockAspectRatio?: boolean
}

export interface TextBox {
  id: string
  name: string
  content: string
  x: number
  y: number
  width: number
  height: number
  heightAuto: boolean
  wrap: boolean
  fontSize: number
  fontFamily: string
  fontWeight: number
  textAlign: 'left' | 'center' | 'right'
  lineHeight: number
  letterSpacing: number
  wordSpacing: number
  textTransform: 'none' | 'uppercase' | 'lowercase' | 'capitalize'
  strokeColor: string
  strokeWidth: number
  color: string
  gradient: TextGradient | null
  glow: TextGlow | null
  shadow: TextShadow | null
  visible: boolean
  backgroundVisible: boolean
  backgroundColor: string
  borderVisible: boolean
  borderColor: string
  borderRadius: number
  stylePreset: 'custom' | 'title' | 'slogan'
  zIndex: number
  locked: boolean
  groupId: string | null
  containerId: string | null
}

export type BlendMode = 'normal' | 'multiply' | 'screen' | 'overlay' | 'darken' | 'lighten' | 'color-dodge' | 'color-burn' | 'hard-light' | 'soft-light' | 'difference' | 'exclusion'

/**
 * Non-destructive per-element image effects. Linear adjustments use a
 * normalized range with 100 = neutral (0–200); bipolar axes (hue,
 * temperature, tint) use 0 = neutral; blur uses 0 = neutral (px).
 * Gamma/temperature/tint are CSS approximations (architecture §11).
 */
export interface ImageEffects {
  brightness: number
  contrast: number
  exposure: number
  saturation: number
  hue: number
  gamma: number
  temperature: number
  tint: number
  blur: number
}

export interface ImageOverlay {
  id: string
  name: string
  src: string
  x: number
  y: number
  width: number
  height: number
  rotation: number
  opacity: number
  borderRadius: number
  blendMode: BlendMode
  flipX: boolean
  flipY: boolean
  blur: number
  glow: GlowLayer[]
  shadow: ShadowLayer[]
  zIndex: number
  locked: boolean
  visible: boolean
  groupId: string | null
  containerId: string | null
  effects?: ImageEffects
  /** When true, resize/numeric-size edits preserve the current width/height aspect ratio. */
  lockAspectRatio?: boolean
}

export interface Background {
  type: 'solid' | 'gradient' | 'image' | 'preset'
  color?: string
  gradient?: {
    type?: 'linear' | 'radial' | 'conic'
    colors: string[]
    angle: number
    radialShape?: 'circle' | 'ellipse'
  }
  image?: {
    src: string
    blur: number
    dim: number
    overlayColor: string
  }
  presetName?: string
  /** When true the scene background is fully transparent (checkerboard in the
   * editor, real alpha in exports). The `background` type/color fields are
   * ignored and treated as absent. */
  transparent?: boolean
}

export interface Guide {
  id: string
  orientation: 'horizontal' | 'vertical'
  position: number
}

export interface GridSettings {
  enabled: boolean
  size: number
  color: string
  /** Grid opacity multiplier (0–1) applied on top of the color's own alpha. */
  opacity: number
  snapEnabled: boolean
  style: 'dotted' | 'lines'
}

export type ShapeKind = 'rectangle' | 'circle' | 'ellipse' | 'triangle' | 'star' | 'hexagon' | 'diamond' | 'parallelogram' | 'trapezoid' | 'cross' | 'plus' | 'heart' | 'arrow-right'

export interface ShapeGradient {
  enabled: boolean
  colors: string[]
  angle: number
  type?: 'linear' | 'radial' | 'conic'
  radialShape?: 'circle' | 'ellipse'
}

export interface ShadowLayer {
  enabled: boolean
  color: string
  offsetX: number
  offsetY: number
  blur: number
  spread: number
  opacity: number
  inset: boolean
}

export interface GlowLayer {
  enabled: boolean
  color: string
  blur: number
  spread: number
  opacity: number
}

export type MaskShape = 'rectangle' | 'ellipse' | 'brush'

export interface MaskPoint {
  x: number
  y: number
}

/**
 * A first-class, reusable scene mask rendered as a clip layer over the canvas.
 * Masks are independent layers (like devices/images/text boxes/shapes): they
 * own a `name`, participate in z-order (`zIndex`), and honor `visible`/`locked`.
 * A mask has NO target element — `x/y/width/height/points` are SCENE-space
 * coordinates (canvas units), so the clip aligns with the canvas at render time.
 *
 * `x/y/width/height` define the bounding box for rectangle/ellipse masks and the
 * bounds of a brush (freehand) mask; `points` carries the brush polygon.
 * `inverted` toggles punch (inverse) rendering via evenodd clip-path
 * compositing: an inverted mask hides its shape region, a non-inverted (reveal)
 * mask hides the rest of its box.
 *
 * `holes` (restored areas) appears on brush masks after subtractive unmask
 * strokes: the punched region is `points` (the outer ring) minus `holes`
 * (previously-restored sub-regions), rendered as nested evenodd contours so a
 * reveal carved into a punch shows the original content through the hole.
 *
 * A mask may carry a `snapshot` — an immutable freeze stamp of the whole scene
 * captured at the moment the mask was created (or last refreshed). When
 * present, the mask is a "frozen" mask: instead of clipping the LIVE canvas at
 * render time (which lets later layer edits, reordering and new content leak
 * into the masked region), the clip layers render the captured pixels. Only an
 * explicit refresh/recreate rewrites the snapshot; every other edit
 * (move/resize/shape/unmask/delete) touches geometry alone.
 */
export interface Mask {
  id: string
  name: string
  shape: MaskShape
  x: number
  y: number
  width: number
  height: number
  points: MaskPoint[]
  inverted: boolean
  zIndex: number
  visible: boolean
  locked: boolean
  holes?: MaskPoint[][]
  /**
   * Immutable whole-scene freeze stamp. Present only on frozen masks. The
   * image renders inside the clip layers with `background: transparent`, so the
   * masked region shows exactly what the canvas looked like at capture time
   * (including other layers, z-order and the scene background) — never the live
   * canvas behind it.
   */
  snapshot?: MaskSnapshot
}

/**
 * A frozen-mask snapshot: a PNG data URL of the whole scene (captured from
 * `[data-scene-export]`) plus the capture metadata needed to place it back.
 * `sourceBounds` is the region of the scene the element occupied at capture
 * time; `width`/`height` are the image's pixel dimensions (rounded from
 * scene-units × scale).
 */
export interface MaskSnapshot {
  dataUrl: string
  width: number
  height: number
  /** Scene-space bounds of the target element when the snapshot was captured. */
  sourceBounds: { x: number; y: number; width: number; height: number }
  /** Wall-clock ms at capture time (0 in tests / legacy data). */
  capturedAt: number
}

export interface Shape {
  id: string
  kind: ShapeKind
  name: string
  x: number
  y: number
  width: number
  height: number
  rotation: number
  opacity: number
  color: string
  gradient: ShapeGradient | null
  blur: number
  glow: GlowLayer[]
  shadow: ShadowLayer[]
  zIndex: number
  locked: boolean
  visible: boolean
  cornerRadius: number
  backgroundImage: string | null
  angles: [number, number, number]
  crossThickness: number
  plusThickness: number
  arrowThickness: number
  groupId: string | null
  containerId: string | null
  effects?: ImageEffects
  /** When true, resize/numeric-size edits preserve the current width/height aspect ratio. */
  lockAspectRatio?: boolean
}

/**
 * Update prompt payload sent from the main process to the renderer so the
 * auto-updater can render styled in-app prompts instead of native OS dialogs.
 * - `checking` — a check is in flight (renderer-initiated "Check for Updates").
 * - `available` — a new version can be downloaded (user chooses Download/Later).
 * - `ready` — the update is downloaded (user chooses Restart Now/Later).
 * - `failed` — the check or download failed (informational, one OK button).
 * - `uptodate` — the check succeeded and no newer version exists (informational).
 */
export interface UpdatePromptPayload {
  kind: 'available' | 'ready' | 'failed' | 'checking' | 'uptodate'
  /** The incoming version string, present on `available`. */
  version?: string
  /** Error detail from the updater, present on `failed`. */
  message?: string
}
