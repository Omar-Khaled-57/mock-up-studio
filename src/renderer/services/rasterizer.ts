import type { StrokePoint } from './stroke'

export type RGBA = readonly [number, number, number, number]

export interface RasterSurface {
  canvas: HTMLCanvasElement | OffscreenCanvas
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D
}

export interface StrokeBrush {
  size: number
  hardness: number
  color: string
}

export function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}

export function createRasterSurface(width: number, height: number): RasterSurface | null {
  const w = Math.max(1, Math.round(width))
  const h = Math.max(1, Math.round(height))
  if (typeof OffscreenCanvas !== 'undefined') {
    const canvas = new OffscreenCanvas(w, h)
    const ctx = canvas.getContext('2d')
    if (ctx) return { canvas, ctx }
  }
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (ctx) return { canvas, ctx }
  }
  return null
}

export function readRegion(
  source: CanvasImageSource,
  x: number,
  y: number,
  width: number,
  height: number
): ImageData | null {
  const surface = createRasterSurface(width, height)
  if (!surface) return null
  surface.ctx.drawImage(source, x, y, width, height, 0, 0, width, height)
  return surface.ctx.getImageData(0, 0, width, height)
}

export function blurRegion(
  source: CanvasImageSource,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
): ImageData | null {
  const surface = createRasterSurface(width, height)
  if (!surface) return null
  const ctx = surface.ctx
  ctx.filter = `blur(${Math.max(0, radius)}px)`
  ctx.drawImage(source, x, y, width, height, 0, 0, width, height)
  ctx.filter = 'none'
  return ctx.getImageData(0, 0, width, height)
}

export function eraseToAlpha(
  source: CanvasImageSource,
  x: number,
  y: number,
  width: number,
  height: number,
  alpha = 1
): ImageData | null {
  const surface = createRasterSurface(width, height)
  if (!surface) return null
  const ctx = surface.ctx
  ctx.drawImage(source, x, y, width, height, 0, 0, width, height)
  ctx.globalCompositeOperation = 'destination-out'
  ctx.globalAlpha = clamp01(alpha)
  ctx.fillRect(0, 0, width, height)
  ctx.globalCompositeOperation = 'source-over'
  ctx.globalAlpha = 1
  return ctx.getImageData(0, 0, width, height)
}

export function drawStrokeSegments(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  points: readonly StrokePoint[],
  brush: StrokeBrush
): void {
  if (points.length === 0) return
  if (points.length === 1) {
    drawDot(ctx, points[0], brush)
    return
  }
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.strokeStyle = brush.color
  ctx.globalAlpha = 0.15 + 0.85 * clamp01(brush.hardness)
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]
    const b = points[i]
    ctx.lineWidth = Math.max(0.25, brush.size * (0.25 + 0.75 * a.pressure))
    ctx.beginPath()
    ctx.moveTo(a.x, a.y)
    ctx.lineTo(b.x, b.y)
    ctx.stroke()
  }
  ctx.globalAlpha = 1
}

function drawDot(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  point: StrokePoint,
  brush: StrokeBrush
): void {
  ctx.fillStyle = brush.color
  ctx.globalAlpha = 0.15 + 0.85 * clamp01(brush.hardness)
  ctx.beginPath()
  ctx.arc(point.x, point.y, Math.max(0.25, brush.size / 2), 0, Math.PI * 2)
  ctx.fill()
  ctx.globalAlpha = 1
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = src
  })
}

async function canvasToDataUrl(canvas: HTMLCanvasElement | OffscreenCanvas): Promise<string> {
  if ('toDataURL' in canvas) {
    return (canvas as HTMLCanvasElement).toDataURL('image/png')
  }
  const blob = await (canvas as OffscreenCanvas).convertToBlob({ type: 'image/png' })
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

export async function compositeStrokeToDataUrl(
  existingSrc: string | null,
  points: readonly StrokePoint[],
  brush: StrokeBrush,
  width: number,
  height: number
): Promise<string | null> {
  const surface = createRasterSurface(width, height)
  if (!surface) return null
  if (existingSrc) {
    const existing = await loadImage(existingSrc)
    if (existing) surface.ctx.drawImage(existing, 0, 0, width, height)
  }
  drawStrokeSegments(surface.ctx, points, brush)
  return canvasToDataUrl(surface.canvas)
}

export type DestructiveBrushType = 'blur' | 'eraser' | 'magic-eraser'

export interface DestructiveStrokeTarget {
  src: string
  width: number
  height: number
}

/**
 * Rasterizes a destructive stroke (blur / eraser / magic-eraser) onto a copy
 * of the target element's bitmap and returns the resulting data URL.
 * Returns null when no 2d context exists or the source bitmap fails to load.
 */
export async function applyDestructiveStroke(
  target: DestructiveStrokeTarget,
  brushType: DestructiveBrushType,
  points: readonly StrokePoint[],
  brush: StrokeBrush
): Promise<string | null> {
  if (points.length === 0) return null
  const surface = createRasterSurface(target.width, target.height)
  if (!surface) return null
  const existing = await loadImage(target.src)
  if (!existing) return null
  surface.ctx.drawImage(existing, 0, 0, target.width, target.height)
  if (brushType === 'blur') {
    applyBlurStroke(surface, points, brush)
  } else if (brushType === 'eraser') {
    applyEraseStroke(surface.ctx, points, brush)
  } else {
    applyMagicEraseStroke(surface.ctx, points, brush, target.width, target.height)
  }
  return canvasToDataUrl(surface.canvas)
}

function applyBlurStroke(surface: RasterSurface, points: readonly StrokePoint[], brush: StrokeBrush): void {
  const radius = Math.max(1, Math.round((brush.size / 2) * (0.25 + 0.75 * clamp01(brush.hardness))))
  const box = strokeBounds(points, radius + 1)
  if (box.width <= 0 || box.height <= 0) return
  const width = Math.min(box.width, surface.canvas.width - box.x)
  const height = Math.min(box.height, surface.canvas.height - box.y)
  if (width <= 0 || height <= 0) return
  const temp = createRasterSurface(width, height)
  if (!temp) return
  temp.ctx.filter = `blur(${radius}px)`
  temp.ctx.drawImage(surface.canvas, box.x, box.y, width, height, 0, 0, width, height)
  temp.ctx.filter = 'none'
  surface.ctx.drawImage(temp.canvas, 0, 0, width, height, box.x, box.y, width, height)
}

function applyEraseStroke(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  points: readonly StrokePoint[],
  brush: StrokeBrush
): void {
  ctx.globalCompositeOperation = 'destination-out'
  drawStrokeSegments(ctx, points, { ...brush, color: '#000000' })
  ctx.globalCompositeOperation = 'source-over'
}

function applyMagicEraseStroke(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  points: readonly StrokePoint[],
  brush: StrokeBrush,
  width: number,
  height: number
): void {
  const seed = points[0]
  const sx = Math.round(seed.x)
  const sy = Math.round(seed.y)
  if (sx < 0 || sy < 0 || sx >= width || sy >= height) return
  const imageData = ctx.getImageData(0, 0, width, height)
  if (imageData.data[(sy * width + sx) * 4 + 3] === 0) return
  const tolerance = clamp01(brush.hardness) * 0.25
  const filled = floodFill(imageData, sx, sy, tolerance, [0, 0, 0, 0])
  ctx.putImageData(filled, 0, 0)
}

function strokeBounds(
  points: readonly StrokePoint[],
  padding: number
): { x: number; y: number; width: number; height: number } {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of points) {
    if (p.x < minX) minX = p.x
    if (p.y < minY) minY = p.y
    if (p.x > maxX) maxX = p.x
    if (p.y > maxY) maxY = p.y
  }
  const x = Math.max(0, Math.floor(minX) - padding)
  const y = Math.max(0, Math.floor(minY) - padding)
  return {
    x,
    y,
    width: Math.max(1, Math.ceil(maxX) + padding - x),
    height: Math.max(1, Math.ceil(maxY) + padding - y)
  }
}

const MAX_COLOR_DISTANCE = Math.sqrt(3 * 255 * 255)

export function floodFill(
  imageData: ImageData,
  seedX: number,
  seedY: number,
  tolerance = 0,
  replacement: RGBA = [0, 0, 0, 0]
): ImageData {
  const { width, height, data } = imageData
  if (width === 0 || height === 0) return imageData
  const sx = clampIndex(Math.round(seedX), width)
  const sy = clampIndex(Math.round(seedY), height)
  const seedIndex = (sy * width + sx) * 4
  const seedR = data[seedIndex]
  const seedG = data[seedIndex + 1]
  const seedB = data[seedIndex + 2]
  const out = new Uint8ClampedArray(data)
  const queue = new Int32Array(width * height)
  const visited = new Uint8Array(width * height)
  const maxDistance = tolerance * MAX_COLOR_DISTANCE
  const start = sy * width + sx
  let head = 0
  let tail = 0
  queue[tail++] = start
  visited[start] = 1
  while (head < tail) {
    const p = queue[head++]
    const pi = p * 4
    if (
      colorDistance(data[pi], data[pi + 1], data[pi + 2], seedR, seedG, seedB) <= maxDistance
    ) {
      out[pi] = replacement[0]
      out[pi + 1] = replacement[1]
      out[pi + 2] = replacement[2]
      out[pi + 3] = replacement[3]
      const px = p % width
      if (px > 0 && !visited[p - 1]) {
        visited[p - 1] = 1
        queue[tail++] = p - 1
      }
      if (px < width - 1 && !visited[p + 1]) {
        visited[p + 1] = 1
        queue[tail++] = p + 1
      }
      if (p >= width && !visited[p - width]) {
        visited[p - width] = 1
        queue[tail++] = p - width
      }
      if (p < width * height - width && !visited[p + width]) {
        visited[p + width] = 1
        queue[tail++] = p + width
      }
    }
  }
  return new ImageData(out, width, height)
}

export function yieldToMainThread(): Promise<void> {
  if (typeof requestAnimationFrame !== 'undefined') {
    return new Promise((resolve) => requestAnimationFrame(() => resolve()))
  }
  return Promise.resolve()
}

export async function runYielding<T, R>(
  items: readonly T[],
  chunkSize: number,
  fn: (item: T, index: number) => R
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  const chunk = Math.max(1, chunkSize)
  let index = 0
  while (index < items.length) {
    const end = Math.min(index + chunk, items.length)
    for (; index < end; index++) {
      results[index] = fn(items[index], index)
    }
    if (index < items.length) await yieldToMainThread()
  }
  return results
}

function clampIndex(value: number, limit: number): number {
  return Math.max(0, Math.min(limit - 1, value))
}

function colorDistance(
  r1: number,
  g1: number,
  b1: number,
  r2: number,
  g2: number,
  b2: number
): number {
  const dr = r1 - r2
  const dg = g1 - g2
  const db = b1 - b2
  return Math.sqrt(dr * dr + dg * dg + db * db)
}
