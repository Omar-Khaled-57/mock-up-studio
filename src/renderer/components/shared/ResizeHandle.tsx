import { useCallback, useRef, useEffect } from 'react'

interface ResizeHandleProps {
  onResize: (delta: number) => void
  position: 'left' | 'right'
}

export default function ResizeHandle({ onResize, position }: ResizeHandleProps) {
  const dragging = useRef(false)
  const startX = useRef(0)

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault()
    dragging.current = true
    startX.current = e.clientX
    const handlePointerMove = (ev: PointerEvent) => {
      if (!dragging.current) return
      const delta = ev.clientX - startX.current
      startX.current = ev.clientX
      onResize(delta)
    }
    const handlePointerUp = () => {
      dragging.current = false
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
    }
    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
  }, [onResize])

  useEffect(() => () => {
    dragging.current = false
  }, [])

  return (
    <div
      onPointerDown={handlePointerDown}
      className={`w-1 cursor-col-resize hover:bg-indigo-500/40 active:bg-indigo-500/60 transition-colors shrink-0 relative
        ${position === 'left' ? 'mr-0' : 'ml-0'}`}
    >
      <div className="absolute inset-y-0 -left-1 -right-1" />
    </div>
  )
}
