/**
 * polygon-clip — boolean difference of polygons with holes.
 *
 * The mask system needs a true region-subtraction primitive: an "unmask"
 * stroke must carve its geometry out of the previously-masked region (a brush
 * capsule, ellipse or rect can split a punch into several pieces and cut a
 * hole through it). CSS `clip-path` can only intersect keep-sets — it can
 * never restore an already-punched area — so the subtraction has to happen in
 * the data model with real polygon clipping.
 *
 * Implementation strategy (Martinez-style subdivide + classify + assemble):
 *   1. Every subject ring (outer + holes) and the single clip ring are split
 *      at every intersection point, including collinear-overlap endpoints, so
 *      no sub-edge is ever ambiguous (crossing another boundary in its middle).
 *   2. Each directed sub-edge is classified by testing a point just off its
 *      left/right side (regions are kept on the LEFT for normalized rings:
 *      outers CCW, holes CW). For the difference `subject − clip`:
 *        - subject edges stay when their region side is OUTSIDE the clip,
 *        - clip edges stay (reversed) when their region side is INSIDE the
 *          subject region.
 *      This makes overlapping collinear edges decide correctly — the shared
 *      segment is part of the result boundary only when the two regions lie on
 *      opposite sides of the line.
 *   3. The selected directed edges form closed loops (each vertex has exactly
 *      one incoming and one outgoing boundary edge). Loops are assembled,
 *      deduplicated, normalized (outers CCW / holes CW) and grouped into
 *      `Region`s by containment.
 *
 * Inputs are expected to be simple (non-self-intersecting) rings, which holds
 * for every mask shape (rects, 32-gon ellipse approximations, capsule brush
 * polygons) and every drawn unmask stroke.
 */

export interface Pt {
  x: number
  y: number
}

export type Ring = Pt[]

/** A connected region: one outer contour plus its (restored) holes. */
export interface Region {
  outer: Ring
  holes: Ring[]
}

const EPS = 1e-9
const PTOL = 1e-6

export function ringArea(ring: Ring): number {
  let area = 0
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i]
    const b = ring[(i + 1) % ring.length]
    area += a.x * b.y - b.x * a.y
  }
  return area / 2
}

export function regionArea(region: Region): number {
  let area = ringArea(region.outer)
  for (const h of region.holes) area -= Math.abs(ringArea(h))
  return area
}

/** Even-odd point-in-region test over a set of rings (holes handled via parity). */
export function pointInRegion(p: Pt, rings: Ring[]): boolean {
  let inside = false
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const a = ring[i]
      const b = ring[j]
      if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) {
        inside = !inside
      }
    }
  }
  return inside
}

export function normalizeRing(ring: Ring, ccw: boolean): Ring {
  const area = ringArea(ring)
  const isCcw = area >= 0
  if (isCcw === ccw) return ring
  return [...ring].reverse()
}

function pointKey(p: Pt): string {
  return `${Math.round(p.x * 1e9)},${Math.round(p.y * 1e9)}`
}

function dedupeRing(ring: Ring): Ring {
  const out: Ring = []
  for (const p of ring) {
    const k = pointKey(p)
    if (out.length === 0 || pointKey(out[out.length - 1]) !== k) out.push(p)
  }
  while (out.length > 1 && pointKey(out[0]) === pointKey(out[out.length - 1])) out.pop()
  return out
}

/** Rotation-agnostic ring equality (same vertices, any start, either winding). */
function loopsEqual(a: Ring, b: Ring): boolean {
  if (a.length !== b.length) return false
  const key = (r: Ring) => r.map((p) => pointKey(p)).join('|')
  const ka = key(a)
  const rotations = [...b]
  for (let i = 0; i < b.length; i++) {
    if (key(rotations) === ka) return true
    rotations.push(rotations.shift()!)
  }
  rotations.reverse()
  for (let i = 0; i < b.length; i++) {
    if (key(rotations) === ka) return true
    rotations.push(rotations.shift()!)
  }
  return false
}

function edgeLength(a: Pt, b: Pt): number {
  return Math.hypot(b.x - a.x, b.y - a.y)
}

/** Point of segment a1→a2 at parameter t ∈ [0,1]. */
function pointAt(a1: Pt, a2: Pt, t: number): Pt {
  return { x: a1.x + (a2.x - a1.x) * t, y: a1.y + (a2.y - a1.y) * t }
}

/** Parameter t of p along a1→a2, using the dominant axis. */
function paramOf(p: Pt, a1: Pt, a2: Pt): number {
  const dx = a2.x - a1.x
  const dy = a2.y - a1.y
  if (Math.abs(dx) >= Math.abs(dy)) return dx === 0 ? 0 : (p.x - a1.x) / dx
  return dy === 0 ? 0 : (p.y - a1.y) / dy
}

type Intersection = { kind: 'point'; p: Pt } | { kind: 'overlap'; p1: Pt; p2: Pt }

/**
 * Intersection of segments a1→a2 and b1→b2: a single point, a collinear
 * overlap interval, or null when they do not meet.
 */
export function segmentIntersection(a1: Pt, a2: Pt, b1: Pt, b2: Pt): Intersection | null {
  const x1 = a1.x
  const y1 = a1.y
  const x2 = a2.x
  const y2 = a2.y
  const x3 = b1.x
  const y3 = b1.y
  const x4 = b2.x
  const y4 = b2.y
  const denom = (y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1)
  const na = (x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3)
  const nb = (x2 - x1) * (y1 - y3) - (y2 - y1) * (x1 - x3)
  if (Math.abs(denom) < EPS) {
    if (Math.abs(na) > EPS || Math.abs(nb) > EPS) return null
    // collinear: project both segments onto a and find the overlap interval.
    const tb1 = paramOf(b1, a1, a2)
    const tb2 = paramOf(b2, a1, a2)
    const lo = Math.max(0, Math.min(tb1, tb2))
    const hi = Math.min(1, Math.max(tb1, tb2))
    if (lo > hi + PTOL) return null
    if (Math.abs(lo - hi) < PTOL) return { kind: 'point', p: pointAt(a1, a2, Math.max(0, Math.min(1, lo))) }
    return { kind: 'overlap', p1: pointAt(a1, a2, lo), p2: pointAt(a1, a2, hi) }
  }
  const ua = na / denom
  const ub = nb / denom
  if (ua < -PTOL || ua > 1 + PTOL || ub < -PTOL || ub > 1 + PTOL) return null
  return { kind: 'point', p: pointAt(a1, a2, Math.max(0, Math.min(1, ua))) }
}

function addSplitPoint(map: Map<string, { p: Pt; t: number }[]>, key: string, p: Pt, a1: Pt, a2: Pt): void {
  let list = map.get(key)
  if (!list) {
    list = []
    map.set(key, list)
  }
  list.push({ p, t: paramOf(p, a1, a2) })
}

/** Splits a ring's edges at the recorded intersection points, in order. */
function splitRing(ring: Ring, splitMap: Map<string, { p: Pt; t: number }[]>): Ring {
  const out: Ring = []
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i]
    const b = ring[(i + 1) % ring.length]
    const key = `${pointKey(a)}|${pointKey(b)}`
    const splits = splitMap.get(key)
    out.push(a)
    if (splits && splits.length > 0) {
      const pts = [...splits].sort((x, y) => x.t - y.t)
      for (const s of pts) out.push(s.p)
    }
  }
  return dedupeRing(out)
}

/**
 * The directed boundary edges selected for `subject − clip`. `regionOnLeft`
 * is true for subject edges (normalized rings keep their region on the left);
 * clip edges are reversed so their region side is on the left of the result.
 */
interface DirectedEdge {
  from: Pt
  to: Pt
}

/**
 * Boolean difference of a region (outer + holes) minus a single simple clip
 * ring. Returns the residual connected regions (each outer with its holes);
 * an empty array means the clip fully covered the subject.
 */
export function differenceRegion(subject: Region, clip: Ring): Region[] {
  const subjectRings: Ring[] = [normalizeRing(subject.outer, true), ...subject.holes.map((h) => normalizeRing(h, false))]
  const clipRing = normalizeRing(clip, true)

  const subjectSplits = new Map<string, { p: Pt; t: number }[]>()
  const clipSplits = new Map<string, { p: Pt; t: number }[]>()

  // 1. Collect every intersection point (and collinear-overlap endpoint) on
  //    both sides, keyed by the undirected original edge.
  for (const ring of subjectRings) {
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i]
      const b = ring[(i + 1) % ring.length]
      if (edgeLength(a, b) < EPS) continue
      for (let j = 0; j < clipRing.length; j++) {
        const c = clipRing[j]
        const d = clipRing[(j + 1) % clipRing.length]
        if (edgeLength(c, d) < EPS) continue
        const hit = segmentIntersection(a, b, c, d)
        if (!hit) continue
        if (hit.kind === 'point') {
          addSplitPoint(subjectSplits, `${pointKey(a)}|${pointKey(b)}`, hit.p, a, b)
          addSplitPoint(clipSplits, `${pointKey(c)}|${pointKey(d)}`, hit.p, c, d)
        } else {
          addSplitPoint(subjectSplits, `${pointKey(a)}|${pointKey(b)}`, hit.p1, a, b)
          addSplitPoint(subjectSplits, `${pointKey(a)}|${pointKey(b)}`, hit.p2, a, b)
          addSplitPoint(clipSplits, `${pointKey(c)}|${pointKey(d)}`, hit.p1, c, d)
          addSplitPoint(clipSplits, `${pointKey(c)}|${pointKey(d)}`, hit.p2, c, d)
        }
      }
    }
  }

  const splitSubject = subjectRings.map((r) => splitRing(r, subjectSplits))
  const splitClip = splitRing(clipRing, clipSplits)

  // 2. Classify and select boundary edges.
  const edges: DirectedEdge[] = []
  const ringOf = (ring: Ring, i: number): { from: Pt; to: Pt } => ({
    from: ring[i],
    to: ring[(i + 1) % ring.length]
  })

  for (const ring of splitSubject) {
    for (let i = 0; i < ring.length; i++) {
      const e = ringOf(ring, i)
      const len = edgeLength(e.from, e.to)
      if (len < EPS) continue
      const eps = Math.max(1e-6, Math.min(1e-3, len * 0.5))
      const mid = { x: (e.from.x + e.to.x) / 2, y: (e.from.y + e.to.y) / 2 }
      const nx = -(e.to.y - e.from.y) / len
      const ny = (e.to.x - e.from.x) / len
      const left = { x: mid.x + nx * eps, y: mid.y + ny * eps }
      if (!pointInRegion(left, [clipRing])) edges.push(e)
    }
  }

  for (let i = 0; i < splitClip.length; i++) {
    const e = ringOf(splitClip, i)
    const len = edgeLength(e.from, e.to)
    if (len < EPS) continue
    const eps = Math.max(1e-6, Math.min(1e-3, len * 0.5))
    const mid = { x: (e.from.x + e.to.x) / 2, y: (e.from.y + e.to.y) / 2 }
    const nx = -(e.to.y - e.from.y) / len
    const ny = (e.to.x - e.from.x) / len
    const right = { x: mid.x - nx * eps, y: mid.y - ny * eps }
    if (pointInRegion(right, splitSubject)) edges.push({ from: e.to, to: e.from })
  }

  // 3. Assemble closed loops from the directed edges.
  const outgoing = new Map<string, DirectedEdge[]>()
  for (const e of edges) {
    const k = pointKey(e.from)
    let list = outgoing.get(k)
    if (!list) {
      list = []
      outgoing.set(k, list)
    }
    list.push(e)
  }

  const loops: Ring[] = []
  const used = new Set<DirectedEdge>()
  const turn = (from: Pt, via: Pt, to: Pt): number => {
    const ax = from.x - via.x
    const ay = from.y - via.y
    const bx = to.x - via.x
    const by = to.y - via.y
    return Math.atan2(ay * bx - ax * by, ax * bx + ay * by)
  }

  for (const start of edges) {
    if (used.has(start)) continue
    const loop: Ring = [start.from, start.to]
    used.add(start)
    let cur: DirectedEdge = start
    let guard = 0
    while (guard++ < edges.length * 2 + 8) {
      const k = pointKey(cur.to)
      const candidates = (outgoing.get(k) ?? []).filter((e) => !used.has(e))
      if (candidates.length === 0) break
      let next = candidates[0]
      for (const c of candidates.slice(1)) {
        if (turn(cur.from, cur.to, c.to) > turn(cur.from, cur.to, next.to)) next = c
      }
      loop.push(next.to)
      used.add(next)
      cur = next
      if (pointKey(next.to) === pointKey(start.from)) break
    }
    if (loop.length >= 3) loops.push(dedupeRing(loop))
  }

  // 4. Normalize orientations and drop duplicate boundaries. A clip ring that
  //     exactly coincides with a subject hole (or another subject ring) makes
  //     both its own reversed edges AND the subject's edges select — the same
  //     contour appears twice in the loops. Dedupe so regions carry one copy.
  const normLoops: Ring[] = []
  for (const l of loops) {
    const area = ringArea(l)
    const norm = area >= 0 ? l : [...l].reverse()
    if (!normLoops.some((existing) => loopsEqual(existing, norm))) normLoops.push(norm)
  }

  const depthOf = (l: Ring): number => {
    let depth = 0
    for (const other of normLoops) {
      if (other === l) continue
      if (ringArea(other) > ringArea(l) && pointInRegion(l[0], [other])) depth++
    }
    return depth
  }

  const regions: Region[] = []
  for (const outer of normLoops) {
    if (depthOf(outer) % 2 !== 0) continue
    const holes: Ring[] = []
    for (const h of normLoops) {
      if (h === outer) continue
      if (ringArea(h) >= ringArea(outer)) continue
      if (!pointInRegion(h[0], [outer])) continue
      if (depthOf(h) % 2 !== 1) continue
      // the hole must not be contained in any other outer with smaller area
      let parent = outer
      for (const o of normLoops) {
        if (o === outer || ringArea(o) >= ringArea(outer) || ringArea(o) < ringArea(h)) continue
        if (depthOf(o) % 2 !== 0) continue
        if (pointInRegion(h[0], [o])) {
          if (ringArea(o) > ringArea(parent)) parent = o
        }
      }
      if (parent === outer) holes.push(h)
    }
    regions.push({ outer, holes })
  }

  return regions
}

/** True when a simple ring has non-zero area (avoids sliver results). */
export function isDegenerateRing(ring: Ring): boolean {
  return Math.abs(ringArea(ring)) < 1e-6
}
