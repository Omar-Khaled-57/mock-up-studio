import { useCallback, useRef, useEffect } from 'react'

type Handle = 'nw' | 'ne' | 'sw' | 'se'

interface ResizeState {
  id: string
  handle: Handle
  startX: number
  startY: number
  startWidth: number
  startHeight: number
  startElemX: number
  startElemY: number
  aspectRatio: number
  el: HTMLElement
}

interface UseResizeOptions {
  zoom: number
  onResize: (id: string, x: number, y: number, w: number, h: number) => void
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

  const compute = useCallback(
    (clientX: number, clientY: number, shiftKey: boolean) => {
      const s = state.current
      if (!s) return null

      const rawDx = (clientX - s.startX) / zoomRef.current
      const rawDy = (clientY - s.startY) / zoomRef.current
      const proportional = shiftKey

      let newWidth = s.startWidth
      let newHeight = s.startHeight
      let newX = s.startElemX
      let newY = s.startElemY

      switch (s.handle) {
        case 'se':
          newWidth = Math.max(20, s.startWidth + rawDx)
          newHeight = proportional ? newWidth / s.aspectRatio : Math.max(20, s.startHeight + rawDy)
          break
        case 'sw':
          newWidth = Math.max(20, s.startWidth - rawDx)
          newHeight = proportional ? newWidth / s.aspectRatio : Math.max(20, s.startHeight + rawDy)
          newX = s.startElemX + (s.startWidth - newWidth)
          break
        case 'ne':
          newWidth = Math.max(20, s.startWidth + rawDx)
          newHeight = proportional ? newWidth / s.aspectRatio : Math.max(20, s.startHeight - rawDy)
          newY = s.startElemY + (s.startHeight - newHeight)
          break
        case 'nw':
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

  useEffect(() => {
    function handlePointerMove(e: PointerEvent) {
      const s = state.current
      if (!s) return

      const result = compute(e.clientX, e.clientY, e.shiftKey)
      if (!result) return

      s.el.style.width = `${result.newWidth}px`
      s.el.style.height = `${result.newHeight}px`
      s.el.style.left = `${result.newX}px`
      s.el.style.top = `${result.newY}px`

      onResizeRef.current(s.id, result.newX, result.newY, result.newWidth, result.newHeight)
    }

    function handlePointerUp(e: PointerEvent) {
      const s = state.current
      if (!s) return

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
      onEndRef.current(s.id)
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
