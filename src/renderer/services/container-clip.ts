/**
 * container-clip — render-time clipping for container elements (Phase 3).
 *
 * When an element has children (elements whose `containerId` references it),
 * those children clip to the container's exact geometry at render time. This
 * is a non-destructive mask applied purely in the render tree (Scene.tsx's
 * clip wrapper): rectangle boxes clip via `overflow: hidden`, shape parents
 * additionally clip to their SVG outline via `clip-path: path(...)`.
 *
 * `getShapePath` lives in `shape-geometry` (pure) so both the shape's visible
 * fill and the container clip share one source of truth.
 *
 * Masks are NOT part of container clipping anymore — masks are independent
 * scene layers clipped at the Scene level (`Scene.tsx`), never per-element.
 */

import { ShapeKind } from '@shared/types'
import { getShapePath } from './shape-geometry'

export type ClipContainerKind = 'device' | 'textbox' | 'image' | 'shape'

export interface ContainerClipInput {
  kind: ClipContainerKind
  width: number
  height: number
  shapeKind?: ShapeKind
  cornerRadius?: number
  angles?: [number, number, number]
  plusThickness?: number
  arrowThickness?: number
  crossThickness?: number
}

export interface ContainerClip {
  /** CSS clip-path for the container's exact geometry (null for rect boxes — overflow handles it). */
  shapeClip: string | null
}

export function buildContainerClip(input: ContainerClipInput): ContainerClip {
  let shapeClip: string | null = null
  if (input.kind === 'shape' && input.shapeKind) {
    const thickness =
      input.shapeKind === 'plus'
        ? (input.plusThickness ?? 0.3)
        : input.shapeKind === 'arrow-right'
          ? (input.arrowThickness ?? 0.5)
          : input.shapeKind === 'cross'
            ? (input.crossThickness ?? 0.3)
            : undefined
    const path = getShapePath(input.shapeKind, input.width, input.height, input.cornerRadius ?? 0, input.angles, thickness)
    if (path) shapeClip = `path('${path}')`
  }
  return { shapeClip }
}
