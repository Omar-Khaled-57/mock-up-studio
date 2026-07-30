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
 *   4. Return the manifest JSON string + a Map of asset name → Buffer.
 *
 * Deserialization flow (load):
 *   1. Parse `manifest.json`.
 *   2. For each `asset://` reference, look up the binary buffer, convert
 *      back to a data URL using base64 encoding.
 *   3. Return the fully hydrated scenes array ready for Zustand.
 *
 * Thread safety:
 *   - `assetCounter` is reset at the start of `serializeProject()` to ensure
 *     deterministic asset naming within a single save operation.
 */

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
  titleText: SerializedTitleText
  sloganText: SerializedTitleText
  guides: SerializedGuide[]
  grid: SerializedGrid
  groups?: { id: string; name: string; childIds: string[] }[]
}

interface SerializedBackground {
  type: string
  color?: string
  gradient?: { colors: string[]; angle: number; type?: string; radialShape?: string }
  image?: { src: string; blur: number; dim: number; overlayColor: string }
  presetName?: string
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
}

interface SerializedImageGlow {
  enabled: boolean; color: string; blur: number; spread: number; opacity: number
}
interface SerializedImageShadow {
  enabled: boolean; color: string; offsetX: number; offsetY: number; blur: number; spread: number; opacity: number; inset: boolean
}

interface SerializedTitleText {
  content: string
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
 * Decodes a base64 data URL into a Buffer. Returns null if the string
 * is not a valid data URL (e.g., already an `asset://` reference).
 */
function parseDataUrl(dataUrl: string): { mime: string; buffer: Buffer } | null {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/)
  if (!match) return null
  return { mime: match[1], buffer: Buffer.from(match[2], 'base64') }
}

/**
 * If `dataUrl` is a data URL, extracts the binary data, stores it in the
 * assets map, and returns an `asset://` reference string. Non-data-URLs
 * (like `asset://` or http URLs) are returned unchanged.
 */
function replaceDataUrlWithRef(
  dataUrl: string | null,
  assets: Map<string, Buffer>
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
): { manifest: string; assets: Map<string, Buffer> } {
  assetCounter = 0
  const assets = new Map<string, Buffer>()

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
      titleText: SerializedTitleText
      sloganText: SerializedTitleText
      guides: SerializedGuide[]
      grid: SerializedGrid
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
      titleText: s.titleText,
      sloganText: s.sloganText,
      guides: s.guides,
      grid: s.grid,
      groups: (s as unknown as Record<string, unknown>).groups as { id: string; name: string; childIds: string[] }[] ?? []
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
function resolveAssetRef(ref: string | null, assets: Map<string, Buffer>): string | null {
  if (!ref || !ref.startsWith('asset://')) return ref
  const name = ref.replace('asset://', '')
  const buffer = assets.get(name)
  if (!buffer) return ref
  const ext = name.split('.').pop() || 'png'
  const mime = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`
  return `data:${mime};base64,${buffer.toString('base64')}`
}

export function deserializeProject(manifestJson: string, assets: Map<string, Buffer>): {
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

  const scenes = manifest.scenes.map((scene) => {
    const devices = scene.devices.map((d) => ({
      ...d,
      screenImage: resolveAssetRef(d.screenImage, assets)
    }))

    const images = scene.images.map((img) => ({
      ...img,
      src: resolveAssetRef(img.src, assets)
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
      glow: normalizeShapeGlow(shape.glow)
    }))

    return {
      ...scene,
      pinned: scene.pinned ?? false,
      devices,
      images,
      shapes,
      background
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
 * ZIP file back into a Map<string, Buffer>. Returns empty map on parse error.
 */
export function parseAssetsJson(assetsJson: string): Map<string, Buffer> {
  try {
    const assetsObj = JSON.parse(assetsJson) as Record<string, string>
    const assetsMap = new Map<string, Buffer>()
    for (const [name, b64] of Object.entries(assetsObj)) {
      assetsMap.set(name, Buffer.from(b64, 'base64'))
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
