/**
 * container-clip — render-time clipping for container elements (Phase 3).
 *
 * When an element has children (elements whose `containerId` references it),
 * those children clip to the container's exact geometry at render time. This
 * is a non-destructive mask applied purely in the render tree (Scene.tsx's
 * clip wrapper): rectangle boxes clip via `overflow: hidden`, shape parents
 * additionally clip to their SVG outline via `clip-path: path(...)`, and any
 * masks on the container are intersected with the shape by nesting clip-path
 * layers (each in the container's local frame).
 *
 * `getShapePath` lives in `shape-geometry` (pure) so both the shape's visible
 * fill and the container clip share one source of truth.
 */

import { Mask, ShapeKind } from '@shared/types'
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
  masks: Mask[]
}

export interface ContainerClip {
  /** CSS clip-path for the container's exact geometry (null for rect boxes — overflow handles it). */
  shapeClip: string | null
  /** Masks targeting the container, intersected with the shape clip via nested clip-path layers. */
  masks: Mask[]
}

export function buildContainerClip(input: ContainerClipInput): ContainerClip {
  let shapeClip: string | null = null
  if (input.kind === 'shape' && input.shapeKind) {
    const thickness =
      input.shapeKind === 'plus'
        ? (input.plusThickness ?? 0.3)
        : input.shapeKind === 'arrow-right'
          ? (input.arrowThickness ?? 0.5)
          : undefined
    const path = getShapePath(input.shapeKind, input.width, input.height, input.cornerRadius ?? 0, input.angles, thickness)
    if (path) shapeClip = `path('${path}')`
  }
  return { shapeClip, masks: input.masks }
}
