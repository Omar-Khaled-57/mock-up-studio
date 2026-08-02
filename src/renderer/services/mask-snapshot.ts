/**
 * mask-snapshot — Frozen-mask capture service.
 *
 * A frozen mask embeds an immutable freeze stamp of the whole scene, captured
 * at the moment the mask was created (or last refreshed). The stamp is a PNG
 * data URL produced by rendering `[data-scene-export]` offscreen and cropping
 * it to the target element's scene-space bounding box, so the masked region
 * shows exactly what the canvas looked like at capture time — including other
 * layers, z-order, and the scene background. Later edits to layers, z-order or
 * new content can never leak into a frozen mask; only an explicit refresh
 * rewrites the snapshot.
 *
 * Capture uses the same clone-strip-offscreen-cleanup pattern as the export
 * engine. Transient editor chrome (`data-watermark`, `data-guide`) is stripped,
 * but `[data-scene-background]` is KEPT (unlike solid/transparent exports) —
 * the scene background is part of the canvas appearance being frozen.
 *
 * The service never mutates document state: it returns `null` when there is no
 * scene DOM (e.g. unit tests, early lifecycle), letting callers fall back to a
 * geometry-only mask with no snapshot.
 */

import { domToCanvas } from 'modern-screenshot'
import type { MaskSnapshot } from '../../shared/types'

/**
 * Pixel ratio between scene units and snapshot pixels. 1 keeps the stamp
 * 1:1 with scene units; rendering scales the image to `sourceBounds` in scene
 * units regardless, so this value only affects fidelity (not layout).
 */
export const MASK_SNAPSHOT_SCALE = 1

/** A scene-space rectangle the snapshot should cover. */
export interface SnapshotBounds {
  x: number
  y: number
  width: number
  height: number
}

/**
 * True when a snapshot capture can possibly succeed — i.e. a scene DOM node
 * exists. Callers use this to keep the commit path synchronous when there is
 * nothing to capture (unit tests, early lifecycle): a geometry-only mask is
 * committed immediately and behaves like a live clip until the Refresh action
 * freezes it.
 */
export function canCaptureMaskSnapshot(): boolean {
  return document.querySelector('[data-scene-export]') != null
}

/**
 * Captures a frozen snapshot of the whole scene cropped to `bounds`.
 * Returns null when the scene DOM is unavailable or rendering fails.
 */
export async function captureMaskSnapshot(bounds: SnapshotBounds): Promise<MaskSnapshot | null> {
  const sceneNode = document.querySelector('[data-scene-export]') as HTMLElement | null
  if (!sceneNode) return null

  const cloned = sceneNode.cloneNode(true) as HTMLElement
  cloned.style.position = 'fixed'
  cloned.style.left = '-99999px'
  cloned.style.top = '0'
  cloned.style.transform = 'none'
  cloned.style.margin = '0'

  document.body.appendChild(cloned)

  // Transient editor chrome must never appear in a frozen stamp.
  cloned.querySelectorAll('[data-watermark], [data-guide]').forEach((el) => el.remove())

  try {
    const canvas = await domToCanvas(cloned, {
      scale: MASK_SNAPSHOT_SCALE,
      style: {
        transform: 'none',
        transformOrigin: '0 0'
      }
    })

    const width = Math.round(bounds.width * MASK_SNAPSHOT_SCALE)
    const height = Math.round(bounds.height * MASK_SNAPSHOT_SCALE)
    if (width <= 0 || height <= 0) return null

    // Crop the full-scene capture to the element's bounding box.
    const out = document.createElement('canvas')
    out.width = width
    out.height = height
    const ctx = out.getContext('2d')
    if (!ctx) return null
    ctx.drawImage(canvas, -bounds.x * MASK_SNAPSHOT_SCALE, -bounds.y * MASK_SNAPSHOT_SCALE)

    const dataUrl = out.toDataURL('image/png')
    if (!dataUrl || dataUrl === 'data:,') return null

    return {
      dataUrl,
      width,
      height,
      sourceBounds: { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height },
      capturedAt: Date.now()
    }
  } catch (err) {
    console.error('Mask snapshot capture failed:', err)
    return null
  } finally {
    document.body.removeChild(cloned)
  }
}
