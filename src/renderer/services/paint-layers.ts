/**
 * paint-layers — per-scene paint-layer registry.
 *
 * Paint strokes commit into raster **paint layers**, which are ordinary
 * `ImageOverlay` elements sized to the whole canvas and stored in the scene's
 * `images` array. They serialize/round-trip through the existing asset
 * pipeline with no format change (architecture §18.1).
 *
 * Contract:
 *   - A paint layer is identified by `name === PAINT_LAYER_NAME` (no schema
 *     field is added; the architecture forbids a format change).
 *   - `findActivePaintLayer` returns the topmost paint layer — new strokes
 *     composite over it so a scene accumulates at most one active layer.
 *   - Each stroke recomposites the whole layer bitmap into a fresh data URL
 *     (documented constraint: paint layers are bounded by canvas size).
 */

import { ImageOverlay, Scene } from '@shared/types'
import { generateId } from '../lib/id'
import { StrokePoint } from './stroke'
import { compositeStrokeToDataUrl, StrokeBrush } from './rasterizer'

export const PAINT_LAYER_NAME = '__paint_layer__'

export function isPaintLayer(image: ImageOverlay): boolean {
  return image.name === PAINT_LAYER_NAME
}

/** Topmost paint layer in the scene, or null when no paint content exists. */
export function findActivePaintLayer(scene: Scene): ImageOverlay | null {
  let top: ImageOverlay | null = null
  for (const image of scene.images) {
    if (isPaintLayer(image) && (!top || image.zIndex > top.zIndex)) top = image
  }
  return top
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
  containerId: string | null = null
): ImageOverlay {
  return {
    id: generateId(),
    name: PAINT_LAYER_NAME,
    src,
    x: 0,
    y: 0,
    width: scene.canvas.width,
    height: scene.canvas.height,
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
 * Composites a stroke over the existing paint layer bitmap (or a fresh canvas)
 * and returns the resulting data URL. Returns null when no 2d context exists.
 */
export async function resolvePaintCommit(
  scene: Scene,
  layer: ImageOverlay | null,
  points: readonly StrokePoint[],
  brush: StrokeBrush
): Promise<string | null> {
  return compositeStrokeToDataUrl(
    layer?.src ?? null,
    points,
    brush,
    scene.canvas.width,
    scene.canvas.height
  )
}
