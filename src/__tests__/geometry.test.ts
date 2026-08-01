/**
 * geometry tests — pure math extracted from the transform hooks.
 */
import { describe, it, expect } from 'vitest'
import { computeResize, getRotatedBounds, snapAxis, unionBounds } from '../renderer/services/geometry'

describe('computeResize', () => {
  const base = {
    startX: 0,
    startY: 0,
    zoom: 1,
    startElemX: 10,
    startElemY: 10,
    startWidth: 100,
    startHeight: 100
  }

  it('se moves right and bottom edges', () => {
    const r = computeResize({ ...base, handle: 'se', clientX: 50, clientY: 30, proportional: false })
    expect(r).toEqual({ x: 10, y: 10, width: 150, height: 130 })
  })

  it('sw moves the left edge rightward and bottom down', () => {
    const r = computeResize({ ...base, handle: 'sw', clientX: 50, clientY: 30, proportional: false })
    expect(r).toEqual({ x: 60, y: 10, width: 50, height: 130 })
  })

  it('ne moves the top edge up and right edge right', () => {
    const r = computeResize({ ...base, handle: 'ne', clientX: 50, clientY: 30, proportional: false })
    expect(r).toEqual({ x: 10, y: 40, width: 150, height: 70 })
  })

  it('nw moves left and top edges inward', () => {
    const r = computeResize({ ...base, handle: 'nw', clientX: 50, clientY: 30, proportional: false })
    expect(r).toEqual({ x: 60, y: 40, width: 50, height: 70 })
  })

  it('divides pointer delta by zoom', () => {
    const r = computeResize({ ...base, handle: 'se', clientX: 100, clientY: 0, zoom: 2, proportional: false })
    expect(r.width).toBe(150)
  })

  it('preserves aspect ratio in proportional mode', () => {
    const input = { ...base, startHeight: 50, handle: 'se', clientX: 40, clientY: 0, proportional: true }
    const r = computeResize(input)
    expect(r.width).toBe(140)
    expect(r.height).toBe(70)
  })

  it('proportional mode clamps to minimum width', () => {
    const r = computeResize({ ...base, handle: 'se', clientX: -1000, clientY: -1000, proportional: true })
    expect(r.width).toBe(20)
    expect(r.height).toBe(20)
  })

  it('clamps to minimum size', () => {
    const r = computeResize({ ...base, handle: 'se', clientX: -500, clientY: -500, proportional: false })
    expect(r.width).toBe(20)
    expect(r.height).toBe(20)
  })

  it('respects a custom minSize', () => {
    const r = computeResize({ ...base, handle: 'se', clientX: -500, clientY: -500, proportional: false, minSize: 5 })
    expect(r.width).toBe(5)
  })
})

describe('getRotatedBounds', () => {
  it('returns the rect unchanged for no rotation', () => {
    expect(getRotatedBounds({ id: 'a', x: 10, y: 20, width: 100, height: 50 })).toEqual({
      x: 10,
      y: 20,
      width: 100,
      height: 50
    })
  })

  it('swaps width and height at 90 degrees', () => {
    const b = getRotatedBounds({ id: 'a', x: 10, y: 10, width: 100, height: 50, rotation: 90 })
    expect(b.width).toBeCloseTo(50)
    expect(b.height).toBeCloseTo(100)
    expect(b.x).toBeCloseTo(35)
    expect(b.y).toBeCloseTo(-15)
  })

  it('expands the AABB for diagonal rotations', () => {
    const b = getRotatedBounds({ id: 'a', x: 0, y: 0, width: 100, height: 100, rotation: 45 })
    const expected = 100 * (Math.SQRT2 / 2) * 2
    expect(b.width).toBeCloseTo(expected)
    expect(b.height).toBeCloseTo(expected)
  })
})

describe('unionBounds', () => {
  it('returns null for an empty list', () => {
    expect(unionBounds([])).toBeNull()
  })

  it('returns the single element bounds for one element', () => {
    expect(unionBounds([{ id: 'a', x: 10, y: 20, width: 100, height: 50 }])).toEqual({
      x: 10,
      y: 20,
      width: 100,
      height: 50
    })
  })

  it('unions disjoint axis-aligned elements', () => {
    const u = unionBounds([
      { id: 'a', x: 0, y: 0, width: 100, height: 100 },
      { id: 'b', x: 200, y: 300, width: 50, height: 50 }
    ])
    expect(u).toEqual({ x: 0, y: 0, width: 250, height: 350 })
  })

  it('uses rotation-aware bounds so rotated elements expand the union', () => {
    const u = unionBounds([
      { id: 'a', x: 0, y: 0, width: 100, height: 100, rotation: 45 },
      { id: 'b', x: 0, y: 0, width: 100, height: 100 }
    ])
    const expanded = 100 * (Math.SQRT2 / 2) * 2
    expect(u!.width).toBeCloseTo(expanded)
    expect(u!.height).toBeCloseTo(expanded)
  })
})

describe('snapAxis', () => {
  it('snaps to a target within the threshold', () => {
    const r = snapAxis({ pos: 97, size: 50, targets: [100], canvasSize: 500, threshold: 5 })
    expect(r.snapped).toBe(100)
    expect(r.guide).toBe(100)
  })

  it('returns the original position when nothing is close enough', () => {
    const r = snapAxis({ pos: 200, size: 40, targets: [100], canvasSize: 500, threshold: 5 })
    expect(r.snapped).toBe(200)
    expect(r.guide).toBeNull()
  })

  it('snaps to canvas edges and center', () => {
    expect(snapAxis({ pos: 497, size: 50, targets: [], canvasSize: 500, threshold: 5 }).guide).toBe(500)
    expect(snapAxis({ pos: 0, size: 50, targets: [], canvasSize: 500, threshold: 5 }).guide).toBe(0)
  })

  it('uses the strongest of multiple candidates', () => {
    const r = snapAxis({ pos: 97, size: 50, targets: [100, 98], canvasSize: 500, threshold: 5 })
    expect(r.guide).toBe(98)
  })
})
