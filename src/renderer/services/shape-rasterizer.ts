/**
 * shape-rasterizer — Renders a shape's current visual fill (solid color or
 * gradient) into a bitmap data URL, clipped to the shape's path. This is the
 * bridge that lets destructive tools (eraser, blur, magic-eraser) operate on
 * shapes that lack a pre-existing `backgroundImage`: the shape is rasterized
 * on-demand and the result is stored as the shape's `backgroundImage`,
 * transitioning the shape into bitmap-editing mode while preserving all vector
 * rendering properties (opacity, CSS blur/effects, SVG shadow/glow filters,
 * rotation) as element-level attributes that apply on top of the bitmap.
 *
 * The rasterized bitmap represents ONLY the fill content in the shape's local
 * coordinate frame (0..width / 0..height). Element rotation is not baked in —
 * the existing `toLocalPoint` inverse-rotation in the destructive commit
 * pipeline handles rotated elements. CSS opacity and CSS filters are not
 * baked in — they continue to apply via the facade wrapper at render time.
 * SVG shadow/glow filters ARE baked in, since they are computed from the
 * shape's alpha at render time (an SVG `<filter>` on the path's `<g>`).
 *
 * This module is shape-renderer-agnostic: it reads straight from the data
 * model using `getShapePath` (the same geometry the renderer uses), so the
 * rasterized bitmap never drifts from on-screen rendering.
 */
import type { Shape, ShapeGradient } from '@shared/types'
import { getShapePath } from './shape-geometry'
import { createRasterSurface, canvasToDataUrl } from './rasterizer'

/** Resolution multiplier for the rasterized bitmap. 1 = 1px per scene unit. */
const DEFAULT_SCALE = 1

/** Number of angular wedges used to approximate a conic gradient on canvas. */
const CONIC_SEGMENTS = 128

function hexLerp(a: string, b: string, t: number): string {
  const pa = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(a)
  const pb = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(b)
  if (!pa || !pb) return b
  const channel = (i: number) =>
    Math.round(parseInt(pa[i], 16) + (parseInt(pb[i], 16) - parseInt(pa[i], 16)) * t)
      .toString(16)
      .padStart(2, '0')
  return `#${channel(1)}${channel(2)}${channel(3)}`
}

function fillShapeGradient(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  w: number,
  h: number,
  gradient: ShapeGradient
): void {
  const colors = gradient.colors
  if (colors.length < 2) return
  const n = colors.length - 1
  const cx = w / 2
  const cy = h / 2
  const maxR = Math.sqrt(cx * cx + cy * cy)
  const addStops = (grad: CanvasGradient) => colors.forEach((color, i) => grad.addColorStop(i / n, color))
  const type = gradient.type ?? 'linear'

  if (type === 'radial') {
    ctx.save()
    ctx.translate(cx, cy)
    // Canvas gradients are circular; scale y so `r = cx` maps to an ellipse
    // reaching the box edges in both axes (CSS ellipse farthest-corner).
    if ((gradient.radialShape ?? 'circle') === 'ellipse') ctx.scale(1, h / w)
    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, (gradient.radialShape ?? 'circle') === 'ellipse' ? cx : maxR)
    addStops(grad)
    ctx.fillStyle = grad
    ctx.fillRect(-w, -w, w * 2, w * 2)
    ctx.restore()
    return
  }

  if (type === 'conic') {
    // Canvas has no native conic gradient — approximate with solid wedges,
    // each filled with the color interpolated at its midpoint angle.
    const angle = (gradient.angle ?? 0) * (Math.PI / 180)
    for (let i = 0; i < CONIC_SEGMENTS; i++) {
      const a0 = angle + (i / CONIC_SEGMENTS) * Math.PI * 2
      const a1 = angle + ((i + 1) / CONIC_SEGMENTS) * Math.PI * 2
      const aMid = (a0 + a1) / 2
      const t = (((aMid - angle) / (Math.PI * 2)) % 1 + 1) % 1
      const span = t * n
      const lo = Math.min(Math.floor(span), n - 1)
      const frac = span - lo
      ctx.fillStyle = hexLerp(colors[lo], colors[Math.min(lo + 1, n - 1)], frac)
      ctx.beginPath()
      ctx.moveTo(cx, cy)
      ctx.lineTo(cx + Math.cos(a0) * maxR, cy + Math.sin(a0) * maxR)
      ctx.lineTo(cx + Math.cos(a1) * maxR, cy + Math.sin(a1) * maxR)
      ctx.closePath()
      ctx.fill()
    }
    return
  }

  // linear — rotate the gradient direction, then fill a square of half-side
  // maxR so every box corner is covered under any angle.
  const angleRad = (gradient.angle * Math.PI) / 180
  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate(angleRad)
  const grad = ctx.createLinearGradient(0, -h / 2, 0, h / 2)
  addStops(grad)
  ctx.fillStyle = grad
  ctx.fillRect(-maxR, -maxR, maxR * 2, maxR * 2)
  ctx.restore()
}

/**
 * Rasterizes a shape's fill into a bitmap data URL.
 *
 * The bitmap matches the shape's local coordinate space (0..width /
 * 0..height), un-rotated, at full opacity, with only the fill (solid color
 * or gradient) rendered — no CSS effects, no SVG shadow/glow filters.
 *
 * Returns null when:
 *   - `Path2D` is unavailable (jsdom / non-browser environments)
 *   - The shape path is degenerate (empty path string)
 *   - A raster surface cannot be created (no canvas 2d context)
 */
export async function rasterizeShapeBitmap(shape: Shape, scale: number = DEFAULT_SCALE): Promise<string | null> {
  if (typeof Path2D === 'undefined') return null

  const w = Math.max(1, Math.round(shape.width * scale))
  const h = Math.max(1, Math.round(shape.height * scale))

  // Resolve the shape-specific thickness parameter (fractions, no scaling needed).
  const thickness =
    shape.kind === 'plus'
      ? shape.plusThickness
      : shape.kind === 'arrow-right'
      ? shape.arrowThickness
      : shape.kind === 'cross'
      ? shape.crossThickness
      : undefined

  // Generate the path at the scaled dimensions. cornerRadius is absolute
  // (in scene units), so it must be scaled to match.
  const pathData = getShapePath(
    shape.kind,
    w,
    h,
    shape.cornerRadius * scale,
    shape.angles,
    thickness
  )

  if (pathData === '') return null

  const surface = createRasterSurface(w, h)
  if (!surface) return null
  const { ctx } = surface

  const path = new Path2D(pathData)

  ctx.save()
  ctx.clip(path)

  if (shape.gradient?.enabled && shape.gradient.colors.length >= 2) {
    fillShapeGradient(ctx, w, h, shape.gradient)
  } else {
    ctx.fillStyle = shape.color
    ctx.fillRect(0, 0, w, h)
  }

  ctx.restore()
  return canvasToDataUrl(surface.canvas)
}
