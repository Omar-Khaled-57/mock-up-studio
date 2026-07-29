/**
 * useResize — Corner-resize hook with proportional scaling.
 *
 * Corner handles: nw, ne, sw, se. Each handle determines which edges move.
 * - se: right + bottom edges move
 * - sw: left + bottom edges move (left edge tracks rightward, width shrinks)
 * - ne: right + top edges move
 * - nw: left + top edges move
 *
 * Proportional mode:
 *   Hold Shift while resizing to lock the aspect ratio. The new height is
 *   derived from width (or vice versa) using the initial aspect ratio.
 *
 * Window-level listeners:
 *   Unlike useDrag (which uses pointer events on the element), useResize
 *   attaches to `window` for pointermove/pointerup. This avoids issues with
 *   pointer capture being lost when the cursor leaves the handle during resize.
 *
 * Refs for callbacks:
 *   zoom, onResize, onEnd are stored in refs so the window event listeners
 *   always call the latest version without needing to re-register on every
 *   zoom change.
 */

import { useCallback, useRef, useEffect } from 'react'

type Handle = 'nw' | 'ne' | 'sw' | 'se'

interface ResizeState {
  id: string
  handle: Handle
  /** Pointer position at resize start (client coordinates). */
  startX: number
  startY: number
  /** Element dimensions at resize start. */
  startWidth: number
  startHeight: number
  /** Element position at resize start (scene coordinates). */
  startElemX: number
  startElemY: number
  /** width/height at drag start — used to derive height from width in proportional mode. */
  aspectRatio: number
  /** The parent element (device frame) whose styles are mutated directly. */
  el: HTMLElement
}

interface UseResizeOptions {
  /** Current zoom level — divides pointer delta to convert screen pixels to scene units. */
  zoom: number
  /** Called during resize with the computed x, y, w, h (for store commit). */
  onResize: (id: string, x: number, y: number, w: number, h: number) => void
  /** Called after resize ends (typically to push history). */
  onEnd: (id: string) => void
}

export function useResize({ zoom, onResize, onEnd }: UseResizeOptions) {
  const state = useRef<ResizeState | null>(null)
  const zoomRef = useRef(zoom)
  zoomRef.current = zoom

  const onResizeRef = useRef(onResize)
  onResizeRef.current = onResize

  const onEndRef = useRef(onEnd)
  onEndRef.current = onEnd

  /**
   * Pure computation: given pointer position and shiftKey state, returns
   * the new x/y/width/height for the element. Handles each corner's
   * edge-tracking logic and proportional constraint.
   */
  const compute = useCallback(
    (clientX: number, clientY: number, shiftKey: boolean) => {
      const s = state.current
      if (!s) return null

      // Convert screen delta to scene units (accounting for zoom).
      const rawDx = (clientX - s.startX) / zoomRef.current
      const rawDy = (clientY - s.startY) / zoomRef.current
      const proportional = shiftKey

      let newWidth = s.startWidth
      let newHeight = s.startHeight
      let newX = s.startElemX
      let newY = s.startElemY

      switch (s.handle) {
        case 'se':
          // Right and bottom edges move; left and top stay fixed.
          newWidth = Math.max(20, s.startWidth + rawDx)
          newHeight = proportional ? newWidth / s.aspectRatio : Math.max(20, s.startHeight + rawDy)
          break
        case 'sw':
          // Left edge moves rightward, width shrinks; bottom moves down.
          newWidth = Math.max(20, s.startWidth - rawDx)
          newHeight = proportional ? newWidth / s.aspectRatio : Math.max(20, s.startHeight + rawDy)
          newX = s.startElemX + (s.startWidth - newWidth)
          break
        case 'ne':
          // Right edge moves right, top edge moves up (height shrinks).
          newWidth = Math.max(20, s.startWidth + rawDx)
          newHeight = proportional ? newWidth / s.aspectRatio : Math.max(20, s.startHeight - rawDy)
          newY = s.startElemY + (s.startHeight - newHeight)
          break
        case 'nw':
          // Both left and top edges move inward (width and height shrink).
          newWidth = Math.max(20, s.startWidth - rawDx)
          newHeight = proportional ? newWidth / s.aspectRatio : Math.max(20, s.startHeight - rawDy)
          newX = s.startElemX + (s.startWidth - newWidth)
          newY = s.startElemY + (s.startHeight - newHeight)
          break
      }

      return { newX, newY, newWidth, newHeight }
    },
    []
  )

  // Window-level listeners ensure we receive events even if pointer leaves
  // the element or the browser window loses focus temporarily.
  useEffect(() => {
    function handlePointerMove(e: PointerEvent) {
      const s = state.current
      if (!s) return

      const result = compute(e.clientX, e.clientY, e.shiftKey)
      if (!result) return

      // Direct DOM mutation during resize (no React render).
      s.el.style.width = `${result.newWidth}px`
      s.el.style.height = `${result.newHeight}px`
      s.el.style.left = `${result.newX}px`
      s.el.style.top = `${result.newY}px`

      onResizeRef.current(s.id, result.newX, result.newY, result.newWidth, result.newHeight)
    }

    function handlePointerUp(e: PointerEvent) {
      const s = state.current
      if (!s) return

      // Push history BEFORE committing final dimensions.
      onEndRef.current(s.id)

      const result = compute(e.clientX, e.clientY, e.shiftKey)
      if (result) {
        s.el.style.width = `${result.newWidth}px`
        s.el.style.height = `${result.newHeight}px`
        s.el.style.left = `${result.newX}px`
        s.el.style.top = `${result.newY}px`
        onResizeRef.current(s.id, result.newX, result.newY, result.newWidth, result.newHeight)
      }

      s.el.style.cursor = ''
      state.current = null
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
    }
  }, [compute])

  const handlePointerDown = useCallback(
    (
      e: React.PointerEvent,
      id: string,
      handle: Handle,
      elemX: number,
      elemY: number,
      width: number,
      height: number
    ) => {
      if (e.button !== 0) return
      e.stopPropagation()
      e.preventDefault()

      const el = e.currentTarget.parentElement
      if (!el) return

      // Set cursor to indicate resize direction.
      el.style.cursor =
        handle === 'nw' || handle === 'se' ? 'nwse-resize' : 'nesw-resize'

      state.current = {
        id,
        handle,
        startX: e.clientX,
        startY: e.clientY,
        startWidth: width,
        startHeight: height,
        startElemX: elemX,
        startElemY: elemY,
        aspectRatio: width / height,
        el
      }
    },
    []
  )

  return { handlePointerDown }
}
