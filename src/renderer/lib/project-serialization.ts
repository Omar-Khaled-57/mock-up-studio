/**
 * project-serialization — Project state ↔ .mockup ZIP conversion.
 *
 * .mockup file format:
 *   A standard ZIP archive containing:
 *   - `manifest.json` — Full project state (scenes, settings, metadata).
 *     Data URLs in the manifest are replaced with `asset://` references.
 *   - `assets/` — Binary files (PNG/JPEG) for device screenshots, image
 *     overlays, and background images. Extracted from inline data URLs.
 *
 * Serialization flow (save):
 *   1. Walk all scenes, find data URLs in screenImage, images, backgrounds.
 *   2. Decode each data URL to a binary buffer, assign an asset filename.
 *   3. Replace the data URL in the manifest with `asset://<filename>`.
 *   4. Return the manifest JSON string + a Map of asset name → Uint8Array.
 *
 * Deserialization flow (load):
 *   1. Parse `manifest.json`.
 *   2. For each `asset://` reference, look up the binary buffer, convert
 *      back to a data URL using base64 encoding.
 * 3. Return the fully hydrated scenes array ready for Zustand.
 *
 * Thread safety:
 *   - `assetCounter` is reset at the start of `serializeProject()` to ensure
 *     deterministic asset naming within a single save operation.
 */

import { ImageEffects } from '@shared/types'
import { generateId } from './id'

/**
 * Base64 ↔ binary helpers. The renderer runs sandboxed (no Node.js runtime),
 * so `Buffer` is unavailable — these use the Web `atob`/`btoa` APIs instead.
 * `Buffer` is a `Uint8Array` subclass, so any Buffer passed in tests (Node)
 * still satisfies these helpers.
 */
function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

interface SerializedProject {
  version: number
  project: {
    id: string
    name: string
    createdAt: number
    updatedAt: number
  }
  scenes: SerializedScene[]
  activeSceneIndex: number
}

interface SerializedScene {
  id: string
  name: string
  pinned?: boolean
  canvas: { width: number; height: number; aspectRatio: string }
  background: SerializedBackground
  devices: SerializedDevice[]
  textBoxes: SerializedTextBox[]
  images: SerializedImage[]
  shapes?: SerializedShape[]
  guides: SerializedGuide[]
  grid: SerializedGrid
  groups?: { id: string; name: string; childIds: string[] }[]
  masks?: SerializedMask[]
}

interface SerializedMask {
  id: string
  targetId: string
  shape: string
  x: number
  y: number
  width: number
  height: number
  points: { x: number; y: number }[]
  inverted: boolean
  holes?: { x: number; y: number }[][]
  /** Frozen-mask snapshot. `dataUrl` round-trips through the asset walk. */
  snapshot?: {
    dataUrl: string
    width: number
    height: number
    sourceBounds: { x: number; y: number; width: number; height: number }
    capturedAt: number
  }
}

interface SerializedBackground {
  type: string
  color?: string
  gradient?: { colors: string[]; angle: number; type?: string; radialShape?: string }
  image?: { src: string; blur: number; dim: number; overlayColor: string }
  presetName?: string
  transparent?: boolean
}

interface SerializedDevice {
  id: string
  type: string
  name: string
  visible: boolean
  locked: boolean
  x: number
  y: number
  width: number
  height: number
  rotation: number
  zIndex: number
  colorTheme: string
  customBezelColor?: string
  customBorderColor?: string
  screenImage: string | null
  objectFit: string
  customFrame?: { svgData: string; screenRegion: { x: number; y: number; w: number; h: number } }
  groupId: string | null
  containerId?: string | null
  lockAspectRatio?: boolean
}

interface SerializedTextBox {
  id: string
  name: string
  content: string
  x: number
  y: number
  width: number
  height: number
  heightAuto: boolean
  wrap?: boolean
  fontSize: number
  fontFamily: string
  fontWeight: number
  textAlign: string
  lineHeight: number
  letterSpacing: number
  wordSpacing: number
  textTransform: string
  strokeColor: string
  strokeWidth: number
  color: string
  gradient: SerializedTextGradient | null
  glow: SerializedTextGlow | null
  shadow: SerializedTextShadow | null
  visible: boolean
  backgroundVisible: boolean
  backgroundColor: string
  borderVisible: boolean
  borderColor: string
  borderRadius: number
  stylePreset: string
  zIndex: number
  locked: boolean
  groupId: string | null
  containerId?: string | null
}

interface SerializedImage {
  id: string
  name: string
  src: string | null
  x: number
  y: number
  width: number
  height: number
  rotation: number
  zIndex: number
  locked: boolean
  visible: boolean
  opacity?: number
  borderRadius?: number
  blendMode?: string
  flipX?: boolean
  flipY?: boolean
  blur?: number
  glow?: SerializedImageGlow[]
  shadow?: SerializedImageShadow[]
  effects?: ImageEffects
  containerId?: string | null
  lockAspectRatio?: boolean
}

interface SerializedShape {
  id: string
  kind: string
  name: string
  x: number
  y: number
  width: number
  height: number
  rotation: number
  opacity: number
  color: string
  gradient: { enabled: boolean; colors: string[]; angle: number } | null
  blur: number
  glow: SerializedImageGlow[]
  shadow: SerializedImageShadow[]
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
  containerId?: string | null
  effects?: ImageEffects
  lockAspectRatio?: boolean
}

interface SerializedImageGlow {
  enabled: boolean; color: string; blur: number; spread: number; opacity: number
}
interface SerializedImageShadow {
  enabled: boolean; color: string; offsetX: number; offsetY: number; blur: number; spread: number; opacity: number; inset: boolean
}

interface SerializedTextGradient {
  enabled: boolean
  color1: string
  color2: string
  angle: number
}

interface SerializedTextGlow {
  enabled: boolean
  color: string
  blur: number
}

interface SerializedTextShadow {
  enabled: boolean
  color: string
  offsetX: number
  offsetY: number
  blur: number
}

interface SerializedGuide {
  id: string
  orientation: string
  position: number
}

interface SerializedGrid {
  enabled: boolean
  size: number
  color: string
  opacity?: number
  snapEnabled: boolean
  style: string
}

/** Incrementing counter for unique asset filenames within a single save. */
let assetCounter = 0

/** Generates a sequential asset filename: img-1.png, img-2.jpg, etc. */
function extractAssetName(originalName: string): string {
  assetCounter++
  const ext = originalName.split('.').pop() || 'png'
  return `img-${assetCounter}.${ext}`
}

/**
 * Decodes a base64 data URL into a Uint8Array. Returns null if the string
 * is not a valid data URL (e.g., already an `asset://` reference).
 */
function parseDataUrl(dataUrl: string): { mime: string; buffer: Uint8Array } | null {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/)
  if (!match) return null
  return { mime: match[1], buffer: base64ToBytes(match[2]) }
}

/**
 * If `dataUrl` is a data URL, extracts the binary data, stores it in the
 * assets map, and returns an `asset://` reference string. Non-data-URLs
 * (like `asset://` or http URLs) are returned unchanged.
 */
function replaceDataUrlWithRef(
  dataUrl: string | null,
  assets: Map<string, Uint8Array>
): string | null {
  if (!dataUrl || !dataUrl.startsWith('data:')) return dataUrl
  const parsed = parseDataUrl(dataUrl)
  if (!parsed) return dataUrl
  const name = extractAssetName(parsed.mime.replace('/', '.'))
  assets.set(name, parsed.buffer)
  return `asset://${name}`
}

export function serializeProject(
  projectData: { id: string; name: string; createdAt: number; updatedAt: number },
  scenes: Array<Record<string, unknown>>,
  activeSceneIndex: number
): { manifest: string; assets: Map<string, Uint8Array> } {
  assetCounter = 0
  const assets = new Map<string, Uint8Array>()

  const serializedScenes: SerializedScene[] = scenes.map((scene) => {
    const s = scene as {
      id: string
      name: string
      canvas: { width: number; height: number; aspectRatio: string }
      background: SerializedBackground
      devices: SerializedDevice[]
      textBoxes: SerializedTextBox[]
      images: SerializedImage[]
      shapes: SerializedShape[]
      guides: SerializedGuide[]
      grid: SerializedGrid
      masks?: SerializedMask[]
    }

    const devices = s.devices.map((d) => ({
      ...d,
      screenImage: replaceDataUrlWithRef(d.screenImage, assets)
    }))

    const images = s.images.map((img) => ({
      ...img,
      src: replaceDataUrlWithRef(img.src, assets)
    }))

    const background = { ...s.background }
    if (background.image?.src) {
      background.image = {
        ...background.image,
        src: replaceDataUrlWithRef(background.image.src, assets) || ''
      }
    }

    const masks = (s.masks ?? []).map((m) => {
      const snapshot = (m as { snapshot?: { dataUrl?: string } }).snapshot
      if (!snapshot?.dataUrl) return m as SerializedMask
      const ref = replaceDataUrlWithRef(snapshot.dataUrl, assets)
      if (!ref) return m as SerializedMask
      return { ...m, snapshot: { ...snapshot, dataUrl: ref } } as SerializedMask
    })

    return {
      id: s.id,
      name: s.name,
      pinned: (scene as Record<string, unknown>).pinned as boolean ?? false,
      canvas: s.canvas,
      background,
      devices,
      textBoxes: s.textBoxes,
      images,
      shapes: s.shapes ?? [],
      guides: s.guides,
      grid: s.grid,
      groups: (s as unknown as Record<string, unknown>).groups as { id: string; name: string; childIds: string[] }[] ?? [],
      masks
    }
  })

  const manifest: SerializedProject = {
    version: 1,
    project: {
      id: projectData.id,
      name: projectData.name,
      createdAt: projectData.createdAt,
      updatedAt: projectData.updatedAt
    },
    scenes: serializedScenes,
    activeSceneIndex
  }

  return { manifest: JSON.stringify(manifest, null, 2), assets }
}

/**
 * Converts an `asset://` reference back to a base64 data URL by looking up
 * the binary buffer in the assets map. Non-asset references are returned as-is.
 */
function resolveAssetRef(ref: string | null, assets: Map<string, Uint8Array>): string | null {
  if (!ref || !ref.startsWith('asset://')) return ref
  const name = ref.replace('asset://', '')
  const buffer = assets.get(name)
  if (!buffer) return ref
  const ext = name.split('.').pop() || 'png'
  const mime = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`
  return `data:${mime};base64,${bytesToBase64(buffer)}`
}

export function deserializeProject(manifestJson: string, assets: Map<string, Uint8Array>): {
  projectData: { id: string; name: string; createdAt: number; updatedAt: number }
  scenes: Array<Record<string, unknown>>
  activeSceneIndex: number
} {
  const manifest = JSON.parse(manifestJson) as SerializedProject

  function normalizeShapeShadow(shadow: unknown): SerializedImageShadow[] {
    if (Array.isArray(shadow)) return shadow as SerializedImageShadow[]
    if (shadow && typeof shadow === 'object') {
      const s = shadow as Record<string, unknown>
      if (s.offsetX !== undefined) {
        return [{
          enabled: Boolean(s.enabled),
          color: String(s.color ?? '#000'),
          offsetX: Number(s.offsetX ?? 0),
          offsetY: Number(s.offsetY ?? 0),
          blur: Number(s.blur ?? 0),
          spread: Number(s.spread ?? 0),
          opacity: Number(s.opacity ?? 100),
          inset: false
        }]
      }
    }
    return []
  }

  function normalizeShapeGlow(glow: unknown): SerializedImageGlow[] {
    if (Array.isArray(glow)) return glow as SerializedImageGlow[]
    if (glow && typeof glow === 'object') {
      const g = glow as Record<string, unknown>
      if (g.color !== undefined) {
        return [{
          enabled: Boolean(g.enabled),
          color: String(g.color ?? '#000'),
          blur: Number(g.blur ?? 0),
          spread: Number(g.spread ?? 0),
          opacity: Number(g.opacity ?? 100)
        }]
      }
    }
    return []
  }

  /**
   * Legacy hero text shape (v1 files stored `scene.titleText`/`scene.sloganText`
   * as chromeless TitleBlock styles). Files saved before the heroes became
   * first-class text boxes carry these keys; newer files don't.
   */
  interface LegacyHeroText {
    content?: string
    fontSize?: number
    fontFamily?: string
    fontWeight?: number
    textAlign?: string
    lineHeight?: number
    letterSpacing?: number
    wordSpacing?: number
    textTransform?: string
    strokeColor?: string
    strokeWidth?: number
    color?: string
    gradient?: SerializedTextGradient | null
    glow?: SerializedTextGlow | null
    shadow?: SerializedTextShadow | null
    x?: number
    y?: number
    width?: number
    height?: number
    visible?: boolean
    zIndex?: number
  }

  interface LegacyHeroSpec {
    name: string
    stylePreset: 'title' | 'slogan'
    y: number
    height: number
    zIndex: number
    fallbackContent: string
    fallbackFontSize: number
    fallbackFontWeight: number
    fallbackColor: string
  }

  function legacyHeroToTextBox(
    legacy: LegacyHeroText,
    canvasWidth: number,
    spec: LegacyHeroSpec
  ): SerializedTextBox {
    const width = legacy.width ?? Math.max(320, Math.round(canvasWidth * 0.5))
    return {
      id: generateId(),
      name: spec.name,
      content: legacy.content ?? spec.fallbackContent,
      x: legacy.x ?? 60,
      y: legacy.y ?? spec.y,
      width,
      height: legacy.height ?? spec.height,
      heightAuto: true,
      wrap: true,
      fontSize: legacy.fontSize ?? spec.fallbackFontSize,
      fontFamily: legacy.fontFamily ?? 'Inter',
      fontWeight: legacy.fontWeight ?? spec.fallbackFontWeight,
      textAlign: (legacy.textAlign as 'left' | 'center' | 'right') ?? 'left',
      lineHeight: legacy.lineHeight ?? (spec.stylePreset === 'title' ? 1.1 : 1.3),
      letterSpacing: legacy.letterSpacing ?? 0,
      wordSpacing: legacy.wordSpacing ?? 0,
      textTransform: (legacy.textTransform as SerializedTextBox['textTransform']) ?? 'none',
      strokeColor: legacy.strokeColor ?? '#ffffff',
      strokeWidth: legacy.strokeWidth ?? 0,
      color: legacy.color ?? spec.fallbackColor,
      gradient: legacy.gradient ?? null,
      glow: legacy.glow ?? null,
      shadow: legacy.shadow ?? null,
      visible: legacy.visible ?? true,
      backgroundVisible: false,
      backgroundColor: '#00000040',
      borderVisible: false,
      borderColor: '#ffffff40',
      borderRadius: 4,
      stylePreset: spec.stylePreset,
      zIndex: legacy.zIndex ?? spec.zIndex,
      locked: false,
      groupId: null,
      containerId: null
    }
  }

  const scenes = manifest.scenes.map((scene) => {
    const devices = scene.devices.map((d) => ({
      ...d,
      screenImage: resolveAssetRef(d.screenImage, assets),
      containerId: d.containerId ?? null
    }))

    const images = scene.images.map((img) => ({
      ...img,
      src: resolveAssetRef(img.src, assets),
      containerId: img.containerId ?? null
    }))

    const background = { ...scene.background }
    if (background.image?.src) {
      background.image = {
        ...background.image,
        src: resolveAssetRef(background.image.src, assets) ?? ''
      }
    }

    const shapes = (scene.shapes ?? []).map((shape) => ({
      ...shape,
      shadow: normalizeShapeShadow(shape.shadow),
      glow: normalizeShapeGlow(shape.glow),
      containerId: shape.containerId ?? null
    }))

    const masks = (scene.masks ?? []).map((m) => {
      const snap = (m as { snapshot?: { dataUrl?: string } }).snapshot
      if (!snap?.dataUrl) return m as SerializedMask
      return { ...m, snapshot: { ...snap, dataUrl: resolveAssetRef(snap.dataUrl, assets) ?? snap.dataUrl } } as SerializedMask
    })

    // Pre-v0.3.0 files stored the hero title/slogan as chromeless styles on
    // the scene (`titleText`/`sloganText`). Migrate them into real text boxes
    // marked with `stylePreset` so theme presets still recolor the hero copy.
    const raw = scene as unknown as Record<string, unknown>
    const legacyTitle = raw.titleText as LegacyHeroText | undefined
    const legacySlogan = raw.sloganText as LegacyHeroText | undefined
    const canvasWidth = scene.canvas?.width ?? 1280

    const textBoxes = [
      ...(scene.textBoxes ?? []).map((tb) => ({ ...tb, wrap: tb.wrap ?? true, containerId: tb.containerId ?? null })),
      ...(legacyTitle && typeof legacyTitle === 'object'
        ? [legacyHeroToTextBox(legacyTitle, canvasWidth, {
            name: 'Title', stylePreset: 'title', y: 60, height: 72, zIndex: 1,
            fallbackContent: 'Your Title', fallbackFontSize: 64, fallbackFontWeight: 800, fallbackColor: '#ffffff'
          })]
        : []),
      ...(legacySlogan && typeof legacySlogan === 'object'
        ? [legacyHeroToTextBox(legacySlogan, canvasWidth, {
            name: 'Slogan', stylePreset: 'slogan', y: 152, height: 36, zIndex: 0,
            fallbackContent: 'Your slogan goes here', fallbackFontSize: 24, fallbackFontWeight: 400, fallbackColor: '#a1a1aa'
          })]
        : [])
    ]

    const rest: Record<string, unknown> = { ...raw }
    delete rest.titleText
    delete rest.sloganText

    return {
      ...rest,
      pinned: scene.pinned ?? false,
      devices,
      images,
      shapes,
      background,
      textBoxes,
      groups: scene.groups ?? [],
      masks
    }
  })

  return {
    projectData: manifest.project,
    scenes,
    activeSceneIndex: manifest.activeSceneIndex
  }
}

/**
 * Parses the assets JSON string (a flat {name: base64} object) from the
 * ZIP file back into a Map<string, Uint8Array>. Returns empty map on parse error.
 */
export function parseAssetsJson(assetsJson: string): Map<string, Uint8Array> {
  try {
    const assetsObj = JSON.parse(assetsJson) as Record<string, string>
    const assetsMap = new Map<string, Uint8Array>()
    for (const [name, b64] of Object.entries(assetsObj)) {
      assetsMap.set(name, base64ToBytes(b64))
    }
    return assetsMap
  } catch {
    return new Map()
  }
}

export interface ZipProjectResult {
  manifest: string
  assetsJson: string
  filePath: string
}

/**
 * Convenience wrapper: takes the raw ZIP result (manifest JSON + assets JSON),
 * deserializes both, and returns the hydrated project data ready for the store.
 * This is the single entry point used by both projectSlice and SplashScreen.
 */
export function loadProjectFromZipResult(result: ZipProjectResult): {
  project: {
    id: string
    name: string
    createdAt: number
    updatedAt: number
    scenes: Array<Record<string, unknown>>
    activeSceneIndex: number
  }
  scenes: Array<Record<string, unknown>>
  activeSceneIndex: number
} {
  const assetsMap = parseAssetsJson(result.assetsJson)
  const { projectData, scenes, activeSceneIndex } = deserializeProject(result.manifest, assetsMap)

  return {
    project: {
      id: projectData.id,
      name: projectData.name,
      createdAt: projectData.createdAt,
      updatedAt: projectData.updatedAt,
      scenes,
      activeSceneIndex: activeSceneIndex
    },
    scenes,
    activeSceneIndex
  }
}
