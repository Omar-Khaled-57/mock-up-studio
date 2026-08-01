import { describe, expect, it } from 'vitest'
import { StrokeSampler, DEFAULT_MAX_POINTS, DEFAULT_MIN_DISTANCE } from '../renderer/services/stroke'

function makeDescriptor() {
  return {
    brushType: 'paint' as const,
    size: 12,
    hardness: 0.8,
    color: '#ff0000',
    targetId: null,
    seed: 42
  }
}

describe('StrokeSampler', () => {
  it('begins a stroke with a fresh buffer and the given descriptor', () => {
    const sampler = new StrokeSampler()
    expect(sampler.length).toBe(0)
    expect(sampler.descriptor).toBeNull()
    sampler.begin(makeDescriptor())
    expect(sampler.length).toBe(0)
    expect(sampler.descriptor?.brushType).toBe('paint')
  })

  it('accepts the first point regardless of the min distance threshold', () => {
    const sampler = new StrokeSampler(100, 10)
    sampler.begin(makeDescriptor())
    expect(sampler.append(5, 5)).toBe(true)
    expect(sampler.length).toBe(1)
  })

  it('skips a point closer than minDistance and accepts a far point', () => {
    const sampler = new StrokeSampler(100, 10)
    sampler.begin(makeDescriptor())
    sampler.append(0, 0)
    expect(sampler.append(1, 1)).toBe(false)
    expect(sampler.length).toBe(1)
    expect(sampler.append(20, 0)).toBe(true)
    expect(sampler.length).toBe(2)
  })

  it('stores pressure along with coordinates', () => {
    const sampler = new StrokeSampler()
    sampler.begin(makeDescriptor())
    sampler.append(0, 0, 0.25)
    sampler.append(5, 0, 0.75)
    expect(sampler.x(0)).toBe(0)
    expect(sampler.y(0)).toBe(0)
    expect(sampler.pressure(0)).toBe(0.25)
    expect(sampler.pressure(1)).toBe(0.75)
  })

  it('stops accepting points once the buffer is full', () => {
    const sampler = new StrokeSampler(3, 1)
    sampler.begin(makeDescriptor())
    expect(sampler.append(0, 0)).toBe(true)
    expect(sampler.append(10, 0)).toBe(true)
    expect(sampler.append(20, 0)).toBe(true)
    expect(sampler.full).toBe(true)
    expect(sampler.append(30, 0)).toBe(false)
    expect(sampler.length).toBe(3)
  })

  it('force-accepts the final point even when it is closer than minDistance', () => {
    const sampler = new StrokeSampler(100, 10)
    sampler.begin(makeDescriptor())
    sampler.append(0, 0)
    expect(sampler.append(1, 1)).toBe(false)
    expect(sampler.appendLast(1, 1)).toBe(true)
    expect(sampler.length).toBe(2)
  })

  it('appendLast still respects the buffer capacity', () => {
    const sampler = new StrokeSampler(1, 1)
    sampler.begin(makeDescriptor())
    sampler.appendLast(0, 0)
    expect(sampler.appendLast(5, 5)).toBe(false)
  })

  it('forEach visits every accepted point in order', () => {
    const sampler = new StrokeSampler()
    sampler.begin(makeDescriptor())
    sampler.append(0, 0)
    sampler.append(10, 0)
    sampler.append(20, 5, 0.5)
    const seen: [number, number, number, number][] = []
    sampler.forEach((i, x, y, p) => seen.push([i, x, y, p]))
    expect(seen).toEqual([
      [0, 0, 0, 1],
      [1, 10, 0, 1],
      [2, 20, 5, 0.5]
    ])
  })

  it('toPoints materializes the accepted points without mutating the sampler', () => {
    const sampler = new StrokeSampler()
    sampler.begin(makeDescriptor())
    sampler.append(0, 0)
    sampler.append(10, 0, 0.3)
    const points = sampler.toPoints()
    expect(points).toEqual([
      { x: 0, y: 0, pressure: 1 },
      { x: 10, y: 0, pressure: 0.3 }
    ])
    expect(sampler.length).toBe(2)
  })

  it('reset clears the buffer, the last point and the descriptor', () => {
    const sampler = new StrokeSampler()
    sampler.begin(makeDescriptor())
    sampler.append(0, 0)
    sampler.append(10, 0)
    sampler.reset()
    expect(sampler.length).toBe(0)
    expect(sampler.descriptor).toBeNull()
    sampler.begin(makeDescriptor())
    expect(sampler.append(0, 0)).toBe(true)
  })

  it('reuses the same underlying buffers across strokes (no growth)', () => {
    const sampler = new StrokeSampler(64, 1)
    sampler.begin(makeDescriptor())
    for (let i = 0; i < 64; i++) sampler.append(i * 5, 0)
    expect(sampler.length).toBe(64)
    sampler.begin(makeDescriptor())
    expect(sampler.append(0, 0)).toBe(true)
    expect(sampler.length).toBe(1)
    expect(sampler.full).toBe(false)
  })

  it('exports usable default bounds', () => {
    expect(DEFAULT_MAX_POINTS).toBeGreaterThan(0)
    expect(DEFAULT_MIN_DISTANCE).toBeGreaterThan(0)
    const sampler = new StrokeSampler()
    expect(sampler.maxPoints).toBe(DEFAULT_MAX_POINTS)
    expect(sampler.minDistance).toBe(DEFAULT_MIN_DISTANCE)
  })
})
