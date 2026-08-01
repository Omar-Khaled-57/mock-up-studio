/**
 * useResize — Thin adapter over services/transform.createResizeSession.
 *
 * All resize math and commit flow lives in the resize session. This hook
 * keeps the window-level pointermove/pointerup listeners and the
 * React-facing handlePointerDown API.
 */

import { useCallback, useRef, useEffect } from 'react'
import { createResizeSession, ResizeSession } from '../services/transform'
import { ResizeHandle } from '../services/geometry'

interface UseResizeOptions {
  zoom: number
  onResize: (id: string, x: number, y: number, w: number, h: number) => void
  onEnd: (id: string) => void
}

export function useResize({ zoom, onResize, onEnd }: UseResizeOptions) {
  const optsRef = useRef<UseResizeOptions>({ zoom, onResize, onEnd })
  optsRef.current = { zoom, onResize, onEnd }

  const sessionRef = useRef<ResizeSession | null>(null)

  useEffect(() => {
    function handlePointerMove(e: PointerEvent) {
      sessionRef.current?.move({ clientX: e.clientX, clientY: e.clientY }, e.shiftKey)
    }

    function handlePointerUp(e: PointerEvent) {
      const session = sessionRef.current
      if (!session) return
      session.end({ clientX: e.clientX, clientY: e.clientY }, e.shiftKey)
      sessionRef.current = null
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
    }
  }, [])

  const handlePointerDown = useCallback(
    (
      e: React.PointerEvent,
      id: string,
      handle: ResizeHandle,
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

      const opts = optsRef.current
      const session = createResizeSession({
        zoom: opts.zoom,
        element: { id, x: elemX, y: elemY, width, height },
        el,
        onResize: opts.onResize,
        onEnd: opts.onEnd
      })
      session.begin(handle, { clientX: e.clientX, clientY: e.clientY })
      sessionRef.current = session
    },
    []
  )

  return { handlePointerDown }
}
