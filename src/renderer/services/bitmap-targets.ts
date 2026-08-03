/**
 * bitmap-targets — resolves which element a destructive brush stroke edits,
 * where that element's bitmap lives inside its scene-space box, and how to
 * translate scene-space stroke points into bitmap-local coordinates.
 *
 * Targets (architecture §9.3): image overlays, shapes with a `backgroundImage`,
 * and device screenshots. Device screenshots sit inside a per-device-type
 * bezel inset region, so their origin/size differ from the device element box.
 * The inset fractions mirror the device shell components in
 * `src/renderer/components/devices/` (approximate — min-heights and fixed-px
 * stands are folded into fractions; a documented fidelity trade-off).
 */

import { Device, Scene } from '@shared/types'
import { HitTestResult } from './hit-test'
import { getComposedBox } from './parent-transform'

export interface BitmapTarget {
  elementId: string
  kind: 'device' | 'image' | 'shape'
  src: string | null
  /** Element-local x/y of the bitmap's top-left corner. */
  originX: number
  originY: number
  /** Bitmap canvas size in scene units. */
  width: number
  height: number
  srcKey: 'screenImage' | 'src' | 'backgroundImage'
}

export interface ElementGeometry {
  id: string
  x: number
  y: number
  width: number
  height: number
  rotation: number
}

export interface ScreenRect {
  x: number
  y: number
  width: number
  height: number
}

interface ScreenInsets {
  top: number
  bottom: number
  left: number
  right: number
  topMin?: number
  bottomMin?: number
  bottomFixed?: number
}

/** Bezel-inset fractions of the device element box per device type. */
const SCREEN_INSETS: Record<string, ScreenInsets> = {
  monitor: { top: 0.04, bottom: 0.03, left: 0, right: 0, topMin: 12, bottomMin: 8, bottomFixed: 9 },
  laptop: { top: 0.0276, bottom: 0.0092, left: 0.0184, right: 0.0184 },
  ipad: { top: 0.03, bottom: 0.02, left: 0.02, right: 0.02 },
  phone: { top: 0.02, bottom: 0.02, left: 0.015, right: 0.015 },
  watch: { top: 0.188, bottom: 0.188, left: 0.188, right: 0.188 },
  browser: { top: 0.08, bottom: 0, left: 0, right: 0, topMin: 16 },
  terminal: { top: 0.08, bottom: 0, left: 0, right: 0, topMin: 16 }
}

/** Screen region within the device element box (element-local coords). */
export function resolveScreenRegion(device: Device): ScreenRect {
  const w = device.width
  const h = device.height
  if (device.customFrame?.screenRegion) {
    const r = device.customFrame.screenRegion
    return { x: r.x, y: r.y, width: Math.max(1, r.w), height: Math.max(1, r.h) }
  }
  const insets = SCREEN_INSETS[device.type] ?? SCREEN_INSETS.monitor
  const top = Math.max(insets.top * h, insets.topMin ?? 0)
  const bottom = Math.max(insets.bottom * h, insets.bottomMin ?? 0) + (insets.bottomFixed ?? 0)
  const left = insets.left * w
  const right = insets.right * w
  return {
    x: left,
    y: top,
    width: Math.max(1, w - left - right),
    height: Math.max(1, h - top - bottom)
  }
}

/**
 * Resolves the bitmap-backed target for a hit element, or null when the
 * element kind carries no raster bitmap (textBox, image/shape without a src).
 *
 * Shapes without a backgroundImage now return a target with `src: null` —
 * the destructive commit pipeline rasterizes the shape's current fill
 * on-demand (see `ensureBitmapSrc` in destructive.ts) so erasing works on
 * any shape, not just those with a pre-existing bitmap.
 */
export function resolveBitmapTarget(scene: Scene, hit: HitTestResult): BitmapTarget | null {
  if (hit.kind === 'image') {
    const img = scene.images.find((i) => i.id === hit.id)
    if (!img || !img.src) return null
    return {
      elementId: img.id,
      kind: 'image',
      src: img.src,
      originX: 0,
      originY: 0,
      width: img.width,
      height: img.height,
      srcKey: 'src'
    }
  }
  if (hit.kind === 'shape') {
    const shape = scene.shapes.find((s) => s.id === hit.id)
    if (!shape) return null
    // Shapes without a backgroundImage can still be erased/blurred — the
    // destructive commit pipeline rasterizes the shape's current fill
    // on-demand (see `ensureBitmapSrc` in destructive.ts) and stores the
    // result as the shape's backgroundImage.
    return {
      elementId: shape.id,
      kind: 'shape',
      src: shape.backgroundImage,
      originX: 0,
      originY: 0,
      width: shape.width,
      height: shape.height,
      srcKey: 'backgroundImage'
    }
  }
  if (hit.kind === 'device') {
    const dev = scene.devices.find((d) => d.id === hit.id)
    if (!dev || !dev.screenImage) return null
    const region = resolveScreenRegion(dev)
    return {
      elementId: dev.id,
      kind: 'device',
      src: dev.screenImage,
      originX: region.x,
      originY: region.y,
      width: region.width,
      height: region.height,
      srcKey: 'screenImage'
    }
  }
  return null
}

/**
 * Resolves the composed scene-space geometry of the hit element. Children
 * (elements with a `containerId`) resolve through `getComposedBox`, so the
 * returned box + total rotation position `toLocalPoint` correctly even under
 * a moved/rotated parent chain. textBox returns null (not a bitmap target).
 */
export function resolveElementGeometry(scene: Scene, hit: HitTestResult): ElementGeometry | null {
  if (hit.kind !== 'device' && hit.kind !== 'image' && hit.kind !== 'shape') return null
  const box = getComposedBox(scene, hit.id)
  if (!box) return null
  return { id: box.id, x: box.x, y: box.y, width: box.width, height: box.height, rotation: box.rotation ?? 0 }
}

/**
 * Translates a scene-space point into bitmap-local coordinates for a target.
 * Handles element rotation by inverse-rotating around the element center, then
 * subtracting the element origin and the bitmap's element-local origin.
 */
export function toLocalPoint(
  element: ElementGeometry,
  target: Pick<BitmapTarget, 'originX' | 'originY'>,
  point: { x: number; y: number }
): { x: number; y: number } {
  const cx = element.x + element.width / 2
  const cy = element.y + element.height / 2
  const dx = point.x - cx
  const dy = point.y - cy
  const rad = (-element.rotation * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  return {
    x: dx * cos - dy * sin + element.width / 2 - target.originX,
    y: dx * sin + dy * cos + element.height / 2 - target.originY
  }
}
