import type { StrokePoint } from './stroke'
import type { ComponentData } from '@shared/types'
import type { BrushShape } from '../runtime/runtimeSlice'
import { buildMaskStrokePolygon } from './mask-brush'
import { shapeToSvg, textToSvg } from '../lib/default-components'

export type RGBA = readonly [number, number, number, number]

export interface RasterSurface {
  canvas: HTMLCanvasElement | OffscreenCanvas
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D
}

export interface StrokeBrush {
  size: number
  hardness: number
  color: string
  shape?: BrushShape
  opacity?: number
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
  ctx.lineCap = brush.shape === 'square' ? 'square' : 'round'
  ctx.lineJoin = brush.shape === 'square' ? 'miter' : 'round'
  ctx.strokeStyle = brush.color
  ctx.globalAlpha = strokeAlpha(brush)
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

function strokeAlpha(brush: StrokeBrush): number {
  return (brush.opacity ?? 1) * (0.15 + 0.85 * clamp01(brush.hardness))
}

function drawDot(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  point: StrokePoint,
  brush: StrokeBrush
): void {
  ctx.fillStyle = brush.color
  ctx.globalAlpha = strokeAlpha(brush)
  const radius = Math.max(0.25, brush.size / 2)
  if (brush.shape === 'square') {
    ctx.fillRect(point.x - radius, point.y - radius, radius * 2, radius * 2)
  } else {
    ctx.beginPath()
    ctx.arc(point.x, point.y, radius, 0, Math.PI * 2)
    ctx.fill()
  }
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

export async function canvasToDataUrl(canvas: HTMLCanvasElement | OffscreenCanvas): Promise<string> {
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

/**
 * Axis-aligned scene-space region that a paint-layer bitmap occupies. A paint
 * layer is cropped to the union of everything drawn on it, so `region` records
 * where the bitmap's top-left corner sits inside the scene and its pixel size.
 */
export interface CropRegion {
  x: number
  y: number
  width: number
  height: number
}

export interface StrokeComposite {
  src: string
  region: CropRegion
}

/**
 * Composites a stroke onto a paint layer that is cropped to its content.
 *
 * The new bitmap is sized to the union of the existing layer region and the
 * stroke's own bounds (points padded by the brush radius), clamped to the
 * canvas — so a paint layer never spans the whole canvas, only the drawing.
 *
 * Returns the resulting data URL plus the scene-space region it represents,
 * or null when the stroke is entirely off-canvas or no 2d context exists.
 */
export async function compositeStrokeToRegion(
  existingSrc: string | null,
  existingRegion: CropRegion | null,
  points: readonly StrokePoint[],
  brush: StrokeBrush,
  canvasWidth: number,
  canvasHeight: number
): Promise<StrokeComposite | null> {
  const radius = Math.max(0.25, brush.size / 2)
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

  let x = Math.floor(minX - radius)
  let y = Math.floor(minY - radius)
  let maxX2 = Math.ceil(maxX + radius)
  let maxY2 = Math.ceil(maxY + radius)
  if (existingRegion) {
    x = Math.min(existingRegion.x, x)
    y = Math.min(existingRegion.y, y)
    maxX2 = Math.max(existingRegion.x + existingRegion.width, maxX2)
    maxY2 = Math.max(existingRegion.y + existingRegion.height, maxY2)
  }

  x = Math.max(0, x)
  y = Math.max(0, y)
  const width = Math.min(canvasWidth, maxX2) - x
  const height = Math.min(canvasHeight, maxY2) - y
  if (width <= 0 || height <= 0) return null

  const surface = createRasterSurface(width, height)
  if (!surface) return null
  if (existingSrc && existingRegion) {
    const existing = await loadImage(existingSrc)
    if (existing) {
      surface.ctx.drawImage(
        existing,
        existingRegion.x - x,
        existingRegion.y - y,
        existingRegion.width,
        existingRegion.height
      )
    }
  }
  const translated = points.map((p) => ({ x: p.x - x, y: p.y - y, pressure: p.pressure }))
  drawStrokeSegments(surface.ctx, translated, brush)
  const src = await canvasToDataUrl(surface.canvas)
  return { src, region: { x, y, width, height } }
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
  const radius = blurRadiusFromBrush(brush)
  const box = strokeBounds(points, radius + 1)
  if (box.width <= 0 || box.height <= 0) return
  blurRegionOnSurface(surface, box, null, radius)
}

/** Blur strength derived from a brush's size/hardness (shared by every blur tool). */
export function blurRadiusFromBrush(brush: StrokeBrush): number {
  return Math.max(1, Math.round((brush.size / 2) * (0.25 + 0.75 * clamp01(brush.hardness))))
}

interface RegionBounds {
  x: number
  y: number
  width: number
  height: number
}

/**
 * Composites a blurred copy of the surface's region onto it, clipped to the
 * optional shape path (null = the region's full bounds). The blur runs on a
 * region-sized temp canvas; the clip restricts where the blurred pixels land.
 */
function blurRegionOnSurface(
  surface: RasterSurface,
  bounds: RegionBounds,
  path: Path2D | null,
  radius: number
): void {
  const width = Math.min(bounds.width, surface.canvas.width - bounds.x)
  const height = Math.min(bounds.height, surface.canvas.height - bounds.y)
  if (width <= 0 || height <= 0) return
  const temp = createRasterSurface(width, height)
  if (!temp) return
  temp.ctx.filter = `blur(${radius}px)`
  temp.ctx.drawImage(surface.canvas, bounds.x, bounds.y, width, height, 0, 0, width, height)
  temp.ctx.filter = 'none'
  surface.ctx.save()
  surface.ctx.beginPath()
  if (path && typeof Path2D !== 'undefined') {
    surface.ctx.clip(path)
  } else {
    surface.ctx.rect(bounds.x, bounds.y, width, height)
    surface.ctx.clip()
  }
  surface.ctx.drawImage(temp.canvas, 0, 0, width, height, bounds.x, bounds.y, width, height)
  surface.ctx.restore()
}

/**
 * Shape-agnostic blur geometry. Every blur tool (rect / ellipse / line)
 * describes its region with one of these descriptors — the engine never
 * knows which tool produced it.
 */
export type BlurGeometry =
  | { type: 'rect'; x: number; y: number; width: number; height: number }
  | { type: 'ellipse'; x: number; y: number; width: number; height: number }
  | { type: 'line'; x1: number; y1: number; x2: number; y2: number; width: number }

function resolveBlurGeometry(geometry: BlurGeometry): { bounds: RegionBounds; path: Path2D | null } {
  if (geometry.type === 'rect') {
    const path = typeof Path2D !== 'undefined' ? new Path2D() : null
    path?.rect(geometry.x, geometry.y, geometry.width, geometry.height)
    return {
      bounds: {
        x: Math.max(0, Math.round(geometry.x)),
        y: Math.max(0, Math.round(geometry.y)),
        width: Math.round(Math.abs(geometry.width)),
        height: Math.round(Math.abs(geometry.height))
      },
      path
    }
  }
  if (geometry.type === 'ellipse') {
    const rx = Math.max(1, Math.abs(geometry.width) / 2)
    const ry = Math.max(1, Math.abs(geometry.height) / 2)
    const cx = geometry.x + rx
    const cy = geometry.y + ry
    const path = typeof Path2D !== 'undefined' ? new Path2D() : null
    path?.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2)
    return {
      bounds: {
        x: Math.max(0, Math.round(cx - rx)),
        y: Math.max(0, Math.round(cy - ry)),
        width: Math.round(rx * 2),
        height: Math.round(ry * 2)
      },
      path
    }
  }
  // line → a capsule (round-capped segment) whose outline is the clip region
  const half = Math.max(1, geometry.width / 2)
  const capsule = buildMaskStrokePolygon(
    [
      { x: geometry.x1, y: geometry.y1 },
      { x: geometry.x2, y: geometry.y2 }
    ],
    half
  )
  const path = typeof Path2D !== 'undefined' ? new Path2D() : null
  if (path) {
    capsule.forEach((pt, i) => (i === 0 ? path.moveTo(pt.x, pt.y) : path.lineTo(pt.x, pt.y)))
    path.closePath()
  }
  const minX = Math.min(geometry.x1, geometry.x2)
  const maxX = Math.max(geometry.x1, geometry.x2)
  const minY = Math.min(geometry.y1, geometry.y2)
  const maxY = Math.max(geometry.y1, geometry.y2)
  return {
    bounds: {
      x: Math.max(0, Math.floor(minX - half)),
      y: Math.max(0, Math.floor(minY - half)),
      width: Math.max(1, Math.ceil(maxX + half) - Math.floor(minX - half)),
      height: Math.max(1, Math.ceil(maxY + half) - Math.floor(minY - half))
    },
    path
  }
}

/**
 * Blurs the region described by `geometry` on a copy of the target bitmap and
 * returns the resulting data URL. Clips the blurred composite to the exact
 * shape (rect / ellipse / round-capped line), so untouched pixels stay intact.
 */
export async function applyBlurRegion(
  target: DestructiveStrokeTarget,
  geometry: BlurGeometry,
  radius: number
): Promise<string | null> {
  const surface = createRasterSurface(target.width, target.height)
  if (!surface) return null
  const existing = await loadImage(target.src)
  if (!existing) return null
  surface.ctx.drawImage(existing, 0, 0, target.width, target.height)
  const { bounds, path } = resolveBlurGeometry(geometry)
  blurRegionOnSurface(surface, bounds, path, radius)
  return canvasToDataUrl(surface.canvas)
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
  if (!filled) return
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
/** Reject flood fills on images larger than 4M pixels to prevent OOM. */
const FLOOD_FILL_SAFE_PIXEL_LIMIT = 4_000_000

export function floodFill(
  imageData: ImageData,
  seedX: number,
  seedY: number,
  tolerance = 0,
  replacement: RGBA = [0, 0, 0, 0]
): ImageData | null {
  const { width, height, data } = imageData
  if (width === 0 || height === 0) return imageData
  if (width * height > FLOOD_FILL_SAFE_PIXEL_LIMIT) return null
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

/**
 * Render a group's children into a single bitmap data-URL.  The children are
 * composited into an SVG which is rasterised onto an off-screen canvas.  Returns
 * `null` when a 2-D context is unavailable or the rasterisation fails.
 */
export async function renderGroupToBitmap(
  children: ComponentData[],
  width: number,
  height: number
): Promise<string | null> {
  const parts: string[] = []
  let z = 0
  for (const child of children) {
    const cw = (child as unknown as { width: number }).width ?? 100
    const ch = (child as unknown as { height: number }).height ?? 100
    const cx = (child as unknown as { x: number }).x ?? 0
    const cy = (child as unknown as { y: number }).y ?? 0
    parts.push(`<g z-index="${z}">`)
    if (child.kind === 'shape') parts.push(shapeToSvg(child, cx, cy, cw, ch))
    else if (child.kind === 'text') parts.push(textToSvg(child, cx, cy, cw, ch))
    parts.push('</g>')
    z++
  }
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${parts.join('')}</svg>`
  const dataUrl = `data:image/svg+xml,${encodeURIComponent(svg)}`
  return new Promise<string | null>((resolve) => {
    const img = new Image()
    img.onload = () => {
      const surface = createRasterSurface(width, height)
      if (!surface) { resolve(null); return }
      surface.ctx.drawImage(img, 0, 0, width, height)
      canvasToDataUrl(surface.canvas).then(resolve)
    }
    img.onerror = () => resolve(null)
    img.src = dataUrl
  })
}
