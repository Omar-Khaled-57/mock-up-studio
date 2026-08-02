import { useRef, useEffect, useCallback, useState } from 'react'
import { useStore } from '../../store'
import { safeScene } from '../../store/sceneSlice'
import { useRuntimeStore } from '../../runtime/store'
import { useTheme } from '../../hooks/useTheme'
import Scene from './Scene'
import Ruler from './Ruler'
import ToolEventSurface from './ToolEventSurface'
import OverlayRenderer from './OverlayRenderer'
import CanvasEmptyState from './CanvasEmptyState'

const RULER_SIZE = 20

export default function Canvas() {
  const containerRef = useRef<HTMLDivElement>(null)
  const scene = useStore(safeScene)
  const zoom = useStore((s) => s.zoom)
  const panX = useStore((s) => s.panX)
  const panY = useStore((s) => s.panY)
  const setZoom = useStore((s) => s.setZoom)
  const fitToWindow = useStore((s) => s.fitToWindow)
  const showRulers = useStore((s) => s.showRulers)
  const emptyStateDismissed = useRuntimeStore((s) => s.canvasEmptyStateDismissed)
  const dismissCanvasEmptyState = useRuntimeStore((s) => s.dismissCanvasEmptyState)
  const { clsx, bg, text, border } = useTheme()

  const zoomRef = useRef(zoom)
  zoomRef.current = zoom

  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 })

  // Seeded hero title/slogan boxes (`stylePreset`) are part of the default
  // scene, not user content — exclude them so a fresh scene still shows the
  // empty state until the user adds their own elements.
  const userElementCount =
    scene.devices.length +
    scene.textBoxes.filter((t) => t.stylePreset === 'custom').length +
    scene.images.length +
    scene.shapes.length
  const showEmptyState = !emptyStateDismissed && userElementCount === 0

  // First user element add permanently dismisses the empty state for the
  // session (so undoing all the way back to an empty scene doesn't resurrect it).
  useEffect(() => {
    if (userElementCount > 0) dismissCanvasEmptyState()
  }, [userElementCount, dismissCanvasEmptyState])

  const handlePointerDownCapture = useCallback(
    (e: React.PointerEvent) => {
      const target = e.target as HTMLElement
      if (target.closest('[data-empty-state]')) return
      dismissCanvasEmptyState()
    },
    [dismissCanvasEmptyState]
  )

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault()
        const scaleFactor = e.deltaY > 0 ? 0.95 : 1.05
        setZoom(zoomRef.current * scaleFactor)
      }
    },
    [setZoom]
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
      data-canvas-viewport
      onPointerDownCapture={handlePointerDownCapture}
      className={clsx("flex-1 relative select-none", bg.canvas)}
      style={{ touchAction: 'none' }}
    >
      {showEmptyState && <CanvasEmptyState />}

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
              className={clsx("flex-shrink-0 border-b border-r", bg.ruler)}
              style={{ width: RULER_SIZE, height: RULER_SIZE }}
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
              className={clsx("flex-shrink-0 overflow-visible border-r", bg.ruler)}
              style={{ width: RULER_SIZE }}
            >
              <Ruler orientation="vertical" viewportLength={vRulerLength} />
            </div>
          )}

          {/* Scene content area */}
          <ToolEventSurface onWheel={handleWheel}>
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

              <OverlayRenderer />
            </div>
          </ToolEventSurface>
        </div>
      </div>

      <div className={clsx("absolute bottom-3 right-3 flex items-center gap-2 text-xs px-2 py-1 rounded pointer-events-none border", text.tertiary, bg.primary, border.primary)}>
        <span>
          {scene.canvas.width} x {scene.canvas.height}
        </span>
      </div>
    </div>
  )
}
