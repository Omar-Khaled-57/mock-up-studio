import { useCallback, useRef } from 'react'

interface DragState {
  id: string
  startX: number
  startY: number
  startElemX: number
  startElemY: number
  el: HTMLElement
}

interface UseDragOptions {
  zoom: number
  onStart?: (id: string) => void
  onDrag: (id: string, x: number, y: number) => void
  onEnd: (id: string) => void
}

export function useDrag({ zoom, onStart, onDrag, onEnd }: UseDragOptions) {
  const state = useRef<DragState | null>(null)

  const handlePointerDown = useCallback(
    (e: React.PointerEvent, id: string, elemX: number, elemY: number) => {
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

      const dx = (e.clientX - s.startX) / zoom
      const dy = (e.clientY - s.startY) / zoom
      const newX = s.startElemX + dx
      const newY = s.startElemY + dy

      s.el.style.left = `${newX}px`
      s.el.style.top = `${newY}px`
    },
    [zoom]
  )

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      const s = state.current
      if (!s) return

      s.el.releasePointerCapture(e.pointerId)
      state.current = null

      const dx = (e.clientX - s.startX) / zoom
      const dy = (e.clientY - s.startY) / zoom
      const finalX = s.startElemX + dx
      const finalY = s.startElemY + dy

      s.el.style.left = `${finalX}px`
      s.el.style.top = `${finalY}px`

      onDrag(s.id, finalX, finalY)
      onEnd(s.id)
    },
    [zoom, onDrag, onEnd]
  )

  const cancel = useCallback(() => {
    const s = state.current
    if (!s) return

    state.current = null
    s.el.style.left = `${s.startElemX}px`
    s.el.style.top = `${s.startElemY}px`
  }, [])

  return {
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    cancel
  }
}
