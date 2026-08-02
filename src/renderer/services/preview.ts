/**
 * preview — Reusable, data-driven live-preview definitions for tools.
 *
 * Tools emit a `PreviewState` (pure geometry + style in scene coordinates) into
 * the runtime store during a gesture. `PreviewSurface` renders it imperatively
 * on a canvas at 60fps without React re-render storms, and `drawPreview` is the
 * single geometry→canvas mapping. New preview kinds (crop frame, lasso, region
 * masks, …) add a geometry union member + a draw branch here — the tool, the
 * store and the surface never change.
 *
 * The visual language is intentionally shared across tools: a translucent fill,
 * a soft outline, optional hatch/pattern and an optional soft glow — never the
 * final effect (a blur preview must not blur, a move ghost must not be the
 * element itself).
 */

import { getRotatedBounds } from './geometry'
import type { BlurGeometry } from './rasterizer'

export type PreviewVisualKind = 'rect' | 'ellipse' | 'line'

export interface PreviewStyle {
  /** Fill color; `'none'`/`'transparent'` disables the fill pass. */
  fill: string
  stroke: string
  strokeWidth: number
  /** Dash pattern in scene units; `null` = solid. */
  lineDash: number[] | null
  /** Diagonal cross-hatch overlay clipped to the shape. */
  hatch: boolean
  /** Soft glow via `shadowBlur`. */
  glow: boolean
}

export const DEFAULT_PREVIEW_STYLE: PreviewStyle = {
  fill: 'rgba(59, 130, 246, 0.12)',
  stroke: 'rgba(59, 130, 246, 0.9)',
  strokeWidth: 1.5,
  lineDash: null,
  hatch: false,
  glow: false
}

export type PreviewGeometry =
  | { kind: 'rect'; x: number; y: number; width: number; height: number; source?: GhostBounds }
  | { kind: 'ellipse'; x: number; y: number; width: number; height: number }
  | { kind: 'line'; x1: number; y1: number; x2: number; y2: number; width: number }

export type PreviewVisual = PreviewGeometry & { style?: Partial<PreviewStyle> }

export interface PreviewState {
  /** Base style applied to every visual; per-visual `style` overrides win. */
  style?: Partial<PreviewStyle>
  visuals: PreviewVisual[]
}

export const EMPTY_PREVIEW: PreviewState = { visuals: [] }

export function rectPreview(
  x: number,
  y: number,
  width: number,
  height: number,
  style?: Partial<PreviewStyle>
): PreviewVisual {
  return { kind: 'rect', x, y, width, height, style }
}

export function ellipsePreview(
  x: number,
  y: number,
  width: number,
  height: number,
  style?: Partial<PreviewStyle>
): PreviewVisual {
  return { kind: 'ellipse', x, y, width, height, style }
}

export function linePreview(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  width: number,
  style?: Partial<PreviewStyle>
): PreviewVisual {
  return { kind: 'line', x1, y1, x2, y2, width, style }
}

/** Merge the state base style with a visual's per-visual overrides. */
export function resolveStyle(
  base: Partial<PreviewStyle> | undefined,
  visual: PreviewVisual
): PreviewStyle {
  return { ...DEFAULT_PREVIEW_STYLE, ...base, ...visual.style }
}

export interface GhostBounds {
  /** The element the ghost belongs to. */
  id: string
  x: number
  y: number
  width: number
  height: number
  rotation?: number
}

/**
 * Selection transform ghost — a semi-transparent dashed outline with a soft
 * glow that follows the moving/resizing element's target bounds. The original
 * selection chrome border stays at the start bounds until commit, so the ghost
 * bridges the gap (the element itself moves live in the DOM).
 */
export function buildGhostPreview(bounds: GhostBounds): PreviewState {
  const rotated = getRotatedBounds(bounds)
  return {
    style: {
      fill: 'rgba(59, 130, 246, 0.06)',
      stroke: 'rgba(59, 130, 246, 0.9)',
      strokeWidth: 1.5,
      lineDash: [6, 4],
      glow: true,
      hatch: false
    },
    visuals: [
      {
        kind: 'rect',
        x: rotated.x,
        y: rotated.y,
        width: rotated.width,
        height: rotated.height,
        source: { ...bounds }
      }
    ]
  }
}

/**
 * Resolve the live target bounds for a specific element from a preview state.
 *
 * The ghost's raw `source` box is the SHARED live-transform source for a
 * select-tool gesture: the overlay selection chrome and the element facades
 * both read it, so a moving/resized element renders WYSIWYG at exactly the
 * bounds the ghost and chrome show, and all three consumers can never drift
 * apart. Returns `null` when no ghost targets the element (blur-region
 * previews, mask previews, or no gesture in flight).
 */
export function resolveLiveGhost(preview: PreviewState | null, elementId: string): GhostBounds | null {
  if (!preview) return null
  for (const v of preview.visuals) {
    if (v.kind === 'rect' && v.source?.id === elementId) return v.source
  }
  return null
}

const BLUR_PREVIEW_STYLE: Partial<PreviewStyle> = {
  fill: 'rgba(255, 255, 255, 0.2)',
  stroke: 'rgba(255, 255, 255, 0.9)',
  strokeWidth: 1.5,
  lineDash: null,
  hatch: true,
  glow: true
}

/**
 * Blur region preview — the drag indicator for the rect/ellipse/line region
 * blur tools. White (never the blue/indigo selection chrome) so it reads as a
 * blur/lightening operation; the hatch + glow keep it distinct from a plain
 * selection box. It shares the common preview language but never renders an
 * actual blur.
 */
export function buildBlurRegionPreview(geometry: BlurGeometry): PreviewState {
  if (geometry.type === 'line') {
    return {
      style: BLUR_PREVIEW_STYLE,
      visuals: [
        { kind: 'line', x1: geometry.x1, y1: geometry.y1, x2: geometry.x2, y2: geometry.y2, width: geometry.width }
      ]
    }
  }
  return {
    style: BLUR_PREVIEW_STYLE,
    visuals: [{ kind: geometry.type, x: geometry.x, y: geometry.y, width: geometry.width, height: geometry.height }]
  }
}

/** Axis-aligned scene bounds of a preview visual (for hatch clipping). */
export function visualBounds(v: PreviewGeometry): { x: number; y: number; width: number; height: number } {
  if (v.kind === 'line') {
    return {
      x: Math.min(v.x1, v.x2),
      y: Math.min(v.y1, v.y2),
      width: Math.abs(v.x2 - v.x1),
      height: Math.abs(v.y2 - v.y1)
    }
  }
  return { x: v.x, y: v.y, width: v.width, height: v.height }
}

/** Trace the visual's path onto the current context (no fill/stroke). */
export function traceShape(ctx: CanvasRenderingContext2D, v: PreviewGeometry): void {
  switch (v.kind) {
    case 'rect':
      ctx.rect(v.x, v.y, v.width, v.height)
      break
    case 'ellipse': {
      const rx = Math.max(0.5, v.width / 2)
      const ry = Math.max(0.5, v.height / 2)
      ctx.ellipse(v.x + rx, v.y + ry, rx, ry, 0, 0, Math.PI * 2)
      break
    }
    case 'line':
      ctx.moveTo(v.x1, v.y1)
      ctx.lineTo(v.x2, v.y2)
      break
  }
}

function drawHatched(ctx: CanvasRenderingContext2D, visual: PreviewVisual): void {
  const b = visualBounds(visual)
  ctx.save()
  ctx.beginPath()
  traceShape(ctx, visual)
  ctx.clip()
  ctx.fillRect(b.x, b.y, b.width, b.height)
  ctx.globalAlpha = 0.4
  ctx.lineWidth = 1
  const step = 8
  for (let d = -b.height; d <= b.width + b.height; d += step) {
    ctx.beginPath()
    ctx.moveTo(b.x + d, b.y)
    ctx.lineTo(b.x + d + b.height, b.y + b.height)
    ctx.stroke()
  }
  ctx.restore()
}

/**
 * Draw a preview state in scene coordinates. The caller owns the transform;
 * this function only touches paint state and restores everything it changes.
 */
export function drawPreview(ctx: CanvasRenderingContext2D, state: PreviewState): void {
  if (!state || state.visuals.length === 0) return
  for (const visual of state.visuals) {
    const style = resolveStyle(state.style, visual)
    ctx.save()
    ctx.setLineDash(style.lineDash ?? [])
    ctx.lineWidth = style.strokeWidth
    ctx.strokeStyle = style.stroke
    ctx.fillStyle = style.fill
    if (style.glow) {
      ctx.shadowColor = style.stroke
      ctx.shadowBlur = style.strokeWidth * 5
    }

    // Fill pass (lines have no interior).
    if (visual.kind !== 'line' && style.fill !== 'none' && style.fill !== 'transparent') {
      if (style.hatch) {
        drawHatched(ctx, visual)
      } else {
        ctx.beginPath()
        traceShape(ctx, visual)
        ctx.fill()
      }
    }

    // Outline pass.
    ctx.beginPath()
    traceShape(ctx, visual)
    if (visual.kind === 'line') ctx.lineWidth = visual.width
    ctx.stroke()
    ctx.restore()
  }
}
