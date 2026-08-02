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
import type { Shape } from '@shared/types'
import { getShapePath } from './shape-geometry'
import { createRasterSurface, canvasToDataUrl } from './rasterizer'

/** Resolution multiplier for the rasterized bitmap. 1 = 1px per scene unit. */
const DEFAULT_SCALE = 1

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
    const colors = shape.gradient.colors
    const angleRad = (shape.gradient.angle * Math.PI) / 180
    const cx = w / 2
    const cy = h / 2

    // SVG renders a vertical gradient (y1=0%, y2=100%) rotated by `angle` around
    // the bounding-box center. Replicate via context rotation.
    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate(angleRad)
    const grad = ctx.createLinearGradient(0, -h / 2, 0, h / 2)
    const n = colors.length - 1
    colors.forEach((color, i) => {
      grad.addColorStop(i / n, color)
    })
    ctx.fillStyle = grad
    ctx.fillRect(-w / 2, -h / 2, w, h)
    ctx.restore()
  } else {
    ctx.fillStyle = shape.color
    ctx.fillRect(0, 0, w, h)
  }

  ctx.restore()
  return canvasToDataUrl(surface.canvas)
}
