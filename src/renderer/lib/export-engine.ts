/**
 * export-engine — Scene-to-image export using modern-screenshot.
 *
 * How it works:
 *   1. Finds the `[data-scene-export]` DOM node (the Scene component).
 *   2. Deep-clones it, positions it offscreen (-99999px), and removes
 *      transient editor chrome (`data-watermark`, `data-guide`) that must
 *      never appear in exports.
 *   3. Applies background color override if "solid" or "transparent" mode.
 *   4. Appends the clone to `document.body` (required by modern-screenshot
 *      to resolve styles and compute layout).
 *   5. Calls `domToBlob()` with the desired format, scale, and quality.
 *   6. Removes the clone in the `finally` block (always, even on error).
 *
 * Scale: 1x = 1:1 pixel mapping, 2x = double resolution, etc.
 * Quality: Only applies to JPEG and WebP (PNG is always lossless).
 */

import { domToBlob } from 'modern-screenshot'

export type ExportFormat = 'png' | 'jpeg' | 'webp'
export type ExportScale = 1 | 2 | 3 | 4
export type ExportBackground = 'scene' | 'solid' | 'transparent'
export type ExportScope = 'current' | 'all'

export interface ExportOptions {
  format: ExportFormat
  scale: ExportScale
  background: ExportBackground
  backgroundColor: string
  quality: number
}

const FORMAT_META: Record<ExportFormat, { mime: string; ext: string }> = {
  png: { mime: 'image/png', ext: 'png' },
  jpeg: { mime: 'image/jpeg', ext: 'jpg' },
  webp: { mime: 'image/webp', ext: 'webp' }
}

export function getMimeType(format: ExportFormat): string {
  return FORMAT_META[format].mime
}

export function getExtension(format: ExportFormat): string {
  return FORMAT_META[format].ext
}

/**
 * Renders the scene DOM offscreen and returns a Blob of the captured image.
 * Returns null if the scene DOM node is not found or rendering fails.
 */
export async function exportScene(options: ExportOptions): Promise<Blob | null> {
  const sceneNode = document.querySelector('[data-scene-export]') as HTMLElement | null
  if (!sceneNode) return null

  const cloned = sceneNode.cloneNode(true) as HTMLElement
  cloned.style.position = 'fixed'
  cloned.style.left = '-99999px'
  cloned.style.top = '0'
  cloned.style.transform = 'none'
  cloned.style.margin = '0'

  if (options.background === 'solid') {
    cloned.style.background = options.backgroundColor
  } else if (options.background === 'transparent') {
    cloned.style.background = 'transparent'
  }

  document.body.appendChild(cloned)

  // Transient editor chrome must never appear in exports.
  cloned.querySelectorAll('[data-watermark], [data-guide]').forEach((el) => el.remove())

  // For solid/transparent exports the scene's own background layer would
  // cover the override — remove it so the override shows through.
  if (options.background !== 'scene') {
    cloned.querySelectorAll('[data-scene-background]').forEach((el) => el.remove())
  }

  try {
    const blob = await domToBlob(cloned, {
      scale: options.scale,
      style: {
        transform: 'none',
        transformOrigin: '0 0'
      },
      quality: options.format === 'png' ? undefined : options.quality / 100,
      type: getMimeType(options.format)
    })

    return blob
  } catch (err) {
    console.error('Export failed:', err)
    return null
  } finally {
    document.body.removeChild(cloned)
  }
}

/**
 * Waits for React to finish re-rendering by yielding to the browser twice.
 * Used between scene switches to ensure the DOM reflects the new scene.
 */
function waitForRender(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve())
    })
  })
}

/**
 * Sanitizes a scene name for use as a filename segment.
 * Keeps alphanumeric, hyphens, underscores. Replaces spaces with hyphens.
 */
function sanitizeSceneName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]/g, '-').replace(/-+/g, '-').slice(0, 60) || 'Scene'
}

/**
 * Exports all scenes by temporarily switching the active scene in the store,
 * waiting for React to re-render, capturing the DOM, and restoring the original.
 * Returns a Map of scene name → Blob.
 */
export async function exportAllScenes(options: ExportOptions): Promise<Map<string, Blob>> {
  const { useStore } = await import('../store')
  const { safeScene } = await import('../store/sceneSlice')

  const state = useStore.getState()
  const originalIndex = state.activeSceneIndex
  const sceneCount = state.scenes.length
  const results = new Map<string, Blob>()

  try {
    for (let i = 0; i < sceneCount; i++) {
      state.setActiveSceneIndex(i)
      await waitForRender()

      const blob = await exportScene(options)
      if (blob) {
        const scene = safeScene(useStore.getState())
        const name = `${sanitizeSceneName(scene.name)}-${i + 1}`
        results.set(name, blob)
      }
    }
  } finally {
    // Always restore original scene, even if export fails mid-way.
    state.setActiveSceneIndex(originalIndex)
    await waitForRender()
  }

  return results
}

/**
 * Copies the exported scene image to the OS clipboard.
 * Returns true on success, false if export failed or clipboard API is unavailable.
 */
export async function copyExportToClipboard(options: ExportOptions): Promise<boolean> {
  try {
    const blob = await exportScene(options)
    if (!blob) return false
    await navigator.clipboard.write([
      new ClipboardItem({ [blob.type]: blob })
    ])
    return true
  } catch {
    return false
  }
}

/** Generates a timestamped filename like `mockup-export-2025-01-15-14-30-00.png`. */
export function getExportFilename(format: ExportFormat, sceneName?: string): string {
  const ts = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-')
  const prefix = sceneName ? sanitizeSceneName(sceneName) : 'mockup-export'
  return `${prefix}-${ts}.${getExtension(format)}`
}
