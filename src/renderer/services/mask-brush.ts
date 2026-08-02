/**
 * mask-brush — freehand mask stroke geometry.
 *
 * A brush mask is stored as a closed polygon approximating the capsule strip
 * swept by a disc of `radius` along the sampled centre-line (round caps + round
 * joins, like canvas `lineCap/lineJoin: round`). The same builder is used for
 * the committed mask and for the live overlay preview, so what you see while
 * painting is exactly what commits.
 *
 * The boundary is traced in local coordinates: a start cap (half-disc behind
 * the first point), a forward offset chain (round joins at every turn), an end
 * cap (half-disc beyond the last point), and the reverse offset chain. Each
 * join emits an anchor at BOTH of its tangents (plus the arc interior points
 * for sharp turns), so the flanks interpolate every sampled joint — a smooth
 * curve with sub-`JOIN_STEP` direction changes still traces the cursor instead
 * of collapsing into a straight chord between the caps. The result is wound
 * consistently (reversed when the signed area is negative) and rounded to 2
 * decimals so mask bounds serialize cleanly.
 */

export interface MaskStrokePoint {
  x: number
  y: number
}

export interface MaskBounds {
  x: number
  y: number
  width: number
  height: number
}

const CIRCLE_SEGMENTS = 24
const CAP_SEGMENTS = 8
const JOIN_STEP = Math.PI / 6

const EPS = 1e-6

function round2(v: number): number {
  return Math.round(v * 100) / 100
}

function angleOf(v: MaskStrokePoint): number {
  return Math.atan2(v.y, v.x)
}

function unit(x: number, y: number): MaskStrokePoint | null {
  const len = Math.hypot(x, y)
  if (len < EPS) return null
  return { x: x / len, y: y / len }
}

/** Angle pair for the short way (|Δ| ≤ π) from a0 to a1. */
function shortWay(a0: number, a1: number): { from: number; to: number } {
  let d = a1 - a0
  d = ((d + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI
  return { from: a0, to: a0 + d }
}

/** Interior points of an arc from `from` to `to` (endpoints emitted by callers). */
function arcPoints(cx: number, cy: number, r: number, from: number, to: number, segments: number): MaskStrokePoint[] {
  const step = (to - from) / segments
  const out: MaskStrokePoint[] = []
  for (let k = 1; k < segments; k++) {
    const a = from + step * k
    out.push({ x: round2(cx + r * Math.cos(a)), y: round2(cy + r * Math.sin(a)) })
  }
  return out
}

function circlePoints(cx: number, cy: number, r: number): MaskStrokePoint[] {
  const out: MaskStrokePoint[] = []
  for (let k = 0; k < CIRCLE_SEGMENTS; k++) {
    const a = (k / CIRCLE_SEGMENTS) * Math.PI * 2
    out.push({ x: round2(cx + r * Math.cos(a)), y: round2(cy + r * Math.sin(a)) })
  }
  return out
}

function sidePlus(v: MaskStrokePoint, r: number): MaskStrokePoint {
  return { x: -v.y * r, y: v.x * r }
}

function sideMinus(v: MaskStrokePoint, r: number): MaskStrokePoint {
  return { x: v.y * r, y: -v.x * r }
}

/** Offset of a point by `r` on the given side of the travel direction. */
function offset(p: MaskStrokePoint, d: MaskStrokePoint, r: number, side: 'plus' | 'minus'): MaskStrokePoint {
  const o = side === 'plus' ? sidePlus(d, r) : sideMinus(d, r)
  return { x: round2(p.x + o.x), y: round2(p.y + o.y) }
}

/** Number of arc segments for a join spanning `from → to` radians. */
function joinSegments(from: number, to: number): number {
  return Math.max(1, Math.ceil(Math.abs(to - from) / JOIN_STEP))
}

function signedArea(pts: MaskStrokePoint[]): number {
  let area = 0
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]
    const b = pts[(i + 1) % pts.length]
    area += a.x * b.y - b.x * a.y
  }
  return area / 2
}

/**
 * Builds the closed mask polygon for a stroke of the given radius (scene units)
 * along `points`. Single-point strokes become a circle; empty input returns [].
 */
export function buildMaskStrokePolygon(points: MaskStrokePoint[], radius: number): MaskStrokePoint[] {
  const n = points.length
  const r = Math.max(0.5, radius)
  if (n === 0) return []
  if (n === 1) return circlePoints(points[0].x, points[0].y, r)

  const out: MaskStrokePoint[] = []

  let dir = unit(points[1].x - points[0].x, points[1].y - points[0].y) ?? { x: 1, y: 0 }
  const startDir = dir

  out.push({ x: round2(points[0].x + sidePlus(startDir, r).x), y: round2(points[0].y + sidePlus(startDir, r).y) })

  for (let i = 1; i < n - 1; i++) {
    const u = dir
    const next = unit(points[i + 1].x - points[i].x, points[i + 1].y - points[i].y)
    const v = next ?? u
    dir = v
    // Anchor both tangents of the round join. The anchors make the flank
    // interpolate this joint even when the turn is so small the arc below
    // emits no interior points — otherwise a smooth curve (consecutive
    // directions differing by a fraction of a degree) degenerates into a
    // straight chord and the stroke stops following the cursor.
    out.push(offset(points[i], u, r, 'plus'))
    const { from, to } = shortWay(angleOf(u) + Math.PI / 2, angleOf(v) + Math.PI / 2)
    out.push(...arcPoints(points[i].x, points[i].y, r, from, to, joinSegments(from, to)))
    out.push(offset(points[i], v, r, 'plus'))
  }

  const endDir = dir
  out.push({ x: round2(points[n - 1].x + sidePlus(endDir, r).x), y: round2(points[n - 1].y + sidePlus(endDir, r).y) })

  // End cap: from side-plus across the front (travel direction) to side-minus.
  out.push(...arcPoints(points[n - 1].x, points[n - 1].y, r, angleOf(endDir) + Math.PI / 2, angleOf(endDir) - Math.PI / 2, CAP_SEGMENTS))
  out.push({ x: round2(points[n - 1].x + sideMinus(endDir, r).x), y: round2(points[n - 1].y + sideMinus(endDir, r).y) })

  // Reverse offset chain (side-minus), from the end joint back to joint 1.
  // Travel is backwards here (u = points[i]-points[i+1] = -forward), so the
  // minus side of the forward travel maps to +90° of the reversed direction.
  for (let i = n - 2; i >= 1; i--) {
    const u = unit(points[i].x - points[i + 1].x, points[i].y - points[i + 1].y) ?? dir
    const v = unit(points[i - 1].x - points[i].x, points[i - 1].y - points[i].y) ?? u
    // Per-joint tangents on the plus side of the reversed travel, mirroring
    // the forward chain so the curved flank is traced on this side too.
    out.push(offset(points[i], u, r, 'plus'))
    const { from, to } = shortWay(angleOf(u) + Math.PI / 2, angleOf(v) + Math.PI / 2)
    out.push(...arcPoints(points[i].x, points[i].y, r, from, to, joinSegments(from, to)))
    out.push(offset(points[i], v, r, 'plus'))
  }

  out.push({ x: round2(points[0].x + sideMinus(startDir, r).x), y: round2(points[0].y + sideMinus(startDir, r).y) })

  // Start cap: from side-minus across the back (opposite travel) to side-plus.
  out.push(...arcPoints(points[0].x, points[0].y, r, angleOf(startDir) - Math.PI / 2, angleOf(startDir) - (3 * Math.PI) / 2, CAP_SEGMENTS))

  if (signedArea(out) < 0) out.reverse()
  return out
}

/** Axis-aligned bounds of a point set (empty input → zero rect). */
export function boundsOf(points: MaskStrokePoint[]): MaskBounds {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of points) {
    if (p.x < minX) minX = p.x
    if (p.y < minY) minY = p.y
    if (p.x > maxX) maxX = p.x
    if (p.y > maxY) maxY = p.y
  }
  if (points.length === 0) return { x: 0, y: 0, width: 0, height: 0 }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}
