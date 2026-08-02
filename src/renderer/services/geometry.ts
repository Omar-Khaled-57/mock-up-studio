export type ResizeHandle = 'nw' | 'ne' | 'sw' | 'se'

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export interface Size2D {
  width: number
  height: number
}

/**
 * Shared numeric size-edit math (Transform panel, scripting/API, future tools):
 * when `lock` is true, the dimension the caller actually changed drives the
 * other dimension via the element's CURRENT aspect ratio, so the box always
 * keeps its shape regardless of which input was edited. When `lock` is false
 * the target is used verbatim (free-form).
 */
export function applyLockedSize(current: Size2D, target: Size2D, lock: boolean): Size2D {
  if (!lock) return { width: target.width, height: target.height }
  const aspect = current.width / current.height
  const widthChanged = target.width !== current.width
  const heightChanged = target.height !== current.height
  if (widthChanged && !heightChanged) {
    return { width: target.width, height: target.width / aspect }
  }
  if (heightChanged && !widthChanged) {
    return { width: target.height * aspect, height: target.height }
  }
  return { width: target.width, height: target.height }
}


export interface ElementLike {
  id: string
  x: number
  y: number
  width: number
  height: number
  rotation?: number
}

export interface ResizeComputeInput {
  handle: ResizeHandle
  startX: number
  startY: number
  clientX: number
  clientY: number
  zoom: number
  startElemX: number
  startElemY: number
  startWidth: number
  startHeight: number
  proportional: boolean
  minSize?: number
}

export interface ResizeResult {
  x: number
  y: number
  width: number
  height: number
}

export function computeResize(input: ResizeComputeInput): ResizeResult {
  const min = input.minSize ?? 20
  const rawDx = (input.clientX - input.startX) / input.zoom
  const rawDy = (input.clientY - input.startY) / input.zoom
  const aspect = input.startWidth / input.startHeight

  let width = input.startWidth
  let height = input.startHeight
  let x = input.startElemX
  let y = input.startElemY

  switch (input.handle) {
    case 'se':
      width = Math.max(min, input.startWidth + rawDx)
      height = input.proportional
        ? width / aspect
        : Math.max(min, input.startHeight + rawDy)
      break
    case 'sw':
      width = Math.max(min, input.startWidth - rawDx)
      height = input.proportional
        ? width / aspect
        : Math.max(min, input.startHeight + rawDy)
      x = input.startElemX + (input.startWidth - width)
      break
    case 'ne':
      width = Math.max(min, input.startWidth + rawDx)
      height = input.proportional
        ? width / aspect
        : Math.max(min, input.startHeight - rawDy)
      y = input.startElemY + (input.startHeight - height)
      break
    case 'nw':
      width = Math.max(min, input.startWidth - rawDx)
      height = input.proportional
        ? width / aspect
        : Math.max(min, input.startHeight - rawDy)
      x = input.startElemX + (input.startWidth - width)
      y = input.startElemY + (input.startHeight - height)
      break
  }

  return { x, y, width, height }
}

export function getRotatedBounds(el: ElementLike): Rect {
  const { x, y, width, height, rotation = 0 } = el
  if (!rotation) return { x, y, width, height }
  const rad = (rotation * Math.PI) / 180
  const cos = Math.abs(Math.cos(rad))
  const sin = Math.abs(Math.sin(rad))
  const w = width * cos + height * sin
  const h = width * sin + height * cos
  return { x: x + width / 2 - w / 2, y: y + height / 2 - h / 2, width: w, height: h }
}

/** Union AABB of the rotated bounds of every element. Null for an empty list. */
export function unionBounds(elements: ElementLike[]): Rect | null {
  if (elements.length === 0) return null
  const rects = elements.map(getRotatedBounds)
  const minX = Math.min(...rects.map((r) => r.x))
  const minY = Math.min(...rects.map((r) => r.y))
  const maxX = Math.max(...rects.map((r) => r.x + r.width))
  const maxY = Math.max(...rects.map((r) => r.y + r.height))
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}

export interface SnapAxisInput {
  pos: number
  size: number
  targets: number[]
  canvasSize: number
  threshold: number
}

export interface SnapAxisResult {
  snapped: number
  guide: number | null
}

export function snapAxis(input: SnapAxisInput): SnapAxisResult {
  const { pos, size, targets, canvasSize, threshold } = input
  const left = pos
  const center = pos + size / 2
  const right = pos + size

  let bestDist = threshold + 1
  let bestOffset = 0
  let bestGuide: number | null = null

  const candidates = [
    { elemVal: left, offset: 0 },
    { elemVal: center, offset: size / 2 },
    { elemVal: right, offset: size }
  ]

  const canvasCandidates = [0, canvasSize / 2, canvasSize]

  for (const c of candidates) {
    for (const t of targets) {
      const dist = Math.abs(c.elemVal - t)
      if (dist < bestDist) {
        bestDist = dist
        bestOffset = t - c.elemVal + pos
        bestGuide = t
      }
    }
    for (const t of canvasCandidates) {
      const dist = Math.abs(c.elemVal - t)
      if (dist < bestDist) {
        bestDist = dist
        bestOffset = t - c.elemVal + pos
        bestGuide = t
      }
    }
  }

  if (bestDist > threshold) {
    return { snapped: pos, guide: null }
  }

  return { snapped: Math.round(bestOffset * 100) / 100, guide: bestGuide }
}
