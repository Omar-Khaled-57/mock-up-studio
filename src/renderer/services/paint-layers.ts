/**
 * paint-layers — per-scene paint-layer registry.
 *
 * Paint strokes commit into raster **paint layers**, which are ordinary
 * `ImageOverlay` elements cropped to the stroke's bounds and stored in the
 * scene's `images` array. They serialize/round-trip through the existing
 * asset pipeline with no format change (architecture §18.1).
 *
 * Contract:
 *   - A paint layer is identified by its name: a friendly sequential label
 *     (`Paint 1`, `Paint 2`, …) via the `PAINT_LAYER_PREFIX` marker, or the
 *     legacy `PAINT_LAYER_NAME` marker from pre-naming builds. No schema
 *     field is added; the architecture forbids a format change. Renaming a
 *     paint layer (e.g. in the Layers panel) removes the marker and promotes
 *     it to a regular image overlay.
 *   - **Each stroke is its own layer** — `createPaintLayer` is called once per
 *     committed stroke with the stroke-only bitmap, so a scene accumulates one
 *     distinct layer per stroke instead of compositing everything onto a
 *     single shared layer. `resolvePaintCommit` always starts from a fresh
 *     canvas cropped to the stroke bounds.
 *   - Paint layers are editor-internal: they render on canvas and appear in
 *     the Layers panel (with their friendly name) but are filtered out of the
 *     Images panel so users never manage them as imported images.
 */

import { ImageOverlay, Scene } from '@shared/types'
import { generateId } from '../lib/id'
import { StrokePoint } from './stroke'
import { compositeStrokeToRegion, CropRegion, StrokeBrush, StrokeComposite } from './rasterizer'

/** Legacy marker used by pre-naming builds (kept for load-time detection). */
export const PAINT_LAYER_NAME = '__paint_layer__'

/** Friendly display prefix for paint layer names, e.g. "Paint 3". */
export const PAINT_LAYER_PREFIX = 'Paint '

export function isPaintLayer(image: ImageOverlay): boolean {
  return image.name === PAINT_LAYER_NAME || image.name.startsWith(PAINT_LAYER_PREFIX)
}

/** Friendly sequential name for the next paint layer, e.g. "Paint 3". */
export function nextPaintLayerName(scene: Scene): string {
  let count = 0
  for (const image of scene.images) {
    if (isPaintLayer(image)) count++
  }
  return `${PAINT_LAYER_PREFIX}${count + 1}`
}

/** Highest zIndex across every element kind, plus one (paint layers sit on top). */
export function nextPaintLayerZIndex(scene: Scene): number {
  let max = -1
  for (const list of [scene.devices, scene.textBoxes, scene.images, scene.shapes]) {
    for (const el of list) {
      if (el.zIndex > max) max = el.zIndex
    }
  }
  return max + 1
}

export function createPaintLayer(
  scene: Scene,
  src: string,
  groupId: string | null,
  region: CropRegion,
  containerId: string | null = null
): ImageOverlay {
  return {
    id: generateId(),
    name: nextPaintLayerName(scene),
    src,
    x: region.x,
    y: region.y,
    width: region.width,
    height: region.height,
    rotation: 0,
    opacity: 100,
    borderRadius: 0,
    blendMode: 'normal',
    flipX: false,
    flipY: false,
    blur: 0,
    glow: [],
    shadow: [],
    zIndex: nextPaintLayerZIndex(scene),
    locked: false,
    visible: true,
    groupId,
    containerId
  }
}

/**
 * Rasterizes one committed stroke into its own layer bitmap (a fresh canvas
 * cropped to the stroke bounds) and returns the data URL plus the scene-space
 * region it covers. Returns null when the stroke is entirely off-canvas or no
 * 2d context exists.
 */
export async function resolvePaintCommit(
  scene: Scene,
  points: readonly StrokePoint[],
  brush: StrokeBrush
): Promise<StrokeComposite | null> {
  return compositeStrokeToRegion(
    null,
    null,
    points,
    brush,
    scene.canvas.width,
    scene.canvas.height
  )
}
