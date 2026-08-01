/**
 * useDrag — Thin adapter over services/transform.createDragSession.
 *
 * All drag math, snapping, follower movement, and commit flow lives in the
 * drag session. This hook owns pointer capture and the React-facing API:
 *   handlePointerDown(e, id, elemX, elemY, elemW?, elemH?)
 *   handlePointerMove(e)
 *   handlePointerUp(e)
 *   cancel()
 */

import { useCallback, useRef } from 'react'
import { createDragSession, DragSession, MultiDragEntry } from '../services/transform'

export type { MultiDragEntry }

interface SnapInfo {
  verticalGuides: number[]
  horizontalGuides: number[]
}

interface UseDragOptions {
  zoom: number
  onStart?: (id: string) => void
  onDrag: (id: string, x: number, y: number) => void
  onEnd: (id: string) => void
  snapFn?: (id: string, x: number, y: number, w: number, h: number) => { x: number; y: number }
  onGuidesChange?: (guides: SnapInfo) => void
  getMultiDrag?: () => MultiDragEntry[]
}

export function useDrag({ zoom, onStart, onDrag, onEnd, snapFn, onGuidesChange, getMultiDrag }: UseDragOptions) {
  const optsRef = useRef<UseDragOptions>({ zoom, onStart, onDrag, onEnd, snapFn, onGuidesChange, getMultiDrag })
  optsRef.current = { zoom, onStart, onDrag, onEnd, snapFn, onGuidesChange, getMultiDrag }

  const sessionRef = useRef<DragSession | null>(null)
  const elRef = useRef<HTMLElement | null>(null)

  const handlePointerDown = useCallback(
    (e: React.PointerEvent, id: string, elemX: number, elemY: number, elemW?: number, elemH?: number) => {
      if (e.button !== 0) return
      e.stopPropagation()

      const el = e.currentTarget as HTMLElement
      el.setPointerCapture(e.pointerId)
      elRef.current = el

      const opts = optsRef.current
      const session = createDragSession({
        zoom: opts.zoom,
        element: {
          id,
          x: elemX,
          y: elemY,
          width: elemW ?? el.offsetWidth,
          height: elemH ?? el.offsetHeight
        },
        el,
        onStart: opts.onStart,
        onDrag: opts.onDrag,
        onEnd: opts.onEnd,
        snapFn: opts.snapFn,
        onGuidesChange: opts.onGuidesChange,
        getMultiDrag: opts.getMultiDrag
      })
      session.begin({ clientX: e.clientX, clientY: e.clientY })
      sessionRef.current = session
    },
    []
  )

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    sessionRef.current?.move({ clientX: e.clientX, clientY: e.clientY })
  }, [])

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    const session = sessionRef.current
    if (!session) return
    elRef.current?.releasePointerCapture?.(e.pointerId)
    session.end({ clientX: e.clientX, clientY: e.clientY })
    sessionRef.current = null
    elRef.current = null
  }, [])

  const cancel = useCallback(() => {
    sessionRef.current?.cancel()
    sessionRef.current = null
    elRef.current = null
  }, [])

  return {
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    cancel
  }
}
