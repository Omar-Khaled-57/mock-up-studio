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
  titleText: TitleText
  sloganText: TitleText
  guides: Guide[]
  grid: GridSettings
  groups: ElementGroup[]
  masks: Mask[]
}

export interface TitleText {
  content: string
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
  effects?: ImageEffects
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
  snapEnabled: boolean
  style: 'dotted' | 'lines'
}

export type ShapeKind = 'rectangle' | 'circle' | 'ellipse' | 'triangle' | 'star' | 'hexagon' | 'diamond' | 'parallelogram' | 'trapezoid' | 'cross' | 'plus' | 'heart' | 'arrow-right'

export interface ShapeGradient {
  enabled: boolean
  colors: string[]
  angle: number
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
 * A first-class, reusable mask applied to a target element as a CSS clip.
 * Geometry lives in the target element's LOCAL coordinate frame (0..target
 * width/height) so the clip rotates with the element. `x/y/width/height`
 * define the bounding box for rectangle/ellipse masks and the bounds of a
 * brush (freehand) mask; `points` carries the brush polygon. `inverted`
 * toggles punch (inverse) rendering via evenodd clip-path compositing.
 */
export interface Mask {
  id: string
  targetId: string
  shape: MaskShape
  x: number
  y: number
  width: number
  height: number
  points: MaskPoint[]
  inverted: boolean
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
  effects?: ImageEffects
}
