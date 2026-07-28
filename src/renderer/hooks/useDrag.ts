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
}

interface SnapInfo {
  verticalGuides: number[]
  horizontalGuides: number[]
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
}

export function useDrag({ zoom, onStart, onDrag, onEnd, snapFn, onGuidesChange }: UseDragOptions) {
  const state = useRef<DragState | null>(null)

  const handlePointerDown = useCallback(
    (e: React.PointerEvent, id: string, elemX: number, elemY: number, elemW?: number, elemH?: number) => {
      if (e.button !== 0) return
      e.stopPropagation()

      const el = e.currentTarget as HTMLElement
      el.setPointerCapture(e.pointerId)

      state.current = {
        id,
        startX: e.clientX,
        startY: e.clientY,
        startElemX: elemX,
        startElemY: elemY,
        elemWidth: elemW ?? el.offsetWidth,
        elemHeight: elemH ?? el.offsetHeight,
        el
      }

      onStart?.(id)
    },
    [onStart]
  )

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
    },
    [zoom, snapFn]
  )

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      const s = state.current
      if (!s) return

      s.el.releasePointerCapture(e.pointerId)
      state.current = null

      // Recompute final position (pointer may have moved since last move event).
      const dx = (e.clientX - s.startX) / zoom
      const dy = (e.clientY - s.startY) / zoom
      let finalX = s.startElemX + dx
      let finalY = s.startElemY + dy

      if (snapFn) {
        const snapped = snapFn(s.id, finalX, finalY, s.elemWidth, s.elemHeight)
        finalX = snapped.x
        finalY = snapped.y
      }

      s.el.style.left = `${finalX}px`
      s.el.style.top = `${finalY}px`

      // Clear snap guide lines.
      onGuidesChange?.({ verticalGuides: [], horizontalGuides: [] })

      // Commit final position to store and push history.
      onDrag(s.id, finalX, finalY)
      onEnd(s.id)
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

    onGuidesChange?.({ verticalGuides: [], horizontalGuides: [] })
  }, [onGuidesChange])

  return {
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    cancel
  }
}
