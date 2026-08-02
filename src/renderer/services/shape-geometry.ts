/**
 * shape-geometry — pure SVG path geometry for the shape kinds.
 *
 * Extracted from ShapeRenderer so render-time container clipping can reuse the
 * exact shape outlines without a component dependency. `getShapePath` returns
 * an SVG path string in the shape's local coordinate frame (0..w / 0..h).
 */

import { ShapeKind } from '@shared/types'

interface GeoPoint {
  x: number
  y: number
}

function pointInQuad(p: GeoPoint, quad: GeoPoint[]): boolean {
  let inside = false
  for (let i = 0, j = quad.length - 1; i < quad.length; j = i++) {
    const a = quad[i]
    const b = quad[j]
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) {
      inside = !inside
    }
  }
  return inside
}

/** t in [0,1] where segment (p1→p2) properly crosses (q1→q2), or null when parallel/disjoint. */
function segmentCrossParam(p1: GeoPoint, p2: GeoPoint, q1: GeoPoint, q2: GeoPoint): number | null {
  const rx = p2.x - p1.x
  const ry = p2.y - p1.y
  const sx = q2.x - q1.x
  const sy = q2.y - q1.y
  const den = rx * sy - ry * sx
  if (Math.abs(den) < 1e-12) return null
  const qx = q1.x - p1.x
  const qy = q1.y - p1.y
  const t = (qx * sy - qy * sx) / den
  const u = (qx * ry - qy * rx) / den
  if (t <= 1e-9 || t >= 1 - 1e-9 || u <= 1e-9 || u >= 1 - 1e-9) return null
  return t
}

function lerp(a: GeoPoint, b: GeoPoint, t: number): GeoPoint {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
}

/** The portions of edge (p1→p2) lying strictly outside the convex quad, in the edge's direction. */
function edgeExteriorPieces(p1: GeoPoint, p2: GeoPoint, quad: GeoPoint[]): GeoPoint[][] {
  const params = [0, 1]
  for (let i = 0; i < quad.length; i++) {
    const t = segmentCrossParam(p1, p2, quad[i], quad[(i + 1) % quad.length])
    if (t !== null) params.push(t)
  }
  params.sort((a, b) => a - b)
  const pieces: GeoPoint[][] = []
  for (let i = 0; i + 1 < params.length; i++) {
    const mid = (params[i] + params[i + 1]) / 2
    if (mid <= 1e-9 || mid >= 1 - 1e-9) continue
    if (!pointInQuad(lerp(p1, p2, mid), quad)) {
      pieces.push([lerp(p1, p2, params[i]), lerp(p1, p2, params[i + 1])])
    }
  }
  return pieces
}

function closeEnough(a: GeoPoint, b: GeoPoint, tol: number): boolean {
  return Math.abs(a.x - b.x) < tol && Math.abs(a.y - b.y) < tol
}

/**
 * The exact outline of the ✕ a cross shape renders: the union of the two
 * parallelogram arms (identical to `CrossPaths` in ShapeRenderer). Each arm's
 * edges are clipped to the other arm's exterior, then the kept directed
 * segments are assembled into a single closed loop by most-left-turn marching
 * (interior kept on the left). The result is a simple 12-gon for every box.
 * The tips poke slightly outside the box; the container clip wrapper's
 * `overflow: hidden` clips them back, matching the SVG viewBox clip.
 */
function crossOutline(w: number, h: number, thickness: number): GeoPoint[] {
  const t = thickness * Math.min(w, h)
  const hw = t / 2
  const d = Math.sqrt(w * w + h * h)
  if (d <= 0) return []
  const px = (h * hw) / d
  const py = (w * hw) / d
  const armA: GeoPoint[] = [
    { x: -px, y: py },
    { x: w - px, y: h + py },
    { x: w + px, y: h - py },
    { x: px, y: -py }
  ]
  const armB: GeoPoint[] = [
    { x: w - px, y: -py },
    { x: -px, y: h - py },
    { x: px, y: h + py },
    { x: w + px, y: py }
  ]
  const segs: { a: GeoPoint; b: GeoPoint }[] = []
  const collect = (P: GeoPoint[], Q: GeoPoint[]) => {
    for (let i = 0; i < P.length; i++) {
      for (const [a, b] of edgeExteriorPieces(P[i], P[(i + 1) % P.length], Q)) {
        segs.push({ a, b })
      }
    }
  }
  collect(armA, armB)
  collect(armB, armA)
  if (segs.length === 0) return []

  const inUnion = (p: GeoPoint) => pointInQuad(p, armA) || pointInQuad(p, armB)
  const first = segs[0]
  const mid = lerp(first.a, first.b, 0.5)
  const left = { x: mid.x - (first.b.y - first.a.y), y: mid.y + (first.b.x - first.a.x) }
  if (!inUnion(left)) {
    const tmp = first.a
    first.a = first.b
    first.b = tmp
  }

  const used = new Array<boolean>(segs.length).fill(false)
  used[0] = true
  const start = first.a
  const loop: GeoPoint[] = [start]
  let cur = first.b
  let dIn = { x: cur.x - start.x, y: cur.y - start.y }
  let guard = 0
  while (!closeEnough(cur, start, 1e-6) && guard++ < segs.length * 4) {
    loop.push(cur)
    let best = -1
    let bestAngle = -Infinity
    for (let i = 0; i < segs.length; i++) {
      if (used[i]) continue
      const seg = segs[i]
      let out: GeoPoint | null = null
      if (closeEnough(seg.a, cur, 1e-6)) out = { x: seg.b.x - seg.a.x, y: seg.b.y - seg.a.y }
      else if (closeEnough(seg.b, cur, 1e-6)) out = { x: seg.a.x - seg.b.x, y: seg.a.y - seg.b.y }
      if (!out) continue
      const angle = Math.atan2(dIn.x * out.y - dIn.y * out.x, dIn.x * out.x + dIn.y * out.y)
      if (angle > bestAngle) {
        bestAngle = angle
        best = i
      }
    }
    if (best < 0) break
    used[best] = true
    const seg = segs[best]
    const prev = loop[loop.length - 1]
    cur = closeEnough(seg.a, cur, 1e-6) ? seg.b : seg.a
    dIn = { x: cur.x - prev.x, y: cur.y - prev.y }
  }
  return loop
}

function formatRing(ring: GeoPoint[]): string {
  return ring.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + ' Z'
}

export function getShapePath(
  kind: ShapeKind,
  w: number,
  h: number,
  cornerRadius: number,
  angles?: [number, number, number],
  thickness?: number
): string {
  switch (kind) {
    case 'rectangle': {
      if (cornerRadius <= 0) return `M 0 0 L ${w} 0 L ${w} ${h} L 0 ${h} Z`
      const r = Math.min(cornerRadius, w / 2, h / 2)
      return `M ${r} 0 L ${w - r} 0 Q ${w} 0 ${w} ${r} L ${w} ${h - r} Q ${w} ${h} ${w - r} ${h} L ${r} ${h} Q 0 ${h} 0 ${h - r} L 0 ${r} Q 0 0 ${r} 0 Z`
    }
    case 'circle': {
      const r = Math.min(w, h) / 2
      const cx = w / 2
      const cy = h / 2
      return `M ${cx - r} ${cy} A ${r} ${r} 0 1 1 ${cx + r} ${cy} A ${r} ${r} 0 1 1 ${cx - r} ${cy} Z`
    }
    case 'ellipse': {
      const rx = w / 2
      const ry = h / 2
      const cx = w / 2
      const cy = h / 2
      return `M ${cx - rx} ${cy} A ${rx} ${ry} 0 1 1 ${cx + rx} ${cy} A ${rx} ${ry} 0 1 1 ${cx - rx} ${cy} Z`
    }
    case 'triangle': {
      const [A, B] = angles || [60, 60]
      const C = 180 - A - B
      if (C <= 1 || C >= 179) return `M 0 ${h} L ${w} ${h} L ${w / 2} ${h * 0.1} Z`
      const aR = A * Math.PI / 180, bR = B * Math.PI / 180, cR = C * Math.PI / 180
      const b = w * Math.sin(bR) / Math.sin(cR)
      const x3 = Math.round(b * Math.cos(aR))
      const y3 = Math.round(h - b * Math.sin(aR))
      const cx = Math.max(0, Math.min(w, x3))
      const cy = Math.max(0, Math.min(h * 0.95, y3))
      return `M 0 ${h} L ${w} ${h} L ${cx} ${cy} Z`
    }
    case 'star': {
      const cx = w / 2
      const cy = h / 2
      const outerR = Math.min(w, h) / 2
      const innerR = outerR * 0.4
      const pts: string[] = []
      for (let i = 0; i < 5; i++) {
        const outerAngle = (i * 72 - 90) * (Math.PI / 180)
        const innerAngle = ((i * 72 + 36) - 90) * (Math.PI / 180)
        pts.push(`${cx + outerR * Math.cos(outerAngle)},${cy + outerR * Math.sin(outerAngle)}`)
        pts.push(`${cx + innerR * Math.cos(innerAngle)},${cy + innerR * Math.sin(innerAngle)}`)
      }
      return `M ${pts[0]} L ${pts.slice(1).join(' L ')} Z`
    }
    case 'hexagon':
      return `M ${w * 0.25} 0 L ${w * 0.75} 0 L ${w} ${h * 0.5} L ${w * 0.75} ${h} L ${w * 0.25} ${h} L 0 ${h * 0.5} Z`
    case 'diamond':
      return `M ${w / 2} 0 L ${w} ${h / 2} L ${w / 2} ${h} L 0 ${h / 2} Z`
    case 'parallelogram':
      return `M ${w * 0.25} 0 L ${w} 0 L ${w * 0.75} ${h} L 0 ${h} Z`
    case 'trapezoid':
      return `M ${w * 0.2} 0 L ${w * 0.8} 0 L ${w} ${h} L 0 ${h} Z`
    case 'cross': {
      const ring = crossOutline(w, h, thickness ?? 0.3)
      return ring.length > 0 ? formatRing(ring) : ''
    }
    case 'plus': {
      const t = (thickness ?? 0.3) * Math.min(w, h)
      const cw = w / 2, ch = h / 2, ht = t / 2
      return `M ${cw - ht} 0 L ${cw + ht} 0 L ${cw + ht} ${ch - ht} L ${w} ${ch - ht} L ${w} ${ch + ht} L ${cw + ht} ${ch + ht} L ${cw + ht} ${h} L ${cw - ht} ${h} L ${cw - ht} ${ch + ht} L 0 ${ch + ht} L 0 ${ch - ht} L ${cw - ht} ${ch - ht} Z`
    }
    case 'heart': {
      const cx = w / 2
      const tipY = h * 0.9
      return `M ${cx} ${tipY} C ${cx * 1.5} ${h * 0.55}, ${w} ${h * 0.4}, ${w} ${h * 0.3} C ${w} ${h * 0.1}, ${cx * 1.2} ${h * 0.05}, ${cx} ${h * 0.2} C ${cx * 0.8} ${h * 0.05}, 0 ${h * 0.1}, 0 ${h * 0.3} C 0 ${h * 0.4}, ${cx * 0.5} ${h * 0.55}, ${cx} ${tipY} Z`
    }
    case 'arrow-right': {
      const t = (thickness ?? 0.5) * h
      const halfT = t * 0.5, cy = h / 2, sx = w * 0.6
      return `M 0 ${cy - halfT} L ${sx} ${cy - halfT} L ${sx} ${cy - t} L ${w} ${cy} L ${sx} ${cy + t} L ${sx} ${cy + halfT} L 0 ${cy + halfT} Z`
    }
    default:
      return `M 0 0 L ${w} 0 L ${w} ${h} L 0 ${h} Z`
  }
}
