/**
 * mask-diff — subtractive unmask.
 *
 * The Mask tool's unmask mode must ERASE previously applied masks (restore
 * content) by exactly subtracting the drawn stroke from each existing mask's
 * masked-out region. A reveal clip can never do that — `(scene ∖ A) ∩ R` only
 * hides more — so the subtraction happens in the data model with real polygon
 * boolean difference (`polygon-clip.differenceRegion`).
 *
 * Every mask is interpreted through its masked-out ("hidden") region, in
 * SCENE-space coordinates:
 *   - inverted (punch):      hidden = shape ∖ holes
 *   - non-inverted (reveal): hidden = canvas box ∖ shape ∖ holes
 *
 * An unmask stroke is a simple ring in scene coordinates. Each scene mask whose
 * hidden region the stroke touches is carved:
 *   - masks the stroke never touches are left untouched (a no-op stroke
 *     changes nothing and pushes no history entry),
 *   - fully-erased masks are removed,
 *   - everything else is replaced by one `brush`-shape mask per residual
 *     connected region (outer + holes). Residuals are always inverted (they
 *     directly encode the residual hidden region), stay free scene layers, and
 *     inherit the source mask's layer fields (`name`/`zIndex`/`visible`/`locked`).
 *
 * A stroke over a reveal (non-inverted) mask removes the reveal entirely —
 * kept shape or hidden frame. The reveal's hidden region is the whole canvas
 * box, so every carve there is a dead end (it can only leave the whole canvas
 * hidden again); drawing anywhere on the target signals the reveal is unwanted
 * (the recovery path for stale whole-canvas checkerboards).
 *
 * A residual whose outer ring still spans the whole canvas box is the
 * degenerate "unmask restored only interior holes" state — the mask hides the
 * entire canvas again after the carve. Such box-covering residuals are dropped
 * (the mask is removed) so an unmask stroke clears a whole-canvas punch rather
 * than leaving it masked.
 *
 * Invisible or locked masks are never carved (left untouched).
 */

import { Mask } from '@shared/types'
import {
  Ring,
  Region,
  differenceRegion,
  isDegenerateRing,
  normalizeRing,
  pointInRegion,
  ringArea,
  segmentIntersection
} from './polygon-clip'
import { boundsOf } from './mask-brush'
import { generateId } from '../lib/id'

const ELLIPSE_SEGMENTS = 32

function round2(v: number): number {
  return Math.round(v * 100) / 100
}

/** Axis-aligned rectangle ring (top-left → top-right → bottom-right → bottom-left). */
export function rectRing(x: number, y: number, width: number, height: number): Ring {
  return [
    { x, y },
    { x: x + width, y },
    { x: x + width, y: y + height },
    { x, y: y + height }
  ]
}

/** 32-gon approximation of an axis-aligned ellipse, matching the clip renderer. */
export function ellipseRing(x: number, y: number, width: number, height: number): Ring {
  const cx = x + width / 2
  const cy = y + height / 2
  const rx = width / 2
  const ry = height / 2
  const ring: Ring = []
  for (let i = 0; i < ELLIPSE_SEGMENTS; i++) {
    const t = (i / ELLIPSE_SEGMENTS) * Math.PI * 2
    ring.push({ x: cx + rx * Math.cos(t), y: cy + ry * Math.sin(t) })
  }
  return ring
}

/**
 * True when a ring's boundary spans the whole element box — the degenerate
 * "mask hides everything" state. Used to drop residuals that an unmask stroke
 * barely changed (the carve only cut interior holes), so unmask can clear a
 * whole-canvas mask instead of leaving a box-covering residual behind. Also
 * the renderer's guard against emitting a self-cancelling evenodd double
 * contour for such masks.
 */
export function ringCoversBox(ring: Ring, width: number, height: number): boolean {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of ring) {
    if (p.x < minX) minX = p.x
    if (p.y < minY) minY = p.y
    if (p.x > maxX) maxX = p.x
    if (p.y > maxY) maxY = p.y
  }
  const TOL = 0.5
  if (minX > TOL || minY > TOL || maxX < width - TOL || maxY < height - TOL) return false
  return Math.abs(ringArea(ring)) >= width * height - 1
}

function shapeRing(mask: Mask): Ring {
  if (mask.shape === 'rectangle') return rectRing(mask.x, mask.y, mask.width, mask.height)
  if (mask.shape === 'ellipse') return ellipseRing(mask.x, mask.y, mask.width, mask.height)
  return mask.points.map((p) => ({ x: p.x, y: p.y }))
}

/** The hidden (masked-out) region a mask contributes, as a polygon region. */
function maskHiddenRegion(mask: Mask, width: number, height: number): Region {
  const shape = shapeRing(mask)
  const holes = (mask.holes ?? []).map((h) => h.map((p) => ({ x: p.x, y: p.y })))
  if (mask.inverted) return { outer: shape, holes }
  // Reveal: hidden = element box minus the keep shape.
  return { outer: rectRing(0, 0, width, height), holes: [shape, ...holes] }
}

function ringsTouch(a: Ring, b: Ring): boolean {
  for (let i = 0; i < a.length; i++) {
    for (let j = 0; j < b.length; j++) {
      if (segmentIntersection(a[i], a[(i + 1) % a.length], b[j], b[(j + 1) % b.length])) return true
    }
  }
  return false
}

/** True when the clip ring shares any boundary or interior point with the region. */
function regionTouchesClip(region: Region, clip: Ring): boolean {
  const rings = [region.outer, ...region.holes]
  for (const r of rings) if (ringsTouch(r, clip)) return true
  for (const p of clip) if (pointInRegion(p, rings)) return true
  for (const r of rings) for (const p of r) if (pointInRegion(p, [clip])) return true
  return false
}

function ringsEqual(a: Ring, b: Ring): boolean {
  if (a.length !== b.length) return false
  const n = a.length
  // Rotation-agnostic: the diff may re-trace a ring starting from a different
  // vertex (e.g. a coincident hole re-assembled from clip edges), so compare
  // against every cyclic rotation of b.
  outer: for (let r = 0; r < n; r++) {
    for (let i = 0; i < n; i++) {
      if (Math.abs(a[i].x - b[(r + i) % n].x) > 1e-6 || Math.abs(a[i].y - b[(r + i) % n].y) > 1e-6) continue outer
    }
    return true
  }
  return false
}

function regionEqual(a: Region, b: Region): boolean {
  if (!ringsEqual(a.outer, b.outer)) return false
  if (a.holes.length !== b.holes.length) return false
  const norm = (r: Ring) => normalizeRing(r, true)
  const bHoles = b.holes.map(norm)
  return a.holes.every((h) => bHoles.some((other) => ringsEqual(norm(h), other)))
}

/**
 * Encodes one residual connected region as an inverted brush mask. The residual
 * stays a free scene layer and inherits its source mask's layer fields
 * (`name`/`zIndex`/`visible`/`locked`) and frozen `snapshot` (a carve into a
 * frozen mask must keep showing the frozen content — geometry alone is
 * rewritten).
 */
function regionToMask(source: Mask, region: Region): Mask {
  const points = region.outer.map((p) => ({ x: round2(p.x), y: round2(p.y) }))
  const box = boundsOf(points)
  const holes = region.holes
    .filter((h) => !isDegenerateRing(h))
    .map((h) => h.map((p) => ({ x: round2(p.x), y: round2(p.y) })))
  const mask: Mask = {
    id: generateId(),
    name: source.name,
    shape: 'brush',
    x: round2(box.x),
    y: round2(box.y),
    width: round2(box.width),
    height: round2(box.height),
    points,
    inverted: true,
    zIndex: source.zIndex,
    visible: source.visible,
    locked: source.locked
  }
  if (holes.length > 0) mask.holes = holes
  if (source.snapshot) mask.snapshot = source.snapshot
  return mask
}

/**
 * Resolves a subtractive unmask stroke against the scene's masks. Returns the
 * scene's new mask list, or `null` when the stroke erased nothing (no visible,
 * unlocked mask's hidden region overlaps the stroke — a no-op, so no history
 * entry).
 *
 * Invisible or locked masks are never carved (left untouched, by reference).
 *
 * Reveal (non-inverted) masks are removed entirely when the stroke touches the
 * canvas at all: their hidden region is the whole canvas box, so any stroke is
 * a dead-end carve that signals the reveal is unwanted (the whole-canvas
 * checkerboard dead end). Box-covering residuals are dropped the same way — a
 * carve that only cut interior holes must clear the mask, not leave the whole
 * canvas hidden again.
 */
export function resolveUnmaskCommit(
  masks: Mask[],
  stroke: Ring,
  width: number,
  height: number
): Mask[] | null {
  const result: Mask[] = []
  let changed = false
  const canvasBox: Region = { outer: rectRing(0, 0, width, height), holes: [] }
  for (const mask of masks) {
    if (!mask.visible || mask.locked) {
      result.push(mask)
      continue
    }
    // Reveal masks hide the frame around a kept shape; their hidden region is
    // the whole canvas box, so an unmask stroke anywhere on the target (kept
    // shape or hidden frame) is inside the hidden complement and can only leave
    // the entire canvas hidden. Drawing there means the mask is unwanted —
    // remove it entirely (the whole-canvas checkerboard recovery path).
    if (!mask.inverted && regionTouchesClip(canvasBox, stroke)) {
      changed = true
      continue
    }
    const hidden = maskHiddenRegion(mask, width, height)
    if (!regionTouchesClip(hidden, stroke)) {
      result.push(mask)
      continue
    }
    const subject: Region = {
      outer: normalizeRing(hidden.outer, true),
      holes: hidden.holes.map((h) => normalizeRing(h, false))
    }
    const residual = differenceRegion(subject, stroke).filter((r) => !isDegenerateRing(r.outer))
    if (residual.length === 0) {
      // The stroke fully covered this mask's hidden region — it is erased.
      changed = true
      continue
    }
    if (residual.length === 1 && regionEqual(residual[0], subject)) {
      // Touched but geometrically unchanged (e.g. a coincident hole boundary).
      result.push(mask)
      continue
    }
    // A residual whose outer ring is still the whole canvas box hides
    // everything again — the "unmask restored only interior holes" state. The
    // stroke is a clear gesture, so drop it (remove the mask entirely) instead
    // of committing a box-covering brush that keeps the canvas checkerboarded.
    const meaningful = residual.filter((r) => !ringCoversBox(r.outer, width, height))
    if (meaningful.length === 0) {
      changed = true
      continue
    }
    changed = true
    for (const r of meaningful) result.push(regionToMask(mask, r))
  }
  return changed ? result : null
}
