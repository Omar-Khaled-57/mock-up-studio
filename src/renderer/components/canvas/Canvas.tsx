import { useRef, useEffect, useCallback, useState } from 'react'
import { useStore } from '../../store'
import { safeScene } from '../../store/sceneSlice'
import Scene from './Scene'
import Ruler from './Ruler'

const RULER_SIZE = 20

interface RubberBand {
  startX: number
  startY: number
  currentX: number
  currentY: number
}

export default function Canvas() {
  const containerRef = useRef<HTMLDivElement>(null)
  const scene = useStore(safeScene)
  const zoom = useStore((s) => s.zoom)
  const panX = useStore((s) => s.panX)
  const panY = useStore((s) => s.panY)
  const isPanning = useStore((s) => s.isPanning)
  const setZoom = useStore((s) => s.setZoom)
  const setPan = useStore((s) => s.setPan)
  const setIsPanning = useStore((s) => s.setIsPanning)
  const fitToWindow = useStore((s) => s.fitToWindow)
  const clearSelection = useStore((s) => s.clearSelection)
  const selectInRect = useStore((s) => s.selectInRect)
  const showRulers = useStore((s) => s.showRulers)

  const panStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 })
  const zoomRef = useRef(zoom)
  zoomRef.current = zoom
  const panRef = useRef({ x: panX, y: panY })
  panRef.current = { x: panX, y: panY }

  const [rubberBand, setRubberBand] = useState<RubberBand | null>(null)
  const rubberBandRef = useRef<RubberBand | null>(null)

  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 })

  const screenToScene = useCallback(
    (clientX: number, clientY: number) => {
      const container = containerRef.current
      if (!container) return { x: 0, y: 0 }
      const rect = container.getBoundingClientRect()
      const screenX = clientX - rect.left
      const screenY = clientY - rect.top
      return {
        x: (screenX - panRef.current.x) / zoomRef.current,
        y: (screenY - panRef.current.y) / zoomRef.current
      }
    },
    []
  )

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault()
        const scaleFactor = e.deltaY > 0 ? 0.95 : 1.05
        setZoom(zoomRef.current * scaleFactor)
      } else if (e.deltaMode === 0) {
        e.preventDefault()
        const p = panRef.current
        setPan(p.x - e.deltaX, p.y - e.deltaY)
      } else {
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
        return
      }
      if (e.button === 0 && e.target === e.currentTarget) {
        const pos = screenToScene(e.clientX, e.clientY)
        const band: RubberBand = { startX: pos.x, startY: pos.y, currentX: pos.x, currentY: pos.y }
        rubberBandRef.current = band
        setRubberBand(band)
      }
    },
    [panX, panY, setIsPanning, screenToScene]
  )

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (isPanning) {
        const dx = e.clientX - panStart.current.x
        const dy = e.clientY - panStart.current.y
        setPan(panStart.current.panX + dx, panStart.current.panY + dy)
        return
      }
      const band = rubberBandRef.current
      if (band) {
        const pos = screenToScene(e.clientX, e.clientY)
        const updated = { ...band, currentX: pos.x, currentY: pos.y }
        rubberBandRef.current = updated
        setRubberBand(updated)
      }
    },
    [isPanning, setPan, screenToScene]
  )

  const handleMouseUp = useCallback(
    () => {
      if (isPanning) {
        setIsPanning(false)
        return
      }
      const band = rubberBandRef.current
      if (band) {
        rubberBandRef.current = null
        setRubberBand(null)
        const bw = band.currentX - band.startX
        const bh = band.currentY - band.startY
        if (Math.abs(bw) > 3 || Math.abs(bh) > 3) {
          selectInRect(band.startX, band.startY, bw, bh)
        } else {
          clearSelection()
        }
      }
    },
    [isPanning, setIsPanning, selectInRect, clearSelection]
  )

  const handleCanvasClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget && !rubberBandRef.current) clearSelection()
    },
    [clearSelection]
  )

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    let timer: ReturnType<typeof setTimeout> | null = null
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerSize({ width: entry.contentRect.width, height: entry.contentRect.height })
      }
      if (timer) return
      timer = setTimeout(() => {
        timer = null
        fitToWindow(scene.canvas.width, scene.canvas.height, el.clientWidth, el.clientHeight)
      }, 100)
    })
    ro.observe(el)
    return () => {
      if (timer) clearTimeout(timer)
      ro.disconnect()
    }
  }, [scene.canvas.width, scene.canvas.height, fitToWindow])

  const hRulerLength = Math.max(0, containerSize.width - RULER_SIZE)
  const vRulerLength = Math.max(0, containerSize.height - RULER_SIZE)

  return (
    <div
      ref={containerRef}
      className="flex-1 bg-zinc-950 relative select-none"
      style={{ touchAction: 'none' }}
    >
      {/* Guide preview overlay while dragging from ruler */}
      <div
        id="ruler-guide-preview"
        className="absolute inset-0 pointer-events-none z-50"
        style={{ display: 'none' }}
      >
        <div />
      </div>

      <div className="flex flex-col w-full h-full overflow-hidden">
        {/* Ruler row (top) */}
        {showRulers && (
          <div className="flex flex-shrink-0" style={{ height: RULER_SIZE }}>
            <div
              className="flex-shrink-0"
              style={{
                width: RULER_SIZE, height: RULER_SIZE,
                background: '#18181b',
                borderBottom: '1px solid #27272a',
                borderRight: '1px solid #27272a'
              }}
            />
            <div className="flex-1 overflow-hidden">
              <Ruler orientation="horizontal" viewportLength={hRulerLength} />
            </div>
          </div>
        )}

        {/* Main row: ruler column (left) + scene */}
        <div className="flex flex-1 overflow-hidden">
          {showRulers && (
            <div
              className="flex-shrink-0"
              style={{
                width: RULER_SIZE,
                background: '#18181b',
                borderRight: '1px solid #27272a',
                overflow: 'visible'
              }}
            >
              <Ruler orientation="vertical" viewportLength={vRulerLength} />
            </div>
          )}

          {/* Scene content area */}
          <div
            className="flex-1 overflow-hidden relative"
            style={{ cursor: isPanning ? 'grabbing' : 'default' }}
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

              {rubberBand && (
                <div
                  style={{
                    position: 'absolute',
                    left: Math.min(rubberBand.startX, rubberBand.currentX),
                    top: Math.min(rubberBand.startY, rubberBand.currentY),
                    width: Math.abs(rubberBand.currentX - rubberBand.startX),
                    height: Math.abs(rubberBand.currentY - rubberBand.startY),
                    border: '1px solid #3b82f6',
                    background: 'rgba(59, 130, 246, 0.08)',
                    pointerEvents: 'none',
                    zIndex: 9999
                  }}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="absolute bottom-3 right-3 flex items-center gap-2 text-xs text-zinc-500 bg-zinc-900/80 px-2 py-1 rounded pointer-events-none">
        <span>{Math.round(zoom * 100)}%</span>
        <span className="text-zinc-700">|</span>
        <span>
          {scene.canvas.width} x {scene.canvas.height}
        </span>
      </div>
    </div>
  )
}
