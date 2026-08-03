/**
 * mask-diff — subtractive unmask resolution.
 *
 * Validates `resolveUnmaskCommit` against the shape/region contracts: ring
 * builders match the renderer, strokes outside or absent masks are no-ops
 * (`null` → no history entry), a partial carve leaves an inverted brush mask
 * with holes, a split produces multiple brush masks, full coverage erases the
 * mask, reveal (non-inverted) masks are removed on ANY unmask stroke on the
 * target (kept shape or hidden frame — their hidden region is the whole box,
 * so any carve is a dead end), box-covering residuals are dropped (an unmask
 * that only cut interior holes clears the whole-canvas mask instead of leaving
 * it hidden again), untouched masks are preserved by reference, and
 * coincident-hole strokes are detected as no-ops.
 */
import { describe, it, expect } from 'vitest'
import { Mask } from '@shared/types'
import { resolveUnmaskCommit, rectRing, ellipseRing, ringCoversBox } from '../renderer/services/mask-diff'
import { buildMaskClipPath } from '../renderer/services/mask-visualization'

function square(x: number, y: number, width: number, height: number) {
  return [
    { x, y },
    { x: x + width, y },
    { x: x + width, y: y + height },
    { x, y: y + height }
  ]
}

function mask(overrides: Partial<Mask> = {}): Mask {
  return {
    id: 'm1',
    name: 'Mask 1',
    shape: 'rectangle',
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    points: [],
    inverted: true,
    zIndex: 0,
    visible: true,
    locked: false,
    ...overrides
  }
}

describe('ring builders', () => {
  it('rectRing traces the four corners in order', () => {
    expect(rectRing(10, 20, 30, 40)).toEqual([
      { x: 10, y: 20 },
      { x: 40, y: 20 },
      { x: 40, y: 60 },
      { x: 10, y: 60 }
    ])
  })

  it('ellipseRing is a 32-gon matching the clip renderer', () => {
    const ring = ellipseRing(10, 10, 40, 20)
    expect(ring).toHaveLength(32)
    expect(ring[0]).toEqual({ x: 50, y: 20 })
    expect(ring[8]).toEqual({ x: 30, y: 30 })
    expect(ring[16]).toEqual({ x: 10, y: 20 })
  })
})

describe('resolveUnmaskCommit', () => {
  it('returns null when the target has no masks', () => {
    expect(resolveUnmaskCommit([], square(0, 0, 10, 10), 100, 100)).toBeNull()
  })

  it('returns null when the stroke is entirely outside every mask', () => {
    const m = mask({ id: 'a', x: 0, y: 0, width: 50, height: 50 })
    expect(resolveUnmaskCommit([m], square(60, 60, 10, 10), 100, 100)).toBeNull()
  })

  it('clears a full-box punch when an unmask stroke only carves interior holes', () => {
    const m = mask({ id: 'a', shape: 'rectangle', x: 0, y: 0, width: 100, height: 100 })
    const result = resolveUnmaskCommit([m], square(25, 25, 50, 50), 100, 100)!
    expect(result).toEqual([])
  })

  it('carves an interior hole through a partial punch, keeping the mask', () => {
    const m = mask({ id: 'a', shape: 'rectangle', x: 10, y: 10, width: 80, height: 80 })
    const result = resolveUnmaskCommit([m], square(30, 30, 40, 40), 100, 100)!
    expect(result).not.toBeNull()
    expect(result).toHaveLength(1)
    expect(result[0].id).not.toBe('a')
    expect(result[0]).toMatchObject({
      shape: 'brush',
      inverted: true,
      x: 10,
      y: 10,
      width: 80,
      height: 80,
      name: 'Mask 1',
      zIndex: 0,
      visible: true,
      locked: false
    })
    expect(result[0].holes).toHaveLength(1)
    expect(result[0].holes![0]).toHaveLength(4)
  })

  it('inherits the source mask snapshot onto a carved residual', () => {
    const snapshot = {
      dataUrl: 'data:image/png;base64,AA==',
      width: 100,
      height: 100,
      sourceBounds: { x: 10, y: 20, width: 100, height: 100 },
      capturedAt: 1234
    }
    const m = mask({ id: 'a', shape: 'rectangle', x: 10, y: 10, width: 80, height: 80, snapshot })
    const result = resolveUnmaskCommit([m], square(30, 30, 40, 40), 100, 100)!
    expect(result).toHaveLength(1)
    expect(result[0].snapshot).toEqual(snapshot)
  })

  it('carved residuals inherit the source mask layer fields', () => {
    const m = mask({
      id: 'a',
      name: 'My Mask',
      shape: 'rectangle',
      x: 10,
      y: 10,
      width: 80,
      height: 80,
      zIndex: 5,
      visible: true,
      locked: false
    })
    const result = resolveUnmaskCommit([m], square(30, 30, 40, 40), 100, 100)!
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ name: 'My Mask', zIndex: 5, visible: true, locked: false })
  })

  it('never carves invisible masks (left untouched by reference)', () => {
    const m = mask({ id: 'a', shape: 'rectangle', x: 0, y: 0, width: 100, height: 100, visible: false })
    const result = resolveUnmaskCommit([m], square(25, 25, 50, 50), 100, 100)
    expect(result).toBeNull()
  })

  it('never carves locked masks (left untouched by reference)', () => {
    const m = mask({ id: 'a', shape: 'rectangle', x: 0, y: 0, width: 100, height: 100, locked: true })
    const result = resolveUnmaskCommit([m], square(25, 25, 50, 50), 100, 100)
    expect(result).toBeNull()
  })

  it('keeps a full-box punch carved by an edge-touching stroke (bay restore)', () => {
    const m = mask({ id: 'a', shape: 'rectangle', x: 0, y: 0, width: 100, height: 100 })
    const result = resolveUnmaskCommit([m], square(0, 0, 40, 100), 100, 100)!
    expect(result).not.toBeNull()
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ shape: 'brush', inverted: true, x: 40, y: 0, width: 60, height: 100 })
  })

  it('splits a punch into two separate brush masks', () => {
    const m = mask({ id: 'a', shape: 'rectangle', x: 0, y: 0, width: 100, height: 100 })
    const result = resolveUnmaskCommit([m], square(45, 0, 10, 100), 100, 100)!
    expect(result).toHaveLength(2)
    expect(result.every((r) => r.shape === 'brush' && r.inverted)).toBe(true)
    const boxes = result
      .map((r) => ({ x: r.x, y: r.y, width: r.width, height: r.height }))
      .sort((a, b) => a.x - b.x)
    expect(boxes).toEqual([
      { x: 0, y: 0, width: 45, height: 100 },
      { x: 55, y: 0, width: 45, height: 100 }
    ])
  })

  it('removes a mask fully covered by a larger stroke', () => {
    const m = mask({ id: 'a', shape: 'rectangle', x: 20, y: 20, width: 60, height: 60 })
    const result = resolveUnmaskCommit([m], square(0, 0, 100, 100), 100, 100)!
    expect(result).toEqual([])
  })

  it('erases a reveal mask on any unmask stroke in its hidden frame', () => {
    const m = mask({ id: 'a', shape: 'rectangle', x: 10, y: 10, width: 40, height: 40, inverted: false })
    const result = resolveUnmaskCommit([m], square(10, 60, 40, 30), 100, 100)!
    expect(result).toEqual([])
  })

  it('erases a reveal mask entirely when the stroke overlaps its kept shape', () => {
    const m = mask({ id: 'a', shape: 'rectangle', x: 20, y: 20, width: 60, height: 60, inverted: false })
    const result = resolveUnmaskCommit([m], square(40, 40, 20, 20), 100, 100)!
    expect(result).toEqual([])
  })

  it('erases a full-bounds reveal (PropertiesPanel Add Mask) on any stroke', () => {
    const m = mask({ id: 'a', shape: 'rectangle', x: 0, y: 0, width: 100, height: 100, inverted: false })
    const result = resolveUnmaskCommit([m], square(45, 45, 10, 10), 100, 100)!
    expect(result).toEqual([])
  })

  it('erases a reveal mask when the stroke grazes its kept-shape boundary', () => {
    const m = mask({ id: 'a', shape: 'rectangle', x: 20, y: 20, width: 60, height: 60, inverted: false })
    const result = resolveUnmaskCommit([m], square(80, 40, 10, 10), 100, 100)!
    expect(result).toEqual([])
  })

  it('erases a reveal mask when a stroke grazes its hidden frame edge', () => {
    const m = mask({ id: 'a', shape: 'rectangle', x: 20, y: 20, width: 40, height: 40, inverted: false })
    const result = resolveUnmaskCommit([m], square(70, 20, 10, 40), 100, 100)!
    expect(result).toEqual([])
  })

  it('preserves untouched masks by reference and rewrites only touched ones', () => {
    const untouched = mask({ id: 'a', x: 0, y: 0, width: 50, height: 50 })
    const touched = mask({ id: 'b', x: 0, y: 60, width: 50, height: 40 })
    const result = resolveUnmaskCommit([untouched, touched], square(10, 80, 20, 5), 100, 100)!
    expect(result).not.toBeNull()
    expect(result).toHaveLength(2)
    expect(result[0]).toBe(untouched)
    expect(result[1].id).not.toBe('b')
    expect(result[1]).toMatchObject({ shape: 'brush', inverted: true })
    expect(result[1].holes).toHaveLength(1)
  })

  it('treats a stroke coinciding with an existing hole as a no-op', () => {
    const carved = mask({
      id: 'c',
      shape: 'brush',
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      points: square(0, 0, 100, 100),
      holes: [square(25, 25, 50, 50)]
    })
    expect(resolveUnmaskCommit([carved], square(25, 25, 50, 50), 100, 100)).toBeNull()
  })

  it('produces masks whose clip paths carry the hole contours', () => {
    const m = mask({ id: 'a', shape: 'rectangle', x: 10, y: 10, width: 80, height: 80 })
    const result = resolveUnmaskCommit([m], square(30, 30, 40, 40), 100, 100)!
    const clip = buildMaskClipPath(result[0], 100, 100)
    // Opposite-wound path(): box base, outer ring opposed (punched), the
    // residual hole ring (the carve) aligned (restored through the punch).
    expect(clip).toBe("path('M 0 0 L 100 0 L 100 100 L 0 100 Z M 10 90 L 90 90 L 90 10 L 10 10 Z M 70 70 L 30 70 L 30 30 L 70 30 Z')")
  })

  it('renders a full-bounds reveal as an inset(0) clip that hides nothing', () => {
    const m = mask({ id: 'a', shape: 'rectangle', x: 0, y: 0, width: 100, height: 100, inverted: false })
    expect(buildMaskClipPath(m, 100, 100)).toBe('inset(0px 0px 0px 0px)')
  })
})

describe('ringCoversBox', () => {
  it('detects a ring spanning the whole element box', () => {
    expect(ringCoversBox(square(0, 0, 100, 100), 100, 100)).toBe(true)
  })

  it('rejects a partial ring and off-by-one boundaries', () => {
    expect(ringCoversBox(square(10, 10, 80, 80), 100, 100)).toBe(false)
    expect(ringCoversBox(square(0, 0, 100, 99), 100, 100)).toBe(false)
    expect(ringCoversBox(square(0, 0, 99, 100), 100, 100)).toBe(false)
  })
})

describe('buildMaskClipPath box-covering punches', () => {
  it('emits a single-contour polygon for a box-covering punch (no self-cancelling double contour)', () => {
    const m = mask({ id: 'a', shape: 'rectangle', x: 0, y: 0, width: 100, height: 100 })
    const clip = buildMaskClipPath(m, 100, 100)
    expect(clip).toBe('polygon(evenodd, 0px 0px, 100px 0px, 100px 100px, 0px 100px)')
  })

  it('subtracts restored holes from a box-covering punch', () => {
    const m = mask({
      id: 'a',
      shape: 'brush',
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      points: square(0, 0, 100, 100),
      holes: [square(25, 25, 50, 50)]
    })
    const clip = buildMaskClipPath(m, 100, 100)
    expect(clip).toBe("path('M 0 0 L 100 0 L 100 100 L 0 100 Z M 25 75 L 75 75 L 75 25 L 25 25 Z')")
  })

  it('keeps the opposite-wound path() form for a partial brush punch', () => {
    const m = mask({
      id: 'a',
      shape: 'brush',
      x: 10,
      y: 10,
      width: 80,
      height: 80,
      points: square(10, 10, 80, 80),
      inverted: true
    })
    const clip = buildMaskClipPath(m, 100, 100)
    expect(clip).toBe("path('M 0 0 L 100 0 L 100 100 L 0 100 Z M 10 90 L 90 90 L 90 10 L 10 10 Z')")
  })
})
