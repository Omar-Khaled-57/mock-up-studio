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
 *   5. Calls `domToCanvas()` with the desired scale, then deterministically
 *      punches scene-mask holes into the canvas (the foreignObject capture
 *      drops `clip-path: polygon(… evenodd)` — probe-proven — so the masked
 *      transparency must be reproduced with canvas compositing).
 *   6. For solid exports, fills behind the punch with the requested color.
 *   7. Encodes the canvas to a Blob with the desired format and quality.
 *   8. Removes the clone in the `finally` block (always, even on error).
 *
 * Scale: 1x = 1:1 pixel mapping, 2x = double resolution, etc.
 * Quality: Only applies to JPEG and WebP (PNG is always lossless).
 */

import { domToCanvas } from 'modern-screenshot'
import { BACKGROUND_MASK_TARGET_ID, maskOuterRing } from '../services/mask-visualization'
import type { Mask } from '@shared/types'

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
 * Traces a closed ring onto the current canvas path in scene units scaled by
 * `scale` (the export resolution multiplier).
 */
function traceRing(ctx: CanvasRenderingContext2D, ring: { x: number; y: number }[], scale: number): void {
  if (ring.length === 0) return
  ctx.moveTo(ring[0].x * scale, ring[0].y * scale)
  for (let i = 1; i < ring.length; i++) {
    ctx.lineTo(ring[i].x * scale, ring[i].y * scale)
  }
  ctx.closePath()
}

/**
 * Punches scene/background-mask holes out of an exported scene canvas.
 *
 * The scene DOM clips masks with `clip-path: polygon(… evenodd)` wrappers,
 * which the foreignObject capture silently ignores (the shape inside a masked
 * region still renders). This reproduces the transparency hole on the raster
 * itself: a `destination-out` fill with `fillRule: 'evenodd'` erases exactly
 * the masked region.
 *
 * Only background masks (target `__background__`) are punched. Element and
 * container masks clip only their own facade — reproducing their hidden
 * regions on the raster would require revealing content beneath them, which
 * CSS clip-path does not do either, so they are out of scope.
 *
 * Hidden-region semantics (mirroring `buildMaskClipPath`):
 *   - inverted (punch): hidden = shape ∖ holes  → path = shape + holes
 *   - non-inverted (reveal): hidden = box ∖ (shape ∖ holes) → path = box + shape + holes
 * Both fill evenodd. No-op / fully-hidden masks (degenerate ring) are skipped.
 */
export function punchSceneMaskHoles(
  ctx: CanvasRenderingContext2D | null,
  masks: Mask[],
  canvasWidth: number,
  canvasHeight: number,
  scale = 1
): void {
  if (!ctx) return
  const bgMasks = masks.filter((m) => m.targetId === BACKGROUND_MASK_TARGET_ID)
  if (bgMasks.length === 0) return

  ctx.save()
  ctx.globalCompositeOperation = 'destination-out'
  for (const mask of bgMasks) {
    const outer = maskOuterRing(mask)
    if (outer.length === 0) continue

    ctx.beginPath()
    if (!mask.inverted) {
      traceRing(
        ctx,
        [
          { x: 0, y: 0 },
          { x: canvasWidth, y: 0 },
          { x: canvasWidth, y: canvasHeight },
          { x: 0, y: canvasHeight }
        ],
        scale
      )
    }
    traceRing(ctx, outer, scale)
    for (const hole of mask.holes ?? []) traceRing(ctx, hole, scale)
    ctx.fill('evenodd')
  }
  ctx.restore()
}

/**
 * Captures just the scene's background layer (`[data-scene-background]`) so a
 * punched mask hole can reveal the content "under" the mask. The background
 * node is `position: absolute; inset: 0` and its renderers are full-size
 * absolute children, so the clone is re-homed inside a fixed, scene-sized
 * wrapper before capture. Returns null when the scene has no background layer
 * or the capture fails.
 */
export async function captureSceneBackgroundNode(
  sceneNode: HTMLElement,
  width: number,
  height: number,
  scale = 1
): Promise<HTMLCanvasElement | null> {
  const bg = sceneNode.querySelector('[data-scene-background]')
  if (!bg) return null

  const wrapper = document.createElement('div')
  wrapper.style.position = 'fixed'
  wrapper.style.left = '-99999px'
  wrapper.style.top = '0'
  wrapper.style.width = `${width}px`
  wrapper.style.height = `${height}px`
  wrapper.appendChild(bg.cloneNode(true))

  document.body.appendChild(wrapper)
  try {
    return await domToCanvas(wrapper, {
      scale,
      style: {
        transform: 'none',
        transformOrigin: '0 0'
      }
    })
  } catch {
    return null
  } finally {
    document.body.removeChild(wrapper)
  }
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
    const canvas = await domToCanvas(cloned, {
      scale: options.scale,
      style: {
        transform: 'none',
        transformOrigin: '0 0'
      }
    })

    // Scene masks must survive capture even though their evenodd clip-path
    // wrappers do not: punch the transparency holes deterministically.
    const { useStore } = await import('../store')
    const { safeScene } = await import('../store/sceneSlice')
    const scene = safeScene(useStore.getState())
    const bgMasks = scene.masks.filter((m) => m.targetId === BACKGROUND_MASK_TARGET_ID)
    const ctx = canvas.getContext('2d')
    punchSceneMaskHoles(ctx, bgMasks, scene.canvas.width, scene.canvas.height, options.scale)

    if (options.background === 'scene' && bgMasks.length > 0) {
      // A scene (canvas) mask preserves the area under it: the hole it punches
      // must reveal the scene's own background layer — the content "under" the
      // mask — instead of a transparent void (which reads as the app surface,
      // black in dark mode / white in light mode, in preview and paste).
      // The mask clip already hides everything above the background in the
      // masked region; the background is composited beneath the punched capture
      // so only the hole reveals it.
      const bgCanvas = await captureSceneBackgroundNode(cloned, scene.canvas.width, scene.canvas.height, options.scale)
      if (ctx && bgCanvas) {
        ctx.save()
        ctx.globalCompositeOperation = 'destination-over'
        ctx.drawImage(bgCanvas, 0, 0)
        ctx.restore()
      }
    } else if (options.background === 'solid') {
      // Solid exports: fill behind the punched holes (and any transparent
      // region) with the requested color so the image is fully opaque.
      if (ctx) {
        ctx.save()
        ctx.globalCompositeOperation = 'destination-over'
        ctx.fillStyle = options.backgroundColor
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.restore()
      }
    }

    return await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(
        (blob) => resolve(blob),
        getMimeType(options.format),
        options.format === 'png' ? undefined : options.quality / 100
      )
    })
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
