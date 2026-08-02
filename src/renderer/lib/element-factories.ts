/**
 * element-factories — Single source of truth for creating new scene elements
 * (devices, text boxes, image overlays) plus the shared device-type metadata.
 *
 * Panels and quick actions never build elements inline; they call the store
 * actions (addDeviceOfType / addDefaultTextBox / importImageFromFile) which
 * in turn use these builders, so every creation workflow is one code path.
 */
import type { Device, ImageOverlay, Scene, TextBox } from '@shared/types'
import { generateId } from './id'
import { DEVICE_ASPECT_RATIOS } from './constants'

export const DEVICE_TYPES: { type: Device['type']; label: string }[] = [
  { type: 'monitor', label: 'Monitor' },
  { type: 'laptop', label: 'Laptop' },
  { type: 'ipad', label: 'iPad' },
  { type: 'phone', label: 'Phone' },
  { type: 'watch', label: 'Watch' },
  { type: 'browser', label: 'Browser' },
  { type: 'terminal', label: 'Terminal' }
]

export const DEVICE_NAMES: Record<string, string> = Object.fromEntries(
  DEVICE_TYPES.map((d) => [d.type, d.label])
)

const DEVICE_DEFAULTS: Record<string, { width: number }> = {
  monitor: { width: 520 },
  laptop: { width: 420 },
  ipad: { width: 280 },
  phone: { width: 160 },
  watch: { width: 90 },
  browser: { width: 480 },
  terminal: { width: 400 }
}

/** Device types the PropertiesPanel "+ Add device" quick action may spawn. */
export const QUICK_ADD_DEVICE_TYPES: Device['type'][] = ['monitor', 'terminal', 'phone', 'ipad']

export function deviceDefaultWidth(type: Device['type']): number {
  return DEVICE_DEFAULTS[type]?.width ?? 300
}

export function deviceDefaultHeight(type: Device['type']): number {
  const ratio = DEVICE_ASPECT_RATIOS[type] ?? 16 / 9
  return Math.round(deviceDefaultWidth(type) / ratio)
}

/** Highest zIndex across every element kind (devices/textBoxes/images/shapes). */
function maxElementZIndex(scene: Scene): number {
  return [
    ...scene.devices,
    ...scene.textBoxes,
    ...scene.images,
    ...scene.shapes
  ].reduce((max, e) => Math.max(max, e.zIndex), -1)
}

export function createDeviceElement(type: Device['type'], scene: Scene): Device {
  const w = deviceDefaultWidth(type)
  const h = deviceDefaultHeight(type)
  const existingCount = scene.devices.filter((d) => d.type === type).length
  const maxZ = maxElementZIndex(scene)
  return {
    id: generateId(),
    type,
    name: `${type.charAt(0).toUpperCase() + type.slice(1)} ${existingCount + 1}`,
    visible: true,
    locked: false,
    x: 100 + Math.random() * 200,
    y: 100 + Math.random() * 100,
    width: w,
    height: h,
    rotation: 0,
    zIndex: maxZ + 1,
    colorTheme: 'dark',
    screenImage: null,
    objectFit: 'contain',
    groupId: null,
    containerId: null
  }
}

export const DEFAULT_TEXT_SIZE = 200

export function createTextBoxElement(canvasW: number, canvasH: number, zIndex: number, index: number): TextBox {
  return {
    id: generateId(),
    name: `Text ${index + 1}`,
    content: 'Double-click to edit',
    x: Math.round((canvasW - DEFAULT_TEXT_SIZE) / 2),
    y: Math.round((canvasH - DEFAULT_TEXT_SIZE) / 2),
    width: DEFAULT_TEXT_SIZE,
    height: 60,
    heightAuto: true,
    wrap: true,
    fontSize: 24,
    fontFamily: 'Inter',
    fontWeight: 600,
    textAlign: 'center',
    lineHeight: 1.3,
    letterSpacing: 0,
    wordSpacing: 0,
    textTransform: 'none',
    strokeColor: '#ffffff',
    strokeWidth: 0,
    color: '#ffffff',
    gradient: null,
    glow: null,
    shadow: null,
    visible: true,
    backgroundVisible: false,
    backgroundColor: '#00000040',
    borderVisible: false,
    borderColor: '#ffffff40',
    borderRadius: 4,
    stylePreset: 'custom',
    zIndex,
    locked: false,
    groupId: null,
    containerId: null
  }
}

export const DEFAULT_IMAGE_SIZE = 300

export interface ImageFileInfo {
  dataUrl: string
  width: number
  height: number
}

export function buildImageOverlay(dataUrl: string, imgWidth: number, imgHeight: number, scene: Scene, name: string): ImageOverlay {
  const aspect = imgWidth / imgHeight
  const w = Math.min(DEFAULT_IMAGE_SIZE, scene.canvas.width * 0.5)
  const h = Math.round(w / aspect)
  return {
    id: generateId(),
    name,
    src: dataUrl,
    x: Math.round((scene.canvas.width - w) / 2),
    y: Math.round((scene.canvas.height - h) / 2),
    width: w,
    height: h,
    rotation: 0,
    opacity: 100,
    borderRadius: 0,
    blendMode: 'normal',
    flipX: false,
    flipY: false,
    blur: 0,
    glow: [],
    shadow: [],
    zIndex: maxElementZIndex(scene) + 1,
    locked: false,
    visible: true,
    groupId: null,
    containerId: null
  }
}

/**
 * Reads an image File into a data URL and resolves its intrinsic dimensions.
 * Resolves `null` when the file cannot be read or decoded, so callers can
 * treat "cancel/error" uniformly as a no-op.
 */
export function readImageFile(file: File): Promise<ImageFileInfo | null> {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      const img = new Image()
      img.onload = () => resolve({ dataUrl, width: img.width, height: img.height })
      img.onerror = () => resolve(null)
      img.src = dataUrl
    }
    reader.onerror = () => resolve(null)
    reader.readAsDataURL(file)
  })
}
