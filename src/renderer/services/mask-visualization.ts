/**
 * mask-visualization — pure mask geometry for the overlay renderer.
 *
 * Everything the checkerboard `MaskOverlay` needs is computed here from scene
 * data (no DOM reads): the CSS clip-path that a mask applies to the canvas (and
 * the inverted "punch" clip that describes the transparent region), the
 * per-mask scene-space visuals, and the live stroke preview converted to a
 * visual.
 *
 * Masks are independent scene layers with SCENE-space geometry: each mask spans
 * the whole canvas (`x/y/width/height/points` in canvas coordinates) and clips
 * via `buildMaskClipPath(mask, canvasW, canvasH)`. Inversion ("punch") uses
 * evenodd clip-path compositing: the full canvas as the outer contour plus the
 * mask shape as a hole. Ellipse holes are approximated as a 32-point polygon.
 */

import { Mask, MaskPoint, MaskShape, Scene } from '@shared/types'
import { buildMaskStrokePolygon } from './mask-brush'
import { ringCoversBox } from './mask-diff'
import { MaskPreviewState } from '../runtime/runtimeSlice'

export interface MaskVisualItem {
  maskId: string
  shape: MaskShape
  inverted: boolean
  /** Clip-path of the transparent (masked-out) region — checkerboard area. */
  hiddenClipPath: string
  /** Clip-path of the visible (kept) region — used for the editing highlight. */
  visibleClipPath: string
  /** Mask bounding box in scene coordinates. */
  rect: { x: number; y: number; width: number; height: number }
  /** Brush (freehand) polygon in scene coordinates (null for rect/ellipse). */
  points: MaskPoint[] | null
  /** Restored-area rings carved out of a punch (subtractive unmask). */
  holes: MaskPoint[][] | null
}

export interface MaskVisual {
  maskId: string
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
 * Resolves every visible mask to a scene-space visual. Each mask spans the whole
 * canvas (origin 0,0, canvas dims, rotation 0) and stacks by its own `zIndex`,
 * so checkerboards align with the canvas exactly like the mask clip layers.
 */
export function collectMaskVisuals(scene: Scene, options: MaskVisualOptions = { targets: 'all' }): MaskVisual[] {
  const wanted = options.targets === 'ids' ? new Set(options.ids ?? []) : null
  const visuals: MaskVisual[] = []
  for (const mask of scene.masks) {
    // Frozen masks render their own snapshot content inside the mask clip
    // layers — their hidden region shows the captured canvas, not checkerboard
    // transparency, so the overlay must not draw a checkerboard for them.
    if (mask.snapshot) continue
    if (!mask.visible) continue
    if (wanted && !wanted.has(mask.id)) continue
    visuals.push({
      maskId: mask.id,
      origin: { x: 0, y: 0 },
      width: scene.canvas.width,
      height: scene.canvas.height,
      rotation: 0,
      zIndex: mask.zIndex,
      items: [maskToVisualItem(mask, scene.canvas.width, scene.canvas.height)]
    })
  }
  return visuals.sort((a, b) => a.zIndex - b.zIndex)
}

/**
 * Converts a live mask stroke (`maskPreview` from the runtime store) into a
 * scene-space visual so the overlay renders the same shape that will commit.
 * Stroke points are already in scene coordinates. Returns null until the stroke
 * has enough geometry.
 */
export function previewToMaskVisual(preview: MaskPreviewState, canvasWidth: number, canvasHeight: number): MaskVisual | null {
  if (preview.points.length === 0) return null
  let synthetic: Mask
  if (preview.shape === 'brush') {
    const polygon = buildMaskStrokePolygon(preview.points, preview.radius ?? 8)
    const minX = Math.min(...polygon.map((p) => p.x))
    const minY = Math.min(...polygon.map((p) => p.y))
    const maxX = Math.max(...polygon.map((p) => p.x))
    const maxY = Math.max(...polygon.map((p) => p.y))
    synthetic = {
      id: '__mask_preview__',
      name: 'Mask',
      shape: 'brush',
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
      points: polygon,
      inverted: preview.inverted,
      zIndex: 0,
      visible: true,
      locked: false
    }
  } else {
    const a = preview.points[0]
    const b = preview.points[1] ?? a
    synthetic = {
      id: '__mask_preview__',
      name: 'Mask',
      shape: preview.shape,
      x: Math.min(a.x, b.x),
      y: Math.min(a.y, b.y),
      width: Math.abs(b.x - a.x),
      height: Math.abs(b.y - a.y),
      points: [],
      inverted: preview.inverted,
      zIndex: 0,
      visible: true,
      locked: false
    }
  }
  return {
    maskId: '__mask_preview__',
    origin: { x: 0, y: 0 },
    width: canvasWidth,
    height: canvasHeight,
    rotation: 0,
    zIndex: 0,
    items: [maskToVisualItem(synthetic, canvasWidth, canvasHeight)]
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
