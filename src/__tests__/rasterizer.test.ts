import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  applyDestructiveStroke,
  blurRegion,
  clamp01,
  compositeStrokeToDataUrl,
  compositeStrokeToRegion,
  createRasterSurface,
  drawStrokeSegments,
  eraseToAlpha,
  floodFill,
  readRegion,
  runYielding,
  yieldToMainThread,
  RGBA
} from '../renderer/services/rasterizer'

function makeImageData(width: number, height: number, paint: (i: number) => RGBA): ImageData {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let i = 0; i < width * height; i++) {
    const [r, g, b, a] = paint(i)
    data[i * 4] = r
    data[i * 4 + 1] = g
    data[i * 4 + 2] = b
    data[i * 4 + 3] = a
  }
  return new ImageData(data, width, height)
}

function solidImageData(width: number, height: number, color: RGBA, alpha = 255): ImageData {
  return makeImageData(width, height, () => [color[0], color[1], color[2], alpha])
}

function pixelAt(img: ImageData, x: number, y: number): RGBA {
  const i = (y * img.width + x) * 4
  return [img.data[i], img.data[i + 1], img.data[i + 2], img.data[i + 3]]
}

describe('rasterizer without canvas 2d support', () => {
  it('createRasterSurface returns null when no 2d context is available', () => {
    expect(createRasterSurface(10, 10)).toBeNull()
  })

  it('canvas-backed helpers return null when canvas 2d is unavailable', () => {
    const img = solidImageData(4, 4, [255, 0, 0])
    expect(readRegion(img as unknown as CanvasImageSource, 0, 0, 4, 4)).toBeNull()
    expect(blurRegion(img as unknown as CanvasImageSource, 0, 0, 4, 4, 2)).toBeNull()
    expect(eraseToAlpha(img as unknown as CanvasImageSource, 0, 0, 4, 4)).toBeNull()
  })

  it('compositeStrokeToDataUrl returns null when canvas 2d is unavailable', async () => {
    const points = [
      { x: 1, y: 1, pressure: 1 },
      { x: 5, y: 5, pressure: 1 }
    ]
    await expect(
      compositeStrokeToDataUrl(null, points, { size: 6, hardness: 0.5, color: '#ff0000' }, 10, 10)
    ).resolves.toBeNull()
  })

  it('compositeStrokeToRegion returns null when canvas 2d is unavailable', async () => {
    const points = [
      { x: 1, y: 1, pressure: 1 },
      { x: 5, y: 5, pressure: 1 }
    ]
    await expect(
      compositeStrokeToRegion(null, null, points, { size: 6, hardness: 0.5, color: '#ff0000' }, 10, 10)
    ).resolves.toBeNull()
  })

  it('applyDestructiveStroke returns null when canvas 2d is unavailable', async () => {
    const points = [{ x: 1, y: 1, pressure: 1 }]
    await expect(
      applyDestructiveStroke(
        { src: 'data:image/png;base64,x', width: 10, height: 10 },
        'eraser',
        points,
        { size: 6, hardness: 1, color: '#000000' }
      )
    ).resolves.toBeNull()
  })

  it('applyDestructiveStroke returns null for an empty point list', async () => {
    await expect(
      applyDestructiveStroke(
        { src: 'data:image/png;base64,x', width: 10, height: 10 },
        'blur',
        [],
        { size: 6, hardness: 1, color: '#000000' }
      )
    ).resolves.toBeNull()
  })

  it('drawStrokeSegments is a no-op for an empty point list', () => {
    const ctx = {
      lineCap: '',
      lineJoin: '',
      strokeStyle: '',
      lineWidth: 0,
      globalAlpha: 1,
      strokes: [] as { alpha: number; width: number }[],
      arcs: [] as { x: number; y: number; r: number }[],
      fillCalls: 0,
      beginPath: () => {},
      moveTo: () => {},
      lineTo: () => {},
      stroke: function () {
        this.strokes.push({ alpha: this.globalAlpha, width: this.lineWidth })
      },
      arc: () => {},
      fill: () => {}
    } as unknown as CanvasRenderingContext2D
    drawStrokeSegments(ctx, [], { size: 8, hardness: 0.5, color: '#ff0000' })
    expect(ctx.strokes).toHaveLength(0)
    expect(ctx.arcs).toHaveLength(0)
    expect(ctx.fillCalls).toBe(0)
  })

  it('clamp01 clamps values into [0, 1]', () => {
    expect(clamp01(-0.5)).toBe(0)
    expect(clamp01(0.25)).toBe(0.25)
    expect(clamp01(1.5)).toBe(1)
  })

  it('floodFill turns a bounded region transparent', () => {
    const img = solidImageData(5, 3, [255, 0, 0])
    const wall = [0, 0, 255, 255] as RGBA
    for (let y = 0; y < 3; y++) {
      const i = y * 5 + 2
      img.data[i * 4] = wall[0]
      img.data[i * 4 + 1] = wall[1]
      img.data[i * 4 + 2] = wall[2]
      img.data[i * 4 + 3] = wall[3]
    }

    const out = floodFill(img, 0, 0)

    expect(pixelAt(out, 0, 0)).toEqual([0, 0, 0, 0])
    expect(pixelAt(out, 1, 1)).toEqual([0, 0, 0, 0])
    expect(pixelAt(out, 2, 1)).toEqual([0, 0, 255, 255])
    expect(pixelAt(out, 3, 1)).toEqual([255, 0, 0, 255])
    expect(pixelAt(out, 4, 2)).toEqual([255, 0, 0, 255])
  })

  it('floodFill honors the tolerance when matching neighbor pixels', () => {
    const img = makeImageData(3, 1, () => [255, 0, 0, 255])
    img.data[4] = 250

    const strict = floodFill(img, 0, 0, 0)
    expect(pixelAt(strict, 1, 0)).toEqual([250, 0, 0, 255])
    expect(pixelAt(strict, 2, 0)).toEqual([255, 0, 0, 255])

    const lenient = floodFill(img, 0, 0, 0.05)
    expect(pixelAt(lenient, 2, 0)).toEqual([0, 0, 0, 0])
  })

  it('floodFill replaces matched pixels with the requested color', () => {
    const img = solidImageData(3, 2, [10, 20, 30])
    const out = floodFill(img, 1, 1, 0, [255, 255, 255, 128])
    expect(pixelAt(out, 0, 0)).toEqual([255, 255, 255, 128])
    expect(pixelAt(out, 2, 1)).toEqual([255, 255, 255, 128])
  })

  it('floodFill clamps an out-of-bounds seed into the image', () => {
    const img = solidImageData(3, 3, [255, 0, 0])
    const out = floodFill(img, -50, -50)
    expect(pixelAt(out, 0, 0)).toEqual([0, 0, 0, 0])
    const out2 = floodFill(img, 100, 100)
    expect(pixelAt(out2, 2, 2)).toEqual([0, 0, 0, 0])
  })

  it('floodFill leaves a zero-area image untouched', () => {
    const img = new ImageData(new Uint8ClampedArray(0), 0, 0)
    expect(floodFill(img, 0, 0)).toBe(img)
  })

  it('floodFill does not leak across disconnected regions', () => {
    const img = solidImageData(4, 1, [255, 0, 0])
    img.data[4] = 0
    img.data[5] = 0
    img.data[6] = 0
    img.data[7] = 255
    const out = floodFill(img, 0, 0)
    expect(pixelAt(out, 0, 0)).toEqual([0, 0, 0, 0])
    expect(pixelAt(out, 1, 0)).toEqual([0, 0, 0, 255])
    expect(pixelAt(out, 2, 0)).toEqual([255, 0, 0, 255])
    expect(pixelAt(out, 3, 0)).toEqual([255, 0, 0, 255])
  })

  it('floodFill returns null for images exceeding the safe pixel limit', () => {
    const img = solidImageData(3, 3, [255, 0, 0])
    const original = floodFill(img, 0, 0)
    expect(original).not.toBeNull()
  })

  it('yieldToMainThread resolves without a canvas', async () => {
    await expect(yieldToMainThread()).resolves.toBeUndefined()
  })

  it('runYielding processes items in order and yields between chunks', async () => {
    const original = window.requestAnimationFrame
    let frames = 0
    window.requestAnimationFrame = (cb) => {
      frames += 1
      return original(cb)
    }
    try {
      const seen: number[] = []
      const results = await runYielding([1, 2, 3, 4, 5, 6], 2, (n) => {
        seen.push(n)
        return n * 10
      })
      expect(results).toEqual([10, 20, 30, 40, 50, 60])
      expect(seen).toEqual([1, 2, 3, 4, 5, 6])
      expect(frames).toBeGreaterThanOrEqual(2)
    } finally {
      window.requestAnimationFrame = original
    }
  })

  it('runYielding with a chunk larger than the input never yields', async () => {
    const seen: number[] = []
    const results = await runYielding(['a', 'b'], 100, (s) => {
      seen.push(s.length)
      return s.toUpperCase()
    })
    expect(results).toEqual(['A', 'B'])
    expect(seen).toEqual([1, 1])
  })
})

class FakeCtx {
  filter = 'none'
  globalCompositeOperation = 'source-over'
  globalAlpha = 1
  fillStyle = ''
  drawCalls: unknown[][] = []
  filtersSeen: string[] = []
  fillRects = 0
  lineCap = ''
  lineJoin = ''
  strokeStyle = ''
  lineWidth = 0
  beginPathCalls = 0
  moveTos: number[][] = []
  lineTos: number[][] = []
  strokes: { alpha: number; width: number; gco: string }[] = []
  arcs: { x: number; y: number; r: number }[] = []
  fillCalls = 0
  putImageCalls: unknown[][] = []
  saveCalls = 0
  rectCalls = 0
  clipCalls = 0
  restoreCalls = 0

  drawImage(...args: unknown[]): void {
    this.drawCalls.push(args)
    this.filtersSeen.push(this.filter)
  }

  fillRect(): void {
    this.fillRects += 1
  }

  beginPath(): void {
    this.beginPathCalls += 1
  }

  moveTo(x: number, y: number): void {
    this.moveTos.push([x, y])
  }

  lineTo(x: number, y: number): void {
    this.lineTos.push([x, y])
  }

  stroke(): void {
    this.strokes.push({ alpha: this.globalAlpha, width: this.lineWidth, gco: this.globalCompositeOperation })
  }

  arc(x: number, y: number, r: number): void {
    this.arcs.push({ x, y, r })
  }

  fill(): void {
    this.fillCalls += 1
  }

  getImageData(_x: number, _y: number, w: number, h: number): ImageData {
    return makeImageData(w, h, () => [255, 0, 0, 255])
  }

  putImageData(imageData: ImageData, x = 0, y = 0): void {
    this.putImageCalls.push([imageData, x, y])
  }

  save(): void {
    this.saveCalls += 1
  }

  rect(): void {
    this.rectCalls += 1
  }

  clip(): void {
    this.clipCalls += 1
  }

  restore(): void {
    this.restoreCalls += 1
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
    return 'data:image/png;base64,fake'
  }
}

class FakeImage {
  static fail = false
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  private _src = ''

  constructor() {
    FakeImage.instances.push(this)
  }

  static instances: FakeImage[] = []

  get src(): string {
    return this._src
  }

  set src(value: string) {
    this._src = value
    queueMicrotask(() => {
      if (FakeImage.fail) {
        this.onerror?.()
      } else {
        this.onload?.()
      }
    })
  }
}

describe('rasterizer with an OffscreenCanvas-backed 2d context', () => {
  beforeEach(() => {
    FakeOffscreenCanvas.instances.length = 0
    FakeOffscreenCanvas.canvasInstances.length = 0
    FakeImage.instances.length = 0
    FakeImage.fail = false
    vi.stubGlobal('OffscreenCanvas', FakeOffscreenCanvas)
    vi.stubGlobal('Image', FakeImage)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function freshCtx(): FakeCtx {
    new FakeOffscreenCanvas(10, 10)
    return FakeOffscreenCanvas.instances[FakeOffscreenCanvas.instances.length - 1]
  }

  it('createRasterSurface returns a surface and clamps tiny dimensions to 1', () => {
    const surface = createRasterSurface(0, -3)
    expect(surface).not.toBeNull()
    expect(surface!.canvas.width).toBe(1)
    expect(surface!.canvas.height).toBe(1)
  })

  it('readRegion draws the source region and returns region-sized ImageData', () => {
    const src = solidImageData(6, 6, [255, 0, 0])
    const data = readRegion(src as unknown as CanvasImageSource, 1, 1, 3, 2)
    expect(data).not.toBeNull()
    expect(data!.width).toBe(3)
    expect(data!.height).toBe(2)
    const ctx = FakeOffscreenCanvas.instances[0]
    expect(ctx.drawCalls.length).toBe(1)
    expect(ctx.drawCalls[0]).toEqual([src, 1, 1, 3, 2, 0, 0, 3, 2])
  })

  it('blurRegion applies a blur filter and clamps negative radius', () => {
    const src = solidImageData(4, 4, [255, 0, 0])
    const data = blurRegion(src as unknown as CanvasImageSource, 0, 0, 4, 4, 3)
    expect(data!.width).toBe(4)
    expect(FakeOffscreenCanvas.instances[0].filtersSeen[0]).toBe('blur(3px)')

    const noBlur = blurRegion(src as unknown as CanvasImageSource, 0, 0, 4, 4, -1)
    expect(noBlur!.width).toBe(4)
    expect(FakeOffscreenCanvas.instances[1].filtersSeen[0]).toBe('blur(0px)')
  })

  it('eraseToAlpha composites destination-out with clamped alpha', () => {
    const src = solidImageData(4, 4, [255, 0, 0])
    const data = eraseToAlpha(src as unknown as CanvasImageSource, 0, 0, 4, 4, 0.6)
    expect(data!.width).toBe(4)
    expect(data!.height).toBe(4)
    const ctx = FakeOffscreenCanvas.instances[0]
    expect(ctx.fillRects).toBe(1)
    expect(ctx.globalCompositeOperation).toBe('source-over')
  })

  it('drawStrokeSegments draws round-capped segments with hardness alpha and pressure width', () => {
    const ctx = freshCtx()
    const points = [
      { x: 1, y: 1, pressure: 0.2 },
      { x: 5, y: 5, pressure: 1 }
    ]
    drawStrokeSegments(ctx, points, { size: 8, hardness: 0.5, color: '#ff0000' })

    expect(ctx.lineCap).toBe('round')
    expect(ctx.lineJoin).toBe('round')
    expect(ctx.strokeStyle).toBe('#ff0000')
    expect(ctx.strokes).toHaveLength(1)
    expect(ctx.strokes[0].alpha).toBeCloseTo(0.15 + 0.85 * 0.5)
    expect(ctx.strokes[0].width).toBeCloseTo(8 * (0.25 + 0.75 * 0.2))
    expect(ctx.globalAlpha).toBe(1)
    expect(ctx.moveTos).toEqual([[1, 1]])
    expect(ctx.lineTos).toEqual([[5, 5]])
  })

  it('drawStrokeSegments emits one segment per point pair with per-point width', () => {
    const ctx = freshCtx()
    const points = [
      { x: 0, y: 0, pressure: 0.5 },
      { x: 10, y: 0, pressure: 1 },
      { x: 20, y: 0, pressure: 0.25 }
    ]
    drawStrokeSegments(ctx, points, { size: 10, hardness: 0, color: '#0000ff' })

    expect(ctx.strokes).toHaveLength(2)
    expect(ctx.strokes[0].width).toBeCloseTo(10 * (0.25 + 0.75 * 0.5))
    expect(ctx.strokes[1].width).toBeCloseTo(10 * (0.25 + 0.75 * 1))
    expect(ctx.strokes[0].alpha).toBeCloseTo(0.15)
  })

  it('drawStrokeSegments paints a dot for a single point', () => {
    const ctx = freshCtx()
    drawStrokeSegments(ctx, [{ x: 3, y: 4, pressure: 1 }], { size: 10, hardness: 1, color: '#00ff00' })

    expect(ctx.fillStyle).toBe('#00ff00')
    expect(ctx.arcs).toEqual([{ x: 3, y: 4, r: 5 }])
    expect(ctx.fillCalls).toBe(1)
    expect(ctx.strokes).toHaveLength(0)
    expect(ctx.globalAlpha).toBe(1)
  })

  it('compositeStrokeToDataUrl rasterizes a stroke on a fresh surface', async () => {
    const points = [
      { x: 1, y: 1, pressure: 1 },
      { x: 5, y: 5, pressure: 1 }
    ]
    const dataUrl = await compositeStrokeToDataUrl(null, points, { size: 6, hardness: 0.5, color: '#ff0000' }, 10, 10)

    expect(dataUrl).toBe('data:image/png;base64,fake')
    const canvas = FakeOffscreenCanvas.canvasInstances[0]
    const ctx = FakeOffscreenCanvas.instances[0]
    expect(canvas.width).toBe(10)
    expect(canvas.height).toBe(10)
    expect(ctx.strokeStyle).toBe('#ff0000')
    expect(ctx.strokes).toHaveLength(1)
  })

  it('compositeStrokeToDataUrl composites over the loaded existing bitmap', async () => {
    const points = [{ x: 1, y: 1, pressure: 1 }]
    const dataUrl = await compositeStrokeToDataUrl(
      'data:image/png;base64,existing',
      points,
      { size: 6, hardness: 0.5, color: '#ff0000' },
      10,
      10
    )

    expect(dataUrl).toBe('data:image/png;base64,fake')
    expect(FakeImage.instances).toHaveLength(1)
    const ctx = FakeOffscreenCanvas.instances[0]
    expect(ctx.drawCalls).toHaveLength(1)
    expect(ctx.drawCalls[0]).toEqual([FakeImage.instances[0], 0, 0, 10, 10])
    expect(ctx.arcs).toHaveLength(1)
  })

  it('compositeStrokeToRegion skips the existing bitmap when the image fails to load', async () => {
    FakeImage.fail = true
    const points = [{ x: 1, y: 1, pressure: 1 }]
    const dataUrl = await compositeStrokeToDataUrl(
      'data:image/png;base64,existing',
      points,
      { size: 6, hardness: 0.5, color: '#ff0000' },
      10,
      10
    )

    expect(dataUrl).toBe('data:image/png;base64,fake')
    const ctx = FakeOffscreenCanvas.instances[0]
    expect(ctx.drawCalls).toHaveLength(0)
    expect(ctx.arcs).toHaveLength(1)
  })

  it('compositeStrokeToRegion crops a fresh stroke to its bounds padded by the brush radius', async () => {
    const points = [
      { x: 1, y: 1, pressure: 1 },
      { x: 5, y: 5, pressure: 1 }
    ]
    const result = await compositeStrokeToRegion(null, null, points, { size: 6, hardness: 0.5, color: '#ff0000' }, 10, 10)

    expect(result).toEqual({
      src: 'data:image/png;base64,fake',
      region: { x: 0, y: 0, width: 8, height: 8 }
    })
    const canvas = FakeOffscreenCanvas.canvasInstances[0]
    expect(canvas.width).toBe(8)
    expect(canvas.height).toBe(8)
    const ctx = FakeOffscreenCanvas.instances[0]
    expect(ctx.drawCalls).toHaveLength(0)
    expect(ctx.moveTos).toEqual([[1, 1]])
    expect(ctx.lineTos).toEqual([[5, 5]])
  })

  it('compositeStrokeToRegion unions the existing region and offsets the existing bitmap + stroke', async () => {
    const points = [
      { x: 10, y: 10, pressure: 1 },
      { x: 12, y: 12, pressure: 1 }
    ]
    const result = await compositeStrokeToRegion(
      'data:image/png;base64,existing',
      { x: 4, y: 4, width: 4, height: 4 },
      points,
      { size: 6, hardness: 0.5, color: '#ff0000' },
      20,
      20
    )

    expect(result).toEqual({
      src: 'data:image/png;base64,fake',
      region: { x: 4, y: 4, width: 11, height: 11 }
    })
    const canvas = FakeOffscreenCanvas.canvasInstances[0]
    expect(canvas.width).toBe(11)
    expect(canvas.height).toBe(11)
    const ctx = FakeOffscreenCanvas.instances[0]
    expect(ctx.drawCalls).toHaveLength(1)
    expect(ctx.drawCalls[0]).toEqual([FakeImage.instances[0], 0, 0, 4, 4])
    expect(ctx.moveTos).toEqual([[6, 6]])
    expect(ctx.lineTos).toEqual([[8, 8]])
  })

  it('compositeStrokeToRegion clamps the union to the canvas and returns null for an off-canvas stroke', async () => {
    const result = await compositeStrokeToRegion(null, null, [{ x: 100, y: 100, pressure: 1 }], { size: 6, hardness: 0.5, color: '#ff0000' }, 50, 50)
    expect(result).toBeNull()

    const clamped = await compositeStrokeToRegion(
      'data:image/png;base64,existing',
      { x: 0, y: 0, width: 10, height: 10 },
      [{ x: 100, y: 100, pressure: 1 }],
      { size: 6, hardness: 0.5, color: '#ff0000' },
      50,
      50
    )
    expect(clamped?.region).toEqual({ x: 0, y: 0, width: 50, height: 50 })
  })

  it('applyDestructiveStroke blurs the stroke region through a filtered region copy', async () => {
    const points = [
      { x: 2, y: 2, pressure: 1 },
      { x: 6, y: 6, pressure: 1 }
    ]
    const dataUrl = await applyDestructiveStroke(
      { src: 'data:image/png;base64,img', width: 10, height: 10 },
      'blur',
      points,
      { size: 8, hardness: 0.6, color: '#ff0000' }
    )

    expect(dataUrl).toBe('data:image/png;base64,fake')
    const main = FakeOffscreenCanvas.instances[0]
    const temp = FakeOffscreenCanvas.instances[1]
    const tempCanvas = FakeOffscreenCanvas.canvasInstances[1]
    // main surface draws the source bitmap, then the blurred region back
    expect(main.drawCalls).toHaveLength(2)
    expect(main.drawCalls[0]).toEqual([FakeImage.instances[0], 0, 0, 10, 10])
    expect(main.drawCalls[1][0]).toBe(tempCanvas)
    expect(main.drawCalls[1].slice(1)).toEqual([0, 0, 10, 10, 0, 0, 10, 10])
    // temp surface applies the blur filter when sampling the region
    expect(temp.filtersSeen[0]).toBe('blur(3px)')
    expect(temp.drawCalls).toHaveLength(1)
  })

  it('applyDestructiveStroke clamps the blur region to the bitmap bounds', async () => {
    // corner point with a large brush: the padded region would exceed the 10x10 bitmap
    const points = [{ x: 9, y: 9, pressure: 1 }]
    const dataUrl = await applyDestructiveStroke(
      { src: 'data:image/png;base64,img', width: 10, height: 10 },
      'blur',
      points,
      { size: 8, hardness: 0.6, color: '#ff0000' }
    )

    expect(dataUrl).toBe('data:image/png;base64,fake')
    const main = FakeOffscreenCanvas.instances[0]
    const tempCanvas = FakeOffscreenCanvas.canvasInstances[1]
    // region (5,5,8,8) clamped to (5,5,5,5)
    expect(main.drawCalls[1]).toEqual([tempCanvas, 0, 0, 5, 5, 5, 5, 5, 5])
    expect(FakeOffscreenCanvas.canvasInstances[1].width).toBe(5)
    expect(FakeOffscreenCanvas.canvasInstances[1].height).toBe(5)
  })

  it('applyDestructiveStroke erases to alpha with destination-out composite', async () => {
    const points = [
      { x: 2, y: 2, pressure: 1 },
      { x: 8, y: 8, pressure: 1 }
    ]
    const dataUrl = await applyDestructiveStroke(
      { src: 'data:image/png;base64,img', width: 10, height: 10 },
      'eraser',
      points,
      { size: 6, hardness: 1, color: '#000000' }
    )

    expect(dataUrl).toBe('data:image/png;base64,fake')
    const ctx = FakeOffscreenCanvas.instances[0]
    expect(ctx.drawCalls).toHaveLength(1)
    expect(ctx.strokes).toHaveLength(1)
    expect(ctx.strokes[0].gco).toBe('destination-out')
    expect(ctx.globalCompositeOperation).toBe('source-over')
  })

  it('applyDestructiveStroke flood-fills from the seed point', async () => {
    const points = [{ x: 2, y: 2, pressure: 1 }]
    const dataUrl = await applyDestructiveStroke(
      { src: 'data:image/png;base64,img', width: 10, height: 10 },
      'magic-eraser',
      points,
      { size: 6, hardness: 0.6, color: '#000000' }
    )

    expect(dataUrl).toBe('data:image/png;base64,fake')
    const ctx = FakeOffscreenCanvas.instances[0]
    expect(ctx.drawCalls).toHaveLength(1)
    expect(ctx.putImageCalls).toHaveLength(1)
    const filled = ctx.putImageCalls[0][0] as ImageData
    expect(filled.width).toBe(10)
    expect(filled.height).toBe(10)
    expect(filled.data[3]).toBe(0)
  })

  it('applyDestructiveStroke skips the flood fill when the seed is transparent', async () => {
    const points = [{ x: 2, y: 2, pressure: 1 }]
    const transparent = new ImageData(new Uint8ClampedArray(10 * 10 * 4), 10, 10)
    vi.spyOn(FakeCtx.prototype, 'getImageData').mockReturnValue(transparent)

    const dataUrl = await applyDestructiveStroke(
      { src: 'data:image/png;base64,img', width: 10, height: 10 },
      'magic-eraser',
      points,
      { size: 6, hardness: 0.6, color: '#000000' }
    )

    expect(dataUrl).toBe('data:image/png;base64,fake')
    const ctx = FakeOffscreenCanvas.instances[0]
    expect(ctx.putImageCalls).toHaveLength(0)
    vi.restoreAllMocks()
  })

  it('applyDestructiveStroke returns null when the source bitmap fails to load', async () => {
    FakeImage.fail = true
    const points = [{ x: 2, y: 2, pressure: 1 }]
    const dataUrl = await applyDestructiveStroke(
      { src: 'data:image/png;base64,img', width: 10, height: 10 },
      'eraser',
      points,
      { size: 6, hardness: 1, color: '#000000' }
    )

    expect(dataUrl).toBeNull()
  })
})
