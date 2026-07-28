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
  canvas: CanvasSettings
  background: Background
  devices: Device[]
  textBoxes: TextBox[]
  images: ImageOverlay[]
  titleText: TitleText
  sloganText: TitleText
  guides: Guide[]
  grid: GridSettings
}

export interface TitleText {
  content: string
  fontSize: number
  fontFamily: string
  fontWeight: number
  textAlign: 'left' | 'center' | 'right'
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
}

export interface TextBox {
  id: string
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
}

export interface ImageOverlay {
  id: string
  src: string
  x: number
  y: number
  width: number
  height: number
  rotation: number
  zIndex: number
  locked: boolean
  visible: boolean
}

export interface Background {
  type: 'solid' | 'gradient' | 'image' | 'preset'
  color?: string
  gradient?: {
    colors: string[]
    angle: number
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
}
