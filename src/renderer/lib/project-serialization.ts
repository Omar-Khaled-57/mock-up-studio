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
  canvas: { width: number; height: number; aspectRatio: string }
  background: SerializedBackground
  devices: SerializedDevice[]
  textBoxes: SerializedTextBox[]
  images: SerializedImage[]
  titleText: SerializedTitleText
  sloganText: SerializedTitleText
  guides: SerializedGuide[]
  grid: SerializedGrid
}

interface SerializedBackground {
  type: string
  color?: string
  gradient?: { colors: string[]; angle: number }
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
}

interface SerializedTextBox {
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
  textAlign: string
  lineHeight: number
  letterSpacing: number
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
}

interface SerializedImage {
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

interface SerializedTitleText {
  content: string
  fontSize: number
  fontFamily: string
  fontWeight: number
  textAlign: string
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
      canvas: s.canvas,
      background,
      devices,
      textBoxes: s.textBoxes,
      images,
      titleText: s.titleText,
      sloganText: s.sloganText,
      guides: s.guides,
      grid: s.grid
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
function resolveAssetRef(ref: string, assets: Map<string, Buffer>): string {
  if (!ref.startsWith('asset://')) return ref
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
        src: resolveAssetRef(background.image.src, assets)
      }
    }

    return {
      ...scene,
      devices,
      images,
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
      activeSceneIndex: projectData.activeSceneIndex
    },
    scenes,
    activeSceneIndex
  }
}
