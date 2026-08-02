/**
 * polygon-clip — the boolean-difference engine backing subtractive unmask.
 *
 * Validates the primitives (shoelace area, even-odd containment, segment
 * intersection) and the `differenceRegion` contract: a contained clip becomes a
 * hole, a strip through the subject splits it into disjoint pieces, a fully
 * covering clip erases it, a disjoint clip leaves it untouched, and a clip
 * passing through an existing hole grows that hole.
 */
import { describe, it, expect } from 'vitest'
import {
  differenceRegion,
  ringArea,
  regionArea,
  pointInRegion,
  segmentIntersection,
  isDegenerateRing,
  Ring,
  Region
} from '../renderer/services/polygon-clip'

function square(x: number, y: number, width: number, height: number): Ring {
  return [
    { x, y },
    { x: x + width, y },
    { x: x + width, y: y + height },
    { x, y: y + height }
  ]
}

describe('polygon-clip primitives', () => {
  it('ringArea is signed shoelace (CCW positive)', () => {
    expect(ringArea(square(0, 0, 100, 100))).toBe(10000)
    expect(ringArea([...square(0, 0, 100, 100)].reverse())).toBe(-10000)
  })

  it('regionArea subtracts hole areas', () => {
    const region: Region = { outer: square(0, 0, 100, 100), holes: [square(25, 25, 50, 50)] }
    expect(regionArea(region)).toBe(7500)
  })

  it('pointInRegion applies even-odd across rings (holes punch out)', () => {
    const rings = [square(0, 0, 100, 100), square(25, 25, 50, 50)]
    expect(pointInRegion({ x: 50, y: 50 }, rings)).toBe(false)
    expect(pointInRegion({ x: 10, y: 50 }, rings)).toBe(true)
    expect(pointInRegion({ x: 50, y: 10 }, rings)).toBe(true)
    expect(pointInRegion({ x: 150, y: 50 }, rings)).toBe(false)
  })

  it('segmentIntersection finds a crossing and nulls a miss', () => {
    expect(segmentIntersection({ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }, { x: 10, y: 0 })).toEqual({
      kind: 'point',
      p: { x: 5, y: 5 }
    })
    expect(segmentIntersection({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 5, y: 5 }, { x: 6, y: 5 })).toBeNull()
  })

  it('segmentIntersection reports collinear overlaps as an interval', () => {
    const hit = segmentIntersection({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 5, y: 0 }, { x: 15, y: 0 })
    expect(hit).not.toBeNull()
    expect(hit!.kind).toBe('overlap')
    if (hit!.kind === 'overlap') {
      expect(hit!.p1).toEqual({ x: 5, y: 0 })
      expect(hit!.p2).toEqual({ x: 10, y: 0 })
    }
  })

  it('isDegenerateRing flags zero-area rings', () => {
    expect(isDegenerateRing([{ x: 0, y: 0 }, { x: 5, y: 5 }, { x: 10, y: 10 }])).toBe(true)
    expect(isDegenerateRing(square(0, 0, 10, 10))).toBe(false)
  })
})

describe('differenceRegion', () => {
  it('turns a contained clip into a hole', () => {
    const residual = differenceRegion({ outer: square(0, 0, 100, 100), holes: [] }, square(25, 25, 50, 50))
    expect(residual).toHaveLength(1)
    expect(residual[0].holes).toHaveLength(1)
    expect(regionArea(residual[0])).toBeCloseTo(7500, 3)
  })

  it('splits the subject into two disjoint regions', () => {
    const residual = differenceRegion({ outer: square(0, 0, 100, 100), holes: [] }, square(45, 0, 10, 100))
    expect(residual).toHaveLength(2)
    expect(residual.every((r) => r.holes.length === 0)).toBe(true)
    const total = residual.reduce((sum, r) => sum + regionArea(r), 0)
    expect(total).toBeCloseTo(9000, 3)
  })

  it('returns empty when the clip fully covers the subject', () => {
    const residual = differenceRegion({ outer: square(0, 0, 100, 100), holes: [] }, square(-10, -10, 120, 120))
    expect(residual).toHaveLength(0)
  })

  it('leaves a disjoint clip untouched', () => {
    const residual = differenceRegion({ outer: square(0, 0, 100, 100), holes: [] }, square(200, 200, 20, 20))
    expect(residual).toHaveLength(1)
    expect(residual[0].holes).toHaveLength(0)
    expect(regionArea(residual[0])).toBeCloseTo(10000, 3)
  })

  it('a clip passing through a hole splits the annulus into two pieces', () => {
    const residual = differenceRegion(
      { outer: square(0, 0, 100, 100), holes: [square(25, 25, 50, 50)] },
      square(45, 0, 10, 100)
    )
    // The full-height strip severs the annulus into a left and a right band;
    // the hole's overlap becomes an open notch on each band's inner edge.
    expect(residual).toHaveLength(2)
    expect(residual.every((r) => r.holes.length === 0)).toBe(true)
    const total = residual.reduce((sum, r) => sum + regionArea(r), 0)
    expect(total).toBeCloseTo(7000, 3)
  })

  it('a clip merging into a hole and the outer edge folds into one contour', () => {
    const residual = differenceRegion(
      { outer: square(0, 0, 100, 100), holes: [square(25, 25, 50, 50)] },
      square(45, 0, 10, 30)
    )
    // The strip overlaps the hole (y 25..30) AND reaches the box's top edge,
    // so the removed union becomes a "bay" re-entrant into the single outer
    // contour rather than a hole ring: hole(2500) + strip(300) - overlap(50).
    expect(residual).toHaveLength(1)
    expect(residual[0].holes).toHaveLength(0)
    expect(regionArea(residual[0])).toBeCloseTo(7250, 3)
  })
})
