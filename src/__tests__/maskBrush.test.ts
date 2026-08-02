import { describe, it, expect } from 'vitest'
import { boundsOf, buildMaskStrokePolygon } from '../renderer/services/mask-brush'

describe('buildMaskStrokePolygon', () => {
  it('builds a capsule for a two-point stroke', () => {
    const poly = buildMaskStrokePolygon([{ x: 0, y: 0 }, { x: 10, y: 0 }], 2)
    expect(poly.length).toBeGreaterThan(8)
    const box = boundsOf(poly)
    expect(box.x).toBeCloseTo(-2, 1)
    expect(box.y).toBeCloseTo(-2, 1)
    expect(box.width).toBeCloseTo(14, 1)
    expect(box.height).toBeCloseTo(4, 1)
  })

  it('traces both sides of a corner stroke (regression: degenerate line)', () => {
    const poly = buildMaskStrokePolygon([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }], 2)
    const box = boundsOf(poly)
    expect(box.x).toBeLessThan(-1.5)
    expect(box.y).toBeLessThan(-1.5)
    expect(box.x + box.width).toBeGreaterThan(11.5)
    expect(box.y + box.height).toBeGreaterThan(11.5)

    const rightOuter = poly.filter((p) => p.x > 11)
    const bottomOuter = poly.filter((p) => p.y < -1)
    const topInner = poly.filter((p) => p.y > 8 && p.x < 8.5)
    expect(rightOuter.length).toBeGreaterThan(0)
    expect(bottomOuter.length).toBeGreaterThan(0)
    expect(topInner.length).toBeGreaterThan(0)
  })

  it('wraps a U-turn so both flanks are present', () => {
    const pts = [
      { x: 0, y: 0 },
      { x: 20, y: 0 },
      { x: 20, y: 20 },
      { x: 0, y: 20 },
      { x: 0, y: 40 }
    ]
    const poly = buildMaskStrokePolygon(pts, 3)
    const box = boundsOf(poly)
    expect(box.x).toBeCloseTo(-3, 0)
    expect(box.y).toBeCloseTo(-3, 0)
    expect(box.x + box.width).toBeGreaterThan(22)
    expect(box.y + box.height).toBeCloseTo(43, 0)
    const leftFlank = poly.filter((p) => p.x < -2)
    const rightFlank = poly.filter((p) => p.x > 21)
    expect(leftFlank.length).toBeGreaterThan(0)
    expect(rightFlank.length).toBeGreaterThan(0)
  })

  it('traces a smooth curve on both flanks instead of collapsing to a chord', () => {
    const R = 50
    const r = 3
    const pts: { x: number; y: number }[] = []
    for (let k = 0; k <= 18; k++) {
      const a = (k / 36) * Math.PI
      pts.push({ x: R * Math.cos(a), y: R * Math.sin(a) })
    }
    const poly = buildMaskStrokePolygon(pts, r)
    expect(poly.length).toBeGreaterThan(40)

    const radAt = (k: number): { x: number; y: number } => {
      const p = pts[k]
      const len = Math.hypot(p.x, p.y)
      return { x: p.x / len, y: p.y / len }
    }
    const minDist = (target: { x: number; y: number }): number =>
      Math.min(...poly.map((v) => Math.hypot(v.x - target.x, v.y - target.y)))

    // Every sampled joint is flanked by polygon vertices ~radius away on both
    // sides of the curve. The pre-fix build only emitted cap-to-cap chords, so
    // the mid-stroke joints of this 90° arc were 15+ units from the polygon.
    for (let k = 1; k <= 17; k++) {
      const p = pts[k]
      const rad = radAt(k)
      expect(minDist({ x: p.x + rad.x * r, y: p.y + rad.y * r })).toBeLessThan(0.5)
      expect(minDist({ x: p.x - rad.x * r, y: p.y - rad.y * r })).toBeLessThan(0.5)
    }
  })

  it('produces a circle for a single-point stroke', () => {
    const poly = buildMaskStrokePolygon([{ x: 5, y: 5 }], 4)
    expect(poly).toHaveLength(24)
    const box = boundsOf(poly)
    expect(box.x).toBeCloseTo(1, 1)
    expect(box.y).toBeCloseTo(1, 1)
    expect(box.width).toBeCloseTo(8, 1)
    expect(box.height).toBeCloseTo(8, 1)
  })
})
