/**
 * preview — data-driven live-preview definitions: builders, style resolution,
 * bounds helpers, and the geometry→canvas mapping in `drawPreview`.
 */
import { describe, it, expect } from 'vitest'
import {
  DEFAULT_PREVIEW_STYLE,
  EMPTY_PREVIEW,
  PreviewVisual,
  buildBlurRegionPreview,
  buildGhostPreview,
  drawPreview,
  ellipsePreview,
  linePreview,
  rectPreview,
  resolveLiveGhost,
  resolveStyle,
  traceShape,
  visualBounds
} from '../renderer/services/preview'
import { getRotatedBounds } from '../renderer/services/geometry'

function fakeCtx(): { ctx: CanvasRenderingContext2D; calls: string[] } {
  const calls: string[] = []
  const fn = (name: string) => () => {
    calls.push(name)
  }
  const ctx = {
    save: fn('save'),
    restore: fn('restore'),
    beginPath: fn('beginPath'),
    fill: fn('fill'),
    stroke: fn('stroke'),
    clip: fn('clip'),
    fillRect: fn('fillRect'),
    moveTo: fn('moveTo'),
    lineTo: fn('lineTo'),
    rect: fn('rect'),
    ellipse: fn('ellipse'),
    setLineDash: fn('setLineDash')
  } as unknown as CanvasRenderingContext2D
  return { ctx, calls }
}

describe('preview builders', () => {
  it('rectPreview/ellipsePreview/linePreview carry their geometry and style', () => {
    expect(rectPreview(1, 2, 30, 40, { fill: '#fff' })).toEqual({
      kind: 'rect',
      x: 1,
      y: 2,
      width: 30,
      height: 40,
      style: { fill: '#fff' }
    })
    expect(ellipsePreview(5, 6, 7, 8)).toEqual({ kind: 'ellipse', x: 5, y: 6, width: 7, height: 8 })
    expect(linePreview(0, 0, 10, 10, 4)).toEqual({
      kind: 'line',
      x1: 0,
      y1: 0,
      x2: 10,
      y2: 10,
      width: 4
    })
  })

  it('resolveStyle merges base style with per-visual overrides', () => {
    const base = { stroke: 'red', strokeWidth: 2 }
    const visual = { kind: 'rect', x: 0, y: 0, width: 1, height: 1, style: { strokeWidth: 4 } } as PreviewVisual
    expect(resolveStyle(base, visual)).toEqual({
      ...DEFAULT_PREVIEW_STYLE,
      stroke: 'red',
      strokeWidth: 4
    })
    expect(resolveStyle(undefined, visual)).toEqual({ ...DEFAULT_PREVIEW_STYLE, strokeWidth: 4 })
  })

  it('visualBounds computes axis-aligned bounds incl. line segments', () => {
    expect(visualBounds({ kind: 'rect', x: 1, y: 2, width: 10, height: 20 })).toEqual({ x: 1, y: 2, width: 10, height: 20 })
    expect(visualBounds({ kind: 'ellipse', x: 1, y: 2, width: 10, height: 20 })).toEqual({ x: 1, y: 2, width: 10, height: 20 })
    expect(visualBounds({ kind: 'line', x1: 30, y1: 40, x2: 10, y2: 15, width: 4 })).toEqual({
      x: 10,
      y: 15,
      width: 20,
      height: 25
    })
  })
})

describe('buildGhostPreview', () => {
  it('emits a dashed glowing rect at the bounds', () => {
    const state = buildGhostPreview({ id: 'el-1', x: 10, y: 20, width: 100, height: 50 })
    expect(state.visuals).toHaveLength(1)
    expect(state.visuals[0]).toMatchObject({ kind: 'rect', x: 10, y: 20, width: 100, height: 50 })
    expect(state.style).toMatchObject({ lineDash: [6, 4], glow: true })
  })

  it('rotated bounds are expanded to the rotated box', () => {
    const state = buildGhostPreview({ id: 'el-1', x: 0, y: 0, width: 100, height: 100, rotation: 90 })
    const expected = getRotatedBounds({ x: 0, y: 0, width: 100, height: 100, rotation: 90 })
    expect(state.visuals[0]).toMatchObject({ x: expected.x, y: expected.y, width: expected.width, height: expected.height })
  })

  it('records the raw unrotated bounds as the rect source', () => {
    const state = buildGhostPreview({ id: 'el-1', x: 0, y: 0, width: 100, height: 100, rotation: 90 })
    expect(state.visuals[0]).toMatchObject({ source: { id: 'el-1', x: 0, y: 0, width: 100, height: 100, rotation: 90 } })
  })
})

describe('resolveLiveGhost', () => {
  it('resolves the ghost source for the matching element', () => {
    const state = buildGhostPreview({ id: 'el-1', x: 10, y: 20, width: 300, height: 200 })
    expect(resolveLiveGhost(state, 'el-1')).toEqual({ id: 'el-1', x: 10, y: 20, width: 300, height: 200 })
  })

  it('returns null for an element the ghost does not target', () => {
    const state = buildGhostPreview({ id: 'el-1', x: 10, y: 20, width: 300, height: 200 })
    expect(resolveLiveGhost(state, 'el-other')).toBeNull()
  })

  it('returns null for null previews and non-ghost previews (blur region)', () => {
    expect(resolveLiveGhost(null, 'el-1')).toBeNull()
    expect(resolveLiveGhost({ visuals: [{ kind: 'rect', x: 0, y: 0, width: 10, height: 10 }] }, 'el-1')).toBeNull()
  })
})

describe('buildBlurRegionPreview', () => {
  it('rect/ellipse map to their geometry; line keeps its width', () => {
    expect(buildBlurRegionPreview({ type: 'rect', x: 1, y: 2, width: 30, height: 40 }).visuals[0]).toMatchObject({
      kind: 'rect',
      x: 1,
      y: 2,
      width: 30,
      height: 40
    })
    expect(buildBlurRegionPreview({ type: 'ellipse', x: 1, y: 2, width: 30, height: 40 }).visuals[0]).toMatchObject({
      kind: 'ellipse',
      x: 1,
      y: 2,
      width: 30,
      height: 40
    })
    expect(buildBlurRegionPreview({ type: 'line', x1: 0, y1: 0, x2: 10, y2: 10, width: 6 }).visuals[0]).toMatchObject({
      kind: 'line',
      x1: 0,
      y1: 0,
      x2: 10,
      y2: 10,
      width: 6
    })
  })

  it('blur previews never render an actual blur (white + hatch language, never selection chrome)', () => {
    const state = buildBlurRegionPreview({ type: 'rect', x: 0, y: 0, width: 10, height: 10 })
    expect(state.style).toMatchObject({
      fill: 'rgba(255, 255, 255, 0.2)',
      stroke: 'rgba(255, 255, 255, 0.9)',
      hatch: true
    })
  })
})

describe('traceShape', () => {
  it('traces the correct primitive per kind', () => {
    const { ctx, calls } = fakeCtx()
    traceShape(ctx, { kind: 'rect', x: 0, y: 0, width: 10, height: 10 })
    traceShape(ctx, { kind: 'ellipse', x: 0, y: 0, width: 20, height: 10 })
    traceShape(ctx, { kind: 'line', x1: 0, y1: 0, x2: 5, y2: 5, width: 2 })
    expect(calls).toEqual(['rect', 'ellipse', 'moveTo', 'lineTo'])
  })
})

describe('drawPreview', () => {
  it('is a no-op for empty/null states', () => {
    const { ctx, calls } = fakeCtx()
    drawPreview(ctx, EMPTY_PREVIEW)
    drawPreview(ctx, null as never)
    expect(calls).toEqual([])
  })

  it('fills and strokes a rect visual with the resolved style', () => {
    const { ctx, calls } = fakeCtx()
    drawPreview(ctx, {
      visuals: [{ kind: 'rect', x: 0, y: 0, width: 10, height: 10 }]
    })
    expect(calls.filter((c) => c === 'save' || c === 'restore')).toHaveLength(2)
    expect(calls).toContain('fill')
    expect(calls).toContain('stroke')
  })

  it('applies the dashed line style for ghost visuals', () => {
    const { ctx, calls } = fakeCtx()
    drawPreview(ctx, {
      style: { lineDash: [6, 4] },
      visuals: [{ kind: 'rect', x: 0, y: 0, width: 10, height: 10 }]
    })
    expect(calls).toContain('setLineDash')
  })

  it('hatched visuals fill via clip + hatch strokes', () => {
    const { ctx, calls } = fakeCtx()
    drawPreview(ctx, {
      style: { hatch: true },
      visuals: [{ kind: 'rect', x: 0, y: 0, width: 10, height: 10 }]
    })
    expect(calls).toContain('clip')
    expect(calls.filter((c) => c === 'stroke').length).toBeGreaterThanOrEqual(2)
  })

  it('strokes line visuals with their own width and skips the fill pass', () => {
    const { ctx, calls } = fakeCtx()
    const writes: unknown[] = []
    const proxy = new Proxy(ctx, {
      set(target, prop, value) {
        if (prop === 'lineWidth') writes.push(value)
        ;(target as Record<string, unknown>)[prop] = value
        return true
      }
    }) as unknown as CanvasRenderingContext2D
    drawPreview(proxy, { visuals: [{ kind: 'line', x1: 0, y1: 0, x2: 10, y2: 10, width: 6 }] })
    expect(calls.filter((c) => c === 'fill')).toHaveLength(0)
    expect(calls).toContain('stroke')
    expect(writes).toContain(6)
  })
})
