/**
 * export-engine — Scene-to-image export using modern-screenshot.
 *
 * How it works:
 *   1. Finds the `[data-scene-export]` DOM node (the Scene component).
 *   2. Deep-clones it, positions it offscreen (-99999px), and removes
 *      transient editor chrome (`data-guide`, `data-transparent-checker`) that
 *      must never appear in exports. The watermark is NOT editor chrome — it is
 *      export-only content, so it is injected into the clone (when enabled)
 *      rather than stripped.
 *   3. Applies background color override if "solid" or "transparent" mode.
 *   4. Appends the clone to `document.body` (required by modern-screenshot
 *      to resolve styles and compute layout).
 *   5. Calls `domToCanvas()` with the desired scale, then deterministically
 *      reproduces z-aware scene-mask clipping on the raster (the foreignObject
 *      capture drops `clip-path: polygon(… evenodd)` — probe-proven — so the
 *      mask semantics must be rebuilt with canvas compositing).
 *   6. For solid exports, fills behind the punch with the requested color.
 *   7. Encodes the canvas to a Blob with the desired format and quality.
 *   8. Removes the clone in the `finally` block (always, even on error).
 *
 * Scale: 1x = 1:1 pixel mapping, 2x = double resolution, etc.
 * Quality: Only applies to JPEG and WebP (PNG is always lossless).
 *
 * Z-aware mask export: the editor renders masks as independent scene layers
 * that preserve everything strictly below their z-index and punch out content
 * at or above it (see Scene.tsx banding). To reproduce that on a raster,
 * masked scenes are composited bottom-up from per-band captures: band 0
 * (background + content < lowest mask z) is unclipped, band b is punched by
 * every mask below it, and higher bands are punched by more masks — so the
 * content beneath a mask survives inside its region. Frozen masks (snapshot)
 * are painted back over their punched hole from their snapshot layer.
 */

import { domToCanvas } from 'modern-screenshot'
import { maskOuterRing } from '../services/mask-visualization'
import { buildWatermarkStyle, isWatermarkEnabled } from './watermark'
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
 * Punches mask holes out of an exported scene canvas.
 *
 * The scene DOM clips masks with `clip-path: polygon(… evenodd)` wrappers,
 * which the foreignObject capture silently ignores (the shape inside a masked
 * region still renders). This reproduces the transparency hole on the raster
 * itself: a `destination-out` fill with `fillRule: 'evenodd'` erases exactly
 * the masked region.
 *
 * Z-aware semantics: a mask punches out only content ABOVE it, so this punch
 * is applied per z-band with exactly the masks below that band (see
 * `exportScene`), and to frozen-mask snapshot layers before they are painted
 * back over their hole. Callers pass the relevant mask subset — hidden masks
 * and degenerate rings are skipped here.
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
  const visibleMasks = masks.filter((m) => m.visible)
  if (visibleMasks.length === 0) return

  ctx.save()
  ctx.globalCompositeOperation = 'destination-out'
  for (const mask of visibleMasks) {
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
 * Captures a detached DOM subtree by re-homing a clone inside a fixed,
 * scene-sized wrapper (the node's own positioning is scene-absolute, so the
 * wrapper supplies the containing block). Returns null on capture failure.
 */
async function captureNodeIntoCanvas(
  node: HTMLElement,
  width: number,
  height: number,
  scale = 1
): Promise<HTMLCanvasElement | null> {
  const wrapper = document.createElement('div')
  wrapper.style.position = 'fixed'
  wrapper.style.left = '-99999px'
  wrapper.style.top = '0'
  wrapper.style.width = `${width}px`
  wrapper.style.height = `${height}px`
  wrapper.appendChild(node.cloneNode(true))

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
 * Captures one z-band of the scene (`[data-scene-band="b"]`) from the export
 * clone, unclipped by any mask wrapper. Bands are independently capturable
 * because foreignObject drops the mask clip-paths anyway — the clone's band
 * subtree is the raw band content, which `exportScene` then punches itself.
 */
async function captureSceneBandNode(
  sceneClone: HTMLElement,
  bandIndex: number,
  width: number,
  height: number,
  scale = 1
): Promise<HTMLCanvasElement | null> {
  const band = sceneClone.querySelector<HTMLElement>(`[data-scene-band="${bandIndex}"]`)
  if (!band) return null
  return captureNodeIntoCanvas(band, width, height, scale)
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

  // Transient editor chrome must never appear in exports. The watermark is
  // export-only content and is injected below, never present in the editor DOM.
  cloned.querySelectorAll('[data-guide], [data-transparent-checker]').forEach((el) => el.remove())

  // For solid/transparent exports the scene's own background layer would
  // cover the override — remove it so the override shows through.
  if (options.background !== 'scene') {
    cloned.querySelectorAll('[data-scene-background]').forEach((el) => el.remove())
  }

  try {
    const { useStore } = await import('../store')
    const { safeScene } = await import('../store/sceneSlice')
    const scene = safeScene(useStore.getState())
    const visibleMasks = scene.masks.filter((m) => m.visible)

    // The watermark is export-only: it is never rendered in the editor, so it
    // is injected into the clone here. The flat capture path below rasters it
    // with the rest of the scene; the banded path captures it as its own layer.
    const { watermark } = useStore.getState()
    const watermarkOn = isWatermarkEnabled(watermark)
    if (watermarkOn) {
      const wm = document.createElement('div')
      wm.setAttribute('data-watermark', '')
      wm.textContent = watermark.text
      Object.assign(wm.style, buildWatermarkStyle(watermark))
      cloned.appendChild(wm)
    }

    const encode = (c: HTMLCanvasElement) =>
      new Promise<Blob | null>((resolve) => {
        c.toBlob(
          (blob) => resolve(blob),
          getMimeType(options.format),
          options.format === 'png' ? undefined : options.quality / 100
        )
      })

    const solidFill = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
      ctx.save()
      ctx.globalCompositeOperation = 'destination-over'
      ctx.fillStyle = options.backgroundColor
      ctx.fillRect(0, 0, w, h)
      ctx.restore()
    }

    // No masks: a single flat capture needs no band machinery.
    if (visibleMasks.length === 0) {
      const canvas = await domToCanvas(cloned, {
        scale: options.scale,
        style: {
          transform: 'none',
          transformOrigin: '0 0'
        }
      })
      const ctx = canvas.getContext('2d')
      if (options.background === 'solid' && ctx) {
        solidFill(ctx, canvas.width, canvas.height)
      }
      return encode(canvas)
    }

    // Masked scenes: the foreignObject capture drops the masks' evenodd
    // clip-path wrappers, so z-aware mask semantics must be rebuilt on the
    // raster. The scene renders as z-bands (Scene.tsx): band b is punched by
    // every mask BELOW it, so a mask punches out only content above it and the
    // content beneath it survives inside its region. Bands are captured
    // independently from the clone and composited bottom-up, each punched by
    // its own mask subset.
    const liveMasks = visibleMasks.filter((m) => !m.snapshot)
    const frozenMasks = visibleMasks.filter((m) => m.snapshot)

    const outCanvas = document.createElement('canvas')
    outCanvas.width = scene.canvas.width * options.scale
    outCanvas.height = scene.canvas.height * options.scale
    const outCtx = outCanvas.getContext('2d')

    for (let b = 0; b <= liveMasks.length; b++) {
      const bandCanvas = await captureSceneBandNode(cloned, b, scene.canvas.width, scene.canvas.height, options.scale)
      if (!bandCanvas) continue
      const bandCtx = bandCanvas.getContext('2d')
      punchSceneMaskHoles(bandCtx, liveMasks.slice(0, b), scene.canvas.width, scene.canvas.height, options.scale)
      outCtx?.drawImage(bandCanvas, 0, 0)
    }

    // Frozen masks paint their snapshot layer back over their punched hole.
    for (const mask of frozenMasks) {
      if (outCtx) punchSceneMaskHoles(outCtx, [mask], scene.canvas.width, scene.canvas.height, options.scale)
      const snapNode = cloned.querySelector<HTMLElement>(`[data-mask-snapshot-for="${mask.id}"]`)
      if (snapNode) {
        const snapCanvas = await captureNodeIntoCanvas(snapNode, scene.canvas.width, scene.canvas.height, options.scale)
        if (snapCanvas) {
          const snapCtx = snapCanvas.getContext('2d')
          punchSceneMaskHoles(snapCtx, [mask], scene.canvas.width, scene.canvas.height, options.scale)
          outCtx?.drawImage(snapCanvas, 0, 0)
        }
      }
    }

    if (watermarkOn) {
      const wmNode = cloned.querySelector<HTMLElement>('[data-watermark]')
      if (wmNode) {
        const wmCanvas = await captureNodeIntoCanvas(wmNode, scene.canvas.width, scene.canvas.height, options.scale)
        if (wmCanvas) outCtx?.drawImage(wmCanvas, 0, 0)
      }
    }

    if (options.background === 'solid' && outCtx) {
      solidFill(outCtx, outCanvas.width, outCanvas.height)
    }

    return encode(outCanvas)
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
