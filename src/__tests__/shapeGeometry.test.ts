/**
 * shape-geometry — unit tests for the cross-shape union outline (the container
 * clip now emits the exact ✕ silhouette instead of the box fallback).
 *
 * The outline is parsed back out of the SVG path string so these tests exercise
 * the real contract: a simple closed 12-gon whose interior matches the union of
 * the two parallelogram arms (center in, box mid-edges out, corners in).
 */
import { describe, it, expect } from 'vitest'
import { getShapePath } from '../renderer/services/shape-geometry'

interface Pt {
  x: number
  y: number
}

function parsePath(path: string): Pt[] {
  const pairs = path.match(/-?\d+\.?\d* -?\d+\.?\d*/g) ?? []
  return pairs.map((pair) => {
    const [x, y] = pair.split(' ')
    return { x: parseFloat(x), y: parseFloat(y) }
  })
}

function pointInRing(p: Pt, ring: Pt[]): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i]
    const b = ring[j]
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) {
      inside = !inside
    }
  }
  return inside
}

function ringArea(ring: Pt[]): number {
  let sum = 0
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    sum += ring[j].x * ring[i].y - ring[i].x * ring[j].y
  }
  return Math.abs(sum) / 2
}

function edgesProperlyCross(a1: Pt, a2: Pt, b1: Pt, b2: Pt): boolean {
  const d1 = { x: a2.x - a1.x, y: a2.y - a1.y }
  const d2 = { x: b2.x - b1.x, y: b2.y - b1.y }
  const den = d1.x * d2.y - d1.y * d2.x
  if (Math.abs(den) < 1e-9) return false
  const t = ((b1.x - a1.x) * d2.y - (b1.y - a1.y) * d2.x) / den
  const u = ((b1.x - a1.x) * d1.y - (b1.y - a1.y) * d1.x) / den
  return t > 1e-6 && t < 1 - 1e-6 && u > 1e-6 && u < 1 - 1e-6
}

describe('getShapePath cross', () => {
  it('emits a closed 12-gon (not the empty-string fallback) for a square', () => {
    const path = getShapePath('cross', 100, 100, 0, undefined, 0.3)
    expect(path).not.toBe('')
    const ring = parsePath(path)
    expect(ring).toHaveLength(12)
    expect(path.endsWith(' Z')).toBe(true)
  })

  it('interior matches the ✕ union: center and corners in, box mid-edges out', () => {
    const ring = parsePath(getShapePath('cross', 100, 100, 0, undefined, 0.3))
    expect(pointInRing({ x: 50, y: 50 }, ring)).toBe(true)
    expect(pointInRing({ x: 4, y: 4 }, ring)).toBe(true)
    expect(pointInRing({ x: 96, y: 96 }, ring)).toBe(true)
    expect(pointInRing({ x: 4, y: 96 }, ring)).toBe(true)
    expect(pointInRing({ x: 96, y: 4 }, ring)).toBe(true)
    expect(pointInRing({ x: 50, y: 0 }, ring)).toBe(false)
    expect(pointInRing({ x: 50, y: 100 }, ring)).toBe(false)
    expect(pointInRing({ x: 0, y: 50 }, ring)).toBe(false)
    expect(pointInRing({ x: 100, y: 50 }, ring)).toBe(false)
  })

  it('outline is simple: no two non-adjacent edges cross', () => {
    const ring = parsePath(getShapePath('cross', 100, 100, 0, undefined, 0.3))
    for (let i = 0; i < ring.length; i++) {
      for (let j = i + 2; j < ring.length; j++) {
        const adjacent = i === 0 && j === ring.length - 1
        if (adjacent) continue
        if (j === i + 1) continue
        expect(edgesProperlyCross(ring[i], ring[(i + 1) % ring.length], ring[j], ring[(j + 1) % ring.length])).toBe(false)
      }
    }
  })

  it('outline area approximates the two-arm union (no double-count, no bowtie)', () => {
    const ring = parsePath(getShapePath('cross', 100, 100, 0, undefined, 0.3))
    const area = ringArea(ring)
    expect(area).toBeGreaterThan(7000)
    expect(area).toBeLessThan(8000)
  })

  it('is consistent across box aspect ratios and thicknesses', () => {
    for (const [w, h] of [
      [300, 100],
      [80, 200],
      [120, 120]
    ]) {
      const ring = parsePath(getShapePath('cross', w, h, 0, undefined, 0.3))
      expect(ring).toHaveLength(12)
      expect(pointInRing({ x: w / 2, y: h / 2 }, ring)).toBe(true)
      expect(pointInRing({ x: w / 2, y: 0 }, ring)).toBe(false)
    }
    const thin = ringArea(parsePath(getShapePath('cross', 100, 100, 0, undefined, 0.15)))
    const thick = ringArea(parsePath(getShapePath('cross', 100, 100, 0, undefined, 0.5)))
    expect(thin).toBeLessThan(thick)
  })

  it('returns the empty string for a degenerate zero-area box', () => {
    expect(getShapePath('cross', 0, 0, 0, undefined, 0.3)).toBe('')
  })
})
