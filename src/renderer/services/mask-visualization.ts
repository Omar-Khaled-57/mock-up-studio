/**
 * mask-visualization — pure mask geometry for the overlay renderer.
 *
 * Everything the checkerboard `MaskOverlay` needs is computed here from scene
 * data (no DOM reads): the CSS clip-path that masks the target element (and the
 * inverted "punch" clip that describes the transparent region), the grouped
 * scene-space visuals per target element, the live stroke preview converted to
 * a visual, and the focus scrim punch used while editing.
 *
 * Inversion ("punch") uses evenodd clip-path compositing: the full element
 * bounds as the outer contour plus the mask shape as a hole (architecture
 * §10.2). Ellipse holes are approximated as a 32-point polygon.
 */

import { Mask, MaskPoint, MaskShape, Scene } from '@shared/types'
import { isInFocusScope } from './focus'
import { ElementGeometry, toLocalPoint } from './bitmap-targets'
import { buildMaskStrokePolygon } from './mask-brush'
import { ringCoversBox } from './mask-diff'
import { MaskPreviewState } from '../runtime/runtimeSlice'

const ZERO_ORIGIN = { originX: 0, originY: 0 }

/**
 * Sentinel `targetId` for a mask applied to the scene's background/canvas layer.
 * Geometry lives in scene coordinates (origin 0,0, full canvas), so the mask
 * clips the `data-scene-background` layer exactly like an element mask clips
 * its element's local frame.
 */
export const BACKGROUND_MASK_TARGET_ID = '__background__'

export interface MaskVisualItem {
  maskId: string
  shape: MaskShape
  inverted: boolean
  /** Clip-path of the transparent (masked-out) region — checkerboard area. */
  hiddenClipPath: string
  /** Clip-path of the visible (kept) region — used for the editing highlight. */
  visibleClipPath: string
  /** Mask bounding box in element-local coordinates. */
  rect: { x: number; y: number; width: number; height: number }
  /** Brush (freehand) polygon in element-local coordinates (null for rect/ellipse). */
  points: MaskPoint[] | null
  /** Restored-area rings carved out of a punch (subtractive unmask). */
  holes: MaskPoint[][] | null
}

export interface MaskVisual {
  elementId: string
  origin: { x: number; y: number }
  width: number
  height: number
  rotation: number
  zIndex: number
  items: MaskVisualItem[]
}

export interface MaskVisualOptions {
  targets: 'all' | 'ids'
  ids?: string[]
  focusGroupId?: string | null
  focusElementId?: string | null
}

export interface MaskTarget {
  id: string
  x: number
  y: number
  width: number
  height: number
  rotation: number
  visible: boolean
  zIndex: number
}

function fmt(v: number): string {
  return `${Math.round(v * 100) / 100}px`
}

function invertedOuter(width: number, height: number): string {
  return `0px 0px, ${fmt(width)} 0px, ${fmt(width)} ${fmt(height)}, 0px ${fmt(height)}`
}

function ellipseRingPoints(mask: Mask, count: number): { x: number; y: number }[] {
  const cx = mask.x + mask.width / 2
  const cy = mask.y + mask.height / 2
  const rx = mask.width / 2
  const ry = mask.height / 2
  const pts: { x: number; y: number }[] = []
  for (let i = 0; i < count; i++) {
    const t = (i / count) * Math.PI * 2
    pts.push({ x: cx + rx * Math.cos(t), y: cy + ry * Math.sin(t) })
  }
  return pts
}

export function maskOuterRing(mask: Mask): { x: number; y: number }[] {
  if (mask.shape === 'rectangle') {
    return [
      { x: mask.x, y: mask.y },
      { x: mask.x + mask.width, y: mask.y },
      { x: mask.x + mask.width, y: mask.y + mask.height },
      { x: mask.x, y: mask.y + mask.height }
    ]
  }
  if (mask.shape === 'ellipse') return ellipseRingPoints(mask, 32)
  return mask.points
}

function formatRing(points: { x: number; y: number }[]): string {
  return points.map((p) => `${fmt(p.x)} ${fmt(p.y)}`).join(', ')
}

/**
 * Builds the CSS `clip-path` value that a mask applies to its target box of the
 * given local dimensions. Null is never returned for a well-formed mask.
 *
 * Masks with `holes` (restored areas carved out of a brush punch by a
 * subtractive unmask stroke) render as nested evenodd contours: every hole
 * ring contributes to the same `polygon(...)`, and evenodd compositing
 * subtracts them from the shape — so a reveal carved into a punch shows the
 * original content through the hole.
 *
 * A box-covering inverted mask (its outer contour already spans the whole
 * element box) emits the outer contour directly instead of the usual
 * `polygon(box, shape, evenodd)`: emitting both would be a self-cancelling
 * double contour (evenodd parity flips twice over the box) that renders as an
 * EMPTY clip — a whole-canvas mask must hide the box, not leave it exposed.
 */
export function buildMaskClipPath(mask: Mask, width: number, height: number): string {
  const holes = mask.holes?.length ? mask.holes : undefined
  const holeContours = (holes ?? []).map((h) => h.map((p) => `${fmt(p.x)} ${fmt(p.y)}`).join(', '))
  const outerRing = maskOuterRing(mask)
  const outer = formatRing(outerRing)

  if (mask.inverted) {
    if (ringCoversBox(outerRing, width, height)) {
      return `polygon(${[outer, ...holeContours].join(', ')}, evenodd)`
    }
    return `polygon(${invertedOuter(width, height)}, ${[outer, ...holeContours].join(', ')}, evenodd)`
  }

  if (mask.shape === 'rectangle' && !holes) {
    const right = width - mask.x - mask.width
    const bottom = height - mask.y - mask.height
    return `inset(${fmt(mask.y)} ${fmt(right)} ${fmt(bottom)} ${fmt(mask.x)})`
  }
  if (mask.shape === 'ellipse' && !holes) {
    const cx = mask.x + mask.width / 2
    const cy = mask.y + mask.height / 2
    return `ellipse(${fmt(mask.width / 2)} ${fmt(mask.height / 2)} at ${fmt(cx)} ${fmt(cy)})`
  }
  if (!holes) return `polygon(${outer})`
  return `polygon(${[outer, ...holeContours].join(', ')}, evenodd)`
}

/** Clip-path of the transparent region of a mask (the inverted complement). */
export function buildMaskPunchClipPath(mask: Mask, width: number, height: number): string {
  return buildMaskClipPath({ ...mask, inverted: !mask.inverted }, width, height)
}

export function findMaskTarget(scene: Scene, id: string): MaskTarget | null {
  if (id === BACKGROUND_MASK_TARGET_ID) {
    return {
      id,
      x: 0,
      y: 0,
      width: scene.canvas.width,
      height: scene.canvas.height,
      rotation: 0,
      visible: true,
      // Renders behind every element's checkerboard, matching the background.
      zIndex: -1
    }
  }
  const d = scene.devices.find((x) => x.id === id)
  if (d) return { id: d.id, x: d.x, y: d.y, width: d.width, height: d.height, rotation: d.rotation ?? 0, visible: d.visible, zIndex: d.zIndex }
  const t = scene.textBoxes.find((x) => x.id === id)
  if (t) return { id: t.id, x: t.x, y: t.y, width: t.width, height: t.height, rotation: 0, visible: t.visible, zIndex: t.zIndex }
  const i = scene.images.find((x) => x.id === id)
  if (i) return { id: i.id, x: i.x, y: i.y, width: i.width, height: i.height, rotation: i.rotation ?? 0, visible: i.visible, zIndex: i.zIndex }
  const s = scene.shapes.find((x) => x.id === id)
  if (s) return { id: s.id, x: s.x, y: s.y, width: s.width, height: s.height, rotation: s.rotation ?? 0, visible: s.visible, zIndex: s.zIndex }
  return null
}

export function maskToVisualItem(mask: Mask, width: number, height: number): MaskVisualItem {
  return {
    maskId: mask.id,
    shape: mask.shape,
    inverted: mask.inverted,
    hiddenClipPath: buildMaskPunchClipPath(mask, width, height),
    visibleClipPath: buildMaskClipPath(mask, width, height),
    rect: { x: mask.x, y: mask.y, width: mask.width, height: mask.height },
    points: mask.shape === 'brush' ? mask.points : null,
    holes: mask.holes ?? null
  }
}

/**
 * Resolves every visible, in-scope target mask to scene-space visuals, grouped
 * per element and z-sorted (checkerboards stack like the scene itself).
 */
export function collectMaskVisuals(scene: Scene, options: MaskVisualOptions = { targets: 'all' }): MaskVisual[] {
  const wanted = options.targets === 'ids' ? new Set(options.ids ?? []) : null
  const byElement = new Map<string, MaskVisual>()
  for (const mask of scene.masks) {
    // Frozen masks render their own snapshot content inside the element clip
    // layers — their hidden region shows the captured canvas, not checkerboard
    // transparency, so the overlay must not draw a checkerboard for them.
    if (mask.snapshot) continue
    const el = findMaskTarget(scene, mask.targetId)
    if (!el || !el.visible) continue
    if (wanted && !wanted.has(el.id)) continue
    if (
      (options.focusGroupId || options.focusElementId) &&
      !isInFocusScope(el.id, options.focusGroupId ?? null, scene, options.focusElementId ?? null)
    ) {
      continue
    }
    let visual = byElement.get(el.id)
    if (!visual) {
      visual = {
        elementId: el.id,
        origin: { x: el.x, y: el.y },
        width: el.width,
        height: el.height,
        rotation: el.rotation,
        zIndex: el.zIndex,
        items: []
      }
      byElement.set(el.id, visual)
    }
    visual.items.push(maskToVisualItem(mask, el.width, el.height))
  }
  return [...byElement.values()].sort((a, b) => a.zIndex - b.zIndex)
}

/**
 * Converts a live mask stroke (`maskPreview` from the runtime store) into a
 * scene-space visual so the overlay renders the same shape that will commit.
 * Returns null until the stroke has enough geometry.
 */
export function previewToMaskVisual(preview: MaskPreviewState): MaskVisual | null {
  if (preview.points.length === 0) return null
  const el = preview.element
  const element: ElementGeometry = { id: preview.targetId, x: el.x, y: el.y, width: el.width, height: el.height, rotation: el.rotation }
  const localPoints = preview.points.map((p) => toLocalPoint(element, ZERO_ORIGIN, p))
  let synthetic: Mask
  if (preview.shape === 'brush') {
    const polygon = buildMaskStrokePolygon(localPoints, preview.radius ?? 8)
    const minX = Math.min(...polygon.map((p) => p.x))
    const minY = Math.min(...polygon.map((p) => p.y))
    const maxX = Math.max(...polygon.map((p) => p.x))
    const maxY = Math.max(...polygon.map((p) => p.y))
    synthetic = {
      id: '__mask_preview__',
      targetId: preview.targetId,
      shape: 'brush',
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
      points: polygon,
      inverted: preview.inverted
    }
  } else {
    const a = localPoints[0]
    const b = localPoints[1] ?? a
    synthetic = {
      id: '__mask_preview__',
      targetId: preview.targetId,
      shape: preview.shape,
      x: Math.min(a.x, b.x),
      y: Math.min(a.y, b.y),
      width: Math.abs(b.x - a.x),
      height: Math.abs(b.y - a.y),
      points: [],
      inverted: preview.inverted
    }
  }
  return {
    elementId: preview.targetId,
    origin: { x: el.x, y: el.y },
    width: el.width,
    height: el.height,
    rotation: el.rotation,
    zIndex: 0,
    items: [maskToVisualItem(synthetic, el.width, el.height)]
  }
}

/** Scene-space corners of a rotated box (rotation pivot = box center). */
export function rotatedBoxCorners(
  x: number,
  y: number,
  width: number,
  height: number,
  rotation: number
): { x: number; y: number }[] {
  const cx = x + width / 2
  const cy = y + height / 2
  const rad = (rotation * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  return [
    { x: cx - (width / 2) * cos - (-(height / 2) * sin), y: cy - (width / 2) * sin + (-(height / 2) * cos) },
    { x: cx + (width / 2) * cos - (-(height / 2) * sin), y: cy + (width / 2) * sin + (-(height / 2) * cos) },
    { x: cx + (width / 2) * cos - (height / 2) * sin, y: cy + (width / 2) * sin + (height / 2) * cos },
    { x: cx - (width / 2) * cos - (height / 2) * sin, y: cy - (width / 2) * sin + (height / 2) * cos }
  ]
}

/**
 * Evenodd punch clip for the focus scrim: the whole canvas minus a rotated
 * target box. Null when the canvas is degenerate.
 */
export function buildSceneDimPunch(
  canvasWidth: number,
  canvasHeight: number,
  x: number,
  y: number,
  width: number,
  height: number,
  rotation: number
): string | null {
  if (canvasWidth <= 0 || canvasHeight <= 0) return null
  const outer = `0px 0px, ${fmt(canvasWidth)} 0px, ${fmt(canvasWidth)} ${fmt(canvasHeight)}, 0px ${fmt(canvasHeight)}`
  const inner = rotatedBoxCorners(x, y, width, height, rotation)
    .map((c) => `${fmt(c.x)} ${fmt(c.y)}`)
    .join(', ')
  return `polygon(${outer}, ${inner}, evenodd)`
}
