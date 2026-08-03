import { computeResize, ResizeHandle } from './geometry'

export interface Point {
  clientX: number
  clientY: number
}

export interface SnapGuides {
  verticalGuides: number[]
  horizontalGuides: number[]
}

export interface MultiDragEntry {
  id: string
  startElemX: number
  startElemY: number
  el: HTMLElement
  commit: (id: string, x: number, y: number) => void
  /** Maps a composed scene point to the entry's stored (parent-local) frame. */
  toStored?: (x: number, y: number) => { x: number; y: number }
  /** Descendant already moving with a dragged ancestor: skip DOM write + commit. */
  skipCommit?: boolean
}

export interface Follower {
  id: string
  startX: number
  startY: number
  el: HTMLElement
  commit: (id: string, x: number, y: number) => void
  toStored?: (x: number, y: number) => { x: number; y: number }
  skipCommit?: boolean
}

export interface DragSessionOptions {
  zoom: number
  element: { id: string; x: number; y: number; width: number; height: number; rotation?: number }
  el: HTMLElement
  onStart?: (id: string) => void
  onDrag: (id: string, x: number, y: number) => void
  onEnd: (id: string) => void
  snapFn?: (id: string, x: number, y: number, w: number, h: number) => { x: number; y: number }
  onGuidesChange?: (guides: SnapGuides) => void
  getMultiDrag?: () => MultiDragEntry[]
  /** Live-preview emitter for the moving element's target bounds (ghost). */
  onPreview?: (id: string, x: number, y: number, width: number, height: number, rotation?: number) => void
  /**
   * Maps a composed scene point to the element's STORED (parent-local) frame,
   * used for live DOM writes during move/end/cancel. Undefined = identity
   * (root elements whose stored coordinates ARE scene coordinates).
   */
  toStored?: (x: number, y: number) => { x: number; y: number }
}

export interface DragSession {
  begin: (pointer: Point) => void
  move: (pointer: Point) => void
  end: (pointer: Point) => void
  cancel: () => void
}

interface DragInternal {
  id: string
  startX: number
  startY: number
  startElemX: number
  startElemY: number
  elemWidth: number
  elemHeight: number
  el: HTMLElement
  followers: Follower[]
}

export function createDragSession(options: DragSessionOptions): DragSession {
  let active: DragInternal | null = null

  function begin(pointer: Point): void {
    if (active) return
    const followers: Follower[] = []
    const entries = options.getMultiDrag?.() ?? []
    for (const entry of entries) {
      if (entry.id === options.element.id) continue
      followers.push({
        id: entry.id,
        startX: entry.startElemX,
        startY: entry.startElemY,
        el: entry.el,
        commit: entry.commit,
        toStored: entry.toStored,
        skipCommit: entry.skipCommit
      })
    }
    active = {
      id: options.element.id,
      startX: pointer.clientX,
      startY: pointer.clientY,
      startElemX: options.element.x,
      startElemY: options.element.y,
      elemWidth: options.element.width,
      elemHeight: options.element.height,
      el: options.el,
      followers
    }
    options.onStart?.(active.id)
  }

  function move(pointer: Point): void {
    const s = active
    if (!s) return
    const dx = (pointer.clientX - s.startX) / options.zoom
    const dy = (pointer.clientY - s.startY) / options.zoom
    let newX = s.startElemX + dx
    let newY = s.startElemY + dy

    if (options.snapFn) {
      const snapped = options.snapFn(s.id, newX, newY, s.elemWidth, s.elemHeight)
      newX = snapped.x
      newY = snapped.y
    }

    const primary = options.toStored ? options.toStored(newX, newY) : { x: newX, y: newY }
    s.el.style.left = `${primary.x}px`
    s.el.style.top = `${primary.y}px`

    for (const f of s.followers) {
      if (f.skipCommit) continue
      const p = f.toStored ? f.toStored(f.startX + dx, f.startY + dy) : { x: f.startX + dx, y: f.startY + dy }
      f.el.style.left = `${p.x}px`
      f.el.style.top = `${p.y}px`
    }

    options.onPreview?.(s.id, newX, newY, s.elemWidth, s.elemHeight, options.element.rotation)
  }

  function end(pointer: Point): void {
    const s = active
    if (!s) return

    options.onEnd(s.id)

    const dx = (pointer.clientX - s.startX) / options.zoom
    const dy = (pointer.clientY - s.startY) / options.zoom
    let finalX = s.startElemX + dx
    let finalY = s.startElemY + dy

    if (options.snapFn) {
      const snapped = options.snapFn(s.id, finalX, finalY, s.elemWidth, s.elemHeight)
      finalX = snapped.x
      finalY = snapped.y
      const sDx = finalX - s.startElemX
      const sDy = finalY - s.startElemY
      for (const f of s.followers) {
        if (f.skipCommit) continue
        const ex = f.startX + sDx
        const ey = f.startY + sDy
        const p = f.toStored ? f.toStored(ex, ey) : { x: ex, y: ey }
        f.el.style.left = `${p.x}px`
        f.el.style.top = `${p.y}px`
        f.commit(f.id, Math.round(p.x), Math.round(p.y))
      }
    } else {
      for (const f of s.followers) {
        if (f.skipCommit) continue
        const ex = f.startX + dx
        const ey = f.startY + dy
        const p = f.toStored ? f.toStored(ex, ey) : { x: ex, y: ey }
        f.el.style.left = `${p.x}px`
        f.el.style.top = `${p.y}px`
        f.commit(f.id, Math.round(p.x), Math.round(p.y))
      }
    }

    const finalPoint = options.toStored ? options.toStored(finalX, finalY) : { x: finalX, y: finalY }
    s.el.style.left = `${finalPoint.x}px`
    s.el.style.top = `${finalPoint.y}px`

    options.onGuidesChange?.({ verticalGuides: [], horizontalGuides: [] })
    options.onDrag(s.id, finalX, finalY)
    active = null
  }

  function cancel(): void {
    const s = active
    if (!s) return
    const primary = options.toStored ? options.toStored(s.startElemX, s.startElemY) : { x: s.startElemX, y: s.startElemY }
    s.el.style.left = `${primary.x}px`
    s.el.style.top = `${primary.y}px`
    for (const f of s.followers) {
      if (f.skipCommit) continue
      const p = f.toStored ? f.toStored(f.startX, f.startY) : { x: f.startX, y: f.startY }
      f.el.style.left = `${p.x}px`
      f.el.style.top = `${p.y}px`
    }
    options.onGuidesChange?.({ verticalGuides: [], horizontalGuides: [] })
    active = null
  }

  return { begin, move, end, cancel }
}

export interface ResizeSessionOptions {
  zoom: number
  element: { id: string; x: number; y: number; width: number; height: number; rotation?: number }
  el: HTMLElement
  onResize: (id: string, x: number, y: number, w: number, h: number) => void
  onEnd: (id: string) => void
  /** Live-preview emitter for the resized element's target bounds (ghost). */
  onPreview?: (id: string, x: number, y: number, width: number, height: number, rotation?: number) => void
  /** When true the element's aspect ratio is preserved even without Shift. */
  lockAspectRatio?: boolean
  /**
   * Maps a composed scene point to the element's STORED (parent-local) frame,
   * used for live DOM writes during move/end/cancel. Undefined = identity
   * (root elements whose stored coordinates ARE scene coordinates).
   */
  toStored?: (x: number, y: number) => { x: number; y: number }
}

export interface ResizeSession {
  begin: (handle: ResizeHandle, pointer: Point) => void
  move: (pointer: Point, shiftKey: boolean) => void
  end: (pointer: Point, shiftKey: boolean) => void
  cancel: () => void
}

interface ResizeInternal {
  id: string
  handle: ResizeHandle
  startX: number
  startY: number
  startWidth: number
  startHeight: number
  startElemX: number
  startElemY: number
  el: HTMLElement
}

export function createResizeSession(options: ResizeSessionOptions): ResizeSession {
  let active: ResizeInternal | null = null

  function computeToDom(pointer: Point, shiftKey: boolean): { x: number; y: number; width: number; height: number } {
    const s = active!
    const result = computeResize({
      handle: s.handle,
      startX: s.startX,
      startY: s.startY,
      clientX: pointer.clientX,
      clientY: pointer.clientY,
      zoom: options.zoom,
      startElemX: s.startElemX,
      startElemY: s.startElemY,
      startWidth: s.startWidth,
      startHeight: s.startHeight,
      proportional: shiftKey || (options.lockAspectRatio ?? false)
    })
    s.el.style.width = `${result.width}px`
    s.el.style.height = `${result.height}px`
    const pos = options.toStored ? options.toStored(result.x, result.y) : { x: result.x, y: result.y }
    s.el.style.left = `${pos.x}px`
    s.el.style.top = `${pos.y}px`
    return result
  }

  function begin(handle: ResizeHandle, pointer: Point): void {
    if (active) return
    active = {
      id: options.element.id,
      handle,
      startX: pointer.clientX,
      startY: pointer.clientY,
      startWidth: options.element.width,
      startHeight: options.element.height,
      startElemX: options.element.x,
      startElemY: options.element.y,
      el: options.el
    }
    active.el.style.cursor = handle === 'nw' || handle === 'se' ? 'nwse-resize' : 'nesw-resize'
  }

  function move(pointer: Point, shiftKey: boolean): void {
    const s = active
    if (!s) return
    const result = computeToDom(pointer, shiftKey)
    options.onPreview?.(s.id, result.x, result.y, result.width, result.height, options.element.rotation)
  }

  function end(pointer: Point, shiftKey: boolean): void {
    const s = active
    if (!s) return
    options.onEnd(s.id)
    const result = computeToDom(pointer, shiftKey)
    // The store is committed once on end (mirroring the drag session) so a
    // cancelled resize never leaves the document mutated.
    options.onResize(s.id, result.x, result.y, result.width, result.height)
    s.el.style.cursor = ''
    active = null
  }

  function cancel(): void {
    const s = active
    if (!s) return
    s.el.style.width = `${s.startWidth}px`
    s.el.style.height = `${s.startHeight}px`
    const pos = options.toStored ? options.toStored(s.startElemX, s.startElemY) : { x: s.startElemX, y: s.startElemY }
    s.el.style.left = `${pos.x}px`
    s.el.style.top = `${pos.y}px`
    s.el.style.cursor = ''
    active = null
  }

  return { begin, move, end, cancel }
}
