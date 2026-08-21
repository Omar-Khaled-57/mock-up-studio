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
import { differenceRegion, Region, ringArea } from './polygon-clip'
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
 * MULTI-CONTOUR clips are emitted as `path()` with explicit winding (nonzero
 * fill) — NOT `polygon(evenodd, …)`. Real-Chromium probes (Electron 33.4.11,
 * `path-probe.cjs`) proved multi-contour evenodd polygons are broken: the
 * vertex shared between the closing outer contour and the next inner contour
 * gets sewn into one continuous path, corrupting the region (disjoint boxes
 * render partial-dimmed). `path()` with explicit `M … Z` subpaths wound
 * OPPOSITE to the base ring is the only verified-correct format:
 *
 * - inverted partial punch (`box ∖ (shape ∖ holes)`): box ring (base) + shape
 *   ring (opposed) + hole rings (aligned). The nonzero fill keeps the box,
 *   punches the shape out, and restores the holes inside it — so a reveal
 *   carved into a punch shows the original content through the hole.
 * - non-inverted mask with holes, and box-covering punches with holes
 *   (`outer ∖ holes`): outer ring (base) + hole rings (opposed).
 *
 * Single-contour clips (rect `inset()`, ellipse `ellipse()`, plain
 * `polygon()`) keep their native forms — with one contour there is nothing to
 * join, so no corruption risk.
 *
 * A box-covering inverted mask (its outer contour already spans the whole
 * element box) emits the outer contour directly instead of pairing it with a
 * second box contour: emitting both would be a self-cancelling double contour
 * (evenodd parity flips twice over the box) that renders as an EMPTY clip — a
 * whole-canvas mask must hide the box, not leave it exposed.
 */
export function buildMaskClipPath(mask: Mask, width: number, height: number): string {
  const holes = mask.holes?.length ? mask.holes : undefined
  const outerRing = maskOuterRing(mask)
  const outer = formatRing(outerRing)

  if (mask.inverted) {
    if (ringCoversBox(outerRing, width, height)) {
      if (holes) return nonzeroPath(outerRing, holes, [])
      return `polygon(evenodd, ${outer})`
    }
    return nonzeroPath(boxRing(width, height), [outerRing], holes ?? [])
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
  return nonzeroPath(outerRing, holes, [])
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
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const p of polygon) {
      if (p.x < minX) minX = p.x
      if (p.y < minY) minY = p.y
      if (p.x > maxX) maxX = p.x
      if (p.y > maxY) maxY = p.y
    }
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
/**
 * A single focus-scope member box fed to the dim punch.
 */
export interface DimBox {
  x: number
  y: number
  width: number
  height: number
  rotation?: number
}

/** A member box as a simple (convex) polygon region. */
function dimBoxRegion(b: DimBox): Region {
  return { outer: rotatedBoxCorners(b.x, b.y, b.width, b.height, b.rotation ?? 0), holes: [] }
}

/**
 * Disjoint regions covering the UNION of the member boxes. The dim punch MUST
 * emit non-overlapping contours: evenodd is an XOR, so overlapping contours
 * re-darken the overlap while leaving the non-overlapping lobes lit (the
 * "ribbon triangles"). Built by successively subtracting every already-kept
 * region out of each incoming box, so the residuals are interior-disjoint by
 * construction and their evenodd parity is exactly 1 across the whole union.
 */
export function unionDimBoxes(boxes: DimBox[]): Region[] {
  const result: Region[] = []
  for (const box of boxes) {
    let residuals: Region[] = [dimBoxRegion(box)]
    for (const acc of result) {
      const rings = [acc.outer, ...acc.holes]
      const next: Region[] = []
      for (const res of residuals) {
        let cur: Region[] = [res]
        for (const ring of rings) {
          const pass: Region[] = []
          for (const subj of cur) pass.push(...differenceRegion(subj, ring))
          cur = pass
        }
        next.push(...cur)
      }
      residuals = next
    }
    result.push(...residuals)
  }
  return result
}

/** Signed shoelace winding of a ring (+1 with the canvas ring's winding). */
function ringSign(ring: { x: number; y: number }[]): 1 | -1 {
  return ringArea(ring) >= 0 ? 1 : -1
}

/** Returns the ring in the requested winding, reversing only when needed. */
function orientRing(ring: { x: number; y: number }[], wantSign: 1 | -1): { x: number; y: number }[] {
  return ringSign(ring) === wantSign ? ring : [...ring].reverse()
}

/** A closed `M … L … Z` subpath (unitless, matching the Electron-verified form). */
function pathRing(ring: { x: number; y: number }[]): string {
  const pts = ring.map((c) => `${Math.round(c.x * 100) / 100} ${Math.round(c.y * 100) / 100}`)
  return `M ${pts.join(' L ')} Z`
}

/** The target box as a ring (matches the focus-dim canvas ring winding). */
function boxRing(width: number, height: number): { x: number; y: number }[] {
  return [
    { x: 0, y: 0 },
    { x: width, y: 0 },
    { x: width, y: height },
    { x: 0, y: height }
  ]
}

/**
 * Nonzero `path()` clip built from a base ring plus wound contours: `opposed`
 * rings are wound OPPOSITE to the base (the nonzero fill punches them out),
 * `aligned` rings are wound the same as the base (their interior is kept
 * through a punch, restoring it). This is the probe-verified multi-contour
 * form — evenodd `polygon()` with multiple contours is corrupted by Chromium.
 */
function nonzeroPath(
  base: { x: number; y: number }[],
  opposed: { x: number; y: number }[][],
  aligned: { x: number; y: number }[][]
): string {
  const baseSign = ringSign(base)
  const subpaths: string[] = [pathRing(base)]
  for (const ring of opposed) subpaths.push(pathRing(orientRing(ring, baseSign === 1 ? -1 : 1)))
  for (const ring of aligned) subpaths.push(pathRing(orientRing(ring, baseSign)))
  return `path('${subpaths.join(' ')}')`
}

/**
 * Nonzero punch clip for the focus scrim: the whole canvas minus the UNION of
 * the exact (rotated) boxes of every visible scope member. Emitted as a CSS
 * `path()` with the canvas ring wound one way and every region contour wound
 * the OPPOSITE way, so the nonzero fill-rule punches the union out of the
 * scrim.
 *
 * This is REQUIRED, not cosmetic. Real-Chromium probes (Electron 33.4.11,
 * `path-probe.cjs`) proved `polygon(evenodd, …)` with multiple contours is
 * broken: the vertex shared between the closing outer contour and the next
 * inner contour gets sewn into one continuous path, corrupting the region
 * (disjoint boxes render partial-dimmed). `path()` with explicit closed
 * subpaths and opposite winding is the only verified-correct format. The
 * member boxes are still pre-merged via `unionDimBoxes` so contours never
 * overlap (an evenodd XOR would re-darken overlaps into "ribbon triangles").
 * Null when the canvas is degenerate or no boxes remain.
 */
export function buildFocusDimPunch(
  canvasWidth: number,
  canvasHeight: number,
  boxes: DimBox[]
): string | null {
  if (canvasWidth <= 0 || canvasHeight <= 0 || boxes.length === 0) return null
  const regions = unionDimBoxes(boxes)
  if (regions.length === 0) return null
  const canvasRing = [
    { x: 0, y: 0 },
    { x: canvasWidth, y: 0 },
    { x: canvasWidth, y: canvasHeight },
    { x: 0, y: canvasHeight }
  ]
  const canvasSign = ringSign(canvasRing)
  const subpaths: string[] = [pathRing(canvasRing)]
  for (const region of regions) {
    // Region outers oppose the canvas ring → nonzero fill punches them out.
    subpaths.push(pathRing(orientRing(region.outer, canvasSign === 1 ? -1 : 1)))
    // Region holes match the canvas ring → their interior stays dim (not punched).
    for (const hole of region.holes) {
      subpaths.push(pathRing(orientRing(hole, canvasSign)))
    }
  }
  return `path('${subpaths.join(' ')}')`
}

/**
 * Single-box focus punch (kept for compatibility; delegates to the multi-box
 * builder so the two can never drift).
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
  return buildFocusDimPunch(canvasWidth, canvasHeight, [{ x, y, width, height, rotation }])
}
