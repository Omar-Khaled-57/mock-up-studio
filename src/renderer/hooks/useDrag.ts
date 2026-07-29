/**
 * useDrag — Pointer-events-based drag hook with 60fps direct DOM mutation.
 *
 * Performance strategy:
 *   - During drag, only the element's `style.left/top` are mutated directly.
 *     No React re-renders or Zustand updates happen mid-drag.
 *   - On pointerup, the final position is committed to the store via `onDrag`.
 *   - `onEnd` fires after commit so the parent can push history.
 *
 * Snapping:
 *   - If `snapFn` is provided, the raw position is passed through it on every
 *     move. The snap function returns a corrected position and triggers guide
 *     lines via `onGuidesChange`.
 *   - Guides are cleared on pointerup (snap lines vanish after drop).
 *
 * Cancellation:
 *   - `cancel()` reverts the element to its original position and clears guides.
 *     Useful for Escape key handling during drag.
 */

import { useCallback, useRef } from 'react'

interface DragState {
  id: string
  /** Pointer position at drag start (client coordinates). */
  startX: number
  startY: number
  /** Element position at drag start (scene coordinates). */
  startElemX: number
  startElemY: number
  /** Element dimensions at drag start (for snap calculations). */
  elemWidth: number
  elemHeight: number
  /** The DOM element being dragged (for direct style mutation). */
  el: HTMLElement
  /** Captured multi-drag followers (move in parallel). */
  followers: { id: string; startX: number; startY: number; el: HTMLElement; commit: (id: string, x: number, y: number) => void }[]
}

interface SnapInfo {
  verticalGuides: number[]
  horizontalGuides: number[]
}

export interface MultiDragEntry {
  id: string
  startElemX: number
  startElemY: number
  el: HTMLElement
  commit: (id: string, x: number, y: number) => void
}

interface UseDragOptions {
  /** Current zoom level — divides pointer delta to convert screen pixels to scene units. */
  zoom: number
  onStart?: (id: string) => void
  /** Called on pointerup with the final scene coordinates (commit to store). */
  onDrag: (id: string, x: number, y: number) => void
  /** Called after onDrag — typically used to push history. */
  onEnd: (id: string) => void
  /** Optional snapping callback: receives raw position, returns corrected position. */
  snapFn?: (id: string, x: number, y: number, w: number, h: number) => { x: number; y: number }
  /** Called when snap guide lines should be shown or cleared. */
  onGuidesChange?: (guides: SnapInfo) => void
  /** Optional multi-element drag — moves all tracked elements in parallel. Called at drag start. */
  getMultiDrag?: () => MultiDragEntry[]
}

export function useDrag({ zoom, onStart, onDrag, onEnd, snapFn, onGuidesChange, getMultiDrag }: UseDragOptions) {
  const state = useRef<DragState | null>(null)

  const handlePointerDown = useCallback(
    (e: React.PointerEvent, id: string, elemX: number, elemY: number, elemW?: number, elemH?: number) => {
      if (e.button !== 0) return
      e.stopPropagation()

      const el = e.currentTarget as HTMLElement
      el.setPointerCapture(e.pointerId)

      // Capture multi-drag followers at drag start.
      const followers: DragState['followers'] = []
      const getMd = getMultiDragRef.current
      if (getMd) {
        const entries = getMd()
        for (const entry of entries) {
          if (entry.id === id) continue
          followers.push({ id: entry.id, startX: entry.startElemX, startY: entry.startElemY, el: entry.el, commit: entry.commit })
        }
      }

      state.current = {
        id,
        startX: e.clientX,
        startY: e.clientY,
        startElemX: elemX,
        startElemY: elemY,
        elemWidth: elemW ?? el.offsetWidth,
        elemHeight: elemH ?? el.offsetHeight,
        el,
        followers
      }

      onStart?.(id)
    },
    [onStart]
  )

  const getMultiDragRef = useRef<UseDragOptions['getMultiDrag']>(getMultiDrag)
  getMultiDragRef.current = getMultiDrag

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      const s = state.current
      if (!s) return

      // Convert screen-pixel delta to scene-unit delta (accounting for zoom).
      const dx = (e.clientX - s.startX) / zoom
      const dy = (e.clientY - s.startY) / zoom
      let newX = s.startElemX + dx
      let newY = s.startElemY + dy

      // Run snapping to align to grid, guides, or other elements.
      if (snapFn) {
        const snapped = snapFn(s.id, newX, newY, s.elemWidth, s.elemHeight)
        newX = snapped.x
        newY = snapped.y
      }

      // Direct DOM mutation — no React render, no store update (60fps).
      s.el.style.left = `${newX}px`
      s.el.style.top = `${newY}px`

      // Move all multi-drag followers by the same raw delta.
      for (const f of s.followers) {
        f.el.style.left = `${f.startX + dx}px`
        f.el.style.top = `${f.startY + dy}px`
      }
    },
    [zoom, snapFn]
  )

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      const s = state.current
      if (!s) return

      s.el.releasePointerCapture(e.pointerId)
      state.current = null

      // Push history BEFORE any store mutations (captures pre-drag state).
      onEnd(s.id)

      // Recompute final position (pointer may have moved since last move event).
      const dx = (e.clientX - s.startX) / zoom
      const dy = (e.clientY - s.startY) / zoom
      let finalX = s.startElemX + dx
      let finalY = s.startElemY + dy

      if (snapFn) {
        const snapped = snapFn(s.id, finalX, finalY, s.elemWidth, s.elemHeight)
        finalX = snapped.x
        finalY = snapped.y
        // Recompute followers delta after snap.
        const sDx = finalX - s.startElemX
        const sDy = finalY - s.startElemY
        for (const f of s.followers) {
          const ex = f.startX + sDx
          const ey = f.startY + sDy
          f.el.style.left = `${ex}px`
          f.el.style.top = `${ey}px`
          f.commit(f.id, Math.round(ex), Math.round(ey))
        }
      } else {
        for (const f of s.followers) {
          const ex = f.startX + dx
          const ey = f.startY + dy
          f.el.style.left = `${ex}px`
          f.el.style.top = `${ey}px`
          f.commit(f.id, Math.round(ex), Math.round(ey))
        }
      }

      s.el.style.left = `${finalX}px`
      s.el.style.top = `${finalY}px`

      // Clear snap guide lines.
      onGuidesChange?.({ verticalGuides: [], horizontalGuides: [] })

      // Commit final position to store.
      onDrag(s.id, finalX, finalY)
    },
    [zoom, snapFn, onDrag, onEnd, onGuidesChange]
  )

  /** Reverts element to pre-drag position and clears guides. Used by Escape key. */
  const cancel = useCallback(() => {
    const s = state.current
    if (!s) return

    state.current = null
    s.el.style.left = `${s.startElemX}px`
    s.el.style.top = `${s.startElemY}px`

    for (const f of s.followers) {
      f.el.style.left = `${f.startX}px`
      f.el.style.top = `${f.startY}px`
    }

    onGuidesChange?.({ verticalGuides: [], horizontalGuides: [] })
  }, [onGuidesChange])

  return {
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    cancel
  }
}
