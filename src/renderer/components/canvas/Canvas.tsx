import { useRef, useEffect, useCallback } from 'react'
import { useStore } from '../../store'
import Scene from './Scene'

export default function Canvas() {
  const containerRef = useRef<HTMLDivElement>(null)
  const scene = useStore((s) => s.scenes[s.activeSceneIndex])
  const zoom = useStore((s) => s.zoom)
  const panX = useStore((s) => s.panX)
  const panY = useStore((s) => s.panY)
  const isPanning = useStore((s) => s.isPanning)
  const setZoom = useStore((s) => s.setZoom)
  const setPan = useStore((s) => s.setPan)
  const setIsPanning = useStore((s) => s.setIsPanning)
  const fitToWindow = useStore((s) => s.fitToWindow)
  const clearSelection = useStore((s) => s.clearSelection)

  const panStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 })
  const zoomRef = useRef(zoom)
  zoomRef.current = zoom
  const panRef = useRef({ x: panX, y: panY })
  panRef.current = { x: panX, y: panY }

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        // Pinch-to-zoom (trackpad pinch or Ctrl+scroll)
        e.preventDefault()
        const scaleFactor = e.deltaY > 0 ? 0.95 : 1.05
        setZoom(zoomRef.current * scaleFactor)
      } else if (e.deltaMode === 0) {
        // Pixel mode — trackpad two-finger scroll → pan
        e.preventDefault()
        const p = panRef.current
        setPan(p.x - e.deltaX, p.y - e.deltaY)
      } else {
        // Line/page mode — mouse wheel → pan vertically
        e.preventDefault()
        const p = panRef.current
        setPan(p.x, p.y - e.deltaY * 16)
      }
    },
    [setZoom, setPan]
  )

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button === 1 || (e.button === 0 && e.altKey)) {
        e.preventDefault()
        setIsPanning(true)
        panStart.current = { x: e.clientX, y: e.clientY, panX, panY }
      }
    },
    [panX, panY, setIsPanning]
  )

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isPanning) return
      const dx = e.clientX - panStart.current.x
      const dy = e.clientY - panStart.current.y
      setPan(panStart.current.panX + dx, panStart.current.panY + dy)
    },
    [isPanning, setPan]
  )

  const handleMouseUp = useCallback(() => {
    if (isPanning) setIsPanning(false)
  }, [isPanning, setIsPanning])

  const handleCanvasClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) clearSelection()
    },
    [clearSelection]
  )

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      fitToWindow(scene.canvas.width, scene.canvas.height, el.clientWidth, el.clientHeight)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [scene.canvas.width, scene.canvas.height, fitToWindow])

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-hidden bg-zinc-950 relative select-none"
      style={{ cursor: isPanning ? 'grabbing' : 'default', touchAction: 'none' }}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onClick={handleCanvasClick}
    >
      <div
        style={{
          transform: `translate(${panX}px, ${panY}px) scale(${zoom})`,
          transformOrigin: '0 0',
          width: scene.canvas.width,
          height: scene.canvas.height,
          position: 'absolute'
        }}
      >
        <Scene />
      </div>

      <div className="absolute bottom-3 right-3 flex items-center gap-2 text-xs text-zinc-500 bg-zinc-900/80 px-2 py-1 rounded">
        <span>{Math.round(zoom * 100)}%</span>
        <span className="text-zinc-700">|</span>
        <span>
          {scene.canvas.width} x {scene.canvas.height}
        </span>
      </div>
    </div>
  )
}
