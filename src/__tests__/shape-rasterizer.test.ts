import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { rasterizeShapeBitmap } from '../renderer/services/shape-rasterizer'
import { makeShape } from './helpers'

class FakePath2D {
  static instances: FakePath2D[] = []
  pathData: string

  constructor(pathData?: string) {
    this.pathData = pathData ?? ''
    FakePath2D.instances.push(this)
  }
  clip(): void {}
}

interface GradientMock {
  x0: number
  y0: number
  x1: number
  y1: number
  r0?: number
  r1?: number
  stops: [number, string][]
}

class FakeCtx {
  static instances: FakeCtx[] = []
  saveCalls = 0
  restoreCalls = 0
  clipCalls = 0
  clippedPath: unknown = null
  fillRects = 0
  fillStyle: string | CanvasGradient = ''
  gradients: GradientMock[] = []
  translateCalls: [number, number][] = []
  rotateCalls: number[] = []
  scaleCalls: [number, number][] = []
  beginPathCalls = 0
  pathCalls = 0

  constructor() {
    FakeCtx.instances.push(this)
  }

  save(): void {
    this.saveCalls++
  }
  restore(): void {
    this.restoreCalls++
  }
  clip(path?: unknown): void {
    this.clipCalls++
    this.clippedPath = path
  }
  fillRect(): void {
    this.fillRects++
  }
  fill(): void {
    this.fillRects++
  }
  translate(x: number, y: number): void {
    this.translateCalls.push([x, y])
  }
  rotate(a: number): void {
    this.rotateCalls.push(a)
  }
  scale(x: number, y: number): void {
    this.scaleCalls.push([x, y])
  }
  beginPath(): void {
    this.beginPathCalls++
  }
  moveTo(): void {
    this.pathCalls++
  }
  lineTo(): void {
    this.pathCalls++
  }
  closePath(): void {
    this.pathCalls++
  }
  createLinearGradient(x0: number, y0: number, x1: number, y1: number): CanvasGradient {
    const grad: GradientMock = { x0, y0, x1, y1, stops: [] }
    this.gradients.push(grad)
    return {
      addColorStop: (offset: number, color: string) => {
        grad.stops.push([offset, color])
      }
    } as unknown as CanvasGradient
  }
  createRadialGradient(x0: number, y0: number, r0: number, x1: number, y1: number, r1: number): CanvasGradient {
    const grad: GradientMock = { x0, y0, x1, y1, r0, r1, stops: [] }
    this.gradients.push(grad)
    return {
      addColorStop: (offset: number, color: string) => {
        grad.stops.push([offset, color])
      }
    } as unknown as CanvasGradient
  }
}

class FakeOffscreenCanvas {
  static instances: FakeCtx[] = []
  static canvasInstances: FakeOffscreenCanvas[] = []
  width: number
  height: number
  readonly ctx = new FakeCtx()

  constructor(width: number, height: number) {
    this.width = width
    this.height = height
    FakeOffscreenCanvas.instances.push(this.ctx)
    FakeOffscreenCanvas.canvasInstances.push(this)
  }

  getContext(kind: string): FakeCtx | null {
    return kind === '2d' ? this.ctx : null
  }

  toDataURL(): string {
    return 'data:image/png;base64,fake-rasterized'
  }
}

describe('shape-rasterizer', () => {
  describe('null contracts (no Path2D)', () => {
    it('returns null when Path2D is unavailable', async () => {
      const result = await rasterizeShapeBitmap(makeShape({ id: 'shp-1', width: 100, height: 80, color: '#ff0000' }))
      expect(result).toBeNull()
    })
  })

  describe('with mocked canvas + Path2D', () => {
    beforeEach(() => {
      FakePath2D.instances.length = 0
      FakeCtx.instances.length = 0
      FakeOffscreenCanvas.instances.length = 0
      FakeOffscreenCanvas.canvasInstances.length = 0
      vi.stubGlobal('Path2D', FakePath2D)
      vi.stubGlobal('OffscreenCanvas', FakeOffscreenCanvas)
    })

    afterEach(() => {
      vi.unstubAllGlobals()
    })

    it('rasterizes a solid-color rectangle with clip + fillRect and returns a data URL', async () => {
      const shape = makeShape({ id: 'shp-1', width: 100, height: 80, color: '#ff0000' })
      const result = await rasterizeShapeBitmap(shape)

      expect(result).toBe('data:image/png;base64,fake-rasterized')
      expect(FakeOffscreenCanvas.canvasInstances).toHaveLength(1)
      expect(FakeOffscreenCanvas.canvasInstances[0].width).toBe(100)
      expect(FakeOffscreenCanvas.canvasInstances[0].height).toBe(80)

      const ctx = FakeOffscreenCanvas.instances[0]
      expect(ctx.saveCalls).toBeGreaterThanOrEqual(1)
      expect(ctx.clipCalls).toBe(1)
      expect(ctx.fillRects).toBe(1)
      expect(ctx.fillStyle).toBe('#ff0000')
      expect(ctx.restoreCalls).toBeGreaterThanOrEqual(1)
    })

    it('constructs the Path2D from getShapePath output', async () => {
      const shape = makeShape({ id: 'shp-1', width: 50, height: 50, color: '#00ff00' })
      await rasterizeShapeBitmap(shape)

      expect(FakePath2D.instances).toHaveLength(1)
      expect(FakePath2D.instances[0].pathData).toBe('M 0 0 L 50 0 L 50 50 L 0 50 Z')
    })

    it('rasterizes a gradient shape with createLinearGradient and rotation', async () => {
      const shape = makeShape({
        id: 'shp-1',
        width: 100,
        height: 100,
        color: '#000000',
        gradient: { enabled: true, colors: ['#ff0000', '#0000ff'], angle: 90 }
      })
      const result = await rasterizeShapeBitmap(shape)

      expect(result).toBe('data:image/png;base64,fake-rasterized')
      const ctx = FakeOffscreenCanvas.instances[0]
      expect(ctx.gradients).toHaveLength(1)
      expect(ctx.gradients[0].stops).toEqual([[0, '#ff0000'], [1, '#0000ff']])
      expect(ctx.rotateCalls.length).toBe(1)
      expect(ctx.rotateCalls[0]).toBeCloseTo((90 * Math.PI) / 180)
    })

    it('respects the scale parameter for canvas dimensions', async () => {
      const shape = makeShape({ id: 'shp-1', width: 50, height: 50, color: '#00ff00' })
      await rasterizeShapeBitmap(shape, 2)

      expect(FakeOffscreenCanvas.canvasInstances[0].width).toBe(100)
      expect(FakeOffscreenCanvas.canvasInstances[0].height).toBe(100)
    })

    it('scales cornerRadius with the scale parameter', async () => {
      const shape = makeShape({ id: 'shp-1', kind: 'rectangle', width: 100, height: 100, color: '#000000', cornerRadius: 10 })
      await rasterizeShapeBitmap(shape, 2)

      // cornerRadius should be 20 in the scaled path
      expect(FakePath2D.instances[0].pathData).toContain('Q 200 0 200 20')
    })

    it('rasterizes a star shape with the correct path', async () => {
      const shape = makeShape({ id: 'shp-1', kind: 'star', width: 100, height: 100 })
      await rasterizeShapeBitmap(shape)

      // Star path starts with a comma-separated coordinate (50,0)
      expect(FakePath2D.instances[0].pathData).toMatch(/^M 50,0 /)
    })

    it('rasterizes a circle shape with an arc path', async () => {
      const shape = makeShape({ id: 'shp-1', kind: 'circle', width: 100, height: 100 })
      await rasterizeShapeBitmap(shape)

      expect(FakePath2D.instances[0].pathData).toContain('A 50 50')
    })

    it('rasterizes a radial circle gradient with a canvas radial gradient', async () => {
      const shape = makeShape({
        id: 'shp-1',
        width: 100,
        height: 80,
        color: '#000000',
        gradient: { enabled: true, colors: ['#ff0000', '#00ff00', '#0000ff'], angle: 0, type: 'radial', radialShape: 'circle' }
      })
      await rasterizeShapeBitmap(shape)

      const ctx = FakeOffscreenCanvas.instances[0]
      expect(ctx.gradients).toHaveLength(1)
      const grad = ctx.gradients[0]
      expect(grad.r0).toBe(0)
      // circle → farthest corner radius
      expect(grad.r1).toBeCloseTo(Math.sqrt(50 * 50 + 40 * 40))
      expect(grad.stops).toEqual([[0, '#ff0000'], [0.5, '#00ff00'], [1, '#0000ff']])
      expect(ctx.scaleCalls).toHaveLength(0)
      expect(ctx.rotateCalls).toHaveLength(0)
      expect(ctx.fillRects).toBe(1)
    })

    it('rasterizes a radial ellipse gradient with a y-scale squash', async () => {
      const shape = makeShape({
        id: 'shp-1',
        width: 100,
        height: 80,
        color: '#000000',
        gradient: { enabled: true, colors: ['#ff0000', '#0000ff'], angle: 0, type: 'radial', radialShape: 'ellipse' }
      })
      await rasterizeShapeBitmap(shape)

      const ctx = FakeOffscreenCanvas.instances[0]
      expect(ctx.scaleCalls).toEqual([[1, 80 / 100]])
      // ellipse → x half-width
      expect(ctx.gradients[0].r1).toBeCloseTo(50)
      expect(ctx.rotateCalls).toHaveLength(0)
    })

    it('rasterizes a conic gradient as 128 angular wedges without a canvas gradient', async () => {
      const shape = makeShape({
        id: 'shp-1',
        width: 100,
        height: 80,
        color: '#000000',
        gradient: { enabled: true, colors: ['#ff0000', '#0000ff'], angle: 45, type: 'conic', radialShape: 'circle' }
      })
      await rasterizeShapeBitmap(shape)

      const ctx = FakeOffscreenCanvas.instances[0]
      expect(ctx.gradients).toHaveLength(0)
      expect(ctx.fillRects).toBe(128)
      expect(ctx.beginPathCalls).toBe(128)
      // each wedge contributes moveTo + 2 lineTo + closePath
      expect(ctx.pathCalls).toBe(128 * 4)
      expect(ctx.rotateCalls).toHaveLength(0)
    })

    it('uses shape color for non-gradient shapes', async () => {
      const shape = makeShape({ id: 'shp-1', kind: 'diamond', width: 80, height: 80, color: '#123456' })
      await rasterizeShapeBitmap(shape)

      const ctx = FakeOffscreenCanvas.instances[0]
      expect(ctx.fillStyle).toBe('#123456')
    })

    it('returns a data URL from canvasToDataUrl', async () => {
      const shape = makeShape({ id: 'shp-1', width: 100, height: 100, color: '#ffffff' })
      const result = await rasterizeShapeBitmap(shape)
      expect(result).toMatch(/^data:image\/png;base64,/)
    })
  })
})
